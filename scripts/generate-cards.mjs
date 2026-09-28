#!/usr/bin/env node
// Generates card artwork with the OpenAI Images API and writes it to assets/cards/.
//
//   OPENAI_API_KEY=sk-... node scripts/generate-cards.mjs            # face cards + back (13 images)
//   OPENAI_API_KEY=sk-... node scripts/generate-cards.mjs --only KS  # a single card
//   OPENAI_API_KEY=sk-... node scripts/generate-cards.mjs --force    # regenerate existing files
//   node scripts/generate-cards.mjs --dry-run                        # print prompts, no API calls
//
// Options (env or flags):
//   OPENAI_IMAGE_MODEL / --model    default gpt-image-1
//   OPENAI_IMAGE_QUALITY / --quality low | medium | high (default medium)
//   CARD_SUBJECT / --subject        who/what is drawn (see README for the likeness caveat)
//
// The API key is only read from the environment (or a local .env file) and is never
// written anywhere. Generated images are meant to be committed so the static site
// can be played without any key.

import { mkdir, readFile, writeFile, access } from 'node:fs/promises';
import { fileURLToPath } from 'node:url';
import path from 'node:path';

const ROOT = path.resolve(path.dirname(fileURLToPath(import.meta.url)), '..');
const OUT_DIR = path.join(ROOT, 'assets', 'cards');
const MANIFEST = path.join(OUT_DIR, 'manifest.json');

