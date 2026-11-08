/* Sudoku: game screen. Your puzzle is saved as you play. */

(function () {
  'use strict';

  const { $, read, write, el, formatDuration } = window.V3Tools;
  const Engine = window.SudokuEngine;

  const GAME_KEY = 'v3-sudoku-game';
  const BEST_KEY = 'v3-sudoku-best';
  const LEVELS = ['easy', 'medium', 'hard'];
  const LEVEL_NAMES = { easy: 'Easy', medium: 'Medium', hard: 'Hard' };
  const MAX_UNDO = 300;

  let game = null;
  let selected = 40;
  let notesMode = false;
  let undoStack = [];

  const isGrid = (list) => Array.isArray(list) && list.length === 81 && list.every(Number.isInteger);

  function loadGame() {
    const saved = read(GAME_KEY, null);
    if (!saved || !LEVELS.includes(saved.level) || ![saved.puzzle, saved.solution, saved.values, saved.notes].every(isGrid)) return null;
    return Object.assign(saved, { elapsed: Number(saved.elapsed) || 0, won: Boolean(saved.won) });
  }

  const save = () => write(GAME_KEY, game);
  const hasProgress = () => !game.won && game.values.some((value, cell) => value && !game.puzzle[cell]);

  function startGame(level) {
    const { puzzle, solution } = Engine.generate(level);
    game = { level, puzzle, solution, values: puzzle.slice(), notes: new Array(81).fill(0), elapsed: 0, won: false };
    undoStack = [];
    notesMode = false;
    selected = game.values.indexOf(0);
    save();
    render();
  }

  function confirmNewGame() {
    return !hasProgress() || window.confirm('Start a new puzzle? Your current one will be lost.');
  }

  /* Board */
  const cells = Array.from({ length: 81 }, (_, cell) => {
    const classes = ['sudoku-cell'];
    if (cell % 9 === 2 || cell % 9 === 5) classes.push('box-right');
    const row = Math.floor(cell / 9);
    if (row === 2 || row === 5) classes.push('box-bottom');
    const button = el('button', classes.join(' '));
    button.type = 'button';
    button.dataset.base = classes.join(' ');
    button.setAttribute('role', 'gridcell');
    button.addEventListener('click', () => select(cell));
    return button;
  });
  $('board').append(...cells);

  const digitButtons = Array.from({ length: 9 }, (_, i) => {
    const button = el('button', '', String(i + 1));
    button.type = 'button';
    button.addEventListener('click', () => enterDigit(i + 1));
    return button;
  });
  $('digits').append(...digitButtons);

  function conflicts() {
    const found = new Set();
    Engine.UNITS.forEach((unit) => {
      unit.forEach((a) => {
        if (game.values[a] && unit.some((b) => b !== a && game.values[b] === game.values[a])) found.add(a);
      });
    });
    return found;
  }

  function notesGrid(mask) {
    const box = el('span', 'sudoku-notes');
    for (let digit = 1; digit <= 9; digit += 1) box.append(el('span', '', mask & (1 << digit) ? String(digit) : ''));
    return box;
  }

  function render() {
    const clashes = conflicts();
    const chosen = game.values[selected];
    const peers = new Set(Engine.PEERS[selected]);

    cells.forEach((button, cell) => {
      const value = game.values[cell];
      const classes = [button.dataset.base, game.puzzle[cell] ? 'is-given' : 'is-entered'];
      if (cell === selected) classes.push('is-selected');
      else if (chosen && value === chosen) classes.push('is-same');
      else if (peers.has(cell)) classes.push('is-peer');
      if (clashes.has(cell) && !game.puzzle[cell]) classes.push('is-conflict');
      button.className = classes.join(' ');
      button.tabIndex = cell === selected ? 0 : -1;
      if (value) button.textContent = String(value);
      else if (game.notes[cell]) button.replaceChildren(notesGrid(game.notes[cell]));
      else button.textContent = '';
      const place = 'Row ' + (Math.floor(cell / 9) + 1) + ', column ' + ((cell % 9) + 1);
      button.setAttribute('aria-label', place + ': ' + (value ? value + (game.puzzle[cell] ? ', given' : '') : 'empty'));
    });

    const counts = new Array(10).fill(0);
    game.values.forEach((value) => { counts[value] += 1; });
    digitButtons.forEach((button, i) => button.classList.toggle('is-used-up', counts[i + 1] >= 9));

    document.querySelectorAll('[data-level]').forEach((button) => {
      button.setAttribute('aria-pressed', String(button.dataset.level === game.level));
    });
    $('notes').setAttribute('aria-pressed', String(notesMode));
    $('undo').disabled = game.won || undoStack.length === 0;
    $('erase').disabled = game.won;
    $('hint').disabled = game.won;
    $('notes').disabled = game.won;
    $('board').classList.toggle('is-locked', game.won);
    $('digits').classList.toggle('is-locked', game.won);
    $('win').hidden = !game.won;
    renderTime();
  }

  function renderTime() {
    $('time').textContent = formatDuration(game.elapsed);
  }

  function select(cell, focus) {
    selected = cell;
    render();
    if (focus) cells[cell].focus();
  }

  function remember() {
    undoStack.push({ values: game.values.slice(), notes: game.notes.slice() });
    if (undoStack.length > MAX_UNDO) undoStack.shift();
  }

  function checkWin() {
    if (!game.values.every((value, cell) => value === game.solution[cell])) return;
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

  function enterDigit(digit) {
    if (game.won || game.puzzle[selected]) return;
    const bit = 1 << digit;
    if (notesMode) {
      if (game.values[selected]) return;
      remember();
      game.notes[selected] ^= bit;
    } else {
      remember();
      const clearing = game.values[selected] === digit;
      game.values[selected] = clearing ? 0 : digit;
      game.notes[selected] = 0;
      if (!clearing) Engine.PEERS[selected].forEach((peer) => { game.notes[peer] &= ~bit; });
      checkWin();
    }
    save();
    render();
  }

  function erase() {
    if (game.won || game.puzzle[selected] || (!game.values[selected] && !game.notes[selected])) return;
    remember();
    game.values[selected] = 0;
    game.notes[selected] = 0;
    save();
    render();
  }

  function undo() {
    if (game.won || !undoStack.length) return;
    Object.assign(game, undoStack.pop());
    save();
    render();
  }

  function hint() {
    const needsHelp = (cell) => game.values[cell] !== game.solution[cell];
    let target = selected;
    if (!needsHelp(target)) {
      target = game.values.findIndex((value, cell) => value && needsHelp(cell));
      if (target < 0) target = game.values.indexOf(0);
    }
    remember();
    selected = target;
    const digit = game.solution[target];
    game.values[target] = digit;
    game.notes[target] = 0;
    Engine.PEERS[target].forEach((peer) => { game.notes[peer] &= ~(1 << digit); });
    checkWin();
    save();
    render();
  }

  $('undo').addEventListener('click', undo);
  $('erase').addEventListener('click', erase);
  $('hint').addEventListener('click', hint);
  $('notes').addEventListener('click', () => {
    notesMode = !notesMode;
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

  document.addEventListener('keydown', (event) => {
    if (event.altKey) return;
    if ((event.ctrlKey || event.metaKey) && event.key.toLowerCase() === 'z') {
      event.preventDefault();
      undo();
      return;
    }
    if (event.ctrlKey || event.metaKey) return;

    const move = { ArrowUp: -9, ArrowDown: 9, ArrowLeft: -1, ArrowRight: 1 }[event.key];
    if (move) {
      const horizontal = Math.abs(move) === 1;
      const next = selected + move;
      const staysOnRow = Math.floor(next / 9) === Math.floor(selected / 9);
      if (next >= 0 && next < 81 && (!horizontal || staysOnRow)) select(next, true);
      event.preventDefault();
    } else if (/^[1-9]$/.test(event.key)) {
      enterDigit(Number(event.key));
    } else if (event.key === 'Backspace' || event.key === 'Delete' || event.key === '0') {
      erase();
    } else if (event.key.toLowerCase() === 'n') {
      notesMode = !notesMode;
      render();
    }
  });

  setInterval(() => {
    if (document.hidden || game.won) return;
    game.elapsed += 1;
    renderTime();
    save();
  }, 1000);

  game = loadGame();
  if (game) {
    const firstEmpty = game.values.indexOf(0);
    selected = firstEmpty >= 0 ? firstEmpty : 40;
    if (game.won) {
      $('win-text').textContent = LEVEL_NAMES[game.level] + ' in ' + formatDuration(game.elapsed) + '.';
    }
    render();
  } else {
    startGame('easy');
  }
})();
