#!/usr/bin/env node
// Generates card artwork with the OpenAI Images API and writes it to assets/cards/.
//
//   OPENAI_API_KEY=sk-... node scripts/generate-cards.mjs            # court cards, dealer, pip face, back (15 images)
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
// Visual reference: vintage double-ended court cards — ermine-trimmed royal robes,
// suit-motif crowns and scepters, ivory card stock, thin gold frame, bold ink outlines.
// Court art is generated as a square HALF portrait; the game mirrors it top/bottom
// (like a real double-ended playing card) and draws the rank/suit indices itself.
const SUIT_THEMES = {
  S: { name: 'Spades', theme: 'black-and-gold robe covered in spade motifs, crown with spade-shaped points, scepter topped with a black spade' },
  H: { name: 'Hearts', theme: 'crimson-and-gold robe covered in heart motifs, crown with heart-shaped jewels, scepter topped with a red heart' },
  D: { name: 'Diamonds', theme: 'red-and-gold robe covered in diamond motifs, crown set with diamond-shaped rubies, scepter topped with a red diamond' },
  C: { name: 'Clubs', theme: 'black-and-emerald robe covered in club motifs, crown with club-shaped finials, scepter topped with a black club' },
};

const RANK_ROLES = {
  J: 'as the JACK: a cheeky young knave with a feathered cap, shredding an electric guitar, mid-shout with a wild grin',
  Q: 'as the QUEEN: a theatrical rock royal with a tall ornate crown, throwing rock-and-roll devil horns with one hand, mouth wide open in a triumphant scream',
  K: 'as the KING: a smug rock-and-roll monarch with a tilted crown, pointing straight at the viewer with one finger, eyebrow raised, holding a scepter',
};

const STYLE =
  'Upper half of a vintage double-ended playing-card court figure: waist-up portrait, centered, ' +
  'body cut off cleanly at the bottom edge at waist level, ermine-trimmed royal robe with gold chains. ' +
  'Detailed classic playing-card illustration, bold ink outlines, rich saturated reds, blacks and golds, ' +
  'ivory background, humorous and affectionate caricature with an exaggerated comedic expression. ' +
  'No border, no frame, no text, no letters, no numbers, no card indices, no logos.';

function buildJobs(subject) {
  const jobs = [];
  for (const suit of Object.keys(SUIT_THEMES)) {
    for (const rank of Object.keys(RANK_ROLES)) {
      jobs.push({
        id: `${rank}${suit}`,
        size: '1024x1024',
        prompt: `${subject} ${RANK_ROLES[rank]}. Costume: ${SUIT_THEMES[suit].theme}. ${STYLE}`,
      });
    }
  }
  jobs.push({
    id: 'DEALER',
    size: '1024x1024',
    background: 'transparent',
    prompt:
      `${subject} as a casino blackjack dealer, wearing a sharp black suit, crisp white shirt and a slim ` +
      'black tie, seated and facing the viewer across the table, waist-up, both hands resting just below ' +
      'the frame, confident mischievous grin with one eyebrow raised. Bold ink outlines, rich colors, ' +
      'humorous and affectionate caricature. Isolated character on a transparent background, ' +
      'no table, no cards, no text, no logos.',
  });
  jobs.push({
    id: 'FACE',
    size: '1024x1024',
    background: 'transparent',
    prompt:
      `${subject}, close-up of the head only, front-facing, the face filling most of the frame ` +
      'from hairline to chin, big grin, one eyebrow raised, bold ink outlines and flat saturated colors ' +
      '(it will be shown tiny inside playing-card suit symbols, so keep features large and readable). ' +
      'Transparent background, no text, no logos.',
  });
  jobs.push({
    id: 'BACK',
    size: '1024x1536',
    prompt:
      'Vintage casino playing-card back, full bleed, perfectly symmetrical: deep crimson velvet red ' +
      'with an ornate gold filigree lattice, small gold spade, heart, diamond and club emblems, ' +
      'a central gold medallion containing a crossed electric guitar and crown emblem, ' +
      'thin ivory margin, rich red-black-gold theatre palette. No text, no letters, no faces.',
  });
  return jobs;
}

// ---------- OpenAI Images API ----------
async function generateImage({ apiKey, model, quality, prompt, size, background }) {
  const res = await fetch('https://api.openai.com/v1/images/generations', {
    method: 'POST',
    headers: { 'Content-Type': 'application/json', Authorization: `Bearer ${apiKey}` },
    body: JSON.stringify({
      model,
      prompt,
      size,
      quality,
      n: 1,
      ...(background ? { background } : {}),
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
      const img = await withRetry(() => generateImage({ apiKey, model, quality, ...job }));
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
