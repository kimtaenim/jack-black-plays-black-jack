#!/usr/bin/env node
/**
 * 올린 그림 정리기 — ChatGPT 등에서 직접 만든 그림을 게임에 넣는다.
 *
 *   node scripts/import-cards.mjs
 *
 * assets/cards/ 에 ID 이름으로 올린 png / jpg / webp (예: QS.png, dealer_laugh.jpg, TITLE.png)를 찾아서
 *   1. cwebp 가 있으면 유형별로 게임에 필요한 크기로 줄인 webp (<ID>.webp) 로 바꾸고 원본은 지운다
 *   2. assets/cards/manifest.json 을 다시 쓴다 (게임은 이 목록에 있는 그림만 쓴다)
 * 같은 ID 에 새로 올린 png/jpg 와 기존 webp 가 같이 있으면 새로 올린 쪽으로 바꾼다.
 * GitHub 에서 assets/cards 에 파일을 올리면 card-import 워크플로가 이걸 자동으로 돌린다.
 *
 * 옵션
 *   --dry-run   바꾸지 않고 무엇을 할지만 출력
 */

import fs from 'node:fs';
import path from 'node:path';
import { spawnSync } from 'node:child_process';
import { OUT_DIR, IMAGE_EXTS, KINDS, kindOf, loadPrompts, writeManifest } from './cards-lib.mjs';

const dryRun = process.argv.includes('--dry-run');
const { items } = loadPrompts();
const ids = Object.keys(items);
const byLower = new Map(ids.map((id) => [id.toLowerCase(), id]));

const HAS_CWEBP = spawnSync('cwebp', ['-version'], { stdio: 'ignore' }).status === 0;
if (!HAS_CWEBP) console.warn('! cwebp 가 없어 크기 줄이기·webp 변환은 건너뜁니다 (manifest 만 갱신).');

const files = fs.existsSync(OUT_DIR) ? fs.readdirSync(OUT_DIR) : [];
const unknown = [];
const groups = new Map(); // ID -> [file, ...]
for (const f of files) {
  const ext = path.extname(f).toLowerCase();
  if (!IMAGE_EXTS.includes(ext)) continue;
  const id = byLower.get(path.basename(f, path.extname(f)).toLowerCase());
  if (!id) {
    unknown.push(f);
    continue;
  }
  if (!groups.has(id)) groups.set(id, []);
  groups.get(id).push(f);
}

let changed = 0;
for (const [id, list] of groups) {
  // a freshly uploaded png/jpg wins over an older webp of the same card
  const upload = list.find((f) => path.extname(f).toLowerCase() !== '.webp');
  const src = upload ?? list[0];
  const target = `${id}.webp`;
  const maxWidth = KINDS[kindOf(id)]?.maxWidth ?? 640;
  const needs = upload || src !== target || width(src) > maxWidth;
  if (!needs || !HAS_CWEBP) {
    // keep as is, but drop duplicates so the manifest points at one file
    if (upload && !HAS_CWEBP) for (const f of list) if (f !== upload) remove(f);
    continue;
  }
  console.log(`- ${src} → ${target} (최대 폭 ${maxWidth}px)`);
  if (dryRun) continue;
  const tmp = path.join(OUT_DIR, `.${id}.tmp.webp`);
  const r = spawnSync(
    'cwebp',
    ['-quiet', '-q', '82', '-resize', String(Math.min(maxWidth, width(src) || maxWidth)), '0', '-metadata', 'none', path.join(OUT_DIR, src), '-o', tmp],
    { stdio: 'inherit' },
  );
  if (r.status !== 0 || !fs.existsSync(tmp)) {
    console.error(`  ✘ ${src} 변환 실패 — 그대로 둡니다.`);
    continue;
  }
  for (const f of list) remove(f);
  fs.renameSync(tmp, path.join(OUT_DIR, target));
  changed++;
}

if (unknown.length) {
  console.warn(`\n! 이름이 ID 와 안 맞아 무시한 파일: ${unknown.join(', ')}`);
  console.warn(`  쓸 수 있는 이름: ${ids.join(', ')} (대소문자 무관, 확장자 png/jpg/webp)`);
}

if (!dryRun) {
  const cards = writeManifest(ids);
  const missing = ids.filter((id) => !cards[id]);
  console.log(`\n변환 ${changed}개. 게임에 들어간 그림 ${Object.keys(cards).length}/${ids.length}개.`);
  if (missing.length) console.log(`아직 없는 그림: ${missing.join(', ')}`);
}

function remove(f) {
  if (!dryRun) fs.rmSync(path.join(OUT_DIR, f), { force: true });
}

// image width from the file header (png / jpeg / webp), 0 if unknown
function width(f) {
  const b = fs.readFileSync(path.join(OUT_DIR, f));
  if (b.subarray(1, 4).toString() === 'PNG') return b.readUInt32BE(16);
  if (b[0] === 0xff && b[1] === 0xd8) {
    for (let i = 2; i + 9 < b.length; ) {
      if (b[i] !== 0xff) break;
      const marker = b[i + 1];
      const len = b.readUInt16BE(i + 2);
      if (marker >= 0xc0 && marker <= 0xcf && ![0xc4, 0xc8, 0xcc].includes(marker)) return b.readUInt16BE(i + 7);
      i += 2 + len;
    }
    return 0;
  }
  if (b.subarray(0, 4).toString() === 'RIFF' && b.subarray(8, 12).toString() === 'WEBP') {
    const chunk = b.subarray(12, 16).toString();
    if (chunk === 'VP8X') return 1 + b.readUIntLE(24, 3);
    if (chunk === 'VP8L') return 1 + (b.readUInt16LE(21) & 0x3fff);
    if (chunk === 'VP8 ') return b.readUInt16LE(26) & 0x3fff;
  }
  return 0;
}
