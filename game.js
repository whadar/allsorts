(() => {
  'use strict';

  // ---------- Levels ----------
  // criterion: consecutive correct sorts that crack a rule (a [min, max] picks a fresh random number per rule).
  // announce: celebrate a cracked rule (false = silent switch, like the original test).
  // pips: show progress toward cracking in the HUD. guided: tutorial coaching. penalty: points lost per mistake.
  const LEVELS = [
    { id: 0, name: 'Tutorial',       tagline: 'Guided and easy. Skip it if you like.',  criterion: 2,      categories: 2, trials: 12, announce: true,  pips: true,  guided: true,  penalty: 0 },
    { id: 1, name: 'Sweet Start',    tagline: 'Crack three rules. Fanfare included.',   criterion: 4,      categories: 3, trials: 32, announce: true,  pips: true,  guided: false, penalty: 0 },
    { id: 2, name: 'Silent Switch',  tagline: 'Rules change without warning.',          criterion: 4,      categories: 3, trials: 32, announce: false, pips: false, guided: false, penalty: 0 },
    { id: 3, name: 'Shifting Sands', tagline: 'Rules change after 2 to 5 sorts.',       criterion: [2, 5], categories: 4, trials: 32, announce: false, pips: false, guided: false, penalty: 0 },
    { id: 4, name: 'Sweet Six',      tagline: 'Six piles, six colors, six shapes.',     criterion: [2, 5], categories: 4, trials: 32, announce: false, pips: false, guided: false, penalty: 0, piles: 6 },
    // timer: seconds per card at the start, the floor, and how much is shaved off every card.
    { id: 5, name: 'Rush Hour',      tagline: 'Beat the clock. It keeps shrinking.',    criterion: [2, 5], categories: 4, trials: 32, announce: false, pips: false, guided: false, penalty: 0, piles: 6, timer: { start: 6, min: 2.2, step: 0.15 } },
  ];
  const BASE_POINTS = 10;
  const MULT_CAP = 5;
  const CATEGORY_BONUS = 50;
  const SWIPE_COMMIT = 86;
  const FLICK_SPEED = 0.9;
  const DEAD_ZONE = 14;

  // ---------- Sweets ----------
  const COLORS = {
    cherry: { light: '#ffb3c1', base: '#ff3b5c', dark: '#8f0a2e' },
    lime:   { light: '#c6ffdd', base: '#3ddc84', dark: '#0b6b3c' },
    lemon:  { light: '#fff6b8', base: '#ffd23f', dark: '#b06f00' },
    berry:  { light: '#c2dcff', base: '#3a8dff', dark: '#122f8f' },
    orange: { light: '#ffd9b0', base: '#ff8a3d', dark: '#9a3d00' },
    grape:  { light: '#e9cbff', base: '#b14cff', dark: '#5a1596' },
  };
  const COLOR_LIST = ['cherry', 'lime', 'lemon', 'berry', 'orange', 'grape'];
  const SHAPE_LIST = ['gem', 'star', 'heart', 'orb', 'ring', 'tri'];
  // Pile layouts on the 3x3 board grid: four on the sides, or six on the corners and sides.
  const LAYOUTS = {
    4: [{ dir: 'up', area: '1 / 2', vec: [0, -1] }, { dir: 'left', area: '2 / 1', vec: [-1, 0] }, { dir: 'right', area: '2 / 3', vec: [1, 0] }, { dir: 'down', area: '3 / 2', vec: [0, 1] }],
    6: [{ dir: 'up-left', area: '1 / 1', vec: [-1, -1] }, { dir: 'up-right', area: '1 / 3', vec: [1, -1] }, { dir: 'left', area: '2 / 1', vec: [-1, 0] },
        { dir: 'right', area: '2 / 3', vec: [1, 0] }, { dir: 'down-left', area: '3 / 1', vec: [-1, 1] }, { dir: 'down-right', area: '3 / 3', vec: [1, 1] }],
  };
  let LAYOUT = LAYOUTS[4];
  let DIRS = LAYOUT.map(l => l.dir);
  let KEYS = DIRS.map((dir, i) => ({ dir, color: COLOR_LIST[i], shape: SHAPE_LIST[i], count: i + 1 }));
  const unitVec = dir => { const [x, y] = LAYOUT.find(l => l.dir === dir).vec; const n = Math.hypot(x, y); return [x / n, y / n]; };
  const RULES = ['color', 'shape', 'count'];
  const RULE_WORD = { color: 'COLOR', shape: 'SHAPE', count: 'NUMBER' };

  const STAR = '50,4 61.2,34.6 93.8,35.8 68.1,55.9 77,87.2 50,69 23,87.2 31.9,55.9 6.2,35.8 38.8,34.6';
  const HEART = 'M50 90 C22 68 4 50 10 30 C15 13 38 9 50 27 C62 9 85 13 90 30 C96 50 78 68 50 90 Z';
  const GEM = '50,5 88,38 50,96 12,38';
  const SHAPES = {
    orb: (c, k) => `
      <ellipse cx="52" cy="95" rx="34" ry="6" fill="#000" opacity=".2"/>
      <circle cx="50" cy="52" r="40" fill="url(#g-${c})"/>
      <circle cx="50" cy="52" r="40" fill="url(#shade)"/>
      <circle cx="50" cy="52" r="40" fill="none" stroke="${k.dark}" stroke-opacity=".7" stroke-width="3"/>
      <ellipse cx="37" cy="33" rx="15" ry="9" fill="url(#gloss)" transform="rotate(-28 37 33)"/>
      <circle cx="29" cy="49" r="3.5" fill="#fff" opacity=".85"/>
      <path d="M24 70 Q50 95 76 70" fill="none" stroke="#fff" stroke-opacity=".35" stroke-width="3" stroke-linecap="round"/>`,
    gem: (c, k) => `
      <ellipse cx="52" cy="97" rx="26" ry="5" fill="#000" opacity=".2"/>
      <polygon points="${GEM}" fill="url(#g-${c})"/>
      <polygon points="50,5 88,38 12,38" fill="#fff" opacity=".2"/>
      <polygon points="50,5 32,38 68,38" fill="#fff" opacity=".42"/>
      <polygon points="12,38 32,38 50,96" fill="#fff" opacity=".12"/>
      <polygon points="68,38 88,38 50,96" fill="#000" opacity=".2"/>
      <polygon points="32,38 68,38 50,96" fill="#000" opacity=".06"/>
      <polygon points="${GEM}" fill="url(#shade)" opacity=".7"/>
      <polygon points="50,11 58,24 42,24" fill="#fff" opacity=".9"/>
      <line x1="12" y1="38" x2="88" y2="38" stroke="#fff" stroke-opacity=".5" stroke-width="1.5"/>
      <polygon points="${GEM}" fill="none" stroke="${k.dark}" stroke-opacity=".75" stroke-width="3" stroke-linejoin="round"/>`,
    star: (c, k) => `
      <ellipse cx="52" cy="91" rx="32" ry="6" fill="#000" opacity=".2"/>
      <polygon points="${STAR}" fill="url(#g-${c})" stroke-linejoin="round"/>
      <polygon points="${STAR}" fill="url(#shade)"/>
      <polygon points="${STAR}" fill="none" stroke="${k.dark}" stroke-opacity=".75" stroke-width="3" stroke-linejoin="round"/>
      <polygon points="50,14 56,33 44,33" fill="#fff" opacity=".6"/>
      <ellipse cx="40" cy="46" rx="9" ry="5" fill="url(#gloss)" transform="rotate(-30 40 46)"/>
      <circle cx="33" cy="41" r="2.5" fill="#fff" opacity=".9"/>`,
    heart: (c, k) => `
      <ellipse cx="52" cy="93" rx="30" ry="6" fill="#000" opacity=".2"/>
      <path d="${HEART}" fill="url(#g-${c})"/>
      <path d="${HEART}" fill="url(#shade)"/>
      <path d="${HEART}" fill="none" stroke="${k.dark}" stroke-opacity=".75" stroke-width="3" stroke-linejoin="round"/>
      <ellipse cx="33" cy="33" rx="12" ry="7" fill="url(#gloss)" transform="rotate(-32 33 33)"/>
      <circle cx="26" cy="45" r="3" fill="#fff" opacity=".85"/>
      <path d="M32 68 Q50 90 66 70" fill="none" stroke="#fff" stroke-opacity=".3" stroke-width="3" stroke-linecap="round"/>`,
    ring: (c, k) => `
      <ellipse cx="52" cy="95" rx="34" ry="6" fill="#000" opacity=".2"/>
      <path d="M50 10 A40 40 0 1 0 50 90 A40 40 0 1 0 50 10 Z M50 34 A16 16 0 1 1 50 66 A16 16 0 1 1 50 34 Z" fill="url(#g-${c})" fill-rule="evenodd"/>
      <path d="M50 10 A40 40 0 1 0 50 90 A40 40 0 1 0 50 10 Z M50 34 A16 16 0 1 1 50 66 A16 16 0 1 1 50 34 Z" fill="url(#shade)" fill-rule="evenodd"/>
      <circle cx="50" cy="50" r="40" fill="none" stroke="${k.dark}" stroke-opacity=".7" stroke-width="3"/>
      <circle cx="50" cy="50" r="16" fill="none" stroke="${k.dark}" stroke-opacity=".5" stroke-width="2.5"/>
      <ellipse cx="34" cy="26" rx="12" ry="6" fill="url(#gloss)" transform="rotate(-35 34 26)"/>
      <circle cx="26" cy="42" r="3" fill="#fff" opacity=".85"/>`,
    tri: (c, k) => `
      <ellipse cx="52" cy="94" rx="34" ry="6" fill="#000" opacity=".2"/>
      <polygon points="50,10 92,86 8,86" fill="url(#g-${c})" stroke="url(#g-${c})" stroke-width="10" stroke-linejoin="round"/>
      <polygon points="50,10 92,86 8,86" fill="url(#shade)" stroke="url(#shade)" stroke-width="10" stroke-linejoin="round"/>
      <polygon points="50,10 92,86 8,86" fill="none" stroke="${k.dark}" stroke-opacity=".75" stroke-width="3" stroke-linejoin="round"/>
      <polygon points="50,22 60,42 40,42" fill="#fff" opacity=".55"/>
      <ellipse cx="38" cy="52" rx="8" ry="4" fill="url(#gloss)" transform="rotate(-30 38 52)"/>
      <circle cx="34" cy="62" r="2.5" fill="#fff" opacity=".9"/>`,
  };
  const PIP_LAYOUT = {
    1: [[50, 50]], 2: [[50, 30], [50, 70]], 3: [[30, 26], [50, 50], [70, 74]], 4: [[31, 30], [69, 30], [31, 70], [69, 70]],
    5: [[28, 28], [72, 28], [50, 50], [28, 72], [72, 72]], 6: [[32, 22], [68, 22], [32, 50], [68, 50], [32, 78], [68, 78]],
  };
  const PIP_SIZE = { 1: 60, 2: 42, 3: 38, 4: 40, 5: 34, 6: 30 };

  (function installDefs() {
    const grads = Object.entries(COLORS).map(([name, c]) => `
      <radialGradient id="g-${name}" cx="35%" cy="28%" r="78%">
        <stop offset="0" stop-color="${c.light}"/><stop offset=".42" stop-color="${c.base}"/><stop offset="1" stop-color="${c.dark}"/>
      </radialGradient>`).join('');
    const svg = document.createElementNS('http://www.w3.org/2000/svg', 'svg');
    svg.setAttribute('width', '0'); svg.setAttribute('height', '0');
    svg.style.position = 'absolute';
    svg.innerHTML = `<defs>${grads}
      <linearGradient id="gloss" x1="0" y1="0" x2="0" y2="1"><stop offset="0" stop-color="#fff" stop-opacity=".95"/><stop offset="1" stop-color="#fff" stop-opacity="0"/></linearGradient>
      <filter id="bevel" x="-25%" y="-25%" width="150%" height="150%" color-interpolation-filters="sRGB">
        <feGaussianBlur in="SourceAlpha" stdDeviation="3.5" result="blur"/>
        <feSpecularLighting in="blur" surfaceScale="7" specularConstant=".8" specularExponent="16" lighting-color="#fff" result="spec"><fePointLight x="28" y="8" z="110"/></feSpecularLighting>
        <feComposite in="spec" in2="SourceAlpha" operator="in" result="specIn"/>
        <feComposite in="SourceGraphic" in2="specIn" operator="arithmetic" k1="0" k2="1" k3=".9" k4="0"/>
      </filter>
      <radialGradient id="shade" cx="50%" cy="45%" r="58%"><stop offset="0" stop-color="#000" stop-opacity="0"/><stop offset=".62" stop-color="#000" stop-opacity="0"/><stop offset="1" stop-color="#000" stop-opacity=".42"/></radialGradient>
    </defs>`;
    document.body.prepend(svg);
  })();
  // WebKit (every iOS browser, and Safari on Mac) rasterizes SVG lighting filters at low
  // resolution inside backdrop-filtered tiles and sometimes drops them entirely, so the
  // bevel light is only used elsewhere. The gradients and gloss carry the look on their own.
  const UA = navigator.userAgent;
  const IOS = /iP(hone|ad|od)/.test(UA) || (navigator.platform === 'MacIntel' && navigator.maxTouchPoints > 1);
  const SAFARI = /Safari/.test(UA) && !/Chrome|Chromium|CriOS|Edg|OPR|Android/.test(UA);
  const USE_BEVEL = false; // the lighting filter rasterized the vectors and looked soft, see style.css
  if (IOS || SAFARI) document.documentElement.classList.add("webkit");
  // Foreground sweets get the bevel light; background ones stay cheap.
  const sweetSVG = (shape, color, cls = 'pip__svg') => {
    const body = SHAPES[shape](color, COLORS[color]);
    return `<svg class="${cls}" viewBox="0 0 100 100" shape-rendering="geometricPrecision">${cls && USE_BEVEL ? `<g filter="url(#bevel)">${body}</g>` : body}</svg>`;
  };
  function pipsHTML(card) {
    const size = PIP_SIZE[card.count];
    return PIP_LAYOUT[card.count].map(([x, y], i) =>
      `<span class="pip" style="left:${x}%;top:${y}%;width:${size}%;--i:${i}">${sweetSVG(card.shape, card.color)}</span>`).join('');
  }
  const describe = c => `${c.count} ${c.color} ${c.shape}${c.count > 1 ? 's' : ''}`;
  const STAR_ICON = '<svg class="star" viewBox="0 0 24 24" aria-hidden="true"><path d="M12 2l3 6.6 7 .8-5.2 4.9 1.4 7.1L12 18l-6.2 3.4 1.4-7.1L2 9.4l7-.8z"/></svg>';

  function buildDeck() {
    const deck = [];
    const N = KEYS.length;
    for (let c = 0; c < N; c++) for (let s = 0; s < N; s++) for (let n = 0; n < N; n++) {
      if (c === s || s === n || c === n) continue;
      deck.push({ color: COLOR_LIST[c], shape: SHAPE_LIST[s], count: n + 1 });
    }
    return shuffle(deck);
  }
  const sameCard = (a, b) => a.color === b.color && a.shape === b.shape && a.count === b.count;

  // ---------- Utilities ----------
  const $ = id => document.getElementById(id);
  const el = {
    score: $('score'), multi: $('multi'), pips: $('pips'), streakNum: $('streak-num'), stars: $('stars'), cardsLeft: $('cards-left'),
    progress: $('progress'), mute: $('mute'), timeStat: $('time-stat'), time: $('time'), timer: $('timer'), timerRect: $('timer-rect'), hud: document.querySelector('.hud'), levelChip: $('level-chip'), ruleChip: $('rule-chip'),
    table: $('table'), coach: $('coach'), coachText: $('coach-text'),
    board: $('board'), center: $('center'), wrap: $('card-wrap'), toast: $('toast'), toastTxt: $('toast-txt'),
    startOverlay: $('start-overlay'), levelsOverlay: $('levels-overlay'), levels: $('levels'), hero: $('hero'),
    playBtn: $('play-btn'), playHint: $('play-hint'), levelsOpen: $('levels-open'), levelsBack: $('levels-back'),
    shuffleBtn: $('shuffle-btn'), shuffleChip: $('shuffle-chip'),
    endOverlay: $('end-overlay'), endEyebrow: $('end-eyebrow'), endTitle: $('end-title'), endStars: $('end-stars'),
    endRank: $('end-rank'), endUnlock: $('end-unlock'), endResults: $('end-results'), hint: document.querySelector('.hint'),
    nextBtn: $('next-btn'), againBtn: $('again-btn'), levelsBtn: $('levels-btn'), shareBtn: $('share-btn'),
  };
  let targets = {}, cues = {};
  const reduceMotion = window.matchMedia('(prefers-reduced-motion: reduce)').matches;
  const D = ms => (reduceMotion ? 0 : ms);
  const wait = ms => new Promise(r => setTimeout(r, ms));
  const clamp = (v, a, b) => Math.max(a, Math.min(b, v));
  const rand = arr => arr[Math.floor(Math.random() * arr.length)];
  const randInt = (a, b) => a + Math.floor(Math.random() * (b - a + 1));
  const pick = (arr, avoid) => { let c = rand(arr); if (arr.length > 1 && c === avoid) c = arr[(arr.indexOf(c) + 1) % arr.length]; return c; };
  function shuffle(arr) {
    for (let i = arr.length - 1; i > 0; i--) { const j = Math.floor(Math.random() * (i + 1)); [arr[i], arr[j]] = [arr[j], arr[i]]; }
    return arr;
  }
  const buzz = pattern => { try { if (navigator.vibrate && navigator.userActivation?.hasBeenActive) navigator.vibrate(pattern); } catch (e) { /* optional */ } };
  function replay(node, cls) { node.classList.remove(cls); void node.offsetWidth; node.classList.add(cls); }
  function shake(big = false) {
    if (reduceMotion) return;
    el.table.classList.remove('shake', 'shake-big');
    void el.table.offsetWidth;
    el.table.classList.add(big ? 'shake-big' : 'shake');
  }

  // ---------- Settings ----------
  const settings = { shuffle: localStorage.getItem('sweetsort-shuffle') === 'on' };

  // ---------- Progress (unlocks + best scores) ----------
  const progress = (() => {
    const p = { unlocked: 1, best: {}, last: 1 };
    try { Object.assign(p, JSON.parse(localStorage.getItem('sweetsort-progress') || '{}')); } catch (e) { /* fresh */ }
    if (location.search.includes('unlock')) p.unlocked = LEVELS.length - 1;
    const save = () => { try { localStorage.setItem('sweetsort-progress', JSON.stringify(p)); } catch (e) { /* private mode */ } };
    return { p, save };
  })();

  // ---------- Sound ----------
  const sound = {
    enabled: localStorage.getItem('sweetsort-sound') !== 'off',
    ctx: null, noiseBuf: null,
    ensure() {
      if (!this.ctx) {
        const AC = window.AudioContext || window.webkitAudioContext;
        if (!AC) return false;
        this.ctx = new AC();
        const n = Math.floor(this.ctx.sampleRate * 0.4);
        this.noiseBuf = this.ctx.createBuffer(1, n, this.ctx.sampleRate);
        const d = this.noiseBuf.getChannelData(0);
        for (let i = 0; i < n; i++) d[i] = Math.random() * 2 - 1;
      }
      if (this.ctx.state === 'suspended') this.ctx.resume();
      return true;
    },
    tone(freq, dur, type = 'sine', vol = 0.06, delay = 0, slide = 0) {
      if (!this.enabled) return;
      try {
        if (!this.ensure()) return;
        const t = this.ctx.currentTime + delay;
        const o = this.ctx.createOscillator(), g = this.ctx.createGain();
        o.type = type; o.frequency.setValueAtTime(freq, t);
        if (slide) o.frequency.exponentialRampToValueAtTime(slide, t + dur);
        g.gain.setValueAtTime(0.0001, t);
        g.gain.exponentialRampToValueAtTime(vol, t + 0.012);
        g.gain.exponentialRampToValueAtTime(0.0001, t + dur);
        o.connect(g).connect(this.ctx.destination);
        o.start(t); o.stop(t + dur + 0.05);
      } catch (e) { /* audio is a nicety */ }
    },
    noise(dur = 0.08, vol = 0.05, freq = 1800, delay = 0) {
      if (!this.enabled) return;
      try {
        if (!this.ensure()) return;
        const t = this.ctx.currentTime + delay;
        const src = this.ctx.createBufferSource(); src.buffer = this.noiseBuf;
        const f = this.ctx.createBiquadFilter(); f.type = 'bandpass'; f.frequency.value = freq; f.Q.value = 0.9;
        const g = this.ctx.createGain();
        g.gain.setValueAtTime(vol, t); g.gain.exponentialRampToValueAtTime(0.0001, t + dur);
        src.connect(f).connect(g).connect(this.ctx.destination);
        src.start(t); src.stop(t + dur + 0.02);
      } catch (e) { /* optional */ }
    },
    chime(freq, dur = 0.35, vol = 0.06, delay = 0) {
      this.tone(freq, dur, 'sine', vol, delay);
      this.tone(freq * 2, dur * 0.6, 'sine', vol * 0.35, delay);
      this.tone(freq * 3, dur * 0.35, 'triangle', vol * 0.1, delay);
    },
    pop()   { this.noise(0.06, 0.06, 900); this.tone(600, 0.08, 'sine', 0.04, 0, 1000); },
    tick()  { this.noise(0.025, 0.035, 3000); },
    good(streak = 1) {
      const f = 523 * Math.pow(2, (Math.min(streak, 9) - 1) * 2 / 12);
      this.chime(f, 0.3, 0.06); this.chime(f * 1.5, 0.32, 0.04, 0.07); this.noise(0.05, 0.03, 2600);
    },
    bad()   { this.tone(200, 0.2, 'triangle', 0.06, 0, 120); this.noise(0.14, 0.045, 450); },
    ouch()  { this.tone(260, 0.28, 'sawtooth', 0.04, 0, 90); this.noise(0.2, 0.05, 300); },
    back()  { this.tone(400, 0.08, 'sine', 0.03, 0, 300); },
    level() { [523, 659, 784, 1047, 1319].forEach((f, i) => this.chime(f, 0.42, 0.06, i * 0.07)); this.noise(0.35, 0.05, 1500, 0.3); },
    win()   { [523, 659, 784, 1047, 1319, 1568].forEach((f, i) => this.chime(f, 0.5, 0.06, i * 0.11)); },
    star()  { this.chime(1568, 0.3, 0.05); this.noise(0.08, 0.03, 4000); },
    whoosh() { this.noise(0.22, 0.035, 700); this.tone(300, 0.2, 'sine', 0.015, 0, 900); },
    shuffle() { this.noise(0.12, 0.05, 1400); this.noise(0.1, 0.045, 900, 0.07); this.noise(0.08, 0.04, 1800, 0.14); },
    ready() { this.tone(880, 0.05, 'sine', 0.03); this.tone(1320, 0.06, 'sine', 0.03, 0.04); },
    count() { this.tone(1400 + Math.random() * 300, 0.03, 'square', 0.012); },
    toggle() {
      this.enabled = !this.enabled;
      localStorage.setItem('sweetsort-sound', this.enabled ? 'on' : 'off');
      el.mute.textContent = this.enabled ? '🔊' : '🔇';
      if (this.enabled) this.pop();
    },
  };
  el.mute.textContent = sound.enabled ? '🔊' : '🔇';
  el.mute.addEventListener('click', () => sound.toggle());

  // ---------- Announcer: pre-rendered clips, browser speech as a fallback ----------
  const CLIPS = ['sweet', 'tasty', 'delicious', 'divine', 'rule-cracked', 'sweet-victory', 'level-up', 'tutorial-complete'];
  const voice = {
    enabled: localStorage.getItem('sweetsort-voice') !== 'off',
    clips: {}, picked: null, loaded: false,
    load() {
      if (this.loaded) return;
      this.loaded = true;
      for (const n of CLIPS) {
        const a = new Audio(`voice/${n}.m4a`);
        a.preload = 'auto'; a.volume = 0.95;
        a.addEventListener('error', () => { this.clips[n] = null; });
        this.clips[n] = a;
      }
    },
    say(text, key) {
      if (!this.enabled || !sound.enabled) return;
      const k = key || text.toLowerCase().replace(/[^a-z ]/g, '').trim().replace(/\s+/g, '-');
      const a = this.clips[k];
      if (a && !a.error) {
        try { a.currentTime = 0; const p = a.play(); if (p) p.catch(() => this.speak(text)); return; } catch (e) { /* fall through */ }
      }
      this.speak(text);
    },
    pickVoice() {
      if (!('speechSynthesis' in window)) return null;
      const voices = speechSynthesis.getVoices();
      const en = voices.filter(v => /^en/i.test(v.lang));
      const quality = en.find(v => /natural|premium|enhanced/i.test(v.name));
      if (quality) return quality;
      for (const name of ['Google US English', 'Google UK English Male', 'Daniel', 'Samantha', 'Alex', 'Microsoft Guy', 'Microsoft David']) {
        const v = en.find(v => v.name.startsWith(name)); if (v) return v;
      }
      return en[0] || voices[0] || null;
    },
    speak(text) {
      if (!('speechSynthesis' in window)) return;
      try {
        if (!this.picked) this.picked = this.pickVoice();
        speechSynthesis.cancel();
        const u = new SpeechSynthesisUtterance(text.replace(/[!.]/g, ''));
        if (this.picked) u.voice = this.picked;
        u.pitch = 0.8; u.rate = 0.95; u.volume = 1;
        speechSynthesis.speak(u);
      } catch (e) { /* optional */ }
    },
  };
  if ('speechSynthesis' in window) speechSynthesis.addEventListener('voiceschanged', () => { voice.picked = voice.pickVoice(); });

  // ---------- Particles ----------
  const fx = (() => {
    const cv = $('fx');
    const ctx = cv.getContext('2d');
    const palette = ['#f472b6', '#fde047', '#4ade80', '#60a5fa', '#c084fc', '#fff'];
    let parts = [], raf = 0;
    function resize() {
      const dpr = Math.min(window.devicePixelRatio || 1, 2);
      cv.width = Math.floor(innerWidth * dpr); cv.height = Math.floor(innerHeight * dpr);
      ctx.setTransform(dpr, 0, 0, dpr, 0, 0);
    }
    window.addEventListener('resize', resize);
    resize();
    function sparks(x, y, n = 26, color, power = 1) {
      if (reduceMotion) return;
      for (let i = 0; i < n; i++) {
        const a = Math.random() * Math.PI * 2, sp = (2 + Math.random() * 6) * power;
        parts.push({ kind: Math.random() < 0.35 ? 'star' : 'spark', x, y, vx: Math.cos(a) * sp, vy: Math.sin(a) * sp - 1, g: 0.08,
          r: 2 + Math.random() * 3, rot: Math.random() * Math.PI, vr: (Math.random() - 0.5) * 0.4,
          c: color || rand(palette), life: 1, decay: 0.02 + Math.random() * 0.02 });
      }
      if (!raf) raf = requestAnimationFrame(tick);
    }
    function confetti(x, y, n = 90, spread = 1) {
      if (reduceMotion) return;
      for (let i = 0; i < n; i++) {
        parts.push({ kind: 'confetti', x, y, vx: (Math.random() - 0.5) * 16 * spread, vy: -Math.random() * 13 - 5, g: 0.36,
          w: 6 + Math.random() * 6, h: 4 + Math.random() * 6, rot: Math.random() * Math.PI, vr: (Math.random() - 0.5) * 0.3,
          round: Math.random() < 0.4, c: rand(palette), life: 1, decay: 0.008 + Math.random() * 0.008 });
      }
      if (!raf) raf = requestAnimationFrame(tick);
    }
    function tick() {
      ctx.clearRect(0, 0, innerWidth, innerHeight);
      parts = parts.filter(p => p.life > 0);
      for (const p of parts) {
        p.vy += p.g; p.x += p.vx; p.y += p.vy; p.vx *= 0.98; p.life -= p.decay;
        ctx.save();
        ctx.globalAlpha = clamp(p.life * 1.4, 0, 1);
        ctx.fillStyle = p.c;
        ctx.translate(p.x, p.y);
        if (p.kind === 'spark') {
          ctx.shadowColor = p.c; ctx.shadowBlur = 8;
          ctx.beginPath(); ctx.arc(0, 0, Math.max(0, p.r * p.life), 0, Math.PI * 2); ctx.fill();
        } else if (p.kind === 'star') {
          p.rot += p.vr; ctx.rotate(p.rot);
          const R = Math.max(0, p.r * 2.2 * p.life), r = R * 0.38;
          ctx.shadowColor = p.c; ctx.shadowBlur = 6;
          ctx.beginPath();
          for (let i = 0; i < 8; i++) { const rad = i % 2 ? r : R, a = i * Math.PI / 4; ctx.lineTo(Math.cos(a) * rad, Math.sin(a) * rad); }
          ctx.closePath(); ctx.fill();
        } else {
          p.rot += p.vr; ctx.rotate(p.rot);
          if (p.round) { ctx.beginPath(); ctx.arc(0, 0, p.w / 2, 0, Math.PI * 2); ctx.fill(); }
          else ctx.fillRect(-p.w / 2, -p.h / 2, p.w, p.h);
        }
        ctx.restore();
      }
      raf = parts.length ? requestAnimationFrame(tick) : 0;
    }
    return { sparks, confetti };
  })();

  // ---------- Build the world ----------
  (function floatingSweets() {
    if (reduceMotion) return;
    let html = '';
    for (let i = 0; i < 14; i++) {
      const size = 26 + Math.random() * 54;
      html += `<span class="bg-candy" style="left:${Math.random() * 100}%;top:${Math.random() * 100}%;width:${size}px;` +
        `--d:${10 + Math.random() * 12}s;--delay:${-Math.random() * 20}s;--r:${Math.random() * 60 - 30}deg;opacity:${(0.14 + Math.random() * 0.18).toFixed(2)}">` +
        `${sweetSVG(rand(SHAPE_LIST), rand(COLOR_LIST), '')}</span>`;
    }
    $('bg-candies').innerHTML = html;
  })();
  function buildBoard(n) {
    LAYOUT = LAYOUTS[n] || LAYOUTS[4];
    DIRS = LAYOUT.map(l => l.dir);
    KEYS = DIRS.map((dir, i) => ({ dir, color: COLOR_LIST[i], shape: SHAPE_LIST[i], count: i + 1 }));
    el.board.querySelectorAll('.target').forEach(t => t.remove());
    el.center.querySelectorAll('.cue').forEach(c => c.remove());
    targets = {}; cues = {};
    LAYOUT.forEach((l, i) => {
      const [ux, uy] = unitVec(l.dir);
      const ang = Math.atan2(uy, ux) * 180 / Math.PI;
      const t = document.createElement('div');
      t.className = 'target';
      t.dataset.dir = l.dir;
      t.setAttribute('role', 'img');
      t.setAttribute('aria-label', `${l.dir} pile: ${describe(KEYS[i])}`);
      t.style.gridArea = l.area;
      t.style.setProperty('--i', i);
      t.style.setProperty('--lx', (-ux).toFixed(3));
      t.style.setProperty('--ly', (-uy).toFixed(3));
      t.innerHTML = `<span class="ring"></span><span class="pips-area">${pipsHTML(KEYS[i])}</span>` +
        `<span class="chev" style="left:${50 - ux * 50}%;top:${50 - uy * 50}%;transform:translate(-50%,-50%) rotate(${ang - 45}deg)"></span>`;
      el.board.insertBefore(t, el.center);
      targets[l.dir] = t;
      const c = document.createElement('span');
      c.className = 'cue';
      c.style.cssText = `left:${50 + ux * 62}%;top:${50 + uy * 60}%;transform:translate(-50%,-50%) rotate(${ang - 45}deg);animation-delay:${(i * 0.3).toFixed(1)}s`;
      el.center.appendChild(c);
      cues[l.dir] = c;
    });
    el.hint.textContent = `Slide the card toward a pile · or press 1 to ${DIRS.length}`;
  }
  buildBoard(4);

  // Shuffle mode: every turn the piles get a fresh random pairing of color, shape and count,
  // so no pile is "the one-gem pile" for long, and the key cards swap places.
  const permutation = n => shuffle([...Array(n).keys()]);
  function reshuffleKeys(animate = true) {
    const n = DIRS.length;
    const pc = permutation(n), ps = permutation(n), pn = permutation(n);
    KEYS = DIRS.map((dir, i) => ({ dir, color: COLOR_LIST[pc[i]], shape: SHAPE_LIST[ps[i]], count: pn[i] + 1 }));
    const apply = () => DIRS.forEach((d, i) => {
      targets[d].querySelector('.pips-area').innerHTML = pipsHTML(KEYS[i]);
      targets[d].setAttribute('aria-label', `${d} pile: ${describe(KEYS[i])}`);
    });
    if (!animate || reduceMotion) { apply(); return; }
    DIRS.forEach(d => replay(targets[d], 'reshuffle'));
    sound.shuffle();
    setTimeout(apply, D(150));
  }
  // A card whose color, shape and count each point at a different pile under the current keys.
  function randomCard(avoid) {
    const n = KEYS.length;
    let card;
    for (let tries = 0; tries < 30; tries++) {
      const p = permutation(n);
      card = { color: KEYS[p[0]].color, shape: KEYS[p[1]].shape, count: KEYS[p[2]].count };
      if (!avoid || !sameCard(card, avoid)) break;
    }
    return card;
  }
  function renderShuffle() {
    el.shuffleBtn.setAttribute('aria-pressed', String(settings.shuffle));
    el.shuffleBtn.textContent = `🔀 Shuffle: ${settings.shuffle ? 'On' : 'Off'}`;
    el.shuffleChip.textContent = settings.shuffle ? '🔀 Shuffle' : '';
  }
  el.shuffleBtn.addEventListener('click', () => {
    settings.shuffle = !settings.shuffle;
    localStorage.setItem('sweetsort-shuffle', settings.shuffle ? 'on' : 'off');
    sound.pop();
    renderShuffle();
  });
  renderShuffle();
  const pipDots = [];
  el.stars.innerHTML = STAR_ICON.repeat(6);
  el.endStars.innerHTML = STAR_ICON.repeat(6);
  const starEls = Array.from(el.stars.querySelectorAll('.star'));
  const endStarEls = Array.from(el.endStars.querySelectorAll('.star'));

  // Big sweets drifting around the splash title.
  (function buildHero() {
    const spots = [[14, 20, 120, -14], [84, 16, 96, 12], [8, 62, 88, 18], [90, 60, 130, -10], [26, 88, 72, 6], [72, 90, 84, -22], [50, 6, 64, 0]];
    el.hero.innerHTML = spots.map(([x, y, s, r], i) =>
      `<span class="hero-sweet" style="left:${x}%;top:${y}%;width:${s}px;--r:${r}deg;--d:${(3.2 + i * 0.45).toFixed(2)}s;--delay:${(-i * 0.7).toFixed(2)}s">${sweetSVG(SHAPE_LIST[i % SHAPE_LIST.length], COLOR_LIST[(i * 5) % COLOR_LIST.length])}</span>`).join('') +
      [[22, 40], [78, 34], [40, 78], [66, 14], [12, 86]].map(([x, y], i) => `<i class="hero-spark" style="left:${x}%;top:${y}%;--delay:${(i * 0.5).toFixed(1)}s"></i>`).join('');
  })();
  const playTarget = () => (Object.keys(progress.p.best).length ? clamp(progress.p.last, 0, LEVELS.length - 1) : 0);
  function renderPlayHint() {
    const l = LEVELS[playTarget()];
    el.playHint.textContent = l.id === 0 ? 'Start with the tutorial' : `Level ${l.id} · ${l.name}`;
  }
  function showSplash() {
    document.body.classList.add('menu');
    renderPlayHint();
    el.endOverlay.classList.add('hidden');
    el.levelsOverlay.classList.add('hidden');
    el.startOverlay.classList.remove('hidden');
  }
  function renderLevels() {
    const p = progress.p;
    el.levels.innerHTML = LEVELS.map(l => {
      const locked = false; // every level is open
      const best = p.best[l.id];
      return `<button class="level" data-id="${l.id}" ${locked ? 'disabled' : ''}>
        <span class="level__num">${l.id === 0 ? '✎' : l.id}</span>
        <span class="level__body"><span class="level__name">${l.name}</span><span class="level__tag">${l.tagline}</span></span>
        <span class="level__meta">${locked ? '🔒' : best ? `★ ${best}` : 'New'}</span>
      </button>`;
    }).join('');
  }
  el.levels.addEventListener('click', e => {
    const b = e.target.closest('.level');
    if (b && !b.disabled) startGame(Number(b.dataset.id));
  });

  // ---------- HUD ----------
  let shownScore = 0, scoreRaf = 0, scoreSettle = 0;
  function tweenScore(to) {
    cancelAnimationFrame(scoreRaf); clearTimeout(scoreSettle);
    const from = shownScore, t0 = performance.now(), dur = D(450) || 1;
    const step = t => {
      const k = Math.min(1, (t - t0) / dur);
      shownScore = Math.round(from + (to - from) * (1 - Math.pow(1 - k, 3)));
      el.score.textContent = shownScore;
      if (k < 1) scoreRaf = requestAnimationFrame(step);
    };
    scoreRaf = requestAnimationFrame(step);
    scoreSettle = setTimeout(() => { cancelAnimationFrame(scoreRaf); shownScore = to; el.score.textContent = to; }, dur + 60);
  }
  function buildPips() {
    el.pips.innerHTML = '';
    pipDots.length = 0;
    const n = Array.isArray(L.criterion) ? 0 : L.criterion;
    for (let i = 0; i < n; i++) { const d = document.createElement('span'); d.className = 'pip-dot'; el.pips.appendChild(d); pipDots.push(d); }
    el.hud.classList.toggle('no-pips', !L.pips);
  }
  function renderPips(burst = false) {
    pipDots.forEach((d, i) => {
      if (burst) { d.classList.remove('lit'); replay(d, 'burst'); d.addEventListener('animationend', () => d.classList.remove('burst'), { once: true }); return; }
      const lit = i < S.run;
      if (lit && !d.classList.contains('lit')) replay(d, 'lit');
      else if (!lit) d.classList.remove('lit');
    });
    const txt = S.streak >= 3 ? `${S.streak} 🔥` : String(S.streak);
    if (el.streakNum.textContent !== txt) { el.streakNum.textContent = txt; replay(el.streakNum, 'bump'); }
  }
  function renderMulti() {
    const m = Math.min(S.streak, MULT_CAP);
    if (m >= 2) {
      const text = `×${m}`;
      if (el.multi.textContent !== text || !el.multi.classList.contains('on')) { el.multi.textContent = text; replay(el.multi, 'on'); }
    } else el.multi.classList.remove('on');
  }
  function renderStars(celebrate = false, shown = S.categories) {
    starEls.forEach((s, i) => {
      s.style.display = i < L.categories ? '' : 'none';
      const lit = i < shown;
      if (lit && !s.classList.contains('lit')) {
        s.classList.add('lit');
        if (celebrate) {
          replay(s, 'pop');
          const r = s.getBoundingClientRect();
          fx.sparks(r.left + r.width / 2, r.top + r.height / 2, 18, '#fde047', 0.7);
        }
      } else if (!lit) s.classList.remove('lit', 'pop');
    });
  }
  function renderHUD() {
    if (shownScore !== S.score) { tweenScore(S.score); replay(el.score, 'bump'); }
    renderMulti();
    el.cardsLeft.textContent = L.trials - S.trials;
    // Cards used, or rules cracked on levels that announce them (silent levels would leak the switch).
    let p = S.trials / L.trials;
    if (L.announce) p = Math.max(p, (S.categories + Math.min(S.run / S.criterion, 0.99)) / L.categories);
    el.progress.style.width = `${(S.over ? 1 : Math.min(p, 0.99)) * 100}%`;
  }
  let toastTimer = 0;
  function toast(text, kind = 't1') {
    el.toastTxt.textContent = text; el.toastTxt.dataset.text = text;
    el.toast.className = 'toast ' + kind;
    void el.toast.offsetWidth;
    el.toast.classList.add('show');
    clearTimeout(toastTimer);
    toastTimer = setTimeout(() => el.toast.classList.remove('show'), 1060);
  }
  function floatText(text, x, y, cls = '') {
    const n = document.createElement('div');
    n.className = 'float ' + cls;
    n.textContent = text;
    n.style.left = x + 'px'; n.style.top = y + 'px';
    document.body.appendChild(n);
    n.addEventListener('animationend', () => n.remove());
  }
  const LINES = {
    t1: ['Sweet!', 'Yum!', 'Nice!', 'Tasty!', 'Mmm!', 'Yummy!'],
    t2: ['Scrumptious!', 'Luscious!', 'Delightful!', 'Splendid!', 'Juicy!', 'Dreamy!'],
    t3: ['Delicious!', 'Heavenly!', 'Exquisite!', 'Dazzling!', 'Marvelous!', 'Glorious!'],
    t4: ['Divine!', 'Sublime!', 'Legendary!', 'Majestic!', 'Unstoppable!', 'Spectacular!', 'Phenomenal!'],
    bad: ['Nope', 'Not there', 'Hmm...', 'Try again'],
    ouch: ['Ouch!', 'Sour!', 'That stings'],
    shift: ['Something changed...', 'New rule?', 'Rules shift...'],
  };
  let lastLine = '';
  function tierFor(streak) {
    const cls = streak >= 5 ? 't4' : streak === 4 ? 't3' : streak === 3 ? 't2' : 't1';
    const text = pick(LINES[cls], lastLine); lastLine = text;
    return { cls, text };
  }

  // ---------- Tutorial coaching ----------
  function coach(text) {
    el.coachText.textContent = text;
    el.coach.classList.remove('hidden');
    replay(el.coach, 'pop');
  }
  const correctDir = () => { const r = rule(); return KEYS.find(k => k[r] === S.card[r]).dir; };
  function guide() {
    const dir = correctDir();
    DIRS.forEach(d => { targets[d].classList.toggle('hint', d === dir); cues[d].classList.toggle('on', d === dir); });
    el.ruleChip.textContent = `Rule: ${RULE_WORD[rule()]}`;
    replay(el.ruleChip, 'on');
    const word = RULE_WORD[rule()], low = word.toLowerCase();
    let msg;
    if (S.trials === 0) msg = `Welcome! The secret rule right now is ${word}. Slide this card toward the glowing pile with the same ${low}.`;
    else if (S.coachNext === 'shift') msg = `You cracked it, so the rule changed! Now it's ${word}. Match the ${low} this time.`;
    else if (S.coachNext === 'wrong') msg = `Not that pile. The rule is ${word}: find the pile whose ${low} matches this card.`;
    else msg = rand([`Nice! Same rule, keep matching by ${low}.`, `Yes! A few more like that cracks the rule.`, `Sweet. Follow the glowing pile.`]);
    coach(msg);
  }
  function clearGuide() { DIRS.forEach(d => { targets[d].classList.remove('hint'); cues[d].classList.remove('on'); }); }

  // ---------- Game state ----------
  const S = {};
  let L = LEVELS[1];
  const newCriterion = () => (Array.isArray(L.criterion) ? randInt(L.criterion[0], L.criterion[1]) : L.criterion);
  function reset() {
    Object.assign(S, {
      deck: buildDeck(), deckPos: 0, card: null, cardEl: null,
      ruleIdx: Math.floor(Math.random() * RULES.length), prevRule: null, criterion: 0,
      run: 0, streak: 0, bestStreak: 0, categories: 0, trials: 0, correct: 0, errors: 0, persev: 0, lost: 0, timeouts: 0,
      score: 0, busy: true, over: false, lastWasShift: false, shiftHintGiven: false, coachNext: null,
    });
    S.criterion = newCriterion();
    shownScore = 0; el.score.textContent = '0';
    buildPips(); renderPips(); renderStars(); renderHUD();
  }
  const rule = () => RULES[S.ruleIdx];
  function nextCard() {
    if (S.deckPos >= S.deck.length) {
      const last = S.deck[S.deck.length - 1];
      S.deck = buildDeck();
      if (sameCard(S.deck[0], last)) S.deck.push(S.deck.shift());
      S.deckPos = 0;
    }
    return S.deck[S.deckPos++];
  }

  // ---------- Turn timer ----------
  const timer = {
    raf: 0, ends: 0, total: 0, active: false, lastTick: 0,
    start(sec) {
      this.total = sec; this.ends = performance.now() + sec * 1000; this.active = true; this.lastTick = Math.ceil(sec);
      el.timer.classList.remove('warn', 'urgent');
      cancelAnimationFrame(this.raf);
      this.raf = requestAnimationFrame(t => this.tick(t));
    },
    stop() { this.active = false; cancelAnimationFrame(this.raf); el.timer.classList.remove('urgent'); el.time.classList.remove('low'); },
    tick(now) {
      if (!this.active) return;
      const left = Math.max(0, (this.ends - now) / 1000);
      const frac = left / this.total;
      el.timerRect.style.strokeDashoffset = (100 * (1 - frac)).toFixed(2);
      el.time.textContent = left.toFixed(1);
      el.time.classList.toggle('low', left < 2);
      el.timer.classList.toggle('warn', frac < 0.5 && frac >= 0.25);
      el.timer.classList.toggle('urgent', frac < 0.25);
      const c = Math.ceil(left);
      if (c < this.lastTick && c <= 3 && c > 0) { sound.tick(); this.lastTick = c; }
      if (left <= 0) { this.stop(); timeOut(); return; }
      this.raf = requestAnimationFrame(t => this.tick(t));
    },
  };
  function sizeTimer() {
    const w = el.wrap.offsetWidth + 18, h = el.wrap.offsetHeight + 18;
    el.timer.setAttribute('viewBox', `0 0 ${w} ${h}`);
    for (const r of el.timer.querySelectorAll('rect')) { r.setAttribute('x', 3); r.setAttribute('y', 3); r.setAttribute('width', w - 6); r.setAttribute('height', h - 6); r.setAttribute('rx', 24); }
  }
  window.addEventListener('resize', () => { if (L.timer) sizeTimer(); });
  const turnSeconds = () => Math.max(L.timer.min, L.timer.start - L.timer.step * S.trials);
  async function timeOut() {
    if (S.busy || S.over || !S.cardEl) return;
    S.busy = true;
    const card = S.cardEl; S.cardEl = null;
    clearTimeout(idleTimer); clearGuide();
    S.trials++; S.errors++; S.timeouts++; S.run = 0; S.streak = 0; S.coachNext = 'wrong';
    for (const d of DIRS) { targets[d].style.setProperty('--hot', '0'); targets[d].classList.remove('ready'); }
    card.classList.remove('dragging');
    card.style.transform = '';
    card.animate([
      { transform: 'scale(1)', opacity: 1 },
      { transform: 'scale(1.06) rotate(-3deg)', opacity: 1, offset: 0.3 },
      { transform: 'scale(.5) rotate(4deg)', opacity: 0 },
    ], { duration: D(480), easing: 'ease-in', fill: 'forwards' });
    el.wrap.classList.add('empty');
    toast('Too slow!', 'bad');
    sound.bad(); buzz([30, 40, 30]); shake(false);
    renderPips(); renderHUD();
    await wait(D(720) + 40);
    card.remove();
    deal();
  }

  // ---------- Idle hint ----------
  let idleTimer = 0;
  function armIdle() {
    clearTimeout(idleTimer);
    idleTimer = setTimeout(() => {
      const card = S.cardEl;
      if (!card || S.busy || S.over || reduceMotion) return;
      const [nx, ny] = unitVec(L.guided ? correctDir() : rand(DIRS));
      card.style.setProperty('--nx', nx); card.style.setProperty('--ny', ny);
      replay(card, 'nudge');
      card.addEventListener('animationend', () => card.classList.remove('nudge'), { once: true });
      if (!L.guided) el.center.classList.remove('touched');
      sound.back();
      armIdle();
    }, 5000);
  }

  // ---------- Dealing ----------
  function deal() {
    if (S.over) return;
    if (S.trials >= L.trials || S.categories >= L.categories) return endGame();
    if (settings.shuffle) { reshuffleKeys(S.trials > 0); S.card = randomCard(S.card); }
    else S.card = nextCard();
    const node = document.createElement('div');
    node.className = 'card enter';
    node.setAttribute('role', 'img');
    node.setAttribute('aria-label', describe(S.card));
    node.innerHTML = pipsHTML(S.card) + [[18, 16, 0], [84, 28, 0.8], [26, 82, 1.5]].map(([x, y, d]) =>
      `<i class="sparkle" style="left:${x}%;top:${y}%;animation-delay:${d}s"></i>`).join('');
    el.wrap.classList.remove('empty');
    el.wrap.appendChild(node);
    S.cardEl = node;
    attachDrag(node);
    sound.pop();
    node.addEventListener('animationend', () => node.classList.remove('enter'), { once: true });
    if (L.guided) guide();
    S.busy = false;
    armIdle();
    if (L.timer) timer.start(turnSeconds());
  }

  // ---------- Drag to sort ----------
  function attachDrag(card) {
    let drag = null;
    const onDown = e => {
      if (S.busy || drag) return;
      drag = { id: e.pointerId, x0: e.clientX, y0: e.clientY, x: e.clientX, y: e.clientY, t: performance.now(), vx: 0, vy: 0, dir: null, ready: false };
      // Where each pile sits relative to the card, so a slide picks the pile closest to its angle.
      const w = el.wrap.getBoundingClientRect();
      drag.angles = DIRS.map(d => { const r = targets[d].getBoundingClientRect(); const dx = r.left + r.width / 2 - (w.left + w.width / 2), dy = r.top + r.height / 2 - (w.top + w.height / 2); return { d, a: Math.atan2(dy, dx), dist: Math.hypot(dx, dy) }; });
      // On small boards the piles are close, so a sort commits at a fraction of the pile distance.
      drag.commitAt = Math.min(SWIPE_COMMIT, 0.62 * Math.min(...drag.angles.map(p => p.dist)));
      try { card.setPointerCapture(e.pointerId); } catch (err) { /* synthetic pointer */ }
      clearTimeout(idleTimer);
      card.classList.remove('nudge');
      card.classList.add('dragging');
      card.getAnimations().forEach(a => a.cancel());
      el.center.classList.add('touched');
    };
    const onMove = e => {
      if (!drag || e.pointerId !== drag.id) return;
      const now = performance.now(), dt = Math.max(1, now - drag.t);
      drag.vx = (e.clientX - drag.x) / dt; drag.vy = (e.clientY - drag.y) / dt;
      drag.x = e.clientX; drag.y = e.clientY; drag.t = now;
      const dx = drag.x - drag.x0, dy = drag.y - drag.y0;
      const mag = Math.hypot(dx, dy);
      card.style.transform = `translate(${dx}px, ${dy}px) rotate(${clamp(dx * 0.08, -14, 14)}deg) scale(1.05)`;
      let dir = null;
      if (mag >= DEAD_ZONE) {
        const a = Math.atan2(dy, dx);
        let best = Infinity;
        for (const p of drag.angles) { const diff = Math.abs(Math.atan2(Math.sin(a - p.a), Math.cos(a - p.a))); if (diff < best) { best = diff; dir = p.d; } }
      }
      const heat = clamp((mag - DEAD_ZONE) / (drag.commitAt - DEAD_ZONE), 0, 1);
      if (dir !== drag.dir) { if (dir) sound.tick(); drag.dir = dir; drag.ready = false; }
      for (const d of DIRS) {
        targets[d].style.setProperty('--hot', d === dir ? heat.toFixed(3) : '0');
        targets[d].classList.toggle('ready', d === dir && heat >= 1);
      }
      if (dir && heat >= 1 && !drag.ready) { drag.ready = true; sound.ready(); buzz(8); }
      if (S.streak >= 3 && Math.random() < 0.45) fx.sparks(e.clientX + (Math.random() - 0.5) * 30, e.clientY + (Math.random() - 0.5) * 30, 1, COLORS[S.card.color].light, 0.35);
    };
    const onUp = e => {
      if (!drag || e.pointerId !== drag.id) return;
      const dx = drag.x - drag.x0, dy = drag.y - drag.y0;
      const mag = Math.hypot(dx, dy), speed = Math.hypot(drag.vx, drag.vy);
      const dir = drag.dir;
      const commitIt = dir && (mag >= drag.commitAt || (mag >= DEAD_ZONE * 3 && speed >= FLICK_SPEED));
      drag = null;
      card.classList.remove('dragging');
      for (const d of DIRS) { targets[d].style.setProperty('--hot', '0'); targets[d].classList.remove('ready'); }
      if (commitIt) commit(dir);
      else { springBack(card); armIdle(); }
    };
    card.addEventListener('pointerdown', onDown);
    card.addEventListener('pointermove', onMove);
    card.addEventListener('pointerup', onUp);
    card.addEventListener('pointercancel', onUp);
  }
  function springBack(card) {
    const from = card.style.transform || 'none';
    card.style.transform = '';
    if (from === 'none' || from === '') return;
    sound.back();
    card.animate([{ transform: from }, { transform: 'translate(0,0) rotate(0) scale(1)' }], { duration: D(520), easing: 'cubic-bezier(.2, 1.7, .4, 1)' });
  }
  function flyTo(card, dir) {
    const t = targets[dir].getBoundingClientRect(), w = el.wrap.getBoundingClientRect();
    const tx = t.left + t.width / 2 - (w.left + w.width / 2);
    const ty = t.top + t.height / 2 - (w.top + w.height / 2);
    const scale = (t.width * 0.78) / w.width;
    const from = card.style.transform || 'translate(0,0) rotate(0) scale(1)';
    card.style.transform = '';
    const end = `translate(${tx}px, ${ty}px) rotate(0) scale(${scale})`;
    const anim = card.animate([{ transform: from }, { transform: end }], { duration: D(300), easing: 'cubic-bezier(.3, .8, .3, 1)', fill: 'forwards' });
    return anim.finished.catch(() => {}).then(() => end);
  }

  async function commit(dir) {
    if (S.busy || S.over || !S.cardEl) return;
    S.busy = true;
    timer.stop();
    const card = S.cardEl; S.cardEl = null;
    const target = targets[dir];
    const key = KEYS[DIRS.indexOf(dir)];
    const r = rule();
    const correct = S.card[r] === key[r];
    S.trials++;
    clearTimeout(idleTimer);
    clearGuide();
    el.wrap.classList.add('empty');
    sound.whoosh();

    const end = await flyTo(card, dir);
    const rect = target.getBoundingClientRect();
    const cx = rect.left + rect.width / 2, cy = rect.top + rect.height / 2;

    if (correct) {
      S.correct++; S.run++; S.streak++; S.bestStreak = Math.max(S.bestStreak, S.streak);
      const mult = Math.min(S.streak, MULT_CAP);
      const points = BASE_POINTS * mult;
      S.score += points; S.lastWasShift = false; S.coachNext = 'good';

      target.classList.add('hit-good');
      fx.sparks(cx, cy, 22 + S.streak * 6, COLORS[S.card.color].light, 0.8 + S.streak * 0.12);
      floatText(mult > 1 ? `+${points} ×${mult}` : `+${points}`, cx, rect.top - 6);
      sound.good(S.streak); buzz(12);
      card.animate([
        { transform: end, opacity: 1 },
        { transform: end + ' scale(1.15, .85)', opacity: 1, offset: 0.35 },
        { transform: end + ' scale(0)', opacity: 0 },
      ], { duration: D(320), easing: 'cubic-bezier(.4, 0, .6, 1)', fill: 'forwards' });
      renderPips();

      if (S.run >= S.criterion) {
        await crackRule(cx, cy);
      } else {
        const tier = tierFor(S.streak);
        toast(tier.text, tier.cls);
        if (S.streak >= 4) shake(false);
        renderHUD();
        await wait(D(520) + 40);
      }
    } else {
      S.errors++;
      if (S.prevRule && S.card[S.prevRule] === key[S.prevRule]) S.persev++;
      S.run = 0; S.streak = 0; S.coachNext = 'wrong';
      target.classList.add('hit-bad');
      shake(false);
      card.animate([
        { transform: end + ' rotate(0)', opacity: 1 },
        { transform: end + ' rotate(-9deg)', offset: 0.2 },
        { transform: end + ' rotate(9deg)', offset: 0.4 },
        { transform: end + ' rotate(-5deg)', offset: 0.6, opacity: 1 },
        { transform: end + ' scale(.6)', opacity: 0 },
      ], { duration: D(520), easing: 'ease-in-out', fill: 'forwards' });
      let line;
      if (L.penalty) {
        const lost = Math.min(L.penalty, S.score);
        S.score -= lost; S.lost += lost;
        floatText(`-${L.penalty}`, cx, rect.top - 6, 'neg');
        line = pick(LINES.ouch, lastLine);
        sound.ouch(); buzz([40, 50, 40]);
      } else {
        sound.bad(); buzz([30, 40, 30]);
        if (L.announce && S.lastWasShift && !S.shiftHintGiven) { line = pick(LINES.shift); S.shiftHintGiven = true; }
        else line = pick(LINES.bad, lastLine);
      }
      lastLine = line;
      toast(line, 'bad');
      renderPips(); renderHUD();
      await wait(D(720) + 40);
    }

    target.classList.remove('hit-good', 'hit-bad');
    card.remove();
    deal();
  }

  async function crackRule(cx, cy) {
    S.categories++; S.score += CATEGORY_BONUS;
    S.prevRule = rule(); S.ruleIdx = (S.ruleIdx + 1) % RULES.length;
    S.run = 0; S.criterion = newCriterion();
    S.lastWasShift = true; S.shiftHintGiven = false; S.coachNext = 'shift';

    if (!L.announce) {
      // Silent switch: nothing on screen gives the change away.
      const tier = tierFor(S.streak);
      toast(tier.text, tier.cls);
      renderPips(); renderHUD();
      await wait(D(520) + 40);
      return;
    }
    renderPips(true);
    toast('Rule cracked!', 'big');
    voice.say('Rule cracked');
    floatText(`+${CATEGORY_BONUS}`, cx, cy - 20);
    sound.level(); buzz([20, 30, 20, 30, 60]); shake(true);
    fx.confetti(innerWidth / 2, innerHeight * 0.4, 130, 1.2);
    fx.sparks(innerWidth / 2, innerHeight * 0.5, 40, null, 1.6);
    ['up', 'right', 'down', 'left'].forEach((d, i) => setTimeout(() => {
      replay(targets[d], 'wave');
      targets[d].addEventListener('animationend', () => targets[d].classList.remove('wave'), { once: true });
    }, i * 90));
    renderHUD();
    await wait(D(650));
    renderStars(true); sound.star();
    await wait(D(800));
  }

  // ---------- Start / end ----------
  function startGame(levelId = progress.p.last) {
    L = LEVELS[clamp(levelId, 0, LEVELS.length - 1)] || LEVELS[1];
    progress.p.last = L.id; progress.save();
    sound.ensure(); sound.pop(); voice.load();
    buildBoard(L.piles || 4);
    timer.stop();
    el.timeStat.classList.toggle('hidden', !L.timer);
    el.timer.classList.toggle('hidden', !L.timer);
    if (L.timer) { sizeTimer(); el.time.textContent = L.timer.start.toFixed(1); el.timerRect.style.strokeDashoffset = '0'; }
    reset();
    el.levelChip.textContent = L.id === 0 ? 'Tutorial' : `Level ${L.id} · ${L.name}`;
    el.ruleChip.classList.toggle('on', false);
    el.coach.classList.add('hidden');
    document.body.classList.remove('menu');
    el.startOverlay.classList.add('hidden');
    el.levelsOverlay.classList.add('hidden');
    el.endOverlay.classList.add('hidden');
    el.center.classList.remove('touched');
    clearGuide();
    el.wrap.querySelectorAll('.card').forEach(c => c.remove());
    replay(el.board, 'in');
    setTimeout(() => el.board.classList.remove('in'), D(1100) + 50);
    DIRS.forEach((d, i) => setTimeout(() => sound.tick(), D(70) * i));
    setTimeout(deal, D(700));
  }
  function showLevels() {
    document.body.classList.add('menu');
    renderLevels();
    el.endOverlay.classList.add('hidden');
    el.startOverlay.classList.add('hidden');
    el.levelsOverlay.classList.remove('hidden');
  }
  function rankFor() {
    const acc = S.trials ? S.correct / S.trials : 0;
    if (S.categories >= L.categories && acc >= 0.85) return '🏆 Sugar Sage';
    if (S.categories >= L.categories) return '🍭 Candy Shark';
    if (S.categories >= Math.ceil(L.categories * 0.66)) return '🍬 Sweet Tooth';
    if (S.categories >= Math.ceil(L.categories * 0.33)) return '🍩 Quick Nibbler';
    return '🍪 Gumdrop';
  }
  async function endGame() {
    S.over = true; S.busy = true;
    timer.stop();
    clearTimeout(idleTimer); clearGuide();
    renderHUD();
    el.coach.classList.add('hidden');
    const won = S.categories >= L.categories;
    const acc = S.trials ? Math.round((S.correct / S.trials) * 100) : 0;
    const p = progress.p;
    const nextId = L.id + 1;
    let unlockedNow = false;
    if (won && nextId < LEVELS.length && p.unlocked < nextId) { p.unlocked = nextId; }
    if (!p.best[L.id] || S.score > p.best[L.id]) p.best[L.id] = S.score;
    progress.save();

    if (won) {
      sound.win();
      fx.confetti(innerWidth * 0.3, innerHeight * 0.3, 120, 1.3);
      fx.confetti(innerWidth * 0.7, innerHeight * 0.3, 120, 1.3);
    }
    await wait(D(900));
    el.endEyebrow.textContent = L.id === 0 ? 'Tutorial' : `Level ${L.id} · ${L.name}`;
    const title = L.guided ? (won ? "You're ready!" : 'Nice warm-up') : won ? 'Sweet victory!' : "Deck's out";
    el.endTitle.textContent = title; el.endTitle.dataset.text = title;
    el.endRank.textContent = rankFor();
    el.endUnlock.textContent = unlockedNow ? `🔓 Level ${nextId} unlocked: ${LEVELS[nextId].name}` : '';
    el.endUnlock.classList.toggle('hidden', !unlockedNow);
    const rows = [[0, 'Score'], [`${acc}%`, 'Accuracy'], [`${S.categories}/${L.categories}`, 'Rules cracked'], [S.bestStreak, 'Best streak'], [S.trials, 'Cards sorted']];
    rows.push(L.timer ? [S.timeouts, 'Timed out'] : L.penalty ? [`-${S.lost}`, 'Lost to mistakes'] : [S.persev, 'Stuck on old rule']);
    el.endResults.innerHTML = rows.map(([v, l], i) =>
      `<div class="result" style="--i:${i}"><div class="result__value">${v}</div><div class="result__label">${l}</div></div>`).join('');
    endStarEls.forEach((s, i) => { s.classList.remove('lit'); s.style.display = i < L.categories ? '' : 'none'; });
    el.nextBtn.classList.toggle('hidden', !(nextId < LEVELS.length));
    el.nextBtn.textContent = L.id === 0 ? 'Start level 1' : `Next: level ${nextId}`;
    el.endOverlay.classList.remove('hidden');
    (el.nextBtn.classList.contains('hidden') ? el.againBtn : el.nextBtn).focus();
    if (L.guided && won) voice.say("You're ready", 'tutorial-complete');
    else if (won) voice.say(unlockedNow ? 'Level up' : 'Sweet victory');

    const scoreEl = el.endResults.querySelector('.result__value');
    const t0 = performance.now(), dur = D(900) || 1, total = S.score;
    let lastTick = 0;
    const roll = t => {
      const k = Math.min(1, (t - t0) / dur);
      scoreEl.textContent = Math.round(total * (1 - Math.pow(1 - k, 3)));
      if (t - lastTick > 45 && k < 1) { sound.count(); lastTick = t; }
      if (k < 1) requestAnimationFrame(roll);
    };
    requestAnimationFrame(roll);
    setTimeout(() => { scoreEl.textContent = total; }, dur + 80);
    for (let i = 0; i < S.categories; i++) {
      setTimeout(() => {
        endStarEls[i].classList.add('lit');
        sound.chime(784 * Math.pow(2, i * 2 / 12), 0.3, 0.05);
        const r = endStarEls[i].getBoundingClientRect();
        fx.sparks(r.left + r.width / 2, r.top + r.height / 2, 14, '#fde047', 0.7);
      }, D(350) + i * D(160));
    }
  }

  el.nextBtn.addEventListener('click', () => startGame(L.id + 1));
  el.againBtn.addEventListener('click', () => startGame(L.id));
  el.levelsBtn.addEventListener('click', showLevels);

  // Share the result: native share sheet where it exists, otherwise copy the text.
  function shareText() {
    const acc = S.trials ? Math.round((S.correct / S.trials) * 100) : 0;
    const where = L.id === 0 ? 'the tutorial' : `level ${L.id} (${L.name})`;
    return `I scored ${S.score} on ${where} of Sweet Sort: ${S.categories}/${L.categories} rules cracked, ${acc}% accuracy, best streak ${S.bestStreak}. Can you beat it?`;
  }
  async function shareResult() {
    const url = location.origin + location.pathname.replace(/[^/]*$/, '');
    const text = shareText();
    const flash = label => { el.shareBtn.textContent = label; setTimeout(() => { el.shareBtn.textContent = 'Share'; }, 1600); };
    sound.pop();
    if (navigator.share) {
      try { await navigator.share({ title: 'Sweet Sort', text, url }); flash('Shared!'); return; }
      catch (e) { if (e && e.name === 'AbortError') return; }
    }
    try { await navigator.clipboard.writeText(`${text} ${url}`); flash('Copied!'); }
    catch (e) { flash('Copy failed'); }
  }
  el.shareBtn.addEventListener('click', shareResult);
  $('home-btn').addEventListener('click', () => { sound.pop(); clearTimeout(idleTimer); timer.stop(); S.over = true; showSplash(); });
  el.playBtn.addEventListener('click', () => startGame(playTarget()));
  el.levelsOpen.addEventListener('click', () => { sound.pop(); showLevels(); });
  el.levelsBack.addEventListener('click', () => { sound.pop(); showSplash(); });

  const KEY_DIR = { ArrowUp: 'up', ArrowLeft: 'left', ArrowRight: 'right', ArrowDown: 'down', w: 'up', a: 'left', d: 'right', s: 'down' };
  document.addEventListener('keydown', e => {
    if (e.metaKey || e.ctrlKey || e.altKey) return;
    const startUp = !el.startOverlay.classList.contains('hidden');
    const levelsUp = !el.levelsOverlay.classList.contains('hidden');
    const endUp = !el.endOverlay.classList.contains('hidden');
    if (startUp) { if (e.key === 'Enter') { e.preventDefault(); startGame(playTarget()); } return; }
    if (levelsUp) { if (e.key === 'Escape') showSplash(); if (e.key === 'Enter') { e.preventDefault(); startGame(progress.p.last); } return; }
    if (endUp) { if (e.key === 'Enter') { e.preventDefault(); (el.nextBtn.classList.contains('hidden') ? el.againBtn : el.nextBtn).click(); } return; }
    let dir = KEY_DIR[e.key] || KEY_DIR[e.key.toLowerCase()];
    const num = Number(e.key);
    if (num >= 1 && num <= DIRS.length) dir = DIRS[num - 1];
    if (dir && DIRS.includes(dir)) { e.preventDefault(); el.center.classList.add('touched'); commit(dir); }
    if (e.key === 'm' || e.key === 'M') sound.toggle();
  });

  renderLevels();
  renderPlayHint();
  document.body.classList.add('menu');
  reset();
  if (location.search.includes('debug')) window.sweetSort = { state: S, level: () => L, LEVELS, timer, shareText, deal, commit, endGame, crackRule, toast, shake, voice, armIdle, startGame, progress };
})();
