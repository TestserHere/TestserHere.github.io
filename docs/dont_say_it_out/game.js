(function () {
  'use strict';

  const $ = (id) => document.getElementById(id);

  const MIN_TEAMS = 1;
  const MAX_TEAMS = 4;
  const MIN_ROUNDS = 1;
  const MAX_ROUNDS = 10;
  const LENGTHS = [30, 60, 90, 120];
  const POINTS = { correct: 1, pass: 0, forbidden: -1 };
  const RESULT_NAMES = { correct: 'Correct', pass: 'Passed', forbidden: 'Forbidden' };
  const LOW_TIME = 10;

  const PACKS = {
    en: { label: 'English', lang: 'en', cards: WORD_CARDS },
    zh: { label: '中文', lang: 'zh-CN', cards: CHINESE_WORD_CARDS },
  };

  const setup = { teams: 2, names: [], seconds: 60, rounds: 3, pack: 'en' };
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
    const box = $('length-options');
    box.replaceChildren();
    LENGTHS.forEach((seconds) => {
      const button = el('button', '', seconds + 's');
      button.type = 'button';
      button.setAttribute('aria-pressed', String(seconds === setup.seconds));
      button.addEventListener('click', () => {
        setup.seconds = seconds;
        renderLengths();
      });
      box.appendChild(button);
    });
  }

  function renderPacks() {
    const box = $('pack-options');
    box.replaceChildren();
    Object.keys(PACKS).forEach((key) => {
      const button = el('button', '', PACKS[key].label);
      button.type = 'button';
      button.setAttribute('aria-pressed', String(key === setup.pack));
      button.addEventListener('click', () => {
        setup.pack = key;
        renderPacks();
      });
      box.appendChild(button);
    });
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
      rounds: setup.rounds,
      round: 1,
      teamIndex: 0,
      cards: pack.cards,
      deck: shuffled(pack.cards),
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

  function drawCard() {
    if (!game.deck.length) game.deck = shuffled(game.cards);
    return game.deck.pop();
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
    nextCard();
    show('screen-play');
    tick();
    turn.timer = setInterval(tick, 100);
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
  $('summary-new').addEventListener('click', () => show('screen-setup'));

  // The home page shows its own Done button when the game opens inside it.
  $('back-home').hidden = window.top !== window.self;

  renderTeamNames();
  renderRounds();
  renderLengths();
  renderPacks();
})();
