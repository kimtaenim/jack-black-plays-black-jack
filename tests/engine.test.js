import { test } from 'node:test';
import assert from 'node:assert/strict';
import {
  handValue,
  isBlackjack,
  createDeck,
  shuffle,
  Shoe,
  BlackjackGame,
  PHASE,
} from '../src/engine.js';

const c = (rank, suit = 'S') => ({ rank, suit });

// A shoe that deals a fixed sequence (first element is dealt first).
function stacked(ranks) {
  const queue = ranks.map((r) => c(r));
  return {
    used: 0,
    reset() {},
    draw() {
      if (!queue.length) throw new Error('stacked shoe empty');
      return queue.shift();
    },
  };
}

// Deal order is: player, dealer, player, dealer, then any hits.
const game = (ranks, opts = {}) => new BlackjackGame({ bankroll: 1000, shoe: stacked(ranks), ...opts });

test('hand values handle soft and hard aces', () => {
  assert.deepEqual(handValue([c('A'), c('6')]), { total: 17, soft: true });
  assert.deepEqual(handValue([c('A'), c('6'), c('10')]), { total: 17, soft: false });
  assert.deepEqual(handValue([c('A'), c('A'), c('9')]), { total: 21, soft: true });
  assert.deepEqual(handValue([c('K'), c('Q'), c('2')]), { total: 22, soft: false });
});

test('blackjack detection', () => {
  assert.ok(isBlackjack([c('A'), c('K')]));
  assert.ok(!isBlackjack([c('7'), c('7'), c('7')]));
});

test('deck and shuffle', () => {
  assert.equal(createDeck().length, 52);
  let seed = 1;
  const rng = () => ((seed = (seed * 16807) % 2147483647) / 2147483647);
  const s = shuffle(createDeck(), rng);
  assert.equal(s.length, 52);
  assert.equal(new Set(s.map((x) => x.rank + x.suit)).size, 52);
  assert.equal(new Shoe(6).cards.length, 312);
});

test('player blackjack pays 3:2', () => {
  const g = game(['A', '9', 'K', '7']).deal(100);
  assert.equal(g.phase, PHASE.SETTLED);
  assert.equal(g.results[0].outcome, 'blackjack');
  assert.equal(g.bankroll, 1150);
});

test('both blackjack is a push', () => {
  const g = game(['A', 'A', 'K', 'Q']).deal(100);
  assert.equal(g.results[0].outcome, 'push');
  assert.equal(g.bankroll, 1000);
});

test('dealer blackjack beats player 20', () => {
  const g = game(['K', 'A', 'Q', 'K']).deal(100);
  assert.equal(g.results[0].outcome, 'lose');
  assert.equal(g.bankroll, 900);
});

test('stand and win against dealer bust', () => {
  // player 10+8=18, dealer 10+6=16 hits 10 -> 26
  const g = game(['10', '10', '8', '6', '10']).deal(100).stand();
  assert.equal(g.results[0].outcome, 'win');
  assert.equal(g.bankroll, 1100);
});

test('player bust loses and dealer does not draw', () => {
  const g = game(['10', '10', '6', '6', 'K']).deal(100).hit();
  assert.equal(g.results[0].outcome, 'bust');
  assert.equal(g.dealer.length, 2);
  assert.equal(g.bankroll, 900);
});

test('push on equal totals', () => {
  const g = game(['10', '10', '8', '8']).deal(50).stand();
  assert.equal(g.results[0].outcome, 'push');
  assert.equal(g.bankroll, 1000);
});

test('double down doubles the bet and draws exactly one card', () => {
  // player 6+5=11, dealer 10+7=17, double -> 10 => 21
  const g = game(['6', '10', '5', '7', '10']).deal(100);
  assert.ok(g.actions().double);
  g.double();
  assert.equal(g.hands[0].cards.length, 3);
  assert.equal(g.results[0].outcome, 'win');
  assert.equal(g.bankroll, 1200);
});

test('dealer stands on soft 17 by default, hits with H17', () => {
  const s17 = game(['10', 'A', '8', '6']).deal(100).stand();
  assert.equal(s17.dealer.length, 2);
  assert.equal(s17.results[0].outcome, 'win');

  const h17 = game(['10', 'A', '8', '6', '3'], { rules: { dealerHitsSoft17: true } }).deal(100).stand();
  assert.equal(h17.dealer.length, 3);
  assert.equal(h17.results[0].outcome, 'lose'); // dealer 20 vs 18
});

test('split plays two hands independently', () => {
  // player 8,8 ; dealer 10,7 ; split -> hand1 gets 3, hand2 gets 10
  const g = game(['8', '10', '8', '7', '3', '10', '9']).deal(100);
  assert.ok(g.actions().split);
  g.split();
  assert.equal(g.hands.length, 2);
  assert.equal(g.bankroll, 800);
  g.hit(); // hand1: 8+3+9 = 20
  g.stand();
  // hand2: 8+10=18
  g.stand();
  assert.equal(g.phase, PHASE.SETTLED);
  assert.deepEqual(g.results.map((r) => r.outcome), ['win', 'win']);
  assert.equal(g.bankroll, 1200);
});

test('split aces get one card each and 21 is not blackjack', () => {
  const g = game(['A', '10', 'A', '9', 'K', '5']).deal(100).split();
  assert.equal(g.phase, PHASE.SETTLED);
  assert.deepEqual(g.results.map((r) => r.outcome), ['win', 'lose']);
  assert.equal(g.bankroll, 1000); // +200 back, 0 back, from 800
});

test('cannot bet more than bankroll', () => {
  assert.throws(() => game(['2', '3', '4', '5']).deal(5000));
});
