// Famous short lines from Jack Black's films, shown in the dealer banner.
// Quotes belong to their respective films and rights holders; used here as brief, credited fan references.

const Q = {
  rockShow: {
    en: 'One great rock show can change the world.',
    ko: '멋진 록 공연 한 번이면 세상을 바꿀 수 있어.',
    src: 'School of Rock (2003)',
  },
  steve: {
    en: 'I… am Steve.',
    ko: '나는… 스티브다.',
    src: 'A Minecraft Movie (2025)',
  },
  serveSociety: {
    en: 'I serve society by rocking.',
    ko: '난 록으로 사회에 봉사한다고.',
    src: 'School of Rock (2003)',
  },
  flintAndSteel: {
    en: 'Flint and steel!',
    ko: '부싯돌과 부시!',
    src: 'A Minecraft Movie (2025)',
  },
  skadoosh: {
    en: 'Skadoosh!',
    ko: '스카두시!',
    src: 'Kung Fu Panda (2008)',
  },
  secretIngredient: {
    en: "There is no secret ingredient. It's just you.",
    ko: '비법 재료 같은 건 없어. 그냥 너야.',
    src: 'Kung Fu Panda (2008)',
  },
  hardcore: {
    en: "You're not hardcore unless you live hardcore.",
    ko: '하드코어하게 살지 않으면 하드코어가 아니야.',
    src: 'School of Rock (2003)',
  },
  dragonWarrior: {
    en: 'Buddy, I am the Dragon Warrior.',
    ko: '이봐, 내가 바로 용의 전사다.',
    src: 'Kung Fu Panda (2008)',
  },
  corn: {
    en: 'Get that corn outta my face!',
    ko: '내 얼굴에서 그 옥수수 치워!',
    src: 'Nacho Libre (2006)',
  },
  chickenJockey: {
    en: 'Chicken jockey!',
    ko: '치킨 조키!',
    src: 'A Minecraft Movie (2025)',
  },
  peaches: {
    en: 'Peaches, peaches, peaches, peaches, peaches~',
    ko: '피치, 피치, 피치, 피치, 피치~',
    src: 'The Super Mario Bros. Movie (2023)',
  },
};

// Which lines the dealer says in each situation.
export const QUOTES = {
  welcome: [Q.rockShow],
  deal: [Q.steve, Q.serveSociety, Q.flintAndSteel],
  blackjack: [Q.skadoosh], // player got a blackjack
  win: [Q.secretIngredient], // player won
  lose: [Q.hardcore, Q.dragonWarrior], // dealer won
  bust: [Q.corn, Q.chickenJockey], // player busted
  push: [Q.peaches],
};
