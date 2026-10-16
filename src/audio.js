// Sound: cheap honky-tonk casino piano, all synthesized with Web Audio (no audio files).
// The on/off interface and the mobile unlock tricks follow the bosses-of-our-world project.
//
// Music: ragtime made up on the spot. Every 16 bars a new random rag (key, tempo, progression
// and melody) starts, played on a detuned "honky-tonk" piano.
//
// Results have no sound effects of their own: the pianist plays them into the rag, in its key
// and tempo (react()), then carries on from the next bar.
//   win        tonic chord, BANG BANG (+ trumpet)   blackjack  trumpet fanfare up to a big tonic chord
//   lose       dissonant cluster, BANG BANG         bust       a very short sad trumpet tune, minor
//   push       nothing: the rag just keeps going
//   + a loud shower of coins on win / blackjack, and a bottle smashing on bust
//   dealer blackjack  a crashing cluster, the piano stops for a moment, then a new rag
//
// Small table noises stay as effects:  card  (lands on the felt)  flip  (hole card)  tick  on

const MUTE_KEY = 'jbpbj.muted';

// minimum gap between two plays of the same sound (ms)
const MIN_GAP = { card: 45, tick: 60, flip: 80 };

export class Sound {
  constructor() {
    this.ctx = null;
    this.last = {};
    this.noiseBuf = null;
    try { this.muted = localStorage.getItem(MUTE_KEY) === '1'; } catch { this.muted = false; }
    this.bindUnlock();
  }

  // ---------- on / off ----------

  setMuted(m) {
    this.muted = m;
    try { localStorage.setItem(MUTE_KEY, m ? '1' : '0'); } catch { /* ignore */ }
    if (m) {
      this.silentTag(false);
      this.stopMusic();
      if (this.ctx && this.ctx.state === 'running') this.ctx.suspend().catch(() => {});
    } else {
      this.unlock();
      this.poke();
      this.startMusic();
    }
  }

  // iOS silent switch: a looping silent <audio> makes Web Audio count as media playback.
  silentTag(on) {
    if (!this.tag) {
      if (!on) return;
      const rate = 8000, n = 4000; // 0.5 s of silence
      const buf = new Uint8Array(44 + n);
      const dv = new DataView(buf.buffer);
      const w = (o, s) => { for (let i = 0; i < s.length; i++) buf[o + i] = s.charCodeAt(i); };
      w(0, 'RIFF'); dv.setUint32(4, 36 + n, true); w(8, 'WAVEfmt '); dv.setUint32(16, 16, true);
      dv.setUint16(20, 1, true); dv.setUint16(22, 1, true); dv.setUint32(24, rate, true); dv.setUint32(28, rate, true);
      dv.setUint16(32, 1, true); dv.setUint16(34, 8, true); w(36, 'data'); dv.setUint32(40, n, true);
      buf.fill(128, 44);
      let bin = '';
      for (const b of buf) bin += String.fromCharCode(b);
      const a = document.createElement('audio');
      a.src = 'data:audio/wav;base64,' + btoa(bin);
      a.loop = true;
      a.preload = 'auto';
      a.setAttribute('playsinline', '');
      a.setAttribute('x-webkit-airplay', 'deny');
      this.tag = a;
    }
    try {
      if (on) { const p = this.tag.play(); if (p) p.catch(() => {}); } else this.tag.pause();
    } catch { /* ignore */ }
  }

  // play one silent sample inside a user tap so iOS really unlocks audio
  poke() {
    this.silentTag(!this.muted);
    if (!this.ctx) return;
    try {
      const blank = this.ctx.createBufferSource();
      blank.buffer = this.ctx.createBuffer(1, 1, 22050);
      blank.connect(this.ctx.destination);
      blank.start(0);
    } catch { /* ignore */ }
  }

