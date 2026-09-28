import { BlackjackGame, PHASE, handValue } from './engine.js';

const SCORE_KEY = 'jbpbj.score.v1';
const DISCLAIMER_KEY = 'jbpbj.disclaimer.v2';

const SUIT_SYMBOL = { S: '♠', H: '♥', D: '♦', C: '♣' };
const FALLBACK_FACE = 'assets/face.svg';
const FALLBACK_DEALER = 'assets/dealer.svg';

const OUTCOME_TEXT = {
  blackjack: 'BLACKJACK!',
  win: 'WIN',
  push: 'PUSH',
  lose: 'LOSE',
  bust: 'BUST',
};

// Dealer banter (original parody lines, not real quotes).
const BANTER = {
  deal: ['자, 카드 나간다! 🎸', '록 스피릿을 믿어! 히트? 스탠드?', '내 눈썹을 봐. 떨리지?'],
  blackjack: ['🔥 블랙잭?! 이건 록의 신이 내려준 패다!', '🤘 21! 딜러인 나도 기타 솔로 칠 뻔했어!'],
  win: ['😱 네가 이겼어… 앰프 볼륨 11로 올려!', '🎸 좋아, 인정! 한 판 더?'],
  push: ['😐 무승부. 앙코르 한 판 더?', '🥁 비겼다. 드럼 롤은 다음 기회에.'],
  lose: ['😎 딜러 잭의 승리! ROCK ON!', '🤘 하우스는 언제나 로큰롤이지!'],
  bust: ['💥 버스트! 앰프가 터졌다!', '🙈 22 이상… 너무 세게 쳤어!'],
};
const pick = (lines) => lines[Math.floor(Math.random() * lines.length)];

// ---------- safe storage ----------
const store = {
  get(key) {
    try { return localStorage.getItem(key); } catch { return null; }
  },
  set(key, value) {
    try { localStorage.setItem(key, value); } catch { /* ignore */ }
  },
};

// ---------- artwork (generated images if present, else built-in SVG) ----------
let art = {};
async function loadArt() {
  try {
    const res = await fetch('assets/cards/manifest.json', { cache: 'no-cache' });
    if (res.ok) art = (await res.json()).cards ?? {};
  } catch {
    art = {};
  }
}
const artUrl = (id) => (art[id] ? `assets/cards/${art[id]}` : null);

function applyArt() {
  document.documentElement.style.setProperty('--face', `url("${artUrl('FACE') ?? FALLBACK_FACE}")`);
  els.dealerImg.src = artUrl('DEALER') ?? FALLBACK_DEALER;
}

// ---------- DOM ----------
const $ = (id) => document.getElementById(id);
const els = {
  banner: $('banner'),
  dealerImg: $('dealer-img'),
  dealerHand: $('dealer-hand'),
  dealerTotal: $('dealer-total'),
  playerHands: $('player-hands'),
  deal: $('deal'),
  hit: $('hit'),
  stand: $('stand'),
  split: $('split'),
  scoreBj: $('score-bj'),
  scoreWin: $('score-win'),
  scoreLose: $('score-lose'),
  disclaimer: $('disclaimer'),
};

// Classic pip positions [x%, y%] inside the card; pips below the middle are flipped.
const PIPS = {
  A: [[50, 50]],
  2: [[50, 16], [50, 84]],
  3: [[50, 16], [50, 50], [50, 84]],
  4: [[30, 16], [70, 16], [30, 84], [70, 84]],
  5: [[30, 16], [70, 16], [50, 50], [30, 84], [70, 84]],
  6: [[30, 16], [70, 16], [30, 50], [70, 50], [30, 84], [70, 84]],
  7: [[30, 16], [70, 16], [50, 33], [30, 50], [70, 50], [30, 84], [70, 84]],
  8: [[30, 16], [70, 16], [50, 33], [30, 50], [70, 50], [50, 67], [30, 84], [70, 84]],
  9: [[30, 16], [70, 16], [30, 39], [70, 39], [50, 50], [30, 61], [70, 61], [30, 84], [70, 84]],
  10: [[30, 16], [70, 16], [50, 27], [30, 39], [70, 39], [30, 61], [70, 61], [50, 73], [30, 84], [70, 84]],
};

