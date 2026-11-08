/* Toolkit: clock, stopwatch, timer and calculator */

(function () {
  'use strict';

  const { $, read, write, el, setupTabs } = window.V3Tools;

  const pad = (value) => String(value).padStart(2, '0');
  const setText = (node, text) => { if (node.textContent !== text) node.textContent = text; };

  /* Clock */
  const FORMAT_KEY = 'v3-toolkit-clock-format';
  let clockFormat = read(FORMAT_KEY, '24') === '12' ? '12' : '24';
  let lastClockSecond = -1;

  const ticks = $('clock-ticks');
  for (let minute = 0; minute < 60; minute += 1) {
    const major = minute % 5 === 0;
    const line = document.createElementNS('http://www.w3.org/2000/svg', 'line');
    line.setAttribute('class', major ? 'clock-tick clock-tick-major' : 'clock-tick');
    line.setAttribute('x1', '100');
    line.setAttribute('x2', '100');
    line.setAttribute('y1', '8');
    line.setAttribute('y2', major ? '20' : '14');
    line.setAttribute('transform', 'rotate(' + minute * 6 + ' 100 100)');
    ticks.appendChild(line);
  }

  function rotate(id, degrees) {
    $(id).setAttribute('transform', 'rotate(' + degrees + ' 100 100)');
  }

  function renderClock(force) {
    const now = new Date();
    const seconds = now.getSeconds();
    if (!force && seconds === lastClockSecond) return;
    lastClockSecond = seconds;

    const hours = now.getHours();
    const minutes = now.getMinutes();
    rotate('hand-second', seconds * 6);
    rotate('hand-minute', minutes * 6 + seconds / 10);
    rotate('hand-hour', (hours % 12) * 30 + minutes / 2);

    const shown = clockFormat === '12' ? hours % 12 || 12 : pad(hours);
    setText($('clock-time'), shown + ':' + pad(minutes) + ':' + pad(seconds));
    setText($('clock-period'), clockFormat === '12' ? (hours < 12 ? 'AM' : 'PM') : '');
    setText($('clock-date'), now.toLocaleDateString(undefined, { weekday: 'long', day: 'numeric', month: 'long', year: 'numeric' }));
  }

  function renderClockFormat() {
    document.querySelectorAll('[data-format]').forEach((button) => {
      button.setAttribute('aria-pressed', String(button.dataset.format === clockFormat));
    });
    renderClock(true);
  }

  document.querySelectorAll('[data-format]').forEach((button) => {
    button.addEventListener('click', () => {
      clockFormat = button.dataset.format;
      write(FORMAT_KEY, clockFormat);
      renderClockFormat();
    });
  });

  /* Stopwatch: time comes from a timestamp, so a busy or hidden tab can't make it drift */
  const stopwatch = { running: false, startedAt: 0, banked: 0, laps: [], lapBase: 0 };

  function stopwatchElapsed() {
    return stopwatch.banked + (stopwatch.running ? performance.now() - stopwatch.startedAt : 0);
  }

  function formatStopwatch(ms) {
    const centis = Math.floor(ms / 10);
    const hours = Math.floor(centis / 360000);
    const text = pad(Math.floor(centis / 6000) % 60) + ':' + pad(Math.floor(centis / 100) % 60) + '.' + pad(centis % 100);
    return hours ? hours + ':' + text : text;
  }

  function renderStopwatchTime() {
    const elapsed = stopwatchElapsed();
    setText($('sw-time'), formatStopwatch(elapsed));
    $('sw-time').classList.toggle('has-hours', elapsed >= 3600000);
  }

  function renderStopwatch() {
    const { running, banked, laps } = stopwatch;
    const left = $('sw-left');
    const right = $('sw-right');
    left.textContent = !running && banked > 0 ? 'Reset' : 'Lap';
    left.disabled = !running && banked === 0;
    right.textContent = running ? 'Stop' : 'Start';
    right.className = running ? 'danger' : 'primary';

    const fastest = laps.length > 1 ? Math.min(...laps) : null;
    const slowest = laps.length > 1 ? Math.max(...laps) : null;
    const rows = laps.map((lap, index) => {
      const row = el('li');
      row.append(el('span', '', 'Lap ' + (index + 1)));
      if (fastest !== slowest && lap === fastest) {
        row.className = 'lap-fastest';
        row.append(el('span', 'lap-tag', 'Fastest'));
      } else if (fastest !== slowest && lap === slowest) {
        row.className = 'lap-slowest';
        row.append(el('span', 'lap-tag', 'Slowest'));
      }
      row.append(el('span', 'lap-time', formatStopwatch(lap)));
      return row;
    }).reverse();
    $('sw-laps').replaceChildren(...rows);
    $('sw-laps').hidden = laps.length === 0;
    renderStopwatchTime();
  }

  $('sw-right').addEventListener('click', () => {
    if (stopwatch.running) {
      stopwatch.banked = stopwatchElapsed();
      stopwatch.running = false;
    } else {
      stopwatch.startedAt = performance.now();
      stopwatch.running = true;
    }
    renderStopwatch();
  });

  $('sw-left').addEventListener('click', () => {
    if (stopwatch.running) {
      const elapsed = stopwatchElapsed();
      stopwatch.laps.push(elapsed - stopwatch.lapBase);
      stopwatch.lapBase = elapsed;
    } else {
      stopwatch.banked = 0;
      stopwatch.laps = [];
      stopwatch.lapBase = 0;
    }
    renderStopwatch();
  });

  /* Timer */
  const MAX_TIMER_SECONDS = 86399;
  const ALARM_ROUNDS = 25; // about 30 seconds of beeping
  const RING_LENGTH = 2 * Math.PI * 92;
  const PAGE_TITLE = document.title;
  const timer = { state: 'idle', total: 0, endsAt: 0, left: 0 };
  let audio = null;
  let alarm = null;

  $('timer-bar').style.strokeDasharray = String(RING_LENGTH);

  function stopAlarm() {
    if (alarm) alarm.disconnect();
    alarm = null;
  }

  /* The beeps are booked on the audio clock, which keeps time even when the browser slows a hidden tab. */
  function bookAlarm(delayMs) {
    stopAlarm();
    const AudioEngine = window.AudioContext || window.webkitAudioContext;
    if (!AudioEngine) return;
    try {
      audio = audio || new AudioEngine();
      audio.resume();
      const begin = audio.currentTime + delayMs / 1000;
      const output = audio.createGain();
      output.gain.value = 0.25;
      output.connect(audio.destination);
      for (let round = 0; round < ALARM_ROUNDS; round += 1) {
        for (let beep = 0; beep < 3; beep += 1) {
          const at = begin + round * 1.2 + beep * 0.2;
          const tone = audio.createOscillator();
          tone.frequency.value = 880;
          tone.connect(output);
          tone.start(at);
          tone.stop(at + 0.12);
        }
      }
      alarm = output;
    } catch (_) {
      alarm = null; // the timer still works, just silently
    }
  }

  function timerLeft() {
    if (timer.state === 'running') return Math.max(0, timer.endsAt - performance.now());
    return timer.state === 'paused' ? timer.left : 0;
  }

  function formatTimer(ms) {
    const total = Math.ceil(ms / 1000);
    const hours = Math.floor(total / 3600);
    const minutes = Math.floor(total / 60) % 60;
    const seconds = pad(total % 60);
    return hours ? hours + ':' + pad(minutes) + ':' + seconds : minutes + ':' + seconds;
  }

  function renderTimerProgress() {
    if (timer.state === 'idle') return;
    const left = timerLeft();
    const text = timer.state === 'done' ? "Time's up!" : formatTimer(left);
    setText($('timer-text'), text);
    $('timer-bar').style.strokeDashoffset = String(RING_LENGTH * (1 - left / timer.total));
    const title = timer.state === 'done' ? "Time's up!" : timer.state === 'running' ? text + ' · Timer' : PAGE_TITLE;
    if (document.title !== title) document.title = title;
  }

  function renderTimer() {
    const { state } = timer;
    const idle = state === 'idle';
    const done = state === 'done';
    $('timer-setup').hidden = !idle;
    $('timer-run').hidden = idle;
    $('timer-ring').classList.toggle('is-done', done);
    $('timer-cancel').hidden = done;
    $('timer-add').hidden = done;
    $('timer-pause').textContent = done ? 'Stop' : state === 'paused' ? 'Resume' : 'Pause';
    $('timer-pause').className = done ? 'danger' : 'primary';
    if (idle) document.title = PAGE_TITLE;
    renderTimerProgress();
    renderTimerStart();
  }

  function enteredSeconds() {
    const part = (id) => Math.max(0, Math.floor(Number($(id).value) || 0));
    return Math.min(MAX_TIMER_SECONDS, part('timer-h') * 3600 + part('timer-m') * 60 + part('timer-s'));
  }

  function renderTimerStart() {
    $('timer-start').disabled = enteredSeconds() === 0;
  }

  function startTimer(seconds) {
    timer.total = seconds * 1000;
    timer.endsAt = performance.now() + timer.total;
    timer.state = 'running';
    bookAlarm(timer.total);
    renderTimer();
  }

  function resetTimer() {
    stopAlarm();
    timer.state = 'idle';
    renderTimer();
  }

  function finishTimer() {
    timer.state = 'done';
    tabs.show('timer');
    renderTimer();
  }

  ['timer-h', 'timer-m', 'timer-s'].forEach((id) => $(id).addEventListener('input', renderTimerStart));

  $('timer-start').addEventListener('click', () => startTimer(enteredSeconds()));

  $('timer-presets').addEventListener('click', (event) => {
    const button = event.target.closest('[data-minutes]');
    if (button) startTimer(Number(button.dataset.minutes) * 60);
  });

  $('timer-cancel').addEventListener('click', resetTimer);

  $('timer-add').addEventListener('click', () => {
    timer.total += 60000;
    if (timer.state === 'running') {
      timer.endsAt += 60000;
      bookAlarm(timer.endsAt - performance.now());
    } else {
      timer.left += 60000;
    }
    renderTimerProgress();
  });

  $('timer-pause').addEventListener('click', () => {
    if (timer.state === 'done') {
      resetTimer();
      return;
    }
    if (timer.state === 'running') {
      timer.left = timerLeft();
      timer.state = 'paused';
      stopAlarm();
    } else {
      timer.endsAt = performance.now() + timer.left;
      timer.state = 'running';
      bookAlarm(timer.left);
    }
    renderTimer();
  });

  /* Calculator: multiplication and division happen before addition and subtraction */
  const OPERATORS = ['+', '−', '×', '÷'];
  const calc = { tokens: [], entry: '0', fresh: false, repeat: null, history: '', error: '' };

  function formatResult(value) {
    const size = Math.abs(value);
    if (value !== 0 && (size >= 1e15 || size < 1e-9)) {
      return value.toExponential(8).replace(/\.?0+e/, 'e');
    }
    return String(parseFloat(value.toPrecision(12)));
  }

  function evaluate(sequence) {
    const sum = [sequence[0]];
    for (let i = 1; i < sequence.length; i += 2) {
      const operator = sequence[i];
      const number = sequence[i + 1];
      if (operator === '×') sum[sum.length - 1] *= number;
      else if (operator === '÷') sum[sum.length - 1] /= number;
      else sum.push(operator, number);
    }
    let total = sum[0];
    for (let i = 1; i < sum.length; i += 2) {
      total = sum[i] === '+' ? total + sum[i + 1] : total - sum[i + 1];
    }
    return total;
  }

  function group(text) {
    const match = /^(-?)(\d+)(\.\d*)?$/.exec(text);
    if (!match) return text;
    return match[1] + match[2].replace(/\B(?=(\d{3})+$)/g, ',') + (match[3] || '');
  }

  const showToken = (token) => (typeof token === 'number' ? group(formatResult(token)) : token);

  function currentNumber() {
    if (calc.entry !== null) return Number(calc.entry);
    return calc.tokens[calc.tokens.length - 2];
  }

  function resetCalc() {
    Object.assign(calc, { tokens: [], entry: '0', fresh: false, repeat: null, history: '', error: '' });
  }

  function typeDigit(digit) {
    if (calc.entry === null || calc.fresh) {
      calc.entry = digit;
      calc.fresh = false;
      calc.history = '';
    } else if (calc.entry === '0') {
      calc.entry = digit;
    } else if (calc.entry === '-0') {
      calc.entry = '-' + digit;
    } else if (calc.entry.replace(/\D/g, '').length < 15) {
      calc.entry += digit;
    }
  }

  function typeDot() {
    if (calc.entry === null || calc.fresh) {
      calc.entry = '0.';
      calc.fresh = false;
      calc.history = '';
    } else if (!calc.entry.includes('.')) {
      calc.entry += '.';
    }
  }

  function typeOperator(operator) {
    if (calc.entry === null) {
      calc.tokens[calc.tokens.length - 1] = operator;
    } else {
      calc.tokens.push(Number(calc.entry), operator);
      calc.entry = null;
    }
    calc.fresh = false;
    calc.history = '';
  }

  function backspace() {
    if (calc.entry === null || calc.fresh) return;
    const shorter = calc.entry.slice(0, -1);
    calc.entry = shorter === '' || shorter === '-' ? '0' : shorter;
  }

  function negate() {
    if (calc.entry === null) {
      calc.entry = '-0';
      return;
    }
    calc.entry = calc.entry.startsWith('-') ? calc.entry.slice(1) : '-' + calc.entry;
  }

  /* 200 + 10 % means 10% of 200, as on a phone calculator; otherwise % just divides by 100. */
  function percent() {
    const number = currentNumber();
    const operator = calc.tokens[calc.tokens.length - 1];
    const addsOrSubtracts = operator === '+' || operator === '−';
    const value = addsOrSubtracts ? evaluate(calc.tokens.slice(0, -1)) * number / 100 : number / 100;
    calc.entry = formatResult(value);
    calc.fresh = true;
    calc.repeat = null;
  }

  function equals() {
    let sequence;
    if (calc.tokens.length) {
      sequence = calc.entry === null ? calc.tokens.slice(0, -1) : calc.tokens.concat(Number(calc.entry));
      if (sequence.length >= 3) calc.repeat = sequence.slice(-2);
    } else if (calc.fresh && calc.repeat) {
      sequence = [Number(calc.entry)].concat(calc.repeat); // pressing = again repeats the last step
    } else {
      calc.fresh = true; // nothing to work out, but the next digit still starts a new number
      return;
    }

    const value = evaluate(sequence);
    if (!Number.isFinite(value)) {
      const dividedByZero = sequence.some((token, i) => token === '÷' && sequence[i + 1] === 0);
      const message = dividedByZero ? "Can't divide by 0" : 'Number too large';
      resetCalc();
      calc.error = message;
      return;
    }
    calc.history = sequence.map(showToken).join(' ') + ' =';
    calc.tokens = [];
    calc.entry = formatResult(value);
    calc.fresh = true;
  }

  function pressCalc(key) {
    if (calc.error) {
      resetCalc();
      if (OPERATORS.includes(key) || ['equals', 'percent', 'negate', 'back', 'clear'].includes(key)) {
        renderCalc();
        return;
      }
    }
    if (/^\d$/.test(key)) typeDigit(key);
    else if (key === '.') typeDot();
    else if (OPERATORS.includes(key)) typeOperator(key);
    else if (key === 'equals') equals();
    else if (key === 'back') backspace();
    else if (key === 'negate') negate();
    else if (key === 'percent') percent();
    else if (key === 'clear') resetCalc();
    renderCalc();
  }

  function renderCalc() {
    const value = calc.error || group(calc.entry !== null ? calc.entry : formatResult(currentNumber()));
    const display = $('calc-value');
    display.textContent = value;
    display.classList.toggle('is-medium', value.length > 9 && value.length <= 13);
    display.classList.toggle('is-small', value.length > 13);
    $('calc-expr').textContent = calc.tokens.length ? calc.tokens.map(showToken).join(' ') : calc.history;

    const waitingOn = calc.entry === null ? calc.tokens[calc.tokens.length - 1] : null;
    document.querySelectorAll('.key-op').forEach((button) => {
      if (OPERATORS.includes(button.dataset.key)) {
        button.setAttribute('aria-pressed', String(button.dataset.key === waitingOn));
      }
    });
  }

  $('calc-keys').addEventListener('click', (event) => {
    const button = event.target.closest('[data-key]');
    if (button) pressCalc(button.dataset.key);
  });

  const KEYBOARD = {
    '+': '+', '-': '−', '*': '×', x: '×', X: '×', '/': '÷', '.': '.', ',': '.', '%': 'percent',
    '=': 'equals', Enter: 'equals', Backspace: 'back', Delete: 'clear', Escape: 'clear',
  };

  document.addEventListener('keydown', (event) => {
    if ($('panel-calculator').hidden || event.ctrlKey || event.metaKey || event.altKey) return;
    const button = event.target.closest && event.target.closest('button');
    if (event.key === 'Enter' && button && !button.closest('#panel-calculator')) return;
    const key = /^\d$/.test(event.key) ? event.key : KEYBOARD[event.key];
    if (!key) return;
    event.preventDefault();
    pressCalc(key);
  });

  /* Everything shares one tick, and writes to the page only when something changed. */
  function tick() {
    if (!$('panel-clock').hidden) renderClock(false);
    if (stopwatch.running && !$('panel-stopwatch').hidden) renderStopwatchTime();
    if (timer.state === 'running') {
      if (timerLeft() <= 0) finishTimer();
      else renderTimerProgress();
    }
  }

  const tabs = setupTabs('v3-toolkit-tab', (name) => {
    if (name === 'clock') renderClock(true);
    if (name === 'stopwatch') renderStopwatchTime();
  });

  renderClockFormat();
  renderStopwatch();
  renderTimer();
  renderCalc();
  setInterval(tick, 40);
})();
