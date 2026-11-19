/* Day in History: Wikipedia's "On this day" for any date, with your birth year picked out. */

(function () {
  'use strict';

  const { $, read, write, el, getJson } = window.V3Tools;
  const { setStatus, itemRow } = window.V3Apps;

  const STATE_KEY = 'v3-history-state';
  const MONTHS = ['January', 'February', 'March', 'April', 'May', 'June', 'July', 'August', 'September', 'October', 'November', 'December'];
  const DAYS_IN = [31, 29, 31, 30, 31, 30, 31, 31, 30, 31, 30, 31];
  const LABELS = { selected: 'highlights', events: 'events', births: 'births', deaths: 'deaths' };
  const THIS_YEAR = new Date().getFullYear();

  const today = new Date();
  const saved0 = read(STATE_KEY, {});
  const state = {
    month: Number.isInteger(saved0.month) ? saved0.month : today.getMonth(),
    day: Number.isInteger(saved0.day) ? saved0.day : today.getDate(),
    year: Number(saved0.year) || '',
    kind: LABELS[saved0.kind] ? saved0.kind : 'selected',
    oldest: !!saved0.oldest,
  };
  const remember = () => write(STATE_KEY, state);

  /* ---------- Date ---------- */

  MONTHS.forEach((name, index) => {
    const option = el('option', '', name);
    option.value = String(index);
    $('month').appendChild(option);
  });

  function showDays() {
    const select = $('day');
    const max = DAYS_IN[state.month];
    state.day = Math.min(state.day, max);
    select.replaceChildren();
    for (let day = 1; day <= max; day++) {
      const option = el('option', '', String(day));
      option.value = String(day);
      select.appendChild(option);
    }
    select.value = String(state.day);
    $('month').value = String(state.month);
  }

  $('month').addEventListener('change', (event) => { state.month = Number(event.target.value); showDays(); load(); });
  $('day').addEventListener('change', (event) => { state.day = Number(event.target.value); load(); });
  $('year').value = state.year;
  let yearTimer = 0;
  $('year').addEventListener('input', (event) => {
    const year = Math.floor(Number(event.target.value));
    state.year = year >= 1 && year <= 2100 ? year : '';
    remember();
    clearTimeout(yearTimer);
    yearTimer = setTimeout(() => { if (data) show(); }, 300);
  });
  $('today').addEventListener('click', () => {
    const now = new Date();
    state.month = now.getMonth();
    state.day = now.getDate();
    showDays();
    load();
  });

  /* ---------- Tabs and filters ---------- */

  const tabs = Array.from(document.querySelectorAll('#kinds [role="tab"]'));
  function showTabs() {
    tabs.forEach((tab) => {
      const on = tab.dataset.tab === state.kind;
      tab.setAttribute('aria-selected', String(on));
      tab.tabIndex = on ? 0 : -1;
    });
    $('panel-list').setAttribute('aria-labelledby', 'tab-' + state.kind);
  }
  tabs.forEach((tab, index) => {
    tab.addEventListener('click', () => { state.kind = tab.dataset.tab; remember(); showTabs(); show(); });
    tab.addEventListener('keydown', (event) => {
      const step = { ArrowRight: 1, ArrowLeft: -1 }[event.key];
      if (!step) return;
      event.preventDefault();
      const next = tabs[(index + step + tabs.length) % tabs.length];
      next.focus();
      next.click();
    });
  });

  function showOrder() {
    $('order').textContent = state.oldest ? 'Oldest first' : 'Newest first';
    $('order').setAttribute('aria-pressed', String(state.oldest));
  }
  $('order').addEventListener('click', () => { state.oldest = !state.oldest; remember(); showOrder(); show(); });
  $('filter').addEventListener('input', () => show());

  /* ---------- Loading ---------- */

  let data = null;
  let token = 0;
  const cache = new Map();

  async function load() {
    remember();
    const mine = ++token;
    const mm = String(state.month + 1).padStart(2, '0');
    const dd = String(state.day).padStart(2, '0');
    $('day-title').textContent = state.day + ' ' + MONTHS[state.month];
    setStatus($('status'), 'Opening the history books…', 'busy');
    $('panel-list').replaceChildren();
    try {
      const key = mm + dd;
      let result = cache.get(key);
      if (!result) {
        result = await getJson('https://en.wikipedia.org/api/rest_v1/feed/onthisday/all/' + mm + '/' + dd);
        cache.set(key, result);
      }
      if (mine !== token) return;
      data = result;
      show();
    } catch (_) {
      if (mine !== token) return;
      data = null;
      setStatus($('status'), "Wikipedia isn't answering right now. Try again in a minute.", 'problem');
    }
  }

  /* ---------- Showing ---------- */

  function entryView(entry, kind) {
    const page = (entry.pages || [])[0] || {};
    const year = entry.year;
    const ago = typeof year === 'number' ? THIS_YEAR - year : null;
    const bits = [];
    if (ago !== null) bits.push(ago === 0 ? 'This year' : ago > 0 ? ago.toLocaleString() + (ago === 1 ? ' year ago' : ' years ago') : '');
    if (state.year && typeof year === 'number' && year !== state.year) {
      const diff = state.year - year;
      bits.push(diff > 0 ? diff + (diff === 1 ? ' year before you were born' : ' years before you were born') : -diff + (diff === -1 ? ' year after you were born' : ' years after you were born'));
    }
    const view = {
      art: page.thumbnail ? page.thumbnail.source : '',
      title: (typeof year === 'number' ? (year < 0 ? -year + ' BC' : String(year)) + ' · ' : '') + labelFor(kind),
      sub: entry.text,
      why: bits.filter(Boolean).join(' · '),
      links: page.content_urls && page.content_urls.desktop ? [{ text: 'Read more', href: page.content_urls.desktop.page }] : [],
    };
    return view;
  }

  const labelFor = (kind) => ({ selected: 'Event', events: 'Event', births: 'Born', deaths: 'Died' }[kind]);

  function show() {
    if (!data) return;
    const words = $('filter').value.trim().toLowerCase();
    let list = (data[state.kind] || []).slice();
    if (words) list = list.filter((entry) => entry.text.toLowerCase().includes(words));
    list.sort((a, b) => (state.oldest ? a.year - b.year : b.year - a.year));

    tabs.forEach((tab) => {
      const count = (data[tab.dataset.tab] || []).length;
      tab.textContent = tab.textContent.replace(/\s\(\d+\)$/, '') + (count ? ' (' + count + ')' : '');
    });

    const box = $('panel-list');
    box.replaceChildren();
    list.slice(0, 200).forEach((entry) => {
      const row = itemRow(entryView(entry, state.kind));
      if (state.year && entry.year === state.year) row.classList.add('is-your-year');
      box.appendChild(row);
    });
    setStatus($('status'), list.length ? '' : words ? 'Nothing matches “' + words + '”.' : 'Nothing listed for this day.');
    showYourYear();
    showHolidays();
  }

  function showYourYear() {
    const box = $('your-year');
    box.replaceChildren();
    if (!state.year || !data) { box.hidden = true; return; }
    const sameYear = ['events', 'births', 'deaths'].flatMap((kind) => (data[kind] || []).filter((entry) => entry.year === state.year).map((entry) => ({ entry, kind })));
    const birthdayMates = (data.births || []).filter((entry) => typeof entry.year === 'number');
    const age = THIS_YEAR - state.year;
    box.appendChild(el('strong', '', state.day + ' ' + MONTHS[state.month] + ' ' + state.year));
    const lines = [];
    if (age >= 0 && age < 130) lines.push(age === 0 ? 'That’s this year!' : 'That was ' + age + (age === 1 ? ' year ago.' : ' years ago.'));
    lines.push(birthdayMates.length + ' famous people share this birthday.');
    lines.push(sameYear.length
      ? sameYear.length + (sameYear.length === 1 ? ' thing on this list happened' : ' things on this list happened') + ' in ' + state.year + '. They’re highlighted below.'
      : 'Nothing on this list happened in ' + state.year + ', but here’s what did on other years.');
    box.appendChild(el('p', '', lines.join(' ')));
    const oldest = birthdayMates.slice().sort((a, b) => Math.abs(a.year - state.year) - Math.abs(b.year - state.year))[0];
    if (oldest) {
      const page = (oldest.pages || [])[0];
      const name = page ? (page.normalizedtitle || page.title || '').replace(/_/g, ' ') : oldest.text.split(',')[0];
      box.appendChild(el('p', 'muted', 'Your closest birthday twin: ' + name + ', born ' + oldest.year + '.'));
    }
    box.hidden = false;
  }

  function showHolidays() {
    const old = document.querySelector('.holidays');
    if (old) old.remove();
    const holidays = (data.holidays || []).map((entry) => entry.text.split(/[(\n]/)[0].trim()).filter(Boolean).slice(0, 6);
    if (!holidays.length) return;
    const line = el('p', 'note holidays', 'Also celebrated: ' + holidays.join(' · '));
    $('day-title').after(line);
  }

  showDays();
  showTabs();
  showOrder();
  load();
})();
