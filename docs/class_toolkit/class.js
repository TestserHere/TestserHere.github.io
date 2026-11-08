/* Class Toolkit: class lists, name picker, random groups and seating plans */

(function () {
  'use strict';

  const { $, read, write, el, setupTabs, setupStepper } = window.V3Tools;

  const STORE_KEY = 'v3-class-toolkit';
  const MAX_SEAT_LINES = 10;
  const MAX_PICK_HISTORY = 200;
  const reducedMotion = window.matchMedia('(prefers-reduced-motion: reduce)').matches;

  const uid = () => Date.now().toString(36) + Math.random().toString(36).slice(2, 7);
  const stringList = (value) => (Array.isArray(value) ? value.filter((item) => typeof item === 'string') : []);
  const count = (number, word) => number + ' ' + word + (number === 1 ? '' : 's');

  function today() {
    const now = new Date();
    return now.getFullYear() + '-' + (now.getMonth() + 1) + '-' + now.getDate();
  }

  function shuffled(list) {
    const copy = list.slice();
    for (let i = copy.length - 1; i > 0; i -= 1) {
      const j = Math.floor(Math.random() * (i + 1));
      [copy[i], copy[j]] = [copy[j], copy[i]];
    }
    return copy;
  }

  function blankClass(name) {
    return {
      id: uid(), name, students: [], absentOn: '', absent: [], picked: [], lastPick: '',
      groups: [], groupMode: 'count', groupValue: 4, rows: 5, cols: 6, seats: {},
    };
  }

  /* Saved data is checked field by field, so an old or damaged copy can't break the app. */
  function cleanClass(saved) {
    const fresh = blankClass('My class');
    if (!saved || typeof saved !== 'object') return fresh;
    const lines = (value, fallback) => (Number.isInteger(value) && value >= 1 && value <= MAX_SEAT_LINES ? value : fallback);
    const item = {
      id: typeof saved.id === 'string' ? saved.id : fresh.id,
      name: typeof saved.name === 'string' && saved.name ? saved.name : fresh.name,
      students: stringList(saved.students),
      absentOn: typeof saved.absentOn === 'string' ? saved.absentOn : '',
      absent: stringList(saved.absent),
      picked: stringList(saved.picked),
      lastPick: typeof saved.lastPick === 'string' ? saved.lastPick : '',
      groups: Array.isArray(saved.groups) ? saved.groups.map(stringList) : [],
      groupMode: saved.groupMode === 'size' ? 'size' : 'count',
      groupValue: Number.isInteger(saved.groupValue) && saved.groupValue >= 2 ? saved.groupValue : fresh.groupValue,
      rows: lines(saved.rows, fresh.rows),
      cols: lines(saved.cols, fresh.cols),
      seats: saved.seats && typeof saved.seats === 'object' ? saved.seats : {},
    };
    prune(item);
    return item;
  }

  /* Removes anyone who is no longer in the class from picks, groups and seats. */
  function prune(item) {
    const known = new Set(item.students);
    const seats = {};
    Object.keys(item.seats).forEach((key) => {
      const [row, col] = key.split('-').map(Number);
      const name = item.seats[key];
      if (known.has(name) && row < item.rows && col < item.cols) seats[key] = name;
    });
    item.seats = seats;
    item.picked = item.picked.filter((name) => known.has(name));
    if (!known.has(item.lastPick)) item.lastPick = '';
    item.absent = item.absent.filter((name) => known.has(name));
    item.groups = item.groups.map((members) => members.filter((name) => known.has(name))).filter((members) => members.length);
  }

  function load() {
    const saved = read(STORE_KEY, null);
    const classes = saved && Array.isArray(saved.classes) && saved.classes.length
      ? saved.classes.map(cleanClass)
      : [blankClass('My class')];
    const current = saved && classes.some((item) => item.id === saved.current) ? saved.current : classes[0].id;
    return { current, classes, noRepeat: !saved || saved.noRepeat !== false };
  }

  const data = load();
  const current = () => data.classes.find((item) => item.id === data.current);
  const save = () => write(STORE_KEY, data);

  function absentNames() {
    const item = current();
    if (item.absentOn !== today()) {
      item.absentOn = today();
      item.absent = [];
    }
    return item.absent;
  }

  const isAbsent = (name) => absentNames().includes(name);
  const present = () => current().students.filter((name) => !isAbsent(name));

  /* Students */
  function parseNames(text) {
    const pieces = text.includes('\n') ? text.split('\n') : text.split(',');
    const seen = new Set();
    const names = [];
    let duplicates = 0;
    pieces.map((piece) => piece.trim()).filter(Boolean).forEach((name) => {
      const key = name.toLowerCase();
      if (seen.has(key)) {
        duplicates += 1;
      } else {
        seen.add(key);
        names.push(name);
      }
    });
    return { names, duplicates };
  }

  function renderStudentCount(duplicates) {
    $('student-count').textContent = count(current().students.length, 'student');
    const note = $('duplicate-note');
    note.hidden = !duplicates;
    note.textContent = duplicates
      ? 'Left out ' + count(duplicates, 'repeated name') + '. If two students share a name, add a last initial to tell them apart.'
      : '';
  }

  function renderAbsent() {
    const item = current();
    $('absent-group').hidden = item.students.length === 0;
    $('absent-chips').replaceChildren(...item.students.map((name) => {
      const chip = el('button', 'chip' + (isAbsent(name) ? ' is-absent' : ''), name);
      chip.type = 'button';
      chip.setAttribute('aria-pressed', String(isAbsent(name)));
      chip.addEventListener('click', () => {
        const absent = absentNames();
        item.absent = absent.includes(name) ? absent.filter((other) => other !== name) : absent.concat(name);
        save();
        renderAbsent();
      });
      return chip;
    }));
  }

  function renderClassSelect() {
    $('class-select').replaceChildren(...data.classes.map((item) => {
      const option = el('option', '', item.name);
      option.value = item.id;
      return option;
    }));
    $('class-select').value = data.current;
  }

  function renderStudents() {
    const item = current();
    $('class-name').value = item.name;
    $('class-students').value = item.students.join('\n');
    renderStudentCount(0);
    renderAbsent();
  }

  function switchClass(id) {
    data.current = id;
    selection = null;
    previousSeats = null;
    save();
    renderClassSelect();
    renderStudents();
    renderActiveTool();
  }

  $('class-select').addEventListener('change', (event) => switchClass(event.target.value));

  $('class-new').addEventListener('click', () => {
    const item = blankClass('Class ' + (data.classes.length + 1));
    data.classes.push(item);
    switchClass(item.id);
    tabs.show('class');
    $('class-name').select();
  });

  $('class-name').addEventListener('input', (event) => {
    current().name = event.target.value;
    save();
    const option = $('class-select').selectedOptions[0];
    if (option) option.textContent = event.target.value || 'Untitled class';
  });

  $('class-name').addEventListener('change', (event) => {
    if (event.target.value.trim()) return;
    current().name = 'Untitled class';
    event.target.value = current().name;
    save();
    renderClassSelect();
  });

  // Saved on every keystroke, but seats and groups are only updated once typing is finished,
  // so that correcting a name halfway doesn't throw that student out of their seat.
  $('class-students').addEventListener('input', (event) => {
    const { names, duplicates } = parseNames(event.target.value);
    current().students = names;
    save();
    renderStudentCount(duplicates);
  });

  $('class-students').addEventListener('change', () => {
    prune(current());
    save();
    renderAbsent();
  });

  $('class-delete').addEventListener('click', () => {
    const item = current();
    if (!window.confirm('Delete "' + item.name + '" and its seating plan? This can\'t be undone.')) return;
    data.classes = data.classes.filter((other) => other !== item);
    if (!data.classes.length) data.classes.push(blankClass('My class'));
    switchClass(data.classes[0].id);
  });

  document.querySelectorAll('[data-go]').forEach((button) => {
    button.addEventListener('click', () => tabs.show(button.dataset.go));
  });

  /* Name picker */
  let picking = false;

  function pickPool() {
    const people = present();
    if (!data.noRepeat) return people;
    const picked = current().picked;
    return people.filter((name) => !picked.includes(name));
  }

  function setPickName(text, idle) {
    $('pick-name').textContent = text;
    $('pick-name').classList.toggle('is-idle', idle);
  }

  function renderPicker() {
    const item = current();
    const none = present().length === 0;
    $('picker-empty').hidden = !none;
    $('picker-body').hidden = none;
    if (none) return;

    const finished = pickPool().length === 0;
    $('pick-no-repeat').checked = data.noRepeat;
    $('pick-button').textContent = finished ? 'Start over' : 'Pick a name';
    if (!picking) {
      if (finished) setPickName("Everyone's had a turn", true);
      else if (item.lastPick) setPickName(item.lastPick, false);
      else setPickName('Who will it be?', true);
    }

    $('picked-group').hidden = item.picked.length === 0;
    $('picked-chips').replaceChildren(...item.picked.slice().reverse().map((name) => el('span', 'chip chip-static', name)));
  }

  function resetPicks() {
    current().picked = [];
    current().lastPick = '';
    save();
    renderPicker();
  }

  function commitPick(name) {
    const item = current();
    item.picked = item.picked.concat(name).slice(-MAX_PICK_HISTORY);
    item.lastPick = name;
    save();
    picking = false;
    $('pick-name').removeAttribute('aria-busy');
    renderPicker();
  }

  function choosePick() {
    const pool = pickPool();
    const last = current().lastPick;
    const options = pool.length > 1 ? pool.filter((name) => name !== last) : pool;
    return options[Math.floor(Math.random() * options.length)];
  }

  $('pick-button').addEventListener('click', () => {
    if (picking) return;
    if (pickPool().length === 0) {
      resetPicks();
      return;
    }
    const winner = choosePick();
    if (reducedMotion) {
      commitPick(winner);
      return;
    }
    picking = true;
    $('pick-name').setAttribute('aria-busy', 'true');
    const faces = shuffled(present());
    let step = 0;
    const roll = setInterval(() => {
      setPickName(faces[step % faces.length], false);
      step += 1;
      if (step < 14) return;
      clearInterval(roll);
      commitPick(winner);
    }, 65);
  });

  $('pick-reset').addEventListener('click', () => {
    if (!picking) resetPicks();
  });

  $('pick-no-repeat').addEventListener('change', (event) => {
    data.noRepeat = event.target.checked;
    save();
    renderPicker();
  });

  /* Groups */
  function groupLimit() {
    return Math.max(2, present().length);
  }

  const refreshGroupStepper = setupStepper($('group-stepper'), {
    read: () => ({ value: Math.min(current().groupValue, groupLimit()), min: 2, max: groupLimit() }),
    write: (value) => {
      current().groupValue = value;
      save();
    },
  });

  function renderGroups() {
    const item = current();
    const tooFew = present().length < 2;
    $('groups-empty').hidden = !tooFew;
    $('groups-body').hidden = tooFew;

    document.querySelectorAll('[data-mode]').forEach((button) => {
      button.setAttribute('aria-pressed', String(button.dataset.mode === item.groupMode));
    });
    $('group-size-label').textContent = item.groupMode === 'count' ? 'Groups' : 'People in each group';
    refreshGroupStepper();

    $('groups-copy').disabled = item.groups.length === 0;
    $('groups-copy').textContent = 'Copy';
    $('group-cards').replaceChildren(...item.groups.map((members, index) => {
      const card = el('article', 'group-card');
      const list = el('ul');
      list.append(...members.map((name) => el('li', isAbsent(name) ? 'is-absent' : '', name)));
      card.append(el('h3', '', 'Group ' + (index + 1)), list);
      return card;
    }));
  }

  document.querySelectorAll('[data-mode]').forEach((button) => {
    button.addEventListener('click', () => {
      current().groupMode = button.dataset.mode;
      save();
      renderGroups();
    });
  });

  $('groups-make').addEventListener('click', () => {
    const item = current();
    const people = shuffled(present());
    const value = Math.min(item.groupValue, groupLimit());
    const total = item.groupMode === 'count' ? value : Math.ceil(people.length / value);
    const groups = Array.from({ length: total }, () => []);
    people.forEach((name, index) => groups[index % total].push(name));
    item.groups = groups;
    save();
    renderGroups();
  });

  function copyText(text) {
    if (navigator.clipboard && window.isSecureContext) {
      return navigator.clipboard.writeText(text);
    }
    return new Promise((resolve, reject) => {
      const box = el('textarea');
      box.value = text;
      box.className = 'sr-only';
      document.body.appendChild(box);
      box.select();
      const copied = document.execCommand('copy');
      box.remove();
      if (copied) resolve();
      else reject(new Error('copy failed'));
    });
  }

  $('groups-copy').addEventListener('click', () => {
    const button = $('groups-copy');
    const text = current().groups.map((members, index) => 'Group ' + (index + 1) + ': ' + members.join(', ')).join('\n');
    copyText(text)
      .then(() => { button.textContent = 'Copied'; })
      .catch(() => { button.textContent = "Couldn't copy"; });
  });

  /* Seating plan */
  let selection = null; // { seat: 'row-col' } or { name: 'Student' }
  let previousSeats = null;

  const seatKey = (row, col) => row + '-' + col;
  const seatedNames = () => new Set(Object.values(current().seats));
  const unseated = () => current().students.filter((name) => !seatedNames().has(name));

  const stepperOptions = (field) => ({
    read: () => ({ value: current()[field], min: 1, max: MAX_SEAT_LINES }),
    write: (value) => {
      current()[field] = value;
      prune(current());
      selection = null;
      save();
      renderSeating();
    },
  });

  const refreshRows = setupStepper($('rows-stepper'), stepperOptions('rows'));
  const refreshCols = setupStepper($('cols-stepper'), stepperOptions('cols'));

  function tapSeat(key) {
    const item = current();
    const occupant = item.seats[key];
    if (selection && selection.seat === key) {
      selection = null;
    } else if (selection && selection.seat) {
      const moving = item.seats[selection.seat];
      if (occupant) item.seats[selection.seat] = occupant;
      else delete item.seats[selection.seat];
      item.seats[key] = moving;
      selection = null;
      previousSeats = null;
    } else if (selection && selection.name) {
      item.seats[key] = selection.name; // anyone already here joins the "without a seat" list
      selection = null;
      previousSeats = null;
    } else if (occupant) {
      selection = { seat: key };
    }
    save();
    renderSeating();
  }

  function seatButton(key) {
    const item = current();
    const name = item.seats[key];
    const classes = ['seat'];
    if (name) classes.push('has-name');
    if (name && isAbsent(name)) classes.push('is-absent');
    const button = el('button', classes.join(' '), name || '');
    button.type = 'button';
    button.dataset.seat = key;
    button.setAttribute('aria-pressed', String(Boolean(selection && selection.seat === key)));
    const [row, col] = key.split('-').map(Number);
    const place = 'Row ' + (row + 1) + ', column ' + (col + 1);
    button.setAttribute('aria-label', name ? name + (isAbsent(name) ? ' (away)' : '') + ', ' + place : 'Empty seat, ' + place);
    button.addEventListener('click', () => tapSeat(key));
    return button;
  }

  function renderSeating() {
    const item = current();
    const none = item.students.length === 0;
    $('seating-empty').hidden = !none;
    $('seating-body').hidden = none;
    refreshRows();
    refreshCols();
    if (none) return;

    const focused = document.activeElement && document.activeElement.dataset ? document.activeElement.dataset.seat : null;
    const seats = [];
    for (let row = 0; row < item.rows; row += 1) {
      for (let col = 0; col < item.cols; col += 1) seats.push(seatButton(seatKey(row, col)));
    }
    $('seats').style.setProperty('--cols', item.cols);
    $('seats').replaceChildren(...seats);
    if (focused) {
      const again = $('seats').querySelector('[data-seat="' + focused + '"]');
      if (again) again.focus();
    }

    const missing = unseated();
    const shortBy = item.students.length - item.rows * item.cols;
    const warning = $('seats-warning');
    warning.hidden = shortBy <= 0;
    warning.textContent = shortBy > 0 ? 'There are ' + count(shortBy, 'more student') + ' than seats. Add rows or columns to fit everyone.' : '';

    $('unseated-group').hidden = missing.length === 0;
    $('unseated-chips').replaceChildren(...missing.map((name) => {
      const chip = el('button', 'chip', name);
      chip.type = 'button';
      chip.setAttribute('aria-pressed', String(Boolean(selection && selection.name === name)));
      chip.addEventListener('click', () => {
        selection = selection && selection.name === name ? null : { name };
        renderSeating();
      });
      return chip;
    }));

    $('seats-undo').disabled = !previousSeats;
    $('seats-clear').disabled = Object.keys(item.seats).length === 0;
  }

  function replaceSeats(seats) {
    previousSeats = Object.assign({}, current().seats);
    current().seats = seats;
    selection = null;
    save();
    renderSeating();
  }

  $('seats-shuffle').addEventListener('click', () => {
    const item = current();
    const people = shuffled(item.students);
    const seats = {};
    let next = 0;
    for (let row = 0; row < item.rows; row += 1) {
      for (let col = 0; col < item.cols && next < people.length; col += 1) {
        seats[seatKey(row, col)] = people[next];
        next += 1;
      }
    }
    replaceSeats(seats);
  });

  $('seats-clear').addEventListener('click', () => replaceSeats({}));

  $('seats-undo').addEventListener('click', () => {
    if (!previousSeats) return;
    const item = current();
    item.seats = previousSeats;
    prune(item);
    previousSeats = null;
    selection = null;
    save();
    renderSeating();
  });

  $('seats-print').addEventListener('click', () => window.print());

  /* Each tool draws itself when opened, so it always reflects the latest class list. */
  let activeTool = 'class';

  function renderActiveTool() {
    if (activeTool === 'picker') renderPicker();
    if (activeTool === 'groups') renderGroups();
    if (activeTool === 'seating') renderSeating();
  }

  renderClassSelect();
  renderStudents();

  const tabs = setupTabs('v3-class-toolkit-tab', (name) => {
    activeTool = name;
    renderActiveTool();
  });

  if (!current().students.length) tabs.show('class');
})();
