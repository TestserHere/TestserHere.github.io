/* Code Breaker: find the hidden colour code. After each guess you're told how many colours are in the right
   place and how many are the right colour but in the wrong place. */

(function () {
  'use strict';

  const { $, read, write, el } = window.V3Tools;
  const Play = window.V3Play;
  const Daily = window.V3Daily;

  const KEY = 'v3-codebreaker';
  const NAMES = ['Red', 'Orange', 'Yellow', 'Green', 'Blue', 'Purple', 'Pink', 'Brown'];
  const LEVELS = {
    easy: { pegs: 4, colors: 6, repeats: false, guesses: 10, note: '4 colours from 6. No colour is used twice.' },
    normal: { pegs: 4, colors: 6, repeats: true, guesses: 10, note: '4 colours from 6. Colours can repeat.' },
    hard: { pegs: 5, colors: 8, repeats: true, guesses: 10, note: '5 colours from 8. Colours can repeat.' },
  };

  const saved = read(KEY, {});
  const state = {
    mode: ['solo', 'daily', 'duo'].includes(saved.mode) ? saved.mode : 'solo',
    level: LEVELS[saved.level] ? saved.level : 'normal',
    stats: saved.stats && typeof saved.stats === 'object' ? saved.stats : {}, // level -> { played, won, best }
    daily: saved.daily && saved.daily.day === Daily.today() ? saved.daily : null,
  };
  const remember = () => write(KEY, state);

  let game = null; // { code, rules, guesses: [[...]], current: [], over }
  let making = null; // the code being made in 2-player mode

  const rules = () => LEVELS[state.mode === 'daily' ? 'normal' : state.level];

  function peg(color, label) {
    const p = el(label ? 'button' : 'span', 'peg' + (color === undefined || color === null ? ' is-empty' : ' c' + color));
    if (label) p.type = 'button';
    if (color !== undefined && color !== null) {
      p.textContent = String(color + 1);
      p.setAttribute('aria-label', NAMES[color]);
    }
    return p;
  }

  function makeCode(r, random) {
    const pool = Array.from({ length: r.colors }, (_, i) => i);
    if (!r.repeats) return Play.shuffle(pool).slice(0, r.pegs);
    return Array.from({ length: r.pegs }, () => Math.floor(random() * r.colors));
  }

  /* [right place, right colour wrong place] */
  function score(code, guess) {
    let exact = 0;
    const left = {};
    const rest = [];
    code.forEach((c, i) => {
      if (guess[i] === c) exact++;
      else { left[c] = (left[c] || 0) + 1; rest.push(guess[i]); }
    });
    let near = 0;
    rest.forEach((g) => { if (left[g]) { near++; left[g]--; } });
    return [exact, near];
  }

  /* ---------- Starting ---------- */

  function newGame() {
    $('done').hidden = true;
    making = null;
    $('maker').hidden = true;
    const r = rules();
    if (state.mode === 'duo') {
      making = [];
      $('play').hidden = true;
      $('maker').hidden = false;
      renderMaker();
      return;
    }
    $('play').hidden = false;
    if (state.mode === 'daily') {
      const day = Daily.today();
      const code = makeCode(r, Daily.rng('code-' + day));
      if (!state.daily) state.daily = { day, guesses: [], over: false };
      game = { code, rules: r, guesses: state.daily.guesses, current: [], over: state.daily.over };
    } else {
      game = { code: makeCode(r, Play.random), rules: r, guesses: [], current: [], over: false };
    }
    render();
    if (game.over) finish(true);
  }

  function renderMaker() {
    const r = rules();
    $('maker-row').replaceChildren(...Array.from({ length: r.pegs }, (_, i) => peg(making[i])));
    $('maker-palette').replaceChildren(...Array.from({ length: r.colors }, (_, c) => {
      const b = peg(c, true);
      b.disabled = making.length >= r.pegs || (!r.repeats && making.includes(c));
      b.addEventListener('click', () => { if (making.length < r.pegs) { making.push(c); renderMaker(); } });
      return b;
    }));
    $('maker-done').disabled = making.length < r.pegs;
  }

  $('maker-clear').addEventListener('click', () => { making = []; renderMaker(); });
  $('maker-done').addEventListener('click', () => {
    if (!making || making.length < rules().pegs) return;
    game = { code: making.slice(), rules: rules(), guesses: [], current: [], over: false };
    making = null;
    $('maker').hidden = true;
    $('play').hidden = false;
    render();
  });

  /* ---------- Playing ---------- */

  function render() {
    const r = game.rules;
    const board = $('board');
    board.replaceChildren();
    for (let row = 0; row < r.guesses; row++) {
      const guess = game.guesses[row];
      const isCurrent = !game.over && row === game.guesses.length;
      const line = el('li', 'cb-line' + (isCurrent ? ' is-current' : !guess ? ' is-future' : ''));
      const pegs = el('div', 'cb-row');
      const shown = guess || (isCurrent ? game.current : []);
      for (let i = 0; i < r.pegs; i++) {
        const p = peg(shown[i]);
        if (isCurrent && i === game.current.length) p.classList.add('is-next');
        pegs.appendChild(p);
      }
      const fb = el('div', 'cb-feedback' + (r.pegs === 5 ? ' is-5' : ''));
      if (guess) {
        const [exact, near] = score(game.code, guess);
        for (let i = 0; i < r.pegs; i++) fb.appendChild(el('span', 'fb' + (i < exact ? ' is-exact' : i < exact + near ? ' is-near' : '')));
        line.setAttribute('aria-label', 'Guess ' + (row + 1) + ': ' + guess.map((c) => NAMES[c]).join(', ') + '. ' + exact + ' right place, ' + near + ' wrong place.');
      }
      line.append(el('span', 'cb-num', String(row + 1)), pegs, fb);
      board.appendChild(line);
    }
    $('palette').replaceChildren(...Array.from({ length: r.colors }, (_, c) => {
      const b = peg(c, true);
      b.disabled = game.over || game.current.length >= r.pegs || (!r.repeats && game.current.includes(c));
      b.addEventListener('click', () => add(c));
      return b;
    }));
    $('check').disabled = game.over || game.current.length < r.pegs;
    $('undo').disabled = game.over || !game.current.length;
    $('info').textContent = (state.mode === 'daily' ? 'Daily · ' : state.mode === 'duo' ? '2 players · ' : '')
      + 'Guess ' + Math.min(game.guesses.length + 1, r.guesses) + ' of ' + r.guesses;
    const s = state.stats[state.mode === 'daily' ? 'daily' : state.level];
    $('stats').textContent = state.mode === 'duo' || !s ? '' : 'Won ' + s.won + ' of ' + s.played;
  }

  function add(c) {
    const r = game.rules;
    if (game.over || game.current.length >= r.pegs || (!r.repeats && game.current.includes(c))) return;
    game.current.push(c);
    Play.tone(300 + c * 60, 60, { type: 'triangle', volume: 0.12 });
    render();
  }

  function undo() {
    if (game.over || !game.current.length) return;
    game.current.pop();
    render();
  }

  function check() {
    const r = game.rules;
    if (game.over || game.current.length < r.pegs) return;
    const guess = game.current.slice();
    game.guesses.push(guess);
    game.current = [];
    const [exact] = score(game.code, guess);
    const won = exact === r.pegs;
    if (won || game.guesses.length >= r.guesses) {
      game.over = true;
      record(won);
      render();
      return finish(won);
    }
    if (state.mode === 'daily') remember();
    Play.sounds.tick();
    render();
  }

  function record(won) {
    if (state.mode === 'duo') return;
    const key = state.mode === 'daily' ? 'daily' : state.level;
    const s = state.stats[key] || (state.stats[key] = { played: 0, won: 0, best: 0 });
    s.played++;
    if (won) {
      s.won++;
      if (!s.best || game.guesses.length < s.best) s.best = game.guesses.length;
    }
    if (state.mode === 'daily') state.daily.over = true;
    remember();
  }

  function finish(fromSave) {
    const won = game.guesses.some((g) => score(game.code, g)[0] === game.rules.pegs);
    $('done').hidden = false;
    $('done-title').textContent = won ? 'Cracked it!' : 'Out of guesses';
    $('done-code').replaceChildren(...game.code.map((c) => peg(c)));
    const n = game.guesses.length;
    $('done-text').textContent = won
      ? 'You found the code in ' + n + (n === 1 ? ' guess' : ' guesses') + '.' + (state.mode === 'daily' ? ' Come back tomorrow for a new daily code.' : '')
      : 'This was the code.' + (state.mode === 'daily' ? ' Come back tomorrow for a new one.' : '');
    $('share').hidden = state.mode !== 'daily';
    $('again').hidden = state.mode === 'daily';
    if (!fromSave) {
      if (won) Play.sounds.win(); else Play.sounds.end();
    }
    $('done').scrollIntoView({ behavior: 'smooth', block: 'center' });
  }

  $('share').addEventListener('click', async () => {
    const lines = game.guesses.map((g) => {
      const [exact, near] = score(game.code, g);
      return '●'.repeat(exact) + '○'.repeat(near) + '·'.repeat(game.rules.pegs - exact - near);
    });
    const won = game.guesses.some((g) => score(game.code, g)[0] === game.rules.pegs);
    const text = 'Code Breaker daily, ' + Daily.label(Daily.today()) + ': ' + (won ? game.guesses.length : 'X') + '/' + game.rules.guesses + '\n' + lines.join('\n') + '\n' + location.href.split('?')[0];
    $('share').textContent = (await Daily.share(text)) ? 'Copied!' : 'Couldn’t copy';
    setTimeout(() => { $('share').textContent = 'Copy result'; }, 2000);
  });

  $('undo').addEventListener('click', undo);
  $('check').addEventListener('click', check);
  $('again').addEventListener('click', newGame);

  const showLevel = () => {
    $('level').hidden = state.mode === 'daily';
    $('level-note').textContent = state.mode === 'daily' ? 'Everyone gets the same code today. ' + LEVELS.normal.note : rules().note;
  };
  Play.segmented($('mode'), state.mode, (v) => { state.mode = v; remember(); showLevel(); newGame(); });
  Play.segmented($('level'), state.level, (v) => { state.level = v; remember(); showLevel(); newGame(); });
  showLevel();
  newGame();

  window.V3Keys.add([
    { keys: ['1', '2', '3', '4', '5', '6', '7', '8'], label: '1 to 8', does: 'Add a colour (the number is shown on each colour)', run: (key) => {
      const c = Number(key) - 1;
      if (making && !$('maker').hidden) { const b = $('maker-palette').children[c]; if (b && !b.disabled) b.click(); return true; }
      if (!game || c >= game.rules.colors) return false;
      add(c);
      return true;
    } },
    { keys: ['Backspace', 'Delete'], label: 'Backspace', does: 'Delete the last colour', run: () => { if (making && !$('maker').hidden) { making.pop(); renderMaker(); return true; } undo(); return true; } },
    { keys: ['Enter'], label: 'Enter', does: 'Check your guess, or start a new code', press: ['#check', '#maker-done', '#again'] },
    { keys: ['n'], label: 'N', does: 'New code', press: '#again' },
  ]);
  window.V3Keys.howTo({
    id: 'codebreaker',
    title: 'Code Breaker',
    steps: [
      'There’s a secret code of coloured pegs. Your job is to work it out in 10 guesses or fewer.',
      'Tap colours to fill a row, then press Check.',
      'A filled dot means one colour is right and in the right place. A ring means one colour is right but in the wrong place. The dots don’t say which pegs they mean.',
      'Use the clues from each guess to narrow it down.',
      'Daily: everyone gets the same code today. 2 players: one person secretly makes the code, the other breaks it.',
    ],
    tip: 'Each colour also has a number, so you can play by number if colours are hard to tell apart.',
  });
})();
