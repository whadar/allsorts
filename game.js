(() => {
  'use strict';

  // ---------- Tunables ----------
  const CRITERION = 6;        // consecutive correct sorts to crack a rule
  const MAX_CATEGORIES = 6;   // rules to crack before the game ends
  const MAX_TRIALS = 64;      // cards in the deck
  const BASE_POINTS = 10;
  const STREAK_STEP = 2;      // extra points per streak step
  const STREAK_CAP = 5;       // streak bonus caps at this many steps
  const CATEGORY_BONUS = 50;

  const COLORS = { red: '#e63946', green: '#2a9d8f', yellow: '#f4c430', blue: '#3a86ff' };
  const KEYS = [
    { color: 'red',    shape: 'triangle', count: 1 },
    { color: 'green',  shape: 'star',     count: 2 },
    { color: 'yellow', shape: 'cross',    count: 3 },
    { color: 'blue',   shape: 'circle',   count: 4 },
  ];
  const RULES = ['color', 'shape', 'count'];
  const RULE_WORD = { color: 'color', shape: 'shape', count: 'number' };

  const PIP_LAYOUT = {
    1: [[50, 50]],
    2: [[50, 30], [50, 70]],
    3: [[30, 25], [50, 50], [70, 75]],
    4: [[32, 30], [68, 30], [32, 70], [68, 70]],
  };
  const PIP_SIZE = { 1: 58, 2: 40, 3: 36, 4: 38 };
  const STAR = '50,4 61.2,34.6 93.8,35.8 68.1,55.9 77,87.2 50,69 23,87.2 31.9,55.9 6.2,35.8 38.8,34.6';
  const SHAPE_SVG = {
    triangle: c => `<polygon points="50,8 92,88 8,88" fill="${c}" stroke="${c}" stroke-width="6" stroke-linejoin="round"/>`,
    star:     c => `<polygon points="${STAR}" fill="${c}" stroke="${c}" stroke-width="5" stroke-linejoin="round"/>`,
    cross:    c => `<path d="M35 5h30v30h30v30H65v30H35V65H5V35h30z" fill="${c}" stroke="${c}" stroke-width="4" stroke-linejoin="round"/>`,
    circle:   c => `<circle cx="50" cy="50" r="42" fill="${c}"/>`,
  };

  const LINES = {
    intro: [
      "Welcome to my table. Find the rule... if you can.",
      "Four piles, one secret rule. Let's see what you've got.",
    ],
    correct: ["Nice!", "That's it!", "Sharp.", "Yes!", "Keep going.", "You've got the hang of it.", "Correct."],
    hot: ["On fire! 🔥", "Unstoppable!", "Is this even a challenge for you?", "Someone's paying attention."],
    wrong: ["Nope.", "Not that pile.", "Hmm, try something else.", "Close, but no.", "Wrong pile, friend."],
    wrongAfterShift: ["Something feels... different, doesn't it?", "Rules are rules. Until they aren't. 😏", "What worked before may not work now."],
    cracked: ["You cracked it! 🎉", "Rule found. Impressive.", "Ha! You're good at this.", "Got it in one. Well, in six."],
    crackedTease: ["Now let's see if you can keep up...", "Don't get comfortable. 😏", "Fresh deal, fresh ideas."],
    winEnd: ["You beat the house. Come back any time.", "Six rules, cracked. I'm out of tricks."],
    deckEnd: ["That's the whole deck. Not bad.", "Out of cards! Let's see how you did."],
  };

  // ---------- DOM ----------
  const $ = id => document.getElementById(id);
  const el = {
    score: $('score'), streak: $('streak'), cats: $('cats'), cardsLeft: $('cards-left'),
    mute: $('mute'), dealer: $('dealer'), bubble: $('bubble'), bubbleText: $('bubble-text'),
    deck: $('deck'), stage: $('stage'), piles: $('piles'),
    startOverlay: $('start-overlay'), startBtn: $('start-btn'), classic: $('classic-mode'),
    endOverlay: $('end-overlay'), endEyebrow: $('end-eyebrow'), endTitle: $('end-title'),
    endRank: $('end-rank'), endResults: $('end-results'), againBtn: $('again-btn'),
  };

  const reduceMotion = window.matchMedia('(prefers-reduced-motion: reduce)').matches;
  const D = ms => (reduceMotion ? 0 : ms);
  const wait = ms => new Promise(r => setTimeout(r, ms));
  const pick = (arr, avoid) => {
    let choice = arr[Math.floor(Math.random() * arr.length)];
    if (arr.length > 1 && choice === avoid) choice = arr[(arr.indexOf(choice) + 1) % arr.length];
    return choice;
  };
  const shuffle = arr => {
    for (let i = arr.length - 1; i > 0; i--) {
      const j = Math.floor(Math.random() * (i + 1));
      [arr[i], arr[j]] = [arr[j], arr[i]];
    }
    return arr;
  };

  // ---------- Sound ----------
  const sound = {
    enabled: localStorage.getItem('cardsorter-sound') !== 'off',
    ctx: null,
    ensure() {
      if (!this.ctx) {
        const AC = window.AudioContext || window.webkitAudioContext;
        if (!AC) return false;
        this.ctx = new AC();
      }
      if (this.ctx.state === 'suspended') this.ctx.resume();
      return true;
    },
    tone(freq, dur, type = 'sine', vol = 0.06, delay = 0) {
      if (!this.enabled) return;
      try {
        if (!this.ensure()) return;
        const t = this.ctx.currentTime + delay;
        const o = this.ctx.createOscillator();
        const g = this.ctx.createGain();
        o.type = type;
        o.frequency.value = freq;
        g.gain.setValueAtTime(0.0001, t);
        g.gain.exponentialRampToValueAtTime(vol, t + 0.012);
        g.gain.exponentialRampToValueAtTime(0.0001, t + dur);
        o.connect(g).connect(this.ctx.destination);
        o.start(t);
        o.stop(t + dur + 0.05);
      } catch (e) { /* audio is a nicety, never fatal */ }
    },
    deal()  { this.tone(420, 0.06, 'triangle', 0.04); this.tone(640, 0.05, 'triangle', 0.03, 0.05); },
    good()  { this.tone(660, 0.12, 'sine', 0.07); this.tone(990, 0.18, 'sine', 0.07, 0.1); },
    bad()   { this.tone(200, 0.22, 'sawtooth', 0.05); this.tone(150, 0.25, 'sawtooth', 0.04, 0.08); },
    level() { [523, 659, 784, 1047].forEach((f, i) => this.tone(f, 0.22, 'triangle', 0.07, i * 0.09)); },
    win()   { [523, 659, 784, 1047, 1319].forEach((f, i) => this.tone(f, 0.3, 'triangle', 0.07, i * 0.12)); },
    click() { this.tone(300, 0.04, 'square', 0.02); },
    toggle() {
      this.enabled = !this.enabled;
      localStorage.setItem('cardsorter-sound', this.enabled ? 'on' : 'off');
      el.mute.textContent = this.enabled ? '🔊' : '🔇';
      if (this.enabled) this.click();
    },
  };
  el.mute.textContent = sound.enabled ? '🔊' : '🔇';
  el.mute.addEventListener('click', () => sound.toggle());

  // ---------- Confetti ----------
  const confetti = (() => {
    const cv = $('confetti');
    const ctx = cv.getContext('2d');
    const palette = ['#f43f5e', '#f59e0b', '#22c55e', '#3b82f6', '#a855f7', '#facc15', '#fff'];
    let parts = [], raf = 0, dpr = 1;
    function resize() {
      dpr = Math.min(window.devicePixelRatio || 1, 2);
      cv.width = Math.floor(innerWidth * dpr);
      cv.height = Math.floor(innerHeight * dpr);
      ctx.setTransform(dpr, 0, 0, dpr, 0, 0);
    }
    window.addEventListener('resize', resize);
    resize();
    function burst(x, y, n = 90, spread = 1) {
      if (reduceMotion) return;
      for (let i = 0; i < n; i++) {
        parts.push({
          x, y,
          vx: (Math.random() - 0.5) * 16 * spread,
          vy: -Math.random() * 13 - 5,
          g: 0.38,
          w: 6 + Math.random() * 6, h: 4 + Math.random() * 6,
          r: Math.random() * Math.PI, vr: (Math.random() - 0.5) * 0.3,
          c: palette[Math.floor(Math.random() * palette.length)],
          life: 1, decay: 0.009 + Math.random() * 0.008,
        });
      }
      if (!raf) raf = requestAnimationFrame(tick);
    }
    function tick() {
      ctx.clearRect(0, 0, innerWidth, innerHeight);
      parts = parts.filter(p => p.life > 0);
      for (const p of parts) {
        p.vy += p.g; p.x += p.vx; p.y += p.vy; p.vx *= 0.985; p.r += p.vr; p.life -= p.decay;
        ctx.save();
        ctx.globalAlpha = Math.max(0, Math.min(1, p.life * 1.5));
        ctx.translate(p.x, p.y);
        ctx.rotate(p.r);
        ctx.fillStyle = p.c;
        ctx.fillRect(-p.w / 2, -p.h / 2, p.w, p.h);
        ctx.restore();
      }
      raf = parts.length ? requestAnimationFrame(tick) : 0;
    }
    return { burst };
  })();

  // ---------- Cards ----------
  function cardHTML(card) {
    const size = PIP_SIZE[card.count];
    return PIP_LAYOUT[card.count].map(([x, y]) =>
      `<svg class="pip" viewBox="0 0 100 100" style="left:${x}%;top:${y}%;width:${size}%">${SHAPE_SVG[card.shape](COLORS[card.color])}</svg>`
    ).join('');
  }
  function makeCard(card, key = false) {
    const node = document.createElement('div');
    node.className = 'card' + (key ? ' card--key' : '');
    node.innerHTML = cardHTML(card);
    node.setAttribute('aria-label', `${card.count} ${card.color} ${card.shape}${card.count > 1 ? 's' : ''}`);
    return node;
  }
  function buildDeck() {
    // Every card matches a different key on each dimension, so feedback is never ambiguous.
    const deck = [];
    for (let c = 0; c < 4; c++) for (let s = 0; s < 4; s++) for (let n = 0; n < 4; n++) {
      if (c === s || s === n || c === n) continue;
      deck.push({ color: KEYS[c].color, shape: KEYS[s].shape, count: KEYS[n].count });
    }
    return shuffle(deck);
  }

  // ---------- Piles ----------
  const pileEls = KEYS.map((key, i) => {
    const btn = document.createElement('button');
    btn.className = 'pile';
    btn.type = 'button';
    btn.setAttribute('aria-label', `Pile ${i + 1}: ${key.count} ${key.color} ${key.shape}${key.count > 1 ? 's' : ''}`);
    btn.appendChild(makeCard(key, true));
    const num = document.createElement('span');
    num.className = 'pile__num';
    num.textContent = String(i + 1);
    btn.appendChild(num);
    btn.addEventListener('click', () => choose(i));
    el.piles.appendChild(btn);
    return btn;
  });

  // ---------- Dealer ----------
  let moodTimer = 0;
  let lastLine = '';
  function say(text, mood = 'neutral', hold = 1800) {
    el.bubbleText.textContent = text;
    el.bubble.classList.remove('pop');
    void el.bubble.offsetWidth;
    el.bubble.classList.add('pop');
    setMood(mood, hold);
  }
  function setMood(mood, hold = 1800) {
    clearTimeout(moodTimer);
    el.dealer.dataset.mood = mood;
    el.dealer.className.baseVal = 'dealer';
    void el.dealer.getBoundingClientRect();
    if (mood !== 'neutral') el.dealer.classList.add('anim-' + mood);
    if (mood !== 'neutral' && hold > 0) {
      moodTimer = setTimeout(() => { el.dealer.dataset.mood = 'neutral'; el.dealer.className.baseVal = 'dealer'; }, hold);
    }
  }
  function dealerNudge() {
    el.dealer.classList.remove('anim-deal');
    void el.dealer.getBoundingClientRect();
    el.dealer.classList.add('anim-deal');
    el.deck.classList.remove('pulse');
    void el.deck.offsetWidth;
    el.deck.classList.add('pulse');
  }

  // ---------- HUD ----------
  function bump(node) {
    node.classList.remove('bump');
    void node.offsetWidth;
    node.classList.add('bump');
  }
  function renderHUD() {
    if (el.score.textContent !== String(S.score)) { el.score.textContent = S.score; bump(el.score); }
    const streakText = S.streak >= 3 ? `${S.streak} 🔥` : String(S.streak);
    if (el.streak.textContent !== streakText) { el.streak.textContent = streakText; bump(el.streak); }
    el.streak.classList.toggle('hot', S.streak >= 3);
    const catsText = `${S.categories}/${MAX_CATEGORIES}`;
    if (el.cats.textContent !== catsText) { el.cats.textContent = catsText; bump(el.cats); }
    el.cardsLeft.textContent = MAX_TRIALS - S.trials;
  }
  function floatText(text, x, y, big = false) {
    const node = document.createElement('div');
    node.className = 'float' + (big ? ' float--big' : '');
    node.textContent = text;
    node.style.left = x + 'px';
    node.style.top = y + 'px';
    document.body.appendChild(node);
    node.addEventListener('animationend', () => node.remove());
  }
  function showMark(pile, good) {
    const mark = document.createElement('div');
    mark.className = 'mark ' + (good ? 'mark--good' : 'mark--bad');
    mark.textContent = good ? '✓' : '✗';
    pile.appendChild(mark);
    mark.addEventListener('animationend', () => mark.remove());
  }

  // ---------- Game state ----------
  const S = {};
  function reset() {
    Object.assign(S, {
      deck: buildDeck(), deckPos: 0, card: null, cardEl: null,
      ruleIdx: Math.floor(Math.random() * RULES.length), prevRule: null,
      streak: 0, bestStreak: 0, categories: 0,
      trials: 0, correct: 0, errors: 0, persev: 0,
      score: 0, busy: true, over: false, shiftHintGiven: false,
      lastWasShift: false, classic: el.classic.checked,
    });
    renderHUD();
  }
  const rule = () => RULES[S.ruleIdx];

  function nextCard() {
    if (S.deckPos >= S.deck.length) {
      const last = S.deck[S.deck.length - 1];
      S.deck = buildDeck();
      if (S.deck[0] === last || sameCard(S.deck[0], last)) S.deck.push(S.deck.shift());
      S.deckPos = 0;
    }
    return S.deck[S.deckPos++];
  }
  const sameCard = (a, b) => a.color === b.color && a.shape === b.shape && a.count === b.count;

  async function deal() {
    if (S.over) return;
    if (S.trials >= MAX_TRIALS || S.categories >= MAX_CATEGORIES) return endGame();
    S.card = nextCard();
    const node = makeCard(S.card);
    node.classList.add('stage-card');
    el.stage.appendChild(node);
    S.cardEl = node;

    dealerNudge();
    sound.deal();
    const d = el.deck.getBoundingClientRect();
    const s = node.getBoundingClientRect();
    const dx = d.left - s.left + (d.width - s.width) / 2;
    const dy = d.top - s.top + (d.height - s.height) / 2;
    const anim = node.animate([
      { transform: `translate(${dx}px, ${dy}px) rotate(-16deg) scale(.6)`, opacity: 0 },
      { opacity: 1, offset: 0.25 },
      { transform: 'translate(0, 0) rotate(0) scale(1)', opacity: 1 },
    ], { duration: D(520), easing: 'cubic-bezier(.2, .8, .2, 1)' });
    await anim.finished.catch(() => {});
    S.busy = false;
    el.piles.classList.remove('locked');
  }

  function flyTo(pile) {
    const node = S.cardEl;
    S.cardEl = null;
    const a = node.getBoundingClientRect();
    const b = pile.querySelector('.card').getBoundingClientRect();
    const clone = node.cloneNode(true);
    clone.classList.add('flying');
    clone.classList.remove('stage-card');
    clone.style.width = a.width + 'px';
    clone.style.height = a.height + 'px';
    document.body.appendChild(clone);
    node.remove();
    const scale = b.width / a.width;
    const x1 = b.left + (b.width - a.width) / 2;
    const y1 = b.top + (b.height - a.height) / 2;
    const rot = (Math.random() - 0.5) * 10;
    const anim = clone.animate([
      { transform: `translate(${a.left}px, ${a.top}px) scale(1) rotate(0)` },
      { transform: `translate(${x1}px, ${y1}px) scale(${scale}) rotate(${rot}deg)` },
    ], { duration: D(380), easing: 'cubic-bezier(.3, .7, .3, 1)', fill: 'forwards' });
    return anim.finished.catch(() => {}).then(() => clone.remove());
  }

  async function choose(i) {
    if (S.busy || S.over || !S.cardEl) return;
    S.busy = true;
    el.piles.classList.add('locked');
    const pile = pileEls[i];
    const key = KEYS[i];
    const card = S.card;
    const r = rule();
    const correct = card[r] === key[r];

    S.trials++;
    await flyTo(pile);

    const rect = pile.getBoundingClientRect();
    const cx = rect.left + rect.width / 2;
    const cy = rect.top;

    if (correct) {
      S.correct++;
      S.streak++;
      S.bestStreak = Math.max(S.bestStreak, S.streak);
      const bonus = Math.min(S.streak - 1, STREAK_CAP) * STREAK_STEP;
      const points = BASE_POINTS + bonus;
      S.score += points;
      S.lastWasShift = false;

      pile.classList.add('is-good');
      showMark(pile, true);
      floatText(`+${points}`, cx, cy);
      sound.good();

      const cracked = S.streak >= CRITERION;
      if (cracked) {
        await crackRule(cx, cy);
      } else {
        const line = S.streak >= 4 ? pick(LINES.hot, lastLine) : pick(LINES.correct, lastLine);
        lastLine = line;
        say(line, 'happy', 1400);
        renderHUD();
        await wait(D(650) + 50);
      }
    } else {
      S.errors++;
      if (S.prevRule && card[S.prevRule] === key[S.prevRule]) S.persev++;
      S.streak = 0;
      pile.classList.add('is-bad');
      showMark(pile, false);
      sound.bad();
      let line;
      if (S.lastWasShift && !S.shiftHintGiven) {
        line = pick(LINES.wrongAfterShift);
        S.shiftHintGiven = true;
        say(line, 'smirk', 1800);
      } else {
        line = pick(LINES.wrong, lastLine);
        say(line, 'sad', 1300);
      }
      lastLine = line;
      renderHUD();
      await wait(D(850) + 50);
    }

    pile.classList.remove('is-good', 'is-bad');
    deal();
  }

  async function crackRule(cx, cy) {
    S.categories++;
    S.score += CATEGORY_BONUS;
    S.prevRule = rule();
    S.ruleIdx = (S.ruleIdx + 1) % RULES.length;
    S.streak = 0;
    S.lastWasShift = true;
    S.shiftHintGiven = false;
    renderHUD();

    if (S.classic) {
      // Classic test: the rule changes silently.
      const line = pick(LINES.correct, lastLine);
      lastLine = line;
      say(line, 'happy', 1400);
      await wait(D(650) + 50);
      return;
    }
    const line = pick(LINES.cracked, lastLine);
    lastLine = line;
    say(line, 'wow', 2200);
    sound.level();
    floatText(`Rule cracked! +${CATEGORY_BONUS}`, innerWidth / 2, innerHeight * 0.42, true);
    confetti.burst(cx, cy, 70, 0.8);
    confetti.burst(innerWidth / 2, innerHeight * 0.35, 110, 1.2);
    await wait(D(1500));
    if (S.categories < MAX_CATEGORIES) {
      const tease = pick(LINES.crackedTease);
      say(tease, 'smirk', 1600);
      await wait(D(500));
    }
  }

  // ---------- Start / end ----------
  function startGame() {
    sound.ensure();
    sound.click();
    reset();
    el.startOverlay.classList.add('hidden');
    el.endOverlay.classList.add('hidden');
    el.piles.classList.add('locked');
    say(pick(LINES.intro), 'smirk', 2200);
    setTimeout(deal, D(700));
  }

  function rankFor() {
    const acc = S.trials ? S.correct / S.trials : 0;
    if (S.categories >= MAX_CATEGORIES && acc >= 0.85) return ['Grandmaster Sorter', '🏆'];
    if (S.categories >= MAX_CATEGORIES) return ['Rule Whisperer', '🧠'];
    if (S.categories >= 4) return ['Card Shark', '🦈'];
    if (S.categories >= 2) return ['Quick Learner', '⚡'];
    return ['Rule Rookie', '🌱'];
  }

  async function endGame() {
    S.over = true;
    S.busy = true;
    const won = S.categories >= MAX_CATEGORIES;
    const acc = S.trials ? Math.round((S.correct / S.trials) * 100) : 0;
    const [rank, icon] = rankFor();

    say(pick(won ? LINES.winEnd : LINES.deckEnd), won ? 'wow' : 'happy', 3000);
    if (won) {
      sound.win();
      confetti.burst(innerWidth * 0.3, innerHeight * 0.3, 120, 1.3);
      confetti.burst(innerWidth * 0.7, innerHeight * 0.3, 120, 1.3);
    }
    await wait(D(1200));

    el.endEyebrow.textContent = won ? 'You beat the dealer' : "Deck's out";
    el.endTitle.textContent = won ? 'All rules cracked!' : 'Game over';
    el.endRank.textContent = `${icon} ${rank}`;
    const rows = [
      [S.score, 'Score'],
      [`${acc}%`, 'Accuracy'],
      [`${S.categories}/${MAX_CATEGORIES}`, 'Rules cracked'],
      [S.bestStreak, 'Best streak'],
      [S.trials, 'Cards sorted'],
      [S.persev, 'Stuck on old rule'],
    ];
    el.endResults.innerHTML = rows.map(([v, l]) =>
      `<div class="result"><div class="result__value">${v}</div><div class="result__label">${l}</div></div>`
    ).join('');
    el.endOverlay.classList.remove('hidden');
    el.againBtn.focus();
  }

  el.startBtn.addEventListener('click', startGame);
  el.againBtn.addEventListener('click', startGame);

  document.addEventListener('keydown', e => {
    if (e.metaKey || e.ctrlKey || e.altKey) return;
    if (!el.startOverlay.classList.contains('hidden') || !el.endOverlay.classList.contains('hidden')) {
      if (e.key === 'Enter' || e.key === ' ') { e.preventDefault(); startGame(); }
      return;
    }
    if (e.key >= '1' && e.key <= '4') { e.preventDefault(); choose(Number(e.key) - 1); }
    if (e.key === 'm' || e.key === 'M') sound.toggle();
  });

  reset();

  // Dev hook: open index.html?debug to poke at the game from the console.
  if (location.search.includes('debug')) window.cardSorter = { state: S, deal, choose, endGame, crackRule };
})();
