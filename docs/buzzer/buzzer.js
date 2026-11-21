/* Party Buzzer: the first team to press wins. Works offline, on one shared device or keyboard. */

(function () {
  'use strict';

  const { $, read, write, el, setupStepper } = window.V3Tools;

  const KEY = 'v3-buzzer';
  const TEAMS = [
    { name: 'Red', color: '#e5323f', keys: ['1', 'q'], tone: 330 },
    { name: 'Blue', color: '#0a84ff', keys: ['2', 'p'], tone: 392 },
    { name: 'Green', color: '#28a745', keys: ['3', 'z'], tone: 440 },
    { name: 'Yellow', color: '#e0a800', keys: ['4', 'm'], tone: 523 },
  ];

  const saved = read(KEY, {});
  const state = {
    teams: Number.isInteger(saved.teams) && saved.teams >= 2 && saved.teams <= 4 ? saved.teams : 2,
    lockout: !!saved.lockout,
    scores: Array.isArray(saved.scores) ? TEAMS.map((_, i) => (Number.isInteger(saved.scores[i]) ? saved.scores[i] : 0)) : [0, 0, 0, 0],
  };
  const remember = () => write(KEY, state);

  // 'ready': waiting for a press. 'won': someone buzzed. 'waiting': lock-out mode, before the host says go.
  let phase = 'ready';
  let winner = -1;
  let locked = new Set(); // teams that pressed too early
  let goTimer = 0;

  /* ---------- Sound ---------- */
  let audio = null;
  function beep(freq, length, type) {
    try {
      audio = audio || new (window.AudioContext || window.webkitAudioContext)();
      if (audio.state === 'suspended') audio.resume();
      const osc = audio.createOscillator();
      const gain = audio.createGain();
      osc.type = type || 'square';
      osc.frequency.value = freq;
      gain.gain.setValueAtTime(0.12, audio.currentTime);
      gain.gain.exponentialRampToValueAtTime(0.0001, audio.currentTime + length);
      osc.connect(gain).connect(audio.destination);
      osc.start();
      osc.stop(audio.currentTime + length);
    } catch (_) { /* no sound */ }
  }

  /* ---------- Pads ---------- */
  function render() {
    const box = $('pads');
    box.replaceChildren();
    box.dataset.count = state.teams;
    TEAMS.slice(0, state.teams).forEach((team, i) => {
      const pad = el('button', 'pad');
      pad.type = 'button';
      pad.style.setProperty('--c', team.color);
      pad.classList.toggle('is-winner', phase === 'won' && winner === i);
      pad.classList.toggle('is-out', (phase === 'won' && winner !== i) || locked.has(i));
      pad.setAttribute('aria-label', team.name + ' buzzer. Score ' + state.scores[i]);
      pad.append(
        el('span', 'pad-name', team.name),
        el('span', 'pad-score', String(state.scores[i])),
        el('span', 'pad-key', 'Key ' + team.keys[0].toUpperCase() + ' or ' + team.keys[1].toUpperCase())
      );
      pad.addEventListener('pointerdown', (event) => {
        event.preventDefault();
        buzz(i);
      });
      pad.addEventListener('click', (event) => { if (event.detail === 0) buzz(i); }); // keyboard Enter/Space on the button
      if (phase === 'won' && winner === i) {
        const plus = el('span', 'pad-award');
        const add = el('button', 'pad-point', '+1 point');
        add.type = 'button';
        add.addEventListener('pointerdown', (event) => event.stopPropagation());
        add.addEventListener('click', (event) => {
          event.stopPropagation();
          state.scores[i]++;
          remember();
          arm();
        });
        plus.appendChild(add);
        pad.appendChild(plus);
      }
      box.appendChild(pad);
    });
    showStatus();
  }

  function showStatus() {
    const status = $('status');
    if (phase === 'won') status.textContent = TEAMS[winner].name + ' buzzed first!';
    else if (phase === 'waiting') status.textContent = 'Wait for it…';
    else status.textContent = state.lockout ? 'Go!' : 'Ready. First to buzz wins.';
    status.dataset.phase = phase;
    $('arm').textContent = phase === 'won' ? 'Next question' : state.lockout && phase !== 'waiting' ? 'Start again' : 'Reset';
    $('hint').textContent = 'Each team can use its pad or its keys. Enter starts the next question.';
  }

  function buzz(i) {
    if (i >= state.teams) return;
    if (phase === 'waiting') {
      // Pressed before "Go": out for this question.
      if (!locked.has(i)) {
        locked.add(i);
        beep(110, 0.25, 'sawtooth');
        render();
      }
      return;
    }
    if (phase !== 'ready' || locked.has(i)) return;
    phase = 'won';
    winner = i;
    beep(TEAMS[i].tone * 2, 0.5);
    if (navigator.vibrate) navigator.vibrate(120);
    render();
  }

  /* Next question. With lock-out on, "Go" comes after a short random wait, and anyone pressing early is out. */
  function arm() {
    clearTimeout(goTimer);
    winner = -1;
    locked = new Set();
    if (state.lockout) {
      phase = 'waiting';
      goTimer = setTimeout(() => {
        phase = 'ready';
        beep(880, 0.15, 'sine');
        render();
      }, 1200 + Math.random() * 2200);
    } else {
      phase = 'ready';
    }
    render();
  }

  setupStepper($('teams'), {
    read: () => ({ value: state.teams, min: 2, max: 4 }),
    write: (value) => {
      state.teams = value;
      remember();
      arm();
    },
  });

  $('lockout').checked = state.lockout;
  $('lockout').addEventListener('change', (event) => {
    state.lockout = event.target.checked;
    remember();
    arm();
  });
  $('arm').addEventListener('click', arm);
  $('reset-scores').addEventListener('click', () => {
    if (!window.confirm('Set every score back to 0?')) return;
    state.scores = [0, 0, 0, 0];
    remember();
    render();
  });

  window.V3Keys.add([
    { keys: ['1', 'q'], label: '1 or Q', does: 'Red buzzes', run: () => buzz(0) },
    { keys: ['2', 'p'], label: '2 or P', does: 'Blue buzzes', run: () => buzz(1) },
    { keys: ['3', 'z'], label: '3 or Z', does: 'Green buzzes', run: () => buzz(2) },
    { keys: ['4', 'm'], label: '4 or M', does: 'Yellow buzzes', run: () => buzz(3) },
    { keys: ['Enter'], label: 'Enter', does: 'Next question', press: '#arm' },
    { keys: ['+', '='], label: '+', does: 'Give the winner a point', press: '.pad-point' },
  ]);

  render();
})();
