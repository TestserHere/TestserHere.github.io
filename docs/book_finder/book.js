/* Book Finder: books that share subjects with ones you liked, from Open Library. */

(function () {
  'use strict';

  const { $, read, write, el, setupTabs, getJson } = window.V3Tools;
  const { norm, listNames, setStatus, choose, savedList, combobox, renderSeeds, itemRow } = window.V3Apps;

  const STATE_KEY = 'v3-books-state';
  const MAX_SEEDS = 3;
  const OL = 'https://openlibrary.org';

  const SUBJECTS = [
    'Fantasy', 'Science fiction', 'Mystery', 'Thriller', 'Romance', 'Horror', 'Historical fiction', 'Adventure',
    'Humor', 'Young adult fiction', 'Graphic novels', 'Classics', 'Biography', 'History', 'Science', 'Philosophy',
    'Poetry', 'Self-help',
  ];

  // Subjects that say nothing about what a book is like.
  const VAGUE = /^(fiction|fiction, general|general|literature|novel|novels|accessible book|protected daisy|in library|lending library|large type books|open library staff picks|internet archive wishlist|long now manual for civilization|reading level|english|american|british|translations|textbooks|juvenile (fiction|literature)|children's (fiction|stories)|fiction in english|english fiction|american fiction|readers|award|ebook|overdrive|nyt|new york times|literary|literary fiction|popular print disability books|specimens|criticism|study guides|imaginary|fictional|open_syllabus)/i;

  const saved0 = read(STATE_KEY, {});
  const state = {
    mode: saved0.mode === 'subject' ? 'subject' : 'books',
    seeds: Array.isArray(saved0.seeds) ? saved0.seeds.filter((seed) => seed && seed.key && seed.title).slice(0, MAX_SEEDS) : [],
    subject: typeof saved0.subject === 'string' ? saved0.subject : '',
  };
  const remember = () => write(STATE_KEY, state);
  const saved = savedList('v3-books-saved');

  const cover = (id, size) => (id ? 'https://covers.openlibrary.org/b/id/' + id + '-' + (size || 'M') + '.jpg' : '');
  const slug = (subject) => norm(subject).replace(/ /g, '_');

  /* ---------- Mode, seeds, subjects ---------- */

  const modeButtons = Array.from($('mode').querySelectorAll('button'));
  function showMode() {
    modeButtons.forEach((button) => button.setAttribute('aria-pressed', String(button.dataset.mode === state.mode)));
    $('books-box').hidden = state.mode !== 'books';
    $('subject-box').hidden = state.mode !== 'subject';
    refreshGo();
  }
  modeButtons.forEach((button) => button.addEventListener('click', () => {
    state.mode = button.dataset.mode;
    remember();
    showMode();
  }));

  const describeBook = (book) => ({
    title: book.title,
    sub: [book.author, book.year].filter(Boolean).join(' · '),
    art: cover(book.cover, 'S'),
  });

  function showSeeds() {
    renderSeeds($('seeds'), state.seeds, describeBook, (index) => {
      state.seeds.splice(index, 1);
      remember();
      showSeeds();
      $('book-search').focus();
    });
    $('search-wrap').hidden = state.seeds.length >= MAX_SEEDS;
    $('book-search').placeholder = state.seeds.length ? 'Add another book (optional)' : 'Search by title or author';
    refreshGo();
  }

  combobox({
    input: $('book-search'),
    list: $('suggestions'),
    async search(query) {
      const data = await getJson(OL + '/search.json?limit=8&fields=key,title,author_name,cover_i,first_publish_year&q=' + encodeURIComponent(query));
      return (data.docs || []).filter((doc) => doc.key && doc.title).map((doc) => ({
        key: doc.key,
        title: doc.title,
        author: (doc.author_name || [])[0] || '',
        cover: doc.cover_i || 0,
        year: doc.first_publish_year || '',
      }));
    },
    describe: describeBook,
    onPick(book) {
      if (!state.seeds.some((seed) => seed.key === book.key)) state.seeds.push(book);
      state.seeds = state.seeds.slice(0, MAX_SEEDS);
      remember();
      showSeeds();
      if (!$('search-wrap').hidden) $('book-search').focus();
    },
  });

  function showSubjects() {
    const box = $('subjects');
    box.replaceChildren();
    SUBJECTS.forEach((name) => {
      const chip = el('button', 'chip', name);
      chip.type = 'button';
      chip.setAttribute('aria-pressed', String(state.subject === name));
      chip.addEventListener('click', () => {
        state.subject = state.subject === name ? '' : name;
        $('subject-other').value = '';
        remember();
        showSubjects();
        refreshGo();
      });
      box.appendChild(chip);
    });
  }
  $('subject-other').value = SUBJECTS.includes(state.subject) ? '' : state.subject;
  $('subject-other').addEventListener('input', (event) => {
    state.subject = event.target.value.trim();
    remember();
    showSubjects();
    refreshGo();
  });
  $('subject-other').addEventListener('keydown', (event) => {
    if (event.key === 'Enter' && !$('go').disabled) run();
  });

  function refreshGo() {
    $('go').disabled = state.mode === 'books' ? !state.seeds.length : !state.subject;
  }

  /* ---------- Finding books ---------- */

  const SUBJECT_ALIASES = { classics: 'classic_literature', 'graphic novels': 'graphic_novels', 'self help': 'self-help', 'young adult fiction': 'young_adult_fiction' };

  async function subjectWorks(subject, limit) {
    const key = SUBJECT_ALIASES[norm(subject)] || slug(subject);
    const data = await getJson(OL + '/subjects/' + encodeURIComponent(key) + '.json?limit=' + limit);
    return (data.works || []).map((work) => ({
      id: work.key,
      key: work.key,
      title: work.title,
      author: ((work.authors || [])[0] || {}).name || '',
      cover: work.cover_id || 0,
      year: work.first_publish_year || '',
    }));
  }

  async function workSubjects(book) {
    const work = await getJson(OL + book.key + '.json');
    return (work.subjects || [])
      .map((subject) => String(subject).trim())
      .filter((subject) => subject.length > 2 && subject.length <= 40 && !VAGUE.test(subject) && !/[:=]/.test(subject));
  }

  async function likeBooks(seeds) {
    const counts = new Map();
    const lists = await Promise.all(seeds.map((seed) => workSubjects(seed).catch(() => [])));
    lists.forEach((subjects) => {
      subjects.slice(0, 25).forEach((subject, index) => {
        const key = norm(subject);
        const entry = counts.get(key) || { name: subject, score: 0, books: 0 };
        entry.score += 1 - index / 40;
        entry.books += 1;
        counts.set(key, entry);
      });
    });
    if (!counts.size) throw new Error("Open Library doesn't list subjects for those books. Try others, or pick a subject.");

    // Subjects shared by several of your books count most.
    const best = [...counts.values()].sort((a, b) => b.books - a.books || b.score - a.score).slice(0, 7);
    const pool = new Map();
    const seedKeys = new Set(seeds.map((seed) => seed.key));
    const seedAuthors = new Set(seeds.map((seed) => norm(seed.author)));
    await Promise.all(best.map(async (subject) => {
      const works = await subjectWorks(subject.name, 40).catch(() => []);
      works.forEach((book, index) => {
        if (seedKeys.has(book.key)) return;
        const entry = pool.get(book.key) || Object.assign(book, { score: 0, via: new Set() });
        const sameAuthor = seedAuthors.has(norm(book.author)) ? 0.5 : 1;
        entry.score += sameAuthor * subject.books * (1 - index / 60);
        entry.via.add(subject.name.toLowerCase());
        pool.set(book.key, entry);
      });
    }));
    return [...pool.values()].map((book) => {
      book.score *= 1 + 0.4 * (book.via.size - 1);
      book.why = 'Also about ' + listNames([...book.via].slice(0, 3));
      delete book.via;
      return book;
    });
  }

  async function subjectBooks(subject) {
    const works = await subjectWorks(subject, 80);
    if (!works.length) throw new Error('Open Library has no books filed under "' + subject + '". Try a broader subject.');
    return works.map((book, index) => Object.assign(book, { score: 1 - index / 120, why: 'Popular in ' + subject.toLowerCase() }));
  }

  const cache = new Map();
  let current = null;
  let token = 0;

  async function run() {
    if ($('go').disabled) return;
    const key = state.mode === 'books' ? 'b|' + state.seeds.map((seed) => seed.key).sort().join() : 's|' + norm(state.subject);
    const mine = ++token;
    $('results-area').hidden = false;
    $('results').replaceChildren();
    $('more').hidden = true;
    setStatus($('status'), 'Looking through Open Library…', 'busy');
    $('go').disabled = true;
    $('results-area').scrollIntoView({ behavior: 'smooth', block: 'start' });
    try {
      let entry = cache.get(key);
      if (!entry) {
        const books = state.mode === 'books' ? await likeBooks(state.seeds.slice()) : await subjectBooks(state.subject);
        entry = { books, shown: new Set() };
        cache.set(key, entry);
      }
      if (mine !== token) return;
      current = entry;
      showPage();
    } catch (error) {
      if (mine !== token) return;
      setStatus($('status'), error.message && !/HTTP|abort|fetch/i.test(error.message) ? error.message : "Open Library isn't answering right now. Try again in a minute.", 'problem');
    } finally {
      if (mine === token) refreshGo();
    }
  }

  function showPage() {
    const options = { exclude: current.shown, count: 20, perGroup: 2, keyOf: (book) => book.key, groupOf: (book) => norm(book.author) };
    let picked = choose(current.books, options);
    if (picked.length < 6 && current.shown.size) {
      current.shown.clear();
      picked = choose(current.books, options);
    }
    picked.forEach((book) => current.shown.add(book.key));
    renderBooks($('results'), picked, true);
    $('more').hidden = current.books.length <= picked.length;
    setStatus($('status'), picked.length ? picked.length + ' books to try.' : 'Nothing found. Try other books or a subject.', picked.length ? '' : 'problem');
  }

  $('go').addEventListener('click', run);
  $('more').addEventListener('click', () => {
    if (!current) return;
    showPage();
    $('results-area').scrollIntoView({ behavior: 'smooth', block: 'start' });
  });

  /* ---------- Lists ---------- */

  function renderBooks(list, books, showWhy) {
    list.replaceChildren();
    books.forEach((book) => {
      const item = { id: book.key, key: book.key, title: book.title, author: book.author, cover: book.cover, year: book.year };
      list.appendChild(itemRow({
        art: cover(book.cover, 'M'),
        artShape: 'book',
        placeholder: 'book',
        title: book.title,
        sub: [book.author, book.year].filter(Boolean).join(' · '),
        why: showWhy ? book.why : '',
        links: [
          { text: 'More like this', onClick: () => moreLike(item) },
          { text: 'Open Library', href: OL + book.key },
        ],
        save: { label: 'Want to read ' + book.title, icon: 'bookmark', pressed: saved.has(book.key), onToggle: () => saved.toggle(item), isPressed: () => saved.has(book.key) },
      }));
    });
  }

  function moreLike(book) {
    state.mode = 'books';
    state.seeds = [book];
    remember();
    tabs.show('find');
    showMode();
    showSeeds();
    window.scrollTo({ top: 0, behavior: 'smooth' });
    run();
  }

  function showSaved() {
    const books = saved.all();
    renderBooks($('saved'), books, false);
    $('saved-empty').hidden = books.length > 0;
    $('tab-saved').textContent = books.length ? 'Want to read (' + books.length + ')' : 'Want to read';
  }
  saved.onChange(showSaved);

  const tabs = setupTabs('v3-books-tab');
  showMode();
  showSeeds();
  showSubjects();
  showSaved();
})();
