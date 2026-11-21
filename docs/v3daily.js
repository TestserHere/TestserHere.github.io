/* Daily puzzles: the same "random" choices for everyone on the same day, with no server.
   The day's date is turned into a seed, and the seed drives a small random number generator. */

window.V3Daily = (function () {
  'use strict';

  /* Today's date as YYYY-MM-DD, in the player's own time zone. */
  function today(date) {
    const d = date || new Date();
    return d.getFullYear() + '-' + String(d.getMonth() + 1).padStart(2, '0') + '-' + String(d.getDate()).padStart(2, '0');
  }

  /* A number from a piece of text (FNV-1a). */
  function hash(text) {
    let h = 2166136261;
    for (let i = 0; i < text.length; i++) {
      h ^= text.charCodeAt(i);
      h = Math.imul(h, 16777619);
    }
    return h >>> 0;
  }

  /* A random number generator (mulberry32) that gives the same numbers for the same seed. */
  function rng(seed) {
    let a = typeof seed === 'number' ? seed >>> 0 : hash(String(seed));
    return function () {
      a = (a + 0x6d2b79f5) >>> 0;
      let t = a;
      t = Math.imul(t ^ (t >>> 15), t | 1);
      t ^= t + Math.imul(t ^ (t >>> 7), t | 61);
      return ((t ^ (t >>> 14)) >>> 0) / 4294967296;
    };
  }

  const pick = (list, random) => list[Math.floor(random() * list.length)];

  function shuffle(list, random) {
    const copy = list.slice();
    for (let i = copy.length - 1; i > 0; i--) {
      const j = Math.floor(random() * (i + 1));
      [copy[i], copy[j]] = [copy[j], copy[i]];
    }
    return copy;
  }

  /* "21 November 2026" */
  function label(day) {
    const [y, m, d] = day.split('-').map(Number);
    return new Date(y, m - 1, d).toLocaleDateString(undefined, { day: 'numeric', month: 'long', year: 'numeric' });
  }

  /* Copies text, falling back to the share sheet on phones. Resolves to true when it worked. */
  async function share(text) {
    try {
      if (navigator.clipboard && navigator.clipboard.writeText) {
        await navigator.clipboard.writeText(text);
        return true;
      }
    } catch (_) { /* try the share sheet */ }
    try {
      if (navigator.share) {
        await navigator.share({ text });
        return true;
      }
    } catch (_) { /* cancelled */ }
    return false;
  }

  return { today, hash, rng, pick, shuffle, label, share };
})();
