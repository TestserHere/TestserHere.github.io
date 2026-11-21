/* Truth or Dare: pick sets of cards, add players, and take turns. Cards don't repeat until a set runs out. */

(function () {
  'use strict';

  const { $, read, write, el } = window.V3Tools;
  const Play = window.V3Play;
  const SETS = window.TOD_SETS;

  const KEY = 'v3-tod';
  const SEEN_KEY = 'v3-tod-seen';
  const saved = read(KEY, {});
  const state = {
    sets: Array.isArray(saved.sets) && saved.sets.some((s) => SETS[s]) ? saved.sets.filter((s) => SETS[s]) : ['family'],
    players: typeof saved.players === 'string' ? saved.players : '',
    ownTruths: typeof saved.ownTruths === 'string' ? saved.ownTruths : '',
    ownDares: typeof saved.ownDares === 'string' ? saved.ownDares : '',
    turn: Number(saved.turn) || 0,
    scores: saved.scores && typeof saved.scores === 'object' ? saved.scores : {}, // name -> [done, skipped]
  };
  const remember = () => write(KEY, state);
  let seen = new Set(read(SEEN_KEY, []));
  const rememberSeen = () => write(SEEN_KEY, Array.from(seen).slice(-1500));

  let current = null; // { kind, text, set }

  const lines = (text) => String(text || '').split('\n').map((s) => s.trim()).filter(Boolean);
  const players = () => lines(state.players).slice(0, 20);

  /* Every card from the chosen sets, plus your own. */
  function deck(kind) {
    const cards = [];
    state.sets.forEach((id) => (kind === 'truth' ? SETS[id].truths : SETS[id].dares).forEach((text) => cards.push({ kind, text, set: SETS[id].name })));
    lines(kind === 'truth' ? state.ownTruths : state.ownDares).forEach((text) => cards.push({ kind, text, set: 'Your own' }));
    return cards;
  }

  function draw(kind) {
    const all = deck(kind);
    if (!all.length) return { kind, text: kind === 'truth' ? 'There are no truths in these sets. Add your own in Set up.' : 'There are no dares in these sets. Add your own in Set up.', set: '' };
    let fresh = all.filter((c) => !seen.has(c.kind + '|' + c.text));
    if (!fresh.length) {
      // Played them all: start these cards again.
      all.forEach((c) => seen.delete(c.kind + '|' + c.text));
      fresh = all;
    }
    const card = Play.pick(fresh);
    seen.add(card.kind + '|' + card.text);
    rememberSeen();
    return card;
  }

  /* ---------- Set up ---------- */

  function showSets() {
    $('sets').replaceChildren(...Object.keys(SETS).map((id) => {
      const chip = el('button', 'tod-set-chip');
      chip.type = 'button';
      chip.append(el('strong', '', SETS[id].name), el('span', '', SETS[id].note));
      chip.setAttribute('aria-pressed', String(state.sets.includes(id)));
      chip.addEventListener('click', () => {
        if (state.sets.includes(id)) {
          if (state.sets.length > 1 || lines(state.ownTruths).length || lines(state.ownDares).length) state.sets = state.sets.filter((s) => s !== id);
        } else {
          state.sets.push(id);
        }
        remember();
        showSets();
      });
      return chip;
    }));
    const t = deck('truth').length;
    const d = deck('dare').length;
    $('deck-note').textContent = t + ' truths and ' + d + ' dares. Cards won’t repeat until you’ve seen them all.';
  }

  $('players').value = state.players;
  $('own-truths').value = state.ownTruths;
  $('own-dares').value = state.ownDares;
  $('players').addEventListener('input', () => { state.players = $('players').value; remember(); showTurn(); showScores(); });
  $('own-truths').addEventListener('input', () => { state.ownTruths = $('own-truths').value; remember(); showSets(); });
  $('own-dares').addEventListener('input', () => { state.ownDares = $('own-dares').value; remember(); showSets(); });

  /* ---------- Turns ---------- */

  function who() {
    const list = players();
    return list.length ? list[state.turn % list.length] : '';
  }

  function showTurn() {
    const name = who();
    if (current) {
      $('turn').textContent = name ? name + (current.kind === 'truth' ? ', tell the truth:' : ', your dare:') : current.kind === 'truth' ? 'Truth:' : 'Dare:';
    } else {
      $('turn').textContent = name ? name + ', truth or dare?' : 'Truth or dare?';
    }
  }

  function showScores() {
    const list = players();
    $('scores-group').hidden = !list.length;
    const name = who();
    $('scores').replaceChildren(...list.map((p) => {
      const s = state.scores[p] || [0, 0];
      const li = el('li', p === name ? 'is-turn' : '');
      li.append(el('span', '', p), el('strong', '', s[0] + ' / ' + s[1]));
      return li;
    }));
  }

  function choose(kind) {
    if (current) return;
    if (kind === 'random') kind = Play.random() < 0.5 ? 'truth' : 'dare';
    current = draw(kind);
    $('setup').open = false;
    $('card').hidden = false;
    $('card').classList.toggle('is-dare', kind === 'dare');
    // Restart the pop animation.
    $('card').style.animation = 'none';
    void $('card').offsetWidth;
    $('card').style.animation = '';
    $('kind').textContent = kind === 'truth' ? 'Truth' : 'Dare';
    $('prompt').textContent = current.text;
    $('set-name').textContent = current.set;
    $('choose').hidden = true;
    $('random').hidden = true;
    $('after').hidden = false;
    Play.sounds.tick();
    showTurn();
    $('done').focus({ preventScroll: true });
  }

  function next(didIt) {
    if (!current) return;
    const name = who();
    if (name) {
      const s = state.scores[name] || (state.scores[name] = [0, 0]);
      s[didIt ? 0 : 1]++;
    }
    if (didIt) Play.sounds.good();
    current = null;
    state.turn = (state.turn + 1) % Math.max(1, players().length);
    remember();
    $('card').hidden = true;
    $('choose').hidden = false;
    $('random').hidden = false;
    $('after').hidden = true;
    showTurn();
    showScores();
  }

  $('truth').addEventListener('click', () => choose('truth'));
  $('dare').addEventListener('click', () => choose('dare'));
  $('random').addEventListener('click', () => choose('random'));
  $('done').addEventListener('click', () => next(true));
  $('skip').addEventListener('click', () => next(false));
  $('reset-scores').addEventListener('click', () => { state.scores = {}; state.turn = 0; remember(); showScores(); showTurn(); });

  if (players().length) $('setup').open = false;
  showSets();
  showTurn();
  showScores();

  window.V3Keys.add([
    { keys: ['t'], label: 'T', does: 'Truth', press: '#truth' },
    { keys: ['d'], label: 'D', does: 'Dare', press: '#dare' },
    { keys: ['r'], label: 'R', does: 'Random (truth or dare)', press: '#random' },
    { keys: ['Enter', ' '], label: 'Enter or Space', does: 'Done, next player', press: '#done' },
    { keys: ['s'], label: 'S', does: 'Skip this card', press: '#skip' },
  ]);
  window.V3Keys.howTo({
    id: 'tod',
    title: 'Truth or Dare',
    steps: [
      'Pick one or more card sets: Family (all ages), Friends (teens and up), Party (cheekier, for older teens and adults) or Icebreaker (classrooms and new groups).',
      'Type the players’ names, one per line, if you’d like the game to keep track of turns. You can skip this.',
      'On your turn, choose Truth (answer a question honestly) or Dare (do a challenge). Random lets the game choose.',
      'Did it? Press Done. Too much? Press Skip. Either way it’s the next player’s turn.',
      'You can add your own truths and dares in Set up. They’re saved on this device.',
    ],
    tip: 'Everyone can skip a card. Nobody should be pushed to do something they’re not comfortable with.',
  });
})();