  // wake audio on any user gesture; rebuild it after the app was in the background (iOS)
  bindUnlock() {
    const wake = () => this.unlock();
    for (const ev of ['touchend', 'pointerup', 'mouseup', 'click', 'keydown']) {
      document.addEventListener(ev, wake, { capture: true, passive: true });
    }
    const away = () => {
      this.stale = true;
      if (this.ctx && this.ctx.state === 'running') this.ctx.suspend().catch(() => {});
    };
    document.addEventListener('visibilitychange', () => (document.hidden ? away() : this.resume()));
    window.addEventListener('pagehide', away);
    window.addEventListener('pageshow', () => this.resume());
  }

  ready() {
    if (!this.ctx || this.muted) return Promise.resolve();
    return Promise.race([this.resume(), new Promise((r) => setTimeout(r, 400))]);
  }

  resume() {
    if (this.muted || !this.ctx) return Promise.resolve();
    if (this.ctx.state === 'closed') { this.ctx = null; return Promise.resolve(); }
    if (this.ctx.state === 'running') return Promise.resolve();
    return this.ctx.resume().catch(() => {});
  }

  rebuild() {
    const old = this.ctx;
    this.stopMusic();
    this.ctx = null;
    this.noiseBuf = null;
    if (old && old.state !== 'closed') old.close().catch(() => {});
    this.unlock();
    this.startMusic();
  }

  unlock() {
    if (this.muted) return;
    if (this.ctx) {
      if (this.stale || this.ctx.state === 'closed' || (this.ctx.state !== 'running' && this.ctx.state !== 'suspended')) {
        this.stale = false;
        this.rebuild();
        return;
      }
      this.resume();
      if (this.ctx.state !== 'running') this.poke();
      return;
    }
    this.stale = false;
    const AC = window.AudioContext || window.webkitAudioContext;
    if (!AC) return;
    try { if (navigator.audioSession) navigator.audioSession.type = 'playback'; } catch { /* ignore */ }
    const ctx = (this.ctx = new AC());
    // effects and music go through one compressor so they never clip
    const comp = ctx.createDynamicsCompressor();
    comp.threshold.value = -14;
    comp.knee.value = 10;
    comp.ratio.value = 6;
    comp.attack.value = 0.003;
    comp.release.value = 0.15;
    comp.connect(ctx.destination);
    this.fx = ctx.createGain();
    this.fx.gain.value = 0.85;
    this.fx.connect(comp);
    this.music = ctx.createGain();
    this.music.gain.value = MUSIC_VOL;
    // a little "bar-room" tone: roll off the top end of the piano
    const tone = ctx.createBiquadFilter();
    tone.type = 'lowpass';
    tone.frequency.value = 3800;
    this.music.connect(tone).connect(comp);
    // the result licks: same piano, played much harder than the background rag
    this.hits = ctx.createGain();
    this.hits.gain.value = HITS_VOL;
    this.hits.connect(tone);
    this.poke();
    this.resume();
  }

  // ---------- effects ----------

  play(name) {
    if (this.muted || !this.ctx) return;
    if (this.ctx.state !== 'running') {
      this.resume().then(() => { if (this.ctx && this.ctx.state === 'running') this.play(name); });
      return;
    }
    const now = performance.now();
    if (now - (this.last[name] || 0) < (MIN_GAP[name] ?? 0)) return;
    this.last[name] = now;
    const fn = FX[name];
    if (!fn) return;
    try { fn(this); } catch { /* a failed synth sound is never fatal */ }
  }

  get t0() { return this.ctx.currentTime + 0.01; }

  tone(type, f0, f1, dur, vol, delay = 0, out = this.fx) {
    const ctx = this.ctx;
    const t = this.t0 + delay;
    const o = ctx.createOscillator();
    const g = ctx.createGain();
    o.type = type;
    o.frequency.setValueAtTime(f0, t);
    o.frequency.exponentialRampToValueAtTime(Math.max(20, f1), t + dur);
    g.gain.setValueAtTime(0.0001, t);
    g.gain.exponentialRampToValueAtTime(Math.max(0.0002, vol), t + 0.006);
    g.gain.exponentialRampToValueAtTime(0.0001, t + dur);
    o.connect(g).connect(out);
    o.start(t);
    o.stop(t + dur + 0.03);
  }

