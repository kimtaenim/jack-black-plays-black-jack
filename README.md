# 🎸 Jack Black plays Black Jack

검은 양복을 입은 **딜러 잭 블랙**과 마주 앉아 블랙잭을 하는 브라우저 게임입니다.
화면 위 가로 배너에서 딜러 잭이 상황마다 영화 명대사를 영어·한국어로 던지고
(스쿨 오브 락, 쿵푸팬더, 나쵸 리브레, 마인크래프트 무비…), 숫자 카드마다 ♠♥♦♣ 무늬 한두 개에 잭의 얼굴이 숨어 있습니다.
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

**게임 시작** → 가운데 박스 **"한 장 더 받을까?" YES / NO** (같은 숫자 두 장이면 **SPLIT**) → 결과와 점수판, **한 판 더!**
칩이나 베팅은 없고 **블랙잭 승 · 승 · 패** 횟수만 기록됩니다(무승부는 세지 않음).
점수는 브라우저에 저장되며, 오른쪽 위 ⓘ에서 초기화할 수 있습니다.

화면 구성: 위쪽은 한 줄 제목과 작은 딜러 배너만 두고, 나머지를 테이블에 씁니다.
딜러 카드는 작게, 내 카드는 남는 공간만큼 크게 보이며, 카드는 세로로 세워 두고 3~4장이 되면 자동으로 겹칩니다.
카드 비율이 2:3이라 생성한 1024x1536 카드 이미지가 잘리지 않고 그대로 들어갑니다.

## 🃏 블랙잭 엔진 (`src/engine.js`)

DOM에 의존하지 않는 순수 JS 모듈이라 브라우저와 Node 양쪽에서 동작합니다.

| 규칙 | 기본값 |
| --- | --- |
| 덱 수 | 6덱 슈, 75% 소진 시 재셔플 |
| 딜러 | Soft 17에서 스탠드 (`dealerHitsSoft17: true`로 변경 가능) |
| 스플릿 | 최대 4핸드, 에이스 스플릿은 한 장씩만 받음, 스플릿 후 21은 블랙잭 아님 |
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

## 🎨 그림 만들기 (OpenAI API)

게임에는 직접 그린 기본 캐릭터 그림(`assets/face.svg`, `assets/dealer.svg`)이 들어 있어서 **API 키 없이도 바로 플레이**할 수 있습니다.
OpenAI 이미지 API로 그림을 만들면 자동으로 그 그림으로 바뀝니다.
프롬프트는 전부 [`data/card-prompts.json`](data/card-prompts.json)에 있으니 거기서 고치면 됩니다.

| ID | 용도 | 크기 |
| --- | --- | --- |
| `JS` … `KC` | J·Q·K 12장. 모서리 표시까지 들어간 **카드 한 장 전체** | 1024x1536 |
| `DEALER` | 딜러 배너 왼쪽 초상 (검은 양복) | 1024x1024 |
| `FACE` | 숫자 카드 무늬 한두 개에 들어가는 얼굴 | 1024x1024 |
| `BACK` | 카드 뒷면 | 1024x1536 |

**방법 1 — GitHub Actions (추천)**

1. **Settings → Secrets and variables → Actions → New repository secret**: `OPENAI_API_KEY`
2. **Actions → card-images → Run workflow** (특정 카드만: `only`에 `QS,KH` 처럼 입력)
3. 생성된 그림이 자동으로 커밋되고, `main`이면 Pages 배포까지 이어서 돕니다.

**방법 2 — 로컬**

```bash
cp .env.example .env                                  # OPENAI_API_KEY 입력 (.env는 git에 올라가지 않음)
node scripts/generate-cards.mjs --dry-run             # 프롬프트만 확인 (API 호출 없음)
node scripts/generate-cards.mjs --only QS,KH          # 먼저 두 장만
node scripts/generate-cards.mjs                       # 아직 없는 것 전부 (최대 15장)
node scripts/generate-cards.mjs --list-missing        # 아직 없는 ID 목록
```

옵션: `--model` (기본 `gpt-image-2`, 없으면 `gpt-image-1`로 자동 대체), `--quality low|medium|high` (기본 medium),
`--force`, `--concurrency`, `--max-width` (cwebp가 있으면 저장 전에 축소, 기본 640px).

- 🔑 API 키는 절대 커밋하거나 프론트엔드 코드에 넣지 마세요. 플레이어에게는 키가 필요 없습니다.
- 💰 이미지 생성은 유료입니다. `--only`로 한두 장 먼저 확인하세요.
- 🚫 안전 필터에 걸린 항목은 `SAFETY`로 표시됩니다. 해당 프롬프트를 고친 뒤 `--only`로 다시 돌리세요.

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
src/quotes.js               딜러 명대사 (영어·한국어·출처)
data/card-prompts.json      그림 생성 프롬프트
scripts/generate-cards.mjs  OpenAI 그림 생성 스크립트
.github/workflows/          Pages 배포, 그림 생성(card-images)
assets/face.svg, dealer.svg 기본 캐릭터 그림
assets/cards/               생성된 그림 + manifest.json
tests/engine.test.js        엔진 테스트
```

## 라이선스

코드는 [MIT](LICENSE). 이 라이선스는 Jack Black 또는 제3자의 이름·초상·상표에 대한 어떠한 권리도 부여하지 않습니다.
