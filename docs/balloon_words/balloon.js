/* Balloon Words: guess the hidden word before all the balloons pop. */

(function () {
  'use strict';

  const { $, read, write, el } = window.V3Tools;
  const Play = window.V3Play;
  const Daily = window.V3Daily;

  const KEY = 'v3-balloon';
  const DAILY_KEY = 'v3-balloon-daily';
  const ROWS = ['qwertyuiop', 'asdfghjkl', 'zxcvbnm'];
  const COLORS = ['#ff5a5f', '#ffb400', '#00a699', '#7b61ff', '#ff7eb6', '#3ec1ff', '#8bd346', '#ff8c42'];
  const MARKS = /^[ \-'.]$/;
  const DAILY_BALLOONS = 6;

  const saved = read(KEY, {});
  const state = {
    mode: ['solo', 'daily', 'friend'].includes(saved.mode) ? saved.mode : 'solo',
    topic: ['everyday', 'animals', 'foods', 'countries'].includes(saved.topic) ? saved.topic : 'everyday',
    level: [4, 6, 8].includes(saved.level) ? saved.level : 6,
    streak: saved.streak || 0,
    best: saved.best || 0,
    recent: saved.recent || {},
  };
  const remember = () => write(KEY, { mode: state.mode, topic: state.topic, level: state.level, streak: state.streak, best: state.best, recent: state.recent });

  /* ---------- Words ---------- */

  // The plain letter for matching: accents removed, upper case. Marks (space, hyphen…) are shown, not guessed.
  const base = (ch) => ch.normalize('NFD').replace(/[̀-ͯ]/g, '').toUpperCase();
  const usable = (word) => {
    const chars = Array.from(word.trim());
    const letters = chars.filter((c) => !MARKS.test(c));
    return letters.length >= 3 && chars.length <= 24 && letters.every((c) => /^[A-Z]$/.test(base(c)));
  };
  const title = (w) => w.replace(/(^|[ -])([a-z])/g, (m, a, b) => a + b.toUpperCase());

  function wordsFor(topic) {
    if (topic === 'everyday') {
      return (typeof WORD_CARDS !== 'undefined' ? WORD_CARDS : []).map((c) => ({ word: c[0], clue: c[1] ? 'Think of: ' + c[1] : '' }));
    }
    if (topic === 'countries') {
      return (window.COUNTRIES || []).map((c) => ({ word: c.name, clue: 'A country in ' + (c.sub || c.region) }));
    }
    const lists = window.CHAIN_LISTS || {};
    return (lists[topic] || []).map((w) => ({ word: title(w), clue: '' }));
  }
  const LISTS = {};
  const list = (topic) => (LISTS[topic] = LISTS[topic] || wordsFor(topic).filter((x) => usable(x.word)));

  /* ---------- The game ---------- */

  let game = null;

  function newGame(entry, options) {
    const chars = Array.from(entry.word.trim());
    game = {
      word: entry.word.trim(),
      chars,
      letters: new Set(chars.filter((c) => !MARKS.test(c)).map(base)),
      guessed: new Set(),
      wrong: [],
      max: options.max,
      left: options.max,
      clue: entry.clue || '',
      clueShown: false,
      over: false,
      won: false,
      mode: options.mode,
      events: [], // for the daily: what was played, so it can be shown again later
    };
    $('done').hidden = true;
    $('message').textContent = '';
    $('tools').hidden = false;
    $('new').hidden = game.mode !== 'solo';
    drawSky();
    buildKeys();
    render();
    showInfo();
  }

  function render(newLetter) {
    const word = $('word');
    word.replaceChildren();
    let chunk = el('span', 'bw-chunk');
    const finish = () => { if (chunk.childNodes.length) word.appendChild(chunk); chunk = el('span', 'bw-chunk'); };
    game.chars.forEach((c) => {
      if (c === ' ') { finish(); return; }
      if (MARKS.test(c)) { chunk.appendChild(el('span', 'bw-slot is-mark', c)); return; }
      const b = base(c);
      const shown = game.guessed.has(b);
      const slot = el('span', 'bw-slot' + (shown && b === newLetter ? ' is-new' : '') + (!shown && game.over ? ' is-missed' : ''), shown || game.over ? c : '');
      chunk.appendChild(slot);
    });
    finish();
    const hidden = game.chars.filter((c) => !MARKS.test(c)).map((c) => (game.guessed.has(base(c)) ? c : 'blank')).join(' ');
    word.setAttribute('aria-label', 'Word: ' + hidden);
    $('left').textContent = game.left + (game.left === 1 ? ' balloon' : ' balloons') + ' left';
    const clue = $('clue');
    clue.hidden = !game.clueShown;
    if (game.clueShown) clue.replaceChildren(el('strong', '', 'Clue: '), game.clue);
    $('hint').disabled = game.over || game.left <= 1 || !hasHint();
    document.querySelectorAll('.bw-key').forEach((k) => {
      const L = k.dataset.letter;
      const used = game.guessed.has(L);
      k.classList.toggle('is-hit', used && game.letters.has(L));
      k.classList.toggle('is-miss', used && !game.letters.has(L));
      k.disabled = used || game.over;
    });
  }

  const hasHint = () => (game.clue && !game.clueShown) || [...game.letters].some((L) => !game.guessed.has(L));

  function guess(L, quiet) {
    if (!game || game.over || game.guessed.has(L)) return false;
    game.guessed.add(L);
    game.events.push(L);
    if (game.letters.has(L)) {
      if (!quiet) { Play.sounds.tick(); Play.tone(700 + game.guessed.size * 20, 90, { type: 'triangle', volume: 0.2 }); }
    } else {
      game.wrong.push(L);
      pop(quiet);
    }
    afterTurn(L, quiet);
    return true;
  }

  function hint(quiet, forced) {
    if (!game || game.over || game.left <= 1 || !hasHint()) return false;
    let L = null;
    if (game.clue && !game.clueShown) {
      game.clueShown = true;
      game.events.push('#clue');
    } else {
      const hidden = [...game.letters].filter((x) => !game.guessed.has(x));
      L = forced || Play.pick(hidden);
      game.guessed.add(L);
      game.events.push('#' + L);
    }
    pop(quiet);
    afterTurn(L, quiet);
    return true;
  }

  function afterTurn(L, quiet) {
    const won = [...game.letters].every((x) => game.guessed.has(x));
    if (won || game.left === 0) end(won, quiet);
    render(L);
    if (game.mode === 'daily') saveDaily();
  }

  function end(won, quiet) {
    game.over = true;
    game.won = won;
    $('sky').classList.add(won ? 'is-won' : 'is-lost');
    if (!quiet) {
      if (won) Play.sounds.win(); else Play.sounds.end();
      Play.vibrate(won ? [40, 40, 80] : [200]);
    }
    if (game.mode === 'solo' && !quiet) {
      state.streak = won ? state.streak + 1 : 0;
      state.best = Math.max(state.best, state.streak);
      remember();
    }
    showInfo();
    showDone();
  }

  function showDone() {
    const kept = game.left;
    $('done-title').textContent = game.won ? (kept === game.max ? 'Perfect!' : 'Saved!') : 'All popped!';
    $('done-text').textContent = game.won
      ? 'You found “' + game.word + '” with ' + kept + (kept === 1 ? ' balloon' : ' balloons') + ' left.'
      : 'The word was “' + game.word + '”.';
    $('share').hidden = game.mode !== 'daily';
    $('again').textContent = game.mode === 'friend' ? 'Hide another word' : game.mode === 'daily' ? 'Play solo' : 'Next word';
    $('tools').hidden = true;
    $('done').hidden = false;
    $('message').textContent = '';
  }

  function showInfo() {
    const labels = { everyday: 'Everyday words', animals: 'Animals', foods: 'Foods', countries: 'Countries' };
    if (!game) return;
    $('info').textContent = game.mode === 'daily' ? 'Daily · ' + Daily.label(Daily.today()) : game.mode === 'friend' ? 'A friend’s word' : labels[state.topic];
    $('streak').textContent = game.mode === 'solo' ? 'Streak ' + state.streak + ' · Best ' + state.best : '';
  }

  /* ---------- The sky ---------- */

  const NS = 'http://www.w3.org/2000/svg';
  const svg = (tag, attrs, parent) => {
    const node = document.createElementNS(NS, tag);
    Object.keys(attrs || {}).forEach((k) => node.setAttribute(k, attrs[k]));
    if (parent) parent.appendChild(node);
    return node;
  };
  let balloons = [];

  function drawSky() {
    const sky = $('sky');
    sky.className = 'bw-sky';
    const root = svg('svg', { viewBox: '0 0 400 240', preserveAspectRatio: 'xMidYMid meet' });
    // Clouds
    [[60, 50, 1], [330, 36, 0.8], [250, 120, 0.6]].forEach(([x, y, s]) => {
      const g = svg('g', { class: 'bw-cloud', transform: 'translate(' + x + ' ' + y + ') scale(' + s + ')' }, root);
      svg('ellipse', { cx: 0, cy: 0, rx: 28, ry: 12 }, g);
      svg('ellipse', { cx: -16, cy: 4, rx: 18, ry: 10 }, g);
      svg('ellipse', { cx: 18, cy: 4, rx: 20, ry: 10 }, g);
    });
    const lift = svg('g', { class: 'bw-lift' }, root);
    const n = game.max;
    const knotY = 170;
    balloons = [];
    // Balloons in an arc, the middle ones higher.
    for (let i = 0; i < n; i++) {
      const t = n === 1 ? 0.5 : i / (n - 1);
      const x = 200 + (t - 0.5) * Math.min(300, 46 * n);
      const y = 70 - Math.sin(t * Math.PI) * 26 + (i % 2) * 10;
      const string = svg('path', { class: 'bw-string', d: 'M' + x + ' ' + (y + 30) + ' Q' + ((x + 200) / 2 + (i % 2 ? 6 : -6)) + ' ' + ((y + knotY) / 2) + ' 200 ' + knotY }, lift);
      const g = svg('g', { class: 'bw-balloon', style: '--d:' + (-i * 0.37).toFixed(2) + 's' }, lift);
      const color = COLORS[i % COLORS.length];
      svg('ellipse', { cx: x, cy: y, rx: 21, ry: 26, fill: color }, g);
      svg('path', { d: 'M' + (x - 4) + ' ' + (y + 30) + ' L' + x + ' ' + (y + 24) + ' L' + (x + 4) + ' ' + (y + 30) + ' Z', fill: color }, g);
      svg('ellipse', { class: 'shine', cx: x - 7, cy: y - 9, rx: 5, ry: 8, transform: 'rotate(-20 ' + (x - 7) + ' ' + (y - 9) + ')' }, g);
      balloons.push({ g, string, x, y, color });
    }
    // The basket and its passenger
    const basket = svg('g', { class: 'bw-basket-group' }, lift);
    svg('circle', { cx: 200, cy: 180, r: 11, fill: '#f6c89f' }, basket);
    svg('circle', { cx: 196, cy: 178, r: 1.6, fill: '#1d1d1f' }, basket);
    svg('circle', { cx: 204, cy: 178, r: 1.6, fill: '#1d1d1f' }, basket);
    svg('path', { d: 'M195 184 Q200 188 205 184', stroke: '#1d1d1f', 'stroke-width': 1.4, fill: 'none', 'stroke-linecap': 'round' }, basket);
    svg('path', { d: 'M178 186 L222 186 L216 214 L184 214 Z', fill: '#a0662f' }, basket);
    svg('path', { d: 'M180 194 L220 194 M182 204 L218 204', stroke: '#7a4a1f', 'stroke-width': 2 }, basket);
    svg('rect', { x: 176, y: 182, width: 48, height: 6, rx: 3, fill: '#8a5526' }, basket);
    sky.replaceChildren(root);
    // Balloons already popped (when showing a saved daily game).
    for (let i = 0; i < game.max - game.left; i++) popAt(i, true);
  }

  // Pops from the outside in, alternating sides, so the bunch stays balanced.
  const popOrder = (n) => {
    const order = [];
    for (let a = 0, b = n - 1; a <= b; a++, b--) { order.push(a); if (a !== b) order.push(b); }
    return order;
  };

  function popAt(k, quiet) {
    const index = popOrder(game.max)[k];
    const b = balloons[index];
    if (!b) return;
    b.g.classList.add('is-popped');
    b.string.classList.add('is-popped');
    if (quiet) return;
    const burst = svg('g', { transform: 'translate(' + b.x + ' ' + b.y + ')' }, b.g.ownerSVGElement);
    for (let i = 0; i < 8; i++) {
      const a = (i / 8) * Math.PI * 2;
      svg('line', { class: 'bw-burst', x1: Math.cos(a) * 14, y1: Math.sin(a) * 14, x2: Math.cos(a) * 24, y2: Math.sin(a) * 24, stroke: b.color }, burst);
    }
    setTimeout(() => burst.remove(), 450);
  }

  function pop(quiet) {
    const k = game.max - game.left;
    game.left--;
    popAt(k, quiet);
    if (!quiet) {
      Play.tone(160, 90, { type: 'square', volume: 0.12, to: 60 });
      Play.vibrate(60);
    }
  }

  /* ---------- On-screen letters ---------- */

  function buildKeys() {
    const keys = $('keys');
    if (keys.childElementCount) return;
    ROWS.forEach((row, r) => {
      const line = el('div', 'bw-row' + (r === 1 ? ' is-mid' : r === 2 ? ' is-low' : ''));
      Array.from(row).forEach((ch) => {
        const b = el('button', 'bw-key', ch);
        b.type = 'button';
        b.dataset.letter = ch.toUpperCase();
        b.setAttribute('aria-label', ch.toUpperCase());
        b.addEventListener('click', () => guess(b.dataset.letter));
        line.appendChild(b);
      });
      keys.appendChild(line);
    });
  }

  /* ---------- Modes ---------- */

  function startSolo() {
    const words = list(state.topic);
    if (!words.length) { $('message').textContent = 'No words found for this topic.'; return; }
    const recent = state.recent[state.topic] || [];
    let options = words.filter((w) => !recent.includes(w.word));
    if (!options.length) { options = words; state.recent[state.topic] = []; }
    const entry = Play.pick(options);
    state.recent[state.topic] = (state.recent[state.topic] || []).concat(entry.word).slice(-Math.min(200, Math.floor(words.length * 0.7)));
    remember();
    newGame(entry, { max: state.level, mode: 'solo' });
  }

  function dailyEntry() {
    const random = Daily.rng('balloon-' + Daily.today());
    const words = list('everyday').filter((w) => /^[A-Za-z]{5,10}$/.test(w.word));
    return Daily.pick(words, random);
  }

  function saveDaily() {
    write(DAILY_KEY, { day: Daily.today(), events: game.events, over: game.over, won: game.won, left: game.left });
  }

  function startDaily() {
    newGame(dailyEntry(), { max: DAILY_BALLOONS, mode: 'daily' });
    const old = read(DAILY_KEY, {});
    if (old.day === Daily.today() && Array.isArray(old.events)) {
      // Show today's game as it was left.
      old.events.forEach((e) => {
        if (e === '#clue') hint(true);
        else if (e[0] === '#') hint(true, e.slice(1));
        else guess(e, true);
      });
      drawSky();
      if (game.over) $('sky').classList.add(game.won ? 'is-won' : 'is-lost');
      render();
    }
  }

  function showFriendForm() {
    game = null;
    $('play').hidden = true;
    $('secret-form').hidden = false;
    $('secret').value = '';
    $('secret-clue').value = '';
    $('secret').focus({ preventScroll: true });
  }

  $('secret-form').addEventListener('submit', (event) => {
    event.preventDefault();
    const word = $('secret').value.trim().replace(/\s+/g, ' ');
    if (!usable(word)) {
      $('secret-note').textContent = 'Use at least 3 letters. Letters, spaces, hyphens and apostrophes only.';
      $('secret').focus();
      return;
    }
    $('secret-note').textContent = 'Letters, spaces, hyphens and apostrophes only. Then pass the device over.';
    $('secret').type = 'password';
    $('peek').setAttribute('aria-pressed', 'false');
    $('peek').textContent = 'Show';
    $('secret-form').hidden = true;
    $('play').hidden = false;
    document.activeElement.blur();
    newGame({ word, clue: $('secret-clue').value.trim() }, { max: state.level, mode: 'friend' });
  });

  $('peek').addEventListener('click', () => {
    const show = $('secret').type === 'password';
    $('secret').type = show ? 'text' : 'password';
    $('peek').setAttribute('aria-pressed', String(show));
    $('peek').textContent = show ? 'Hide' : 'Show';
  });

  function start() {
    $('options').hidden = state.mode === 'daily';
    $('topic').hidden = state.mode !== 'solo';
    $('secret-form').hidden = true;
    $('play').hidden = false;
    $('sky').className = 'bw-sky';
    if (state.mode === 'solo') startSolo();
    else if (state.mode === 'daily') startDaily();
    else showFriendForm();
  }

  const showMode = Play.segmented($('mode'), state.mode, (v) => { state.mode = v; remember(); start(); });
  Play.segmented($('topic'), state.topic, (v) => { state.topic = v; remember(); start(); });
  Play.segmented($('level'), state.level, (v) => {
    state.level = Number(v);
    remember();
    if (state.mode === 'solo') start();
  });

  $('hint').addEventListener('click', () => hint());
  $('new').addEventListener('click', () => {
    // Skipping a word you've started counts as a miss for the streak.
    if (game && !game.over && game.guessed.size) {
      state.streak = 0;
      remember();
    }
    startSolo();
  });
  $('again').addEventListener('click', () => {
    if (game && game.mode === 'daily') { state.mode = 'solo'; showMode('solo'); remember(); start(); return; }
    if (game && game.mode === 'friend') { showFriendForm(); return; }
    startSolo();
  });
  $('share').addEventListener('click', () => {
    const result = game.won ? 'Saved with ' + game.left + ' of ' + game.max + ' balloons left' : 'All ' + game.max + ' balloons popped';
    Daily.share('Balloon Words ' + Daily.today() + '\n' + result + '\n' + location.href.split('?')[0])
      .then((done) => { $('message').textContent = done ? 'Result copied.' : 'Couldn’t copy. Try again.'; });
  });

  /* ---------- Keyboard ---------- */

  window.V3Keys.add([
    { keys: 'abcdefghijklmnopqrstuvwxyz'.split(''), label: 'A to Z', does: 'Guess a letter', run: (key) => guess(key.toUpperCase()) },
    { keys: ['1'], label: '1', does: 'Hint (pops a balloon)', run: () => hint() },
    { keys: ['Enter'], label: 'Enter', does: 'Next word (when this one is over)', run: () => {
      if (!game || !game.over || $('done').hidden) return false;
      $('again').click();
      return true;
    } },
    { keys: ['2', '3', '4', '5'], label: '2 to 5', does: 'Solo topic: Everyday, Animals, Foods, Countries', run: (key) => {
      if (state.mode !== 'solo') return false;
      $('topic').children[Number(key) - 2].click();
      return true;
    } },
  ]);

  start();
})();

window.V3Keys.howTo({
  id: 'balloon',
  title: 'Balloon Words',
  steps: [
    'A word is hidden under the dashes. Guess it one letter at a time.',
    'Right letters fill in every place they appear. Every wrong letter pops a balloon.',
    'Find the whole word before the last balloon pops to save the basket.',
    'Hint shows a clue or a letter, but it costs a balloon too.',
    'Solo: pick Everyday words, Animals, Foods or Countries, and Easy, Normal or Hard. Daily: one word for everyone today. With a friend: one person hides a word, the other guesses.',
  ],
  tip: 'Start with common letters like E, A, R, S and T.',
});
