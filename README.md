# 🎸 Jack Black plays Black Jack

"Jack Black"과 "Blackjack"의 말장난에서 시작한, 브라우저에서 바로 즐기는 **비상업적 학습용 팬 패러디 블랙잭 게임**입니다.
그림 카드(J·Q·K)와 카드 뒷면은 OpenAI 이미지 API로 생성한 록스타 캐리커처로 꾸밉니다.

> ⚠️ **면책 조항**: 학습용 프로젝트이며 상업적 이용이 아닙니다. Jack Black 본인·관계사와 무관하고 승인·후원을 받지 않았으며,
> 사칭·명예훼손·조롱 의도가 없습니다. 실제 돈이 오가지 않습니다. 전문은 [DISCLAIMER.md](DISCLAIMER.md)를 보세요.

## ▶️ 플레이

- GitHub Pages: **https://kimtaenim.github.io/jack-black-plays-black-jack/** (Pages 활성화 후)
- 로컬 실행 (Node 18+):

  ```bash
  npm start          # http://localhost:3000
  # 또는
  python3 -m http.server 8000
  ```

  ES 모듈을 쓰므로 `index.html`을 파일로 직접 열지 말고 로컬 서버로 여세요.

조작: 칩으로 베팅 → **Deal** (Enter) → **Hit** (H) / **Stand** (S) / **Double** (D) / **Split** (P).
칩은 브라우저에 저장되며, 다 잃으면 1000칩으로 다시 시작합니다.

## 🃏 블랙잭 엔진 (`src/engine.js`)

DOM에 의존하지 않는 순수 JS 모듈이라 브라우저와 Node 양쪽에서 동작합니다.

| 규칙 | 기본값 |
| --- | --- |
| 덱 수 | 6덱 슈, 75% 소진 시 재셔플 |
| 딜러 | Soft 17에서 스탠드 (`dealerHitsSoft17: true`로 변경 가능) |
| 블랙잭 배당 | 3:2 |
| 더블다운 | 아무 두 장에서 가능, 스플릿 후 더블 허용 |
| 스플릿 | 최대 4핸드, 에이스 스플릿은 한 장씩만 받음, 스플릿 후 21은 블랙잭 아님 |
| 기타 | 인슈어런스·서렌더 없음 |

```js
import { BlackjackGame } from './src/engine.js';

const game = new BlackjackGame({ bankroll: 1000, rules: { decks: 2 } });
game.deal(50);
game.actions();   // { hit, stand, double, split }
game.hit();       // 또는 stand(), double(), split()
game.results;     // [{ outcome: 'win' | 'blackjack' | 'push' | 'lose' | 'bust', net, ... }]
```

테스트: `npm test` (Node 내장 테스트 러너, 의존성 없음)

## 🎨 카드 이미지 만들기 (OpenAI API)

`scripts/generate-cards.mjs`가 OpenAI Images API(`gpt-image-1`)로 J·Q·K × 4수트(12장) + 카드 뒷면(1장)을 생성해
`assets/cards/*.webp`와 `assets/cards/manifest.json`에 저장합니다. 게임은 manifest에 있는 이미지만 쓰고,
없는 카드는 내장 이모지 그림으로 대체되므로 **이미지 없이도 게임은 동작**합니다.

디자인은 빈티지 궁정 카드 스타일입니다(붉은 커튼·금박 타이틀·금테 펠트 테이블, 아이보리 카드와 금색 프레임).
그림 카드는 **정사각형 상반신 그림 한 장**을 생성하고, 게임이 이를 위아래로 뒤집어 붙여 실제 카드처럼
**양방향(double-ended)** 으로 보여줍니다. 숫자·무늬 인덱스도 게임이 직접 그리므로 이미지에는 글자를 넣지 않습니다.

```bash
cp .env.example .env        # OPENAI_API_KEY 입력 (.env는 git에 올라가지 않음)
node scripts/generate-cards.mjs --dry-run      # 프롬프트만 확인 (API 호출 없음)
node scripts/generate-cards.mjs --only KS      # 한 장만 먼저 테스트
node scripts/generate-cards.mjs                # 전체 13장 (이미 있는 파일은 건너뜀)
node scripts/generate-cards.mjs --force        # 전부 다시 생성
```

옵션: `--quality low|medium|high`, `--model <모델명>`, `--subject "<그릴 대상 설명>"`.
생성 후 `assets/cards/`를 커밋·푸시하면 GitHub Pages에 반영됩니다.

**주의사항**

- 🔑 **API 키는 절대 커밋하거나 프론트엔드 코드에 넣지 마세요.** 이미지는 로컬에서 한 번 생성해 정적 파일로 배포하므로,
  게임을 하는 사람은 키가 필요 없습니다.
- 💰 이미지 생성은 유료입니다. 먼저 `--only`로 한두 장 테스트해 결과와 비용을 확인하세요.
- 🚫 OpenAI 콘텐츠 정책상 **실존 인물의 모습을 그리는 요청은 거부될 수 있습니다.** 거부된 카드는 실패로 표시되고
  게임에서는 기본 그림으로 대체됩니다. 이 경우 `--subject`로 "장발의 열정적인 록 코미디언 캐릭터"처럼
  **특정 인물이 아닌 오리지널 캐릭터**로 바꾸는 것을 권장합니다. 정책을 우회하려는 시도는 하지 마세요.
- 생성된 이미지는 비상업적 학습 목적으로만 공개합니다 ([DISCLAIMER.md](DISCLAIMER.md)).

## 🚀 GitHub Pages로 공개하기

1. 이 브랜치를 `main`에 머지합니다.
2. 저장소 **Settings → Pages → Build and deployment → Source**를 **GitHub Actions**로 설정합니다.
3. `main`에 푸시될 때마다 `.github/workflows/pages.yml`이 테스트를 돌리고 사이트를 배포합니다.

## 📁 구조

```
index.html               게임 화면 + 면책 조항 모달
style.css                스타일 (모바일 대응)
src/engine.js            블랙잭 엔진 (순수 로직)
src/main.js              UI ↔ 엔진 연결
scripts/generate-cards.mjs  OpenAI 카드 이미지 생성 스크립트
assets/cards/            생성된 카드 이미지 + manifest.json
tests/engine.test.js     엔진 테스트
```

## 라이선스

코드는 [MIT](LICENSE). 단, 이 라이선스는 Jack Black 또는 제3자의 이름·초상·상표에 대한 어떤 권리도 부여하지 않습니다.