// Each pip shows a different part of the face (eyes, brows, grin, beard…).
const FACE_CROPS = ['50% 42%', '30% 40%', '70% 40%', '50% 72%', '50% 58%', '38% 30%', '64% 30%', '50% 85%', '35% 62%', '65% 62%'];

// A suit-shaped window onto the face image.
function facePip(suit, cropIndex, { whole = false } = {}) {
  const pip = document.createElement('span');
  pip.className = `pip suit-${suit}`;
  const face = document.createElement('span');
  face.className = 'pip-face';
  if (whole) face.classList.add('whole');
  else face.style.backgroundPosition = FACE_CROPS[cropIndex % FACE_CROPS.length];
  pip.appendChild(face);
  return pip;
}

function cardEl(card, faceDown = false) {
  const div = document.createElement('div');
  div.className = 'card';

  if (faceDown) {
    div.classList.add('back');
    div.setAttribute('aria-label', 'face-down card');
    const url = artUrl('BACK');
    if (url) {
      div.classList.add('has-art');
      div.appendChild(imgEl(url, ''));
    } else {
      const medal = facePip('S', 0, { whole: true });
      medal.classList.add('medallion');
      div.appendChild(medal);
    }
    return div;
  }

  const { rank, suit } = card;
  const sym = SUIT_SYMBOL[suit];
  if (suit === 'H' || suit === 'D') div.classList.add('red');
  div.setAttribute('aria-label', `${rank}${sym}`);

  const frame = document.createElement('div');
  frame.className = 'frame';

  if (rank === 'J' || rank === 'Q' || rank === 'K') {
    // Double-ended court card: the same half-portrait, mirrored top and bottom.
    div.classList.add('face');
    const url = artUrl(`${rank}${suit}`);
    for (const pos of ['top', 'bottom']) {
      const half = document.createElement('div');
      half.className = `half ${pos}`;
      if (url) {
        half.appendChild(imgEl(url, pos === 'top' ? `${rank}${sym} card art` : ''));
      } else {
        half.classList.add('fallback');
        half.innerHTML = `<span class="crown">${rank === 'J' ? '🎸' : '👑'}</span><span class="head"></span>`;
      }
      frame.appendChild(half);
    }
  } else {
    if (rank === 'A') div.classList.add('ace');
    PIPS[rank].forEach(([x, y], i) => {
      const pip = facePip(suit, i, { whole: rank === 'A' });
      if (y > 50) pip.classList.add('flip');
      pip.style.left = `${x}%`;
      pip.style.top = `${y}%`;
      frame.appendChild(pip);
    });
  }
  div.appendChild(frame);

  for (const pos of ['tl', 'br']) {
    const corner = document.createElement('div');
    corner.className = `corner ${pos}`;
    corner.innerHTML = `<span class="r">${rank}</span><span class="s">${sym}</span>`;
    div.appendChild(corner);
  }
  return div;
}

function imgEl(src, alt) {
  const img = document.createElement('img');
  img.className = 'art';
  img.src = src;
  img.alt = alt;
  img.decoding = 'async';
  return img;
}

// ---------- game state ----------
// No betting: every hand is a flat 1-unit game, only results are counted.
const game = new BlackjackGame({ bankroll: Infinity });
const score = loadScore();

function loadScore() {
  try {
    const s = JSON.parse(store.get(SCORE_KEY));
    if (s && [s.bj, s.win, s.lose].every(Number.isFinite)) return s;
  } catch { /* ignore */ }
  return { bj: 0, win: 0, lose: 0 };
}

function record(results) {
  for (const r of results) {
    if (r.outcome === 'blackjack') score.bj++;
    else if (r.outcome === 'win') score.win++;
    else if (r.outcome === 'lose' || r.outcome === 'bust') score.lose++;
  }
  store.set(SCORE_KEY, JSON.stringify(score));
}

