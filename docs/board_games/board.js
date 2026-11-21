/* Board Games: Tic-tac-toe, Four in a Row and Dots and Boxes, against a friend or the computer. */

(function () {
  'use strict';

  const { $, read, write, el, setupTabs } = window.V3Tools;
  const Play = window.V3Play;

  const KEY = 'v3-board';
  const saved = read(KEY, {});
  const state = {
    tab: 'ttt',
    vs: saved.vs === 'friend' ? 'friend' : 'cpu',
    level: saved.level === 'easy' ? 'easy' : 'hard',
    size: [3, 4, 5].includes(saved.size) ? saved.size : 4,
    ttt: saved.ttt === 'big' ? 'big' : 'classic',
    scores: Object.assign({ ttt: [0, 0, 0], big: [0, 0, 0], four: [0, 0, 0], dots: [0, 0, 0] }, saved.scores || {}),
  };
  const remember = () => write(KEY, { vs: state.vs, level: state.level, size: state.size, ttt: state.ttt, scores: state.scores });
  // The game being played: the tab, or Big Tic-tac-toe inside the Tic-tac-toe tab.
  const current = () => (state.tab === 'ttt' && state.ttt === 'big' ? 'big' : state.tab);

  const GAMES = {};
  let game = null; // the game being played on the current tab
  let starter = 1; // who goes first, swapping each game
  let thinking = 0;

  const names = () => (state.vs === 'cpu' ? ['You', 'Computer'] : ['Blue', 'Orange']);
  const isCpu = (player) => state.vs === 'cpu' && player === 2;

  function showScores() {
    const [a, b] = names();
    const s = state.scores[current()];
    $('name-1').textContent = a;
    $('name-2').textContent = b;
    $('score-1').textContent = s[0];
    $('score-2').textContent = s[1];
    $('score-draw').textContent = s[2];
    $('draw-label').textContent = 'Draws';
  }

  function showTurn(text) {
    const n = names();
    if (text) $('turn').textContent = text;
    else if (game && !game.over) $('turn').textContent = state.vs === 'cpu' ? (game.player === 1 ? 'Your turn' : 'Computer is thinking…') : n[game.player - 1] + '’s turn';
    $('side-1').classList.toggle('is-turn', !!game && !game.over && game.player === 1);
    $('side-2').classList.toggle('is-turn', !!game && !game.over && game.player === 2);
  }

  function finish(winner) {
    game.over = true;
    const s = state.scores[current()];
    if (winner) s[winner - 1]++;
    else s[2]++;
    remember();
    showScores();
    const n = names();
    if (!winner) showTurn('It’s a draw!');
    else if (state.vs === 'cpu') showTurn(winner === 1 ? 'You win!' : 'The computer wins.');
    else showTurn(n[winner - 1] + ' wins!');
    if (winner && !isCpu(winner)) Play.sounds.win();
    else if (winner) Play.sounds.bad();
    Play.vibrate(winner ? [60, 40, 60] : 40);
    $('new').focus({ preventScroll: true });
  }

  /* After every move: either the game ended, or it's the next player's turn (maybe the computer's). */
  function afterMove() {
    if (game.over) return;
    showTurn();
    if (isCpu(game.player)) {
      const mine = ++thinking;
      setTimeout(() => {
        if (mine !== thinking || !game || game.over || !isCpu(game.player)) return;
        GAMES[current()].cpu();
      }, 450 + Play.int(300));
    }
  }

  const humanTurn = () => game && !game.over && !isCpu(game.player);

  /* ---------- Tic-tac-toe ---------- */

  const LINES3 = [[0, 1, 2], [3, 4, 5], [6, 7, 8], [0, 3, 6], [1, 4, 7], [2, 5, 8], [0, 4, 8], [2, 4, 6]];
  const winner3 = (b) => {
    for (const line of LINES3) if (b[line[0]] && b[line[0]] === b[line[1]] && b[line[0]] === b[line[2]]) return { who: b[line[0]], line };
    return null;
  };

  GAMES.ttt = {
    start() {
      game = { board: Array(9).fill(0), player: starter, over: false };
      const box = $('ttt');
      box.replaceChildren(...game.board.map((_, i) => {
        const cell = el('button', 'ttt-cell');
        cell.type = 'button';
        cell.append(el('span', 'cell-num', String(i + 1)), el('span', 'cell-mark', ''));
        cell.addEventListener('click', () => { if (humanTurn()) this.move(i); });
        return cell;
      }));
      this.render();
    },
    render(winLine) {
      Array.from($('ttt').children).forEach((cell, i) => {
        const v = game.board[i];
        cell.lastChild.textContent = v === 1 ? 'X' : v === 2 ? 'O' : '';
        cell.className = 'ttt-cell' + (v === 1 ? ' is-x' : v === 2 ? ' is-o' : '') + (winLine && winLine.includes(i) ? ' is-win' : '');
        cell.disabled = !!v || game.over;
        cell.setAttribute('aria-label', 'Row ' + (Math.floor(i / 3) + 1) + ', column ' + ((i % 3) + 1) + ': ' + (v === 1 ? 'X' : v === 2 ? 'O' : 'empty'));
      });
    },
    move(i) {
      if (game.over || game.board[i]) return;
      game.board[i] = game.player;
      Play.sounds.tick();
      const win = winner3(game.board);
      if (win) { game.over = true; this.render(win.line); game.over = false; return finish(win.who); }
      if (game.board.every(Boolean)) { game.over = true; this.render(); game.over = false; return finish(0); }
      game.player = 3 - game.player;
      this.render();
      afterMove();
    },
    cpu() {
      const b = game.board;
      const free = b.map((v, i) => (v ? -1 : i)).filter((i) => i >= 0);
      const tryWin = (who) => free.find((i) => { b[i] = who; const w = winner3(b); b[i] = 0; return !!w; });
      let choice;
      if (state.level === 'easy') {
        // Wins when it sees it, blocks sometimes, otherwise plays anywhere.
        choice = tryWin(2);
        if (choice === undefined && Play.random() < 0.5) choice = tryWin(1);
        if (choice === undefined) choice = Play.pick(free);
      } else {
        let best = -Infinity;
        const options = [];
        free.forEach((i) => {
          b[i] = 2;
          const score = -negamax(b, 1, 1);
          b[i] = 0;
          if (score > best) { best = score; options.length = 0; }
          if (score === best) options.push(i);
        });
        choice = Play.pick(options);
      }
      this.move(choice);
    },
  };

  function negamax(b, who, depth) {
    const w = winner3(b);
    if (w) return w.who === who ? 10 - depth : depth - 10;
    if (b.every(Boolean)) return 0;
    let best = -Infinity;
    for (let i = 0; i < 9; i++) {
      if (b[i]) continue;
      b[i] = who;
      best = Math.max(best, -negamax(b, 3 - who, depth + 1));
      b[i] = 0;
    }
    return best;
  }

  /* ---------- Big Tic-tac-toe: nine small boards make one big board ---------- */

  const POS = ['top-left', 'top', 'top-right', 'left', 'middle', 'right', 'bottom-left', 'bottom', 'bottom-right'];
  // Boards that ended in a draw (3) belong to nobody on the big board.
  const bigWinner = (boards) => winner3(boards.map((v) => (v === 3 ? 0 : v)));

  // A plain copy of the position, used by the computer to try moves.
  const simCopy = (s) => ({ cells: s.cells.slice(), boards: s.boards.slice(), next: s.next, player: s.player, result: s.result });
  function simMoves(s) {
    const out = [];
    for (let b = 0; b < 9; b++) {
      if (s.boards[b] || (s.next >= 0 && s.next !== b)) continue;
      for (let c = 0; c < 9; c++) if (!s.cells[b * 9 + c]) out.push(b * 9 + c);
    }
    return out;
  }
  // Plays a move on a position. result: 0 still playing, 1 or 2 a winner, 3 a draw.
  function simPlay(s, m) {
    const b = Math.floor(m / 9);
    const c = m % 9;
    s.cells[m] = s.player;
    const small = s.cells.slice(b * 9, b * 9 + 9);
    const w = winner3(small);
    if (w) s.boards[b] = w.who;
    else if (small.every(Boolean)) s.boards[b] = 3;
    const big = bigWinner(s.boards);
    if (big) s.result = big.who;
    else if (s.boards.every(Boolean)) s.result = 3;
    s.next = s.boards[c] ? -1 : c;
    s.player = 3 - s.player;
    return s;
  }
  // Would this move win the small board it's played in?
  const winsSmall = (s, m, who) => {
    const b = Math.floor(m / 9);
    const small = s.cells.slice(b * 9, b * 9 + 9);
    small[m % 9] = who;
    const w = winner3(small);
    return !!w && w.who === who;
  };
  // A quick game to the end, with sensible moves: win a board when possible, block otherwise, else random.
  function playout(s) {
    for (let guard = 0; guard < 81 && !s.result; guard++) {
      const moves = simMoves(s);
      if (!moves.length) { s.result = 3; break; }
      let m = moves.find((x) => winsSmall(s, x, s.player));
      if (m === undefined && Play.random() < 0.5) m = moves.find((x) => winsSmall(s, x, 3 - s.player));
      if (m === undefined) m = moves[Math.floor(Math.random() * moves.length)];
      simPlay(s, m);
    }
    return s.result;
  }

  // Hard: Monte Carlo tree search for about 0.7 seconds.
  function searchBig(root, ms) {
    const node = (move, parent, s) => ({ move, parent, kids: [], untried: s.result ? [] : simMoves(s), wins: 0, visits: 0, who: 3 - s.player });
    const top = node(-1, null, root);
    const end = performance.now() + ms;
    let runs = 0;
    while (runs < 200 || performance.now() < end) {
      if (++runs > 60000) break;
      let n = top;
      const s = simCopy(root);
      while (!n.untried.length && n.kids.length) {
        const logN = Math.log(n.visits);
        let best = null;
        let bestScore = -Infinity;
        for (const k of n.kids) {
          const score = k.wins / k.visits + 1.2 * Math.sqrt(logN / k.visits);
          if (score > bestScore) { bestScore = score; best = k; }
        }
        n = best;
        simPlay(s, n.move);
      }
      if (n.untried.length) {
        const m = n.untried.splice(Math.floor(Math.random() * n.untried.length), 1)[0];
        simPlay(s, m);
        const kid = node(m, n, s);
        n.kids.push(kid);
        n = kid;
      }
      const result = playout(s);
      for (let k = n; k; k = k.parent) {
        k.visits++;
        if (result === k.who) k.wins += 1;
        else if (result === 3) k.wins += 0.5;
      }
    }
    let best = top.kids[0];
    for (const k of top.kids) if (k.visits > best.visits) best = k;
    return best.move;
  }

  GAMES.big = {
    start() {
      game = { cells: Array(81).fill(0), boards: Array(9).fill(0), next: -1, player: starter, over: false, result: 0, last: -1, pick: -1 };
      const box = $('big');
      box.replaceChildren(...POS.map((name, b) => {
        const board = el('div', 'big-board');
        board.setAttribute('role', 'group');
        board.setAttribute('aria-label', name + ' board');
        for (let c = 0; c < 9; c++) {
          const cell = el('button', 'big-cell');
          cell.type = 'button';
          cell.addEventListener('click', () => { if (humanTurn()) this.move(b * 9 + c); });
          board.appendChild(cell);
        }
        board.appendChild(el('span', 'big-owner'));
        return board;
      }));
      this.render();
    },
    playable(b) { return !game.over && !game.boards[b] && (game.next < 0 || game.next === b); },
    render(winLine) {
      const mark = (v) => (v === 1 ? 'X' : v === 2 ? 'O' : '');
      Array.from($('big').children).forEach((board, b) => {
        const owner = game.boards[b];
        const open = this.playable(b);
        board.className = 'big-board' + (open ? ' is-open is-p' + game.player : '') + (owner === 1 ? ' is-x' : owner === 2 ? ' is-o' : owner === 3 ? ' is-full' : '')
          + (winLine && winLine.includes(b) ? ' is-win' : '') + (game.pick === b ? ' is-picked' : '');
        board.lastChild.textContent = owner === 3 ? '' : mark(owner);
        for (let c = 0; c < 9; c++) {
          const cell = board.children[c];
          const v = game.cells[b * 9 + c];
          cell.textContent = mark(v);
          cell.className = 'big-cell' + (v === 1 ? ' is-x' : v === 2 ? ' is-o' : '') + (b * 9 + c === game.last ? ' is-last' : '');
          cell.disabled = !!v || !open;
          cell.setAttribute('aria-label', POS[b] + ' board, square ' + (c + 1) + ': ' + (v ? mark(v) : 'empty'));
        }
      });
      let where;
      if (game.over) where = '';
      else if (game.pick >= 0) where = 'Board ' + (game.pick + 1) + ' picked. Now press 1 to 9 for the square.';
      else if (game.next < 0) where = 'Play in any open board.';
      else where = 'Play in the ' + POS[game.next] + ' board.';
      $('big-note').textContent = where;
    },
    move(m) {
      const b = Math.floor(m / 9);
      if (game.over || game.cells[m] || !this.playable(b)) return;
      simPlay(game, m);
      game.last = m;
      game.pick = -1;
      Play.sounds.tick();
      if (game.boards[b] === 1 || game.boards[b] === 2) Play.sounds.good();
      if (game.result) {
        const w = bigWinner(game.boards);
        game.over = true; this.render(w && w.line); game.over = false;
        return finish(game.result === 3 ? 0 : game.result);
      }
      this.render();
      afterMove();
    },
    cpu() {
      const moves = simMoves(game);
      let choice;
      if (state.level === 'easy') {
        // Takes a small board when it can, otherwise plays anywhere.
        choice = moves.find((m) => winsSmall(game, m, 2));
        if (choice === undefined) choice = Play.pick(moves);
      } else {
        // An instant win on the big board first, then a proper search.
        choice = moves.find((m) => simPlay(simCopy(game), m).result === 2);
        if (choice === undefined) choice = searchBig(simCopy(game), 700);
      }
      this.move(choice);
    },
    // Keyboard: 1 to 9 is the square, or first the board when you may play anywhere.
    key(k) {
      const i = k - 1;
      if (game.next >= 0) { this.move(game.next * 9 + i); return true; }
      if (game.pick < 0) {
        if (!this.playable(i)) return false;
        game.pick = i;
        this.render();
        return true;
      }
      const m = game.pick * 9 + i;
      if (game.cells[m]) return false;
      this.move(m);
      return true;
    },
  };

  /* ---------- Four in a Row ---------- */

  const COLS = 7;
  const ROWS = 6;

  function fourWin(b, who) {
    const at = (r, c) => (r >= 0 && r < ROWS && c >= 0 && c < COLS ? b[r * COLS + c] : 0);
    for (let r = 0; r < ROWS; r++) {
      for (let c = 0; c < COLS; c++) {
        if (b[r * COLS + c] !== who) continue;
        for (const [dr, dc] of [[0, 1], [1, 0], [1, 1], [1, -1]]) {
          if (at(r + dr, c + dc) === who && at(r + 2 * dr, c + 2 * dc) === who && at(r + 3 * dr, c + 3 * dc) === who) {
            return [0, 1, 2, 3].map((k) => (r + k * dr) * COLS + c + k * dc);
          }
        }
      }
    }
    return null;
  }

  // Row 0 is the top. Returns the row a disc would land in, or -1 if the column is full.
  const landing = (b, c) => { for (let r = ROWS - 1; r >= 0; r--) if (!b[r * COLS + c]) return r; return -1; };

  /* How good the board looks for one player, counting lines of four that are still open. */
  function fourScore(b, who) {
    let score = 0;
    const other = 3 - who;
    for (let c = 0; c < COLS; c++) for (let r = 0; r < ROWS; r++) if (c === 3 && b[r * COLS + c] === who) score += 3;
    for (let r = 0; r < ROWS; r++) {
      for (let c = 0; c < COLS; c++) {
        for (const [dr, dc] of [[0, 1], [1, 0], [1, 1], [1, -1]]) {
          const er = r + 3 * dr;
          const ec = c + 3 * dc;
          if (er < 0 || er >= ROWS || ec < 0 || ec >= COLS) continue;
          let mine = 0;
          let theirs = 0;
          for (let k = 0; k < 4; k++) {
            const v = b[(r + k * dr) * COLS + c + k * dc];
            if (v === who) mine++; else if (v === other) theirs++;
          }
          if (theirs === 0) score += [0, 1, 5, 50][mine] || 0;
          if (mine === 0) score -= [0, 1, 6, 80][theirs] || 0;
        }
      }
    }
    return score;
  }

  const ORDER = [3, 2, 4, 1, 5, 0, 6];
  function fourSearch(b, who, depth, alpha, beta) {
    const moves = ORDER.filter((c) => landing(b, c) >= 0);
    if (!moves.length) return 0;
    if (depth === 0) return fourScore(b, who);
    let best = -Infinity;
    for (const c of moves) {
      const i = landing(b, c) * COLS + c;
      b[i] = who;
      const score = fourWin(b, who) ? 100000 + depth : -fourSearch(b, 3 - who, depth - 1, -beta, -alpha);
      b[i] = 0;
      if (score > best) best = score;
      if (best > alpha) alpha = best;
      if (alpha >= beta) break;
    }
    return best;
  }

  GAMES.four = {
    start() {
      game = { board: Array(ROWS * COLS).fill(0), player: starter, over: false, last: -1 };
      const box = $('four');
      box.replaceChildren(...Array.from({ length: COLS }, (_, c) => {
        const col = el('button', 'four-col');
        col.type = 'button';
        col.append(el('span', 'four-num', String(c + 1)));
        for (let r = 0; r < ROWS; r++) col.append(el('span', 'four-slot'));
        col.addEventListener('click', () => { if (humanTurn()) this.move(c); });
        return col;
      }));
      this.render();
    },
    render(winCells) {
      Array.from($('four').children).forEach((col, c) => {
        const slots = col.querySelectorAll('.four-slot');
        for (let r = 0; r < ROWS; r++) {
          const i = r * COLS + c;
          const v = game.board[i];
          slots[r].className = 'four-slot' + (v ? ' is-' + v : '') + (i === game.last ? ' is-new' : '') + (winCells && winCells.includes(i) ? ' is-win' : '');
        }
        const full = landing(game.board, c) < 0;
        col.disabled = full || game.over;
        col.setAttribute('aria-label', 'Column ' + (c + 1) + (full ? ', full' : ', ' + (landing(game.board, c) + 1) + ' spaces left'));
      });
    },
    move(c) {
      const r = landing(game.board, c);
      if (game.over || r < 0) return;
      const i = r * COLS + c;
      game.board[i] = game.player;
      game.last = i;
      Play.sounds.tick();
      const win = fourWin(game.board, game.player);
      if (win) { game.over = true; this.render(win); game.over = false; return finish(game.player); }
      if (game.board.every(Boolean)) { game.over = true; this.render(); game.over = false; return finish(0); }
      game.player = 3 - game.player;
      this.render();
      afterMove();
    },
    cpu() {
      const b = game.board;
      const moves = ORDER.filter((c) => landing(b, c) >= 0);
      const winsWith = (c, who) => { const i = landing(b, c) * COLS + c; b[i] = who; const w = fourWin(b, who); b[i] = 0; return !!w; };
      let choice = moves.find((c) => winsWith(c, 2));
      if (choice === undefined) {
        if (state.level === 'easy') {
          if (Play.random() < 0.6) choice = moves.find((c) => winsWith(c, 1));
          if (choice === undefined) choice = Play.random() < 0.5 ? moves[0] : Play.pick(moves);
        } else {
          let best = -Infinity;
          const options = [];
          moves.forEach((c) => {
            const i = landing(b, c) * COLS + c;
            b[i] = 2;
            const score = -fourSearch(b, 1, 5, -Infinity, Infinity);
            b[i] = 0;
            if (score > best) { best = score; options.length = 0; }
            if (score === best) options.push(c);
          });
          choice = options[0];
        }
      }
      this.move(choice);
    },
  };

  /* ---------- Dots and Boxes ----------
     The board is a grid of (2n+1) × (2n+1) cells: dots where both are even, lines where one is odd, boxes where both are odd. */

  GAMES.dots = {
    start() {
      const n = state.size;
      game = { n, lines: new Map(), boxes: new Map(), player: starter, over: false, counts: [0, 0], last: '' };
      const box = $('dots');
      box.style.setProperty('--n', n);
      const cells = [];
      for (let r = 0; r <= 2 * n; r++) {
        for (let c = 0; c <= 2 * n; c++) {
          if (r % 2 === 0 && c % 2 === 0) cells.push(el('span', 'dot'));
          else if (r % 2 === 1 && c % 2 === 1) {
            const b = el('span', 'box');
            b.dataset.key = r + ',' + c;
            cells.push(b);
          } else {
            const line = el('button', 'line ' + (r % 2 === 0 ? 'is-h' : 'is-v'));
            line.type = 'button';
            line.dataset.key = r + ',' + c;
            line.dataset.r = r;
            line.dataset.c = c;
            line.addEventListener('click', () => { if (humanTurn()) this.move(r + ',' + c); });
            line.addEventListener('keydown', (event) => this.arrow(event, r, c));
            cells.push(line);
          }
        }
      }
      box.replaceChildren(...cells);
      this.render();
    },
    allLines() {
      const out = [];
      for (let r = 0; r <= 2 * game.n; r++) for (let c = 0; c <= 2 * game.n; c++) if ((r + c) % 2 === 1) out.push(r + ',' + c);
      return out;
    },
    sidesOf(key) {
      const [r, c] = key.split(',').map(Number);
      return [(r - 1) + ',' + c, (r + 1) + ',' + c, r + ',' + (c - 1), r + ',' + (c + 1)];
    },
    boxesBy(key) {
      const [r, c] = key.split(',').map(Number);
      const n = game.n;
      const near = r % 2 === 0 ? [[r - 1, c], [r + 1, c]] : [[r, c - 1], [r, c + 1]];
      return near.filter(([a, b]) => a > 0 && a < 2 * n && b > 0 && b < 2 * n).map(([a, b]) => a + ',' + b);
    },
    drawn(lines, key) { return lines.has(key); },
    render() {
      $('dots').querySelectorAll('.line').forEach((line) => {
        const who = game.lines.get(line.dataset.key);
        line.className = 'line ' + (Number(line.dataset.r) % 2 === 0 ? 'is-h' : 'is-v') + (who ? ' is-' + who : '') + (line.dataset.key === game.last ? ' is-last' : '');
        line.disabled = !!who || game.over;
        line.setAttribute('aria-label', (who ? 'Drawn' : 'Empty') + ' line');
      });
      $('dots').querySelectorAll('.box').forEach((b) => {
        const who = game.boxes.get(b.dataset.key);
        b.className = 'box' + (who ? ' is-' + who : '');
        b.textContent = who ? (state.vs === 'cpu' ? (who === 1 ? 'You' : 'CPU') : who === 1 ? 'B' : 'O') : '';
      });
      const n = names();
      showTurn();
      if (!game.over) $('turn').textContent += ' · ' + n[0] + ' ' + game.counts[0] + ', ' + n[1] + ' ' + game.counts[1];
    },
    move(key) {
      if (game.over || game.lines.has(key)) return;
      game.lines.set(key, game.player);
      game.last = key;
      let made = 0;
      this.boxesBy(key).forEach((b) => {
        if (this.sidesOf(b).every((s) => game.lines.has(s))) {
          game.boxes.set(b, game.player);
          game.counts[game.player - 1]++;
          made++;
        }
      });
      if (made) Play.sounds.good(); else Play.sounds.tick();
      if (game.boxes.size === game.n * game.n) {
        game.over = true;
        this.render();
        game.over = false;
        const [a, b] = game.counts;
        finish(a === b ? 0 : a > b ? 1 : 2);
        $('turn').textContent += ' ' + a + ' to ' + b + '.';
        return;
      }
      if (!made) game.player = 3 - game.player;
      this.render();
      afterMove();
    },
    // How many sides a box has once these lines are drawn.
    sides(lines, b) { return this.sidesOf(b).filter((s) => lines.has(s)).length; },
    cpu() {
      const free = this.allLines().filter((k) => !game.lines.has(k));
      const lines = game.lines;
      const completes = (k) => this.boxesBy(k).some((b) => this.sides(lines, b) === 3);
      const unsafe = (k) => this.boxesBy(k).some((b) => this.sides(lines, b) === 2);
      let choice = free.filter(completes);
      if (choice.length && (state.level === 'hard' || Play.random() < 0.7)) return this.move(Play.pick(choice));
      const safe = free.filter((k) => !completes(k) && !unsafe(k));
      if (safe.length) return this.move(Play.pick(safe));
      if (state.level === 'easy') return this.move(Play.pick(free));
      // Every move gives something away: give away as few boxes as possible.
      let best = Infinity;
      choice = [];
      free.forEach((k) => {
        const given = this.giveaway(k);
        if (given < best) { best = given; choice = []; }
        if (given === best) choice.push(k);
      });
      this.move(Play.pick(choice));
    },
    // Boxes the other player could then take in a row after this line.
    giveaway(first) {
      const lines = new Map(game.lines);
      lines.set(first, 1);
      let taken = 0;
      for (let guard = 0; guard < 100; guard++) {
        const next = this.allLines().find((k) => !lines.has(k) && this.boxesBy(k).some((b) => this.sides(lines, b) === 3));
        if (!next) break;
        lines.set(next, 1);
        taken += this.boxesBy(next).filter((b) => this.sides(lines, b) === 4).length;
      }
      return taken;
    },
    arrow(event, r, c) {
      const steps = { ArrowRight: [[0, 2], [-1, 1], [1, 1]], ArrowLeft: [[0, -2], [-1, -1], [1, -1]], ArrowDown: [[2, 0], [1, -1], [1, 1]], ArrowUp: [[-2, 0], [-1, -1], [-1, 1]] }[event.key];
      if (!steps) return;
      event.preventDefault();
      event.stopPropagation();
      for (const [dr, dc] of steps) {
        const target = $('dots').querySelector('[data-key="' + (r + dr) + ',' + (c + dc) + '"].line');
        if (target) return target.focus();
      }
    },
  };

  /* ---------- Controls ---------- */

  function newGame(swap) {
    thinking++;
    if (swap) starter = 3 - starter;
    $('ttt').hidden = current() !== 'ttt';
    $('big-wrap').hidden = current() !== 'big';
    GAMES[current()].start();
    showScores();
    afterMove();
    if (state.tab === 'dots') GAMES.dots.render();
  }

  setupTabs('v3-board-tab', (tab) => {
    state.tab = tab;
    newGame(false);
  });

  const showLevel = () => { $('level').hidden = state.vs !== 'cpu'; };
  Play.segmented($('vs'), state.vs, (v) => { state.vs = v; remember(); showLevel(); newGame(false); });
  Play.segmented($('level'), state.level, (v) => { state.level = v; remember(); newGame(false); });
  Play.segmented($('ttt-mode'), state.ttt, (v) => { state.ttt = v; remember(); if (state.tab === 'ttt') newGame(false); });
  Play.segmented($('dots-size'), state.size, (v) => { state.size = Number(v); remember(); if (state.tab === 'dots') newGame(false); });
  showLevel();

  $('new').addEventListener('click', () => newGame(true));
  $('reset').addEventListener('click', () => {
    state.scores[current()] = [0, 0, 0];
    remember();
    showScores();
  });

  window.V3Keys.add([
    { keys: ['1', '2', '3', '4', '5', '6', '7', '8', '9'], label: '1 to 9', does: 'Tic-tac-toe: play a square (1 is top left, 9 is bottom right). Big board: the square, or first the board when you can play anywhere. Four in a Row: drop in a column (1 to 7)', run: (key) => {
      const k = Number(key);
      if (!humanTurn()) return false;
      if (current() === 'big') return GAMES.big.key(k);
      if (state.tab === 'ttt' && !game.board[k - 1]) { GAMES.ttt.move(k - 1); return true; }
      if (state.tab === 'four' && k <= COLS && landing(game.board, k - 1) >= 0) { GAMES.four.move(k - 1); return true; }
      return false;
    } },
    { keys: ['ArrowLeft', 'ArrowRight', 'ArrowUp', 'ArrowDown'], label: 'Arrow keys', does: 'Dots and Boxes: move between lines (then Enter to draw)', run: () => {
      if (state.tab !== 'dots' || document.activeElement.classList.contains('line')) return false;
      const first = $('dots').querySelector('.line:not(:disabled)');
      if (first) first.focus();
      return !!first;
    } },
    { keys: ['Escape'], label: 'Esc', does: 'Big board: undo picking a board', run: () => {
      if (current() !== 'big' || game.pick < 0) return false;
      game.pick = -1;
      GAMES.big.render();
      return true;
    } },
    { keys: ['b'], label: 'B', does: 'Tic-tac-toe: switch between classic and the big board', run: () => {
      if (state.tab !== 'ttt') return false;
      $('ttt-mode').querySelector('[aria-pressed="false"]').click();
      return true;
    } },
    { keys: ['n'], label: 'N', does: 'New game', press: '#new' },
    { keys: ['c'], label: 'C', does: 'Switch between a friend and the computer', run: () => { $('vs').querySelector('[aria-pressed="false"]').click(); return true; } },
    { keys: ['t'], label: 'T', does: 'Next game (tab)', run: () => {
      const tabs = Array.from(document.querySelectorAll('[role="tab"]'));
      tabs[(tabs.findIndex((t) => t.getAttribute('aria-selected') === 'true') + 1) % tabs.length].click();
      return true;
    } },
  ]);
})();

window.V3Keys.howTo({
  id: 'board',
  title: 'Board Games',
  steps: [
    'Choose a game at the top: Tic-tac-toe, Four in a Row, or Dots and Boxes.',
    'Play against a friend on the same device, or against the computer (Easy or Hard).',
    'Tic-tac-toe: take turns placing X and O. Three in a row wins.',
    'Big board: nine small games in one. Win a small board to claim it, and claim three boards in a row to win. The square you play sends the other player to the matching board (top-right square, top-right board). If that board is finished, they can play anywhere.',
    'Four in a Row: tap a column to drop a disc. Four in a line (across, down or diagonal) wins.',
    'Dots and Boxes: draw one line at a time. Finish the fourth side of a box to claim it and go again. Most boxes wins.',
  ],
  tip: 'Who goes first swaps every game. Scores are kept for each game.',
});
