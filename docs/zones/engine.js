/* Zones: puzzle generator and solvers.
   Rules: one marker in every row, column and zone, and no two markers may touch. */

window.ZonesEngine = (function () {
  'use strict';

  const SIZE = { easy: 6, medium: 8, hard: 10 };
  const TUPLE_LIMIT = { easy: 0, medium: 2, hard: 3 };
  const MAX_ATTEMPTS = 600;

  function shuffled(list) {
    const copy = list.slice();
    for (let i = copy.length - 1; i > 0; i -= 1) {
      const j = Math.floor(Math.random() * (i + 1));
      [copy[i], copy[j]] = [copy[j], copy[i]];
    }
    return copy;
  }

  const range = (n) => Array.from({ length: n }, (_, i) => i);

  function orthogonal(cell, n) {
    const row = Math.floor(cell / n);
    const col = cell % n;
    const out = [];
    if (row > 0) out.push(cell - n);
    if (row < n - 1) out.push(cell + n);
    if (col > 0) out.push(cell - 1);
    if (col < n - 1) out.push(cell + 1);
    return out;
  }

  /* A column for each row, with neighbouring rows at least two columns apart. */
  function randomLayout(n) {
    const columns = [];
    const used = new Set();
    function place(row) {
      if (row === n) return true;
      for (const col of shuffled(range(n))) {
        if (used.has(col) || (row && Math.abs(col - columns[row - 1]) < 2)) continue;
        columns[row] = col;
        used.add(col);
        if (place(row + 1)) return true;
        used.delete(col);
      }
      return false;
    }
    place(0);
    return columns;
  }

  /* Zones grow outward from each marker. Uneven weights give a mix of small and large zones. */
  function growZones(n, layout) {
    const zones = new Array(n * n).fill(-1);
    const weights = layout.map(() => Math.random() ** 2 + 0.12);
    layout.forEach((col, row) => { zones[row * n + col] = row; });
    let left = n * n - n;

    while (left) {
      const edges = range(n).map(() => []);
      zones.forEach((zone, cell) => {
        if (zone !== -1) return;
        new Set(orthogonal(cell, n).map((next) => zones[next])).forEach((id) => {
          if (id !== -1) edges[id].push(cell);
        });
      });
      const open = range(n).filter((id) => edges[id].length);
      let pick = Math.random() * open.reduce((sum, id) => sum + weights[id], 0);
      let chosen = open[open.length - 1];
      for (const id of open) {
        pick -= weights[id];
        if (pick <= 0) {
          chosen = id;
          break;
        }
      }
      zones[edges[chosen][Math.floor(Math.random() * edges[chosen].length)]] = chosen;
      left -= 1;
    }
    return zones;
  }

  /* Finds up to `limit` complete solutions, each as a column for every row. */
  function solutions(n, zones, limit) {
    const found = [];
    const columns = [];
    function place(row, usedCols, usedZones) {
      if (row === n) {
        found.push(columns.slice());
        return found.length >= limit;
      }
      for (let col = 0; col < n; col += 1) {
        const zone = zones[row * n + col];
        if (usedCols & (1 << col) || usedZones & (1 << zone)) continue;
        if (row && Math.abs(col - columns[row - 1]) < 2) continue;
        columns[row] = col;
        if (place(row + 1, usedCols | (1 << col), usedZones | (1 << zone))) return true;
      }
      return false;
    }
    place(0, 0, 0);
    return found;
  }

  function staysConnected(n, zones, removed) {
    const zone = zones[removed];
    const cells = zones.reduce((list, id, cell) => (id === zone && cell !== removed ? list.concat(cell) : list), []);
    if (!cells.length) return false;
    const seen = new Set([cells[0]]);
    const queue = [cells[0]];
    while (queue.length) {
      orthogonal(queue.pop(), n).forEach((next) => {
        if (next !== removed && zones[next] === zone && !seen.has(next)) {
          seen.add(next);
          queue.push(next);
        }
      });
    }
    return seen.size === cells.length;
  }

  /* While a second solution exists, hand one of its cells to a neighbouring zone to rule it out. */
  function forceUnique(n, zones, layout) {
    for (let round = 0; round < n * 60; round += 1) {
      const other = solutions(n, zones, 2).find((columns) => columns.some((col, row) => col !== layout[row]));
      if (!other) return true;
      let repaired = false;
      for (const row of shuffled(range(n).filter((r) => other[r] !== layout[r]))) {
        const cell = row * n + other[row];
        const options = orthogonal(cell, n).map((next) => zones[next]).filter((id) => id !== zones[cell]);
        if (options.length && staysConnected(n, zones, cell)) {
          zones[cell] = options[Math.floor(Math.random() * options.length)];
          repaired = true;
          break;
        }
      }
      if (!repaired) return false;
    }
    return false;
  }

  /* Solves using reasoning only, with no guessing. tupleLimit sets the hardest technique allowed. */
  function solvesByLogic(n, zones, tupleLimit) {
    const total = n * n;
    const open = new Array(total).fill(true);
    const placed = new Array(total).fill(false);
    let markers = 0;

    const attacks = (a, b) => {
      if (a === b) return false;
      const rowGap = Math.abs(Math.floor(a / n) - Math.floor(b / n));
      const colGap = Math.abs((a % n) - (b % n));
      return rowGap === 0 || colGap === 0 || zones[a] === zones[b] || (rowGap <= 1 && colGap <= 1);
    };

    const rows = range(n).map((r) => range(n).map((c) => r * n + c));
    const cols = range(n).map((c) => range(n).map((r) => r * n + c));
    const areas = range(n).map((id) => range(total).filter((cell) => zones[cell] === id));
    const units = rows.concat(cols, areas);
    const isDone = (unit) => unit.some((cell) => placed[cell]);
    const openIn = (unit) => unit.filter((cell) => open[cell]);

    function place(cell) {
      placed[cell] = true;
      open[cell] = false;
      markers += 1;
      for (let other = 0; other < total; other += 1) if (attacks(cell, other)) open[other] = false;
    }

    function basicStep() {
      let changed = false;
      for (const unit of units) {
        if (isDone(unit)) continue;
        const spots = openIn(unit);
        if (spots.length === 0) return null;
        if (spots.length === 1) {
          place(spots[0]);
          changed = true;
        }
      }
      // A cell that would rule out every remaining spot in some row, column or zone can't hold a marker.
      for (const unit of units) {
        if (isDone(unit)) continue;
        const spots = openIn(unit);
        for (let other = 0; other < total; other += 1) {
          if (open[other] && !spots.includes(other) && spots.every((spot) => attacks(spot, other))) {
            open[other] = false;
            changed = true;
          }
        }
      }
      return changed;
    }

    /* If k rows can only be filled by k zones, those zones have no markers anywhere else. */
    function tupleStep(lines, others, size) {
      const active = lines.filter((line) => !isDone(line));
      let changed = false;
      const chosen = [];
      function visit(start) {
        if (chosen.length === size) {
          const touched = new Set();
          chosen.forEach((line) => openIn(line).forEach((cell) => {
            others.forEach((other, id) => { if (other.includes(cell)) touched.add(id); });
          }));
          if (touched.size !== size) return;
          const kept = new Set(chosen.flat());
          touched.forEach((id) => openIn(others[id]).forEach((cell) => {
            if (!kept.has(cell)) {
              open[cell] = false;
              changed = true;
            }
          }));
          return;
        }
        for (let i = start; i < active.length; i += 1) {
          chosen.push(active[i]);
          visit(i + 1);
          chosen.pop();
        }
      }
      visit(0);
      return changed;
    }

    for (;;) {
      const basic = basicStep();
      if (basic === null) return false;
      if (markers === n) return true;
      if (basic) continue;
      let advanced = false;
      for (let size = 2; size <= tupleLimit && !advanced; size += 1) {
        advanced = tupleStep(rows, areas, size) || tupleStep(areas, rows, size) ||
          tupleStep(cols, areas, size) || tupleStep(areas, cols, size);
      }
      if (!advanced) return false;
    }
  }

  function generate(level) {
    const n = SIZE[level];
    const limit = TUPLE_LIMIT[level];
    let fallback = null;
    for (let attempt = 0; attempt < MAX_ATTEMPTS; attempt += 1) {
      const layout = randomLayout(n);
      const zones = growZones(n, layout);
      if (!forceUnique(n, zones, layout)) continue;
      if (!solvesByLogic(n, zones, limit)) continue;
      fallback = { n, zones, layout };
      // Medium and Hard must need more than the most basic reasoning.
      if (level === 'easy' || !solvesByLogic(n, zones, Math.max(0, limit - 2))) return fallback;
    }
    if (fallback) return fallback;
    return generate(level);
  }

  return { SIZE, solutions, solvesByLogic, generate };
})();
