import { BlackjackGame, PHASE, handValue } from './engine.js';

const STORAGE_KEY = 'jbpbj.bankroll';
const DISCLAIMER_KEY = 'jbpbj.disclaimer.v1';
const START_BANKROLL = 1000;

const SUIT_SYMBOL = { S: '♠', H: '♥', D: '♦', C: '♣' };
const FALLBACK_ART = { J: '🤘', Q: '🎤', K: '🎸' };

const OUTCOME_TEXT = {
  blackjack: 'BLACKJACK!',
  win: 'WIN',
  push: 'PUSH',
  lose: 'LOSE',
  bust: 'BUST',
};

// Parody banter shown after each round (original lines, not real quotes).
const BANTER = {
  blackjack: ['🔥 BLACKJACK! 이건 록의 신이 내려준 패다!', '🤘 21! 기타 솔로 한 번 가자!'],
  win: ['🎸 이겼다! 앰프 볼륨 11로!', '🤘 Rock ON! 딜러를 박살냈어!'],
  push: ['😐 무승부… 앙코르 한 판 더?', '🥁 비겼다. 드럼 롤은 다음 기회에.'],
  lose: ['😭 졌다… 발라드 모드로 전환.', '💔 딜러가 이겼어. 하지만 록은 멈추지 않아!'],
  bust: ['💥 버스트! 앰프가 터졌다!', '🙈 22 이상… 너무 세게 쳤어.'],
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

// ---------- card art manifest ----------
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

// ---------- DOM ----------
const $ = (id) => document.getElementById(id);
const els = {
  bankroll: $('bankroll'),
  bet: $('bet'),
  banner: $('banner'),
  dealerHand: $('dealer-hand'),
  dealerTotal: $('dealer-total'),
  playerHands: $('player-hands'),
  deal: $('deal'),
  hit: $('hit'),
  stand: $('stand'),
  double: $('double'),
  split: $('split'),
  clearBet: $('clear-bet'),
  disclaimer: $('disclaimer'),
};

function cardEl(card, faceDown = false) {
  const div = document.createElement('div');
  div.className = 'card';

  if (faceDown) {
    div.classList.add('back');
    div.setAttribute('aria-label', 'face-down card');
    const url = artUrl('BACK');
    if (url) {
      div.classList.add('has-art');
      div.appendChild(imgEl(url, 'card back'));
    }
    return div;
  }

  const { rank, suit } = card;
  const sym = SUIT_SYMBOL[suit];
  if (suit === 'H' || suit === 'D') div.classList.add('red');
  div.setAttribute('aria-label', `${rank}${sym}`);

  const face = rank === 'J' || rank === 'Q' || rank === 'K';
  if (face) {
    const url = artUrl(`${rank}${suit}`);
    if (url) {
      div.appendChild(imgEl(url, `${rank}${sym} card art`));
    } else {
      const fb = document.createElement('div');
      fb.className = 'art-fallback';
      fb.innerHTML = `<span>${FALLBACK_ART[rank]}<small>${sym} JB ${sym}</small></span>`;
      div.appendChild(fb);
    }
  } else {
    const pip = document.createElement('div');
    pip.className = 'pip';
    pip.textContent = sym;
    div.appendChild(pip);
  }

  for (const pos of ['tl', 'br']) {
    const corner = document.createElement('div');
    corner.className = `corner ${pos}`;
    corner.innerHTML = `<span>${rank}</span><span>${sym}</span>`;
    div.appendChild(corner);
  }
  return div;
}

function imgEl(src, alt) {
  const img = document.createElement('img');
  img.className = 'art';
  img.src = src;
  img.alt = alt;
  img.loading = 'lazy';
  img.decoding = 'async';
  return img;
}

// ---------- game state ----------
const saved = Number(store.get(STORAGE_KEY));
const game = new BlackjackGame({ bankroll: saved > 0 ? saved : START_BANKROLL });
let bet = 0;
let lastBet = 0;

function render() {
  const inRound = game.phase === PHASE.PLAYER;
  const settled = game.phase === PHASE.SETTLED;

  els.bankroll.textContent = game.bankroll;
  els.bet.textContent = bet;

  // Dealer
  els.dealerHand.replaceChildren(
    ...game.dealer.map((c, i) => cardEl(c, inRound && i === 1)),
  );
  if (!game.dealer.length) els.dealerTotal.textContent = '';
  else if (inRound) els.dealerTotal.textContent = handValue([game.dealer[0]]).total;
  else els.dealerTotal.textContent = handValue(game.dealer).total;

  // Player hands
  els.playerHands.replaceChildren(
    ...game.hands.map((h, i) => {
      const wrap = document.createElement('div');
      wrap.className = 'player-hand';
      if (inRound && i === game.active && game.hands.length > 1) wrap.classList.add('active');
      const { total, soft } = handValue(h.cards);
      const r = settled ? game.results[i] : null;
      const title = document.createElement('h3');
      title.innerHTML =
        `${game.hands.length > 1 ? `Hand ${i + 1}` : 'You'} ` +
        `<span class="total">${soft && total < 21 ? `soft ${total}` : total}</span> ` +
        `<span class="muted">· bet ${h.bet}</span>` +
        (r ? `<span class="result ${r.outcome}">${OUTCOME_TEXT[r.outcome]} ${r.net >= 0 ? '+' : ''}${r.net}</span>` : '');
      const hand = document.createElement('div');
      hand.className = 'hand';
      hand.append(...h.cards.map((c) => cardEl(c)));
      wrap.append(title, hand);
      return wrap;
    }),
  );

  // Controls
  const a = game.actions();
  els.hit.disabled = !a.hit;
  els.stand.disabled = !a.stand;
  els.double.disabled = !a.double;
  els.split.disabled = !a.split;
  const canBet = !inRound;
  document.querySelectorAll('.chip').forEach((b) => {
    b.disabled = !canBet || (b.dataset.chip && bet + Number(b.dataset.chip) > game.bankroll);
  });
  els.clearBet.disabled = !canBet || bet === 0;
  els.deal.disabled = !canBet || bet <= 0 || bet > game.bankroll;

  store.set(STORAGE_KEY, String(game.bankroll));
}

function announce(text) {
  els.banner.textContent = text;
}

function afterAction() {
  if (game.phase === PHASE.SETTLED) {
    const best = pickHeadline(game.results);
    const lines = BANTER[best];
    announce(lines[Math.floor(Math.random() * lines.length)]);
    bet = Math.min(lastBet, game.bankroll);
    if (game.bankroll <= 0) {
      game.bankroll = START_BANKROLL;
      bet = 0;
      announce('💸 칩이 바닥났다! 새 투어 시작 — 칩 1000개 지급! 🎸');
    }
  } else if (game.phase === PHASE.PLAYER && game.hands.length > 1) {
    announce(`Hand ${game.active + 1} 차례!`);
  } else if (game.phase === PHASE.PLAYER) {
    announce('Hit? Stand? 록 스피릿을 믿어!');
  }
  render();
}

function pickHeadline(results) {
  const order = ['blackjack', 'win', 'push', 'lose', 'bust'];
  const net = results.reduce((s, r) => s + r.net, 0);
  if (results.length > 1) return net > 0 ? 'win' : net === 0 ? 'push' : 'lose';
  return order.find((o) => results.some((r) => r.outcome === o));
}

// ---------- events ----------
function safely(fn) {
  return () => {
    try {
      fn();
    } catch (err) {
      announce(err.message);
    }
    afterAction();
  };
}

document.querySelectorAll('.chip[data-chip]').forEach((b) =>
  b.addEventListener('click', () => {
    if (game.phase === PHASE.PLAYER) return;
    bet = Math.min(bet + Number(b.dataset.chip), game.bankroll);
    render();
  }),
);
els.clearBet.addEventListener('click', () => {
  bet = 0;
  render();
});

const deal = safely(() => {
  lastBet = bet;
  game.deal(bet);
});
els.deal.addEventListener('click', deal);
els.hit.addEventListener('click', safely(() => game.hit()));
els.stand.addEventListener('click', safely(() => game.stand()));
els.double.addEventListener('click', safely(() => game.double()));
els.split.addEventListener('click', safely(() => game.split()));

document.addEventListener('keydown', (e) => {
  if (els.disclaimer.open || e.metaKey || e.ctrlKey || e.altKey) return;
  const key = e.key.toLowerCase();
  const map = { h: els.hit, s: els.stand, d: els.double, p: els.split, enter: els.deal };
  const btn = map[key];
  if (btn && !btn.disabled) {
    e.preventDefault();
    btn.click();
  }
});

// ---------- disclaimer ----------
$('show-disclaimer').addEventListener('click', () => els.disclaimer.showModal());
els.disclaimer.addEventListener('close', () => store.set(DISCLAIMER_KEY, '1'));
if (store.get(DISCLAIMER_KEY) !== '1') els.disclaimer.showModal();

await loadArt();
render();
