/* Word Ladder: change one letter at a time to get from one word to another. Works offline. */

(function () {
  'use strict';

  const { $, read, write, el } = window.V3Tools;
  const Daily = window.V3Daily;

  const KEY = 'v3-ladder';
  const WORDS = new Set(window.WORDS4);
  const MIN_STEPS = 4; // shortest route, in moves
  const MAX_STEPS = 6;

  function neighbours(word) {
    const out = [];
    for (let i = 0; i < 4; i++) {
      for (let c = 97; c <= 122; c++) {
        const next = word.slice(0, i) + String.fromCharCode(c) + word.slice(i + 1);
        if (next !== word && WORDS.has(next)) out.push(next);
      }
    }
    return out;
  }

  /* Shortest distances from `word` to every word it can reach. */
  function distances(word) {
    const dist = new Map([[word, 0]]);
    const queue = [word];
    for (let i = 0; i < queue.length; i++) {
      const here = queue[i];
      for (const next of neighbours(here)) {
        if (!dist.has(next)) {
          dist.set(next, dist.get(here) + 1);
          queue.push(next);
        }
      }
    }
    return dist;
  }

  const oneApart = (a, b) => a.length === 4 && b.length === 4 && [...a].filter((ch, i) => ch !== b[i]).length === 1;

  /* A puzzle whose shortest route is MIN_STEPS to MAX_STEPS moves. */
  function makePuzzle(random) {
    const list = window.WORDS4;
    for (let tries = 0; tries < 400; tries++) {
      const start = list[Math.floor(random() * list.length)];
      const dist = distances(start);
      const options = [...dist].filter(([, d]) => d >= MIN_STEPS && d <= MAX_STEPS).map(([w]) => w).sort();
      if (options.length) {
        const end = options[Math.floor(random() * options.length)];
        return { start, end, par: dist.get(end) };
      }
    }
    return { start: 'cold', end: 'warm', par: 4 };
  }

  const saved = read(KEY, {});
  const state = {
    kind: saved.kind === 'practice' ? 'practice' : 'daily',
    daily: saved.daily && saved.daily.day === Daily.today() ? saved.daily : null,
    practice: saved.practice && saved.practice.start ? saved.practice : null,
    streak: saved.streak && typeof saved.streak.count === 'number' ? saved.streak : { count: 0, last: '' },
  };
  const remember = () => write(KEY, state);

  function current() {
    if (state.kind === 'daily') {
      if (!state.daily) {
        const day = Daily.today();
        const p = makePuzzle(Daily.rng('ladder-' + day));
        state.daily = { day, start: p.start, end: p.end, par: p.par, steps: [p.start], hints: 0, done: false };
      }
      return state.daily;
    }
    if (!state.practice) newPractice();
    return state.practice;
  }

  function newPractice() {
    const p = makePuzzle(Math.random);
    state.practice = { start: p.start, end: p.end, par: p.par, steps: [p.start], hints: 0, done: false };
  }

  let endDist = null;
  let endFor = '';
  function distToEnd(game) {
    if (endFor !== game.end) {
      endDist = distances(game.end);
      endFor = game.end;
    }
    return endDist;
  }

  function setMessage(text, kind) {
    $('message').textContent = text;
    $('message').className = 'message' + (kind ? ' is-' + kind : '');
  }

  function render() {
    const game = current();
    $('kind').querySelectorAll('button').forEach((b) => b.setAttribute('aria-pressed', String(b.dataset.kind === state.kind)));
    $('info').textContent = state.kind === 'daily' ? 'Daily · ' + Daily.label(game.day) : 'Practice';
    $('par').textContent = 'Best possible: ' + game.par + ' moves';

    const ladder = $('ladder');
    ladder.replaceChildren();
    game.steps.forEach((word, i) => {
      const li = el('li', 'rung' + (i === 0 ? ' is-start' : ''));
      const prev = game.steps[i - 1];
      [...word].forEach((ch, j) => li.appendChild(el('span', 'tile' + (prev && prev[j] !== ch ? ' is-changed' : '') + (ch === game.end[j] ? ' is-match' : ''), ch)));
      ladder.appendChild(li);
    });
    if (!game.done) {
      const gap = el('li', 'rung is-gap');
      gap.appendChild(el('span', 'gap-text', game.steps.length - 1 + ' moves so far'));
      ladder.appendChild(gap);
      const end = el('li', 'rung is-end');
      [...game.end].forEach((ch) => end.appendChild(el('span', 'tile', ch)));
      ladder.appendChild(end);
    }

    $('form').hidden = game.done;
    $('tools').hidden = game.done;
    $('undo').disabled = game.steps.length < 2;
    $('new').hidden = state.kind === 'daily';
    $('done').hidden = !game.done;
    if (game.done) {
      const moves = game.steps.length - 1;
      $('done-title').textContent = moves === game.par ? 'Perfect!' : 'Solved!';
      $('done-text').textContent = 'You took ' + moves + (moves === 1 ? ' move' : ' moves') + ' (best possible ' + game.par + ')'
        + (game.hints ? ', with ' + game.hints + (game.hints === 1 ? ' hint' : ' hints') : '') + '.'
        + (state.kind === 'daily' ? ' Daily streak: ' + state.streak.count + '.' : '');
      $('share').hidden = state.kind !== 'daily';
      $('again').textContent = state.kind === 'daily' ? 'Practice puzzle' : 'Another puzzle';
    }
  }

  function addWord(raw) {
    const game = current();
    if (game.done) return;
    const word = raw.trim().toLowerCase();
    const last = game.steps[game.steps.length - 1];
    if (!/^[a-z]{4}$/.test(word)) return setMessage('Type a four-letter word.', 'bad');
    if (!oneApart(last, word)) return setMessage('Change exactly one letter of “' + last.toUpperCase() + '”.', 'bad');
    if (!WORDS.has(word)) return setMessage('“' + word.toUpperCase() + '” isn’t in this game’s word list.', 'bad');
    if (game.steps.includes(word)) return setMessage('You’ve already used “' + word.toUpperCase() + '”.', 'bad');
    game.steps.push(word);
    $('next').value = '';
    if (word === game.end) {
      game.done = true;
      if (state.kind === 'daily') {
        const yesterday = Daily.today(new Date(Date.now() - 86400000));
        state.streak = { count: state.streak.last === yesterday ? state.streak.count + 1 : state.streak.last === game.day ? state.streak.count : 1, last: game.day };
      }
      setMessage('');
    } else {
      const left = distToEnd(game).get(word);
      setMessage(left === undefined ? 'Hmm, there’s no way to the end from here. Try Undo.' : left === 1 ? 'One more!' : '');
    }
    remember();
    render();
  }

  $('form').addEventListener('submit', (event) => {
    event.preventDefault();
    addWord($('next').value);
  });

  $('undo').addEventListener('click', () => {
    const game = current();
    if (game.steps.length < 2 || game.done) return;
    game.steps.pop();
    setMessage('');
    remember();
    render();
  });

  /* Shows the next word on a shortest route from where the player is now. */
  $('hint').addEventListener('click', () => {
    const game = current();
    const last = game.steps[game.steps.length - 1];
    const dist = distToEnd(game);
    const here = dist.get(last);
    if (here === undefined) return setMessage('No route from “' + last.toUpperCase() + '”. Use Undo to go back.', 'bad');
    const options = neighbours(last).filter((w) => dist.get(w) === here - 1 && !game.steps.includes(w));
    if (!options.length) return setMessage('Try going back a step.');
    game.hints++;
    remember();
    setMessage('Try “' + options[0].toUpperCase() + '”.');
    $('next').value = options[0];
    $('next').focus();
  });

  $('new').addEventListener('click', () => {
    newPractice();
    setMessage('');
    remember();
    render();
  });

  $('kind').querySelectorAll('button').forEach((b) => b.addEventListener('click', () => {
    state.kind = b.dataset.kind;
    setMessage('');
    remember();
    render();
  }));

  $('again').addEventListener('click', () => {
    if (state.kind === 'practice') newPractice();
    state.kind = 'practice';
    setMessage('');
    remember();
    render();
  });

  $('share').addEventListener('click', async () => {
    const game = current();
    const moves = game.steps.length - 1;
    const text = 'Word Ladder, ' + Daily.label(game.day) + ': ' + game.start.toUpperCase() + ' to ' + game.end.toUpperCase()
      + ' in ' + moves + ' (best ' + game.par + ')' + (game.hints ? ', ' + game.hints + ' hints' : '') + '\n' + location.href.split('?')[0];
    $('share').textContent = (await Daily.share(text)) ? 'Copied!' : 'Couldn’t copy';
    setTimeout(() => { $('share').textContent = 'Copy result'; }, 2000);
  });

  // A new day while the page is open: start the new daily puzzle.
  document.addEventListener('visibilitychange', () => {
    if (document.visibilityState === 'visible' && state.daily && state.daily.day !== Daily.today()) {
      state.daily = null;
      render();
    }
  });

  window.V3Keys.add([
    { keys: ['/'], label: '/', does: 'Type the next word', focus: '#next' },
    { keys: ['u', 'Backspace'], label: 'U or Backspace', does: 'Undo', press: '#undo' },
    { keys: ['h'], label: 'H', does: 'Hint', press: '#hint' },
    { keys: ['n'], label: 'N', does: 'New practice puzzle', press: ['#new', '#again'] },
  ]);

  remember();
  render();
  if (!current().done) $('next').focus({ preventScroll: true });
})();
