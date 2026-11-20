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
  // Other browsers play HLS streams through hls.js. HLS is often served from a nearby CDN, so it buffers less.
  const HLS_JS = 'https://cdn.jsdelivr.net/npm/hls.js@1.5.13/dist/hls.min.js';
  const canUseHlsJs = !canPlayHls && typeof MediaSource !== 'undefined';

  /* Only secure streams play on a secure page. */
  function playable(station) {
    const url = station.url_resolved || station.url || '';
    return url.startsWith('https://') && (canPlayHls || canUseHlsJs || !station.hls) && station.lastcheckok !== 0;
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
      hls: !!raw.hls || /\.m3u8(\?|$)/i.test(raw.url_resolved || raw.url || ''),
      codec: raw.codec || '',
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

  /* Smooth play for far-away stations.
     A normal audio player only keeps about 2 seconds of a live stream in hand, so any hiccup on a long
     connection is a stutter. When the station allows it (most do), the page downloads the stream itself
     and feeds the player, staying a few seconds behind live. That gives a real cushion: the download
     carries on during hiccups while the cushion plays. If the cushion ever runs out, it refills a bigger
     one before carrying on, rather than stuttering. Stations that don't allow it use the normal player. */
  const START_CUSHION = 6; // seconds of audio in hand before starting
  const REFILL_CUSHION = 10; // seconds after running dry
  const GIVE_UP_WAIT = 15000; // start anyway after this long, if some audio has arrived
  const STALL_RECONNECT = 15000; // no new audio for this long: reconnect
  const MAX_RECONNECTS = 3;
  const KEEP_BEHIND = 30; // seconds of already-played audio to keep before freeing memory

  let hls = null;
  let hlsLoading = null;
  let session = 0; // bumps on every new connection, so old downloads and timers stop
  let abort = null;
  let objectUrl = '';
  let mode = ''; // 'stream' (our own download), 'hls' or 'plain'
  let holding = false; // paused by us to build the cushion, not by the listener
  let cushion = START_CUSHION;
  let holdSince = 0;
  let lastData = 0;
  let lastTime = -1;
  let reconnects = 0;
  let watch = 0;
  let refills = 0;

  function bufferedAhead() {
    const ranges = audio.buffered;
    for (let i = 0; i < ranges.length; i++) {
      if (ranges.start(i) <= audio.currentTime + 0.5 && ranges.end(i) >= audio.currentTime) return ranges.end(i) - audio.currentTime;
    }
    return 0;
  }

  function loadHlsJs() {
    if (window.Hls) return Promise.resolve(window.Hls);
    if (!hlsLoading) {
      hlsLoading = new Promise((resolve, reject) => {
        const script = document.createElement('script');
        script.src = HLS_JS;
        script.onload = () => (window.Hls ? resolve(window.Hls) : reject(new Error('hls.js')));
        script.onerror = () => reject(new Error('hls.js'));
        document.head.appendChild(script);
      });
      hlsLoading.catch(() => { hlsLoading = null; });
    }
    return hlsLoading;
  }

  function detach() {
    clearInterval(watch);
    watch = 0;
    holding = false;
    mode = '';
    if (abort) {
      abort.abort();
      abort = null;
    }
    if (hls) {
      hls.destroy();
      hls = null;
    }
    if (objectUrl) {
      URL.revokeObjectURL(objectUrl);
      objectUrl = '';
    }
  }

  /* The kind of audio the page can feed to the player itself, or '' if it can't. */
  function streamType(contentType, codec) {
    if (typeof MediaSource === 'undefined') return '';
    const type = String(contentType || '').toLowerCase();
    const named = String(codec || '').toUpperCase();
    let wanted = '';
    if (/mpeg|mp3/.test(type) || (!/aac|ogg|opus|flac|html|xml|text/.test(type) && named === 'MP3')) wanted = 'audio/mpeg';
    else if (/aac/.test(type) || (!/mpeg|ogg|opus|flac|html|xml|text/.test(type) && /AAC/.test(named))) wanted = 'audio/aac';
    return wanted && MediaSource.isTypeSupported(wanted) ? wanted : '';
  }

  /* Downloads the stream and feeds it to the player. Throws if the station doesn't allow it. */
  async function startStream(station, mine) {
    if (typeof MediaSource === 'undefined' || !window.ReadableStream) throw new Error('unsupported');
    abort = new AbortController();
    const response = await fetch(station.url, { signal: abort.signal, cache: 'no-store' });
    if (mine !== session) return;
    const type = streamType(response.headers.get('content-type'), station.codec);
    if (!response.ok || !response.body || !type) {
      abort.abort();
      throw new Error('unsupported');
    }
    const source = new MediaSource();
    objectUrl = URL.createObjectURL(source);
    audio.src = objectUrl;
    await new Promise((resolve) => source.addEventListener('sourceopen', resolve, { once: true }));
    if (mine !== session) return;
    const buffer = source.addSourceBuffer(type);
    buffer.mode = 'sequence';
    mode = 'stream';
    const queue = [];

    function pump() {
      if (mine !== session || buffer.updating || source.readyState !== 'open') return;
      // Free audio that has already been played.
      const ranges = buffer.buffered;
      if (ranges.length && audio.currentTime - ranges.start(0) > KEEP_BEHIND + 10) {
        buffer.remove(ranges.start(0), audio.currentTime - KEEP_BEHIND);
        return;
      }
      if (!queue.length) return;
      const total = queue.reduce((sum, part) => sum + part.length, 0);
      const joined = new Uint8Array(total);
      let at = 0;
      queue.splice(0).forEach((part) => { joined.set(part, at); at += part.length; });
      try {
        buffer.appendBuffer(joined);
      } catch (error) {
        queue.unshift(joined);
        if (error.name === 'QuotaExceededError' && ranges.length) buffer.remove(ranges.start(0), Math.max(ranges.start(0) + 1, audio.currentTime - 5));
        else if (mine === session) usePlainPlayer(station);
      }
    }
    buffer.addEventListener('updateend', pump);

    /* Reads the download into the player. If the connection drops, it opens a new one straight away
       and carries on filling the same player, so the cushion keeps playing while it reconnects. */
    async function read(body) {
      const reader = body.getReader();
      try {
        for (;;) {
          const { done, value } = await reader.read();
          if (done || mine !== session) break;
          lastData = Date.now();
          queue.push(value);
          pump();
        }
      } catch (_) { /* the connection dropped */ }
      for (let attempt = 0; mine === session; attempt++) {
        await new Promise((resolve) => setTimeout(resolve, Math.min(4000, 500 * (attempt + 1))));
        if (mine !== session) return;
        try {
          const again = await fetch(station.url, { signal: abort.signal, cache: 'no-store' });
          if (again.ok && again.body) {
            read(again.body);
            return;
          }
        } catch (_) { /* still offline: try again shortly */ }
      }
    }
    read(response.body);
  }

  /* Used when the page's own download gets data the player can't use: the normal player instead. */
  function usePlainPlayer(station) {
    const mine = ++session;
    detach();
    mode = 'plain';
    lastData = Date.now();
    audio.src = station.url;
    audio.load();
    audio.play().catch(() => { /* the error event explains */ });
    watch = setInterval(() => check(mine), 250);
  }

  async function connect(station) {
    const mine = ++session;
    detach();
    lastData = Date.now();
    audio.preload = 'auto';
    hold(START_CUSHION);
    watch = setInterval(() => check(mine), 250);

    if (station.hls && !canPlayHls) {
      try {
        const Hls = await loadHlsJs();
        if (mine !== session) return;
        // A long buffer, and a few segments behind live, so there's always audio in hand.
        hls = new Hls({ maxBufferLength: 60, liveSyncDurationCount: 5, liveMaxLatencyDurationCount: 12 });
        hls.on(Hls.Events.FRAG_BUFFERED, () => { lastData = Date.now(); });
        let networkErrors = 0;
        hls.on(Hls.Events.ERROR, (_, data) => {
          if (!data.fatal || mine !== session) return;
          // A dead or expired stream link: say so now rather than retrying for a minute.
          if (/^manifest/i.test(data.details || '') || ++networkErrors > 2) showBroken();
          else if (data.type === Hls.ErrorTypes.NETWORK_ERROR) hls.startLoad();
          else if (data.type === Hls.ErrorTypes.MEDIA_ERROR) hls.recoverMediaError();
          else showBroken();
        });
        hls.loadSource(station.url);
        hls.attachMedia(audio);
        mode = 'hls';
      } catch (_) {
        if (mine === session) showBroken();
      }
      return;
    }

    if (!station.hls) {
      try {
        await startStream(station, mine);
        return;
      } catch (_) {
        if (mine !== session) return;
        if (objectUrl) {
          URL.revokeObjectURL(objectUrl);
          objectUrl = '';
        }
        abort = null;
      }
    }
    // The station doesn't allow it: the normal player, which only keeps about 2 seconds in hand.
    mode = 'plain';
    audio.src = station.url;
    audio.load();
    holding = false;
    audio.play().catch(() => { /* the error event explains */ });
  }

  /* Pauses (quietly) until `seconds` of audio are in hand. */
  function hold(seconds) {
    holding = true;
    cushion = seconds;
    holdSince = Date.now();
    if (!audio.paused) audio.pause();
  }

  function check(mine) {
    if (mine !== session || !playing) return;
    // The normal player: progress means the playback time is moving.
    if (mode === 'plain' && (audio.paused || audio.currentTime !== lastTime)) {
      lastTime = audio.currentTime;
      lastData = Date.now();
    }
    const ahead = bufferedAhead();
    if (holding && mode) {
      const waited = Date.now() - holdSince;
      const percent = Math.min(99, Math.round((ahead / cushion) * 100));
      $('now-state').textContent = cushion === START_CUSHION
        ? 'Connecting… ' + percent + '%'
        : (refills > 1 ? 'Slow connection to this station. Catching up… ' : 'Catching up… ') + percent + '%';
      if (mode === 'stream' && cushion === START_CUSHION && waited > 8000 && !audio.buffered.length && Date.now() - lastData < 2000) {
        // Data is arriving but none of it is playable.
        usePlainPlayer(playing);
        return;
      }
      if (ahead >= cushion || (waited > GIVE_UP_WAIT && ahead > 1)) {
        holding = false;
        audio.play().catch(() => { /* the error event explains */ });
      }
    } else if (mode !== 'plain' && !audio.paused && ahead < 0.25) {
      // Ran dry: build a bigger cushion rather than stuttering.
      refills++;
      hold(REFILL_CUSHION);
    }
    // Nothing new for a while: the connection has quietly died, so open it again.
    if (Date.now() - lastData > STALL_RECONNECT) {
      if (reconnects >= MAX_RECONNECTS) {
        showBroken();
        return;
      }
      reconnects++;
      $('now-state').textContent = 'Reconnecting…';
      connect(playing);
    }
  }

  function showBroken() {
    session++;
    detach();
    audio.pause();
    $('now-state').textContent = "This station isn't working right now. Try another.";
    markRows();
  }

  const isOn = () => !audio.paused || holding;

  function markRows() {
    document.querySelectorAll('.item').forEach((row) => {
      const on = !!playing && row.dataset.id === playing.id && isOn();
      row.classList.toggle('is-playing', on);
      const button = row.querySelector('.item-art');
      if (button) {
        button.replaceChild(icon(on ? 'pause' : 'play'), button.querySelector('svg'));
        button.setAttribute('aria-label', (on ? 'Pause ' : 'Play ') + row.querySelector('.item-title').textContent);
      }
    });
    const toggleButton = $('now-toggle');
    toggleButton.replaceChildren(icon(isOn() ? 'pause' : 'play'));
    toggleButton.setAttribute('aria-label', isOn() ? 'Pause' : 'Play');
  }

  function stop() {
    session++;
    detach();
    audio.pause();
    $('now-state').textContent = 'Paused';
    markRows();
  }

  function toggle(station) {
    if (playing && playing.id === station.id && isOn()) {
      stop();
      return;
    }
    play(station);
  }

  function play(station) {
    playing = station;
    reconnects = 0;
    refills = 0;
    $('now').hidden = false;
    document.body.classList.add('has-now');
    $('now-name').textContent = station.name;
    $('now-art').style.backgroundImage = station.icon ? cssUrl(station.icon) : '';
    $('now-art').replaceChildren(station.icon ? '' : icon('radio'));
    $('now-state').textContent = 'Connecting…';
    // Live radio: always join the broadcast where it is now.
    connect(station);
    // Radio Browser uses this to rank popular stations.
    api('/json/url/' + encodeURIComponent(station.id)).catch(() => {});
    markRows();
  }

  audio.addEventListener('playing', () => { $('now-state').textContent = 'Live'; markRows(); });
  audio.addEventListener('pause', () => { if (!holding) markRows(); });
  audio.addEventListener('error', () => {
    if (!playing) return;
    if (mode === 'stream') usePlainPlayer(playing); // the page's own download didn't decode: try the normal player
    else if (mode === 'plain') showBroken();
  });

  $('now-toggle').addEventListener('click', () => {
    if (!playing) return;
    if (isOn()) stop();
    else play(playing);
  });

  $('now-close').addEventListener('click', () => {
    session++;
    detach();
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

/* Keyboard shortcuts */
window.V3Keys.add([
  { keys: [' ', 'k'], label: 'Space or K', does: 'Play or pause', press: '#now-toggle' },
  { keys: ['Escape'], label: 'Esc', does: 'Stop', press: '#now-close' },
  { keys: ['/'], label: '/', does: 'Search stations', focus: '#name' },
  { keys: ['s'], label: 'S', does: 'Surprise me', press: '#surprise' },
]);