  noise(dur, vol, f0, delay = 0, type = 'bandpass', f1 = f0, q = 0.8) {
    const ctx = this.ctx;
    if (!this.noiseBuf) {
      this.noiseBuf = ctx.createBuffer(1, ctx.sampleRate, ctx.sampleRate);
      const d = this.noiseBuf.getChannelData(0);
      for (let i = 0; i < d.length; i++) d[i] = Math.random() * 2 - 1;
    }
    const t = this.t0 + delay;
    const src = ctx.createBufferSource();
    src.buffer = this.noiseBuf;
    const f = ctx.createBiquadFilter();
    f.type = type;
    f.Q.value = q;
    f.frequency.setValueAtTime(f0, t);
    f.frequency.exponentialRampToValueAtTime(Math.max(30, f1), t + dur);
    const g = ctx.createGain();
    g.gain.setValueAtTime(vol, t);
    g.gain.exponentialRampToValueAtTime(0.0001, t + dur);
    src.connect(f).connect(g).connect(this.fx);
    src.start(t, Math.random() * 0.5);
    src.stop(t + dur + 0.03);
  }

  // one honky-tonk piano note: two slightly detuned strings + a hammer click
  piano(midi, when, dur, vol, out) {
    const ctx = this.ctx;
    const f = 440 * Math.pow(2, (midi - 69) / 12);
    const g = ctx.createGain();
    g.gain.setValueAtTime(0.0001, when);
    g.gain.exponentialRampToValueAtTime(vol, when + 0.004);
    g.gain.exponentialRampToValueAtTime(vol * 0.35, when + 0.12);
    g.gain.exponentialRampToValueAtTime(0.0001, when + dur);
    g.connect(out);
    // [wave, detune in cents, level, harmonic]
    for (const [type, cents, lvl, mult] of [['triangle', -11, 0.7, 1], ['sawtooth', 9, 0.18, 1], ['triangle', 2, 0.3, 2]]) {
      const o = ctx.createOscillator();
      const og = ctx.createGain();
      o.type = type;
      o.frequency.value = f * mult * Math.pow(2, cents / 1200);
      og.gain.value = lvl;
      o.connect(og).connect(g);
      o.start(when);
      o.stop(when + dur + 0.05);
    }
  }

  // a brassy trumpet note: buzzy saws through a filter that opens on the attack ("blat"),
  // with a little vibrato on longer notes
  trumpet(midi, when, dur, vol, out) {
    const ctx = this.ctx;
    const f = 440 * Math.pow(2, (midi - 69) / 12);
    const end = when + Math.max(0.08, dur);
    const lp = ctx.createBiquadFilter();
    lp.type = 'lowpass';
    lp.Q.value = 2;
    lp.frequency.setValueAtTime(f * 1.5, when);
    lp.frequency.linearRampToValueAtTime(f * 7, when + 0.04);
    lp.frequency.exponentialRampToValueAtTime(f * 3.5, when + 0.18);
    const g = ctx.createGain();
    g.gain.setValueAtTime(0.0001, when);
    g.gain.exponentialRampToValueAtTime(vol, when + 0.03);
    g.gain.setValueAtTime(vol * 0.8, end - 0.05);
    g.gain.exponentialRampToValueAtTime(0.0001, end + 0.06);
    lp.connect(g).connect(out);
    const vib = ctx.createOscillator();
    const vg = ctx.createGain();
    vib.frequency.value = 5.5;
    vg.gain.setValueAtTime(0, when);
    vg.gain.linearRampToValueAtTime(dur > 0.35 ? f * 0.012 : 0, when + 0.3);
    vib.connect(vg);
    for (const cents of [-6, 6]) {
      const o = ctx.createOscillator();
      o.type = 'sawtooth';
      o.frequency.value = f * Math.pow(2, cents / 1200);
      vg.connect(o.frequency);
      o.connect(lp);
      o.start(when);
      o.stop(end + 0.1);
    }
    vib.start(when);
    vib.stop(end + 0.1);
  }

