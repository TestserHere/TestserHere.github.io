/* Daily Five: five quick questions, the same for everyone each day. */

(function () {
  'use strict';

  const { $, read, write, el, getJson } = window.V3Tools;
  const Daily = window.V3Daily;

  const KEY = 'v3-five';
  const day = Daily.today();
  const [Y, M, D] = day.split('-');
  const COUNTRIES = window.COUNTRIES;

  const saved = read(KEY, {});
  const store = {
    days: saved.days && typeof saved.days === 'object' ? saved.days : {}, // day -> { marks, answers }
  };
  const remember = () => write(KEY, store);
  const today = store.days[day] || (store.days[day] = { marks: [], picks: [] });

  /* ---------- Questions ---------- */

  function flagQuestion(r) {
    const answer = Daily.pick(COUNTRIES, r);
    const near = COUNTRIES.filter((c) => c !== answer && c.region === answer.region);
    const wrong = Daily.shuffle(near.length >= 3 ? near : COUNTRIES.filter((c) => c !== answer), r).slice(0, 3);
    return {
      kind: 'Flag',
      text: 'Which country has this flag?',
      media: () => {
        const img = el('img', 'q-flag');
        img.src = 'https://flagcdn.com/w320/' + answer.code + '.png';
        img.alt = 'A flag';
        return img;
      },
      options: Daily.shuffle([answer].concat(wrong), r).map((c) => c.name),
      answer: answer.name,
      recap: 'Flag of ' + answer.name,
    };
  }

  async function historyQuestion(r) {
    const data = await getJson('https://en.wikipedia.org/api/rest_v1/feed/onthisday/selected/' + M + '/' + D, 12000);
    const events = (data.selected || []).filter((e) => Number.isInteger(e.year) && e.year > 1000 && e.text).sort((a, b) => a.year - b.year);
    if (!events.length) throw new Error('no events');
    const event = Daily.pick(events, r);
    const years = new Set([event.year]);
    const spread = event.year > 1900 ? 12 : 40;
    while (years.size < 4) {
      const y = event.year + Math.round((r() * 2 - 1) * spread * 2);
      if (y !== event.year && y <= new Date().getFullYear() && y > 0) years.add(y);
    }
    return {
      kind: 'On this day',
      text: 'In which year? ' + event.text,
      options: Daily.shuffle(Array.from(years), r).map(String),
      answer: String(event.year),
      recap: event.year + ': ' + event.text,
    };
  }

  async function songQuestion(r) {
    const data = await window.MusicSources.deezer('chart/0/tracks?limit=50');
    const tracks = (data.data || []).filter((t) => t.preview && t.artist);
    if (tracks.length < 4) throw new Error('no songs');
    // Sorting by id keeps the choice steady even if the chart order shifts a little during the day.
    const pool = tracks.slice().sort((a, b) => a.id - b.id);
    const song = Daily.pick(pool, r);
    const clean = (t) => t.title.replace(/\s*[([][^)\]]*(feat|with)[^)\]]*[)\]]/gi, '').trim();
    const wrong = Daily.shuffle(pool.filter((t) => t !== song && t.artist.name !== song.artist.name), r).slice(0, 3);
    let audio = null;
    return {
      kind: 'Song',
      text: 'Name this song.',
      media: () => {
        audio = new Audio(song.preview);
        const button = el('button', 'secondary q-play', 'Play the song');
        button.type = 'button';
        button.addEventListener('click', () => {
          if (audio.paused) {
            audio.currentTime = 0;
            audio.play().catch(() => {});
            button.textContent = 'Stop';
          } else {
            audio.pause();
            button.textContent = 'Play the song';
          }
        });
        audio.addEventListener('timeupdate', () => {
          if (audio.currentTime > 10 && $('next').hidden) { // until you answer, you only hear 10 seconds
            audio.pause();
            button.textContent = 'Play the song';
          }
        });
        return button;
      },
      stop: () => { if (audio) audio.pause(); },
      options: Daily.shuffle([song].concat(wrong), r).map((t) => clean(t) + ' · ' + t.artist.name),
      answer: clean(song) + ' · ' + song.artist.name,
      recap: clean(song) + ' by ' + song.artist.name,
    };
  }

  function wordQuestion(r) {
    const words = (typeof WORD_CARDS !== 'undefined' ? WORD_CARDS : []).map((c) => c[0]).filter((w) => /^[A-Za-z]{5,8}$/.test(w));
    const word = Daily.pick(words, r).toUpperCase();
    let scrambled = word;
    for (let i = 0; i < 10 && scrambled === word; i++) scrambled = Daily.shuffle(word.split(''), r).join('');
    return {
      kind: 'Word',
      text: 'Unscramble this word.',
      media: () => el('p', 'q-scramble', scrambled.split('').join(' ')),
      typed: true,
      tries: 3,
      hint: 'It starts with “' + word[0] + '”.',
      answer: word,
      recap: scrambled + ' was ' + word,
    };
  }

  async function mostReadQuestion(r) {
    const data = await getJson('https://en.wikipedia.org/api/rest_v1/feed/featured/' + Y + '/' + M + '/' + D, 12000);
    const articles = ((data.mostread && data.mostread.articles) || [])
      .filter((a) => a.views && !/^(Deaths in|List of|Main Page|Special:|\d{4} in)/.test(a.normalizedtitle || ''))
      .slice(0, 30);
    if (articles.length < 4) throw new Error('no articles');
    const four = Daily.shuffle(articles, r).slice(0, 4);
    const top = four.reduce((a, b) => (b.views > a.views ? b : a));
    return {
      kind: 'Most read',
      text: 'Which of these did the most people read on Wikipedia yesterday?',
      options: four.map((a) => a.normalizedtitle),
      answer: top.normalizedtitle,
      after: four.slice().sort((a, b) => b.views - a.views).map((a) => a.normalizedtitle + ': ' + a.views.toLocaleString() + ' views').join(' · '),
      recap: top.normalizedtitle + ' (' + top.views.toLocaleString() + ' views)',
    };
  }

  /* Each question gets its own seed, so a failed one doesn't change the others. */
  async function buildQuestions() {
    const makers = [
      () => flagQuestion(Daily.rng('five-flag-' + day)),
      () => historyQuestion(Daily.rng('five-history-' + day)),
      () => songQuestion(Daily.rng('five-song-' + day)),
      () => wordQuestion(Daily.rng('five-word-' + day)),
      () => mostReadQuestion(Daily.rng('five-read-' + day)),
    ];
    const results = await Promise.allSettled(makers.map((make) => Promise.resolve().then(make)));
    return results.map((r, i) => (r.status === 'fulfilled' ? r.value : Object.assign(flagQuestion(Daily.rng('five-spare-' + i + '-' + day)), { kind: 'Flag (spare)' })));
  }

  /* ---------- Play ---------- */

  let questions = [];
  let index = 0;
  let triesLeft = 0;

  function renderDots(target) {
    const marks = today.marks;
    target.replaceChildren(...[0, 1, 2, 3, 4].map((i) => {
      const dot = el('li', 'dot' + (marks[i] === true ? ' is-right' : marks[i] === false ? ' is-wrong' : i === index && !isDone() ? ' is-now' : ''));
      dot.setAttribute('aria-label', 'Question ' + (i + 1) + (marks[i] === true ? ': right' : marks[i] === false ? ': wrong' : ''));
      return dot;
    }));
  }

  const isDone = () => today.marks.length >= 5;

  function show() {
    renderDots($('dots'));
    if (isDone()) return finish();
    const q = questions[index];
    $('question').hidden = false;
    $('kind').textContent = (index + 1) + ' of 5 · ' + q.kind;
    $('text').textContent = q.text;
    $('media').replaceChildren(q.media ? q.media() : '');
    $('message').textContent = '';
    $('message').className = 'message';
    $('next').hidden = true;
    $('answers').hidden = !!q.typed;
    $('type-form').hidden = !q.typed;
    if (q.typed) {
      triesLeft = q.tries;
      $('typed').value = '';
      $('typed').disabled = false;
      $('typed').focus({ preventScroll: true });
    } else {
      $('answers').replaceChildren(...q.options.map((text) => {
        const b = el('button', 'answer', text);
        b.type = 'button';
        b.addEventListener('click', () => choose(text, b));
        return b;
      }));
    }
  }

  function mark(right, picked) {
    const q = questions[index];
    today.marks[index] = right;
    today.picks[index] = { right, recap: q.recap, picked };
    remember();
    if (q.stop && !right) q.stop();
    $('message').textContent = (right ? 'Right! ' : 'The answer: ' + q.answer + '. ') + (q.after || '');
    $('message').className = 'message ' + (right ? 'is-good' : 'is-bad');
    $('next').hidden = false;
    $('next').textContent = index < 4 ? 'Next' : 'See your score';
    $('next').focus({ preventScroll: true });
    renderDots($('dots'));
  }

  function choose(text, button) {
    if (today.marks[index] !== undefined) return;
    const q = questions[index];
    const right = text === q.answer;
    Array.from($('answers').children).forEach((b) => {
      b.disabled = true;
      if (b.textContent === q.answer) b.classList.add('is-right');
      else if (b === button) b.classList.add('is-wrong');
      else b.classList.add('is-faded');
    });
    mark(right, text);
  }

  $('type-form').addEventListener('submit', (event) => {
    event.preventDefault();
    const q = questions[index];
    if (!q || !q.typed || today.marks[index] !== undefined) return;
    const guess = $('typed').value.trim().toUpperCase();
    if (!guess) return;
    if (guess === q.answer) {
      $('typed').disabled = true;
      return mark(true, guess);
    }
    triesLeft--;
    if (triesLeft <= 0) {
      $('typed').disabled = true;
      return mark(false, guess);
    }
    $('message').textContent = 'Not quite. ' + (triesLeft === 1 ? q.hint + ' Last try!' : triesLeft + ' tries left.');
    $('message').className = 'message is-bad';
    $('typed').select();
  });

  $('next').addEventListener('click', () => {
    const q = questions[index];
    if (q && q.stop) q.stop();
    index++;
    show();
  });

  function shareText() {
    const marks = today.marks.map((m) => (m ? '●' : '○')).join('');
    const score = today.marks.filter(Boolean).length;
    return 'Daily Five, ' + Daily.label(day) + ': ' + score + '/5 ' + marks + '\n' + location.href.split('?')[0];
  }

  function streak() {
    let count = 0;
    for (let d = new Date(); ; d = new Date(d.getTime() - 86400000)) {
      const rec = store.days[Daily.today(d)];
      if (!rec || rec.marks.length < 5) break;
      count++;
    }
    return count;
  }

  function finish() {
    $('question').hidden = true;
    $('done').hidden = false;
    const score = today.marks.filter(Boolean).length;
    $('done-title').textContent = score + ' out of 5';
    $('done-dots').textContent = today.marks.map((m) => (m ? '●' : '○')).join(' ');
    const s = streak();
    $('done-text').textContent = ['Better luck tomorrow!', 'One right. Tomorrow’s a new day.', 'Not bad!', 'Nice!', 'Great job!', 'Perfect score!'][score]
      + ' You’ve played ' + s + (s === 1 ? ' day' : ' days') + ' in a row.';
    $('recap').replaceChildren(...today.picks.map((p, i) => el('li', p && p.right ? 'is-right' : 'is-wrong', (p ? p.recap : 'Question ' + (i + 1)))));
    // Keep only the last 60 days of results.
    Object.keys(store.days).sort().slice(0, -60).forEach((k) => delete store.days[k]);
    remember();
  }

  $('share').addEventListener('click', async () => {
    $('share').textContent = (await Daily.share(shareText())) ? 'Copied!' : 'Couldn’t copy';
    setTimeout(() => { $('share').textContent = 'Copy result'; }, 2000);
  });

  window.V3Keys.add([
    { keys: ['1', '2', '3', '4'], label: '1 to 4', does: 'Choose an answer', press: (k) => '#answers > button:nth-child(' + k + ')' },
    { keys: ['Enter'], label: 'Enter', does: 'Next question', press: '#next' },
    { keys: ['p'], label: 'P', does: 'Play or stop the song', press: '.q-play' },
  ]);

  $('date').textContent = Daily.label(day) + '. Five quick questions, the same for everyone today.';

  if (isDone()) {
    renderDots($('dots'));
    finish();
  } else {
    $('status').textContent = 'Getting today’s questions…';
    buildQuestions().then((list) => {
      questions = list;
      index = today.marks.length;
      $('status').textContent = '';
      show();
    });
  }
})();
