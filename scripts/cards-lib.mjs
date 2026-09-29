// Shared helpers for the card-art scripts: which images exist, what size each kind is,
// and the manifest the game reads (assets/cards/manifest.json).

import fs from 'node:fs';
import path from 'node:path';
import { fileURLToPath } from 'node:url';

export const ROOT = path.resolve(path.dirname(fileURLToPath(import.meta.url)), '..');
export const PROMPTS_FILE = path.join(ROOT, 'data/card-prompts.json');
export const OUT_DIR = path.join(ROOT, 'assets/cards');
export const MANIFEST = path.join(OUT_DIR, 'manifest.json');
export const IMAGE_EXTS = ['.webp', '.png', '.jpg', '.jpeg'];

export const SUIT = { S: '♠', H: '♥', D: '♦', C: '♣' };

/* Image kinds. `size` is what to generate (API size / ChatGPT aspect ratio);
   `maxWidth` is what the game actually needs, so uploads are shrunk to it. */
export const KINDS = {
  title: { label: '제목 로고', ratio: '가로 3:2', size: '1536x1024', maxWidth: 1000 },
  court: { label: '그림 카드 (A·J·Q·K)', ratio: '세로 2:3', size: '1024x1536', maxWidth: 640 },
  back: { label: '카드 뒷면', ratio: '세로 2:3', size: '1024x1536', maxWidth: 640 },
  dealer: { label: '딜러 표정', ratio: '정사각형 1:1', size: '1024x1024', maxWidth: 384 },
  face: { label: '무늬 속 얼굴', ratio: '정사각형 1:1', size: '1024x1024', maxWidth: 320 },
};

export function kindOf(id) {
  if (id === 'TITLE') return 'title';
  if (id === 'BACK') return 'back';
  if (id === 'FACE') return 'face';
  if (id.startsWith('DEALER_')) return 'dealer';
  if (/^[AJQK][SHDC]$/.test(id)) return 'court';
  return null;
}

export function loadPrompts() {
  const { style = {}, items = {} } = JSON.parse(fs.readFileSync(PROMPTS_FILE, 'utf8'));
  return { style, items };
}

/* The image file for an ID, whatever its extension (case-insensitive name). */
export function findImage(id) {
  if (!fs.existsSync(OUT_DIR)) return null;
  const want = id.toLowerCase();
  const hit = fs
    .readdirSync(OUT_DIR)
    .find((f) => IMAGE_EXTS.includes(path.extname(f).toLowerCase()) && path.basename(f, path.extname(f)).toLowerCase() === want);
  return hit ?? null;
}

/* Rewrite the manifest from what's actually in assets/cards/. */
export function writeManifest(ids) {
  const cards = {};
  for (const id of ids) {
    const file = findImage(id);
    if (file) cards[id] = file;
  }
  fs.mkdirSync(OUT_DIR, { recursive: true });
  fs.writeFileSync(MANIFEST, JSON.stringify({ cards }, null, 2) + '\n');
  return cards;
}

/* The full prompt for an ID: item prompt + shared style + closing rule. */
export function buildPrompt({ style, items }, id) {
  const item = items[id];
  const tail =
    item.type === 'court'
      ? (style.court || '').replaceAll('{rank}', id[0]).replaceAll('{suit}', SUIT[id[1]] ?? '')
      : item.noText === false ? '' : style.noText; // noText:false → 글자를 그려야 하는 항목(TITLE)
  const base = item.useStyle === false ? '' : style.base; // useStyle:false → 카드 화풍(카드지·테두리) 빼기
  return [item.prompt, base, tail].filter(Boolean).join('. ').replace(/\.\.+/g, '.');
}
