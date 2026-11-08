/* Perfect Second: stop a hidden clock exactly on target */

(function () {
  'use strict';

  const { $, read, write, el } = window.V3Tools;

  const BEST_KEY = 'v3-perfect-second-best';
  const LIVES = 3;
  const FIRST_TARGET = 10;
  const VISIBLE_MS = 1000;
  const START_GUARD_MS = 250; // ignores an accidental double tap
  const NEXT_GUARD_MS = 450;
  const PERFECT_WITHIN = 0.01;
  const PERFECT_BONUS = 100;

  const game = { round: 1, score: 0, lives: LIVES, target: FIRST_TARGET, state: 'ready', startedAt: 0, shownAt: 0, log: [] };
  let frame = 0;

  const tolerance = (round) => Math.max(0.06, 0.5 * 0.82 ** (round - 1));
  const seconds = (value) => value.toFixed(2);

  function chooseTarget(round) {
    if (round === 1) return FIRST_TARGET;
    const step = round <= 5 ? 0.25 : 0.05; // later targets are harder to count
    const options = Math.round(10 / step);
    return 2 + Math.floor(Math.random() * (options + 1)) * step;
  }

  function setPad(state, main, sub) {
    game.state = state;
    game.shownAt = performance.now();
    $('pad').className = 'pad is-' + state;
    $('pad-main').textContent = main;
    $('pad-sub').textContent = sub;
  }

  function renderInfo() {
    $('round').textContent = 'Round ' + game.round;
    $('score').textContent = game.score + (game.score === 1 ? ' point' : ' points');
    $('lives').setAttribute('aria-label', game.lives + ' of ' + LIVES + ' lives left');
    $('lives').replaceChildren(...Array.from({ length: LIVES }, (_, i) => el('span', i < game.lives ? 'life' : 'life is-lost')));
  }

  function showReady() {
    setPad('ready', seconds(game.target), 'seconds. Within ' + seconds(tolerance(game.round)) + ' counts. Tap to start.');
    renderInfo();
  }

  function startRun(now) {
    game.startedAt = now;
    setPad('running', '0.00', 'Tap when you reach ' + seconds(game.target));
    const update = () => {
      if (game.state !== 'running') return;
      const elapsed = performance.now() - game.startedAt;
      if (elapsed >= (game.target * 2 + 5) * 1000) {
        stopRun(performance.now());
        return;
      }
      $('pad-main').textContent = elapsed < VISIBLE_MS ? seconds(elapsed / 1000) : '? ? ?';
      frame = requestAnimationFrame(update);
    };
    frame = requestAnimationFrame(update);
  }

  function stopRun(now) {
    cancelAnimationFrame(frame);
    const stopped = Math.max(0, (now - game.startedAt) / 1000);
    const difference = stopped - game.target;
    const miss = Math.abs(difference);
    const allowed = tolerance(game.round);
    const hit = miss <= allowed;
    const perfect = miss <= PERFECT_WITHIN;
    const signed = (difference >= 0 ? '+' : '−') + seconds(miss);

    const points = hit ? 50 + Math.round(50 * (1 - miss / allowed)) + (perfect ? PERFECT_BONUS : 0) : 0;
    game.score += points;
    if (!hit) game.lives -= 1;
    game.log.push({ round: game.round, target: game.target, stopped, hit });

    let sub;
    if (perfect) sub = 'Perfect! +' + points + ' points. Tap to continue.';
    else if (hit) sub = 'You stopped at ' + seconds(stopped) + '. +' + points + ' points. Tap to continue.';
    else if (game.lives > 0) sub = 'You stopped at ' + seconds(stopped) + ' and lost a life. Tap to continue.';
    else sub = 'You stopped at ' + seconds(stopped) + '. That was your last life. Tap to finish.';
    setPad(hit ? 'hit' : 'miss', signed, sub);
    renderInfo();
  }

  function showGameOver() {
    const best = Number(read(BEST_KEY, 0)) || 0;
    const isBest = game.score > best;
    if (isBest) write(BEST_KEY, game.score);
    $('final-score').textContent = game.score;
    $('final-best').textContent = isBest ? 'A new best!' : 'Your best is ' + best + '.';
    $('round-table').replaceChildren(...game.log.map((entry) => {
      const row = el('li', entry.hit ? '' : 'is-miss');
      row.append(el('span', '', 'Round ' + entry.round), el('span', '', seconds(entry.target)), el('span', '', seconds(entry.stopped)));
      return row;
    }));
    $('play').hidden = true;
    $('over').hidden = false;
  }

  function nextStep() {
    if (game.lives === 0) {
      showGameOver();
      return;
    }
    game.round += 1;
    game.target = chooseTarget(game.round);
    showReady();
  }

  /* The time of the press itself is used, so a slow screen update can't cost the player. */
  function press(now) {
    const sinceShown = now - game.shownAt;
    if (game.state === 'ready') startRun(now);
    else if (game.state === 'running' && sinceShown >= START_GUARD_MS) stopRun(now);
    else if ((game.state === 'hit' || game.state === 'miss') && sinceShown >= NEXT_GUARD_MS) nextStep();
  }

  $('pad').addEventListener('pointerdown', (event) => {
    if (event.button) return;
    event.preventDefault();
    press(event.timeStamp);
  });

  // Screen readers and voice control activate the button with a click that has no pointer press.
  $('pad').addEventListener('click', (event) => {
    if (event.detail === 0) press(performance.now());
  });

  document.addEventListener('keydown', (event) => {
    if ((event.key !== ' ' && event.key !== 'Enter') || event.repeat || $('play').hidden) return;
    event.preventDefault();
    press(event.timeStamp);
  });

  // Leaving the page mid-run would make the round unfair, so it restarts without penalty.
  document.addEventListener('visibilitychange', () => {
    if (document.hidden && game.state === 'running') {
      cancelAnimationFrame(frame);
      showReady();
    }
  });

  function newGame() {
    Object.assign(game, { round: 1, score: 0, lives: LIVES, target: FIRST_TARGET, log: [] });
    $('over').hidden = true;
    $('play').hidden = false;
    showReady();
  }

  $('again').addEventListener('click', newGame);
  newGame();
})();