  // ---------- results, played into the music ----------

  // kind: win | blackjack | lose | bust | dealerBJ
  react(kind) {
    if (this.muted || !this.ctx) return;
    if (this.ctx.state !== 'running') {
      this.resume().then(() => { if (this.ctx && this.ctx.state === 'running') this.react(kind); });
      return;
    }
    if (!this.musicTimer) this.startMusic();
    if (!this.tune || this.tune.step >= this.tune.steps.length) this.tune = makeTune();
    const t = this.tune;
    // come in on the next eighth note
    const at = t.step + (t.step % 2);
    const lick = LICKS[kind]?.(t.key);
    if (!lick) return;
    if (kind === 'dealerBJ') {
      // crash, silence, then a brand-new rag
      t.steps = t.steps.slice(0, at).concat(lick);
    } else {
      // after the lick, pick the rag up again at the start of the next bar
      const resume = Math.ceil((at + lick.length) / 8) * 8;
      const pad = Array.from({ length: resume - at - lick.length }, () => []);
      t.steps = t.steps.slice(0, at).concat(lick, pad, t.steps.slice(resume));
    }
    while (t.steps.length < at) t.steps.push([]);
    // a few real noises ride along with the licks, landing on their beats
    const startsIn = Math.max(0, this.next + (at - t.step) * t.sixteenth - this.t0);
    const beat = (n) => startsIn + n * t.sixteenth;
    try {
      if (kind === 'win') coins(this, beat(2), 14, 0.9);
      if (kind === 'blackjack') { coins(this, beat(4), 12, 0.9); coins(this, beat(16), 40, 2.2); }
      if (kind === 'bust') smash(this, beat(0));
    } catch { /* a failed noise is never fatal */ }
  }

  // ---------- music ----------

  startMusic() {
    if (this.muted || !this.ctx || this.musicTimer) return;
    this.tune = null;
    this.next = this.ctx.currentTime + 0.15;
    this.musicTimer = setInterval(() => this.schedule(), 90);
  }

  stopMusic() {
    clearInterval(this.musicTimer);
    this.musicTimer = null;
  }

  // keep ~0.4 s of notes queued ahead of the audio clock
  schedule() {
    if (this.muted || !this.ctx) return this.stopMusic();
    if (this.ctx.state !== 'running') { this.next = this.ctx.currentTime + 0.1; return; }
    if (this.next < this.ctx.currentTime) this.next = this.ctx.currentTime + 0.05;
    while (this.next < this.ctx.currentTime + 0.4) {
      if (!this.tune || this.tune.step >= this.tune.steps.length) this.tune = makeTune();
      const { steps, step, sixteenth } = this.tune;
      for (const [midi, len, vol, hit] of steps[step]) {
        if (hit === 'tp') this.trumpet(midi, this.next, len * sixteenth, vol, this.hits);
        else this.piano(midi, this.next, len * sixteenth * 1.5, vol, hit ? this.hits : this.music);
      }
      // ragtime is played straight (no swing): every sixteenth the same length
      this.next += sixteenth;
      this.tune.step++;
    }
  }
}

const MUSIC_VOL = 0.22;
const HITS_VOL = 0.6;

// ---------- effect recipes ----------

const FX = {
  // card sliding onto felt: soft brushed noise + a tiny tap
  card(s) {
    s.noise(0.09, 0.32, 2600, 0, 'bandpass', 900, 0.9);
    s.noise(0.03, 0.25, 5200, 0.06, 'highpass', 4000, 0.7);
  },
  flip(s) {
    s.noise(0.06, 0.3, 4200, 0, 'bandpass', 2400, 1.2);
    s.tone('triangle', 900, 620, 0.06, 0.12, 0.03);
  },
  tick(s) {
    s.tone('square', 1400, 1100, 0.035, 0.07);
  },
  on(s) {
    tune(s, [[72, 0], [76, 0.08], [79, 0.16]], 0.5, 0.22);
  },
};

function tune(s, notes, len, vol) {
  for (const [m, d] of notes) s.piano(m, s.t0 + d, len, vol, s.fx);
}

