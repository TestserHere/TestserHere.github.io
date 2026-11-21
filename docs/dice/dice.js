/* Dice and Coins: any mix of dice, a coin, and a fair turn order. Works offline. */

(function () {
  'use strict';

  const { $, read, write, el, setupTabs } = window.V3Tools;

  const KEY = 'v3-dice';
  const KINDS = [4, 6, 8, 10, 12, 20, 100];
  const MAX_DICE = 12;
  const reduceMotion = window.matchMedia('(prefers-reduced-motion: reduce)').matches;

  // Fair random numbers: crypto when available, without the small bias of using % on a random integer.
  function roll(sides) {
    if (window.crypto && crypto.getRandomValues) {
      const limit = Math.floor(0x100000000 / sides) * sides;
      const box = new Uint32Array(1);
      do crypto.getRandomValues(box); while (box[0] >= limit);
      return (box[0] % sides) + 1;
    }
    return Math.floor(Math.random() * sides) + 1;
  }

  const saved = read(KEY, {});
  const state = {
    dice: Array.isArray(saved.dice) ? saved.dice.filter((d) => KINDS.includes(d)).slice(0, MAX_DICE) : [6, 6],
    history: Array.isArray(saved.history) ? saved.history.filter((h) => h && typeof h.text === 'string').slice(0, 20) : [],
    players: typeof saved.players === 'string' ? saved.players : '',
    heads: Number.isInteger(saved.heads) ? saved.heads : 0,
    tails: Number.isInteger(saved.tails) ? saved.tails : 0,
  };
  if (!state.dice.length && !Array.isArray(saved.dice)) state.dice = [6, 6];
  const remember = () => write(KEY, state);
  let faces = state.dice.map(() => null);
  let rolling = false;

  /* ---------- Dice ---------- */

  KINDS.forEach((sides) => {
    const button = el('button', 'die-kind', 'D' + sides);
    button.type = 'button';
    button.setAttribute('aria-label', 'Add a ' + sides + '-sided die');
    button.addEventListener('click', () => {
      if (state.dice.length >= MAX_DICE) return;
      state.dice.push(sides);
      faces.push(null);
      remember();
      renderTray();
    });
    $('kinds').appendChild(button);
  });

  function renderTray() {
    const tray = $('tray');
    tray.replaceChildren();
    state.dice.forEach((sides, i) => {
      const die = el('button', 'die die-' + (sides === 6 ? 'six' : 'n'));
      die.type = 'button';
      die.dataset.sides = sides;
      const value = faces[i];
      if (sides === 6 && value) {
        die.classList.add('pips-' + value);
        for (let p = 0; p < value; p++) die.appendChild(el('span', 'pip'));
      } else {
        die.appendChild(el('span', 'die-value', value ? String(value) : '?'));
      }
      die.appendChild(el('span', 'die-sides', 'D' + sides));
      die.setAttribute('aria-label', 'D' + sides + (value ? ' showing ' + value : '') + '. Tap to remove.');
      die.addEventListener('click', () => {
        if (rolling) return;
        state.dice.splice(i, 1);
        faces.splice(i, 1);
        remember();
        renderTray();
      });
      tray.appendChild(die);
    });
    if (!state.dice.length) tray.appendChild(el('p', 'note', 'Add some dice above.'));
    $('tray-note').hidden = !state.dice.length;
    $('roll').disabled = !state.dice.length || rolling;
    $('kinds').querySelectorAll('button').forEach((b) => { b.disabled = state.dice.length >= MAX_DICE; });
    const shown = faces.filter(Boolean);
    $('total').textContent = shown.length === state.dice.length && shown.length > 1 ? 'Total ' + shown.reduce((a, b) => a + b, 0) : '';
  }

  function describe(dice) {
    const counts = {};
    dice.forEach((d) => { counts[d] = (counts[d] || 0) + 1; });
    return Object.keys(counts).map(Number).sort((a, b) => a - b).map((d) => counts[d] + 'D' + d).join(' + ');
  }

  function rollAll() {
    if (rolling || !state.dice.length) return;
    const final = state.dice.map(roll);
    const finish = () => {
      rolling = false;
      faces = final;
      renderTray();
      const total = final.reduce((a, b) => a + b, 0);
      state.history.unshift({ text: describe(state.dice) + ': ' + final.join(', ') + (final.length > 1 ? ' = ' + total : '') });
      state.history = state.history.slice(0, 20);
      remember();
      renderHistory();
    };
    if (reduceMotion) return finish();
    rolling = true;
    let ticks = 0;
    const spin = setInterval(() => {
      faces = state.dice.map(roll);
      renderTray();
      $('tray').querySelectorAll('.die').forEach((d) => d.classList.add('is-rolling'));
      if (++ticks >= 8) {
        clearInterval(spin);
        finish();
      }
    }, 70);
  }

  function renderHistory() {
    $('history').replaceChildren(...state.history.map((h) => el('li', '', h.text)));
    $('history-group').hidden = !state.history.length;
  }

  $('roll').addEventListener('click', rollAll);
  $('clear').addEventListener('click', () => {
    state.dice = [];
    faces = [];
    remember();
    renderTray();
  });
  $('history-clear').addEventListener('click', () => {
    state.history = [];
    remember();
    renderHistory();
  });

  /* ---------- Coin ---------- */

  let flipping = false;
  let turns = 0;
  function flip() {
    if (flipping) return;
    const heads = roll(2) === 1;
    const coin = $('coin');
    flipping = true;
    turns += 4 + (heads === (turns % 2 === 0) ? 0 : 1); // whole turns, then land on the right face
    coin.style.transform = 'rotateY(' + turns * 180 + 'deg)';
    $('coin-result').textContent = 'Flipping…';
    setTimeout(() => {
      flipping = false;
      state[heads ? 'heads' : 'tails']++;
      remember();
      $('coin-result').textContent = heads ? 'Heads' : 'Tails';
      showCount();
    }, reduceMotion ? 50 : 900);
  }
  function showCount() {
    const total = state.heads + state.tails;
    $('coin-count').textContent = total ? 'Heads ' + state.heads + ' · Tails ' + state.tails : '';
  }
  $('coin').addEventListener('click', flip);
  $('flip').addEventListener('click', flip);

  /* ---------- Turn order ---------- */

  $('players').value = state.players;
  $('players').addEventListener('input', (event) => {
    state.players = event.target.value;
    remember();
  });
  $('shuffle-order').addEventListener('click', () => {
    const names = state.players.split(/\n|,/).map((n) => n.trim()).filter(Boolean);
    const list = $('order');
    if (names.length < 2) {
      list.replaceChildren(el('li', 'note', 'Add at least two names, one per line.'));
      return;
    }
    for (let i = names.length - 1; i > 0; i--) {
      const j = roll(i + 1) - 1;
      [names[i], names[j]] = [names[j], names[i]];
    }
    list.replaceChildren(...names.map((name) => el('li', '', name)));
  });

  const tabs = setupTabs('v3-dice-tab');

  window.V3Keys.add([
    { keys: ['r', ' '], label: 'Space or R', does: 'Roll, flip, or shuffle the order', press: ['#roll', '#flip', '#shuffle-order'] },
    { keys: ['c'], label: 'C', does: 'Clear the dice', press: '#clear' },
    { keys: ['4', '6', '8', '0', '2'], label: '4, 6, 8, 0, 2', does: 'Add a D4, D6, D8, D10 or D20', run: (key) => {
      const sides = { 4: 4, 6: 6, 8: 8, 0: 10, 2: 20 }[key];
      const button = Array.from(document.querySelectorAll('#kinds button')).find((b) => b.textContent === 'D' + sides);
      if (!button || button.closest('[hidden]')) return false;
      button.click();
      return true;
    } },
  ]);

  renderTray();
  renderHistory();
  showCount();
  void tabs;
})();
