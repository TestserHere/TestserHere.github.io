/* Picker: spin a wheel or pick instantly from a list. */

(function () {
  'use strict';

  const { $, read, write, el } = window.V3Tools;

  const STATE_KEY = 'v3-picker-state';
  const COLORS = ['#0071e3', '#34c759', '#ff9f0a', '#ff375f', '#af52de', '#5ac8fa', '#ffcc00', '#30d158', '#ff6b3d', '#5e5ce6', '#64d2ff', '#bf5af2'];
  const DEFAULT = ['Alex', 'Sam', 'Jordan', 'Taylor', 'Morgan', 'Riley', 'Casey', 'Jamie'];
  const reduceMotion = window.matchMedia('(prefers-reduced-motion: reduce)').matches;

  const saved = read(STATE_KEY, {});
  const state = {
    mode: saved.mode === 'wheel' ? 'wheel' : 'instant',
    text: typeof saved.text === 'string' ? saved.text : DEFAULT.join('\n'),
    autoRemove: !!saved.autoRemove,
    sound: saved.sound !== false,
    history: Array.isArray(saved.history) ? saved.history.filter((item) => typeof item === 'string').slice(0, 50) : [],
  };
  const remember = () => write(STATE_KEY, state);

  const entries = () => state.text.split('\n').map((line) => line.trim()).filter(Boolean);
  // Equal entries are separate slices, so "Pizza" twice means twice the chance.

  /* ---------- Entries ---------- */

  const box = $('entries');
  box.value = state.text;
  let undoText = null;

  function setText(text, keepUndo) {
    if (!keepUndo) {
      undoText = state.text;
      $('restore').disabled = false;
    }
    state.text = text;
    box.value = text;
    remember();
    refresh();
  }

  box.addEventListener('input', () => {
    state.text = box.value;
    remember();
    refresh();
  });

  $('shuffle').addEventListener('click', () => {
    const list = entries();
    for (let i = list.length - 1; i > 0; i--) {
      const j = Math.floor(Math.random() * (i + 1));
      [list[i], list[j]] = [list[j], list[i]];
    }
    setText(list.join('\n'));
  });
  $('sort').addEventListener('click', () => setText(entries().sort((a, b) => a.localeCompare(b, undefined, { sensitivity: 'base', numeric: true })).join('\n')));
  $('restore').addEventListener('click', () => {
    if (undoText === null) return;
    const text = undoText;
    undoText = null;
    $('restore').disabled = true;
    setText(text, true);
  });

  /* Removes one copy of the winner from the list. */
  function removeEntry(name) {
    const lines = state.text.split('\n');
    const index = lines.findIndex((line) => line.trim() === name);
    if (index < 0) return;
    lines.splice(index, 1);
    setText(lines.join('\n'));
  }

  function refresh() {
    const count = entries().length;
    $('count').textContent = count === 1 ? '1 entry' : count + ' entries';
    $('spin').disabled = count < 1 || spinning;
    $('instant-pick').disabled = count < 1;
    drawWheel();
  }

  /* ---------- Mode and options ---------- */

  const modeButtons = Array.from($('mode').querySelectorAll('button'));
  function showMode() {
    modeButtons.forEach((button) => button.setAttribute('aria-pressed', String(button.dataset.mode === state.mode)));
    $('wheel-view').hidden = state.mode !== 'wheel';
    $('instant-view').hidden = state.mode !== 'instant';
    if (state.mode === 'wheel') sizeWheel();
  }
  modeButtons.forEach((button) => button.addEventListener('click', () => {
    if (spinning) return;
    state.mode = button.dataset.mode;
    remember();
    showMode();
  }));

  $('auto-remove').checked = state.autoRemove;
  $('auto-remove').addEventListener('change', (event) => { state.autoRemove = event.target.checked; remember(); });
  $('sound').checked = state.sound;
  $('sound').addEventListener('change', (event) => { state.sound = event.target.checked; remember(); });

  /* ---------- History ---------- */

  function addHistory(name) {
    state.history.unshift(name);
    state.history = state.history.slice(0, 50);
    remember();
    showHistory();
  }

  function showHistory() {
    const list = $('history');
    list.replaceChildren();
    state.history.forEach((name) => list.appendChild(el('li', '', name)));
    $('history-empty').hidden = state.history.length > 0;
    $('clear-history').hidden = !state.history.length;
  }
  $('clear-history').addEventListener('click', () => { state.history = []; remember(); showHistory(); });

  /* ---------- Wheel ---------- */

  const canvas = $('wheel');
  const ctx = canvas.getContext('2d');
  let size = 0;
  let rotation = 0; // radians, clockwise
  let spinning = false;

  function sizeWheel() {
    const box = canvas.parentElement.getBoundingClientRect();
    const ratio = window.devicePixelRatio || 1;
    size = Math.max(200, Math.floor(box.width));
    canvas.width = size * ratio;
    canvas.height = size * ratio;
    canvas.style.width = size + 'px';
    canvas.style.height = size + 'px';
    ctx.setTransform(ratio, 0, 0, ratio, 0, 0);
    drawWheel();
  }

  function drawWheel() {
    if (!size) return;
    const list = entries();
    const r = size / 2;
    ctx.clearRect(0, 0, size, size);
    ctx.save();
    ctx.translate(r, r);

    if (!list.length) {
      ctx.beginPath();
      ctx.arc(0, 0, r - 4, 0, Math.PI * 2);
      ctx.fillStyle = getComputedStyle(document.body).getPropertyValue('--fill') || '#ddd';
      ctx.fill();
      ctx.restore();
      return;
    }

    const slice = (Math.PI * 2) / list.length;
    const fontSize = Math.max(10, Math.min(r * 0.13, (r * 2.6) / Math.max(list.length, 6)));
    ctx.rotate(rotation);
    list.forEach((name, index) => {
      const start = index * slice;
      ctx.beginPath();
      ctx.moveTo(0, 0);
      ctx.arc(0, 0, r - 4, start, start + slice);
      ctx.closePath();
      // Never two neighbours of the same colour, including the last and first.
      let color = COLORS[index % COLORS.length];
      if (index === list.length - 1 && index % COLORS.length === 0 && list.length > 1) color = COLORS[3];
      ctx.fillStyle = color;
      ctx.fill();
      if (list.length > 1) {
        ctx.strokeStyle = 'rgba(255,255,255,0.55)';
        ctx.lineWidth = list.length > 60 ? 0.5 : 1.5;
        ctx.stroke();
      }
      if (list.length <= 120) {
        ctx.save();
        ctx.rotate(start + slice / 2);
        ctx.textAlign = 'right';
        ctx.textBaseline = 'middle';
        ctx.fillStyle = '#fff';
        ctx.font = '600 ' + fontSize + 'px -apple-system, BlinkMacSystemFont, "Segoe UI", sans-serif';
        ctx.shadowColor = 'rgba(0,0,0,0.35)';
        ctx.shadowBlur = 3;
        ctx.fillText(fit(name, r * 0.62, fontSize), r - 18, 0);
        ctx.restore();
      }
    });
    ctx.restore();

    // Rim
    ctx.beginPath();
    ctx.arc(r, r, r - 3, 0, Math.PI * 2);
    ctx.lineWidth = 5;
    ctx.strokeStyle = 'rgba(255,255,255,0.9)';
    ctx.stroke();
  }

  /* Shortens a name so it fits inside its slice. */
  function fit(text, max, fontSize) {
    ctx.font = '600 ' + fontSize + 'px -apple-system, BlinkMacSystemFont, "Segoe UI", sans-serif';
    if (ctx.measureText(text).width <= max) return text;
    let cut = text;
    while (cut.length > 1 && ctx.measureText(cut + '…').width > max) cut = cut.slice(0, -1);
    return cut + '…';
  }

  /* The pointer sits at the top. This finds the slice under it. */
  function winnerIndex(count) {
    const slice = (Math.PI * 2) / count;
    const pointer = -Math.PI / 2;
    const angle = (((pointer - rotation) % (Math.PI * 2)) + Math.PI * 2) % (Math.PI * 2);
    return Math.floor(angle / slice) % count;
  }

  function spin() {
    const list = entries();
    if (spinning || !list.length) return;
    spinning = true;
    refresh();
    // Choose the winner fairly first, then land the wheel on it.
    const winner = Math.floor(Math.random() * list.length);
    const slice = (Math.PI * 2) / list.length;
    const inside = slice * (0.15 + Math.random() * 0.7);
    const target = -Math.PI / 2 - (winner * slice + inside);
    const turns = reduceMotion ? 1 : 5 + Math.floor(Math.random() * 3);
    const current = ((rotation % (Math.PI * 2)) + Math.PI * 2) % (Math.PI * 2);
    let delta = (((target - current) % (Math.PI * 2)) + Math.PI * 2) % (Math.PI * 2);
    delta += turns * Math.PI * 2;
    const from = rotation;
    const duration = reduceMotion ? 1200 : 4600 + Math.random() * 1200;
    const started = performance.now();
    let lastSlice = winnerIndex(list.length);

    function frame(now) {
      const t = Math.min(1, (now - started) / duration);
      const eased = 1 - Math.pow(1 - t, 4);
      rotation = from + delta * eased;
      drawWheel();
      const under = winnerIndex(list.length);
      if (under !== lastSlice) {
        lastSlice = under;
        tick();
      }
      if (t < 1) requestAnimationFrame(frame);
      else finish(list[winnerIndex(list.length)]);
    }
    requestAnimationFrame(frame);
  }

  function finish(name) {
    spinning = false;
    refresh();
    addHistory(name);
    fanfare();
    showWinner(name);
  }

  canvas.addEventListener('click', spin);
  $('spin').addEventListener('click', spin);
  document.addEventListener('keydown', (event) => {
    if (event.code !== 'Space' || event.repeat || $('winner').open) return;
    if (/^(TEXTAREA|INPUT|BUTTON|SELECT)$/.test(document.activeElement.tagName)) return;
    event.preventDefault();
    if (state.mode === 'wheel') spin(); else pickInstant();
  });
  window.addEventListener('resize', () => { if (state.mode === 'wheel') sizeWheel(); });

  /* ---------- Winner ---------- */

  let lastWinner = null;

  function showWinner(name) {
    lastWinner = name;
    $('winner-name').textContent = name;
    $('winner-remove').hidden = state.autoRemove;
    const dialog = $('winner');
    if (typeof dialog.showModal === 'function') dialog.showModal(); else dialog.setAttribute('open', '');
    confetti();
    if (state.autoRemove) removeEntry(name);
  }

  function closeWinner() {
    const dialog = $('winner');
    if (dialog.open && typeof dialog.close === 'function') dialog.close(); else dialog.removeAttribute('open');
  }

  $('winner-close').addEventListener('click', closeWinner);
  $('winner-remove').addEventListener('click', () => {
    if (lastWinner !== null) removeEntry(lastWinner);
    closeWinner();
  });
  $('winner').addEventListener('click', (event) => { if (event.target === $('winner')) closeWinner(); });

  /* ---------- Instant ---------- */

  let instantWinner = null;

  function pickInstant() {
    const list = entries();
    if (!list.length) return;
    const name = list[Math.floor(Math.random() * list.length)];
    instantWinner = name;
    const label = $('instant-name');
    label.textContent = name;
    label.classList.remove('is-idle');
    const card = $('instant-card');
    card.classList.remove('is-new');
    void card.offsetWidth; // restart the little pop
    card.classList.add('is-new');
    addHistory(name);
    fanfare();
    if (state.autoRemove) {
      removeEntry(name);
      $('instant-remove').disabled = true;
    } else {
      $('instant-remove').disabled = false;
    }
  }

  $('instant-pick').addEventListener('click', pickInstant);
  $('instant-remove').addEventListener('click', () => {
    if (instantWinner === null) return;
    removeEntry(instantWinner);
    $('instant-remove').disabled = true;
  });

  /* ---------- Sound and confetti ---------- */

  let audio = null;
  function sound() {
    if (!state.sound) return null;
    try {
      audio = audio || new (window.AudioContext || window.webkitAudioContext)();
      if (audio.state === 'suspended') audio.resume();
      return audio;
    } catch (_) {
      return null;
    }
  }

  function beep(freq, length, volume, delay) {
    const context = sound();
    if (!context) return;
    const start = context.currentTime + (delay || 0);
    const osc = context.createOscillator();
    const gain = context.createGain();
    osc.frequency.value = freq;
    osc.type = 'triangle';
    gain.gain.setValueAtTime(volume, start);
    gain.gain.exponentialRampToValueAtTime(0.0001, start + length);
    osc.connect(gain).connect(context.destination);
    osc.start(start);
    osc.stop(start + length);
  }

  const tick = () => beep(1400, 0.03, 0.05);
  const fanfare = () => [523, 659, 784].forEach((freq, i) => beep(freq, 0.25, 0.08, i * 0.09));

  function confetti() {
    if (reduceMotion) return;
    const layer = $('confetti');
    const rect = layer.getBoundingClientRect();
    const ratio = window.devicePixelRatio || 1;
    layer.width = rect.width * ratio;
    layer.height = rect.height * ratio;
    const c = layer.getContext('2d');
    c.setTransform(ratio, 0, 0, ratio, 0, 0);
    const bits = Array.from({ length: 70 }, () => ({
      x: rect.width / 2,
      y: rect.height * 0.35,
      vx: (Math.random() - 0.5) * 9,
      vy: -Math.random() * 7 - 3,
      size: 4 + Math.random() * 5,
      turn: Math.random() * Math.PI,
      color: COLORS[Math.floor(Math.random() * COLORS.length)],
    }));
    const started = performance.now();
    (function frame(now) {
      c.clearRect(0, 0, rect.width, rect.height);
      bits.forEach((bit) => {
        bit.vy += 0.25;
        bit.x += bit.vx;
        bit.y += bit.vy;
        bit.turn += 0.2;
        c.save();
        c.translate(bit.x, bit.y);
        c.rotate(bit.turn);
        c.fillStyle = bit.color;
        c.fillRect(-bit.size / 2, -bit.size / 4, bit.size, bit.size / 2);
        c.restore();
      });
      if (now - started < 1800 && $('winner').open) requestAnimationFrame(frame);
      else c.clearRect(0, 0, rect.width, rect.height);
    })(started);
  }

  showMode();
  showHistory();
  refresh();
  sizeWheel();
})();
