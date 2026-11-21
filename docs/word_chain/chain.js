/* Word Chain: each word starts with the last letter of the word before. No repeats, and beat the clock. */

(function () {
  'use strict';

  const { $, read, write, el } = window.V3Tools;
  const Play = window.V3Play;

  const KEY = 'v3-chain';
  const plain = (s) => String(s || '').normalize('NFD').replace(/[̀-ͯ]/g, '').toLowerCase().replace(/[^a-z ]/g, ' ').replace(/\s+/g, ' ').trim();

  const LISTS = {
    animals: window.CHAIN_LISTS.animals,
    foods: window.CHAIN_LISTS.foods,
    countries: (window.COUNTRIES || []).map((c) => c.name),
  };
  // Other names people often use for countries.
  const ALIASES = { usa: 'United States', america: 'United States', us: 'United States', uk: 'United Kingdom', britain: 'United Kingdom',
    'great britain': 'United Kingdom', england: 'United Kingdom', holland: 'Netherlands', 'ivory coast': 'Ivory Coast', burma: 'Myanmar',
    czechia: 'Czech Republic', 'south korea': 'South Korea', 'north korea': 'North Korea', uae: 'United Arab Emirates' };
  const NOTES = {
    any: 'Any real word. If someone plays a word that isn’t real, press Challenge.',
    animals: LISTS.animals.length + ' animals the game knows. It checks every answer.',
    countries: LISTS.countries.length + ' countries. The game checks every answer.',
    foods: LISTS.foods.length + ' foods. The game checks every answer.',
  };

  const saved = read(KEY, {});
  const state = {
    topic: ['any', 'animals', 'countries', 'foods'].includes(saved.topic) ? saved.topic : 'animals',
    players: typeof saved.players === 'string' ? saved.players : '',
    cpu: saved.cpu !== false,
    time: [0, 10, 15, 30].includes(saved.time) ? saved.time : 15,
    lives: [1, 3, 5].includes(saved.lives) ? saved.lives : 3,
  };
  const remember = () => write(KEY, state);

  let game = null;
  let clock = 0;
  let cpuTimer = 0;

  /* The list of known answers for this topic, keyed by plain spelling. */
  function known(topic) {
    const map = new Map();
    if (topic === 'any') {
      ['animals', 'foods', 'countries'].forEach((t) => LISTS[t].forEach((w) => map.set(plain(w), w)));
    } else {
      LISTS[topic].forEach((w) => map.set(plain(w), w));
      if (topic === 'countries') Object.keys(ALIASES).forEach((a) => { if (LISTS.countries.includes(ALIASES[a])) map.set(a, ALIASES[a]); });
    }
    return map;
  }

  const lastLetter = (word) => { const p = plain(word).replace(/ /g, ''); return p[p.length - 1] || ''; };

  /* ---------- Setup ---------- */

  function showTopic() {
    $('topic-note').textContent = NOTES[state.topic];
  }

  function start() {
    const names = Play.names(state.players, 0, 10);
    if (!names.length) names.push(state.cpu ? 'You' : 'Player 1');
    const people = names.map((name) => ({ name, cpu: false, lives: state.lives }));
    if (state.cpu) people.push({ name: 'Computer', cpu: true, lives: state.lives });
    const words = known(state.topic);
    game = {
      people, turn: 0, chain: [], used: new Set(), words, letter: Play.pick('abcdefghilmnoprstw'.split('')),
      solo: people.length === 1, over: false, lastBy: -1,
    };
    $('setup').hidden = true;
    $('over').hidden = true;
    $('play').hidden = false;
    $('challenge').hidden = true;
    render();
    beginTurn();
  }

  /* ---------- Turns ---------- */

  const alive = () => game.people.filter((p) => p.lives > 0);
  const current = () => game.people[game.turn];

  function render() {
    $('people').replaceChildren(...game.people.map((p, i) => {
      const li = el('li', 'chain-person' + (i === game.turn && !game.over ? ' is-turn' : '') + (p.lives <= 0 ? ' is-out' : ''));
      li.append(el('span', '', p.name), el('span', 'chain-hearts', '♥'.repeat(Math.max(0, p.lives))));
      li.lastChild.setAttribute('aria-label', p.lives + (p.lives === 1 ? ' life' : ' lives'));
      return li;
    }));
    const chain = $('chain');
    const shown = game.chain.slice(-8);
    if (!shown.length) chain.replaceChildren(el('li', 'chain-empty', 'The chain starts here.'));
    else {
      chain.replaceChildren(...shown.map((item) => {
        const li = el('li');
        const w = item.word;
        li.append(w.slice(0, -1), el('b', '', w.slice(-1)));
        li.title = item.by;
        return li;
      }));
    }
    $('letter').textContent = game.letter.toUpperCase();
    $('challenge').hidden = state.topic !== 'any' || !game.chain.length || game.over;
  }

  function beginTurn() {
    clearInterval(clock);
    clearTimeout(cpuTimer);
    if (game.over) return;
    const p = current();
    render();
    $('who').textContent = game.solo ? 'Keep the chain going!' : p.cpu ? 'Computer’s turn…' : p.name + ', your turn';
    $('word').value = '';
    $('word').disabled = p.cpu;
    $('pass').disabled = p.cpu;
    $('message').textContent = '';
    $('message').className = 'message';
    game.left = state.time;
    showTime();
    if (state.time) clock = setInterval(tickClock, 1000);
    if (p.cpu) {
      cpuTimer = setTimeout(cpuMove, 900 + Play.int(1300));
    } else {
      $('word').focus({ preventScroll: true });
    }
  }

  function showTime() {
    $('time-left').textContent = state.time ? String(game.left) : '';
    $('time-left').classList.toggle('is-low', state.time && game.left <= 3);
  }

  function tickClock() {
    game.left--;
    if (game.left <= 3 && game.left > 0) Play.sounds.tick();
    showTime();
    if (game.left <= 0) loseLife(current().cpu ? 'The computer ran out of time!' : 'Out of time!');
  }

  function say(text, kind) {
    $('message').textContent = text;
    $('message').className = 'message' + (kind ? ' is-' + kind : '');
  }

  /* Checks a word, and plays it if it's allowed. Returns an error message, or '' if it was played. */
  function play(raw, by) {
    const p = plain(raw);
    if (!p) return 'Type a word first.';
    if (p.replace(/ /g, '')[0] !== game.letter) return 'It has to start with ' + game.letter.toUpperCase() + '.';
    if (state.topic === 'any' && (p.includes(' ') || p.length < 2)) return 'Use one word, at least 2 letters long.';
    let word = raw.trim();
    if (state.topic !== 'any') {
      if (!game.words.has(p)) return 'That’s not on the ' + state.topic + ' list. Try another.';
      word = game.words.get(p);
    }
    const key = plain(word);
    if (game.used.has(key)) return '“' + word + '” has already been used.';
    game.used.add(key);
    game.chain.push({ word, by: game.people[by].name, letter: game.letter, byIndex: by });
    game.letter = lastLetter(word);
    game.lastBy = by;
    Play.sounds.good();
    return '';
  }

  function nextPlayer() {
    if (alive().length === 0) return endGame();
    if (!game.solo && alive().length === 1) return endGame();
    let i = game.turn;
    for (let k = 0; k < game.people.length; k++) {
      i = (i + 1) % game.people.length;
      if (game.people[i].lives > 0) break;
    }
    game.turn = i;
    beginTurn();
  }

  function loseLife(text) {
    clearInterval(clock);
    clearTimeout(cpuTimer);
    const p = current();
    p.lives--;
    Play.sounds.bad();
    Play.vibrate(120);
    say(text + (p.lives > 0 ? ' ' + p.name + ' loses a life.' : ' ' + p.name + ' is out.'), 'bad');
    render();
    if (game.solo && p.lives <= 0) return endGame();
    // If nobody can think of anything for this letter, a new letter keeps things moving.
    game.misses = (game.misses || 0) + 1;
    if (game.misses >= alive().length && alive().length) {
      game.letter = Play.pick('abcdefghilmnoprstw'.split(''));
      game.misses = 0;
    }
    setTimeout(() => { if (game && !game.over) nextPlayer(); }, 1400);
    $('word').disabled = true;
    $('pass').disabled = true;
  }

  function submit(event) {
    event.preventDefault();
    if (!game || game.over || current().cpu || $('word').disabled) return;
    const error = play($('word').value, game.turn);
    if (error) {
      say(error, 'bad');
      $('word').select();
      return;
    }
    game.misses = 0;
    say('');
    nextPlayer();
  }

  function cpuMove() {
    if (!game || game.over || !current().cpu) return;
    const options = Array.from(game.words.values()).filter((w) => {
      const p = plain(w);
      return p.replace(/ /g, '')[0] === game.letter && !game.used.has(p) && (state.topic !== 'any' || !p.includes(' '));
    });
    // The computer sometimes can't think of one, especially later in the game.
    const blank = Play.random() < Math.min(0.35, 0.05 + game.chain.length * 0.01);
    if (!options.length || blank) return loseLife('The computer couldn’t think of one!');
    const word = Play.pick(options);
    play(word, game.turn);
    say('Computer: ' + word);
    game.misses = 0;
    setTimeout(() => { if (game && !game.over) nextPlayer(); }, 700);
  }

  /* Any-word mode: the last word wasn't real, so it comes off and its player loses a life. */
  function challenge() {
    if (!game || game.over || state.topic !== 'any' || !game.chain.length) return;
    const last = game.chain.pop();
    game.used.delete(plain(last.word));
    game.letter = last.letter;
    const p = game.people[last.byIndex];
    p.lives--;
    Play.sounds.bad();
    say('“' + last.word + '” is out. ' + p.name + (p.lives > 0 ? ' loses a life.' : ' is out of the game.'), 'bad');
    render();
    if (!game.solo && alive().length <= 1) return endGame();
    if (game.solo && p.lives <= 0) return endGame();
  }

  function endGame() {
    clearInterval(clock);
    clearTimeout(cpuTimer);
    game.over = true;
    render();
    $('play').hidden = false;
    $('word').disabled = true;
    $('pass').disabled = true;
    $('over').hidden = false;
    const n = game.chain.length;
    if (game.solo) {
      $('over-title').textContent = 'Chain of ' + n;
      const best = Math.max(Number(read(KEY + '-best', 0)) || 0, n);
      write(KEY + '-best', best);
      $('over-text').textContent = n === best ? 'Your longest chain yet!' : 'Your longest is ' + best + '.';
    } else {
      const winner = alive()[0];
      $('over-title').textContent = winner ? (winner.cpu ? 'The computer wins!' : winner.name + ' wins!') : 'Game over';
      $('over-text').textContent = 'The chain was ' + n + (n === 1 ? ' word' : ' words') + ' long.';
      if (winner && !winner.cpu) Play.sounds.win(); else Play.sounds.end();
    }
    $('again').focus({ preventScroll: true });
  }

  $('form').addEventListener('submit', submit);
  $('pass').addEventListener('click', () => { if (game && !game.over && !current().cpu) loseLife('Passed.'); });
  $('challenge').addEventListener('click', challenge);
  $('start').addEventListener('click', start);
  $('again').addEventListener('click', start);
  $('change').addEventListener('click', () => {
    clearInterval(clock);
    clearTimeout(cpuTimer);
    game = null;
    $('over').hidden = true;
    $('play').hidden = true;
    $('setup').hidden = false;
  });

  Play.segmented($('topic'), state.topic, (v) => { state.topic = v; remember(); showTopic(); });
  Play.segmented($('time'), state.time, (v) => { state.time = Number(v); remember(); });
  Play.segmented($('lives'), state.lives, (v) => { state.lives = Number(v); remember(); });
  $('players').value = state.players;
  $('players').addEventListener('input', () => { state.players = $('players').value; remember(); });
  $('cpu').checked = state.cpu;
  $('cpu').addEventListener('change', () => { state.cpu = $('cpu').checked; remember(); });
  showTopic();

  window.V3Keys.add([
    { keys: ['/'], label: '/', does: 'Type your word', focus: '#word' },
    { keys: ['Enter'], label: 'Enter', does: 'Start or play again', press: ['#start', '#again'] },
    { keys: ['c'], label: 'C', does: 'Challenge the last word (Any word mode)', press: '#challenge' },
    { keys: ['g'], label: 'G', does: 'Give up this turn', press: '#pass' },
    { keys: ['1', '2', '3', '4'], label: '1 to 4', does: 'Setup: Any word, Animals, Countries, Foods', run: (key) => {
      if ($('setup').hidden) return false;
      $('topic').children[Number(key) - 1].click();
      return true;
    } },
  ]);
  window.V3Keys.howTo({
    id: 'chain',
    title: 'Word Chain',
    steps: [
      'Pick the kind of words: any word, or a category (animals, countries or foods) that the game checks for you.',
      'Add players (one per line), or play on your own against the computer.',
      'On your turn, type a word that starts with the letter shown, which is the last letter of the word before.',
      'No word can be used twice. Run out of time, or give up, and you lose a life.',
      'Any word mode: if someone plays a word that isn’t real, press Challenge. That word comes off and its player loses a life.',
      'The last player with lives left wins. On your own, try to make the longest chain.',
    ],
    tip: 'Playing out loud? Turn the timer off and use the game as the scorekeeper.',
  });
})();
