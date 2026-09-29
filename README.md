# 🎸 Jack Black plays Black Jack

검은 연미복을 입은 **잭 블랙 캐리커처 딜러**와 마주 앉아 블랙잭을 하는 브라우저 게임입니다.
화면 위 배너 왼쪽에서 딜러가 상황마다 표정을 바꾸고(윙크, 폭소, 울상, 깜짝 놀람…), 오른쪽에는 점수와 승률이 표시됩니다.
숫자 카드마다 ♠♥♦♣ 무늬 한두 개에 잭의 얼굴이 숨어 있습니다.
J·Q·K는 잭 블랙이 왕·여왕·잭이 된 궁정 카드입니다. 휴대폰에 맞춰 만들었고, 화면 아래 버튼만 탭하면 됩니다.

## ⚠️ Disclaimer (면책 조항)

This is a non-commercial, fan-made parody project created strictly for educational and portfolio purposes.
I do not own any rights to the name or likeness of Jack Black. No copyright infringement is intended.

(본 프로젝트는 교육 및 포트폴리오 목적으로 제작된 비상업적 팬메이드 패러디입니다.
Jack Black의 이름 및 초상에 대한 어떠한 권리도 소유하지 않으며, 저작권 침해 의도가 없습니다.)

전문: [DISCLAIMER.md](DISCLAIMER.md)

## ▶️ 플레이

