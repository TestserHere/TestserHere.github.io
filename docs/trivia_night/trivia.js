/* Trivia Night: a pass-the-device quiz for teams, with questions from the Open Trivia Database. */

(function () {
  'use strict';

  const { $, read, write, el, setupStepper, getJson } = window.V3Tools;
  const { setStatus } = window.V3Apps;

  const SETUP_KEY = 'v3-trivia-setup';
  const TOKEN_KEY = 'v3-trivia-token';
  const API = 'https://opentdb.com';
  const POINTS = { easy: 1, medium: 2, hard: 3 };
  const SECONDS = 20;

  const saved = read(SETUP_KEY, {});
  const setup = {
    teams: Math.min(6, Math.max(1, Number(saved.teams) || 2)),
    names: Array.isArray(saved.names) ? saved.names.map(String) : [],
    perTeam: Math.min(10, Math.max(3, Number(saved.perTeam) || 5)),
    category: typeof saved.category === 'string' ? saved.category : '',
    difficulty: ['', 'easy', 'medium', 'hard'].includes(saved.difficulty) ? saved.difficulty : '',
    timer: !!saved.timer,
  };
  const remember = () => write(SETUP_KEY, setup);
  const teamName = (index) => (setup.names[index] || '').trim() || 'Team ' + (index + 1);

  /* ---------- Setup ---------- */

  function showNames() {
    const box = $('team-names');
    box.replaceChildren();
    for (let i = 0; i < setup.teams; i++) {
      const input = el('input', 'field');
      input.type = 'text';
      input.maxLength = 24;
      input.placeholder = 'Team ' + (i + 1);
      input.value = setup.names[i] || '';
      input.setAttribute('aria-label', 'Name of team ' + (i + 1));
      input.addEventListener('input', () => {
        setup.names[i] = input.value;
        remember();
      });
      box.appendChild(input);
    }
  }

  setupStepper($('team-count'), {
    read: () => ({ value: setup.teams, min: 1, max: 6 }),
    write: (value) => { setup.teams = value; remember(); showNames(); },
  });
  setupStepper($('per-team'), {
    read: () => ({ value: setup.perTeam, min: 3, max: 10 }),
    write: (value) => { setup.perTeam = value; remember(); },
  });

  const levelButtons = Array.from($('difficulty').querySelectorAll('button'));
  const showLevel = () => levelButtons.forEach((button) => button.setAttribute('aria-pressed', String(button.dataset.level === setup.difficulty)));
  levelButtons.forEach((button) => button.addEventListener('click', () => {
    setup.difficulty = button.dataset.level;
    remember();
    showLevel();
  }));

  $('use-timer').checked = setup.timer;
  $('use-timer').addEventListener('change', (event) => { setup.timer = event.target.checked; remember(); });

  $('category').addEventListener('change', (event) => { setup.category = event.target.value; remember(); });

  async function loadCategories() {
    try {
      const data = await getJson(API + '/api_category.php');
      const select = $('category');
      data.trivia_categories
        .map((category) => ({ id: String(category.id), name: category.name.replace(/^(Entertainment|Science): /, '') }))
        .sort((a, b) => a.name.localeCompare(b.name))
        .forEach((category) => {
          const option = el('option', '', category.name);
          option.value = category.id;
          select.appendChild(option);
        });
      select.value = setup.category;
      if (select.value !== setup.category) setup.category = '';
    } catch (_) { /* "Anything" still works */ }
  }

  /* ---------- Questions ---------- */

  const sleep = (ms) => new Promise((resolve) => setTimeout(resolve, ms));
  const decode = (text) => {
    try { return decodeURIComponent(text); } catch (_) { return text; }
  };

  // A session token stops the same question coming up twice.
  async function token(fresh) {
    let value = read(TOKEN_KEY, '');
    if (!value || fresh) {
      const data = await getJson(API + '/api_token.php?command=request');
      value = data.token || '';
      write(TOKEN_KEY, value);
    }
    return value;
  }

  async function fetchQuestions(amount) {
    let difficulty = setup.difficulty;
    let tries = 0;
    let fresh = false;
    while (tries++ < 6) {
      const params = new URLSearchParams({ amount: String(amount), encode: 'url3986' });
      if (setup.category) params.set('category', setup.category);
      if (difficulty) params.set('difficulty', difficulty);
      const sessionToken = await token(fresh).catch(() => '');
      if (sessionToken) params.set('token', sessionToken);
      const data = await getJson(API + '/api.php?' + params);
      switch (data.response_code) {
        case 0: return data.results;
        case 1: // Not enough questions: loosen the filters.
          if (difficulty) difficulty = '';
          else amount = Math.max(1, Math.floor(amount / 2));
          break;
        case 3:
        case 4: // The token ran out of new questions, or expired.
          fresh = true;
          break;
        case 5: // Asked too quickly.
          await sleep(5200);
          continue;
        default:
          throw new Error('code ' + data.response_code);
      }
      await sleep(5200);
    }
    throw new Error('gave up');
  }

  /* ---------- Playing ---------- */

  let game = null;
  let timer = 0;

  async function start() {
    const teams = Array.from({ length: setup.teams }, (_, index) => ({ name: teamName(index), score: 0, right: 0 }));
    const amount = Math.min(50, setup.teams * setup.perTeam);
    $('start').disabled = true;
    setStatus($('setup-status'), 'Getting questions…', 'busy');
    try {
      const raw = await fetchQuestions(amount);
      const questions = raw.map((item) => ({
        category: decode(item.category).replace(/^(Entertainment|Science): /, ''),
        difficulty: item.difficulty,
        type: item.type,
        question: decode(item.question),
        answer: decode(item.correct_answer),
        options: item.type === 'boolean'
          ? ['True', 'False']
          : shuffle([item.correct_answer].concat(item.incorrect_answers).map(decode)),
      }));
      // Share questions evenly, so every team gets the same number of turns.
      const usable = questions.slice(0, Math.floor(questions.length / setup.teams) * setup.teams || questions.length);
      game = { teams, questions: usable, index: 0, answered: false };
      setStatus($('setup-status'), '');
      $('setup').hidden = true;
      $('results').hidden = true;
      $('play').hidden = false;
      showTurn();
    } catch (_) {
      setStatus($('setup-status'), "Couldn't get questions right now. Wait a few seconds and try again.", 'problem');
    } finally {
      $('start').disabled = false;
    }
  }

  function shuffle(list) {
    const copy = list.slice();
    for (let i = copy.length - 1; i > 0; i--) {
      const j = Math.floor(Math.random() * (i + 1));
      [copy[i], copy[j]] = [copy[j], copy[i]];
    }
    return copy;
  }

  const currentTeam = () => game.teams[game.index % game.teams.length];

  function showScores() {
    const box = $('scoreboard');
    box.replaceChildren();
    game.teams.forEach((team) => {
      const chip = el('span', 'score-chip' + (team === currentTeam() && !game.over ? ' is-turn' : ''));
      chip.append(el('span', '', team.name), el('strong', '', String(team.score)));
      box.appendChild(chip);
    });
    box.hidden = game.teams.length < 2;
  }

  function showTurn() {
    const question = game.questions[game.index];
    const team = currentTeam();
    game.answered = false;
    showScores();
    const round = Math.floor(game.index / game.teams.length) + 1;
    const rounds = Math.ceil(game.questions.length / game.teams.length);
    $('turn-round').textContent = 'Round ' + round + ' of ' + rounds;
    $('turn-team').textContent = game.teams.length > 1 ? team.name + ' to answer' : 'Question ' + (game.index + 1) + ' of ' + game.questions.length;
    $('question-meta').textContent = question.category + ' · ' + question.difficulty[0].toUpperCase() + question.difficulty.slice(1) + ' · ' + POINTS[question.difficulty] + (POINTS[question.difficulty] === 1 ? ' point' : ' points');
    $('question').textContent = question.question;
    $('message').textContent = '';
    $('message').className = 'message';
    $('next').hidden = true;

    const box = $('answers');
    box.replaceChildren();
    box.classList.toggle('is-long', question.options.some((option) => option.length > 18));
    question.options.forEach((option) => {
      const button = el('button', 'answer', option);
      button.type = 'button';
      button.addEventListener('click', () => answer(option));
      box.appendChild(button);
    });

    clearInterval(timer);
    $('timer-bar').hidden = !setup.timer;
    if (setup.timer) {
      const ends = Date.now() + SECONDS * 1000;
      const fill = $('timer-fill');
      const update = () => {
        const left = Math.max(0, ends - Date.now());
        fill.style.width = (left / (SECONDS * 1000)) * 100 + '%';
        fill.classList.toggle('is-low', left < 5000);
        if (!left) answer(null);
      };
      update();
      timer = setInterval(update, 100);
    }
  }

  function answer(option) {
    if (game.answered) return;
    game.answered = true;
    clearInterval(timer);
    const question = game.questions[game.index];
    const team = currentTeam();
    const right = option === question.answer;
    if (right) {
      team.score += POINTS[question.difficulty];
      team.right++;
    }
    Array.from($('answers').children).forEach((button) => {
      button.disabled = true;
      if (button.textContent === question.answer) button.classList.add('is-right');
      else if (button.textContent === option) button.classList.add('is-wrong');
      else button.classList.add('is-faded');
    });
    const message = $('message');
    message.className = 'message ' + (right ? 'is-good' : 'is-bad');
    message.textContent = right
      ? 'Correct! +' + POINTS[question.difficulty]
      : (option === null ? 'Time’s up! ' : 'Not quite. ') + 'The answer is ' + question.answer + '.';
    showScores();
    const last = game.index + 1 >= game.questions.length;
    $('next').hidden = false;
    $('next').textContent = last ? 'See the results' : game.teams.length > 1 ? 'Next: ' + game.teams[(game.index + 1) % game.teams.length].name : 'Next question';
    $('next').focus();
  }

  $('next').addEventListener('click', () => {
    game.index++;
    if (game.index < game.questions.length) showTurn(); else finish();
  });

  $('end-early').addEventListener('click', () => {
    if (game && confirm('End the game now and see the scores?')) finish();
  });

  function finish() {
    clearInterval(timer);
    game.over = true;
    const ranked = game.teams.slice().sort((a, b) => b.score - a.score);
    const top = ranked[0];
    const tied = ranked.filter((team) => team.score === top.score);
    if (game.teams.length === 1) {
      $('winner').textContent = top.score + (top.score === 1 ? ' point' : ' points');
      $('winner-text').textContent = top.right + ' of ' + game.questions.length + ' right.';
    } else if (tied.length > 1) {
      $('winner').textContent = 'It’s a tie!';
      $('winner-text').textContent = tied.map((team) => team.name).join(' and ') + ' share the win with ' + top.score + ' points.';
    } else {
      $('winner').textContent = top.name + ' wins!';
      $('winner-text').textContent = 'With ' + top.score + (top.score === 1 ? ' point.' : ' points.');
    }
    const list = $('ranking');
    list.replaceChildren();
    ranked.forEach((team) => {
      const row = el('li', 'rank-row');
      row.append(el('span', '', team.name), el('span', 'muted', team.right + ' right'), el('strong', '', String(team.score)));
      list.appendChild(row);
    });
    list.hidden = game.teams.length < 2;
    $('play').hidden = true;
    $('results').hidden = false;
  }

  $('start').addEventListener('click', start);
  $('again').addEventListener('click', start);
  $('change').addEventListener('click', () => {
    $('results').hidden = true;
    $('setup').hidden = false;
    showNames();
  });

  showNames();
  showLevel();
  loadCategories();
})();

/* Keyboard shortcuts */
window.V3Keys.add([
  { keys: ['1', '2', '3', '4'], label: '1 to 4', does: 'Choose an answer', press: (key) => '#answers > button:nth-child(' + key + ')' },
  { keys: ['Enter'], label: 'Enter', does: 'Start, next question or play again', press: ['#next', '#start', '#again'] },
]);