// ---------- random ragtime ----------
// A 16-bar strain in brisk 2/4 (♩=110–130), played straight on a sixteenth-note grid (8 sixteenths per bar):
//   left hand  "oom-pah": octave bass on beats 1 and 2, chord on the off-beats, bass alternating root / fifth
//   right hand syncopated cells (the classic 3+3+2 sixteenths), chord tones with chromatic
//              pick-ups from a semitone below, often doubled a third or sixth underneath
//   harmony    circle-of-fifths dominants (VI7 II7 V7), diminished passing chords, the usual rag moves

// chord tones as semitones above the key's tonic
const CHORDS = {
  I: [0, 4, 7], IV: [5, 9, 12], V7: [7, 11, 14, 17], I7: [0, 4, 7, 10],
  VI7: [9, 13, 16, 19], II7: [2, 6, 9, 12], III7: [4, 8, 11, 14],
  IVm: [5, 8, 12], 'I#dim': [1, 4, 7, 10], 'IV#dim': [6, 9, 12, 15],
};
// 16 bars of 2/4, one chord per bar (rags move about that fast)
const STRAINS = [
  ['I', 'I', 'V7', 'V7', 'V7', 'V7', 'I', 'I', 'I', 'I7', 'IV', 'IV#dim', 'I', 'V7', 'I', 'I'],
  ['I', 'VI7', 'II7', 'V7', 'I', 'VI7', 'II7', 'V7', 'I', 'I7', 'IV', 'IVm', 'I', 'VI7', 'II7', 'V7'],
  ['I', 'I#dim', 'II7', 'V7', 'I', 'III7', 'VI7', 'VI7', 'II7', 'II7', 'V7', 'V7', 'I', 'IV', 'I', 'V7'],
  ['I', 'I', 'IV', 'IV#dim', 'I', 'VI7', 'II7', 'V7', 'I', 'I', 'IV', 'IVm', 'I', 'V7', 'I', 'I'],
];
// right-hand rhythm cells: onsets on the 8 sixteenths of one 2/4 bar
const CELLS = [
  [0, 3, 6],          // 3+3+2: the ragtime "tresillo" push
  [0, 2, 3, 5, 6],    // short-long syncopation
  [1, 3, 4, 6],       // off-beat start
  [0, 1, 2, 3, 4, 6], // running sixteenths into a push
  [0, 3, 4, 7],       // tied over the beat
  [0, 1, 3, 4, 6, 7], // bouncy double pushes
  [0, 2, 3, 4, 6, 7], // busy syncopation
];
const pick = (a) => a[Math.floor(Math.random() * a.length)];

