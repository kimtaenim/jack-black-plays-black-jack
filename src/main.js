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
  const title = artUrl('TITLE');
  if (title) {
    els.titleArt.src = title;
    els.titleArt.hidden = false;
    document.querySelector('.topbar').classList.add('has-art');
  }
  document.documentElement.style.setProperty('--face', `url("${artUrl('FACE') ?? FALLBACK_FACE}")`);
}

// ---------- DOM ----------
const $ = (id) => document.getElementById(id);
const els = {
  mood: $('mood'),
  titleArt: $('title-art'),
  scoreBj: $('score-bj'),
  scoreWin: $('score-win'),
  scoreLose: $('score-lose'),
  scoreRate: $('score-rate'),
  dealerImg: $('dealer-img'),
  dealerHand: $('dealer-hand'),
  dealerTotal: $('dealer-total'),
  playerHands: $('player-hands'),
  panel: $('panel'),
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

// A suit-shaped window showing Jack's face.
function facePip(suit) {
  const pip = document.createElement('span');
  pip.className = `pip face-pip suit-${suit}`;
  const face = document.createElement('span');
  face.className = 'pip-face';
  pip.appendChild(face);
  return pip;
}

// Only one or two pips per card carry the face; the rest are ordinary suit symbols.
// The choice is fixed per card so the same card always looks the same.
function facePipIndices(rank, suit, count) {
  if (count === 1) return new Set([0]);
  let h = 0;
  for (const ch of rank + suit) h = (h * 31 + ch.charCodeAt(0)) >>> 0;
  const n = count >= 6 ? 2 : 1;
  const picks = new Set();
  for (let i = 0; picks.size < n; i++) picks.add((h + i * 7919) % count);
  return picks;
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
      const medal = facePip('S');
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

  const own = artUrl(`${rank}${suit}`);
  if (own) {
    // Uploaded art is a complete card (indices included), so it fills the whole card.
    div.classList.add('full-art');
    div.appendChild(imgEl(own, `${rank}${sym}`));
    return div;
  }

  if (rank === 'J' || rank === 'Q' || rank === 'K') {
    div.classList.add('face');
    // Fallback: double-ended court card built from two mirrored halves.
    for (const pos of ['top', 'bottom']) {
      const half = document.createElement('div');
      half.className = `half ${pos} fallback`;
      half.innerHTML = `<span class="crown">${rank === 'J' ? '🎸' : '👑'}</span><span class="head"></span>`;
      frame.appendChild(half);
    }
  } else {
    if (rank === 'A') div.classList.add('ace');
    const spots = PIPS[rank];
    const faces = facePipIndices(rank, suit, spots.length);
    spots.forEach(([x, y], i) => {
      let pip;
      if (faces.has(i)) {
        pip = facePip(suit);
      } else {
        pip = document.createElement('span');
        pip.className = 'pip';
        pip.textContent = sym;
      }
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
const game = new BlackjackGame({ bankroll: Infinity, rules: { maxHands: 1 } }); // no splitting
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
  saveScore();
}
const saveScore = () => store.set(SCORE_KEY, JSON.stringify(score));

// Cards stand upright side by side; when they don't fit (3–4 cards) they overlap just enough.
function fitHand(handEl) {
  const cards = handEl.children;
  if (cards.length < 2) return;
  const w = cards[0].getBoundingClientRect().width;
  const avail = handEl.clientWidth;
  const step = Math.min(w * 1.06, (avail - w) / (cards.length - 1));
  for (let i = 1; i < cards.length; i++) cards[i].style.marginLeft = `${step - w}px`;
}
const fitAll = () => document.querySelectorAll('.hand').forEach(fitHand);

function render() {
  const inRound = game.phase === PHASE.PLAYER;

  // Dealer (hole card stays hidden while the player acts). Before the first deal, both
  // sides show face-down cards so the table is never empty.
  const idle = !game.dealer.length;
  els.dealerHand.replaceChildren(
    ...(idle ? [cardEl(null, true), cardEl(null, true)] : game.dealer.map((c, i) => cardEl(c, inRound && i === 1))),
  );
  if (!game.dealer.length) els.dealerTotal.textContent = '';
  else if (inRound) els.dealerTotal.textContent = handValue([game.dealer[0]]).total;
  else els.dealerTotal.textContent = handValue(game.dealer).total;

  // Player hand (one hand only — splitting is turned off)
  const h = game.hands[0] ?? { cards: [] };
  const wrap = document.createElement('div');
  wrap.className = 'player-hand';
  const title = document.createElement('h3');
  title.textContent = 'You';
  if (h.cards.length) {
    const { total, soft } = handValue(h.cards);
    const t = document.createElement('span');
    t.className = 'total';
    t.textContent = soft && total < 21 ? `soft ${total}` : total;
    title.append(' ', t);
  }
  const hand = document.createElement('div');
  hand.className = 'hand';
  hand.append(...(idle ? [cardEl(null, true), cardEl(null, true)] : h.cards.map((c) => cardEl(c))));
  wrap.append(hand, title); // label under the cards — the box overlaps their top edge
  els.playerHands.replaceChildren(wrap);

  renderScore();
  renderPanel();
  fitAll();
}

// ---------- center panel: start / "one more card?" / result + scoreboard ----------
const OUTCOME = {
  blackjack: { big: 'Blackjack!!', tone: 'good' },
  win: { big: 'You Win!', tone: 'good' },
  push: { big: 'Push', tone: 'even' },
  lose: { big: 'Dealer Wins', tone: 'bad' },
  bust: { big: 'Bust!', tone: 'bad' },
};

function button(cls, label, sub, onClick) {
  const b = document.createElement('button');
  b.className = `btn ${cls}`;
  b.innerHTML = sub ? `${label}<small>${sub}</small>` : label;
  b.addEventListener('click', onClick);
  return b;
}

function renderScore() {
  els.scoreBj.textContent = score.bj;
  els.scoreWin.textContent = score.win;
  els.scoreLose.textContent = score.lose;
  const played = score.bj + score.win + score.lose;
  els.scoreRate.textContent = played ? `${Math.round(((score.bj + score.win) / played) * 100)}%` : '–';
}

function renderPanel() {
  const p = els.panel;
  p.className = 'panel';
  p.replaceChildren();
  const head = document.createElement('p');
  const row = document.createElement('div');
  row.className = 'row';

  if (game.phase === PHASE.PLAYER) {
    head.className = 'ask';
    head.innerHTML = '한 장 더 받을까?<small>Hit me?</small>';
    row.append(
      button('yes', 'YES', '더 받기', act(() => game.hit())),
      button('no', 'NO', '그만', act(() => game.stand())),
    );
  } else if (game.phase === PHASE.SETTLED) {
    const o = OUTCOME[headline(game.results)];
    p.classList.add('result-panel');
    head.className = `outcome ${o.tone}`;
    head.textContent = o.big;
    row.append(button('gold', '한 판 더!', 'PLAY AGAIN', deal));
  } else {
    head.className = 'ask';
    head.innerHTML = '한 판 해볼까?<small>Ready to rock?</small>';
    row.append(button('gold', '게임 시작', 'DEAL', deal));
  }
  p.append(head, row);
}

// Dealer portrait: a different expression for each moment of the game.
// Generated images are DEALER_<MOOD> (wooden-puppet caricatures); until then the SVG dealer + an emoji badge.
const MOODS = {
  IDLE: '🙂', // waiting for a new game
  DEAL: '😉', // dealing / player deciding
  SHOCK: '😱', // player got a blackjack
  SAD: '😭', // player won
  LAUGH: '🤣', // dealer won
  SMUG: '😏', // player busted
  SHRUG: '🤷', // push
};
const MOOD_AFTER = { blackjack: 'SHOCK', win: 'SAD', lose: 'LAUGH', bust: 'SMUG', push: 'SHRUG' };

// When an expression hasn't been drawn yet, borrow the closest one that has.
const MOOD_STANDIN = { SMUG: ['LAUGH'], SHRUG: ['IDLE'] };

function setMood(mood) {
  const url = [mood, ...(MOOD_STANDIN[mood] ?? []), 'IDLE'].map((m) => artUrl(`DEALER_${m}`)).find(Boolean);
  els.dealerImg.src = url ?? FALLBACK_DEALER;
  els.mood.textContent = url ? '' : MOODS[mood]; // emoji badge only on the built-in SVG dealer
  els.dealerImg.parentElement.classList.remove('pop');
  void els.dealerImg.offsetWidth; // restart the animation
  els.dealerImg.parentElement.classList.add('pop');
}

const headline = (results) => results[0].outcome;

function act(fn) {
  return () => {
    try {
      fn();
    } catch (err) {
      console.warn(err);
      return;
    }
    if (game.phase === PHASE.SETTLED) {
      record(game.results);
      setMood(MOOD_AFTER[headline(game.results)]);
    }
    render();
  };
}

const deal = act(() => {
  game.deal(1);
  setMood('DEAL');
});

let resizeTimer;
window.addEventListener('resize', () => {
  clearTimeout(resizeTimer);
  resizeTimer = setTimeout(fitAll, 100);
});

function resetScore() {
  if (!confirm('블랙잭 승 · 승 · 패 · 승률을 모두 0으로 초기화할까요?')) return;
  Object.assign(score, { bj: 0, win: 0, lose: 0 });
  saveScore();
  render();
}
$('score-reset').addEventListener('click', resetScore);
$('reset-score').addEventListener('click', resetScore);

// ---------- tap one of your cards to bring it to the front (dealer cards aren't touchable) ----------
els.playerHands.addEventListener('click', (e) => {
  const card = e.target.closest('.card');
  if (!card) return;
  card.parentElement.querySelectorAll('.card.front').forEach((c) => c.classList.remove('front'));
  card.classList.add('front');
});

// ---------- disclaimer ----------
$('show-disclaimer').addEventListener('click', () => els.disclaimer.showModal());
els.disclaimer.addEventListener('close', () => store.set(DISCLAIMER_KEY, '1'));
if (store.get(DISCLAIMER_KEY) !== '1') els.disclaimer.showModal();

await loadArt();
applyArt();
setMood('IDLE');
render();
