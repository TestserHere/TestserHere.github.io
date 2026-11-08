/* Make 24: tap a number, an operator, then another number */

(function () {
  'use strict';

  const { $, read, write, el, formatDuration } = window.V3Tools;
  const Engine = window.Make24Engine;

  const STORE_KEY = 'v3-make24';
  const SPRINT_SECONDS = 120;
  const INTRO = 'Tap a number, an operator, then another number.';

  const saved = read(STORE_KEY, {});
  const stats = {
    level: saved.level === 'hard' ? 'hard' : 'easy',
    solved: Number(saved.solved) || 0,
    streak: Number(saved.streak) || 0,
    bestStreak: Number(saved.bestStreak) || 0,
    sprintBest: Object.assign({ easy: 0, hard: 0 }, saved.sprintBest),
  };

  const game = { numbers: [], slots: [], selected: null, operator: null, history: [], locked: false, hinted: false };
  const sprint = { active: false, endsAt: 0, score: 0 };
  let nextPuzzleTimer = null;

  const save = () => write(STORE_KEY, stats);

  function setMessage(text, tone) {
    const message = $('message');
    message.textContent = text;
    message.className = 'message' + (tone ? ' is-' + tone : '');
  }

  function renderStats() {
    if (sprint.active) {
      $('stat-1').textContent = formatDuration(Math.max(0, Math.ceil((sprint.endsAt - performance.now()) / 1000)));
      $('stat-2').textContent = sprint.score;
      $('stat-3').textContent = stats.sprintBest[stats.level];
    } else {
      $('stat-1').textContent = stats.solved;
      $('stat-2').textContent = stats.streak;
      $('stat-3').textContent = stats.bestStreak;
    }
    $('stat-1-label').textContent = sprint.active ? 'Time left' : 'Solved';
    $('stat-2-label').textContent = sprint.active ? 'Solved' : 'Streak';
    $('stat-3-label').textContent = sprint.active ? 'Best sprint' : 'Best streak';
  }

  function render(won) {
    $('tiles').replaceChildren(...game.slots.map((value, index) => {
      if (!value) return el('button', 'number-tile is-empty');
      const classes = ['number-tile'];
      if (value.d !== 1) classes.push('is-fraction');
      if (won) classes.push('is-win');
      const tile = el('button', classes.join(' '), Engine.format(value));
      tile.type = 'button';
      tile.setAttribute('aria-pressed', String(game.selected === index));
      tile.addEventListener('click', () => tapTile(index));
      return tile;
    }));

    document.querySelectorAll('[data-op]').forEach((button) => {
      button.disabled = game.selected === null || game.locked;
      button.setAttribute('aria-pressed', String(button.dataset.op === game.operator));
    });
    document.querySelectorAll('[data-level]').forEach((button) => {
      button.setAttribute('aria-pressed', String(button.dataset.level === stats.level));
      button.disabled = sprint.active;
    });
    $('undo').disabled = game.locked || game.history.length === 0;
    $('reset').disabled = game.locked || game.history.length === 0;
    $('hint').disabled = game.locked;
    $('skip').disabled = game.locked;
    $('sprint').textContent = sprint.active ? 'End sprint' : 'Start 2-minute sprint';
    renderStats();
  }

  function startPuzzle(message) {
    clearTimeout(nextPuzzleTimer);
    game.numbers = Engine.newPuzzle(stats.level);
    game.slots = game.numbers.slice();
    game.selected = null;
    game.operator = null;
    game.history = [];
    game.locked = false;
    game.hinted = false;
    setMessage(message || INTRO);
    render(false);
  }

  function winPuzzle() {
    game.locked = true;
    game.selected = null;
    if (sprint.active) {
      sprint.score += 1;
    } else {
      stats.solved += 1;
      if (game.hinted) {
        setMessage('24! Solved with a hint, so your streak stays the same.', 'good');
      } else {
        stats.streak += 1;
        stats.bestStreak = Math.max(stats.bestStreak, stats.streak);
      }
      save();
    }
    if (sprint.active || !game.hinted) setMessage('24! Well done.', 'good');
    render(true);
    nextPuzzleTimer = setTimeout(() => startPuzzle(), sprint.active ? 450 : 1000);
  }

  function combine(from, to) {
    const value = Engine.apply(game.operator, game.slots[from], game.slots[to]);
    if (!value) {
      game.operator = null;
      setMessage("You can't divide by 0.", 'bad');
      render(false);
      return;
    }
    game.history.push(game.slots.slice());
    game.slots[from] = null;
    game.slots[to] = value;
    game.selected = to;
    game.operator = null;

    const left = game.slots.filter(Boolean);
    if (left.length > 1) {
      setMessage(INTRO);
    } else if (Engine.is24(value)) {
      winPuzzle();
      return;
    } else {
      game.selected = null;
      setMessage('That makes ' + Engine.format(value) + ', not 24. Undo and try another way.', 'bad');
    }
    render(false);
  }

  function tapTile(index) {
    if (game.locked) return;
    if (game.selected === index) {
      game.selected = null;
      game.operator = null;
    } else if (game.selected !== null && game.operator) {
      combine(game.selected, index);
      return;
    } else {
      game.selected = index;
    }
    render(false);
  }

  $('operators').addEventListener('click', (event) => {
    const button = event.target.closest('[data-op]');
    if (!button || button.disabled) return;
    game.operator = game.operator === button.dataset.op ? null : button.dataset.op;
    render(false);
  });

  $('undo').addEventListener('click', () => {
    game.slots = game.history.pop();
    game.selected = null;
    game.operator = null;
    setMessage(INTRO);
    render(false);
  });

  $('reset').addEventListener('click', () => {
    game.slots = game.numbers.slice();
    game.history = [];
    game.selected = null;
    game.operator = null;
    setMessage(INTRO);
    render(false);
  });

  $('hint').addEventListener('click', () => {
    const left = game.slots.filter(Boolean);
    const answer = left.length > 1 ? Engine.solve(left) : null;
    if (!answer) {
      setMessage("These numbers can't reach 24 any more. Tap Undo.", 'bad');
      return;
    }
    if (!sprint.active) game.hinted = true;
    const step = answer.steps[0];
    setMessage('Try ' + step.a + ' ' + step.operator + ' ' + step.b + ' next.');
  });

  $('skip').addEventListener('click', () => {
    if (sprint.active) {
      startPuzzle();
      return;
    }
    stats.streak = 0;
    save();
    startPuzzle('Skipped. One answer was ' + Engine.solve(game.numbers).expr + '.');
  });

  document.querySelectorAll('[data-level]').forEach((button) => {
    button.addEventListener('click', () => {
      stats.level = button.dataset.level;
      save();
      startPuzzle();
    });
  });

  /* Sprint */
  function startSprint() {
    sprint.active = true;
    sprint.score = 0;
    sprint.endsAt = performance.now() + SPRINT_SECONDS * 1000;
    $('play').hidden = false;
    $('sprint-end').hidden = true;
    startPuzzle('Solve as many as you can!');
  }

  function endSprint() {
    clearTimeout(nextPuzzleTimer);
    sprint.active = false;
    const beatBest = sprint.score > stats.sprintBest[stats.level];
    if (beatBest) {
      stats.sprintBest[stats.level] = sprint.score;
      save();
    }
    $('sprint-score').textContent = sprint.score;
    $('sprint-best').textContent = beatBest ? 'A new best!' : 'Your best is ' + stats.sprintBest[stats.level] + '.';
    $('play').hidden = true;
    $('sprint-end').hidden = false;
  }

  $('sprint').addEventListener('click', () => {
    if (sprint.active) endSprint();
    else startSprint();
  });

  $('sprint-again').addEventListener('click', startSprint);

  $('sprint-done').addEventListener('click', () => {
    $('sprint-end').hidden = true;
    $('play').hidden = false;
    startPuzzle();
  });

  setInterval(() => {
    if (!sprint.active) return;
    if (performance.now() >= sprint.endsAt) endSprint();
    else renderStats();
  }, 200);

  startPuzzle();
})();
