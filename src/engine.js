// Blackjack engine — pure logic, no DOM. Works in browsers and Node (ES module).

export const SUITS = ['S', 'H', 'D', 'C']; // spades, hearts, diamonds, clubs
export const RANKS = ['A', '2', '3', '4', '5', '6', '7', '8', '9', '10', 'J', 'Q', 'K'];

export const DEFAULT_RULES = {
  decks: 6,
  dealerHitsSoft17: false, // S17 by default
  blackjackPayout: 1.5, // 3:2
  maxHands: 4, // split up to 4 hands
  doubleAfterSplit: true,
  reshufflePenetration: 0.75, // reshuffle once 75% of the shoe is used
};

export function cardValue(rank) {
  if (rank === 'A') return 11;
  if (rank === 'J' || rank === 'Q' || rank === 'K') return 10;
  return Number(rank);
}

// Returns { total, soft } — soft means an ace is still counted as 11.
export function handValue(cards) {
  let total = 0;
  let aces = 0;
  for (const c of cards) {
    total += cardValue(c.rank);
    if (c.rank === 'A') aces++;
  }
  while (total > 21 && aces > 0) {
    total -= 10;
    aces--;
  }
  return { total, soft: aces > 0 };
}

export function isBlackjack(cards) {
  return cards.length === 2 && handValue(cards).total === 21;
}

export function createDeck() {
  const deck = [];
  for (const suit of SUITS) for (const rank of RANKS) deck.push({ rank, suit });
  return deck;
}

// Fisher–Yates with an injectable RNG (for deterministic tests).
export function shuffle(cards, rng = Math.random) {
  const a = cards.slice();
  for (let i = a.length - 1; i > 0; i--) {
    const j = Math.floor(rng() * (i + 1));
    [a[i], a[j]] = [a[j], a[i]];
  }
  return a;
}

export class Shoe {
  constructor(decks = 6, rng = Math.random) {
    this.decks = decks;
    this.rng = rng;
    this.reset();
  }

  reset() {
    const all = [];
    for (let i = 0; i < this.decks; i++) all.push(...createDeck());
    this.cards = shuffle(all, this.rng);
    this.total = this.cards.length;
  }

  draw() {
    if (this.cards.length === 0) this.reset();
    return this.cards.pop();
  }

  get used() {
    return 1 - this.cards.length / this.total;
  }
}

export const PHASE = {
  BETTING: 'betting',
  PLAYER: 'player',
  DEALER: 'dealer',
  SETTLED: 'settled',
};

export class BlackjackGame {
  constructor({ bankroll = 1000, rules = {}, rng = Math.random, shoe } = {}) {
    this.rules = { ...DEFAULT_RULES, ...rules };
    this.bankroll = bankroll;
    this.shoe = shoe ?? new Shoe(this.rules.decks, rng);
    this.phase = PHASE.BETTING;
    this.dealer = [];
    this.hands = [];
    this.active = 0;
    this.results = [];
  }

  get activeHand() {
    return this.hands[this.active];
  }

  deal(bet) {
    if (this.phase !== PHASE.BETTING && this.phase !== PHASE.SETTLED) {
      throw new Error('Cannot deal now');
    }
    if (!Number.isFinite(bet) || bet <= 0) throw new Error('Bet must be positive');
    if (bet > this.bankroll) throw new Error('Not enough chips');

    if (this.shoe.used >= this.rules.reshufflePenetration) this.shoe.reset();

    this.bankroll -= bet;
    this.hands = [{ cards: [], bet, done: false, doubled: false, fromSplit: false }];
    this.dealer = [];
    this.active = 0;
    this.results = [];

    const hand = this.hands[0];
    hand.cards.push(this.shoe.draw());
    this.dealer.push(this.shoe.draw());
    hand.cards.push(this.shoe.draw());
    this.dealer.push(this.shoe.draw());

    this.phase = PHASE.PLAYER;
    if (isBlackjack(hand.cards) || isBlackjack(this.dealer)) {
      hand.done = true;
      this._settle();
    }
    return this;
  }

