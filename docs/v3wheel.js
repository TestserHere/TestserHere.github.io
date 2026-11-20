/* A spinning wheel of names, with ticks, a chime and confetti.
   Shared by Picker and Class Toolkit. */

window.V3Wheel = (function () {
  'use strict';

  const COLORS = ['#0071e3', '#34c759', '#ff9f0a', '#ff375f', '#af52de', '#5ac8fa', '#ffcc00', '#30d158', '#ff6b3d', '#5e5ce6', '#64d2ff', '#bf5af2'];
  const FONT = '-apple-system, BlinkMacSystemFont, "Segoe UI", sans-serif';
  const TURN = Math.PI * 2;
  const POINTER = -Math.PI / 2; // the pointer sits at the top
  const reduceMotion = window.matchMedia('(prefers-reduced-motion: reduce)').matches;

  const wrap = (angle) => ((angle % TURN) + TURN) % TURN;

  /* options: { canvas, entries() -> names, onTick(), onDone(name) } */
  function create(options) {
    const { canvas, entries, onTick, onDone } = options;
    const ctx = canvas.getContext('2d');
    let size = 0;
    let rotation = 0;
    let spinning = false;

    function resize() {
      const box = canvas.parentElement.getBoundingClientRect();
      if (!box.width) return;
      const ratio = window.devicePixelRatio || 1;
      size = Math.floor(box.width);
      canvas.width = size * ratio;
      canvas.height = size * ratio;
      canvas.style.width = size + 'px';
      canvas.style.height = size + 'px';
      ctx.setTransform(ratio, 0, 0, ratio, 0, 0);
      draw();
    }

    /* Neighbouring slices never share a colour, including the last and the first. */
    function colorFor(index, count) {
      if (count > 1 && index === count - 1 && index % COLORS.length === 0) return COLORS[3];
      return COLORS[index % COLORS.length];
    }

    function fit(text, max, fontSize) {
      ctx.font = '600 ' + fontSize + 'px ' + FONT;
      if (ctx.measureText(text).width <= max) return text;
      let cut = text;
      while (cut.length > 1 && ctx.measureText(cut + '…').width > max) cut = cut.slice(0, -1);
      return cut + '…';
    }

    function draw() {
      if (!size) return;
      const list = entries();
      const r = size / 2;
      ctx.clearRect(0, 0, size, size);
      ctx.save();
      ctx.translate(r, r);
      if (!list.length) {
        ctx.beginPath();
        ctx.arc(0, 0, r - 4, 0, TURN);
        ctx.fillStyle = getComputedStyle(document.documentElement).getPropertyValue('--fill').trim() || '#e9e9ee';
        ctx.fill();
        ctx.restore();
        return;
      }
      const slice = TURN / list.length;
      const fontSize = Math.max(10, Math.min(r * 0.13, (r * 2.6) / Math.max(list.length, 6)));
      ctx.rotate(rotation);
      list.forEach((name, index) => {
        const start = index * slice;
        ctx.beginPath();
        ctx.moveTo(0, 0);
        ctx.arc(0, 0, r - 4, start, start + slice);
        ctx.closePath();
        ctx.fillStyle = colorFor(index, list.length);
        ctx.fill();
        if (list.length > 1) {
          ctx.strokeStyle = 'rgba(255,255,255,0.55)';
          ctx.lineWidth = list.length > 60 ? 0.5 : 1.5;
          ctx.stroke();
        }
        if (list.length <= 120) {
          ctx.save();
          ctx.rotate(start + slice / 2);
          ctx.textAlign = 'right';
          ctx.textBaseline = 'middle';
          ctx.fillStyle = '#fff';
          ctx.shadowColor = 'rgba(0,0,0,0.35)';
          ctx.shadowBlur = 3;
          ctx.fillText(fit(name, r * 0.62, fontSize), r - 18, 0);
          ctx.restore();
        }
      });
      ctx.restore();
      ctx.beginPath();
      ctx.arc(r, r, r - 3, 0, TURN);
      ctx.lineWidth = 5;
      ctx.strokeStyle = 'rgba(255,255,255,0.9)';
      ctx.stroke();
    }

    /* The slice under the pointer. */
    function indexAtPointer(count) {
      const slice = TURN / count;
      return Math.floor(wrap(POINTER - rotation) / slice) % count;
    }

    /* Spins to the given slice, or a random one. The winner is chosen first, then the wheel lands on it. */
    function spin(winner) {
      const list = entries();
      if (spinning || !list.length) return false;
      if (!size) resize();
      spinning = true;
      const target = Number.isInteger(winner) && winner >= 0 && winner < list.length ? winner : Math.floor(Math.random() * list.length);
      const slice = TURN / list.length;
      const landing = POINTER - (target * slice + slice * (0.15 + Math.random() * 0.7));
      const turns = reduceMotion ? 1 : 5 + Math.floor(Math.random() * 3);
      const from = rotation;
      const delta = wrap(landing - wrap(rotation)) + turns * TURN;
      const duration = reduceMotion ? 1200 : 4600 + Math.random() * 1200;
      const started = performance.now();
      let lastSlice = indexAtPointer(list.length);

      function frame(now) {
        const t = Math.min(1, (now - started) / duration);
        rotation = from + delta * (1 - Math.pow(1 - t, 4));
        draw();
        const under = indexAtPointer(list.length);
        if (under !== lastSlice) {
          lastSlice = under;
          if (onTick) onTick();
        }
        if (t < 1) {
          requestAnimationFrame(frame);
          return;
        }
        spinning = false;
        if (onDone) onDone(list[indexAtPointer(list.length)]);
      }
      requestAnimationFrame(frame);
      return true;
    }

    return { resize, draw, spin, isSpinning: () => spinning };
  }

  /* ---------- Sound ---------- */

  let audio = null;
  function beep(freq, length, volume, delay) {
    try {
      audio = audio || new (window.AudioContext || window.webkitAudioContext)();
      if (audio.state === 'suspended') audio.resume();
      const start = audio.currentTime + (delay || 0);
      const osc = audio.createOscillator();
      const gain = audio.createGain();
      osc.frequency.value = freq;
      osc.type = 'triangle';
      gain.gain.setValueAtTime(volume, start);
      gain.gain.exponentialRampToValueAtTime(0.0001, start + length);
      osc.connect(gain).connect(audio.destination);
      osc.start(start);
      osc.stop(start + length);
    } catch (_) { /* no sound on this device */ }
  }

  const tick = () => beep(1400, 0.03, 0.05);
  const chime = () => [523, 659, 784].forEach((freq, i) => beep(freq, 0.25, 0.08, i * 0.09));

  /* ---------- Confetti ---------- */

  function confetti(layer, keepGoing) {
    if (reduceMotion) return;
    const rect = layer.getBoundingClientRect();
    if (!rect.width) return;
    const ratio = window.devicePixelRatio || 1;
    layer.width = rect.width * ratio;
    layer.height = rect.height * ratio;
    const c = layer.getContext('2d');
    c.setTransform(ratio, 0, 0, ratio, 0, 0);
    const bits = Array.from({ length: 70 }, () => ({
      x: rect.width / 2,
      y: rect.height * 0.35,
      vx: (Math.random() - 0.5) * 9,
      vy: -Math.random() * 7 - 3,
      size: 4 + Math.random() * 5,
      turn: Math.random() * Math.PI,
      color: COLORS[Math.floor(Math.random() * COLORS.length)],
    }));
    const started = performance.now();
    (function frame(now) {
      c.clearRect(0, 0, rect.width, rect.height);
      bits.forEach((bit) => {
        bit.vy += 0.25;
        bit.x += bit.vx;
        bit.y += bit.vy;
        bit.turn += 0.2;
        c.save();
        c.translate(bit.x, bit.y);
        c.rotate(bit.turn);
        c.fillStyle = bit.color;
        c.fillRect(-bit.size / 2, -bit.size / 4, bit.size, bit.size / 2);
        c.restore();
      });
      if (now - started < 1800 && (!keepGoing || keepGoing())) requestAnimationFrame(frame);
      else c.clearRect(0, 0, rect.width, rect.height);
    })(started);
  }

  /* ---------- Winner window ---------- */

  function openDialog(dialog) {
    if (typeof dialog.showModal === 'function') { if (!dialog.open) dialog.showModal(); } else dialog.setAttribute('open', '');
  }
  function closeDialog(dialog) {
    if (dialog.open && typeof dialog.close === 'function') dialog.close(); else dialog.removeAttribute('open');
  }

  return { create, tick, chime, confetti, openDialog, closeDialog, COLORS };
})();