// ---------- tiny .env loader (no dependencies) ----------
async function loadDotEnv() {
  try {
    const text = await readFile(path.join(ROOT, '.env'), 'utf8');
    for (const line of text.split('\n')) {
      const m = line.match(/^\s*([A-Z0-9_]+)\s*=\s*(.*)\s*$/);
      if (m && !(m[1] in process.env)) process.env[m[1]] = m[2].replace(/^['"]|['"]$/g, '');
    }
  } catch {
    // no .env — fine
  }
}

function parseArgs(argv) {
  const args = { force: false, dryRun: false, only: null };
  for (let i = 0; i < argv.length; i++) {
    const a = argv[i];
    if (a === '--force') args.force = true;
    else if (a === '--dry-run') args.dryRun = true;
    else if (a === '--only') args.only = argv[++i].split(',').map((s) => s.trim().toUpperCase());
    else if (a === '--model') args.model = argv[++i];
    else if (a === '--quality') args.quality = argv[++i];
    else if (a === '--subject') args.subject = argv[++i];
    else throw new Error(`Unknown argument: ${a}`);
  }
  return args;
}

// ---------- prompt design ----------
const SUIT_THEMES = {
  S: { name: 'Spades', theme: 'heavy-metal stage with black leather, spikes, smoke and dramatic lightning' },
  H: { name: 'Hearts', theme: 'over-the-top power-ballad stage with red roses, hearts and pink spotlights' },
  D: { name: 'Diamonds', theme: 'sparkly 70s glam-rock stage with sequins, disco ball and gold glitter' },
  C: { name: 'Clubs', theme: 'chaotic school-band classroom rock show with chalkboard, amps and a green palette' },
};

const RANK_ROLES = {
  J: 'as the JACK: a mischievous jester-roadie mid-air jump with an electric guitar',
  Q: 'as the QUEEN: a theatrical rock-opera royal in a flowing cape, belting a high note into a microphone',
  K: 'as the KING: a triumphant rock-and-roll king on a throne of amplifiers, crown tilted, doing devil horns',
};

const STYLE =
  'Vintage playing-card illustration, bold ink outlines, flat saturated colors, ornate border, ' +
  'humorous and affectionate cartoon caricature, exaggerated comedic facial expression, ' +
  'portrait orientation, centered character, no text, no letters, no numbers, no logos.';

function buildJobs(subject) {
  const jobs = [];
  for (const suit of Object.keys(SUIT_THEMES)) {
    for (const rank of Object.keys(RANK_ROLES)) {
      jobs.push({
        id: `${rank}${suit}`,
        prompt: `${subject} ${RANK_ROLES[rank]}. Setting: ${SUIT_THEMES[suit].theme}. ${STYLE}`,
      });
    }
  }
  jobs.push({
    id: 'BACK',
    prompt:
      `Playing-card back design: a symmetrical ornate pattern built from electric guitars, ` +
      `lightning bolts, flames and a small cartoon rocker face emblem in the center, ` +
      `deep purple and gold, ${STYLE}`,
  });
  return jobs;
}

// ---------- OpenAI Images API ----------
async function generateImage({ apiKey, model, quality, prompt }) {
  const res = await fetch('https://api.openai.com/v1/images/generations', {
    method: 'POST',
    headers: { 'Content-Type': 'application/json', Authorization: `Bearer ${apiKey}` },
    body: JSON.stringify({
      model,
      prompt,
      size: '1024x1536',
      quality,
      n: 1,
      output_format: 'webp',
      output_compression: 80,
    }),
  });
  const body = await res.json().catch(() => ({}));
  if (!res.ok) {
    const msg = body?.error?.message ?? res.statusText;
    const err = new Error(`${res.status} ${msg}`);
    err.status = res.status;
    err.code = body?.error?.code;
    throw err;
  }
  const b64 = body?.data?.[0]?.b64_json;
  if (!b64) throw new Error('No image data in response');
  return Buffer.from(b64, 'base64');
}

async function withRetry(fn, tries = 4) {
  for (let i = 0; ; i++) {
    try {
      return await fn();
    } catch (err) {
      const retriable = err.status === 429 || (err.status >= 500 && err.status < 600);
      if (!retriable || i >= tries - 1) throw err;
      const wait = 2000 * 2 ** i;
      console.warn(`  retrying in ${wait / 1000}s (${err.message})`);
      await new Promise((r) => setTimeout(r, wait));
    }
  }
}

const exists = (p) => access(p).then(() => true, () => false);

async function main() {
  await loadDotEnv();
  const args = parseArgs(process.argv.slice(2));
  const model = args.model ?? process.env.OPENAI_IMAGE_MODEL ?? 'gpt-image-1';
  const quality = args.quality ?? process.env.OPENAI_IMAGE_QUALITY ?? 'medium';
  const subject =
    args.subject ??
    process.env.CARD_SUBJECT ??
    'A friendly cartoon caricature of comedic actor and rock musician Jack Black';

  let jobs = buildJobs(subject);
  if (args.only) jobs = jobs.filter((j) => args.only.includes(j.id));
  if (!jobs.length) throw new Error('No matching cards for --only');

  if (args.dryRun) {
    for (const j of jobs) console.log(`[${j.id}] ${j.prompt}\n`);
    return;
  }

  const apiKey = process.env.OPENAI_API_KEY;
  if (!apiKey) {
    console.error('OPENAI_API_KEY is not set. Put it in your environment or a local .env file.');
    process.exit(1);
  }

  await mkdir(OUT_DIR, { recursive: true });
  const manifest = (await exists(MANIFEST)) ? JSON.parse(await readFile(MANIFEST, 'utf8')) : { cards: {} };

  const failed = [];
  for (const job of jobs) {
    const file = `${job.id}.webp`;
    const dest = path.join(OUT_DIR, file);
    if (!args.force && (await exists(dest))) {
      console.log(`- ${job.id}: exists, skipping (use --force to regenerate)`);
      manifest.cards[job.id] = file;
      continue;
    }
    process.stdout.write(`- ${job.id}: generating... `);
    try {
      const img = await withRetry(() => generateImage({ apiKey, model, quality, prompt: job.prompt }));
      await writeFile(dest, img);
      manifest.cards[job.id] = file;
      console.log(`ok (${Math.round(img.length / 1024)} KB)`);
    } catch (err) {
      console.log('FAILED');
      console.error(`    ${err.message}`);
      if (err.code === 'moderation_blocked' || err.code === 'content_policy_violation') {
        console.error('    The request was rejected by the content policy. The game will fall back');
        console.error('    to built-in art for this card. See README ("카드 이미지") for options.');
      }
      failed.push(job.id);
    }
    // Save progress after every card so an interrupted run can resume.
    manifest.model = model;
    manifest.generatedAt = new Date().toISOString();
    await writeFile(MANIFEST, JSON.stringify(manifest, null, 2) + '\n');
  }

  console.log(`\nDone. ${Object.keys(manifest.cards).length} image(s) in assets/cards/.`);
  if (failed.length) {
    console.log(`Failed: ${failed.join(', ')}`);
    process.exitCode = 1;
  }
}

main().catch((err) => {
  console.error(err.message);
  process.exit(1);
});