  // Which actions are legal right now.
  actions() {
    const h = this.activeHand;
    if (this.phase !== PHASE.PLAYER || !h) {
      return { hit: false, stand: false, double: false, split: false };
    }
    const twoCards = h.cards.length === 2;
    const canAfford = this.bankroll >= h.bet;
    return {
      hit: true,
      stand: true,
      double: twoCards && canAfford && (!h.fromSplit || this.rules.doubleAfterSplit),
      split:
        twoCards &&
        canAfford &&
        cardValue(h.cards[0].rank) === cardValue(h.cards[1].rank) &&
        this.hands.length < this.rules.maxHands,
    };
  }

  hit() {
    this._require('hit');
    const h = this.activeHand;
    h.cards.push(this.shoe.draw());
    if (handValue(h.cards).total >= 21) this._finishHand();
    return this;
  }

  stand() {
    this._require('stand');
    this._finishHand();
    return this;
  }

  double() {
    this._require('double');
    const h = this.activeHand;
    this.bankroll -= h.bet;
    h.bet *= 2;
    h.doubled = true;
    h.cards.push(this.shoe.draw());
    this._finishHand();
    return this;
  }

  split() {
    this._require('split');
    const h = this.activeHand;
    this.bankroll -= h.bet;
    const second = { cards: [h.cards.pop()], bet: h.bet, done: false, doubled: false, fromSplit: true };
    h.fromSplit = true;
    const splitAces = h.cards[0].rank === 'A';
    h.cards.push(this.shoe.draw());
    second.cards.push(this.shoe.draw());
    this.hands.splice(this.active + 1, 0, second);
    // Split aces get exactly one card each.
    if (splitAces) {
      h.done = true;
      second.done = true;
      this._advance();
    } else if (handValue(h.cards).total === 21) {
      this._finishHand();
    }
    return this;
  }

  _require(action) {
    if (!this.actions()[action]) throw new Error(`Cannot ${action} now`);
  }

  _finishHand() {
    this.activeHand.done = true;
    this._advance();
  }

  _advance() {
    while (this.active < this.hands.length && this.hands[this.active].done) this.active++;
    if (this.active >= this.hands.length) {
      this.phase = PHASE.DEALER;
      this._playDealer();
      this._settle();
      return;
    }
    // A split hand dealt to 21 is finished automatically.
    if (handValue(this.activeHand.cards).total === 21) this._finishHand();
  }

  _playDealer() {
    // Dealer only draws if at least one player hand is still alive.
    const anyAlive = this.hands.some((h) => handValue(h.cards).total <= 21);
    if (!anyAlive) return;
    for (;;) {
      const { total, soft } = handValue(this.dealer);
      if (total < 17 || (total === 17 && soft && this.rules.dealerHitsSoft17)) {
        this.dealer.push(this.shoe.draw());
      } else break;
    }
  }

  _settle() {
    const dealerBJ = isBlackjack(this.dealer);
    const dealerTotal = handValue(this.dealer).total;
    this.results = this.hands.map((h) => {
      const total = handValue(h.cards).total;
      const playerBJ = isBlackjack(h.cards) && this.hands.length === 1 && !h.fromSplit;
      let outcome;
      let payout = 0; // amount returned to bankroll, including the original stake
      if (playerBJ && dealerBJ) {
        outcome = 'push';
        payout = h.bet;
      } else if (playerBJ) {
        outcome = 'blackjack';
        payout = h.bet + h.bet * this.rules.blackjackPayout;
      } else if (dealerBJ) {
        outcome = 'lose';
      } else if (total > 21) {
        outcome = 'bust';
      } else if (dealerTotal > 21 || total > dealerTotal) {
        outcome = 'win';
        payout = h.bet * 2;
      } else if (total === dealerTotal) {
        outcome = 'push';
        payout = h.bet;
      } else {
        outcome = 'lose';
      }
      this.bankroll += payout;
      return { outcome, bet: h.bet, payout, net: payout - h.bet, total };
    });
    this.phase = PHASE.SETTLED;
  }
}
