/* 20 Questions: you think of something, the game asks yes-or-no questions and tries to guess it.
   Each thing gets a score; every answer makes the things that fit it more likely. The next question is
   the one that best splits what's still likely, so it narrows things down fast. */

(function () {
  'use strict';

  const { $, read, write } = window.V3Tools;
  const Play = window.V3Play;

  const LEARN_KEY = 'v3-tq-learned';
  const QUESTIONS = window.TQ_QUESTIONS;
  const QIDS = Object.keys(QUESTIONS);
  const MAX = 20;

  // How likely each answer is when the true value is yes (1), sometimes (0.5) or no (0). A little room for mistakes.
  const LIKELY = {
    yes: { 1: 0.9, 0.5: 0.45, 0: 0.04 },
    no: { 1: 0.04, 0.5: 0.45, 0: 0.9 },
    probably: { 1: 0.6, 0.5: 0.45, 0: 0.15 },
    probablynot: { 1: 0.15, 0.5: 0.45, 0: 0.6 },
    unknown: { 1: 1, 0.5: 1, 0: 1 },
  };
  const ANSWER_VALUE = { yes: 1, no: 0, probably: 0.75, probablynot: 0.25, unknown: 0.5 };

  function parse(line) {
    const [name, tags] = line.split('|');
    const facts = {};
    (tags || '').split(/\s+/).filter(Boolean).forEach((t) => {
      if (t.endsWith('~')) facts[t.slice(0, -1)] = 0.5;
      else facts[t] = 1;
    });
    return { name, facts };
  }

  let learned = read(LEARN_KEY, []);
  if (!Array.isArray(learned)) learned = [];
  let things = [];
  function loadThings() {
    things = window.TQ_THINGS.map(parse);
    learned.forEach((l) => {
      if (!l || typeof l.name !== 'string' || !l.facts) return;
      const same = things.find((t) => t.name.toLowerCase() === l.name.toLowerCase());
      // Something it already knew: the new answers count for half, to correct it slowly.
      if (same) QIDS.forEach((q) => { if (typeof l.facts[q] === 'number') same.facts[q] = ((same.facts[q] || 0) + l.facts[q]) / 2; });
      else things.push({ name: l.name, facts: l.facts, learned: true });
    });
  }
  loadThings();

  const value = (thing, q) => {
    const v = thing.facts[q];
    if (typeof v !== 'number') return thing.learned ? 0.5 : 0;
    return v;
  };
  // Likelihood of an answer for a value between 0 and 1.
  const chance = (answer, v) => {
    const table = LIKELY[answer];
    if (v === 1 || v === 0 || v === 0.5) return table[v];
    return v > 0.5 ? table[0.5] + (table[1] - table[0.5]) * (v - 0.5) * 2 : table[0] + (table[0.5] - table[0]) * v * 2;
  };

  let game = null;

  function weights() {
    const logs = things.map((t, i) => (game.rejected.has(i) ? -Infinity : game.log[i]));
    const top = Math.max(...logs);
    const w = logs.map((l) => (l === -Infinity ? 0 : Math.exp(l - top)));
    const sum = w.reduce((a, b) => a + b, 0) || 1;
    return w.map((x) => x / sum);
  }

  /* The question whose yes/no split is closest to half and half (weighted by how likely each thing is). */
  function bestQuestion() {
    const w = weights();
    let best = null;
    let bestScore = Infinity;
    QIDS.forEach((q) => {
      if (game.asked.has(q)) return;
      let yes = 0;
      let unsure = 0;
      things.forEach((t, i) => {
        const v = value(t, q);
        yes += w[i] * v;
        if (v > 0 && v < 1) unsure += w[i];
      });
      const score = Math.abs(yes - 0.5) + unsure * 0.25 + Play.random() * 0.02;
      if (score < bestScore) { bestScore = score; best = q; }
    });
    return best;
  }

  function start() {
    game = { log: things.map(() => 0), asked: new Set(), history: [], rejected: new Set(), count: 0, current: null, guessing: -1 };
    show('ask');
    nextQuestion();
  }

  function show(id) {
    ['intro', 'ask', 'guess', 'teach', 'over'].forEach((s) => { $(s).hidden = s !== id; });
  }

  function nextQuestion() {
    const w = weights();
    const top = w.indexOf(Math.max(...w));
    const sure = w[top];
    // Guess when fairly sure, or when out of questions.
    if (game.count >= MAX || (sure > 0.82 && game.count >= 3) || (sure > 0.55 && game.count >= 14)) return makeGuess(top);
    const q = bestQuestion();
    if (!q) return makeGuess(top);
    game.current = q;
    game.count++;
    $('count').textContent = 'Question ' + game.count + ' of ' + MAX;
    $('progress').style.width = (game.count / MAX) * 100 + '%';
    $('question').textContent = QUESTIONS[q];
    $('undo').disabled = !game.history.length;
    show('ask');
  }

  function answer(a) {
    if (!game || !game.current || $('ask').hidden) return;
    const q = game.current;
    game.asked.add(q);
    const before = game.log.slice();
    things.forEach((t, i) => { game.log[i] += Math.log(chance(a, value(t, q))); });
    game.history.push({ q, a, before });
    game.current = null;
    Play.sounds.tick();
    nextQuestion();
  }

  function undo() {
    if (!game || !game.history.length) return;
    const last = game.history.pop();
    game.log = last.before;
    game.asked.delete(last.q);
    game.count = Math.max(0, game.count - 2);
    nextQuestion();
  }

  function makeGuess(i) {
    if (game.rejected.size >= things.length || game.count >= MAX && game.rejected.has(i)) return giveUp();
    game.guessing = i;
    $('guess-name').textContent = (/^[aeiou]/i.test(things[i].name) ? 'An ' : 'A ') + things[i].name.toLowerCase() + '?';
    if (/^(sun|moon|ocean|rain|snow|fire|ice|lightning|grass|lego|milk|coffee|honey|bread|cheese|chocolate|spaghetti|popcorn|sushi|corn|broccoli|grapes)$/i.test(things[i].name)) {
      $('guess-name').textContent = things[i].name + '?';
    }
    show('guess');
    $('right').focus({ preventScroll: true });
  }

  function right() {
    const thing = things[game.guessing];
    remember(thing.name);
    Play.sounds.win();
    show('over');
    $('over-title').textContent = 'Got it in ' + game.count + '!';
    $('over-text').textContent = 'You were thinking of ' + thing.name.toLowerCase() + '. Want to try to beat me again?';
    $('again').focus({ preventScroll: true });
  }

  function wrong() {
    game.rejected.add(game.guessing);
    if (game.count >= MAX) return giveUp();
    nextQuestion();
  }

  function giveUp() {
    show('teach');
    $('teach-name').value = '';
    $('teach-name').focus({ preventScroll: true });
  }

  /* Saves the answers given this game, so next time it can guess this thing. */
  function remember(name) {
    const facts = {};
    game.history.forEach((h) => { if (h.a !== 'unknown') facts[h.q] = ANSWER_VALUE[h.a]; });
    if (!Object.keys(facts).length) return;
    learned.push({ name, facts });
    learned = learned.slice(-300);
    write(LEARN_KEY, learned);
    loadThings();
  }

  $('teach-form').addEventListener('submit', (event) => {
    event.preventDefault();
    const name = $('teach-name').value.trim().replace(/^(a|an|the)\s+/i, '');
    if (!name) return;
    const pretty = name.charAt(0).toUpperCase() + name.slice(1);
    remember(pretty);
    show('over');
    $('over-title').textContent = 'You beat me!';
    $('over-text').textContent = 'Thanks! I’ll remember ' + pretty.toLowerCase() + ' for next time.';
    $('again').focus({ preventScroll: true });
  });
  $('teach-skip').addEventListener('click', () => {
    show('over');
    $('over-title').textContent = 'You beat me!';
    $('over-text').textContent = 'Well played.';
  });

  document.querySelectorAll('.tq-a').forEach((b) => b.addEventListener('click', () => answer(b.dataset.a)));
  $('start').addEventListener('click', start);
  $('again').addEventListener('click', start);
  $('restart').addEventListener('click', start);
  $('undo').addEventListener('click', undo);
  $('right').addEventListener('click', right);
  $('wrong').addEventListener('click', wrong);

  $('known').textContent = 'I know about ' + things.length + ' things' + (learned.length ? ', including ones you’ve taught me' : '') + '.';

  window.V3Keys.add([
    { keys: ['y', '1'], label: 'Y or 1', does: 'Yes (or “that’s it”)', run: () => { if (!$('guess').hidden) { right(); return true; } answer('yes'); return true; } },
    { keys: ['n', '2'], label: 'N or 2', does: 'No (or “keep going”)', run: () => { if (!$('guess').hidden) { wrong(); return true; } answer('no'); return true; } },
    { keys: ['p', '3'], label: 'P or 3', does: 'Probably', run: () => { answer('probably'); return true; } },
    { keys: ['o', '4'], label: 'O or 4', does: 'Probably not', run: () => { answer('probablynot'); return true; } },
    { keys: ['d', '5'], label: 'D or 5', does: 'Don’t know', run: () => { answer('unknown'); return true; } },
    { keys: ['u', 'Backspace'], label: 'U', does: 'Undo last answer', press: '#undo' },
    { keys: ['Enter'], label: 'Enter', does: 'Start or play again', press: ['#start', '#again'] },
  ]);
  window.V3Keys.howTo({
    id: 'tq',
    title: '20 Questions',
    steps: [
      'Think of something: an animal, a food or drink, an everyday object, a vehicle, or something in nature. Keep it secret!',
      'Press “I’ve got one”. I’ll ask up to 20 yes-or-no questions.',
      'Answer Yes, No, Probably, Probably not or Don’t know. If you make a mistake, press Undo.',
      'When I think I know, I’ll guess. Tell me if I’m right.',
      'If I can’t get it, tell me what it was and I’ll learn it for next time (on this device).',
    ],
    tip: 'Play in a group: one person thinks of something and everyone votes on each answer.',
  });
})();
