/**
 * v2.1 Dashboard — macOS 26–style simulator
 * Unified layering (finder + app windows), menu bar, Recents.
 */

(function () {
  'use strict';

  const $ = (id) => document.getElementById(id);
  const desktop = $('desktop');
  const desktopIcons = $('desktop-icons');
  const appWindowsContainer = $('app-windows');
  const finderProjects = $('finder-projects');
  const finderProjectsContent = $('projects-grid');
  const finderBreadcrumb = $('finder-breadcrumb');
  const menuTime = $('menu-time');
  const menuDate = $('menu-date');
  const menuAppName = $('menu-app-name');
  const menuWeather = $('menu-weather');
  const menuWeatherText = $('menu-weather-text');
  const dock = $('dock');
  const spotlightBtn = $('spotlight-btn');
  const spotlightOverlay = $('spotlight-overlay');
  const spotlightInput = $('spotlight-input');
  const spotlightResults = $('spotlight-results');
  const spotlightBox = $('spotlight-box');
  const settingsBtn = $('settings-btn');
  const settingsOverlay = $('settings-overlay');
  const settingsClose = $('settings-close');
  const settingsPanel = $('settings-panel');

  const PROJECTS = [
    { label: 'Route Viewer', href: 'RouteViewer/index.html', color: '#16a34a', icon: 'fa-route' },
    { label: 'Transport App', href: 'TransportApp/index.html', color: '#0ea5e9', icon: 'fa-bus' },
    { label: 'Video Call', href: 'video_call/index.html', color: '#8b5cf6', icon: 'fa-video' },
    { label: 'Music Player', href: 'music_player.html', color: '#ec4899', icon: 'fa-music' },
    { label: 'Music Player (alt)', href: 'music.html', color: '#ec4899', icon: 'fa-music' },
    { label: 'Video Player', href: 'video_player.html', color: '#f59e0b', icon: 'fa-play' },
    { label: 'VR Video Player', href: 'vr_video_player.html', color: '#8b5cf6', icon: 'fa-video' },
    { label: 'Counting Game', href: 'counting_game/countingGame.html', color: '#06b6d4', icon: 'fa-clock' },
    { label: '10 seconds', href: 'counting_game/10_seconds.html', color: '#06b6d4', icon: 'fa-clock' },
    { label: '20 seconds', href: 'counting_game/20_seconds.html', color: '#06b6d4', icon: 'fa-clock' },
    { label: '30 seconds', href: 'counting_game/30_seconds.html', color: '#06b6d4', icon: 'fa-clock' },
    { label: '1 minute', href: 'counting_game/1_minute.html', color: '#06b6d4', icon: 'fa-clock' },
    { label: 'Calculator', href: 'Calculator.html', color: '#6b7280', icon: 'fa-calculator' },
    { label: 'Elevator', href: 'Elevator.html', color: '#64748b', icon: 'fa-elevator' },
    { label: 'Stopwatch', href: 'Stopwatch.html', color: '#3b82f6', icon: 'fa-stopwatch' },
    { label: 'Timer', href: 'Timer.html', color: '#14b8a6', icon: 'fa-clock' },
    { label: 'Metronome', href: 'Metronome (Youtube)/index.html', color: '#f59e0b', icon: 'fa-music' },
    { label: 'Translator', href: 'CodingNepal/Translator (Youtube)/index.html', color: '#0ea5e9', icon: 'fa-language' },
    { label: 'Guess The Number', href: 'CodingNepal/GTN/index.html', color: '#eab308', icon: 'fa-hashtag' },
    { label: 'Text to Speech', href: 'CodingNepal/Text-To-Speech/index.html', color: '#8b5cf6', icon: 'fa-volume-high' },
    { label: 'Morse Code Translator', href: 'MorseCodeTranslator(AI)/index.html', color: '#64748b', icon: 'fa-signal' },
    { label: 'Tic Tac Toe', href: 'Tic_Tac_Toe(Youtube)/index.html', color: '#22c55e', icon: 'fa-grid-2' },
    { label: 'Piano', href: 'piano/index.html', color: '#1f2937', icon: 'fa-piano-keyboard' },
    { label: '2048', href: '2048/index.html', color: '#eab308', icon: 'fa-grid-2' },
    { label: 'Keyboard Test', href: 'Keyboard_Test/index.html', color: '#64748b', icon: 'fa-keyboard' },
    { label: 'Snake Game', href: 'snake_game/index.html', color: '#22c55e', icon: 'fa-gamepad' },
    { label: 'Memory Game', href: 'memory_game/index.html', color: '#a855f7', icon: 'fa-brain' },
    { label: 'Pong', href: 'pong_game/index.html', color: '#06b6d4', icon: 'fa-table-tennis-paddle-ball' },
    { label: 'Breakout Game', href: 'breakout/index.html', color: '#ef4444', icon: 'fa-gamepad' },
    { label: 'Flappy Bird', href: 'flappy_bird/index.html', color: '#f97316', icon: 'fa-dove' },
    { label: 'Candy Crush', href: 'candy_crush/index.html', color: '#ec4899', icon: 'fa-gamepad' },
    { label: 'To-Do List', href: 'to-do_list.html', color: '#10b981', icon: 'fa-list-check' },
    { label: 'Lyrics Searcher', href: 'Song_Lyrics/index.html', color: '#f59e0b', icon: 'fa-music' },
    { label: 'QR Code Generator', href: 'qr-code-generator.html', color: '#0d9488', icon: 'fa-qrcode' },
    { label: 'Math Tools', href: 'math_tools/math_tools.html', color: '#6366f1', icon: 'fa-calculator' },
    { label: 'Analog Clock', href: 'CodingNepal/analog_clock/index.html', color: '#1e293b', icon: 'fa-clock' },
    { label: 'Flip Clock', href: 'flip_clock/index.html', color: '#1e293b', icon: 'fa-clock' },
    { label: 'Testser Map', href: 'navigation.html', color: '#2563eb', icon: 'fa-map-location-dot' },
    { label: 'Maps', href: 'maps.html', color: '#2563eb', icon: 'fa-map-location-dot' },
    { label: 'Dad Jokes', href: 'dad_jokes/index.html', color: '#f59e0b', icon: 'fa-face-laugh-beam' },
    { label: 'Drawing App', href: 'drawing_app/index.html', color: '#ef4444', icon: 'fa-pen-fancy' },
    { label: 'Apple 360° Image Viewer', href: 'AppleImageViewer.html', color: '#64748b', icon: 'fa-image' },
    { label: '3D Image Viewer', href: '3DImageViewer.html', color: '#8b5cf6', icon: 'fa-cube' },
    { label: 'Weather', href: 'weather.html', color: '#0ea5e9', icon: 'fa-cloud-sun' },
    { label: 'Typing Test', href: 'typing_test.html', color: '#14b8a6', icon: 'fa-keyboard' },
    { label: 'Notes', href: 'notes.html', color: '#eab308', icon: 'fa-note-sticky' },
    { label: 'Password Generator', href: 'password_generator.html', color: '#6366f1', icon: 'fa-key' },
    { label: 'Pomodoro', href: 'pomodoro.html', color: '#dc2626', icon: 'fa-hourglass-half' },
    { label: 'Unit Converter', href: 'unit_converter.html', color: '#84cc16', icon: 'fa-arrows-left-right' },
    { label: 'Knowledge Explorer', href: 'knowledge.html', color: '#a855f7', icon: 'fa-book' },
    { label: 'Webcam Text Detector', href: 'webcam_text_detector.html', color: '#0ea5e9', icon: 'fa-camera' },
    { label: 'Tram Tracker', href: 'tram_tracker.html', color: '#16a34a', icon: 'fa-bus' },
    { label: 'Tag', href: 'tag/index.html', color: '#f97316', icon: 'fa-tag' },
    { label: 'Dichotomous Key Creator', href: 'dichotomous_key.html', color: '#22c55e', icon: 'fa-sitemap' },
    { label: 'Spinner', href: 'spinner.html', color: '#eab308', icon: 'fa-spinner' },
    { label: 'Table Assigner', href: 'table_assigner.html', color: '#64748b', icon: 'fa-table' },
    { label: 'Promo Code', href: 'promocode/index.html', color: '#10b981', icon: 'fa-ticket' },
    { label: 'Search', href: 'Search/Search.html', color: '#64748b', icon: 'fa-magnifying-glass' },
    { label: 'Speedometer', href: 'speedometer/index.html', color: '#f43f5e', icon: 'fa-gauge-high' },
    { label: 'Tools', href: 'tools/file_transfer.html', color: '#475569', icon: 'fa-screwdriver-wrench' },
    { label: 'Symbol Searcher', href: 'tools/symbol_searcher.html', color: '#64748b', icon: 'fa-magnifying-glass' },
    { label: 'Clipboard Tool', href: 'tools/clipboard_tool.html', color: '#94a3b8', icon: 'fa-paste' },
    { label: 'System Settings', href: 'system-settings', color: '#6366f1', icon: 'fa-gear' },
  ];

  const MAX_RECENTS = 15;
  let recents = []; // { href, label, color, icon }
  let finderView = 'projects'; // 'projects' | 'recents'

  let nextZ = 100;
  let dragState = null;
  let resizeState = null;
  const minimizedWindows = []; // { win, title }
  const dockMinimizedEl = $('dock-minimized');

  const MIN_W = 320;
  const MIN_H = 240;
  const MAX_W = () => Math.max(MIN_W, desktop.getBoundingClientRect().width - 48);
  const MAX_H = () => Math.max(MIN_H, desktop.getBoundingClientRect().height - 24);

  function endDragAndResize() {
    dragState = null;
    resizeState = null;
  }

  const DAYS = ['Sun', 'Mon', 'Tue', 'Wed', 'Thu', 'Fri', 'Sat'];
  const MONTHS = ['Jan', 'Feb', 'Mar', 'Apr', 'May', 'Jun', 'Jul', 'Aug', 'Sep', 'Oct', 'Nov', 'Dec'];

  const WALLPAPERS = [
    { id: '', label: 'Default' },
    { id: 'lake-boat.png', label: 'Lake & Boat' },
    { id: 'mountains-mist.png', label: 'Mountains & Mist' },
    { id: 'milky-way.png', label: 'Milky Way' },
    { id: 'mountains-golden.png', label: 'Mountains Golden' },
  ];

  const PREFS_KEY = 'v2.1dashboard-prefs';
  function getSystemPref(key) {
    try {
      const p = JSON.parse(localStorage.getItem(PREFS_KEY) || '{}');
      return p[key];
    } catch (_) { return undefined; }
  }
  function setSystemPref(key, value) {
    try {
      const p = JSON.parse(localStorage.getItem(PREFS_KEY) || '{}');
      p[key] = value;
      localStorage.setItem(PREFS_KEY, JSON.stringify(p));
    } catch (_) {}
  }

  const WEATHER_CITIES = {
    sydney: { lat: -33.87, lon: 151.21, tz: 'Australia/Sydney' },
    melbourne: { lat: -37.81, lon: 144.96, tz: 'Australia/Melbourne' },
    brisbane: { lat: -27.47, lon: 153.03, tz: 'Australia/Brisbane' },
    perth: { lat: -31.95, lon: 115.86, tz: 'Australia/Perth' },
    adelaide: { lat: -34.93, lon: 138.6, tz: 'Australia/Adelaide' },
    london: { lat: 51.51, lon: -0.13, tz: 'Europe/London' },
    newyork: { lat: 40.71, lon: -74.01, tz: 'America/New_York' },
    tokyo: { lat: 35.68, lon: 139.69, tz: 'Asia/Tokyo' },
  };

  function updateTime() {
    const now = new Date();
    const h = now.getHours();
    const m = now.getMinutes();
    const s = now.getSeconds();
    const showSeconds = getSystemPref('showSeconds') === true || getSystemPref('showSeconds') === '1';
    if (menuTime) {
      if (showSeconds) menuTime.textContent = `${String(h).padStart(2, '0')}:${String(m).padStart(2, '0')}:${String(s).padStart(2, '0')}`;
      else menuTime.textContent = `${String(h).padStart(2, '0')}:${String(m).padStart(2, '0')}`;
    }
    if (menuDate) {
      const day = DAYS[now.getDay()];
      const date = now.getDate();
      const month = MONTHS[now.getMonth()];
      menuDate.textContent = `${day} ${date} ${month}`;
    }
  }
  updateTime();
  setInterval(updateTime, 1000);

  function getWeatherCoords() {
    const loc = (getSystemPref('weatherLocation') || 'sydney').trim().toLowerCase().replace(/\s+/g, '');
    return WEATHER_CITIES[loc] || WEATHER_CITIES.sydney;
  }

  function updateWeather() {
    if (!menuWeatherText) return;
    const { lat, lon, tz } = getWeatherCoords();
    fetch(`https://api.open-meteo.com/v1/forecast?latitude=${lat}&longitude=${lon}&current=temperature_2m,weather_code&timezone=${encodeURIComponent(tz)}`)
      .then((r) => r.json())
      .then((data) => {
        const temp = Math.round(data.current.temperature_2m);
        const code = data.current.weather_code || 0;
        const desc = code >= 80 ? 'Rain' : code >= 61 ? 'Rain' : code >= 51 ? 'Drizzle' : code >= 3 ? 'Cloudy' : code >= 1 ? 'Partly cloudy' : 'Clear';
        menuWeatherText.textContent = `${temp}°`;
        if (menuWeather) menuWeather.title = `${temp}° ${desc}`;
      })
      .catch(() => {
        menuWeatherText.textContent = '—°';
      });
  }
  updateWeather();
  setInterval(updateWeather, 600000);

  function applyWallpaper() {
    const mac = document.getElementById('mac-simulator');
    if (!mac) return;
    const file = getSystemPref('wallpaper') || '';
    if (file) {
      mac.style.backgroundImage = `url(wallpapers/${file})`;
      mac.setAttribute('data-wallpaper', '1');
    } else {
      mac.style.backgroundImage = '';
      mac.removeAttribute('data-wallpaper');
    }
  }
  applyWallpaper();

  function openSpotlight() {
    if (!spotlightOverlay || !spotlightInput) return;
    spotlightOverlay.classList.add('open');
    spotlightOverlay.setAttribute('aria-hidden', 'false');
    spotlightInput.value = '';
    spotlightInput.focus();
    renderSpotlightResults(PROJECTS);
    setTimeout(() => spotlightInput.focus(), 50);
  }

  function closeSpotlight() {
    if (!spotlightOverlay) return;
    spotlightOverlay.classList.remove('open');
    spotlightOverlay.setAttribute('aria-hidden', 'true');
  }

  function renderSpotlightResults(items) {
    if (!spotlightResults) return;
    if (!items.length) {
      spotlightResults.innerHTML = '<div class="spotlight-no-results">No results</div>';
      return;
    }
    spotlightResults.innerHTML = items.slice(0, 12).map((p) => {
      const color = p.color || '#6366f1';
      const icon = p.icon || 'fa-file';
      const label = escapeHtml(p.label);
      const href = escapeAttr(p.href);
      return `<button type="button" class="spotlight-result-item" data-href="${href}" data-label="${escapeAttr(p.label)}"><div class="result-icon" style="background:${color}"><i class="fa-solid ${icon}"></i></div><span class="result-label">${label}</span><span class="result-meta">Open</span></button>`;
    }).join('');
    spotlightResults.querySelectorAll('.spotlight-result-item').forEach((btn) => {
      btn.addEventListener('click', () => {
        const href = btn.getAttribute('data-href');
        const label = btn.getAttribute('data-label');
        closeSpotlight();
        if (href && typeof openInWindow === 'function') openInWindow(href, label);
      });
    });
  }

  if (spotlightBtn) spotlightBtn.addEventListener('click', openSpotlight);
  if (spotlightOverlay) {
    spotlightOverlay.addEventListener('click', (e) => { if (e.target === spotlightOverlay) closeSpotlight(); });
    spotlightOverlay.addEventListener('keydown', (e) => { if (e.key === 'Escape') closeSpotlight(); });
  }
  if (spotlightInput) {
    spotlightInput.addEventListener('input', () => {
      const q = spotlightInput.value.trim().toLowerCase();
      if (!q) {
        renderSpotlightResults(PROJECTS);
        return;
      }
      const filtered = PROJECTS.filter((p) => p.label.toLowerCase().includes(q) || (p.href && p.href.toLowerCase().includes(q)));
      renderSpotlightResults(filtered);
    });
    spotlightInput.addEventListener('keydown', (e) => {
      if (e.key === 'Escape') closeSpotlight();
    });
  }
  if (spotlightBox) spotlightBox.addEventListener('click', (e) => e.stopPropagation());

  if (settingsBtn) settingsBtn.addEventListener('click', () => openSystemSettingsWindow());

  function getProjectByHref(href) {
    return PROJECTS.find((p) => p.href === href);
  }

  function addToRecents(href, label) {
    const proj = getProjectByHref(href);
    const color = (proj && proj.color) || '#6366f1';
    const icon = (proj && proj.icon) || 'fa-file';
    recents = recents.filter((r) => r.href !== href);
    recents.unshift({ href, label, color, icon });
    if (recents.length > MAX_RECENTS) recents.pop();
  }

  function updateMenuAppName(name) {
    if (menuAppName) menuAppName.textContent = name || 'Dashboard';
  }

  function focusFinder() {
    document.querySelectorAll('.app-window.focused').forEach((w) => w.classList.remove('focused'));
    finderProjects.classList.add('focused');
    finderProjects.style.zIndex = ++nextZ;
    updateMenuAppName('Finder');
  }

  function openFinderProjects() {
    finderProjects.classList.add('open');
    finderProjects.setAttribute('aria-hidden', 'false');
    finderProjects.style.zIndex = ++nextZ;
    focusFinder();
    requestAnimationFrame(() => {
      const appRect = appWindowsContainer.getBoundingClientRect();
      const finderRect = finderProjects.getBoundingClientRect();
      finderProjects.style.left = Math.max(0, Math.round((appRect.width - finderRect.width) / 2)) + 'px';
      finderProjects.style.top = Math.max(0, Math.round((appRect.height - finderRect.height) / 2)) + 'px';
      finderProjects.style.transform = '';
    });
  }

  function closeFinderProjects() {
    finderProjects.classList.remove('open', 'focused');
    finderProjects.setAttribute('aria-hidden', 'true');
    updateMenuAppName('Dashboard');
  }

  function removeMinimizedEntry(win) {
    const i = minimizedWindows.findIndex((m) => m.win === win);
    if (i !== -1) minimizedWindows.splice(i, 1);
    renderDockMinimized();
  }

  function minimizeWindow(win, title) {
    minimizedWindows.push({ win, title });
    renderDockMinimized();
    const pills = dockMinimizedEl ? dockMinimizedEl.querySelectorAll('.dock-minimized-item') : [];
    const pill = pills[pills.length - 1];
    if (pill) {
      win.style.transform = '';
      const wr = win.getBoundingClientRect();
      const pr = pill.getBoundingClientRect();
      const dx = (pr.left + pr.width / 2) - (wr.left + wr.width / 2);
      const dy = (pr.top + pr.height / 2) - (wr.top + wr.height / 2);
      win.style.setProperty('--minimize-dx', dx + 'px');
      win.style.setProperty('--minimize-dy', dy + 'px');
      win.classList.add('minimizing');
      win.addEventListener('animationend', function onMinimizeEnd() {
        win.removeEventListener('animationend', onMinimizeEnd);
        win.classList.remove('minimizing');
        win.classList.add('minimized');
        win.style.removeProperty('--minimize-dx');
        win.style.removeProperty('--minimize-dy');
      }, { once: true });
    } else {
      win.classList.add('minimized');
    }
  }

  function restoreWindow(win) {
    removeMinimizedEntry(win);
    win.classList.remove('minimized');
    focusWindow(win);
    win.style.zIndex = ++nextZ;
  }

  function renderDockMinimized() {
    if (!dockMinimizedEl) return;
    dockMinimizedEl.innerHTML = minimizedWindows.map((m, i) => {
      const title = escapeHtml(m.title);
      return `<button type="button" class="dock-minimized-item" data-index="${i}" title="${title}"><i class="fa-solid fa-window-maximize dock-minimized-icon"></i><span class="dock-minimized-title">${title}</span></button>`;
    }).join('');
    dockMinimizedEl.querySelectorAll('.dock-minimized-item').forEach((btn) => {
      const i = parseInt(btn.getAttribute('data-index'), 10);
      const m = minimizedWindows[i];
      if (m) btn.addEventListener('click', () => restoreWindow(m.win));
    });
  }

  function focusWindow(winEl) {
    document.querySelectorAll('.app-window.focused').forEach((w) => w.classList.remove('focused'));
    finderProjects.classList.remove('focused');
    winEl.classList.add('focused');
    winEl.style.zIndex = ++nextZ;
    const titleEl = winEl.querySelector('.app-window-title');
    updateMenuAppName(titleEl ? titleEl.textContent : 'App');
  }

  function openSystemSettingsWindow() {
    const title = 'System Settings';
    const rect = appWindowsContainer.getBoundingClientRect();
    const w = Math.max(380, Math.min(rect.width - 48, 440));
    const h = Math.max(380, Math.min(rect.height - 24, 480));
    const left = Math.max(0, Math.round((rect.width - w) / 2));
    const top = Math.max(0, Math.round((rect.height - h) / 2));
    const win = document.createElement('div');
    win.className = 'app-window focused';
    win.style.zIndex = ++nextZ;
    win.style.width = w + 'px';
    win.style.height = h + 'px';
    win.style.left = left + 'px';
    win.style.top = top + 'px';
    const weatherLoc = getSystemPref('weatherLocation') || 'Sydney';
    const showSeconds = getSystemPref('showSeconds') === true || getSystemPref('showSeconds') === '1';
    const currentWallpaper = getSystemPref('wallpaper') || '';
    win.innerHTML = `
      <div class="app-window-titlebar" data-drag>
        <div class="app-window-buttons">
          <button type="button" class="app-window-btn close" aria-label="Close"><i class="fa-solid fa-times app-window-btn-icon"></i></button>
          <button type="button" class="app-window-btn minimize" aria-label="Minimize"><i class="fa-solid fa-minus app-window-btn-icon"></i></button>
          <button type="button" class="app-window-btn maximize" aria-label="Maximize"><i class="fa-solid fa-expand app-window-btn-icon"></i></button>
        </div>
        <span class="app-window-title">${escapeHtml(title)}</span>
      </div>
      <div class="app-window-body settings-body">
        <form class="settings-form" id="system-settings-form">
          <div class="settings-form-group">
            <label>Desktop wallpaper</label>
            <div class="wallpaper-picker" id="settings-wallpaper-picker">
              ${WALLPAPERS.map((w) => {
                const selected = currentWallpaper === w.id ? ' selected' : '';
                const thumbStyle = w.id ? `style="background-image:url(wallpapers/${escapeAttr(w.id)})"` : '';
                const thumbClass = w.id ? 'wallpaper-thumb' : 'wallpaper-thumb wallpaper-default';
                return `<button type="button" class="wallpaper-option${selected}" data-id="${escapeAttr(w.id)}" title="${escapeAttr(w.label)}"><span class="${thumbClass}" ${thumbStyle}></span><span class="wallpaper-label">${escapeHtml(w.label)}</span></button>`;
              }).join('')}
            </div>
          </div>
          <div class="settings-form-group">
            <label for="settings-weather-location">Weather location</label>
            <input type="text" id="settings-weather-location" value="${escapeAttr(weatherLoc)}" placeholder="e.g. Sydney, Melbourne, London" />
            <p class="hint">City name (Sydney, Melbourne, Brisbane, Perth, Adelaide, London, New York, Tokyo)</p>
          </div>
          <div class="settings-form-group">
            <label class="checkbox-label">
              <input type="checkbox" id="settings-show-seconds" ${showSeconds ? 'checked' : ''} />
              Time: Show seconds in menu bar
            </label>
          </div>
        </form>
      </div>
    `;
    const titlebar = win.querySelector('.app-window-titlebar');
    const btnClose = win.querySelector('.app-window-btn.close');
    const btnMin = win.querySelector('.app-window-btn.minimize');
    const btnMax = win.querySelector('.app-window-btn.maximize');
    const weatherInput = win.querySelector('#settings-weather-location');
    const secondsCb = win.querySelector('#settings-show-seconds');
    btnClose.addEventListener('click', () => { removeMinimizedEntry(win); win.remove(); });
    btnMin.addEventListener('click', () => minimizeWindow(win, title));
    btnMax.addEventListener('click', () => {
      win.classList.toggle('maximized');
      if (win.classList.contains('maximized')) win.style.transform = '';
    });
    weatherInput.addEventListener('change', () => {
      const v = weatherInput.value.trim() || 'Sydney';
      setSystemPref('weatherLocation', v);
      updateWeather();
    });
    weatherInput.addEventListener('blur', () => {
      const v = weatherInput.value.trim() || 'Sydney';
      setSystemPref('weatherLocation', v);
      updateWeather();
    });
    secondsCb.addEventListener('change', () => {
      setSystemPref('showSeconds', secondsCb.checked);
      updateTime();
    });
    win.querySelectorAll('.wallpaper-option').forEach((btn) => {
      btn.addEventListener('click', () => {
        const id = btn.getAttribute('data-id') || '';
        setSystemPref('wallpaper', id);
        applyWallpaper();
        win.querySelectorAll('.wallpaper-option').forEach((b) => b.classList.remove('selected'));
        btn.classList.add('selected');
      });
    });
    titlebar.addEventListener('mousedown', (e) => {
      if (e.button !== 0) return;
      if (e.target.closest('.app-window-btn')) return;
      focusWindow(win);
      win.classList.add('app-window-dragging');
      const leftVal = parseFloat(win.style.left) || 0;
      const topVal = parseFloat(win.style.top) || 0;
      dragState = { win, startLeft: leftVal, startTop: topVal, startClientX: e.clientX, startClientY: e.clientY };
    });
    win.addEventListener('mousedown', () => focusWindow(win));
    appWindowsContainer.appendChild(win);
    updateMenuAppName(title);
  }

  function openInWindow(href, title) {
    if (!href || href === '#') return;
    if (href === 'system-settings') {
      openSystemSettingsWindow();
      return;
    }
    addToRecents(href, title);
    const rect = appWindowsContainer.getBoundingClientRect();
    const w = Math.max(320, Math.min(rect.width - 48, Math.round(rect.width * 0.9)));
    const h = Math.max(240, Math.min(rect.height - 24, Math.round(rect.height * 0.85)));
    const left = Math.max(0, Math.round((rect.width - w) / 2));
    const top = Math.max(0, Math.round((rect.height - h) / 2));
    const win = document.createElement('div');
    win.className = 'app-window focused';
    win.style.zIndex = ++nextZ;
    win.style.width = w + 'px';
    win.style.height = h + 'px';
    win.style.left = left + 'px';
    win.style.top = top + 'px';
    openInWindow.count = (openInWindow.count || 0) + 1;
    if (openInWindow.count > 12) openInWindow.count = 0;

    win.innerHTML = `
      <div class="app-window-titlebar" data-drag>
        <div class="app-window-buttons">
          <button type="button" class="app-window-btn close" aria-label="Close"><i class="fa-solid fa-times app-window-btn-icon"></i></button>
          <button type="button" class="app-window-btn minimize" aria-label="Minimize"><i class="fa-solid fa-minus app-window-btn-icon"></i></button>
          <button type="button" class="app-window-btn maximize" aria-label="Maximize"><i class="fa-solid fa-expand app-window-btn-icon"></i></button>
        </div>
        <span class="app-window-title">${escapeHtml(title || href)}</span>
      </div>
      <div class="app-window-body">
        <iframe src="${escapeAttr(href)}" title="${escapeAttr(title || href)}"></iframe>
        <div class="app-window-resize-handle" data-resize aria-label="Resize"></div>
      </div>
    `;

    const titlebar = win.querySelector('.app-window-titlebar');
    const resizeHandle = win.querySelector('.app-window-resize-handle');
    const btnClose = win.querySelector('.app-window-btn.close');
    const btnMin = win.querySelector('.app-window-btn.minimize');
    const btnMax = win.querySelector('.app-window-btn.maximize');

    btnClose.addEventListener('click', () => {
      removeMinimizedEntry(win);
      win.remove();
    });
    btnMin.addEventListener('click', () => minimizeWindow(win, title || href));
    btnMax.addEventListener('click', () => {
      win.classList.toggle('maximized');
      if (win.classList.contains('maximized')) win.style.transform = '';
    });

    titlebar.addEventListener('mousedown', (e) => {
      if (e.button !== 0) return;
      if (e.target.closest('.app-window-btn')) return;
      focusWindow(win);
      win.classList.add('app-window-dragging');
      const left = parseFloat(win.style.left) || 0;
      const top = parseFloat(win.style.top) || 0;
      dragState = {
        win,
        startLeft: left,
        startTop: top,
        startClientX: e.clientX,
        startClientY: e.clientY,
      };
    });

    resizeHandle.addEventListener('mousedown', (e) => {
      if (e.button !== 0) return;
      e.stopPropagation();
      e.preventDefault();
      focusWindow(win);
      win.classList.add('app-window-resizing');
      const rect = win.getBoundingClientRect();
      resizeState = {
        win,
        startX: e.clientX,
        startY: e.clientY,
        startW: rect.width,
        startH: rect.height,
      };
    });

    win.addEventListener('mousedown', () => focusWindow(win));

    appWindowsContainer.appendChild(win);
    updateMenuAppName(title || href);
  }

  let resizeRaf = null;
  let lastMouseX = null;
  let lastMouseY = null;

  document.addEventListener('mousemove', (e) => {
    if (resizeState) {
      const { win, startX, startY, startW, startH } = resizeState;
      if (win.classList.contains('maximized')) {
        resizeState = null;
        return;
      }
      if (resizeRaf) cancelAnimationFrame(resizeRaf);
      resizeRaf = requestAnimationFrame(() => {
        resizeRaf = null;
        const dx = e.clientX - startX;
        const dy = e.clientY - startY;
        let w = Math.round(startW + dx);
        let h = Math.round(startH + dy);
        w = Math.min(MAX_W(), Math.max(MIN_W, w));
        h = Math.min(MAX_H(), Math.max(MIN_H, h));
        win.style.width = w + 'px';
        win.style.height = h + 'px';
      });
      return;
    }
    if (!dragState) return;
    const { win, startLeft, startTop, startClientX, startClientY } = dragState;
    if (win.classList.contains('maximized')) return;
    lastMouseX = e.clientX;
    lastMouseY = e.clientY;
    const dx = e.clientX - startClientX;
    const dy = e.clientY - startClientY;
    win.style.transform = `translate(${dx}px, ${dy}px)`;
  });

  function commitDragAndResize() {
    if (dragState) {
      const { win, startLeft, startTop, startClientX, startClientY } = dragState;
      const dx = (typeof lastMouseX === 'number' ? lastMouseX : startClientX) - startClientX;
      const dy = (typeof lastMouseY === 'number' ? lastMouseY : startClientY) - startClientY;
      const rect = appWindowsContainer.getBoundingClientRect();
      const maxLeft = Math.max(0, rect.width - 100);
      const maxTop = Math.max(0, rect.height - 80);
      const left = Math.max(0, Math.min(maxLeft, startLeft + dx));
      const top = Math.max(0, Math.min(maxTop, startTop + dy));
      win.style.left = left + 'px';
      win.style.top = top + 'px';
      win.style.transform = '';
      win.classList.remove('app-window-dragging');
      if (win.classList.contains('finder-window-dragging')) win.classList.remove('finder-window-dragging');
    }
    if (resizeState) {
      resizeState.win.classList.remove('app-window-resizing');
      if (resizeRaf) cancelAnimationFrame(resizeRaf);
      resizeRaf = null;
    }
    dragState = null;
    resizeState = null;
    lastMouseX = null;
    lastMouseY = null;
  }

  document.addEventListener('mouseup', (e) => {
    if (e.button === 0) commitDragAndResize();
  }, true);

  document.addEventListener('mouseleave', commitDragAndResize, true);

  function escapeHtml(s) {
    const div = document.createElement('div');
    div.textContent = s;
    return div.innerHTML;
  }
  function escapeAttr(s) {
    return String(s)
      .replace(/&/g, '&amp;')
      .replace(/"/g, '&quot;')
      .replace(/'/g, '&#39;')
      .replace(/</g, '&lt;')
      .replace(/>/g, '&gt;');
  }

  finderProjects.querySelector('.finder-btn.close').addEventListener('click', closeFinderProjects);
  finderProjects.querySelector('.finder-content').addEventListener('click', (e) => e.stopPropagation());

  // Finder title bar: drag to move, or just bring to front
  const finderTitlebar = finderProjects.querySelector('.finder-titlebar');
  finderTitlebar.addEventListener('mousedown', (e) => {
    if (e.button !== 0) return;
    if (e.target.closest('.finder-btn.close')) return;
    focusFinder();
    finderProjects.classList.add('finder-window-dragging');
    const left = parseFloat(finderProjects.style.left) || 0;
    const top = parseFloat(finderProjects.style.top) || 0;
    dragState = {
      win: finderProjects,
      startLeft: left,
      startTop: top,
      startClientX: e.clientX,
      startClientY: e.clientY,
    };
  });

  finderProjects.addEventListener('mousedown', (e) => {
    if (e.button !== 0) return;
    if (e.target.closest('.finder-btn.close')) return;
    if (!e.target.closest('.finder-titlebar')) focusFinder();
  });

  function renderFinderGrid(items) {
    finderProjectsContent.innerHTML = items.map((p) => {
      const color = p.color || '#6366f1';
      const icon = p.icon || 'fa-file';
      const docLink = escapeAttr(p.href);
      const label = escapeHtml(p.label);
      return `
        <button type="button" class="finder-grid-item" data-href="${docLink}" data-label="${escapeAttr(p.label)}">
          <div class="item-icon item-icon-fa" style="background:linear-gradient(145deg, ${color} 0%, ${adjustColor(color, 1.15)} 100%);">
            <i class="fa-solid ${icon}"></i>
          </div>
          <span class="item-label">${label}</span>
        </button>
      `;
    }).join('');

    finderProjectsContent.querySelectorAll('.finder-grid-item').forEach((btn) => {
      btn.addEventListener('click', () => {
        const href = btn.getAttribute('data-href');
        const label = btn.getAttribute('data-label');
        if (href === 'system-settings') openSystemSettingsWindow();
        else openInWindow(href, label);
      });
    });
  }

  function setFinderView(view) {
    finderView = view;
    finderProjects.querySelectorAll('.sidebar-item').forEach((el) => el.classList.remove('selected'));
    const side = finderProjects.querySelector('.sidebar-item[data-view="' + view + '"]');
    if (side) side.classList.add('selected');
    if (finderBreadcrumb) finderBreadcrumb.textContent = view === 'recents' ? 'Recents' : 'Projects';
    if (view === 'recents') renderFinderGrid(recents);
    else renderFinderGrid(PROJECTS);
  }

  finderProjects.querySelectorAll('.sidebar-item[data-view]').forEach((el) => {
    el.addEventListener('click', () => setFinderView(el.getAttribute('data-view')));
  });

  function adjustColor(hex, factor) {
    const n = parseInt(hex.slice(1), 16);
    const r = Math.min(255, Math.round(((n >> 16) & 0xff) * factor));
    const g = Math.min(255, Math.round(((n >> 8) & 0xff) * factor));
    const b = Math.min(255, Math.round((n & 0xff) * factor));
    return `#${(1 << 24 | r << 16 | g << 8 | b).toString(16).slice(1)}`;
  }

  let lastClickTarget = null;
  let lastClickTime = 0;
  const DOUBLE_CLICK_MS = 400;

  desktopIcons.addEventListener('click', (e) => {
    const icon = e.target.closest('.desktop-icon');
    if (!icon) return;
    const now = Date.now();
    const isDouble = lastClickTarget === icon && now - lastClickTime < DOUBLE_CLICK_MS;
    lastClickTarget = icon;
    lastClickTime = now;
    if (isDouble) {
      const href = icon.getAttribute('data-href');
      const folder = icon.getAttribute('data-folder');
      const label = icon.getAttribute('data-label') || href;
      if (folder === 'projects') openFinderProjects();
      else if (href) openInWindow(href, label);
    } else {
      document.querySelectorAll('.desktop-icon.selected').forEach((el) => el.classList.remove('selected'));
      icon.classList.add('selected');
    }
  });

  desktop.addEventListener('click', (e) => {
    if (e.target === desktop || e.target === desktopIcons) {
      document.querySelectorAll('.desktop-icon.selected').forEach((el) => el.classList.remove('selected'));
      updateMenuAppName('Dashboard');
    }
  });

  dock.addEventListener('click', (e) => {
    const item = e.target.closest('.dock-item');
    if (!item) return;
    const href = item.getAttribute('data-href');
    const folder = item.getAttribute('data-folder');
    const icon = item.getAttribute('data-icon');
    const label = item.getAttribute('data-label') || href;
    if (icon === 'trash') return;
    if (folder === 'projects') openFinderProjects();
    else if (href) openInWindow(href, label);
  });

  // Menu bar: File opens Finder; Window minimizes focused window
  document.querySelectorAll('.menu-items .menu-item').forEach((el) => {
    el.addEventListener('click', (e) => {
      e.preventDefault();
      const menu = el.getAttribute('data-menu');
      if (menu === 'file') openFinderProjects();
      else if (menu === 'window') {
        const focused = document.querySelector('.app-window.focused');
        if (focused) {
          const minBtn = focused.querySelector('.app-window-btn.minimize');
          if (minBtn) minBtn.click();
        } else if (finderProjects.classList.contains('open')) {
          focusFinder();
        }
      }
    });
  });

  setFinderView('projects');
})();