- GitHub Pages: **https://kimtaenim.github.io/jack-black-plays-black-jack/** (Pages 활성화 후)
- 로컬 실행: `npm start` (http://localhost:3000) 또는 `python3 -m http.server 8000`
  (ES 모듈을 쓰므로 `index.html`을 파일로 직접 열지 말고 로컬 서버로 여세요.)

**게임 시작** → 카드 위에 뜨는 박스 **"한 장 더 받을까?" YES / NO** → 결과와 **한 판 더!** (스플릿 없음)
칩이나 베팅은 없고 **블랙잭 승 · 승 · 패** 횟수만 기록됩니다(무승부는 세지 않음).
점수는 화면 위 배너에 항상 보이고 브라우저에 저장되며, 맨 아래 ⓘ Disclaimer 창에서 초기화할 수 있습니다.

화면 구성: 위쪽은 한 줄 제목과 작은 딜러 배너만 두고, 나머지를 테이블에 씁니다.
딜러 카드는 작게, 내 카드는 남는 공간만큼 크게 보이며, 카드는 세로로 세워 두고 3~4장이 되면 자동으로 겹칩니다.
카드 비율이 2:3이라 생성한 1024x1536 카드 이미지가 잘리지 않고 그대로 들어갑니다.

## 🃏 블랙잭 엔진 (`src/engine.js`)

DOM에 의존하지 않는 순수 JS 모듈이라 브라우저와 Node 양쪽에서 동작합니다.

| 규칙 | 기본값 |
| --- | --- |
| 덱 수 | 6덱 슈, 75% 소진 시 재셔플 |
| 딜러 | Soft 17에서 스탠드 (`dealerHitsSoft17: true`로 변경 가능) |
| 스플릿 | 엔진은 지원하지만 게임 화면에서는 끔 (`maxHands: 1`) |
| 기타 | 엔진은 3:2 배당·더블다운도 지원하지만, 게임 화면은 점수제라 쓰지 않음 |

```js
import { BlackjackGame } from './src/engine.js';

const game = new BlackjackGame();
game.deal(1);
game.actions();   // { hit, stand, double, split }
game.hit();       // 또는 stand(), split()
game.results;     // [{ outcome: 'win' | 'blackjack' | 'push' | 'lose' | 'bust', ... }]
```

테스트: `npm test` (Node 내장 테스트 러너, 의존성 없음)

## 🎨 그림 만들기 · How the artwork was made

이 게임의 그림 26장(제목, 카드 뒷면, 딜러 표정 7장, A·J·Q·K 16장, 무늬 속 얼굴)은 **전부 ChatGPT 채팅창에서 직접 만들었습니다** (아래 방법 0).
저장소에는 OpenAI 이미지 API로 자동 생성하는 스크립트(방법 1·2)도 있지만, **실제로는 쓰지 않았습니다.**

All 26 images in this game (title, card back, 7 dealer expressions, 16 aces and court cards, and the pip face) were **made by hand in the ChatGPT chat app** (method 0 below).
The repository also contains scripts that generate them automatically through the OpenAI Images API (methods 1 and 2), but **they were not used.**

> **왜 API를 안 썼나 · Why not the API?**
> ChatGPT 채팅과 OpenAI 이미지 API는 같은 모델이라도 **실존 인물에 대한 안전 필터가 다르게 적용됩니다.**
> 채팅에서는 "잭 블랙 캐리커처"가 잘 그려졌지만, API는 살아 있는 실존 인물의 이름이 들어간 요청을 거절하는 경우가 많습니다.
> 그래서 채팅에서 만든 그림을 올리면 게임에 자동으로 들어가도록 파이프라인을 만들었습니다.
>
> The ChatGPT chat app and the OpenAI Images API apply **different safety filters for real people**, even when the underlying model is the same.
> A "Jack Black caricature" prompt worked in the chat app, but the API tends to reject requests that name a living person.
> So the pipeline here takes images made in the chat and drops them into the game automatically.

게임에는 직접 그린 기본 그림(`assets/face.svg`, `assets/dealer.svg`)도 있어서, 그림이 하나도 없어도 플레이할 수 있습니다.
The game also ships with built-in fallback art (`assets/face.svg`, `assets/dealer.svg`), so it is playable even with no images at all.

| ID | 용도 · Use | 비율 · Ratio |
| --- | --- | --- |
| `TITLE` | 맨 위 제목 로고 · title logo | 가로 3:2 · landscape 3:2 |
| `BACK` | 카드 뒷면 · card back | 세로 2:3 · portrait 2:3 |
| `AS` … `KC` | 에이스·그림 카드 16장, 모서리 표시까지 포함한 카드 한 장 전체 · 16 aces and court cards, full card with corner indices | 세로 2:3 · portrait 2:3 |
| `DEALER_IDLE` … `DEALER_SHRUG` | 딜러 표정 7가지 (검은 연미복) · 7 dealer expressions (black tailcoat) | 정사각형 1:1 · square 1:1 |
| `FACE` | 숫자 카드 무늬 한두 개 속 얼굴 · face inside one or two pips of each number card | 정사각형 1:1 · square 1:1 |

딜러 표정 · Dealer expressions: `IDLE` 대기 waiting · `DEAL` 카드 돌릴 때 dealing (wink) · `SHOCK` 내가 블랙잭 player blackjack ·
`SAD` 내가 승리 player wins · `LAUGH` 딜러 승리 dealer wins · `SMUG` 내가 버스트 player busts · `SHRUG` 무승부 push.

### 방법 0 — ChatGPT 에서 직접 만들어 올리기 (사용한 방법) · Method 0 — make it in ChatGPT and upload (used)

**[docs/IMAGE-GUIDE.md](docs/IMAGE-GUIDE.md)** 에 유형별 비율·크기, 파일 이름, 복사해서 쓰는 프롬프트가 전부 정리돼 있습니다.
**[docs/IMAGE-GUIDE.md](docs/IMAGE-GUIDE.md)** lists every image with its ratio, size, file name and a prompt ready to copy.

1. 가이드의 프롬프트를 ChatGPT 에 붙여넣고, 표의 비율로 만든다 · Paste the prompt into ChatGPT and generate at the ratio in the table.
2. 파일 이름을 ID 로 바꾼다 (`QS.png`, `DEALER_LAUGH.png`, `TITLE.png` …) · Rename the file to its ID.
3. GitHub 에서 `assets/cards` → **Add file → Upload files** · Upload it to `assets/cards` on GitHub.
4. `card-import` 워크플로가 크기를 줄인 webp 로 바꾸고 목록을 갱신 → 사이트에 반영 · The `card-import` workflow shrinks it to webp, updates the manifest and the site redeploys.

로컬에서는 `assets/cards/` 에 파일을 넣고 `npm run import:cards`. 프롬프트를 고친 뒤에는 `npm run guide` 로 가이드를 다시 만듭니다.
Locally: put the files in `assets/cards/` and run `npm run import:cards`. After editing prompts, run `npm run guide` to rebuild the guide.

### 방법 1·2 — OpenAI 이미지 API (사용 안 함) · Methods 1 & 2 — OpenAI Images API (not used)

실존 인물 필터 때문에 이 프로젝트에서는 쓰지 않았지만, 인물이 아닌 그림이나 다른 프로젝트에서 참고할 수 있도록 남겨 둡니다.
Not used here because of the real-person filter, but kept for reference (e.g. artwork without real people, or other projects).

**방법 1 — GitHub Actions · Method 1 — GitHub Actions**

1. **Settings → Secrets and variables → Actions → New repository secret**: `OPENAI_API_KEY`
2. **Actions → card-images → Run workflow** (`only`: `QS,KH` …)
3. 생성된 그림이 자동으로 커밋됩니다 · Generated images are committed automatically.

**방법 2 — 로컬 · Method 2 — local**

```bash
cp .env.example .env                                  # OPENAI_API_KEY (.env is git-ignored)
node scripts/generate-cards.mjs --dry-run             # print prompts only, no API calls
node scripts/generate-cards.mjs --only QS,KH          # try two first
node scripts/generate-cards.mjs                       # everything still missing
node scripts/generate-cards.mjs --list-missing        # list missing IDs
```

옵션 · Options: `--model` (default `gpt-image-2`, falls back to `gpt-image-1`), `--quality low|medium|high`, `--force`, `--concurrency`, `--max-width`.

- 🔑 API 키는 절대 커밋하지 마세요 · Never commit an API key. Players don't need one.
- 🚫 안전 필터에 걸리면 `SAFETY` 로 표시됩니다 · Requests blocked by the safety filter are reported as `SAFETY`.

## 🚀 GitHub Pages로 공개하기

1. 이 브랜치를 `main`에 머지합니다.
2. 저장소 **Settings → Pages → Build and deployment → Source**를 **GitHub Actions**로 설정합니다.
3. `main`에 푸시될 때마다 `.github/workflows/pages.yml`이 테스트를 돌리고 사이트를 배포합니다.

## 📁 구조

```
index.html                  게임 화면 (딜러 배너, 테이블, 점수판, 하단 버튼, 면책 조항)
style.css                   스타일 (모바일 우선)
src/engine.js               블랙잭 엔진 (순수 로직)
src/main.js                 UI ↔ 엔진 연결, 카드 렌더링
data/card-prompts.json      그림 생성 프롬프트
scripts/generate-cards.mjs  OpenAI 그림 생성 스크립트
scripts/import-cards.mjs    직접 올린 그림 정리 (webp 변환·축소, manifest 갱신)
scripts/make-guide.mjs      docs/IMAGE-GUIDE.md 생성
docs/IMAGE-GUIDE.md         ChatGPT 로 만들 때 쓰는 유형별 크기·파일 이름·프롬프트
.github/workflows/          Pages 배포, 그림 생성(card-images), 올린 그림 정리(card-import)
assets/face.svg, dealer.svg 기본 캐릭터 그림
assets/cards/               생성된 그림 + manifest.json
tests/engine.test.js        엔진 테스트
```

## 라이선스

코드는 [MIT](LICENSE). 이 라이선스는 Jack Black 또는 제3자의 이름·초상·상표에 대한 어떠한 권리도 부여하지 않습니다.
