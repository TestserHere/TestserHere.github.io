/* Reaction Duel: wait for green, then tap your side first. Solo mode times your reactions. */

(function () {
  'use strict';

  const { $, read, write, el } = window.V3Tools;
  const Play = window.V3Play;

  const KEY = 'v3-duel';
  const PLAYERS = [
    { name: 'Blue', color: '#0a84ff', keys: ['a'] },
    { name: 'Red', color: '#ff453a', keys: ['l'] },
    { name: 'Green', color: '#30d158', keys: ['z'] },
    { name: 'Purple', color: '#bf5af2', keys: ['m'] },
  ];
  const FOUR_KEYS = [['q'], ['p'], ['z'], ['m']];
  const SOLO_TRIES = 5;

  const saved = read(KEY, {});
  const state = {
    players: [1, 2, 4].includes(saved.players) ? saved.players : 2,
    target: [3, 5, 10].includes(saved.target) ? saved.target : 5,
    tricks: !!saved.tricks,
    soloBest: Number(saved.soloBest) || 0,
  };
  const remember = () => write(KEY, state);

  let match = null; // { scores, times (solo), round }
  let round = null; // { phase: 'wait'|'decoy'|'go'|'done', goAt, timers }

  const keysFor = (i) => (state.players === 4 ? FOUR_KEYS[i] : state.players === 1 ? [' '] : PLAYERS[i].keys);
  const zones = () => Array.from($('arena').children);

  function build() {
    const arena = $('arena');
    arena.className = 'arena is-' + state.players;
    arena.dataset.signal = '';
    arena.replaceChildren(...Array.from({ length: state.players }, (_, i) => {
      const zone = el('button', 'zone');
      zone.type = 'button';
      zone.style.setProperty('--c', state.players === 1 ? 'var(--blue)' : PLAYERS[i].color);
      const keys = keysFor(i).map((k) => (k === ' ' ? 'Space' : k.toUpperCase())).join(' or ');
      zone.append(el('span', 'zone-name', state.players === 1 ? 'Your reactions' : PLAYERS[i].name),
        el('span', 'zone-score', state.players === 1 ? '' : '0'), el('span', 'zone-msg', ''), el('span', 'zone-key', 'Key ' + keys));
      if (state.players === 1) zone.append(el('ol', 'solo-times'));
      zone.setAttribute('aria-label', (state.players === 1 ? 'Tap area' : PLAYERS[i].name + ' tap area') + ', key ' + keys);
      zone.addEventListener('pointerdown', (event) => {
        event.preventDefault();
        hit(i, event.timeStamp);
      });
      zone.addEventListener('click', (event) => { if (event.detail === 0) hit(i, performance.now()); });
      return zone;
    }));
    showIdle();
  }

  function msg(i, text) { zones()[i].querySelector('.zone-msg').textContent = text; }
  const msgAll = (text) => zones().forEach((_, i) => msg(i, text));

  function showIdle() {
    if (state.players === 1) {
      const z = zones()[0];
      z.querySelector('.zone-score').textContent = state.soloBest ? state.soloBest + ' ms' : '';
      msg(0, state.soloBest ? 'Your best average' : 'Press Start');
    } else {
      msgAll('Press Start');
    }
  }

  function clearRound() {
    if (round) round.timers.forEach(clearTimeout);
    round = null;
  }

  function startMatch() {
    clearRound();
    match = { scores: Array(state.players).fill(0), times: [] };
    zones().forEach((z) => {
      z.classList.remove('is-winner', 'is-foul');
      const s = z.querySelector('.zone-score');
      s.textContent = state.players === 1 ? '' : '0';
      const list = z.querySelector('.solo-times');
      if (list) list.replaceChildren();
    });
    $('start').textContent = 'Restart';
    $('setup').hidden = true;
    nextRound();
  }

  function nextRound() {
    clearRound();
    const arena = $('arena');
    zones().forEach((z) => z.classList.remove('is-winner', 'is-foul'));
    round = { phase: 'wait', goAt: 0, timers: [], fouled: new Set() };
    arena.dataset.signal = 'wait';
    msgAll('Wait for green…');
    const delay = 1500 + Play.random() * 3000;
    if (state.tricks) {
      // Up to two fake orange signals before the real one.
      const fakes = Play.int(3);
      for (let k = 0; k < fakes; k++) {
        const at = 500 + Play.random() * (delay - 1100);
        round.timers.push(setTimeout(() => {
          if (!round || round.phase !== 'wait') return;
          round.phase = 'decoy';
          arena.dataset.signal = 'decoy';
          msgAll('Not yet!');
          Play.tone(330, 120, { type: 'square', volume: 0.06 });
          round.timers.push(setTimeout(() => {
            if (!round || round.phase !== 'decoy') return;
            round.phase = 'wait';
            arena.dataset.signal = 'wait';
            msgAll('Wait for green…');
          }, 550));
        }, at));
      }
    }
    round.timers.push(setTimeout(function go() {
      if (!round) return;
      if (round.phase === 'decoy') { round.timers.push(setTimeout(go, 600)); return; }
      round.phase = 'go';
      arena.dataset.signal = 'go';
      msgAll('TAP!');
      Play.sounds.go();
      requestAnimationFrame(() => { if (round) round.goAt = performance.now(); });
      round.goAt = performance.now();
    }, delay));
  }

  function hit(i, at) {
    if (!match || !round) return;
    if (round.phase === 'done') return;
    if (round.phase !== 'go') return foul(i);
    if (round.fouled.has(i)) return;
    const ms = Math.max(1, Math.round(at - round.goAt));
    round.phase = 'done';
    round.timers.forEach(clearTimeout);
    $('arena').dataset.signal = '';
    Play.sounds.good();
    Play.vibrate(40);
    if (state.players === 1) return soloTime(ms);
    match.scores[i]++;
    const z = zones()[i];
    z.classList.add('is-winner');
    z.querySelector('.zone-score').textContent = match.scores[i];
    zones().forEach((_, k) => msg(k, k === i ? ms + ' ms' : PLAYERS[i].name + ' was faster'));
    if (match.scores[i] >= state.target) return endMatch(i);
    round.timers.push(setTimeout(nextRound, 1800));
  }

  function foul(i) {
    if (round.fouled.has(i)) return;
    round.fouled.add(i);
    Play.sounds.bad();
    Play.vibrate(150);
    const z = zones()[i];
    z.classList.add('is-foul');
    msg(i, 'Too soon!');
    if (state.players === 1) {
      round.phase = 'done';
      round.timers.forEach(clearTimeout);
      $('arena').dataset.signal = '';
      round.timers.push(setTimeout(nextRound, 1300));
      return;
    }
    // Too soon: the other player scores (2 players), or you lose a point (4 players).
    if (state.players === 2) {
      round.phase = 'done';
      round.timers.forEach(clearTimeout);
      $('arena').dataset.signal = '';
      const other = 1 - i;
      match.scores[other]++;
      zones()[other].querySelector('.zone-score').textContent = match.scores[other];
      msg(other, 'Point to you!');
      if (match.scores[other] >= state.target) return endMatch(other);
      round.timers.push(setTimeout(nextRound, 1800));
      return;
    }
    match.scores[i] = Math.max(0, match.scores[i] - 1);
    z.querySelector('.zone-score').textContent = match.scores[i];
    msg(i, 'Too soon! −1');
    if (round.fouled.size >= state.players) {
      round.phase = 'done';
      round.timers.forEach(clearTimeout);
      round.timers.push(setTimeout(nextRound, 1500));
    }
  }

  function soloTime(ms) {
    match.times.push(ms);
    const z = zones()[0];
    z.querySelector('.zone-score').textContent = ms + ' ms';
    z.querySelector('.solo-times').appendChild(el('li', '', ms + ' ms'));
    msg(0, match.times.length < SOLO_TRIES ? 'Try ' + (match.times.length + 1) + ' of ' + SOLO_TRIES + ' coming…' : '');
    if (match.times.length < SOLO_TRIES) {
      round.timers.push(setTimeout(nextRound, 1400));
      return;
    }
    const average = Math.round(match.times.reduce((a, b) => a + b, 0) / match.times.length);
    const best = !state.soloBest || average < state.soloBest;
    if (best) { state.soloBest = average; remember(); }
    z.querySelector('.zone-score').textContent = average + ' ms';
    msg(0, 'Average' + (best ? ', your best yet!' : '. Your best is ' + state.soloBest + ' ms.'));
    finishMatch();
    Play.sounds.win();
  }

  function endMatch(i) {
    zones().forEach((z, k) => { z.classList.toggle('is-winner', k === i); msg(k, k === i ? 'Winner!' : PLAYERS[i].name + ' wins'); });
    Play.sounds.win();
    finishMatch();
  }

  function finishMatch() {
    if (round) { round.phase = 'done'; round.timers.forEach(clearTimeout); }
    match = null;
    $('arena').dataset.signal = '';
    $('start').textContent = 'Play again';
    $('setup').hidden = false;
    $('start').focus({ preventScroll: true });
  }

  function reset() {
    clearRound();
    match = null;
    $('setup').hidden = false;
    $('start').textContent = 'Start';
    build();
  }

  Play.segmented($('players'), state.players, (v) => { state.players = Number(v); remember(); reset(); });
  Play.segmented($('target'), state.target, (v) => { state.target = Number(v); remember(); });
  $('tricks').checked = state.tricks;
  $('tricks').addEventListener('change', () => { state.tricks = $('tricks').checked; remember(); });
  $('start').addEventListener('click', startMatch);
  $('reset').addEventListener('click', reset);
  build();

  // Player keys: these must react instantly, so they're handled here rather than as normal shortcuts.
  document.addEventListener('keydown', (event) => {
    if (event.repeat || event.ctrlKey || event.metaKey || event.altKey || document.querySelector('dialog[open]')) return;
    if (/^(INPUT|TEXTAREA|SELECT)$/.test(event.target.tagName) && event.target.type !== 'checkbox') return;
    const key = event.key.toLowerCase();
    if (!match) return;
    for (let i = 0; i < state.players; i++) {
      if (keysFor(i).includes(key)) {
        event.preventDefault();
        hit(i, event.timeStamp);
        return;
      }
    }
  });

  window.V3Keys.add([
    { keys: ['Enter'], label: 'Enter', does: 'Start or play again', press: '#start' },
    { keys: [' '], label: 'Space', does: 'Solo: tap. Otherwise start', run: () => { if (match) return true; $('start').click(); return true; } },
    { keys: ['a', 'l'], label: 'A or L', does: '2 players: Blue taps A, Red taps L', run: () => true },
    { keys: ['q', 'p', 'z', 'm'], label: 'Q, P, Z, M', does: '4 players: Blue Q, Red P, Green Z, Purple M', run: () => true },
    { keys: ['r'], label: 'R', does: 'Reset', press: '#reset' },
  ]);
  window.V3Keys.howTo({
    id: 'duel',
    title: 'Reaction Duel',
    steps: [
      'Choose Solo, 2 players or 4 players. Each player gets their own part of the screen (or a key on a keyboard).',
      'Press Start and wait. When the screen turns green, tap your part as fast as you can.',
      'The fastest tap scores a point. First to the target score wins.',
      'Tap too soon and it’s a foul: with 2 players the other player scores; with 4, you lose a point.',
      'Solo: five tries, and you get your average reaction time in milliseconds.',
      'Tricks: the screen sometimes flashes orange first. Don’t fall for it!',
    ],
    tip: 'On a phone with 2 players, lay it flat between you: the top half is turned to face the player opposite.',
  });
})();
