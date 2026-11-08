/* Testser home page, version 3 */

(function () {
  'use strict';

  const $ = (id) => document.getElementById(id);

  const GAMES = 'Games';
  const MEDIA = 'Music & Video';
  const MAPS = 'Maps & Transport';
  const LEARN = 'Create & Learn';
  const TOOLS = 'Tools';
  const CATEGORIES = ['All', GAMES, MEDIA, MAPS, LEARN, TOOLS];

  const ALL_PROJECTS = [
    { label: "Don't Say It Out", href: 'dont_say_it_out/index.html', color: '#ef4444', icon: 'fa-comment-slash', cat: GAMES },
    { label: 'Toolkit', href: 'toolkit/index.html', color: '#2563eb', icon: 'fa-toolbox', cat: TOOLS },
    { label: 'Class Toolkit', href: 'class_toolkit/index.html', color: '#16a34a', icon: 'fa-chalkboard-user', cat: LEARN },
    { label: 'Make 24', href: 'make_24/index.html', color: '#ea580c', icon: 'fa-hashtag', cat: GAMES },
    { label: 'Perfect Second', href: 'perfect_second/index.html', color: '#7c3aed', icon: 'fa-stopwatch', cat: GAMES },
    { label: 'Zones', href: 'zones/index.html', color: '#0d9488', icon: 'fa-border-all', cat: GAMES },
    { label: 'Sudoku', href: 'sudoku/index.html', color: '#4f46e5', icon: 'fa-table-cells', cat: GAMES },
    { label: 'Route Viewer', href: 'RouteViewer/index.html', color: '#16a34a', icon: 'fa-route', cat: MAPS },
    { label: 'Transport App', href: 'TransportApp/index.html', color: '#0ea5e9', icon: 'fa-bus', cat: MAPS },
    { label: 'Video Call', href: 'video_call/index.html', color: '#8b5cf6', icon: 'fa-video', cat: MEDIA },
    { label: 'Music Player', href: 'music_player.html', color: '#ec4899', icon: 'fa-music', cat: MEDIA },
    { label: 'Music Player (alt)', href: 'music.html', color: '#ec4899', icon: 'fa-music', cat: MEDIA },
    { label: 'Video Player', href: 'video_player.html', color: '#f59e0b', icon: 'fa-play', cat: MEDIA },
    { label: 'VR Video Player', href: 'vr_video_player.html', color: '#8b5cf6', icon: 'fa-video', cat: MEDIA },
    { label: 'Counting Game', href: 'counting_game/countingGame.html', color: '#06b6d4', icon: 'fa-clock', cat: GAMES },
    { label: '10 seconds', href: 'counting_game/10_seconds.html', color: '#06b6d4', icon: 'fa-clock', cat: GAMES },
    { label: '20 seconds', href: 'counting_game/20_seconds.html', color: '#06b6d4', icon: 'fa-clock', cat: GAMES },
    { label: '30 seconds', href: 'counting_game/30_seconds.html', color: '#06b6d4', icon: 'fa-clock', cat: GAMES },
    { label: '1 minute', href: 'counting_game/1_minute.html', color: '#06b6d4', icon: 'fa-clock', cat: GAMES },
    { label: 'Calculator', href: 'Calculator.html', color: '#6b7280', icon: 'fa-calculator', cat: TOOLS },
    { label: 'Elevator', href: 'Elevator.html', color: '#64748b', icon: 'fa-elevator', cat: GAMES },
    { label: 'Stopwatch', href: 'Stopwatch.html', color: '#3b82f6', icon: 'fa-stopwatch', cat: TOOLS },
    { label: 'Timer', href: 'Timer.html', color: '#14b8a6', icon: 'fa-clock', cat: TOOLS },
    { label: 'Metronome', href: 'Metronome (Youtube)/index.html', color: '#f59e0b', icon: 'fa-music', cat: MEDIA },
    { label: 'Translator', href: 'CodingNepal/Translator (Youtube)/index.html', color: '#0ea5e9', icon: 'fa-language', cat: LEARN },
    { label: 'Guess The Number', href: 'CodingNepal/GTN/index.html', color: '#eab308', icon: 'fa-hashtag', cat: GAMES },
    { label: 'Text to Speech', href: 'CodingNepal/Text-To-Speech/index.html', color: '#8b5cf6', icon: 'fa-volume-high', cat: TOOLS },
    { label: 'Morse Code Translator', href: 'MorseCodeTranslator(AI)/index.html', color: '#64748b', icon: 'fa-signal', cat: LEARN },
    { label: 'Tic Tac Toe', href: 'Tic_Tac_Toe(Youtube)/index.html', color: '#22c55e', icon: 'fa-table-cells', cat: GAMES },
    { label: 'Piano', href: 'piano/index.html', color: '#1f2937', icon: 'fa-music', cat: MEDIA },
    { label: '2048', href: '2048/index.html', color: '#eab308', icon: 'fa-table-cells-large', cat: GAMES },
    { label: 'Keyboard Test', href: 'Keyboard_Test/index.html', color: '#64748b', icon: 'fa-keyboard', cat: TOOLS },
    { label: 'Snake Game', href: 'snake_game/index.html', color: '#22c55e', icon: 'fa-gamepad', cat: GAMES },
    { label: 'Memory Game', href: 'memory_game/index.html', color: '#a855f7', icon: 'fa-brain', cat: GAMES },
    { label: 'Pong', href: 'pong_game/index.html', color: '#06b6d4', icon: 'fa-table-tennis-paddle-ball', cat: GAMES },
    { label: 'Breakout Game', href: 'breakout/index.html', color: '#ef4444', icon: 'fa-gamepad', cat: GAMES },
    { label: 'Flappy Bird', href: 'flappy_bird/index.html', color: '#f97316', icon: 'fa-dove', cat: GAMES },
    { label: 'Candy Crush', href: 'candy_crush/index.html', color: '#ec4899', icon: 'fa-gamepad', cat: GAMES },
    { label: 'To-Do List', href: 'to-do_list.html', color: '#10b981', icon: 'fa-list-check', cat: TOOLS },
    { label: 'Lyrics Searcher', href: 'Song_Lyrics/index.html', color: '#f59e0b', icon: 'fa-music', cat: MEDIA },
    { label: 'QR Code Generator', href: 'qr-code-generator.html', color: '#0d9488', icon: 'fa-qrcode', cat: TOOLS },
    { label: 'Math Tools', href: 'math_tools/math_tools.html', color: '#6366f1', icon: 'fa-calculator', cat: LEARN },
    { label: 'Analog Clock', href: 'CodingNepal/analog_clock/index.html', color: '#1e293b', icon: 'fa-clock', cat: TOOLS },
    { label: 'Flip Clock', href: 'flip_clock/index.html', color: '#1e293b', icon: 'fa-clock', cat: TOOLS },
    { label: 'Testser Map', href: 'navigation.html', color: '#2563eb', icon: 'fa-map-location-dot', cat: MAPS },
    { label: 'Maps', href: 'maps.html', color: '#2563eb', icon: 'fa-map-location-dot', cat: MAPS },
    { label: 'Dad Jokes', href: 'dad_jokes/index.html', color: '#f59e0b', icon: 'fa-face-laugh-beam', cat: GAMES },
    { label: 'Drawing App', href: 'drawing_app/index.html', color: '#ef4444', icon: 'fa-pen-fancy', cat: LEARN },
    { label: 'Apple 360° Image Viewer', href: 'AppleImageViewer.html', color: '#64748b', icon: 'fa-image', cat: LEARN },
    { label: '3D Image Viewer', href: '3DImageViewer.html', color: '#8b5cf6', icon: 'fa-cube', cat: LEARN },
    { label: 'Weather', href: 'weather.html', color: '#0ea5e9', icon: 'fa-cloud-sun', cat: TOOLS },
    { label: 'Typing Test', href: 'typing_test.html', color: '#14b8a6', icon: 'fa-keyboard', cat: LEARN },
    { label: 'Notes', href: 'notes.html', color: '#eab308', icon: 'fa-note-sticky', cat: TOOLS },
    { label: 'Password Generator', href: 'password_generator.html', color: '#6366f1', icon: 'fa-key', cat: TOOLS },
    { label: 'Pomodoro', href: 'pomodoro.html', color: '#dc2626', icon: 'fa-hourglass-half', cat: TOOLS },
    { label: 'Unit Converter', href: 'unit_converter.html', color: '#84cc16', icon: 'fa-arrows-left-right', cat: TOOLS },
    { label: 'Knowledge Explorer', href: 'knowledge.html', color: '#a855f7', icon: 'fa-book', cat: LEARN },
    { label: 'Webcam Text Detector', href: 'webcam_text_detector.html', color: '#0ea5e9', icon: 'fa-camera', cat: TOOLS },
    { label: 'Tram Tracker', href: 'tram_tracker.html', color: '#16a34a', icon: 'fa-bus', cat: MAPS },
    { label: 'Tag', href: 'tag/index.html', color: '#f97316', icon: 'fa-tag', cat: GAMES },
    { label: 'Dichotomous Key Creator', href: 'dichotomous_key.html', color: '#22c55e', icon: 'fa-sitemap', cat: LEARN },
    { label: 'Spinner', href: 'spinner.html', color: '#eab308', icon: 'fa-spinner', cat: GAMES },
    { label: 'Table Assigner', href: 'table_assigner.html', color: '#64748b', icon: 'fa-table', cat: TOOLS },
    { label: 'Promo Code', href: 'promocode/index.html', color: '#10b981', icon: 'fa-ticket', cat: TOOLS },
    { label: 'Search', href: 'Search/Search.html', color: '#64748b', icon: 'fa-magnifying-glass', cat: TOOLS },
    { label: 'Speedometer', href: 'speedometer/index.html', color: '#f43f5e', icon: 'fa-gauge-high', cat: MAPS },
    { label: 'Tools', href: 'tools/file_transfer.html', color: '#475569', icon: 'fa-screwdriver-wrench', cat: TOOLS },
    { label: 'Symbol Searcher', href: 'tools/symbol_searcher.html', color: '#64748b', icon: 'fa-magnifying-glass', cat: TOOLS },
    { label: 'Clipboard Tool', href: 'tools/clipboard_tool.html', color: '#94a3b8', icon: 'fa-paste', cat: TOOLS },
  ];

  // Older projects are hidden from the site. Add a project's href here to show it again.
  const SHOWN_PROJECTS = new Set(['dont_say_it_out/index.html', 'toolkit/index.html', 'class_toolkit/index.html', 'make_24/index.html', 'perfect_second/index.html', 'zones/index.html', 'sudoku/index.html']);
  const PROJECTS = ALL_PROJECTS.filter((project) => SHOWN_PROJECTS.has(project.href));

  const CITY = { name: 'Sydney', lat: -33.87, lon: 151.21, tz: 'Australia/Sydney' };

  /* Storage can throw in private windows, so every access is guarded. */
  function read(key) {
    try { return localStorage.getItem(key); } catch (_) { return null; }
  }
  function write(key, value) {
    try { localStorage.setItem(key, value); } catch (_) { /* not remembered */ }
  }
  function readJson(key, fallback) {
    try { return JSON.parse(read(key)) || fallback; } catch (_) { return fallback; }
  }

  const RECENTS_KEY = 'v3-recents';
  const WELCOME_KEY = 'v3-welcome-seen';
  const MAX_RECENTS = 12;

  function el(tag, className, text) {
    const node = document.createElement(tag);
    if (className) node.className = className;
    if (text !== undefined) node.textContent = text;
    return node;
  }

  function appIcon(item) {
    const box = el('span', 'tile-icon');
    box.style.setProperty('--c', item.color);
    box.appendChild(el('i', 'fa-solid ' + item.icon));
    return box;
  }

  function linkTo(node, item) {
    node.href = encodeURI(item.href);
    node.dataset.open = item.href;
    node.dataset.label = item.label;
    return node;
  }

  function tile(item) {
    const link = linkTo(el('a', 'tile'), item);
    link.append(appIcon(item), el('span', 'tile-label', item.label));
    return link;
  }

  /* Project grid */
  $('project-count').textContent = PROJECTS.length;
  // The grid and recents only appear once there are more projects than the large tiles above show.
  const hasMoreProjects = PROJECTS.length > document.querySelectorAll('.bento-tile:not([hidden])').length;
  $('all-projects').hidden = !hasMoreProjects;
  $('year').textContent = new Date().getFullYear();

  let activeCategory = 'All';

  function renderProjects() {
    const list = activeCategory === 'All' ? PROJECTS : PROJECTS.filter((p) => p.cat === activeCategory);
    $('projects-grid').replaceChildren(...list.map(tile));
    document.querySelectorAll('.filter').forEach((button) => {
      button.setAttribute('aria-pressed', String(button.textContent === activeCategory));
    });
  }

  CATEGORIES.forEach((category) => {
    const button = el('button', 'filter', category);
    button.type = 'button';
    button.addEventListener('click', () => {
      activeCategory = category;
      renderProjects();
    });
    $('filters').appendChild(button);
  });
  renderProjects();

  /* Recents */
  function getRecents() {
    const stored = readJson(RECENTS_KEY, []);
    return (Array.isArray(stored) ? stored : [])
      .map((href) => PROJECTS.find((item) => item.href === href))
      .filter(Boolean);
  }

  function renderRecents() {
    const list = getRecents();
    $('recents').hidden = list.length === 0 || !hasMoreProjects;
    $('recents-grid').replaceChildren(...list.map(tile));
  }

  function addRecent(href) {
    const stored = getRecents().map((item) => item.href).filter((h) => h !== href);
    stored.unshift(href);
    write(RECENTS_KEY, JSON.stringify(stored.slice(0, MAX_RECENTS)));
    renderRecents();
  }

  $('recents-clear').addEventListener('click', () => {
    write(RECENTS_KEY, '[]');
    renderRecents();
  });
  renderRecents();

  /* Project sheet: the browser's Back button closes it too */
  const sheet = $('sheet');
  const sheetFrame = $('sheet-frame');
  const isSheetEntry = () => Boolean(history.state && history.state.v3sheet);

  function openSheet(href, label) {
    const url = encodeURI(href);
    const frame = el('iframe');
    frame.src = url;
    frame.title = label;
    sheetFrame.replaceChildren(frame);
    $('sheet-title').textContent = label;
    $('sheet-newtab').href = url;
    sheet.showModal();
    history.pushState({ v3sheet: true }, '');
  }

  function hideSheet() {
    if (sheet.open) sheet.close();
    sheetFrame.replaceChildren(); // removing the frame stops any audio or camera
  }

  function closeSheet() {
    hideSheet();
    if (isSheetEntry()) history.back();
  }

  window.addEventListener('popstate', () => {
    if (sheet.open && !isSheetEntry()) hideSheet();
  });
  $('sheet-done').addEventListener('click', closeSheet);
  sheet.addEventListener('cancel', (event) => {
    event.preventDefault();
    closeSheet();
  });

  function openItem(href, label) {
    addRecent(href);
    openSheet(href, label);
  }

  // Ctrl/Cmd-click and middle-click keep their normal "open in a new tab" behaviour.
  document.addEventListener('click', (event) => {
    if (event.button || event.metaKey || event.ctrlKey || event.shiftKey || event.altKey) return;
    const link = event.target.closest('[data-open]');
    if (!link) return;
    event.preventDefault();
    openItem(link.dataset.open, link.dataset.label);
  });

  /* Clock */
  function updateClock() {
    const now = new Date();
    $('status-time').textContent = now.toLocaleTimeString('en-AU', { hour: '2-digit', minute: '2-digit', hour12: false });
    $('status-date').textContent = now.toLocaleDateString('en-AU', { weekday: 'short', day: 'numeric', month: 'short' });
  }
  updateClock();
  setInterval(updateClock, 1000);

  /* Weather */
  function describeWeather(code) {
    if (code >= 61) return 'Rain';
    if (code >= 51) return 'Drizzle';
    if (code >= 3) return 'Cloudy';
    if (code >= 1) return 'Partly cloudy';
    return 'Clear';
  }

  function updateWeather() {
    const output = $('status-weather-text');
    const url = 'https://api.open-meteo.com/v1/forecast?latitude=' + CITY.lat + '&longitude=' + CITY.lon +
      '&current=temperature_2m,weather_code&timezone=' + encodeURIComponent(CITY.tz);
    fetch(url)
      .then((response) => response.json())
      .then((data) => {
        output.textContent = Math.round(data.current.temperature_2m) + '° ' +
          describeWeather(data.current.weather_code || 0) + ', ' + CITY.name;
      })
      .catch(() => { output.textContent = '—° ' + CITY.name; });
  }
  updateWeather();
  setInterval(updateWeather, 600000);

  /* Version 3 welcome: marked as seen the moment it appears, so it never returns */
  const welcome = $('welcome');
  $('welcome-ok').addEventListener('click', () => welcome.close());
  if (!read(WELCOME_KEY)) {
    write(WELCOME_KEY, '1');
    welcome.showModal();
  }
})();
