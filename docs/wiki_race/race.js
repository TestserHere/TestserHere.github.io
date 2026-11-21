/* Wiki Race: reach the target page by following links on Wikipedia. */

(function () {
  'use strict';

  const { $, read, write, el, getJson, formatDuration } = window.V3Tools;
  const { setStatus, combobox } = window.V3Apps;

  const WIKI = 'https://en.wikipedia.org';
  const STATE_KEY = 'v3-wikirace-state';
  const BEST_KEY = 'v3-wikirace-best';

  // Well-known pages make fair targets: lots of articles lead to them.
  const TARGETS = [
    'Pizza', 'Moon', 'Albert Einstein', 'Tokyo', 'Association football', 'Dinosaur', 'Mount Everest', 'Coffee',
    'Leonardo da Vinci', 'Olympic Games', 'Chess', 'Great Pyramid of Giza', 'Volcano', 'Shark', 'Guitar', 'Internet',
    'Banana', 'Titanic', 'Penguin', 'Chocolate', 'Napoleon', 'Rainbow', 'Honey bee', 'Black hole', 'The Beatles',
    'Antarctica', 'Electricity', 'Ancient Rome', 'Dragon', 'Bicycle', 'Sydney Opera House', 'Video game', 'Tea',
    'Eiffel Tower', 'Lightning', 'Elephant', 'Amazon rainforest', 'Printing press', 'Vikings', 'Sushi',
  ];
  const EASY_STARTS = [
    'Cheese', 'Kangaroo', 'Jazz', 'Hot air balloon', 'Origami', 'Basketball', 'Lighthouse', 'Volleyball', 'Umbrella',
    'Skateboarding', 'Teddy bear', 'Ice cream', 'Piano', 'Octopus', 'Pirate', 'Robot', 'Castle', 'Tornado', 'Cactus',
    'Bread', 'Circus', 'Snowboarding', 'Sunflower', 'Magic (illusion)', 'Lego',
  ];
  const NOT_ARTICLES = /^(file|image|category|help|wikipedia|wp|template|portal|special|talk|user|draft|module|mediawiki|book|timedtext|media|wikt|wiktionary|commons|meta|s|q|n|v|b|voy|w|m|mw|species|d|wikidata)(\s|_)?(talk)?:/i;
  const CUT_SECTIONS = /^(references|external links|notes|further reading|sources|bibliography|citations|footnotes|explanatory notes|works cited|notes and references)$/i;

  const saved0 = read(STATE_KEY, {});
  const state = { level: ['hard', 'daily'].includes(saved0.level) ? saved0.level : 'easy' };
  const today = window.V3Daily.today();
  const remember = () => write(STATE_KEY, state);

  const clean = (title) => decodeURIComponent(String(title || '')).replace(/_/g, ' ').trim();
  const same = (a, b) => clean(a).toLowerCase() === clean(b).toLowerCase();
  const pick = (list) => list[Math.floor(Math.random() * list.length)];

  /* ---------- Setup ---------- */

  let start = null;
  let target = null;

  async function summary(title) {
    const data = await getJson(WIKI + '/api/rest_v1/page/summary/' + encodeURIComponent(title.replace(/ /g, '_')));
    return { title: clean(data.titles ? data.titles.canonical : data.title), desc: data.description || '' };
  }

  function showEnd(which, page) {
    $(which + '-title').textContent = page ? page.title : '…';
    $(which + '-desc').textContent = page ? page.desc : '';
    $('go').disabled = !(start && target) || same(start.title, target.title);
  }

  const asked = { start: 0, target: 0 }; // only the newest request for each end counts
  async function setEnd(which, title) {
    const mine = ++asked[which];
    if (which === 'start') start = null; else target = null;
    showEnd(which, null);
    setStatus($('setup-status'), '');
    try {
      const page = await summary(title);
      if (mine !== asked[which]) return;
      if (which === 'start') start = page; else target = page;
      showEnd(which, page);
      if (start && target && same(start.title, target.title)) setStatus($('setup-status'), 'Start and target are the same page. Shuffle one of them.', 'problem');
    } catch (_) {
      setStatus($('setup-status'), "Wikipedia isn't answering right now. Try again in a minute.", 'problem');
    }
  }

  /* The daily race: the same start and target for everyone today. */
  function setDaily() {
    const random = window.V3Daily.rng('wikirace-' + today);
    const from = window.V3Daily.pick(EASY_STARTS, random);
    const to = window.V3Daily.pick(TARGETS.filter((t) => !same(t, from)), random);
    start = null;
    target = null;
    setEnd('start', from);
    setEnd('target', to);
  }

  function showDaily() {
    const daily = state.level === 'daily';
    $('setup').classList.toggle('is-daily', daily);
    $('daily-note').hidden = !daily;
    if (daily) {
      const done = read(BEST_KEY, {})['daily ' + today];
      $('daily-note').textContent = 'Today’s race, ' + window.V3Daily.label(today) + '. Everyone gets the same one.'
        + (done ? ' You did it in ' + done.clicks + (done.clicks === 1 ? ' click' : ' clicks') + '. Try to beat it!' : '');
    }
  }

  async function newStart() {
    if (state.level === 'daily') return setDaily();
    if (state.level === 'easy') return setEnd('start', pick(EASY_STARTS.filter((title) => !target || !same(title, target.title))));
    const mine = ++asked.start;
    start = null;
    showEnd('start', null);
    try {
      const data = await getJson(WIKI + '/api/rest_v1/page/random/summary');
      if (mine !== asked.start) return;
      start = { title: clean(data.titles ? data.titles.canonical : data.title), desc: data.description || '' };
      showEnd('start', start);
    } catch (_) {
      setStatus($('setup-status'), "Wikipedia isn't answering right now. Try again in a minute.", 'problem');
    }
  }
  const newTarget = () => state.level === 'daily' ? null : setEnd('target', pick(TARGETS.filter((title) => !target || !same(title, target.title))));

  const levelButtons = Array.from($('level').querySelectorAll('button'));
  function showLevel() {
    levelButtons.forEach((button) => button.setAttribute('aria-pressed', String(button.dataset.level === state.level)));
  }
  levelButtons.forEach((button) => button.addEventListener('click', () => {
    const wasDaily = state.level === 'daily';
    state.level = button.dataset.level;
    remember();
    showLevel();
    showDaily();
    newStart();
    if (wasDaily) newTarget(); // leave today's target behind too
  }));

  $('start-new').addEventListener('click', newStart);
  $('target-new').addEventListener('click', newTarget);

  function pageSearch(which) {
    combobox({
      input: $(which + '-search'),
      list: $(which + '-list'),
      async search(query) {
        const data = await getJson(WIKI + '/w/rest.php/v1/search/title?limit=6&q=' + encodeURIComponent(query));
        return (data.pages || []).map((page) => ({
          title: page.title,
          desc: page.description || '',
          art: page.thumbnail && page.thumbnail.url ? 'https:' + page.thumbnail.url.replace(/^https?:/, '') : '',
        }));
      },
      describe: (page) => ({ title: page.title, sub: page.desc, art: page.art }),
      onPick: (page) => setEnd(which, page.title),
    });
  }
  pageSearch('start');
  pageSearch('target');

  /* ---------- Reading articles ---------- */

  const KEEP = new Set(['P', 'A', 'B', 'I', 'EM', 'STRONG', 'UL', 'OL', 'LI', 'H2', 'H3', 'H4', 'TABLE', 'THEAD', 'TBODY', 'TR', 'TD', 'TH',
    'CAPTION', 'IMG', 'FIGURE', 'FIGCAPTION', 'SECTION', 'DIV', 'SPAN', 'BLOCKQUOTE', 'DL', 'DT', 'DD', 'SUB', 'SUP', 'BR', 'ABBR',
    'SMALL', 'CITE', 'Q', 'S', 'U', 'CODE', 'PRE']);
  const DROP = 'script, style, link, meta, base, noscript, iframe, object, embed, form, input, button, textarea, select, audio, video, svg, math, ' +
    'sup.mw-ref, sup.reference, .mw-references-wrap, .reflist, .navbox, .navbox-styles, .metadata, .mw-editsection, .ambox, .mbox-small, ' +
    '.noprint, .mw-empty-elt, .sistersitebox, .side-box, [typeof="mw:Extension/templatestyles"], .mw-kartographer-maplink';

  /* Turns Wikipedia's HTML into a safe copy where only article links work. */
  function prepare(html) {
    const doc = new DOMParser().parseFromString(html, 'text/html');
    const version = doc.querySelector('link[rel="dc:isVersionOf"]');
    const title = version ? clean(version.getAttribute('href').split('/wiki/')[1]) : clean(doc.title);
    const body = doc.body;
    body.querySelectorAll(DROP).forEach((node) => node.remove());
    body.querySelectorAll('section').forEach((section) => {
      const heading = section.querySelector(':scope > h2, :scope > .mw-heading > h2');
      if (heading && CUT_SECTIONS.test(heading.textContent.trim())) section.remove();
    });

    const all = Array.from(body.querySelectorAll('*'));
    all.forEach((node) => {
      if (!node.isConnected) return;
      if (!KEEP.has(node.tagName)) {
        node.replaceWith(...node.childNodes);
        return;
      }
      const attrs = {};
      if (node.tagName === 'A') {
        const href = node.getAttribute('href') || '';
        const rel = node.getAttribute('rel') || '';
        const page = href.startsWith('./') ? clean(href.slice(2).split('#')[0].split('?')[0]) : '';
        if (!/mw:WikiLink/.test(rel) || !page || NOT_ARTICLES.test(page) || node.classList.contains('new')) {
          node.replaceWith(...node.childNodes);
          return;
        }
        attrs.href = '#';
        attrs['data-to'] = page;
      } else if (node.tagName === 'IMG') {
        const src = node.getAttribute('src') || '';
        if (!/^(https:)?\/\/upload\.wikimedia\.org\//.test(src)) { node.remove(); return; }
        attrs.src = src.startsWith('//') ? 'https:' + src : src;
        attrs.alt = node.getAttribute('alt') || '';
        attrs.loading = 'lazy';
        const width = Number(node.getAttribute('width'));
        if (width) attrs.width = String(Math.min(width, 320));
      } else if (node.tagName === 'TD' || node.tagName === 'TH') {
        ['colspan', 'rowspan'].forEach((name) => { if (node.hasAttribute(name)) attrs[name] = node.getAttribute(name); });
      } else if (node.tagName === 'TABLE' && /infobox/.test(node.className)) {
        attrs.class = 'infobox';
      }
      Array.from(node.attributes).forEach((attr) => node.removeAttribute(attr.name));
      Object.entries(attrs).forEach(([name, value]) => node.setAttribute(name, value));
    });

    const fragment = document.createDocumentFragment();
    Array.from(body.childNodes).forEach((node) => fragment.appendChild(document.importNode(node, true)));
    return { title, fragment };
  }

  /* ---------- Racing ---------- */

  let race = null;
  let timer = 0;
  let loadToken = 0;

  function begin() {
    race = { start: start.title, target: target.title, clicks: 0, path: [], startedAt: Date.now(), done: false, daily: state.level === 'daily' };
    $('setup').hidden = true;
    $('race').hidden = false;
    $('win').hidden = true;
    $('quit').textContent = 'Give up';
    $('race-target').textContent = target.title;
    $('clicks').textContent = '0';
    clearInterval(timer);
    timer = setInterval(tick, 1000);
    tick();
    open(start.title, false);
  }

  function tick() {
    if (!race || race.done) return;
    $('time').textContent = formatDuration(Math.floor((Date.now() - race.startedAt) / 1000));
  }

  async function open(title, counts) {
    const mine = ++loadToken;
    setStatus($('race-status'), 'Loading ' + title + '…', 'busy');
    $('article').classList.add('is-loading');
    try {
      const response = await fetch(WIKI + '/api/rest_v1/page/html/' + encodeURIComponent(title.replace(/ /g, '_')));
      if (!response.ok) throw new Error('HTTP ' + response.status);
      const page = prepare(await response.text());
      if (mine !== loadToken) return;
      if (counts) {
        race.clicks++;
        $('clicks').textContent = String(race.clicks);
      }
      race.path.push(page.title);
      $('back').disabled = race.path.length < 2 || race.done;
      showArticle(page);
      setStatus($('race-status'), '');
      if (same(page.title, race.target)) finish(true);
    } catch (_) {
      if (mine === loadToken) setStatus($('race-status'), "That page didn't load. Try another link.", 'problem');
    } finally {
      if (mine === loadToken) $('article').classList.remove('is-loading');
    }
  }

  function showArticle(page) {
    const article = $('article');
    const heading = el('h2', 'wiki-title', page.title);
    const source = el('p', 'wiki-source');
    const link = el('a', '', 'Read “' + page.title + '” on Wikipedia');
    link.href = WIKI + '/wiki/' + encodeURIComponent(page.title.replace(/ /g, '_'));
    link.target = '_blank';
    link.rel = 'noopener';
    source.append(link, ' · CC BY-SA');
    article.replaceChildren(heading, page.fragment, source);
    $('race-bar').scrollIntoView({ block: 'start' });
  }

  $('article').addEventListener('click', (event) => {
    const link = event.target.closest('a[data-to]');
    if (!link || !race || race.done) return;
    event.preventDefault();
    open(link.dataset.to, true);
  });

  $('back').addEventListener('click', () => {
    if (!race || race.path.length < 2) return;
    race.path.pop();
    const previous = race.path.pop();
    open(previous, true);
  });

  function finish(won) {
    race.done = true;
    clearInterval(timer);
    $('quit').textContent = 'Leave';
    $('back').disabled = true;
    const seconds = Math.floor((Date.now() - race.startedAt) / 1000);
    $('win-title').textContent = won ? 'You made it!' : 'Race over';
    let text = won
      ? 'From ' + race.start + ' to ' + race.target + ' in ' + race.clicks + (race.clicks === 1 ? ' click' : ' clicks') + ' and ' + formatDuration(seconds) + '.'
      : 'The target was ' + race.target + '.';
    if (won) {
      const best = read(BEST_KEY, {});
      const key = race.start.toLowerCase() + '→' + race.target.toLowerCase();
      const old = best[key];
      if (race.daily) {
        const day = best['daily ' + today];
        if (!day || race.clicks < day.clicks || (race.clicks === day.clicks && seconds < day.seconds)) best['daily ' + today] = { clicks: race.clicks, seconds };
        Object.keys(best).filter((k) => k.startsWith('daily ') && k < 'daily ' + today).sort().slice(0, -30).forEach((k) => delete best[k]);
        write(BEST_KEY, best);
      }
      if (!old || race.clicks < old.clicks || (race.clicks === old.clicks && seconds < old.seconds)) {
        best[key] = { clicks: race.clicks, seconds };
        write(BEST_KEY, best);
        if (old) text += ' New best for this race!';
      } else {
        text += ' Your best here is ' + old.clicks + ' clicks.';
      }
    }
    $('win-text').textContent = text;
    const path = $('win-path');
    path.replaceChildren();
    race.path.forEach((title) => path.appendChild(el('li', '', title)));
    race.seconds = seconds;
    race.won = won;
    $('share').hidden = !(won && race.daily);
    $('route-check').hidden = false;
    $('route-check').disabled = false;
    $('route-result').textContent = '';
    $('again').textContent = race.daily ? 'Back' : 'New race';
    $('win').hidden = false;
    $('win').scrollIntoView({ behavior: 'smooth', block: 'center' });
  }

  $('quit').addEventListener('click', () => {
    if (!race) return;
    if (race.done) { backToSetup(); return; }
    finish(false);
  });

  function backToSetup() {
    loadToken++;
    race = null;
    clearInterval(timer);
    $('race').hidden = true;
    $('setup').hidden = false;
    $('article').replaceChildren();
    window.scrollTo({ top: 0 });
  }

  $('again').addEventListener('click', () => {
    backToSetup();
    showDaily();
    if (state.level === 'daily') return;
    newStart();
    newTarget();
  });

  $('share').addEventListener('click', async () => {
    if (!race) return;
    const text = 'Wiki Race daily, ' + window.V3Daily.label(today) + ': ' + race.start + ' to ' + race.target + ' in '
      + race.clicks + (race.clicks === 1 ? ' click' : ' clicks') + ' (' + formatDuration(race.seconds) + ')\n' + location.href.split('?')[0];
    $('share').textContent = (await window.V3Daily.share(text)) ? 'Copied!' : 'Couldn’t copy';
    setTimeout(() => { $('share').textContent = 'Copy result'; }, 2000);
  });

  /* ---------- Shortest route ----------
     Every route of 1 or 2 clicks is checked fully. For 3 clicks the middle step is tried through pages the
     target links to that also link back to it, which is where nearly all short routes go. Wikipedia's API is
     asked at most MAX_ASKS times. */
  const API = WIKI + '/w/api.php';
  const MAX_ASKS = 140;

  async function routeCheck(from, to) {
    let asks = 0;
    const ask = async (params) => {
      if (++asks > MAX_ASKS) throw new Error('too many');
      const query = new URLSearchParams(Object.assign({ action: 'query', format: 'json', formatversion: '2', origin: '*' }, params));
      return getJson(API + '?' + query, 15000);
    };
    // All article links on a page (up to a few thousand).
    async function linksOf(title, parts) {
      const out = [];
      let more = {};
      for (let i = 0; i < parts; i++) {
        const data = await ask(Object.assign({ prop: 'links', titles: title, redirects: '1', plnamespace: '0', pllimit: 'max' }, more));
        (data.query && data.query.pages || []).forEach((p) => (p.links || []).forEach((l) => out.push(l.title)));
        if (!data.continue) break;
        more = data.continue;
      }
      return out;
    }
    // Which of these pages link to any of those titles? Answers come as [page, linked title].
    async function linking(pages, titles) {
      const found = [];
      const jobs = [];
      for (let i = 0; i < pages.length; i += 50) {
        for (let j = 0; j < titles.length; j += 50) jobs.push([pages.slice(i, i + 50), titles.slice(j, j + 50)]);
      }
      let next = 0;
      async function worker() {
        while (next < jobs.length && !found.length) {
          const [p, t] = jobs[next++];
          let more = {};
          for (let k = 0; k < 4; k++) {
            const data = await ask(Object.assign({ prop: 'links', titles: p.join('|'), pltitles: t.join('|'), pllimit: 'max', redirects: '1' }, more));
            (data.query && data.query.pages || []).forEach((page) => (page.links || []).forEach((l) => found.push([page.title, l.title])));
            if (!data.continue) break;
            more = data.continue;
          }
        }
      }
      await Promise.all([1, 2, 3, 4, 5].map(worker));
      return found;
    }

    // The target and the names that redirect to it.
    const named = await ask({ prop: 'redirects', titles: to, redirects: '1', rdnamespace: '0', rdlimit: 'max' });
    const page = (named.query && named.query.pages || [])[0] || {};
    const targetNames = [page.title || to].concat((page.redirects || []).map((r) => r.title)).slice(0, 50);
    const isTarget = (t) => targetNames.some((n) => same(n, t));

    const first = Array.from(new Set(await linksOf(from, 8)));
    if (first.some(isTarget)) return [from, to];
    const two = await linking(first, targetNames);
    if (two.length) return [from, two[0][0], to];

    const back = (await linking(Array.from(new Set(await linksOf(to, 4))).filter((t) => !isTarget(t)), targetNames)).map((f) => f[0]);
    const middles = Array.from(new Set(back));
    const three = await linking(first, middles);
    if (three.length) return [from, three[0][0], three[0][1], to];
    return null;
  }

  $('route-check').addEventListener('click', async () => {
    if (!race) return;
    const mine = race;
    $('route-check').disabled = true;
    $('route-result').textContent = 'Looking for the shortest route…';
    let text;
    try {
      const route = await routeCheck(mine.start, mine.target);
      if (route) {
        const clicks = route.length - 1;
        text = 'Shortest: ' + clicks + (clicks === 1 ? ' click' : ' clicks') + ', ' + route.join(' → ') + '.';
        if (mine.won) text += mine.clicks <= clicks ? ' You found a shortest route!' : ' You took ' + mine.clicks + '.';
      } else {
        text = 'There’s no route in 3 clicks or fewer that we could find, so it takes at least 4.'
          + (mine.won && mine.clicks <= 4 ? ' Your ' + mine.clicks + ' is excellent!' : '');
      }
      text += ' Some links may be in boxes at the bottom of the page.';
    } catch (_) {
      text = 'Couldn’t finish checking. This race has a lot of links, or Wikipedia is busy.';
    }
    if (race === mine) {
      $('route-result').textContent = text;
      $('route-check').hidden = true;
    }
  });

  $('go').addEventListener('click', () => {
    if (start && target && !same(start.title, target.title)) begin();
  });

  showLevel();
  showDaily();
  newStart();
  newTarget();
})();

/* Keyboard shortcuts */
window.V3Keys.add([
  { keys: ['b', 'Backspace'], label: 'B or Backspace', does: 'Go back a page', press: '#back' },
  { keys: ['Enter'], label: 'Enter', does: 'Start the race or a new one', press: ['#go', '#again'] },
  { keys: ['s'], label: 'S', does: 'Shuffle the start page', press: '#start-new' },
  { keys: ['t'], label: 'T', does: 'Shuffle the target page', press: '#target-new' },
]);
