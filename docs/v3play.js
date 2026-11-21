/* Small helpers shared by the offline party games: choices, sounds, shuffling and buzzes. */

window.V3Play = (function () {
  'use strict';

  /* A row of buttons where one is chosen: <div class="segmented"><button data-value="a">…</button></div> */
  function segmented(root, current, onChange) {
    const buttons = Array.from(root.querySelectorAll('button[data-value]'));
    const show = (value) => buttons.forEach((b) => b.setAttribute('aria-pressed', String(b.dataset.value === String(value))));
    buttons.forEach((b) => b.addEventListener('click', () => {
      show(b.dataset.value);
      onChange(b.dataset.value);
    }));
    show(current);
    return show;
  }

  /* Sounds are made on the device, so they work offline. */
  let audio = null;
  function context() {
    const Ctx = window.AudioContext || window.webkitAudioContext;
    if (!Ctx) return null;
    if (!audio) audio = new Ctx();
    if (audio.state === 'suspended') audio.resume().catch(() => {});
    return audio;
  }
  function tone(freq, ms, options) {
    const o = options || {};
    const ctx = context();
    if (!ctx) return;
    try {
      const osc = ctx.createOscillator();
      const gain = ctx.createGain();
      const start = ctx.currentTime + (o.delay || 0) / 1000;
      const end = start + ms / 1000;
      osc.type = o.type || 'sine';
      osc.frequency.setValueAtTime(freq, start);
      if (o.to) osc.frequency.exponentialRampToValueAtTime(o.to, end);
      gain.gain.setValueAtTime(0.0001, start);
      gain.gain.exponentialRampToValueAtTime(o.volume || 0.2, start + 0.01);
      gain.gain.exponentialRampToValueAtTime(0.0001, end);
      osc.connect(gain).connect(ctx.destination);
      osc.start(start);
      osc.stop(end + 0.02);
    } catch (_) { /* no sound is fine */ }
  }
  const sounds = {
    good: () => { tone(660, 120); tone(990, 180, { delay: 110 }); },
    bad: () => tone(220, 260, { type: 'square', volume: 0.08, to: 150 }),
    tick: () => tone(1200, 30, { type: 'square', volume: 0.05 }),
    go: () => tone(880, 220, { type: 'triangle', volume: 0.25 }),
    win: () => [523, 659, 784, 1047].forEach((f, i) => tone(f, 200, { delay: i * 120, type: 'triangle' })),
    end: () => { tone(440, 300, { type: 'sawtooth', volume: 0.08 }); tone(330, 500, { delay: 280, type: 'sawtooth', volume: 0.08 }); },
  };

  const vibrate = (pattern) => { try { if (navigator.vibrate) navigator.vibrate(pattern); } catch (_) { /* not supported */ } };

  /* Fair random numbers from the device's secure generator when there is one. */
  function random() {
    if (window.crypto && crypto.getRandomValues) return crypto.getRandomValues(new Uint32Array(1))[0] / 4294967296;
    return Math.random();
  }
  const int = (n) => Math.floor(random() * n);
  const pick = (list) => list[int(list.length)];
  function shuffle(list) {
    const copy = list.slice();
    for (let i = copy.length - 1; i > 0; i--) {
      const j = int(i + 1);
      [copy[i], copy[j]] = [copy[j], copy[i]];
    }
    return copy;
  }

  /* Player names from a text box, one per line, with sensible fallbacks. */
  function names(text, min, max) {
    const list = String(text || '').split('\n').map((s) => s.trim()).filter(Boolean).slice(0, max || 12);
    while (list.length < (min || 0)) list.push('Player ' + (list.length + 1));
    return list;
  }

  return { segmented, tone, sounds, vibrate, random, int, pick, shuffle, names };
})();
