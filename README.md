# 🎸 Jack Black plays Black Jack

검은 양복을 입은 **딜러 잭 블랙**과 테이블을 사이에 두고 마주 앉아 블랙잭을 하는 브라우저 게임입니다.
모든 카드의 ♠ ♥ ♦ ♣ 무늬 하나하나에 잭 블랙의 얼굴 일부가 작게 들어가고, J·Q·K는 잭 블랙이 왕이 된 궁정 카드입니다.
휴대폰에 맞춰 만들었고, 화면 아래 버튼만 탭하면 됩니다.

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

**딜 받기** → **히트 / 스탠드** (같은 숫자 두 장이면 **스플릿**) → **한 판 더!**
칩이나 베팅은 없고, 점수판에 **블랙잭 승 · 승 · 패** 횟수만 기록됩니다(무승부는 세지 않음).
점수는 브라우저에 저장되며 화면 맨 아래 "점수 초기화"로 지울 수 있습니다.

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
`scripts/generate-cards.mjs`로 OpenAI Images API(`gpt-image-1`) 그림을 만들면 자동으로 그 그림으로 바뀝니다.

| ID | 용도 |
| --- | --- |
| `FACE` | 모든 숫자 카드의 ♠♥♦♣ 무늬 안에 들어가는 얼굴 (무늬마다 다른 부위가 보이도록 잘라 씀) |
| `DEALER` | 테이블 건너편에 앉은 검은 양복 차림의 딜러 |
| `JS` … `KC` | J·Q·K 12장. 상반신 그림을 위아래로 뒤집어 붙여 양방향 궁정 카드로 표시 |
| `BACK` | 카드 뒷면 |

```bash
cp .env.example .env                           # OPENAI_API_KEY 입력 (.env는 git에 올라가지 않음)
node scripts/generate-cards.mjs --dry-run      # 프롬프트만 확인 (API 호출 없음)
node scripts/generate-cards.mjs --only FACE,DEALER   # 먼저 몇 장만 테스트
node scripts/generate-cards.mjs                # 전체 15장 (이미 있는 파일은 건너뜀)
node scripts/generate-cards.mjs --force        # 전부 다시 생성
```

옵션: `--quality low|medium|high`, `--model <모델명>`, `--subject "<그릴 대상 설명>"`.
생성된 `assets/cards/`를 커밋·푸시하면 GitHub Pages에 반영됩니다.

- 🔑 **API 키는 절대 커밋하거나 프론트엔드 코드에 넣지 마세요.** 그림은 로컬에서 한 번 만들어 정적 파일로 배포하므로 플레이어에게는 키가 필요 없습니다.
- 💰 이미지 생성은 유료입니다. `--only`로 한두 장 먼저 확인하세요.
- 🚫 OpenAI 콘텐츠 정책상 실존 인물을 그리는 요청은 거부될 수 있습니다. 거부된 그림은 기본 그림으로 대체되며,
  이 경우 `--subject`로 특정 인물이 아닌 오리지널 캐릭터 묘사로 바꾸는 것을 권장합니다.

## 🚀 GitHub Pages로 공개하기

1. 이 브랜치를 `main`에 머지합니다.
2. 저장소 **Settings → Pages → Build and deployment → Source**를 **GitHub Actions**로 설정합니다.
3. `main`에 푸시될 때마다 `.github/workflows/pages.yml`이 테스트를 돌리고 사이트를 배포합니다.

## 📁 구조

```
index.html                  게임 화면 (딜러석, 테이블, 점수판, 하단 버튼, 면책 조항)
style.css                   스타일 (모바일 우선)
src/engine.js               블랙잭 엔진 (순수 로직)
src/main.js                 UI ↔ 엔진 연결, 얼굴 무늬 카드 렌더링
scripts/generate-cards.mjs  OpenAI 그림 생성 스크립트
assets/face.svg, dealer.svg 기본 캐릭터 그림
assets/cards/               생성된 그림 + manifest.json
tests/engine.test.js        엔진 테스트
```

## 라이선스

코드는 [MIT](LICENSE). 이 라이선스는 Jack Black 또는 제3자의 이름·초상·상표에 대한 어떠한 권리도 부여하지 않습니다.
