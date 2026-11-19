/* World Radio: live stations from the Radio Browser directory. */

(function () {
  'use strict';

  const { $, read, write, el, setupTabs, getJson } = window.V3Tools;
  const { icon, cssUrl, setStatus, savedList, itemRow } = window.V3Apps;

  const STATE_KEY = 'v3-radio-state';
  const GENRES = [
    ['Pop', 'pop'], ['Rock', 'rock'], ['Jazz', 'jazz'], ['Classical', 'classical'], ['Lo-fi', 'lofi'], ['Chill', 'chillout'],
    ['Dance', 'dance'], ['Hip-Hop', 'hiphop'], ['Electronic', 'electronic'], ['Ambient', 'ambient'], ['Country', 'country'],
    ['80s', '80s'], ['Oldies', 'oldies'], ['K-Pop', 'kpop'], ['News', 'news'], ['Talk', 'talk'],
  ];

  const saved0 = read(STATE_KEY, {});
  const state = {
    tag: typeof saved0.tag === 'string' ? saved0.tag : '',
    country: typeof saved0.country === 'string' ? saved0.country : '',
  };
  const remember = () => write(STATE_KEY, state);
  const favourites = savedList('v3-radio-saved', 200);

  /* ---------- Directory servers ---------- */

  let servers = null;
  async function api(path) {
    if (!servers) {
      try {
        const list = await getJson('https://all.api.radio-browser.info/json/servers', 6000);
        servers = [...new Set(list.map((server) => 'https://' + server.name))].sort(() => Math.random() - 0.5);
      } catch (_) {
        servers = [];
      }
      if (!servers.includes('https://de1.api.radio-browser.info')) servers.push('https://de1.api.radio-browser.info');
    }
    for (const server of servers.slice()) {
      try {
        return await getJson(server + path, 10000);
      } catch (_) {
        // Try the next server, and stop asking this one first.
        servers.push(servers.splice(servers.indexOf(server), 1)[0]);
      }
    }
    throw new Error('offline');
  }

  const canPlayHls = !!document.createElement('audio').canPlayType('application/vnd.apple.mpegurl');

  /* Only secure streams play on a secure page. */
  function playable(station) {
    const url = station.url_resolved || station.url || '';
    return url.startsWith('https://') && (canPlayHls || !station.hls) && station.lastcheckok !== 0;
  }

  function toStation(raw) {
    return {
      id: raw.stationuuid,
      name: (raw.name || 'Unnamed station').trim(),
      url: raw.url_resolved || raw.url,
      icon: /^https:\/\//.test(raw.favicon || '') ? raw.favicon : '',
      country: raw.country || '',
      code: raw.countrycode || '',
      tags: String(raw.tags || '').split(',').map((tag) => tag.trim()).filter(Boolean).slice(0, 3),
      bitrate: raw.bitrate || 0,
      homepage: /^https?:\/\//.test(raw.homepage || '') ? raw.homepage : '',
    };
  }

  /* ---------- Filters ---------- */

  function showGenres() {
    const box = $('genres');
    box.replaceChildren();
    GENRES.forEach(([label, tag]) => {
      const chip = el('button', 'chip', label);
      chip.type = 'button';
      chip.setAttribute('aria-pressed', String(state.tag === tag));
      chip.addEventListener('click', () => {
        state.tag = state.tag === tag ? '' : tag;
        remember();
        showGenres();
        search();
      });
      box.appendChild(chip);
    });
  }

  async function loadCountries() {
    try {
      const list = await api('/json/countries?order=stationcount&reverse=true&hidebroken=true');
      const select = $('country');
      list
        .filter((country) => country.iso_3166_1 && country.stationcount >= 5)
        .sort((a, b) => a.name.localeCompare(b.name))
        .forEach((country) => {
          const option = el('option', '', country.name);
          option.value = country.iso_3166_1;
          select.appendChild(option);
        });
      select.value = state.country;
      if (select.value !== state.country) state.country = '';
    } catch (_) { /* the list stays at Anywhere */ }
  }

  $('country').addEventListener('change', (event) => {
    state.country = event.target.value;
    remember();
    search();
  });

  let nameTimer = 0;
  $('name').addEventListener('input', () => {
    clearTimeout(nameTimer);
    nameTimer = setTimeout(search, 400);
  });

  /* ---------- Searching ---------- */

  let token = 0;
  function query(extra) {
    const params = new URLSearchParams({ limit: '60', hidebroken: 'true', is_https: 'true', order: 'clickcount', reverse: 'true' });
    if (state.tag) {
      params.set('tag', state.tag);
      params.set('tagExact', 'true');
    }
    if (state.country) params.set('countrycode', state.country);
    const name = $('name').value.trim();
    if (name) params.set('name', name);
    Object.entries(extra || {}).forEach(([key, value]) => params.set(key, value));
    return '/json/stations/search?' + params;
  }

  function describeSearch() {
    const parts = [];
    const genre = GENRES.find(([, tag]) => tag === state.tag);
    if (genre) parts.push(genre[0]);
    const name = $('name').value.trim();
    if (name) parts.push('“' + name + '”');
    const country = $('country').selectedOptions[0];
    if (state.country && country) parts.push('in ' + country.textContent);
    return parts.length ? parts.join(' ') : 'Most popular';
  }

  async function search() {
    const mine = ++token;
    $('results-title').textContent = describeSearch();
    setStatus($('status'), 'Tuning in…', 'busy');
    try {
      const list = await api(query());
      if (mine !== token) return;
      const stations = dedupe(list.filter(playable).map(toStation)).slice(0, 40);
      renderStations($('stations'), stations);
      setStatus($('status'), stations.length ? '' : 'No stations found. Try another genre or country.', stations.length ? '' : 'problem');
    } catch (_) {
      if (mine !== token) return;
      $('stations').replaceChildren();
      setStatus($('status'), "The station directory isn't answering. Try again in a minute.", 'problem');
    }
  }

  // Many stations are listed more than once.
  function dedupe(stations) {
    const seen = new Set();
    return stations.filter((station) => {
      const key = station.name.toLowerCase().replace(/[^a-z0-9]/g, '') + '|' + station.code;
      if (seen.has(key)) return false;
      seen.add(key);
      return true;
    });
  }

  $('surprise').addEventListener('click', async () => {
    setStatus($('status'), 'Finding a station…', 'busy');
    try {
      const list = (await api(query({ order: 'random', limit: '30' }))).filter(playable).map(toStation);
      if (!list.length) throw new Error('none');
      const station = list[0];
      $('results-title').textContent = 'Surprise';
      renderStations($('stations'), [station]);
      setStatus($('status'), '');
      play(station);
    } catch (_) {
      setStatus($('status'), "Couldn't find a station for that. Try fewer filters.", 'problem');
    }
  });

  /* ---------- Lists ---------- */

  const rows = new Map();

  function renderStations(list, stations) {
    list.replaceChildren();
    stations.forEach((station) => {
      const row = itemRow({
        art: station.icon,
        artButton: { label: 'Play ' + station.name, icon: 'play', onClick: () => toggle(station) },
        title: station.name,
        sub: [station.country, station.tags.join(', ')].filter(Boolean).join(' · '),
        why: station.bitrate ? station.bitrate + ' kbps' : '',
        links: station.homepage ? [{ text: 'Website', href: station.homepage }] : [],
        save: { label: 'Favourite ' + station.name, pressed: favourites.has(station.id), onToggle: () => favourites.toggle(station), isPressed: () => favourites.has(station.id) },
      });
      row.dataset.id = station.id;
      list.appendChild(row);
    });
    markRows();
  }

  function showFavourites() {
    const list = favourites.all();
    renderStations($('saved'), list);
    $('saved-empty').hidden = list.length > 0;
    $('tab-saved').textContent = list.length ? 'Favourites (' + list.length + ')' : 'Favourites';
  }
  favourites.onChange(showFavourites);

  /* ---------- Playing ---------- */

  const audio = new Audio();
  audio.preload = 'none';
  let playing = null;

  function markRows() {
    document.querySelectorAll('.item').forEach((row) => {
      const on = !!playing && row.dataset.id === playing.id && !audio.paused;
      row.classList.toggle('is-playing', on);
      const button = row.querySelector('.item-art');
      if (button) {
        button.replaceChild(icon(on ? 'pause' : 'play'), button.querySelector('svg'));
        button.setAttribute('aria-label', (on ? 'Pause ' : 'Play ') + row.querySelector('.item-title').textContent);
      }
    });
    const toggleButton = $('now-toggle');
    toggleButton.replaceChildren(icon(audio.paused ? 'play' : 'pause'));
    toggleButton.setAttribute('aria-label', audio.paused ? 'Play' : 'Pause');
  }

  function toggle(station) {
    if (playing && playing.id === station.id && !audio.paused) {
      audio.pause();
      return;
    }
    play(station);
  }

  function play(station) {
    playing = station;
    $('now').hidden = false;
    document.body.classList.add('has-now');
    $('now-name').textContent = station.name;
    $('now-art').style.backgroundImage = station.icon ? cssUrl(station.icon) : '';
    $('now-art').replaceChildren(station.icon ? '' : icon('radio'));
    $('now-state').textContent = 'Connecting…';
    // Live radio: always join the broadcast where it is now.
    audio.src = station.url;
    audio.play().catch(() => { /* the error event explains */ });
    // Radio Browser uses this to rank popular stations.
    api('/json/url/' + encodeURIComponent(station.id)).catch(() => {});
    markRows();
  }

  audio.addEventListener('playing', () => { $('now-state').textContent = 'Live'; markRows(); });
  audio.addEventListener('waiting', () => { $('now-state').textContent = 'Buffering…'; });
  audio.addEventListener('pause', () => { $('now-state').textContent = 'Paused'; markRows(); });
  audio.addEventListener('error', () => {
    if (!playing) return;
    $('now-state').textContent = "This station isn't working right now. Try another.";
    markRows();
  });

  $('now-toggle').addEventListener('click', () => {
    if (!playing) return;
    if (audio.paused) {
      play(playing);
    } else {
      audio.pause();
    }
  });

  $('now-close').addEventListener('click', () => {
    audio.pause();
    audio.removeAttribute('src');
    audio.load();
    playing = null;
    $('now').hidden = true;
    document.body.classList.remove('has-now');
    markRows();
  });

  setupTabs('v3-radio-tab');
  showGenres();
  showFavourites();
  loadCountries().then(search);
})();