function makeTune() {
  const key = pick([0, 5, 7, 3, 10]); // C F G E♭ B♭ — the keys rags were written in
  const bpm = 110 + Math.floor(Math.random() * 20); // quarter note; a bright, bouncy two-step
  const sixteenth = 60 / bpm / 4;
  const strain = pick(STRAINS);
  // one or two rhythm cells become this rag's motif and keep coming back
  const busy = CELLS.filter((c) => c.length >= 4);
  const motif = [pick(CELLS), pick(busy)];
  const steps = [];
  let mel = 76 + key; // right hand starts around E5
  strain.forEach((deg, bar) => {
    const ch = CHORDS[deg];
    const rootPc = ch[0] % 12;
    const lowRoot = 36 + ((key + rootPc) % 12); // C2..B2
    const fifth = lowRoot + 7;
    // chord tones for the right hand, around C5–C6
    const pool = [];
    for (const pc of ch) for (const o of [60, 72, 84]) {
      const m = o + ((key + pc) % 12);
      if (m >= 69 && m <= 93) pool.push(m);
    }
    const lhChord = ch.slice(0, 3).map((pc) => 55 + ((key + pc - 7 + 24) % 12)); // around G3–F#4
    const cadence = bar % 4 === 3;
    const cell = cadence ? pick([[0, 2, 3, 5, 6], [0, 3, 6], [0, 2, 4, 6, 7]]) : Math.random() < 0.7 ? motif[bar % 2] : pick(CELLS);
    for (let i = 0; i < 8; i++) {
      const notes = [];
      // left hand: oom (octave bass) on the beats, pah (chord) on the off-beats
      // short and springy (staccato) so it bounces
      if (i === 0) notes.push([lowRoot, 1.4, 0.27], [lowRoot + 12, 1.4, 0.15]);
      if (i === 4) notes.push([bar % 2 ? lowRoot : fifth, 1.4, 0.25], [(bar % 2 ? lowRoot : fifth) + 12, 1.4, 0.13]);
      if (i === 2 || i === 6) for (const m of lhChord) notes.push([m, 0.7, 0.11]);
      // right hand
      if (cell.includes(i)) {
        const near = pool.filter((m) => m !== mel && Math.abs(m - mel) <= 5);
        let m = near.length ? pick(near) : pool.reduce((a, b) => (Math.abs(b - mel) < Math.abs(a - mel) ? b : a));
        // chromatic pick-up: hit the semitone below on the previous sixteenth
        if (i > 0 && !cell.includes(i - 1) && Math.random() < 0.45) steps[steps.length - 1].push([m - 1, 0.8, 0.16]);
        mel = m;
        const accent = i === 3 || i === 6 ? 0.08 : 0; // lean on the syncopated push
        const next = cell.find((x) => x > i) ?? 8;
        notes.push([m, Math.min(2, next - i) * 0.75, 0.2 + accent]); // detached, sparkly
        // now and then the right hand jumps to octaves for extra sparkle
        if (accent && Math.random() < 0.35 && m + 12 <= 98) notes.push([m + 12, 1, 0.1]);
        // thicken with a third or sixth below, very ragtime
        if (Math.random() < 0.45) {
          const below = pool.filter((x) => x < m && m - x >= 3 && m - x <= 9);
          if (below.length) notes.push([below[below.length - 1], 1, 0.12]);
        }
      }
      steps.push(notes);
    }
  });
  // end the strain on a held tonic chord before the next rag starts
  steps.push([[36 + key, 3, 0.26], [60 + key, 3, 0.14], [64 + key, 3, 0.14], [67 + key, 3, 0.14], [72 + key, 3, 0.2]]);
  for (let i = 0; i < 3; i++) steps.push([]);
  return { steps, step: 0, sixteenth, key };
}

// ---------- result licks ----------
// Each lick is a list of sixteenth-note steps like the rag's, in the rag's key (k = tonic pitch class).
// Notes are [midi, length in sixteenths, volume, hit] — hit routes them to the louder "hits" bus,
// 'tp' plays them on the trumpet.
const H = (notes, len, vol) => notes.map((m) => [m, len, vol, true]);
const T = (m, len, vol = 0.2) => [m, len, vol, 'tp'];
const rests = (n) => Array.from({ length: n }, () => []);
// a big two-handed chord: octave bass + the chord spread over the right hand
const slam = (k, low, rh, len, vol) => H([36 + k + low, 48 + k + low, ...rh.map((x) => 60 + k + x)], len, vol);
const TONIC = [0, 4, 7, 12, 16, 19]; // C E G C' E' G'
// dissonant clusters: minor seconds and a tritone fighting each other
const SOUR = [0, 1, 6, 11, 13, 18];
const SOURER = [-1, 0, 5, 6, 10, 11];

