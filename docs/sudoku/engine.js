/* Sudoku: solver and puzzle generator. Every puzzle has exactly one solution. */

window.SudokuEngine = (function () {
  'use strict';

  const ALL = 0x3fe; // bits 1 to 9
  const CLUE_TARGET = { easy: 40, medium: 32, hard: 25 };
  const HARD_ATTEMPTS = 25;

  const boxOf = (cell) => Math.floor(Math.floor(cell / 9) / 3) * 3 + Math.floor((cell % 9) / 3);

  const UNITS = [];
  for (let i = 0; i < 9; i += 1) {
    UNITS.push(Array.from({ length: 9 }, (_, j) => i * 9 + j));
    UNITS.push(Array.from({ length: 9 }, (_, j) => j * 9 + i));
    UNITS.push(Array.from({ length: 81 }, (_, cell) => cell).filter((cell) => boxOf(cell) === i));
  }

  const PEERS = Array.from({ length: 81 }, (_, cell) => {
    const peers = new Set();
    UNITS.filter((unit) => unit.includes(cell)).forEach((unit) => unit.forEach((other) => peers.add(other)));
    peers.delete(cell);
    return Array.from(peers);
  });

  function shuffled(list) {
    const copy = list.slice();
    for (let i = copy.length - 1; i > 0; i -= 1) {
      const j = Math.floor(Math.random() * (i + 1));
      [copy[i], copy[j]] = [copy[j], copy[i]];
    }
    return copy;
  }

  function bitCount(mask) {
    let bits = 0;
    for (let rest = mask; rest; rest &= rest - 1) bits += 1;
    return bits;
  }

  /* Backtracking that always fills the most constrained cell next. */
  function search(input, limit, randomise) {
    const grid = input.slice();
    const rows = new Array(9).fill(0);
    const cols = new Array(9).fill(0);
    const boxes = new Array(9).fill(0);
    const found = [];

    for (let cell = 0; cell < 81; cell += 1) {
      if (!grid[cell]) continue;
      const bit = 1 << grid[cell];
      const row = Math.floor(cell / 9);
      const col = cell % 9;
      const box = boxOf(cell);
      if ((rows[row] | cols[col] | boxes[box]) & bit) return found;
      rows[row] |= bit;
      cols[col] |= bit;
      boxes[box] |= bit;
    }

    function step() {
      let target = -1;
      let targetMask = 0;
      let fewest = 10;
      for (let cell = 0; cell < 81 && fewest > 1; cell += 1) {
        if (grid[cell]) continue;
        const mask = ALL & ~(rows[Math.floor(cell / 9)] | cols[cell % 9] | boxes[boxOf(cell)]);
        const options = bitCount(mask);
        if (options === 0) return false;
        if (options < fewest) {
          fewest = options;
          target = cell;
          targetMask = mask;
        }
      }
      if (target < 0) {
        found.push(grid.slice());
        return found.length >= limit;
      }

      const row = Math.floor(target / 9);
      const col = target % 9;
      const box = boxOf(target);
      const digits = [1, 2, 3, 4, 5, 6, 7, 8, 9].filter((digit) => targetMask & (1 << digit));
      for (const digit of randomise ? shuffled(digits) : digits) {
        const bit = 1 << digit;
        grid[target] = digit;
        rows[row] |= bit;
        cols[col] |= bit;
        boxes[box] |= bit;
        if (step()) return true;
        rows[row] &= ~bit;
        cols[col] &= ~bit;
        boxes[box] &= ~bit;
      }
      grid[target] = 0;
      return false;
    }

    step();
    return found;
  }

  const countSolutions = (grid, limit) => search(grid, limit || 2, false).length;

  /* True when the puzzle can be finished without any advanced technique. */
  function solvableBySingles(input) {
    const grid = input.slice();
    const candidates = (cell) => {
      let mask = ALL;
      PEERS[cell].forEach((peer) => { if (grid[peer]) mask &= ~(1 << grid[peer]); });
      return mask;
    };

    let progress = true;
    while (progress) {
      progress = false;
      for (let cell = 0; cell < 81; cell += 1) {
        if (grid[cell]) continue;
        const mask = candidates(cell);
        if (bitCount(mask) === 1) {
          grid[cell] = 31 - Math.clz32(mask);
          progress = true;
        }
      }
      for (const unit of UNITS) {
        for (let digit = 1; digit <= 9; digit += 1) {
          if (unit.some((cell) => grid[cell] === digit)) continue;
          const spots = unit.filter((cell) => !grid[cell] && candidates(cell) & (1 << digit));
          if (spots.length === 1) {
            grid[spots[0]] = digit;
            progress = true;
          }
        }
      }
    }
    return grid.every(Boolean);
  }

  function carve(solution, level) {
    const puzzle = solution.slice();
    const target = CLUE_TARGET[level];
    let clues = 81;
    // Cells come out in mirrored pairs, which gives the board its balanced look.
    for (const cell of shuffled(Array.from({ length: 41 }, (_, i) => i))) {
      if (clues <= target) break;
      const mirror = 80 - cell;
      const saved = [puzzle[cell], puzzle[mirror]];
      puzzle[cell] = 0;
      puzzle[mirror] = 0;
      if (countSolutions(puzzle) === 1 && (level === 'hard' || solvableBySingles(puzzle))) {
        clues -= cell === mirror ? 1 : 2;
      } else {
        [puzzle[cell], puzzle[mirror]] = saved;
      }
    }
    return puzzle;
  }

  function generate(level) {
    let puzzle;
    let solution;
    for (let attempt = 0; attempt < HARD_ATTEMPTS; attempt += 1) {
      [solution] = search(new Array(81).fill(0), 1, true);
      puzzle = carve(solution, level);
      if (level !== 'hard' || !solvableBySingles(puzzle)) break;
    }
    return { puzzle, solution };
  }

  return { PEERS, UNITS, countSolutions, solvableBySingles, generate };
})();