function render() {
  const inRound = game.phase === PHASE.PLAYER;
  const settled = game.phase === PHASE.SETTLED;

  els.scoreBj.textContent = score.bj;
  els.scoreWin.textContent = score.win;
  els.scoreLose.textContent = score.lose;

  // Dealer (hole card stays hidden while the player acts)
  els.dealerHand.replaceChildren(...game.dealer.map((c, i) => cardEl(c, inRound && i === 1)));
  if (!game.dealer.length) els.dealerTotal.textContent = '';
  else if (inRound) els.dealerTotal.textContent = handValue([game.dealer[0]]).total;
  else els.dealerTotal.textContent = handValue(game.dealer).total;

  // Player hands
  const multi = game.hands.length > 1;
  els.playerHands.replaceChildren(
    ...(game.hands.length ? game.hands : [{ cards: [] }]).map((h, i) => {
      const wrap = document.createElement('div');
      wrap.className = 'player-hand';
      if (inRound && multi && i === game.active) wrap.classList.add('active');
      const title = document.createElement('h3');
      let html = multi ? `Hand ${i + 1}` : 'You';
      if (h.cards.length) {
        const { total, soft } = handValue(h.cards);
        html += ` <span class="total">${soft && total < 21 ? `soft ${total}` : total}</span>`;
      }
      const r = settled ? game.results[i] : null;
      if (r) html += ` <span class="result ${r.outcome}">${OUTCOME_TEXT[r.outcome]}</span>`;
      title.innerHTML = html;
      const hand = document.createElement('div');
      hand.className = 'hand';
      hand.append(...h.cards.map((c) => cardEl(c)));
      wrap.append(title, hand);
      return wrap;
    }),
  );

  // Bottom action bar: "deal" between rounds, hit/stand(/split) during a round
  const a = game.actions();
  els.deal.hidden = inRound;
  els.deal.textContent = settled ? '한 판 더!' : '딜 받기';
  els.hit.hidden = !inRound;
  els.stand.hidden = !inRound;
  els.split.hidden = !inRound || !a.split;
}

function announce(text) {
  els.banner.textContent = text;
  els.banner.classList.remove('pop');
  void els.banner.offsetWidth; // restart the animation
  els.banner.classList.add('pop');
}

function headline(results) {
  if (results.length > 1) {
    const w = results.filter((r) => r.outcome === 'win' || r.outcome === 'blackjack').length;
    const l = results.filter((r) => r.outcome === 'lose' || r.outcome === 'bust').length;
    return w > l ? 'win' : w === l ? 'push' : 'lose';
  }
  return results[0].outcome;
}

function afterAction() {
  if (game.phase === PHASE.SETTLED) {
    record(game.results);
    announce(pick(BANTER[headline(game.results)]));
  } else if (game.phase === PHASE.PLAYER && game.hands.length > 1) {
    announce(`Hand ${game.active + 1} 차례야!`);
  }
  render();
}

function act(fn) {
  return () => {
    try {
      fn();
    } catch (err) {
      announce(err.message);
      return;
    }
    afterAction();
  };
}

els.deal.addEventListener('click', act(() => {
  game.deal(1);
  announce(pick(BANTER.deal));
}));
els.hit.addEventListener('click', act(() => game.hit()));
els.stand.addEventListener('click', act(() => game.stand()));
els.split.addEventListener('click', act(() => game.split()));

$('reset-score').addEventListener('click', () => {
  if (!confirm('점수를 초기화할까요?')) return;
  Object.assign(score, { bj: 0, win: 0, lose: 0 });
  store.set(SCORE_KEY, JSON.stringify(score));
  render();
});

// ---------- disclaimer ----------
$('show-disclaimer').addEventListener('click', () => els.disclaimer.showModal());
els.disclaimer.addEventListener('close', () => store.set(DISCLAIMER_KEY, '1'));
if (store.get(DISCLAIMER_KEY) !== '1') els.disclaimer.showModal();

await loadArt();
applyArt();
render();
