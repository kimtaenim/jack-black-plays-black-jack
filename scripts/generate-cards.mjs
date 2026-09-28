#!/usr/bin/env node
/**
 * 카드·딜러 그림 생성기 (OpenAI Images API)
 *
 *   OPENAI_API_KEY=sk-... node scripts/generate-cards.mjs
 *
 * 프롬프트는 전부 data/card-prompts.json 에 있다 (공통 화풍 style + 항목별 items).
 * 결과는 assets/cards/<ID>.webp 로 저장하고 assets/cards/manifest.json 에 등록한다.
 * 게임은 manifest 에 있는 그림만 쓰고, 없는 건 내장 그림으로 대신한다.
 * 이미 있는 파일은 건너뛰므로 중간에 끊겨도 다시 실행하면 이어서 만든다.
 *
 *   ID          용도
 *   JS … KC     J·Q·K 12장 (카드 한 장 전체를 그림, 1024x1536)
 *   TITLE       맨 위 제목 로고 — 세 줄로 쌓은 글자 (1536x1024, 가운데만 잘라 씀)
 *   DEALER_*    딜러 배너 왼쪽 초상 — 잭 블랙 캐리커처, 표정 7가지 (IDLE, DEAL, SHOCK, SAD, LAUGH, SMUG, SHRUG)
 *   FACE        숫자 카드의 무늬 한두 개에 들어가는 얼굴 (1024x1024)
 *   BACK        카드 뒷면 (1024x1536)
 *
 * 옵션
 *   --only QS,KH,FACE  지정한 ID만 생성 (쉼표 구분)
 *   --force            이미 있는 파일도 다시 생성
 *   --model <이름>     기본 gpt-image-2 (없는 모델이면 gpt-image-1 로 자동 대체)
 *   --quality <등급>   low | medium | high   (기본 medium)
 *   --concurrency <n>  동시 요청 수          (기본 3)
 *   --max-width <px>   저장 전에 cwebp 로 이 너비로 축소 (기본 640, 0이면 원본 유지)
 *   --dry-run          호출 없이 최종 프롬프트만 출력
 *   --list-missing     아직 없는 ID만 나열하고 종료
 *
 * API 키는 환경 변수나 로컬 .env 에서만 읽고 어디에도 기록하지 않는다.
 */

import fs from 'node:fs';
import path from 'node:path';
import { spawnSync } from 'node:child_process';
import { fileURLToPath } from 'node:url';

const ROOT = path.resolve(path.dirname(fileURLToPath(import.meta.url)), '..');
const PROMPTS_FILE = path.join(ROOT, 'data/card-prompts.json');
const OUT_DIR = path.join(ROOT, 'assets/cards');
const MANIFEST = path.join(OUT_DIR, 'manifest.json');
const ENDPOINT = process.env.OPENAI_IMAGES_ENDPOINT || 'https://api.openai.com/v1/images/generations';

const SUIT = { S: '♠', H: '♥', D: '♦', C: '♣' };

