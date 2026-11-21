/* Guess the Year: events from Wikipedia's "On this day". Pick the year; closer means more points. */

(function () {
  'use strict';

  const { $, read, write, el, getJson } = window.V3Tools;

  const FEED = 'https://en.wikipedia.org/api/rest_v1/feed/onthisday/selected/';
  const BEST_KEY = 'v3-year-best';
  const ROUNDS = 5;
  const MIN_YEAR = 1000;
  const NOW = new Date().getFullYear();

  /* 100 for the exact year, about 85 within 5 years, 35 within 25, nothing beyond 50. */
  const points = (diff) => Math.round(100 * Math.pow(Math.max(0, 1 - diff / 50), 1.5));

  let game = null;

  function randomDate() {
    const day = new Date(2024, 0, 1 + Math.floor(Math.random() * 366)); // 2024 has 29 February
    return [String(day.getMonth() + 1).padStart(2, '0'), String(day.getDate()).padStart(2, '0')];
  }

  /* Five events from a few random days, spread across the centuries so it isn't all the 1900s. */
  async function loadEvents() {
    const pool = [];
    const days = [randomDate(), randomDate(), randomDate()];
    const results = await Promise.allSettled(days.map(([m, d]) => getJson(FEED + m + '/' + d, 12000)));
    results.forEach((r) => {
      if (r.status !== 'fulfilled') return;
      (r.value.selected || []).forEach((item) => {
        if (!Number.isInteger(item.year) || item.year < MIN_YEAR || item.year > NOW || !item.text) return;
        const page = (item.pages || [])[0] || {};
        pool.push({
          year: item.year,
          text: item.text.replace(/\s+/g, ' ').trim(),
          image: page.thumbnail ? page.thumbnail.source : '',
          link: page.content_urls && page.content_urls.desktop ? page.content_urls.desktop.page : '',
        });
      });
    });
    if (pool.length < ROUNDS) throw new Error('not enough events');
    // Group by century, then take from different centuries in turn.
    const byCentury = new Map();
    pool.sort(() => Math.random() - 0.5).forEach((e) => {
      const c = Math.floor(e.year / 100);
      if (!byCentury.has(c)) byCentury.set(c, []);
      byCentury.get(c).push(e);
    });
    const groups = Array.from(byCentury.values()).sort(() => Math.random() - 0.5);
    const picked = [];
    for (let i = 0; picked.length < ROUNDS; i++) {
      const group = groups[i % groups.length];
      if (group.length) picked.push(group.shift());
      if (groups.every((g) => !g.length)) break;
    }
    return picked.sort(() => Math.random() - 0.5);
  }

  function setYear(value) {
    const year = Math.min(NOW, Math.max(MIN_YEAR, Math.round(value) || 1950));
    $('year').value = year;
    $('year-value').textContent = year;
    if (document.activeElement !== $('typed')) $('typed').value = year;
    return year;
  }

  function showRound() {
    const round = game.events[game.index];
    $('round').textContent = 'Round ' + (game.index + 1) + ' of ' + ROUNDS;
    $('progress').style.width = (game.index / ROUNDS) * 100 + '%';
    $('score').textContent = game.score;
    $('event').hidden = false;
    $('event-text').textContent = round.text;
    $('event-art').style.backgroundImage = round.image ? 'url("' + round.image.replace(/"/g, '%22') + '")' : '';
    $('event-art').hidden = !round.image;
    $('pick').hidden = false;
    $('result').hidden = true;
    setYear(1950);
    $('year').focus({ preventScroll: true });
  }

  function lockIn() {
    if (!game || $('pick').hidden) return;
    const guess = setYear(Number($('year').value));
    const round = game.events[game.index];
    const diff = Math.abs(guess - round.year);
    const got = points(diff);
    game.score += got;
    game.results.push({ guess, year: round.year, got });
    $('score').textContent = game.score;
    $('pick').hidden = true;
    $('result').hidden = false;
    $('result-title').textContent = round.year + (diff === 0 ? '. Spot on!' : '');
    $('result-text').textContent = diff === 0 ? '+100 points' : 'You said ' + guess + ', ' + diff + (diff === 1 ? ' year' : ' years') + ' out. +' + got + ' points';
    $('result-link').hidden = !round.link;
    if (round.link) $('result-link').href = round.link;
    $('next').textContent = game.index + 1 < ROUNDS ? 'Next' : 'See your score';
    $('next').focus({ preventScroll: true });
  }

  function next() {
    if (!game) return;
    game.index++;
    if (game.index < ROUNDS) return showRound();
    $('progress').style.width = '100%';
    $('event').hidden = true;
    $('result').hidden = true;
    $('over').hidden = false;
    const best = Math.max(Number(read(BEST_KEY, 0)) || 0, game.score);
    write(BEST_KEY, best);
    $('over-title').textContent = game.score + ' out of ' + ROUNDS * 100;
    $('over-text').textContent = game.score === best ? 'Your best score yet!' : 'Your best is ' + best + '.';
    $('recap').replaceChildren(...game.results.map((r) => el('li', '', r.year + ' (you said ' + r.guess + ') +' + r.got)));
    $('again').focus({ preventScroll: true });
  }

  async function start() {
    $('over').hidden = true;
    $('event').hidden = true;
    $('pick').hidden = true;
    $('result').hidden = true;
    $('status').textContent = 'Finding some history…';
    try {
      const events = await loadEvents();
      game = { events, index: 0, score: 0, results: [] };
      $('status').textContent = '';
      showRound();
    } catch (_) {
      $('status').textContent = "Couldn't reach Wikipedia. Check your connection and try again.";
      $('over').hidden = false;
      $('over-title').textContent = 'No events';
      $('over-text').textContent = '';
      $('recap').replaceChildren();
      $('again').textContent = 'Try again';
    }
  }

  $('year').max = NOW;
  $('typed').max = NOW;
  $('scale-end').textContent = NOW;
  $('year').addEventListener('input', (event) => setYear(Number(event.target.value)));
  $('typed').addEventListener('input', (event) => {
    const value = Number(event.target.value);
    if (value >= MIN_YEAR && value <= NOW) setYear(value);
  });
  $('typed').addEventListener('keydown', (event) => { if (event.key === 'Enter') lockIn(); });
  document.querySelectorAll('[data-nudge]').forEach((b) => b.addEventListener('click', () => setYear(Number($('year').value) + Number(b.dataset.nudge))));
  $('lock').addEventListener('click', lockIn);
  $('next').addEventListener('click', next);
  $('again').addEventListener('click', () => {
    $('again').textContent = 'Play again';
    start();
  });

  window.V3Keys.add([
    { keys: ['Enter'], label: 'Enter', does: 'Lock in, next, or play again', press: ['#lock', '#next', '#again'] },
    { keys: ['ArrowLeft', 'ArrowRight'], label: '← or →', does: 'Change the year by 1 (hold Shift for 10)', run: (key, event) => {
      if ($('pick').hidden) return false;
      setYear(Number($('year').value) + (key === 'ArrowLeft' ? -1 : 1) * (event.shiftKey ? 10 : 1));
      return true;
    } },
    { keys: ['/'], label: '/', does: 'Type the year', focus: '#typed' },
  ]);

  start();
})();
