/* Categories: one letter, a list of categories, and a timer. Think of something for each one that starts with the letter. */

(function () {
  'use strict';

  const { $, read, write, el, formatDuration } = window.V3Tools;
  const Play = window.V3Play;

  const KEY = 'v3-categories';
  const EASY = 'ABCDEFGHIJKLMNOPRSTW'.split('');
  const HARD = 'QUVXYZ'.split('');

  const saved = read(KEY, {});
  const state = {
    time: [60, 120, 180, 240].includes(saved.time) ? saved.time : 120,
    count: [6, 10, 12].includes(saved.count) ? saved.count : 10,
    hard: !!saved.hard,
    typing: !!saved.typing,
  };
  const remember = () => write(KEY, state);

  let letter = '';
  let list = [];
  let usedLetters = [];
  let usedCats = [];
  let left = state.time;
  let timer = 0;
  let running = false;

  const letters = () => (state.hard ? EASY.concat(HARD) : EASY);

  function pickLetter() {
    let pool = letters().filter((l) => !usedLetters.includes(l));
    if (!pool.length) { usedLetters = []; pool = letters(); }
    const chosen = Play.pick(pool);
    usedLetters.push(chosen);
    return chosen;
  }

  function pickList() {
    let pool = window.CATEGORY_LIST.filter((c) => !usedCats.includes(c));
    if (pool.length < state.count) { usedCats = []; pool = window.CATEGORY_LIST.slice(); }
    const chosen = Play.shuffle(pool).slice(0, state.count);
    usedCats.push(...chosen);
    return chosen;
  }

  /* A quick shuffle of letters before landing, like rolling a die. */
  function rollLetter() {
    const box = $('letter');
    const final = pickLetter();
    box.classList.add('is-rolling');
    let n = 0;
    const spin = setInterval(() => {
      box.textContent = Play.pick(letters());
      Play.sounds.tick();
      if (++n >= 10) {
        clearInterval(spin);
        box.classList.remove('is-rolling');
        box.textContent = final;
        box.setAttribute('aria-label', 'The letter is ' + final);
      }
    }, 60);
    letter = final;
    checkAnswers();
  }

  function renderList() {
    const box = $('list');
    box.replaceChildren(...list.map((name, i) => {
      const item = el('li', 'cat-item');
      const label = el('label', 'cat-name', name);
      label.htmlFor = 'answer-' + i;
      item.appendChild(label);
      if (state.typing) {
        const input = el('input', 'field');
        input.id = 'answer-' + i;
        input.autocomplete = 'off';
        input.spellcheck = false;
        input.placeholder = 'Starts with ' + (letter || '…');
        input.addEventListener('input', checkAnswers);
        input.addEventListener('keydown', (event) => {
          if (event.key === 'Enter') {
            event.preventDefault();
            const next = $('answer-' + (i + 1));
            if (next) next.focus(); else input.blur();
          }
        });
        item.appendChild(input);
      }
      return item;
    }));
    // Hide the categories until the timer starts, so nobody gets a head start.
    box.classList.toggle('is-blurred', !running && left === state.time);
  }

  function checkAnswers() {
    let good = 0;
    $('list').querySelectorAll('.field').forEach((input) => {
      input.placeholder = 'Starts with ' + (letter || '…');
      const v = input.value.trim();
      const ok = v && letter && v[0].toUpperCase() === letter;
      input.classList.toggle('is-good', !!ok);
      input.classList.toggle('is-bad', !!v && !ok);
      if (ok) good++;
    });
    return good;
  }

  function showClock() {
    $('clock').textContent = formatDuration(left);
    $('clock').classList.toggle('is-low', running && left <= 10);
    $('go').textContent = running ? 'Pause' : left < state.time && left > 0 ? 'Resume' : 'Start';
  }

  function tick() {
    left--;
    if (left <= 5 && left > 0) Play.sounds.tick();
    showClock();
    if (left <= 0) timesUp();
  }

  function startPause() {
    if (left <= 0) return newRound();
    running = !running;
    clearInterval(timer);
    if (running) {
      $('list').classList.remove('is-blurred');
      timer = setInterval(tick, 1000);
      Play.sounds.go();
      const first = $('answer-0');
      if (first && state.typing) first.focus();
    }
    showClock();
  }

  function timesUp() {
    running = false;
    clearInterval(timer);
    showClock();
    Play.sounds.end();
    Play.vibrate([200, 100, 200]);
    $('list').querySelectorAll('.field').forEach((input) => { input.readOnly = true; });
    $('times-up').hidden = false;
    if (state.typing) {
      const good = checkAnswers();
      $('times-up-text').textContent = 'You got ' + good + ' of ' + list.length + ' starting with ' + letter + '. Compare with other players: an answer nobody else has scores a point.';
    } else {
      $('times-up-text').textContent = 'Pens down. Read your answers out, one category at a time. Answers nobody else has score a point.';
    }
    $('go').textContent = 'Next round';
    $('times-up').scrollIntoView({ behavior: 'smooth', block: 'center' });
  }

  function resetClock() {
    running = false;
    clearInterval(timer);
    left = state.time;
    $('times-up').hidden = true;
    showClock();
  }

  function newRound() {
    resetClock();
    list = pickList();
    renderList();
    rollLetter();
  }

  $('go').addEventListener('click', startPause);
  $('new-round').addEventListener('click', newRound);
  $('new-letter').addEventListener('click', () => { if (!running) { resetClock(); renderList(); } rollLetter(); });
  $('new-list').addEventListener('click', () => { list = pickList(); renderList(); checkAnswers(); });

  Play.segmented($('time'), state.time, (v) => { state.time = Number(v); remember(); if (!running) resetClock(); });
  Play.segmented($('count'), state.count, (v) => { state.count = Number(v); remember(); list = pickList(); renderList(); });
  $('hard').checked = state.hard;
  $('hard').addEventListener('change', () => { state.hard = $('hard').checked; remember(); });
  $('typing').checked = state.typing;
  $('typing').addEventListener('change', () => { state.typing = $('typing').checked; remember(); renderList(); checkAnswers(); });

  list = pickList();
  renderList();
  rollLetter();
  resetClock();

  window.V3Keys.add([
    { keys: [' '], label: 'Space', does: 'Start, pause or resume the timer', press: '#go' },
    { keys: ['r'], label: 'R', does: 'New round (new letter and categories)', press: '#new-round' },
    { keys: ['l'], label: 'L', does: 'New letter', press: '#new-letter' },
    { keys: ['c'], label: 'C', does: 'New categories', press: '#new-list' },
    { keys: ['/'], label: '/', does: 'Type your first answer (when typing is on)', focus: '#answer-0' },
  ]);
  window.V3Keys.howTo({
    id: 'categories',
    title: 'Categories',
    steps: [
      'Everyone gets paper and a pen (or turns on “Type answers on this device” in Settings).',
      'Press Start. The categories appear and the timer runs.',
      'For each category, write something that starts with the letter shown. Letter B, category “An animal”: Bear.',
      'When time’s up, go through the list together. Each answer that nobody else wrote scores a point.',
      'Answers that start with the wrong letter, or that someone else also wrote, score nothing. Play as many rounds as you like.',
    ],
    tip: 'Bonus rule: two-word answers where both words start with the letter (like “Big Bear”) can score two points.',
  });
})();