/* ── .env (의존성 없이) ───────────────────────────────────── */
try {
  for (const line of fs.readFileSync(path.join(ROOT, '.env'), 'utf8').split('\n')) {
    const m = line.match(/^\s*([A-Z0-9_]+)\s*=\s*(.*?)\s*$/);
    if (m && !(m[1] in process.env)) process.env[m[1]] = m[2].replace(/^['"]|['"]$/g, '');
  }
} catch {
  /* .env 없음 */
}

/* ── 인자 파싱 ────────────────────────────────────────────── */
const argv = process.argv.slice(2);
const flag = (name) => argv.includes(`--${name}`);
const opt = (name, dflt) => {
  const i = argv.indexOf(`--${name}`);
  return i >= 0 && argv[i + 1] ? argv[i + 1] : dflt;
};

const OPTS = {
  only: (opt('only', '').toUpperCase().match(/[A-Z_]+/g) || []),
  force: flag('force'),
  model: opt('model', process.env.CARD_IMAGE_MODEL || 'gpt-image-2'),
  quality: opt('quality', 'medium'),
  concurrency: Math.max(1, Number(opt('concurrency', '3')) || 3),
  maxWidth: Math.max(0, Number(opt('max-width', '640')) || 0),
  dryRun: flag('dry-run'),
  listMissing: flag('list-missing'),
};

/* ── 프롬프트 ─────────────────────────────────────────────── */
const { style = {}, items = {} } = JSON.parse(fs.readFileSync(PROMPTS_FILE, 'utf8'));

const sizeOf = (id) => items[id].size || (items[id].type === 'court' ? '1024x1536' : '1024x1024');
const buildPrompt = (id) => {
  const item = items[id];
  const tail =
    item.type === 'court'
      ? (style.court || '').replaceAll('{rank}', id[0]).replaceAll('{suit}', SUIT[id[1]] ?? '')
      : item.noText === false ? '' : style.noText; // noText:false → 글자를 그려야 하는 항목(TITLE)
  const base = item.useStyle === false ? '' : style.base; // useStyle:false → 카드 화풍(카드지·테두리) 빼기
  return [item.prompt, base, tail].filter(Boolean).join('. ').replace(/\.\.+/g, '.');
};

const outFile = (id) => path.join(OUT_DIR, `${id}.webp`);
const unknown = OPTS.only.filter((id) => !items[id]);
if (unknown.length) console.warn(`! card-prompts.json 에 없는 ID (건너뜀): ${unknown.join(', ')}`);

let targets = Object.keys(items).filter((id) => !OPTS.only.length || OPTS.only.includes(id));
if (OPTS.listMissing) {
  console.log(targets.filter((id) => !fs.existsSync(outFile(id))).join('\n') || '(없음)');
  process.exit(0);
}
if (!OPTS.force && !OPTS.dryRun) targets = targets.filter((id) => !fs.existsSync(outFile(id)));

if (OPTS.dryRun) {
  for (const id of targets) console.log(`[${id}] ${sizeOf(id)}\n${buildPrompt(id)}\n`);
  process.exit(0);
}

const API_KEY = process.env.OPENAI_API_KEY;
if (!API_KEY) {
  console.error('OPENAI_API_KEY 가 없습니다. 환경 변수나 .env 에 넣어 주세요.');
  process.exit(1);
}

/* ── 축소 (cwebp 가 있으면) ──────────────────────────────── */
const HAS_CWEBP = spawnSync('cwebp', ['-version'], { stdio: 'ignore' }).status === 0;
const WILL_SHRINK = OPTS.maxWidth > 0 && HAS_CWEBP;
function shrink(file) {
  if (!WILL_SHRINK) return;
  const tmp = `${file}.tmp.webp`;
  const r = spawnSync('cwebp', ['-quiet', '-q', '82', '-resize', String(OPTS.maxWidth), '0', '-metadata', 'none', file, '-o', tmp], {
    stdio: 'ignore',
  });
  if (r.status === 0 && fs.existsSync(tmp) && fs.statSync(tmp).size > 0) fs.renameSync(tmp, file);
  else {
    try { fs.unlinkSync(tmp); } catch {}
    console.warn(`  · ${path.basename(file)} 축소 실패 — 원본 크기로 둡니다.`);
  }
}

/* ── API 호출 ─────────────────────────────────────────────── */
const sleep = (ms) => new Promise((r) => setTimeout(r, ms));

/* 모델·파라미터 지원 범위는 계정과 모델 세대마다 달라서, 서버가 거부하면 깎아내며 재시도한다 */
let model = OPTS.model;
const dropped = new Set();

function body(id) {
  const b = {
    model,
    prompt: buildPrompt(id),
    n: 1,
    size: sizeOf(id),
    quality: OPTS.quality,
    output_format: 'webp',
    output_compression: 85,
    moderation: 'low',
  };
  for (const k of dropped) delete b[k];
  return b;
}

async function generate(id) {
  const MAX = 6;
  for (let attempt = 1; attempt <= MAX; attempt++) {
    let res, text;
    try {
      res = await fetch(ENDPOINT, {
        method: 'POST',
        headers: { 'content-type': 'application/json', authorization: `Bearer ${API_KEY}` },
        body: JSON.stringify(body(id)),
      });
      text = await res.text();
    } catch (err) {
      if (attempt === MAX) throw err;
      await sleep(2000 * 2 ** (attempt - 1));
      continue;
    }

    if (res.ok) {
      const b64 = JSON.parse(text)?.data?.[0]?.b64_json;
      if (!b64) throw new Error(`응답에 이미지가 없습니다: ${text.slice(0, 300)}`);
      fs.mkdirSync(OUT_DIR, { recursive: true });
      fs.writeFileSync(outFile(id), Buffer.from(b64, 'base64'));
      shrink(outFile(id));
      return outFile(id);
    }

    const parsed = (() => { try { return JSON.parse(text)?.error || {}; } catch { return {}; } })();
    const msg = parsed.message || text;
    const param = parsed.param;

    if (res.status === 400 || res.status === 404) {
      /* 모델 이름이 안 맞으면 한 세대 이전 모델로 자동 대체 */
      if (/model/i.test(msg) && /(not (found|exist)|does not exist|unsupported|unknown|invalid)/i.test(msg) && model !== 'gpt-image-1') {
        console.warn(`! 모델 ${model} 사용 불가 → gpt-image-1 로 대체합니다. (${msg})`);
        model = 'gpt-image-1';
        attempt--;
        continue;
      }
      /* 지원하지 않는 파라미터면 빼고 재시도 */
      const bad = param && param !== 'prompt' && param !== 'model'
        ? param
        : (msg.match(/[Uu]n(?:known|recognized|supported)[^']*'([a-z_]+)'/) || [])[1];
      if (bad && !dropped.has(bad) && bad !== 'prompt' && bad !== 'model') {
        console.warn(`! 파라미터 ${bad} 미지원 → 제외하고 재시도합니다.`);
        dropped.add(bad);
        attempt--;
        continue;
      }
      /* 안전 필터 거부는 재시도해도 소용없다 — 프롬프트를 손봐야 한다 */
      if (/safety|moderation|policy|rejected|not allowed/i.test(msg)) throw new Error(`SAFETY: ${msg}`);
    }

    if (res.status === 429 || res.status >= 500) {
      const retryAfter = Number(res.headers.get('retry-after'));
      const wait = Number.isFinite(retryAfter) && retryAfter > 0 ? retryAfter * 1000 : 3000 * 2 ** (attempt - 1);
      if (attempt === MAX) throw new Error(`${res.status} ${msg}`);
      console.warn(`  · ${id} ${res.status} — ${Math.round(wait / 1000)}초 후 재시도 (${attempt}/${MAX})`);
      await sleep(wait);
      continue;
    }

    throw new Error(`${res.status} ${msg}`);
  }
}

/* ── manifest: 폴더에 실제로 있는 그림만 등록 ─────────────── */
function writeManifest() {
  const cards = {};
  for (const id of Object.keys(items)) if (fs.existsSync(outFile(id))) cards[id] = `${id}.webp`;
  fs.mkdirSync(OUT_DIR, { recursive: true });
  fs.writeFileSync(MANIFEST, JSON.stringify({ cards }, null, 2) + '\n');
}

/* ── 실행 ─────────────────────────────────────────────────── */
console.log(`모델 ${model} / quality=${OPTS.quality} / 동시 ${OPTS.concurrency}` + (WILL_SHRINK ? ` / cwebp ${OPTS.maxWidth}px` : ''));
console.log(`생성 대상 ${targets.length}개${OPTS.force ? ' (--force)' : ' (기존 파일은 건너뜀)'}\n`);

const failed = [];
let done = 0;
const queue = [...targets];

async function worker() {
  while (queue.length) {
    const id = queue.shift();
    try {
      const file = await generate(id);
      done++;
      writeManifest();
      const kb = Math.round(fs.statSync(file).size / 1024);
      console.log(`✔ [${String(done).padStart(2)}/${targets.length}] ${id.padEnd(6)} → ${path.relative(ROOT, file)} (${kb} KB)`);
    } catch (err) {
      failed.push({ id, reason: String(err.message || err) });
      console.error(`✘ ${id} — ${err.message || err}`);
    }
  }
}

await Promise.all(Array.from({ length: Math.min(OPTS.concurrency, targets.length) }, worker));
writeManifest();

console.log(`\n완료 ${done}개, 실패 ${failed.length}개.`);
if (failed.length) {
  for (const f of failed) console.log(`  ${f.id}: ${f.reason}`);
  if (failed.some((f) => f.reason.startsWith('SAFETY'))) {
    console.log('\n안전 필터에 걸린 항목은 data/card-prompts.json 의 해당 프롬프트를 고친 뒤 --only 로 다시 돌리세요.');
  }
  process.exitCode = 1;
}
