/* Copy Cat: watch the pattern of lights and sounds, then copy it. It grows by one each round. */

(function () {
  'use strict';

  const { $, read, write, setupStepper } = window.V3Tools;
  const Play = window.V3Play;

  const KEY = 'v3-copycat';
  const NOTES = [392, 330, 262, 196];
  const SPEEDS = { slow: 650, normal: 480, fast: 330 };
  const COLOR_NAMES = ['Green', 'Red', 'Yellow', 'Blue'];

  const saved = read(KEY, {});
  const state = {
    mode: ['classic', 'reverse', 'party'].includes(saved.mode) ? saved.mode : 'classic',
    speed: SPEEDS[saved.speed] ? saved.speed : 'normal',
    players: Math.min(6, Math.max(2, Number(saved.players) || 2)),
    best: Object.assign({ classic: 0, reverse: 0, party: 0 }, saved.best || {}),
  };
  const remember = () => write(KEY, state);

  const pads = Array.from(document.querySelectorAll('.cc-pad'));
  let game = null;
  let token = 0;

  const wait = (ms) => new Promise((r) => setTimeout(r, ms));

  function light(i, ms) {
    const pad = pads[i];
    pad.classList.add('is-lit');
    Play.tone(NOTES[i], Math.min(ms, 600), { type: 'triangle', volume: 0.22 });
    setTimeout(() => pad.classList.remove('is-lit'), ms);
  }

  function setStatus(text, bad) {
    $('status').textContent = text;
    $('status').classList.toggle('is-bad', !!bad);
  }

  function lockPads(locked) {
    pads.forEach((p) => { p.disabled = locked; });
    $('board').classList.toggle('is-off', locked && !game);
  }

  function showInfo() {
    $('best').textContent = state.best[state.mode];
    $('players-row').hidden = state.mode !== 'party';
    if (!game) $('round').textContent = 'Ready';
  }

  /* The step that should come next: reversed in Backwards mode. */
  const expected = () => (state.mode === 'reverse' ? game.seq[game.seq.length - 1 - game.pos] : game.seq[game.pos]);

  async function playback() {
    const mine = ++token;
    game.listening = false;
    lockPads(true);
    const gap = SPEEDS[state.speed] * Math.max(0.6, 1 - Math.floor(game.seq.length / 5) * 0.08);
    await wait(600);
    for (const i of game.seq) {
      if (mine !== token) return;
      light(i, gap * 0.7);
      await wait(gap);
    }
    if (mine !== token) return;
    game.pos = 0;
    game.listening = true;
    lockPads(false);
    setStatus(state.mode === 'reverse' ? 'Your turn: copy it backwards.' : 'Your turn: copy it.');
  }

  function start() {
    token++;
    game = { seq: [], pos: 0, listening: false, player: 0, alive: [], adding: false };
    $('start').textContent = 'Restart';
    if (state.mode === 'party') {
      game.alive = Array.from({ length: state.players }, (_, i) => i);
      game.seq = [];
      game.adding = true;
      game.listening = true;
      lockPads(false);
      $('round').textContent = 'Player 1';
      setStatus('Player 1: tap any colour to start the pattern.');
      return;
    }
    game.seq.push(Play.int(4));
    $('round').textContent = 'Round 1';
    setStatus('Watch…');
    playback();
  }

  function score() { return state.mode === 'party' ? game.seq.length : game.seq.length - 1; }

  function lose(text) {
    token++;
    game.listening = false;
    Play.sounds.bad();
    Play.vibrate(200);
    lockPads(true);
    if (state.mode === 'party') {
      const out = game.player;
      game.alive = game.alive.filter((p) => p !== out);
      if (game.alive.length === 1) {
        const winner = game.alive[0];
        if (game.seq.length > state.best.party) { state.best.party = game.seq.length; remember(); }
        showInfo();
        setStatus('Player ' + (out + 1) + ' is out. Player ' + (winner + 1) + ' wins with a pattern of ' + game.seq.length + '!');
        Play.sounds.win();
        game = null;
        $('start').textContent = 'Start';
        return;
      }
      setStatus('Player ' + (out + 1) + ' is out! ' + text, true);
      // Next player along after the one who went out.
      const after = game.alive.find((p) => p > out);
      game.player = after === undefined ? game.alive[0] : after;
      setTimeout(() => partyTurn(), 1600);
      return;
    }
    const got = score();
    const best = got > state.best[state.mode];
    if (best) { state.best[state.mode] = got; remember(); }
    showInfo();
    setStatus(text + ' You copied ' + got + (got === 1 ? ' step' : ' steps') + (best ? '. New best!' : '.'), true);
    game = null;
    $('start').textContent = 'Start';
  }

  function partyTurn() {
    if (!game) return;
    game.pos = 0;
    game.adding = false;
    game.listening = true;
    lockPads(false);
    $('round').textContent = 'Player ' + (game.player + 1);
    setStatus('Player ' + (game.player + 1) + ': copy the ' + game.seq.length + ' steps, then add one.');
  }

  function press(i) {
    if (!game || !game.listening) return;
    light(i, 220);
    if (state.mode === 'party' && game.adding) {
      game.seq.push(i);
      game.listening = false;
      lockPads(true);
      Play.sounds.good();
      setStatus('Added! Pass to the next player.');
      const at = game.alive.indexOf(game.player);
      game.player = game.alive[(at + 1) % game.alive.length];
      setTimeout(partyTurn, 1200);
      return;
    }
    if (i !== expected()) return lose('That was ' + COLOR_NAMES[i] + ', not ' + COLOR_NAMES[expected()] + '.');
    game.pos++;
    if (game.pos < game.seq.length) return;
    if (state.mode === 'party') {
      game.adding = true;
      setStatus('Now add one more colour.');
      return;
    }
    game.listening = false;
    lockPads(true);
    setStatus('Nice! Watch…');
    game.seq.push(Play.int(4));
    $('round').textContent = 'Round ' + game.seq.length;
    if (score() > state.best[state.mode]) $('best').textContent = score();
    playback();
  }

  pads.forEach((pad, i) => pad.addEventListener('pointerdown', (event) => {
    event.preventDefault();
    press(i);
  }));
  // Keyboard Enter or Space on a focused pad.
  pads.forEach((pad, i) => pad.addEventListener('click', (event) => { if (event.detail === 0) press(i); }));

  $('start').addEventListener('click', start);

  Play.segmented($('mode'), state.mode, (v) => { state.mode = v; remember(); token++; game = null; $('start').textContent = 'Start'; lockPads(true); showInfo(); setStatus('Press Start, watch the pattern, then copy it.'); });
  Play.segmented($('speed'), state.speed, (v) => { state.speed = v; remember(); });
  setupStepper($('players'), { read: () => ({ value: state.players, min: 2, max: 6 }), write: (v) => { state.players = v; remember(); } });

  lockPads(true);
  showInfo();

  window.V3Keys.add([
    { keys: ['1', 'q'], label: '1 or Q', does: 'Green', run: () => { press(0); return true; } },
    { keys: ['2', 'w'], label: '2 or W', does: 'Red', run: () => { press(1); return true; } },
    { keys: ['3', 'a'], label: '3 or A', does: 'Yellow', run: () => { press(2); return true; } },
    { keys: ['4', 's'], label: '4 or S', does: 'Blue', run: () => { press(3); return true; } },
    { keys: ['Enter', ' '], label: 'Enter or Space', does: 'Start or restart', press: '#start' },
  ]);
  window.V3Keys.howTo({
    id: 'copycat',
    title: 'Copy Cat',
    steps: [
      'Press Start. The coloured pads light up and play a pattern.',
      'Copy the pattern by tapping the same pads in the same order.',
      'Get it right and the pattern grows by one. One wrong tap and the game ends.',
      'Backwards: copy the pattern in reverse order.',
      'Party (2 to 6 players, one device): each player copies the pattern, then adds one colour and passes it on. Miss a step and you’re out. Last one in wins.',
    ],
    tip: 'The pattern speeds up as it gets longer. Each colour has its own sound, so try listening too.',
  });
})();
