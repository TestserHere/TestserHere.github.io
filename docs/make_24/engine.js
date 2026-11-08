/* Make 24: exact fractions, a solver and the puzzle generator */

window.Make24Engine = (function () {
  'use strict';

  // Above this many routes to 24, a Hard puzzle would be too easy.
  const HARD_MAX_ROUTES = 40;
  const EASY_MIN_ROUTES = 6;

  function gcd(a, b) {
    let x = Math.abs(a);
    let y = Math.abs(b);
    while (y) [x, y] = [y, x % y];
    return x || 1;
  }

  function fraction(n, d) {
    const bottom = d === undefined ? 1 : d;
    const sign = bottom < 0 ? -1 : 1;
    const divisor = gcd(n, bottom);
    return { n: (sign * n) / divisor, d: (sign * bottom) / divisor };
  }

  function apply(operator, a, b) {
    if (operator === '+') return fraction(a.n * b.d + b.n * a.d, a.d * b.d);
    if (operator === '−') return fraction(a.n * b.d - b.n * a.d, a.d * b.d);
    if (operator === '×') return fraction(a.n * b.n, a.d * b.d);
    return b.n === 0 ? null : fraction(a.n * b.d, a.d * b.n);
  }

  const is24 = (value) => value.n === 24 && value.d === 1;
  const format = (value) => (value.d === 1 ? String(value.n) : value.n + '/' + value.d);

  const atom = (value) => ({ value, expr: format(value), steps: [], isAtom: true });
  const wrap = (item) => (item.isAtom ? item.expr : '(' + item.expr + ')');

  /* Tries every order of combining the numbers. Stops as soon as onSolved returns true. */
  function explore(items, simpleOnly, onSolved) {
    if (items.length === 1) return is24(items[0].value) ? onSolved(items[0]) : false;
    for (let i = 0; i < items.length; i += 1) {
      for (let j = i + 1; j < items.length; j += 1) {
        const x = items[i];
        const y = items[j];
        const rest = items.filter((_, index) => index !== i && index !== j);
        const options = [[x, '+', y], [x, '×', y], [x, '−', y], [y, '−', x], [x, '÷', y], [y, '÷', x]];
        for (const [a, operator, b] of options) {
          const value = apply(operator, a.value, b.value);
          if (!value || (simpleOnly && (value.d !== 1 || value.n < 0))) continue;
          const step = { a: format(a.value), operator, b: format(b.value) };
          const node = { value, expr: wrap(a) + ' ' + operator + ' ' + wrap(b), steps: a.steps.concat(b.steps, step), isAtom: false };
          if (explore(rest.concat(node), simpleOnly, onSolved)) return true;
        }
      }
    }
    return false;
  }

  function solve(values) {
    let answer = null;
    explore(values.map(atom), false, (item) => {
      answer = { expr: item.expr, steps: item.steps };
      return true;
    });
    return answer;
  }

  function countRoutes(values, simpleOnly) {
    let routes = 0;
    explore(values.map(atom), simpleOnly, () => {
      routes += 1;
      return false;
    });
    return routes;
  }

  function roll(highest) {
    return Array.from({ length: 4 }, () => fraction(1 + Math.floor(Math.random() * highest)));
  }

  /* Easy: 1 to 9 with several whole-number routes. Hard: 1 to 13 with few routes. */
  function newPuzzle(level) {
    for (;;) {
      if (level === 'easy') {
        const values = roll(9);
        if (countRoutes(values, true) >= EASY_MIN_ROUTES) return values;
      } else {
        const values = roll(13);
        const routes = countRoutes(values, false);
        if (routes > 0 && routes <= HARD_MAX_ROUTES) return values;
      }
    }
  }

  return { fraction, apply, is24, format, solve, countRoutes, newPuzzle };
})();
