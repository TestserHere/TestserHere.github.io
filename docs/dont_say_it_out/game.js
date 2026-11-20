(function () {
  'use strict';

  const $ = (id) => document.getElementById(id);

  const MIN_TEAMS = 1;
  const MAX_TEAMS = 4;
  const MIN_ROUNDS = 1;
  const MAX_ROUNDS = 10;
  const LENGTHS = [30, 60, 90, 120];
  const QUESTION_COUNTS = [5, 10, 15, 20];
  const SEEN_KEY = 'v3-dsio-seen';
  const SETUP_KEY = 'v3-dsio-setup';
  const POINTS = { correct: 1, pass: 0, forbidden: -1 };
  const RESULT_NAMES = { correct: 'Correct', pass: 'Passed', forbidden: 'Forbidden' };
  const LOW_TIME = 10;

  const PACKS = {
    en: { label: 'English', lang: 'en', cards: WORD_CARDS },
    zh: { label: '中文', lang: 'zh-CN', cards: CHINESE_WORD_CARDS },
  };

  /* Saved data is read inside try/catch: private windows can block storage. */
  function load(key, fallback) {
    try {
      const value = JSON.parse(localStorage.getItem(key));
      return value && typeof value === 'object' ? value : fallback;
    } catch (_) {
      return fallback;
    }
  }
  function store(key, value) {
    try { localStorage.setItem(key, JSON.stringify(value)); } catch (_) { /* not saved */ }
  }

  const savedSetup = load(SETUP_KEY, {});
  const setup = {
    teams: 2, names: [], rounds: 3,
    seconds: LENGTHS.includes(savedSetup.seconds) ? savedSetup.seconds : 60,
    lengthMode: savedSetup.lengthMode === 'questions' ? 'questions' : 'time',
    questions: QUESTION_COUNTS.includes(savedSetup.questions) ? savedSetup.questions : 10,
    pack: PACKS[savedSetup.pack] ? savedSetup.pack : 'en',
  };
  const saveSetup = () => store(SETUP_KEY, { seconds: setup.seconds, lengthMode: setup.lengthMode, questions: setup.questions, pack: setup.pack });

  /* Cards already played in this browser, per pack, so no card comes back until the whole pack has been seen. */
  const seenStore = load(SEEN_KEY, {});
  function seenSet(packKey) {
    return new Set(Array.isArray(seenStore[packKey]) ? seenStore[packKey].filter((w) => typeof w === 'string') : []);
  }
  function markSeen(packKey, word) {
    const list = Array.isArray(seenStore[packKey]) ? seenStore[packKey] : (seenStore[packKey] = []);
    if (!list.includes(word)) list.push(word);
    store(SEEN_KEY, seenStore);
  }
  function forgetSeen(packKey) {
    seenStore[packKey] = [];
    store(SEEN_KEY, seenStore);
  }

  let game = null;
  let turn = null;
  let audio = null;

  function show(id) {
    document.querySelectorAll('.screen').forEach((screen) => { screen.hidden = screen.id !== id; });
    window.scrollTo(0, 0);
  }

  function el(tag, className, text) {
    const node = document.createElement(tag);
    if (className) node.className = className;
    if (text !== undefined) node.textContent = text;
    return node;
  }

  function shuffled(list) {
    const copy = list.slice();
    for (let i = copy.length - 1; i > 0; i--) {
      const j = Math.floor(Math.random() * (i + 1));
      [copy[i], copy[j]] = [copy[j], copy[i]];
    }
    return copy;
  }

  function teamName(index) {
    return (setup.names[index] || '').trim() || 'Team ' + (index + 1);
  }

  /* Setup screen */
  function renderTeamNames() {
    const box = $('team-names');
    box.replaceChildren();
    for (let i = 0; i < setup.teams; i++) {
      const input = el('input');
      input.type = 'text';
      input.maxLength = 16;
      input.placeholder = 'Team ' + (i + 1);
      input.value = setup.names[i] || '';
      input.setAttribute('aria-label', 'Name of team ' + (i + 1));
      input.addEventListener('input', () => { setup.names[i] = input.value; });
      box.appendChild(input);
    }
    $('teams-value').textContent = setup.teams;
    $('teams-minus').disabled = setup.teams <= MIN_TEAMS;
    $('teams-plus').disabled = setup.teams >= MAX_TEAMS;
  }

  function renderRounds() {
    $('rounds-value').textContent = setup.rounds;
    $('rounds-minus').disabled = setup.rounds <= MIN_ROUNDS;
    $('rounds-plus').disabled = setup.rounds >= MAX_ROUNDS;
  }

  function renderLengths() {
    $('length-mode').querySelectorAll('button').forEach((button) => {
      button.setAttribute('aria-pressed', String(button.dataset.mode === setup.lengthMode));
    });
    const byTime = setup.lengthMode === 'time';
    $('length-label').textContent = byTime ? 'Time per turn' : 'Questions per turn';
    const box = $('length-options');
    box.replaceChildren();
    (byTime ? LENGTHS : QUESTION_COUNTS).forEach((value) => {
      const button = el('button', '', byTime ? value + 's' : String(value));
      button.type = 'button';
      button.setAttribute('aria-pressed', String(value === (byTime ? setup.seconds : setup.questions)));
      button.addEventListener('click', () => {
        if (byTime) setup.seconds = value; else setup.questions = value;
        saveSetup();
        renderLengths();
      });
      box.appendChild(button);
    });
  }

  $('length-mode').querySelectorAll('button').forEach((button) => button.addEventListener('click', () => {
    setup.lengthMode = button.dataset.mode;
    saveSetup();
    renderLengths();
  }));

  function renderPacks() {
    const box = $('pack-options');
    box.replaceChildren();
    Object.keys(PACKS).forEach((key) => {
      const button = el('button', '', PACKS[key].label);
      button.type = 'button';
      button.setAttribute('aria-pressed', String(key === setup.pack));
      button.addEventListener('click', () => {
        setup.pack = key;
        saveSetup();
        renderPacks();
      });
      box.appendChild(button);
    });
    renderPackNote();
  }

  function renderPackNote() {
    const pack = PACKS[setup.pack];
    const note = $('pack-note');
    const seen = seenSet(setup.pack);
    const fresh = pack.cards.filter((card) => !seen.has(card[0])).length;
    const total = pack.cards.length;
    if (setup.pack === 'zh') {
      note.textContent = fresh === total ? '共 ' + total + ' 张卡片。' : '共 ' + total + ' 张卡片，还有 ' + fresh + ' 张没玩过。';
    } else {
      note.textContent = fresh === total ? total + ' cards.' : total + ' cards, ' + fresh + " you haven't played yet.";
    }
  }

  $('teams-minus').addEventListener('click', () => { setup.teams--; renderTeamNames(); });
  $('teams-plus').addEventListener('click', () => { setup.teams++; renderTeamNames(); });
  $('rounds-minus').addEventListener('click', () => { setup.rounds--; renderRounds(); });
  $('rounds-plus').addEventListener('click', () => { setup.rounds++; renderRounds(); });
  $('setup-form').addEventListener('submit', (event) => {
    event.preventDefault();
    startGame();
  });


  /* Game flow */
  function startGame() {
    const pack = PACKS[setup.pack];
    document.documentElement.lang = pack.lang; // picks the right Chinese letterforms
    game = {
      teams: Array.from({ length: setup.teams }, (_, i) => ({
        name: teamName(i), score: 0, correct: 0, pass: 0, forbidden: 0,
      })),
      seconds: setup.seconds,
      lengthMode: setup.lengthMode,
      questions: setup.questions,
      packKey: setup.pack,
      rounds: setup.rounds,
      round: 1,
      teamIndex: 0,
      cards: pack.cards,
      deck: freshDeck(setup.pack, pack.cards),
      log: [],
    };
    showReady();
  }

  function currentTeam() {
    return game.teams[game.teamIndex];
  }

  function roundText() {
    return 'Round ' + game.round + ' of ' + game.rounds;
  }

  function showReady() {
    $('ready-round').textContent = roundText();
    $('ready-team').textContent = currentTeam().name;
    show('screen-ready');
  }

  /* Unplayed cards first. Once every card has been played, the pack starts over. */
  function freshDeck(packKey, cards) {
    const seen = seenSet(packKey);
    let fresh = cards.filter((card) => !seen.has(card[0]));
    if (!fresh.length) {
      forgetSeen(packKey);
      fresh = cards;
    }
    return shuffled(fresh);
  }

  function drawCard() {
    const packKey = game.packKey;
    if (!game.deck.length) game.deck = freshDeck(packKey, game.cards);
    const card = game.deck.pop();
    markSeen(packKey, card[0]);
    return card;
  }

  function setRevealed(revealed) {
    turn.revealed = revealed;
    $('word-card').setAttribute('aria-pressed', String(revealed));
    $('word-hidden').hidden = revealed;
    $('word-shown').hidden = !revealed;
  }

  function nextCard() {
    const [word, ...forbidden] = drawCard();
    turn.word = word;
    $('word').textContent = word;
    $('forbidden').replaceChildren(...forbidden.map((item) => el('span', '', item)));
    setRevealed(false);
    setActionsEnabled(false); // the speaker must look at each card before scoring it
  }

  function setActionsEnabled(enabled) {
    ['act-pass', 'act-forbidden', 'act-correct'].forEach((id) => { $(id).disabled = !enabled; });
  }

  function startTurn() {
    unlockAudio();
    turn = {
      deadline: Date.now() + game.seconds * 1000,
      timer: 0,
      word: '',
      revealed: false,
      results: [],
      points: 0,
    };
    $('play-team').textContent = currentTeam().name;
    $('play-round').textContent = roundText();
    $('play-score').textContent = currentTeam().score;
    $('play-time').setAttribute('role', game.lengthMode === 'time' ? 'timer' : 'status');
    $('play-time').classList.toggle('is-count', game.lengthMode === 'questions');
    nextCard();
    show('screen-play');
    if (game.lengthMode === 'questions') {
      showQuestionCount();
      return;
    }
    tick();
    turn.timer = setInterval(tick, 100);
  }

  /* Questions mode: shows which card this is, like 4/10, and fills the bar as cards are played. */
  function showQuestionCount() {
    const done = turn.results.length;
    $('play-time').textContent = Math.min(done + 1, game.questions) + '/' + game.questions;
    $('play-time').classList.remove('low');
    $('play-bar').style.transform = 'scaleX(' + (1 - done / game.questions) + ')';
  }

  function tick() {
    const remaining = Math.max(0, turn.deadline - Date.now());
    const seconds = Math.ceil(remaining / 1000);
    $('play-time').textContent = seconds;
    $('play-time').classList.toggle('low', seconds <= LOW_TIME);
    $('play-bar').style.transform = 'scaleX(' + remaining / (game.seconds * 1000) + ')';
    if (remaining <= 0) endTurn();
  }

  function score(result) {
    const team = currentTeam();
    team[result]++;
    team.score += POINTS[result];
    turn.points += POINTS[result];
    const entry = { word: turn.word, result, round: game.round, team: team.name };
    turn.results.push(entry);
    game.log.push(entry);
    $('play-score').textContent = team.score;
    if (game.lengthMode === 'questions') {
      showQuestionCount();
      if (turn.results.length >= game.questions) {
        endTurn();
        return;
      }
    }
    nextCard();
  }

  function endTurn() {
    clearInterval(turn.timer);
    beep();
    setActionsEnabled(false);
    showTurnRecap();
  }

  function isLastTurn() {
    return game.round === game.rounds && game.teamIndex === game.teams.length - 1;
  }

  function resultList(entries) {
    const list = el('ul', 'results');
    if (!entries.length) {
      list.appendChild(el('li', 'results-empty', 'No words played'));
      return list;
    }
    entries.forEach((entry) => {
      const row = el('li');
      row.append(el('span', '', entry.word), el('span', 'tag tag-' + entry.result, RESULT_NAMES[entry.result]));
      list.appendChild(row);
    });
    return list;
  }

  function pointsText(points) {
    const sign = points > 0 ? '+' : points < 0 ? '−' : '';
    const size = Math.abs(points);
    return sign + size + (size === 1 ? ' point' : ' points');
  }

  function showTurnRecap() {
    const teamCount = game.teams.length;
    $('turn-title').textContent = (teamCount > 1 ? currentTeam().name + ': ' : '') + pointsText(turn.points);
    $('turn-eyebrow').textContent = game.lengthMode === 'questions' ? 'Turn over!' : "Time's up!";
    $('turn-results').replaceWith(Object.assign(resultList(turn.results), { id: 'turn-results' }));
    $('turn-next').textContent = isLastTurn() ? 'See summary' : 'Next turn';
    show('screen-turn');
  }

  function advance() {
    if (isLastTurn()) {
      showSummary();
      return;
    }
    game.teamIndex++;
    if (game.teamIndex >= game.teams.length) {
      game.teamIndex = 0;
      game.round++;
    }
    showReady();
  }

  /* Summary: a winner is only named when more than one team played */
  function summaryTitle(ranked) {
    if (ranked.length === 1) return ranked[0].score + (Math.abs(ranked[0].score) === 1 ? ' point' : ' points');
    const top = ranked.filter((team) => team.score === ranked[0].score);
    if (top.length > 1) return "It's a tie!";
    return top[0].name + ' wins!';
  }

  function showSummary() {
    const ranked = game.teams.slice().sort((a, b) => b.score - a.score);
    $('summary-title').textContent = summaryTitle(ranked);

    const hasWinner = ranked.length > 1 && (ranked[0].score !== ranked[1].score);
    $('summary-scores').replaceChildren(...ranked.map((team, index) => {
      const row = el('div', 'score-row' + (hasWinner && index === 0 ? ' is-winner' : ''));
      row.append(
        el('div', 'score-name', team.name),
        el('div', 'score-points', team.score),
        el('div', 'muted small', team.correct + ' correct · ' + team.pass + ' passed · ' + team.forbidden + ' forbidden')
      );
      return row;
    }));

    const wordsBox = $('summary-words');
    wordsBox.replaceChildren();
    for (let round = 1; round <= game.rounds; round++) {
      game.teams.forEach((team) => {
        const block = el('div', 'turn-words');
        const heading = 'Round ' + round + (game.teams.length > 1 ? ' · ' + team.name : '');
        block.append(el('h4', '', heading), resultList(game.log.filter((e) => e.round === round && e.team === team.name)));
        wordsBox.appendChild(block);
      });
    }
    show('screen-summary');
  }

  /* End-of-turn sound */
  function unlockAudio() {
    const AudioContextClass = window.AudioContext || window.webkitAudioContext;
    if (!AudioContextClass) return;
    if (!audio) audio = new AudioContextClass();
    if (audio.state === 'suspended') audio.resume();
  }

  function beep() {
    if (!audio) return;
    const oscillator = audio.createOscillator();
    const gain = audio.createGain();
    oscillator.frequency.value = 660;
    gain.gain.setValueAtTime(0.25, audio.currentTime);
    gain.gain.exponentialRampToValueAtTime(0.001, audio.currentTime + 0.6);
    oscillator.connect(gain).connect(audio.destination);
    oscillator.start();
    oscillator.stop(audio.currentTime + 0.6);
  }

  /* Controls */
  $('word-card').addEventListener('click', () => {
    setRevealed(!turn.revealed);
    setActionsEnabled(true);
  });
  $('act-correct').addEventListener('click', () => score('correct'));
  $('act-pass').addEventListener('click', () => score('pass'));
  $('act-forbidden').addEventListener('click', () => score('forbidden'));
  $('ready-start').addEventListener('click', startTurn);
  $('turn-next').addEventListener('click', advance);
  $('summary-again').addEventListener('click', startGame);
  $('summary-new').addEventListener('click', () => {
    renderPackNote();
    show('screen-setup');
  });

  // The home page shows its own Done button when the game opens inside it.
  $('back-home').hidden = window.top !== window.self;

  renderTeamNames();
  renderRounds();
  renderLengths();
  renderPacks();
})();

/* Keyboard shortcuts */
window.V3Keys.add([
  { keys: [' '], label: 'Space', does: 'Show or hide the word', press: '#word-card' },
  { keys: ['c', 'ArrowRight'], label: 'C or →', does: 'Correct', press: '#act-correct' },
  { keys: ['p', 'ArrowDown'], label: 'P or ↓', does: 'Pass', press: '#act-pass' },
  { keys: ['x', 'ArrowLeft'], label: 'X or ←', does: 'Forbidden word said', press: '#act-forbidden' },
  { keys: ['Enter'], label: 'Enter', does: 'Start, next turn or play again', press: ['#ready-start', '#turn-next', '#summary-again', '#setup-form button[type="submit"]'] },
], { hintIn: document.getElementById('screen-setup') });
