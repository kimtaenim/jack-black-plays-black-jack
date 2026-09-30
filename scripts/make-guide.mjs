#!/usr/bin/env node
// Writes docs/IMAGE-GUIDE.md from data/card-prompts.json: every image grouped by kind with its
// size/ratio, file name and the full prompt to paste into ChatGPT. Re-run after editing prompts:
//   npm run guide

import fs from 'node:fs';
import path from 'node:path';
import { ROOT, KINDS, kindOf, loadPrompts, buildPrompt } from './cards-lib.mjs';

const prompts = loadPrompts();
const ids = Object.keys(prompts.items);

const SUIT_KO = { S: '스페이드', H: '하트', D: '다이아몬드', C: '클로버' };
const RANK_KO = { A: '에이스', J: '잭', Q: '퀸', K: '킹' };
const MOOD_KO = {
  IDLE: '대기 — 느긋한 미소',
  DEAL: '카드 돌릴 때 — 윙크',
  SHOCK: '내가 블랙잭 — 깜짝 놀람',
  SAD: '내가 이김 — 울상',
  LAUGH: '내가 버스트 — 폭소',
  SMUG: '딜러가 이김 — 비웃음',
  SHRUG: '무승부 — 어깨 으쓱',
};
const USE = {
  title: '화면 맨 위 제목 자리 (가운데 부분만 보임)',
  court: '그림 카드 한 장 전체 (모서리 숫자·무늬까지 그림에 포함)',
  back: '뒤집힌 카드',
  dealer: '제목 옆 네모난 딜러 초상 (정사각형 그대로 전부 보임)',
  face: '숫자 카드의 무늬 한두 개 안에 작게',
};

function nameOf(id) {
  const kind = kindOf(id);
  if (kind === 'court') return `${SUIT_KO[id[1]]} ${RANK_KO[id[0]]}`;
  if (kind === 'dealer') return `딜러 ${MOOD_KO[id.slice(7)] ?? id.slice(7)}`;
  return KINDS[kind]?.label ?? id;
}

const order = ['title', 'court', 'back', 'dealer', 'face'];
const byKind = Object.fromEntries(order.map((k) => [k, ids.filter((id) => kindOf(id) === k)]));

let md = `# 이미지 가이드 (ChatGPT로 직접 만들기)

> 이 문서는 \`npm run guide\` 로 [\`data/card-prompts.json\`](../data/card-prompts.json) 에서 자동으로 만들어집니다. 프롬프트를 고칠 땐 JSON 을 고치고 다시 돌리세요.

## 한눈에 보기

| 유형 | 비율 (ChatGPT 에서 고를 것) | 크기 | 개수 | 파일 이름 | 쓰이는 곳 |
| --- | --- | --- | --- | --- | --- |
${order
  .map((k) => {
    const list = byKind[k];
    const names = list.length > 3 ? `\`${list[0]}\` … \`${list.at(-1)}\`` : list.map((id) => `\`${id}\``).join(', ');
    return `| ${KINDS[k].label} | **${KINDS[k].ratio}** | ${KINDS[k].size} | ${list.length} | ${names} | ${USE[k]} |`;
  })
  .join('\n')}

모두 합쳐 ${ids.length}장. 하나도 없어도 게임은 기본 그림으로 돌아가니 만든 것부터 하나씩 올리면 됩니다.

## 만드는 법

1. 아래에서 원하는 그림의 프롬프트를 복사해 ChatGPT 에 붙여넣습니다 (코드 칸 오른쪽 위 복사 버튼).
2. 비율이 위 표와 맞는지 확인하고, 마음에 들면 이미지를 저장합니다.
3. 파일 이름을 **ID 그대로** 바꿉니다. 예: \`QS.png\`, \`DEALER_LAUGH.png\`, \`TITLE.png\` (대소문자 무관, png·jpg·webp 모두 됨)
4. GitHub 저장소 → \`assets/cards\` 폴더 → **Add file → Upload files** 로 올리고 Commit.
5. 몇 분 뒤 자동으로 폰에 맞는 크기의 webp 로 줄여지고(\`card-import\` 워크플로), 사이트에 반영됩니다.
   같은 이름으로 다시 올리면 새 그림으로 바뀝니다.

`;

for (const k of order) {
  const kind = KINDS[k];
  md += `## ${kind.label} — ${kind.ratio} (${kind.size})\n\n${USE[k]}. 게임에서는 최대 폭 ${kind.maxWidth}px 로 줄여서 씁니다.\n\n`;
  for (const id of byKind[k]) {
    md += `### \`${id}\` · ${nameOf(id)}\n\n\`\`\`text\n${buildPrompt(prompts, id)}\n\`\`\`\n\n`;
  }
}

const out = path.join(ROOT, 'docs/IMAGE-GUIDE.md');
fs.mkdirSync(path.dirname(out), { recursive: true });
fs.writeFileSync(out, md);
console.log(`wrote ${path.relative(ROOT, out)} (${ids.length} images)`);
