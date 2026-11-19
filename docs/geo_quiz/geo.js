/* Geo Quiz: flags, capitals and a mystery country found by distance and direction. */

(function () {
  'use strict';

  const { $, read, write, el } = window.V3Tools;
  const { norm } = window.V3Apps;
  const ALL = window.COUNTRIES;

  const STATE_KEY = 'v3-geo-state';
  const BEST_KEY = 'v3-geo-best';
  const ROUNDS = 10;
  const MAX_GUESSES = 8;
  const REGIONS = ['World', 'Africa', 'Americas', 'Asia', 'Europe', 'Oceania'];

  const saved0 = read(STATE_KEY, {});
  const state = {
    mode: ['flags', 'capitals', 'mystery'].includes(saved0.mode) ? saved0.mode : 'flags',
    region: REGIONS.includes(saved0.region) ? saved0.region : 'World',
  };
  const remember = () => write(STATE_KEY, state);

  const flag = (country) => 'https://flagcdn.com/w320/' + country.code + '.png';
  const shuffle = (list) => {
    const copy = list.slice();
    for (let i = copy.length - 1; i > 0; i--) {
      const j = Math.floor(Math.random() * (i + 1));
      [copy[i], copy[j]] = [copy[j], copy[i]];
    }
    return copy;
  };
  const inRegion = () => (state.region === 'World' ? ALL : ALL.filter((country) => country.region === state.region));

  /* ---------- Mode and region ---------- */

  const modeButtons = Array.from($('mode').querySelectorAll('button'));

  function showChoices() {
    modeButtons.forEach((button) => button.setAttribute('aria-pressed', String(button.dataset.mode === state.mode)));
    const box = $('regions');
    box.replaceChildren();
    REGIONS.forEach((region) => {
      const chip = el('button', 'chip', region);
      chip.type = 'button';
      chip.setAttribute('aria-pressed', String(state.region === region));
      chip.addEventListener('click', () => {
        if (state.region === region) return;
        state.region = region;
        remember();
        showChoices();
        startGame();
      });
      box.appendChild(chip);
    });
  }

  modeButtons.forEach((button) => button.addEventListener('click', () => {
    if (state.mode === button.dataset.mode) return;
    state.mode = button.dataset.mode;
    remember();
    showChoices();
    startGame();
  }));

  function startGame() {
    $('quiz').hidden = state.mode === 'mystery';
    $('mystery').hidden = state.mode !== 'mystery';
    if (state.mode === 'mystery') startMystery(); else startQuiz();
  }

  /* ---------- Flags and capitals ---------- */

  let quiz = null;

  function startQuiz() {
    const pool = inRegion().filter((country) => state.mode !== 'capitals' || country.capital);
    quiz = { questions: shuffle(pool).slice(0, ROUNDS), index: 0, score: 0, answered: false };
    $('quiz-end').hidden = true;
    $('quiz-card').hidden = false;
    $('quiz-answers').hidden = false;
    showQuestion();
  }

  // Wrong answers come from the same part of the world, so they're harder to rule out.
  function distractors(answer, count) {
    const field = state.mode === 'capitals' ? 'capital' : 'name';
    const near = ALL.filter((country) => country !== answer && country[field] && country.sub === answer.sub);
    const sameRegion = ALL.filter((country) => country !== answer && country[field] && country.region === answer.region && country.sub !== answer.sub);
    const rest = ALL.filter((country) => country !== answer && country[field] && country.region !== answer.region);
    const picked = [];
    [shuffle(near), shuffle(sameRegion), shuffle(rest)].forEach((group) => {
      group.forEach((country) => {
        if (picked.length < count && !picked.some((other) => other[field] === country[field])) picked.push(country);
      });
    });
    return picked;
  }

  function showQuestion() {
    const country = quiz.questions[quiz.index];
    quiz.answered = false;
    $('quiz-round').textContent = 'Question ' + (quiz.index + 1) + ' of ' + quiz.questions.length;
    $('quiz-score').textContent = String(quiz.score);
    $('quiz-progress').style.width = (quiz.index / quiz.questions.length) * 100 + '%';
    $('quiz-message').textContent = '';
    $('quiz-message').className = 'message';
    $('quiz-next').hidden = true;

    const image = $('quiz-flag');
    image.src = flag(country);
    if (state.mode === 'flags') {
      image.alt = 'A flag';
      image.classList.remove('is-small');
      $('quiz-question').textContent = 'Which country has this flag?';
    } else {
      image.alt = 'Flag of ' + country.name;
      image.classList.add('is-small');
      $('quiz-question').textContent = 'What is the capital of ' + country.name + '?';
    }

    const field = state.mode === 'capitals' ? 'capital' : 'name';
    const options = shuffle([country].concat(distractors(country, 3)));
    const box = $('quiz-answers');
    box.replaceChildren();
    box.classList.toggle('is-long', options.some((option) => option[field].length > 16));
    options.forEach((option) => {
      const button = el('button', 'answer', option[field]);
      button.type = 'button';
      button.addEventListener('click', () => answer(option, button));
      box.appendChild(button);
    });
  }

  function answer(option, button) {
    if (quiz.answered) return;
    quiz.answered = true;
    const country = quiz.questions[quiz.index];
    const right = option === country;
    if (right) quiz.score++;
    const field = state.mode === 'capitals' ? 'capital' : 'name';
    Array.from($('quiz-answers').children).forEach((other) => {
      other.disabled = true;
      if (other.textContent === country[field]) other.classList.add('is-right');
      else if (other === button) other.classList.add('is-wrong');
      else other.classList.add('is-faded');
    });
    const message = $('quiz-message');
    message.className = 'message ' + (right ? 'is-good' : 'is-bad');
    message.textContent = right
      ? pickOne(['Right!', 'Correct!', 'Nice one!', 'Yes!'])
      : (state.mode === 'flags' ? "That's the flag of " + country.name + '.' : 'The capital of ' + country.name + ' is ' + country.capital + '.');
    $('quiz-score').textContent = String(quiz.score);
    $('quiz-next').hidden = false;
    $('quiz-next').textContent = quiz.index + 1 < quiz.questions.length ? 'Next' : 'See score';
    $('quiz-next').focus();
  }

  const pickOne = (list) => list[Math.floor(Math.random() * list.length)];

  $('quiz-next').addEventListener('click', () => {
    quiz.index++;
    if (quiz.index < quiz.questions.length) showQuestion(); else endQuiz();
  });

  function endQuiz() {
    const total = quiz.questions.length;
    $('quiz-progress').style.width = '100%';
    $('quiz-card').hidden = true;
    $('quiz-answers').hidden = true;
    $('quiz-next').hidden = true;
    $('quiz-message').textContent = '';
    const best = read(BEST_KEY, {});
    const key = state.mode + '|' + state.region;
    const old = best[key] || 0;
    if (quiz.score > old) { best[key] = quiz.score; write(BEST_KEY, best); }
    $('quiz-end-title').textContent = quiz.score + ' out of ' + total;
    const verdict = quiz.score === total ? 'Perfect!' : quiz.score >= total * 0.7 ? 'Great work.' : quiz.score >= total * 0.4 ? 'Not bad.' : 'Keep practising.';
    $('quiz-end-text').textContent = verdict + (quiz.score > old && old ? ' New best!' : old ? ' Your best is ' + Math.max(old, quiz.score) + '.' : '');
    $('quiz-end').hidden = false;
  }

  $('quiz-again').addEventListener('click', startQuiz);

  /* ---------- Mystery country ---------- */

  let mystery = null;
  const RADIUS = 6371;
  const rad = (deg) => (deg * Math.PI) / 180;

  function distance(a, b) {
    const dLat = rad(b.lat - a.lat);
    const dLng = rad(b.lng - a.lng);
    const h = Math.sin(dLat / 2) ** 2 + Math.cos(rad(a.lat)) * Math.cos(rad(b.lat)) * Math.sin(dLng / 2) ** 2;
    return 2 * RADIUS * Math.asin(Math.sqrt(h));
  }

  function bearing(a, b) {
    const y = Math.sin(rad(b.lng - a.lng)) * Math.cos(rad(b.lat));
    const x = Math.cos(rad(a.lat)) * Math.sin(rad(b.lat)) - Math.sin(rad(a.lat)) * Math.cos(rad(b.lat)) * Math.cos(rad(b.lng - a.lng));
    return ((Math.atan2(y, x) * 180) / Math.PI + 360) % 360;
  }

  const DIRECTIONS = ['north', 'north-east', 'east', 'south-east', 'south', 'south-west', 'west', 'north-west'];
  const direction = (degrees) => DIRECTIONS[Math.round(degrees / 45) % 8];

  function startMystery() {
    const pool = inRegion();
    mystery = { answer: pool[Math.floor(Math.random() * pool.length)], guesses: [], done: false };
    $('guesses').replaceChildren();
    $('hints').replaceChildren();
    $('mystery-end').hidden = true;
    $('mystery-give-up').hidden = false;
    $('guess').disabled = false;
    $('guess').value = '';
    setMessage('You have ' + MAX_GUESSES + ' guesses.' + (state.region === 'World' ? '' : ' It’s in ' + state.region + '.'));
  }

  function setMessage(text, kind) {
    const message = $('mystery-message');
    message.textContent = text;
    message.className = 'message' + (kind ? ' is-' + kind : '');
  }

  function findCountry(text) {
    const wanted = norm(text);
    return ALL.find((country) => norm(country.name) === wanted);
  }

  function guess(country) {
    if (!mystery || mystery.done) return;
    if (mystery.guesses.includes(country)) {
      setMessage("You've already guessed " + country.name + '.', 'bad');
      return;
    }
    mystery.guesses.push(country);
    const target = mystery.answer;
    const row = el('li', 'guess');
    row.appendChild(el('img', 'guess-flag'));
    row.lastChild.src = flag(country);
    row.lastChild.alt = '';
    row.appendChild(el('strong', 'guess-name', country.name));
    if (country === target) {
      row.classList.add('is-right');
      row.appendChild(el('span', 'guess-km', 'Found it!'));
    } else {
      const km = Math.round(distance(country, target));
      const way = bearing(country, target);
      row.appendChild(el('span', 'guess-km', km.toLocaleString() + ' km'));
      const arrow = el('span', 'guess-arrow', '↑');
      arrow.style.transform = 'rotate(' + Math.round(way) + 'deg)';
      arrow.setAttribute('role', 'img');
      arrow.setAttribute('aria-label', 'Go ' + direction(way));
      row.appendChild(arrow);
      // Closeness: 100% on top of it, 0% on the other side of the world.
      const close = Math.max(0, Math.round(100 - (km / 20000) * 100));
      row.appendChild(el('span', 'guess-close', close + '%'));
      row.style.setProperty('--close', close + '%');
    }
    $('guesses').prepend(row);

    if (country === target) return endMystery(true);
    const left = MAX_GUESSES - mystery.guesses.length;
    if (!left) return endMystery(false);
    setMessage('Not ' + country.name + '. Head ' + direction(bearing(country, target)) + '. ' + left + (left === 1 ? ' guess' : ' guesses') + ' left.');
    showHints();
  }

  function showHints() {
    const target = mystery.answer;
    const count = mystery.guesses.length;
    const hints = [];
    if (count >= 2) hints.push('It’s in ' + (target.sub || target.region) + '.');
    if (count >= 4) hints.push((target.landlocked ? 'It has no coast.' : 'It has a coastline.') + (target.languages.length ? ' People speak ' + target.languages[0] + '.' : ''));
    if (count >= 6 && target.capital) hints.push('Its capital starts with “' + target.capital[0] + '”.');
    const box = $('hints');
    box.replaceChildren();
    hints.forEach((text) => box.appendChild(el('li', '', text)));
  }

  function endMystery(won) {
    mystery.done = true;
    $('guess').disabled = true;
    $('mystery-give-up').hidden = true;
    const target = mystery.answer;
    $('mystery-flag').src = flag(target);
    $('mystery-flag').alt = 'Flag of ' + target.name;
    const count = mystery.guesses.length;
    $('mystery-end-title').textContent = won ? target.name + '!' : 'It was ' + target.name;
    const facts = [target.capital ? 'Capital: ' + target.capital : '', target.languages.length ? 'Language: ' + target.languages.join(', ') : '',
      target.currency.length ? 'Money: ' + target.currency[0] : ''].filter(Boolean).join(' · ');
    $('mystery-end-text').textContent = (won ? 'Found in ' + count + (count === 1 ? ' guess. ' : ' guesses. ') : '') + facts;
    $('mystery-end').hidden = false;
    setMessage(won ? 'You got it!' : 'Out of guesses.', won ? 'good' : 'bad');
    if (won) {
      const best = read(BEST_KEY, {});
      const key = 'mystery|' + state.region;
      if (!best[key] || count < best[key]) { best[key] = count; write(BEST_KEY, best); }
    }
  }

  $('mystery-give-up').addEventListener('click', () => { if (mystery && !mystery.done) endMystery(false); });
  $('mystery-again').addEventListener('click', startMystery);

  /* The guess box suggests country names as you type. */
  const input = $('guess');
  const list = $('guess-list');
  let options = [];
  let active = -1;

  function closeList() {
    list.hidden = true;
    list.replaceChildren();
    options = [];
    active = -1;
    input.setAttribute('aria-expanded', 'false');
    input.removeAttribute('aria-activedescendant');
  }

  function choose(country) {
    closeList();
    input.value = '';
    guess(country);
    input.focus();
  }

  input.addEventListener('input', () => {
    const text = norm(input.value);
    if (!text) { closeList(); return; }
    options = ALL.filter((country) => norm(country.name).startsWith(text))
      .concat(ALL.filter((country) => !norm(country.name).startsWith(text) && norm(country.name).includes(text)))
      .slice(0, 6);
    list.replaceChildren();
    options.forEach((country, index) => {
      const row = el('li', 'suggestion');
      row.id = 'guess-list-' + index;
      row.setAttribute('role', 'option');
      const image = el('img', 'guess-flag');
      image.src = flag(country);
      image.alt = '';
      row.append(image, el('span', '', country.name));
      row.addEventListener('mousedown', (event) => event.preventDefault());
      row.addEventListener('click', () => choose(country));
      list.appendChild(row);
    });
    list.hidden = !options.length;
    input.setAttribute('aria-expanded', String(!!options.length));
    active = options.length ? 0 : -1;
    highlight();
  });

  function highlight() {
    Array.from(list.children).forEach((row, index) => row.setAttribute('aria-selected', String(index === active)));
    if (active >= 0) input.setAttribute('aria-activedescendant', 'guess-list-' + active);
  }

  input.addEventListener('keydown', (event) => {
    if (event.key === 'ArrowDown' || event.key === 'ArrowUp') {
      if (!options.length) return;
      event.preventDefault();
      active = (active + (event.key === 'ArrowDown' ? 1 : -1) + options.length) % options.length;
      highlight();
    } else if (event.key === 'Enter') {
      event.preventDefault();
      const country = options[Math.max(0, active)] || findCountry(input.value);
      if (country) choose(country);
      else if (input.value.trim()) setMessage("That's not a country on the list.", 'bad');
    } else if (event.key === 'Escape') {
      closeList();
    }
  });
  input.addEventListener('blur', () => setTimeout(closeList, 150));

  showChoices();
  startGame();
})();
