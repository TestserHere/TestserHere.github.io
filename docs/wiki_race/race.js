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
  const state = { level: saved0.level === 'hard' ? 'hard' : 'easy' };
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

  async function setEnd(which, title) {
    showEnd(which, null);
    setStatus($('setup-status'), '');
    try {
      const page = await summary(title);
      if (which === 'start') start = page; else target = page;
      showEnd(which, page);
      if (start && target && same(start.title, target.title)) setStatus($('setup-status'), 'Start and target are the same page. Shuffle one of them.', 'problem');
    } catch (_) {
      setStatus($('setup-status'), "Wikipedia isn't answering right now. Try again in a minute.", 'problem');
    }
  }

  async function newStart() {
    if (state.level === 'easy') return setEnd('start', pick(EASY_STARTS.filter((title) => !target || !same(title, target.title))));
    showEnd('start', null);
    try {
      const data = await getJson(WIKI + '/api/rest_v1/page/random/summary');
      start = { title: clean(data.titles ? data.titles.canonical : data.title), desc: data.description || '' };
      showEnd('start', start);
    } catch (_) {
      setStatus($('setup-status'), "Wikipedia isn't answering right now. Try again in a minute.", 'problem');
    }
  }
  const newTarget = () => setEnd('target', pick(TARGETS.filter((title) => !target || !same(title, target.title))));

  const levelButtons = Array.from($('level').querySelectorAll('button'));
  function showLevel() {
    levelButtons.forEach((button) => button.setAttribute('aria-pressed', String(button.dataset.level === state.level)));
  }
  levelButtons.forEach((button) => button.addEventListener('click', () => {
    state.level = button.dataset.level;
    remember();
    showLevel();
    newStart();
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
    race = { start: start.title, target: target.title, clicks: 0, path: [], startedAt: Date.now(), done: false };
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
    newStart();
    newTarget();
  });

  $('go').addEventListener('click', () => {
    if (start && target && !same(start.title, target.title)) begin();
  });

  showLevel();
  newStart();
  newTarget();
})();
