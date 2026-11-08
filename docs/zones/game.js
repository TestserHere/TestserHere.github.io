/* Zones: game screen. Your puzzle is saved as you play. */

(function () {
  'use strict';

  const { $, read, write, el, formatDuration } = window.V3Tools;
  const Engine = window.ZonesEngine;

  const GAME_KEY = 'v3-zones-game';
  const BEST_KEY = 'v3-zones-best';
  const AUTO_KEY = 'v3-zones-auto';
  const EMPTY = 0;
  const CROSS = 1;
  const MARKER = 2;
  const MAX_UNDO = 300;
  const LEVEL_NAMES = { easy: 'Easy', medium: 'Medium', hard: 'Hard' };
  const COLOURS = ['#f8b4b4', '#fbd38d', '#faf089', '#9ae6b4', '#81e6d9', '#90cdf4', '#b3bcf5', '#d6bcfa', '#fbb6ce', '#cbd5e0'];

  let game = null;
  let cells = [];
  let undoStack = [];
  let autoDots = read(AUTO_KEY, true) !== false;
  let focusCell = 0;

  function loadGame() {
    const saved = read(GAME_KEY, null);
    if (!saved || !LEVEL_NAMES[saved.level]) return null;
    const n = Engine.SIZE[saved.level];
    const valid = saved.n === n && Array.isArray(saved.zones) && saved.zones.length === n * n &&
      Array.isArray(saved.marks) && saved.marks.length === n * n &&
      Array.isArray(saved.layout) && saved.layout.length === n &&
      saved.zones.every((zone) => Number.isInteger(zone) && zone >= 0 && zone < COLOURS.length);
    return valid ? Object.assign(saved, { elapsed: Number(saved.elapsed) || 0, won: Boolean(saved.won) }) : null;
  }

  const save = () => write(GAME_KEY, game);
  const hasProgress = () => !game.won && game.marks.some((mark) => mark === MARKER);

  function attacks(a, b) {
    if (a === b) return false;
    const { n, zones } = game;
    const rowGap = Math.abs(Math.floor(a / n) - Math.floor(b / n));
    const colGap = Math.abs((a % n) - (b % n));
    return rowGap === 0 || colGap === 0 || zones[a] === zones[b] || (rowGap <= 1 && colGap <= 1);
  }

  const markerCells = () => game.marks.reduce((list, mark, cell) => (mark === MARKER ? list.concat(cell) : list), []);

  function buildBoard() {
    const { n, zones } = game;
    $('board').style.setProperty('--size', n);
    cells = zones.map((zone, cell) => {
      const classes = ['zone-cell'];
      if (cell >= n && zones[cell - n] !== zone) classes.push('edge-top');
      if (cell % n && zones[cell - 1] !== zone) classes.push('edge-left');
      const button = el('button', classes.join(' '));
      button.type = 'button';
      button.dataset.base = classes.join(' ');
      button.style.background = COLOURS[zone];
      button.setAttribute('role', 'gridcell');
      button.addEventListener('click', () => tap(cell));
      button.addEventListener('focus', () => { focusCell = cell; });
      return button;
    });
    $('board').replaceChildren(...cells);
    focusCell = 0;
  }

  function render() {
    const { n, marks } = game;
    const markers = markerCells();
    cells.forEach((button, cell) => {
      const mark = marks[cell];
      const classes = [button.dataset.base];
      if (mark === MARKER) {
        classes.push('is-marker');
        if (markers.some((other) => attacks(cell, other))) classes.push('is-conflict');
      } else if (mark === CROSS) {
        classes.push('is-cross');
      } else if (autoDots && markers.some((other) => attacks(cell, other))) {
        classes.push('is-blocked');
      }
      button.className = classes.join(' ');
      button.tabIndex = cell === focusCell ? 0 : -1;
      const state = mark === MARKER ? 'marker' : mark === CROSS ? 'crossed out' : 'empty';
      button.setAttribute('aria-label', 'Row ' + (Math.floor(cell / n) + 1) + ', column ' + ((cell % n) + 1) + ', zone ' + (game.zones[cell] + 1) + ': ' + state);
    });

    document.querySelectorAll('[data-level]').forEach((button) => {
      button.setAttribute('aria-pressed', String(button.dataset.level === game.level));
    });
    $('auto').setAttribute('aria-pressed', String(autoDots));
    $('undo').disabled = game.won || undoStack.length === 0;
    $('restart').disabled = game.won;
    $('hint').disabled = game.won;
    $('board').classList.toggle('is-locked', game.won);
    $('win').hidden = !game.won;
    renderTime();
  }

  function renderTime() {
    $('time').textContent = formatDuration(game.elapsed);
  }

  function startGame(level) {
    const { n, zones, layout } = Engine.generate(level);
    game = { level, n, zones, layout, marks: new Array(n * n).fill(EMPTY), elapsed: 0, won: false };
    undoStack = [];
    buildBoard();
    save();
    render();
  }

  function confirmNewGame() {
    return !hasProgress() || window.confirm('Start a new puzzle? Your current one will be lost.');
  }

  function remember() {
    undoStack.push(game.marks.slice());
    if (undoStack.length > MAX_UNDO) undoStack.shift();
  }

  function checkWin() {
    const markers = markerCells();
    if (markers.length !== game.n || markers.some((a) => markers.some((b) => attacks(a, b)))) return;
    game.won = true;
    const best = read(BEST_KEY, {});
    const previous = Number(best[game.level]) || 0;
    const isBest = !previous || game.elapsed < previous;
    if (isBest) {
      best[game.level] = game.elapsed;
      write(BEST_KEY, best);
    }
    $('win-text').textContent = LEVEL_NAMES[game.level] + ' in ' + formatDuration(game.elapsed) +
      (isBest ? '. A new best!' : '. Your best is ' + formatDuration(previous) + '.');
  }

  function tap(cell) {
    if (game.won) return;
    remember();
    focusCell = cell;
    game.marks[cell] = (game.marks[cell] + 1) % 3;
    checkWin();
    save();
    render();
  }

  /* A hint removes a wrong marker first. Otherwise it places one correct marker. */
  function hint() {
    const { n, layout, marks } = game;
    const correct = layout.map((col, row) => row * n + col);
    remember();
    let target = marks.findIndex((mark, cell) => mark === MARKER && !correct.includes(cell));
    if (target >= 0) {
      marks[target] = EMPTY;
    } else {
      target = correct.find((cell) => marks[cell] !== MARKER);
      if (target === undefined) return;
      marks[target] = MARKER;
      checkWin();
    }
    save();
    render();
    cells[target].classList.add('is-hint');
  }

  $('hint').addEventListener('click', hint);

  $('undo').addEventListener('click', () => {
    if (!undoStack.length) return;
    game.marks = undoStack.pop();
    save();
    render();
  });

  $('restart').addEventListener('click', () => {
    if (!game.marks.some(Boolean)) return;
    remember();
    game.marks = game.marks.map(() => EMPTY);
    save();
    render();
  });

  $('auto').addEventListener('click', () => {
    autoDots = !autoDots;
    write(AUTO_KEY, autoDots);
    render();
  });

  $('new-game').addEventListener('click', () => {
    if (confirmNewGame()) startGame(game.level);
  });
  $('win-new').addEventListener('click', () => startGame(game.level));

  document.querySelectorAll('[data-level]').forEach((button) => {
    button.addEventListener('click', () => {
      if (button.dataset.level !== game.level && confirmNewGame()) startGame(button.dataset.level);
    });
  });

  $('board').addEventListener('keydown', (event) => {
    const { n } = game;
    const move = { ArrowUp: -n, ArrowDown: n, ArrowLeft: -1, ArrowRight: 1 }[event.key];
    if (!move) return;
    event.preventDefault();
    const next = focusCell + move;
    const horizontal = Math.abs(move) === 1;
    if (next < 0 || next >= n * n || (horizontal && Math.floor(next / n) !== Math.floor(focusCell / n))) return;
    focusCell = next;
    render();
    cells[next].focus();
  });

  setInterval(() => {
    if (document.hidden || game.won) return;
    game.elapsed += 1;
    renderTime();
    save();
  }, 1000);

  game = loadGame();
  if (game) {
    buildBoard();
    if (game.won) $('win-text').textContent = LEVEL_NAMES[game.level] + ' in ' + formatDuration(game.elapsed) + '.';
    render();
  } else {
    startGame('easy');
  }
})();
