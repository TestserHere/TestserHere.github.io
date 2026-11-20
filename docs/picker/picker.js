/* Picker: spin a wheel or pick instantly from a list. */

(function () {
  'use strict';

  const { $, read, write, el } = window.V3Tools;
  const Wheel = window.V3Wheel;

  const STATE_KEY = 'v3-picker-state';

  const saved = read(STATE_KEY, {});
  const state = {
    mode: saved.mode === 'wheel' ? 'wheel' : 'instant',
    text: typeof saved.text === 'string' ? saved.text : '',
    autoRemove: !!saved.autoRemove,
    sound: saved.sound !== false,
    history: Array.isArray(saved.history) ? saved.history.filter((item) => typeof item === 'string').slice(0, 50) : [],
  };
  const remember = () => write(STATE_KEY, state);

  // Equal entries are separate slices, so "Pizza" twice means twice the chance.
  const entries = () => state.text.split('\n').map((line) => line.trim()).filter(Boolean);

  const wheel = Wheel.create({
    canvas: $('wheel'),
    entries,
    onTick: () => { if (state.sound) Wheel.tick(); },
    onDone: (name) => {
      refresh();
      celebrate(name);
      showWinner(name);
    },
  });

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
    $('spin').disabled = count < 1 || wheel.isSpinning();
    $('instant-pick').disabled = count < 1;
    if (!count && $('instant-name').classList.contains('is-idle')) $('instant-name').textContent = 'Add some entries first';
    else if ($('instant-name').classList.contains('is-idle')) $('instant-name').textContent = 'Tap Pick';
    wheel.draw();
  }

  /* ---------- Mode and options ---------- */

  const modeButtons = Array.from($('mode').querySelectorAll('button'));
  function showMode() {
    modeButtons.forEach((button) => button.setAttribute('aria-pressed', String(button.dataset.mode === state.mode)));
    $('wheel-view').hidden = state.mode !== 'wheel';
    $('instant-view').hidden = state.mode !== 'instant';
    if (state.mode === 'wheel') wheel.resize();
  }
  modeButtons.forEach((button) => button.addEventListener('click', () => {
    if (wheel.isSpinning()) return;
    state.mode = button.dataset.mode;
    remember();
    showMode();
  }));

  $('auto-remove').checked = state.autoRemove;
  $('auto-remove').addEventListener('change', (event) => { state.autoRemove = event.target.checked; remember(); });
  $('sound').checked = state.sound;
  $('sound').addEventListener('change', (event) => { state.sound = event.target.checked; remember(); });

  /* ---------- History ---------- */

  function celebrate(name) {
    state.history.unshift(name);
    state.history = state.history.slice(0, 50);
    remember();
    showHistory();
    if (state.sound) Wheel.chime();
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

  function spin() {
    if (wheel.spin()) refresh();
  }

  $('wheel').addEventListener('click', spin);
  $('spin').addEventListener('click', spin);
  document.addEventListener('keydown', (event) => {
    if (event.code !== 'Space' || event.repeat || $('winner').open) return;
    if (/^(TEXTAREA|INPUT|BUTTON|SELECT)$/.test(document.activeElement.tagName)) return;
    event.preventDefault();
    if (state.mode === 'wheel') spin(); else pickInstant();
  });
  window.addEventListener('resize', () => { if (state.mode === 'wheel') wheel.resize(); });

  /* ---------- Winner window ---------- */

  let lastWinner = null;

  function showWinner(name) {
    lastWinner = name;
    $('winner-name').textContent = name;
    $('winner-remove').hidden = state.autoRemove;
    Wheel.openDialog($('winner'));
    Wheel.confetti($('confetti'), () => $('winner').open);
    if (state.autoRemove) removeEntry(name);
  }

  $('winner-close').addEventListener('click', () => Wheel.closeDialog($('winner')));
  $('winner-remove').addEventListener('click', () => {
    if (lastWinner !== null) removeEntry(lastWinner);
    Wheel.closeDialog($('winner'));
  });
  $('winner').addEventListener('click', (event) => { if (event.target === $('winner')) Wheel.closeDialog($('winner')); });

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
    label.classList.remove('pick-pop');
    void label.offsetWidth; // restart the little pop
    label.classList.add('pick-pop');
    celebrate(name);
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

  showMode();
  showHistory();
  refresh();
})();