const LICKS = {
  // tonic chord: BANG . BANG ——— with the trumpet on top (sol → do)
  win: (k) => [[...slam(k, 0, TONIC, 1.5, 0.3), T(67 + k, 1.4)], [], [...slam(k, 0, TONIC, 6, 0.32), T(72 + k, 5)], ...rests(5)],
  // trumpet fanfare over the piano: G G G C | E . G . | C' ——— big C
  blackjack: (k) => [
    [...H([67 + k, 64 + k], 0.8, 0.3), T(67 + k, 0.8)], [], [...H([67 + k, 64 + k], 0.8, 0.3), T(67 + k, 0.8)], [...H([67 + k, 64 + k], 0.8, 0.3), T(67 + k, 0.8)],
    [...slam(k, 0, [0, 4, 12], 3, 0.3), T(72 + k, 3)], [], [], [],
    [...H([76 + k, 72 + k], 1.6, 0.3), T(76 + k, 1.6)], [], [...H([79 + k, 76 + k], 1.6, 0.32), T(79 + k, 1.6)], [],
    [...H([84 + k, 79 + k, 76 + k], 1.6, 0.32), T(84 + k, 1.6)], [], [], [],
    [...slam(k, 0, [...TONIC, 24], 10, 0.32), T(84 + k, 9, 0.22), T(76 + k, 9, 0.14)], [], H([84 + k], 1, 0.22), H([88 + k], 1, 0.22),
    H([91 + k], 1, 0.22), H([96 + k], 6, 0.24), ...rests(10),
  ],
  // dissonant cluster: BANG . BANG ———
  lose: (k) => [slam(k, 0, SOUR, 1.5, 0.28), [], slam(k, -1, SOURER, 6, 0.3), ...rests(5)],
  // a very short sad trumpet tune: sol, fa#, fa … mi♭ over a soft minor chord
  bust: (k) => [
    [T(67 + k, 1.6, 0.18), ...H([36 + k, 48 + k], 6, 0.16)], [], [T(66 + k, 1.6, 0.18)], [], [T(65 + k, 1.6, 0.18)], [],
    [T(63 + k, 6, 0.2), ...H([36 + k, 55 + k, 60 + k, 63 + k], 6, 0.14)], [],
  ],
  // dealer blackjack: a crash across the keyboard, the pianist stops, then starts a new rag
  dealerBJ: (k) => [
    [...slam(k, 0, SOUR, 3, 0.32), ...H([24 + k + 1, 84 + k + 1, 85 + k + 6], 3, 0.24)],
    [], [], slam(k, -1, SOURER, 8, 0.3), ...rests(18),
  ],
};

// ---------- coins and broken glass ----------

// one metallic "ting": a few inharmonic partials that die away fast
function ping(s, f, delay, dur, vol, ratios) {
  for (const [r, lvl] of ratios) s.tone('sine', f * r, f * r * 0.995, dur * (1.2 - r / 12), vol * lvl, delay);
}
const COIN = [[1, 1], [2.76, 0.6], [5.4, 0.35], [8.93, 0.2]];
const GLASS = [[1, 1], [1.47, 0.7], [2.31, 0.5], [3.9, 0.3]];

// a shower of n coins spread over `spread` seconds, landing thicker at the start
function coins(s, at, n, spread) {
  for (let i = 0; i < n; i++) {
    const d = at + spread * Math.pow(Math.random(), 1.6);
    ping(s, 2200 + Math.random() * 2200, d, 0.18 + Math.random() * 0.2, 0.22, COIN);
    s.noise(0.02, 0.18, 7000, d, 'highpass', 6000, 0.7); // the clink of the edge
  }
  // and they pile up with a jingle
  s.noise(0.5, 0.12, 6500, at + spread * 0.4, 'bandpass', 4500, 2);
}

// a bottle smashing: a dull knock, a crack of noise, then shards of glass tinkling down
function smash(s, at) {
  s.tone('sine', 180, 60, 0.12, 0.45, at);
  s.noise(0.06, 0.7, 3000, at, 'highpass', 1500, 0.5);
  s.noise(0.45, 0.35, 5000, at + 0.02, 'bandpass', 2500, 0.6);
  for (let i = 0; i < 26; i++) {
    const d = at + 0.03 + 0.7 * Math.pow(Math.random(), 1.8);
    const v = 0.24 * (1 - (d - at) / 0.9);
    ping(s, 3200 + Math.random() * 4500, d, 0.06 + Math.random() * 0.14, v, GLASS);
    if (i % 3 === 0) s.noise(0.03, v, 8000, d, 'highpass', 6000, 0.7);
  }
}
