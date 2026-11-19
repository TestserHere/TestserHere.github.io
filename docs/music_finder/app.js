/* Music Finder: the page. The music services themselves are in sources.js. */

(function () {
  'use strict';

  const { $, read, write, el, setupTabs } = window.V3Tools;
  const Music = window.MusicSources;

  const STATE_KEY = 'v3-music-state';
  const SAVED_KEY = 'v3-music-saved';
  const HIDDEN_KEY = 'v3-music-hidden';
  const MAX_SEEDS = 3;
  const PAGE = 20;

  const saved0 = read(STATE_KEY, {});
  const state = {
    mode: saved0.mode === 'genre' ? 'genre' : 'songs',
    seeds: Array.isArray(saved0.seeds) ? saved0.seeds.filter((seed) => seed && seed.title && seed.artist).slice(0, MAX_SEEDS) : [],
    genre: typeof saved0.genre === 'string' ? saved0.genre : '',
    source: Music.SOURCES.some((source) => source.id === saved0.source) ? saved0.source : 'deezer',
  };
  let savedSongs = read(SAVED_KEY, []);
  if (!Array.isArray(savedSongs)) savedSongs = [];

  /* "Less like this": songs and artists to leave out of results. */
  const hidden0 = read(HIDDEN_KEY, {});
  const hidden = {
    songs: Array.isArray(hidden0.songs) ? hidden0.songs.filter((key) => typeof key === 'string') : [],
    artists: Array.isArray(hidden0.artists) ? hidden0.artists.filter((artist) => artist && artist.key && artist.name) : [],
  };
  const saveHidden = () => write(HIDDEN_KEY, hidden);
  const hiddenArtists = () => new Set(hidden.artists.map((artist) => artist.key));

  function remember() {
    write(STATE_KEY, state);
  }

  const sourceById = (id) => Music.SOURCES.find((source) => source.id === id);

  /* ---------- Icons ---------- */

  const SVG = 'http://www.w3.org/2000/svg';
  const ICONS = {
    play: 'M8 5.5v13a1 1 0 0 0 1.5.86l10.4-6.5a1 1 0 0 0 0-1.72L9.5 4.64A1 1 0 0 0 8 5.5z',
    pause: 'M7 5h3.5v14H7zM13.5 5H17v14h-3.5z',
    video: 'M4 6.5A2.5 2.5 0 0 1 6.5 4h11A2.5 2.5 0 0 1 20 6.5v11a2.5 2.5 0 0 1-2.5 2.5h-11A2.5 2.5 0 0 1 4 17.5zM10 8.8v6.4l5.2-3.2z',
    heart: 'M12 20.3l-1.3-1.2C6 14.9 3 12.2 3 8.8 3 6.1 5.1 4 7.8 4c1.5 0 3 .7 4.2 1.9C13.2 4.7 14.7 4 16.2 4 18.9 4 21 6.1 21 8.8c0 3.4-3 6.1-7.7 10.3z',
    note: 'M9 18.5V6.2L19 4v11.3M9 18.5A2.5 2.5 0 1 1 6.5 16 2.5 2.5 0 0 1 9 18.5zM19 15.3a2.5 2.5 0 1 1-2.5-2.5 2.5 2.5 0 0 1 2.5 2.5z',
    thumb: 'M7.5 10.5v9h-3a1 1 0 0 1-1-1v-7a1 1 0 0 1 1-1zM7.5 10.5l3.8-6.6a1.9 1.9 0 0 1 3.5 1.2l-.6 4.4h5a2 2 0 0 1 2 2.4l-1.3 6.4a2 2 0 0 1-2 1.7H7.5',
  };

  function icon(name) {
    const svg = document.createElementNS(SVG, 'svg');
    svg.setAttribute('viewBox', '0 0 24 24');
    svg.setAttribute('aria-hidden', 'true');
    const path = document.createElementNS(SVG, 'path');
    path.setAttribute('d', ICONS[name]);
    svg.appendChild(path);
    return svg;
  }

  /* ---------- Mode, seeds and genres ---------- */

  const modeButtons = Array.from($('mode').querySelectorAll('button'));

  function showMode() {
    modeButtons.forEach((button) => button.setAttribute('aria-pressed', String(button.dataset.mode === state.mode)));
    $('songs-box').hidden = state.mode !== 'songs';
    $('genre-box').hidden = state.mode !== 'genre';
    refreshGo();
  }

  modeButtons.forEach((button) => button.addEventListener('click', () => {
    state.mode = button.dataset.mode;
    remember();
    showMode();
  }));

  function renderSeeds() {
    const list = $('seeds');
    list.replaceChildren();
    state.seeds.forEach((seed, index) => {
      const item = el('li', 'seed');
      const art = el('span', 'seed-art');
      if (seed.art) art.style.backgroundImage = 'url("' + seed.art.replace(/"/g, '%22') + '")';
      else art.appendChild(icon('note'));
      const text = el('span', 'seed-text');
      text.append(el('strong', '', seed.title), el('span', '', seed.artist));
      const remove = el('button', 'seed-remove', '×');
      remove.type = 'button';
      remove.setAttribute('aria-label', 'Remove ' + seed.title);
      remove.addEventListener('click', () => {
        state.seeds.splice(index, 1);
        remember();
        renderSeeds();
        $('song-search').focus();
      });
      item.append(art, text, remove);
      list.appendChild(item);
    });
    list.hidden = !state.seeds.length;
    const full = state.seeds.length >= MAX_SEEDS;
    $('search-wrap').hidden = full;
    $('song-search').placeholder = state.seeds.length ? 'Add another song (optional)' : 'Search for a song or artist';
    refreshGo();
  }

  function addSeed(song) {
    if (state.seeds.length >= MAX_SEEDS) return;
    if (!state.seeds.some((seed) => Music.keyOf(seed) === Music.keyOf(song))) {
      state.seeds.push({ title: song.title, artist: song.artist, art: song.art || '' });
    }
    remember();
    renderSeeds();
  }

  function renderGenres() {
    const box = $('genres');
    box.replaceChildren();
    Music.GENRES.forEach((genre) => {
      const chip = el('button', 'chip', genre.name);
      chip.type = 'button';
      chip.setAttribute('aria-pressed', String(state.genre === genre.name));
      chip.addEventListener('click', () => {
        state.genre = state.genre === genre.name ? '' : genre.name;
        $('genre-other').value = '';
        remember();
        renderGenres();
        refreshGo();
      });
      box.appendChild(chip);
    });
  }

  $('genre-other').value = Music.GENRES.some((genre) => genre.name === state.genre) ? '' : state.genre;
  $('genre-other').addEventListener('input', (event) => {
    state.genre = event.target.value.trim();
    remember();
    renderGenres();
    refreshGo();
  });
  $('genre-other').addEventListener('keydown', (event) => {
    if (event.key === 'Enter' && !$('go').disabled) run();
  });

  /* ---------- Song search box ---------- */

  const search = $('song-search');
  const suggestions = $('suggestions');
  let suggestTimer = 0;
  let suggestToken = 0;
  let found = [];
  let active = -1;

  function closeSuggestions() {
    suggestions.hidden = true;
    suggestions.replaceChildren();
    found = [];
    search.setAttribute('aria-expanded', 'false');
    search.removeAttribute('aria-activedescendant');
    active = -1;
  }

  function highlight(index) {
    active = index;
    Array.from(suggestions.children).forEach((item, i) => item.setAttribute('aria-selected', String(i === index)));
    if (index >= 0) search.setAttribute('aria-activedescendant', 'suggestion-' + index);
    else search.removeAttribute('aria-activedescendant');
  }

  function pick(song) {
    addSeed(song);
    search.value = '';
    closeSuggestions();
    if (!$('search-wrap').hidden) search.focus();
  }

  function showSuggestions(songs, message) {
    suggestions.replaceChildren();
    found = songs;
    if (message) {
      const note = el('li', 'suggestion-note', message);
      note.setAttribute('role', 'presentation');
      suggestions.appendChild(note);
    }
    songs.forEach((song, index) => {
      const item = el('li', 'suggestion');
      item.id = 'suggestion-' + index;
      item.setAttribute('role', 'option');
      const art = el('span', 'seed-art');
      if (song.art) art.style.backgroundImage = 'url("' + song.art.replace(/"/g, '%22') + '")';
      const text = el('span', 'seed-text');
      text.append(el('strong', '', song.title), el('span', '', song.artist));
      item.append(art, text);
      item.addEventListener('mousedown', (event) => event.preventDefault());
      item.addEventListener('click', () => pick(song));
      suggestions.appendChild(item);
    });
    suggestions.hidden = false;
    search.setAttribute('aria-expanded', 'true');
    highlight(-1);
  }

  search.addEventListener('input', () => {
    clearTimeout(suggestTimer);
    const query = search.value.trim();
    if (query.length < 2) { closeSuggestions(); return; }
    suggestTimer = setTimeout(async () => {
      const token = ++suggestToken;
      showSuggestions([], 'Searching…');
      try {
        const songs = await Music.searchSongs(query);
        if (token !== suggestToken) return;
        showSuggestions(songs, songs.length ? '' : 'No songs found. Try different words.');
      } catch (_) {
        if (token === suggestToken) showSuggestions([], "Search isn't working right now. Try again soon.");
      }
    }, 300);
  });

  search.addEventListener('keydown', (event) => {
    if (suggestions.hidden || !found.length) {
      if (event.key === 'Escape') closeSuggestions();
      return;
    }
    if (event.key === 'ArrowDown' || event.key === 'ArrowUp') {
      event.preventDefault();
      const step = event.key === 'ArrowDown' ? 1 : -1;
      highlight((active + step + found.length) % found.length);
    } else if (event.key === 'Enter') {
      event.preventDefault();
      pick(found[Math.max(0, active)]);
    } else if (event.key === 'Escape') {
      closeSuggestions();
    }
  });
  search.addEventListener('blur', () => setTimeout(closeSuggestions, 150));

  /* ---------- Sources ---------- */

  function renderSources() {
    const box = $('sources');
    box.replaceChildren();
    Music.SOURCES.forEach((source) => {
      const button = el('button', 'source');
      button.type = 'button';
      button.setAttribute('role', 'radio');
      button.setAttribute('aria-checked', String(state.source === source.id));
      button.tabIndex = state.source === source.id ? 0 : -1;
      button.dataset.source = source.id;
      button.append(el('strong', '', source.name), el('span', '', source.blurb));
      button.addEventListener('click', () => chooseSource(source.id, false));
      button.addEventListener('keydown', (event) => {
        const step = { ArrowDown: 1, ArrowRight: 1, ArrowUp: -1, ArrowLeft: -1 }[event.key];
        if (!step) return;
        event.preventDefault();
        const index = Music.SOURCES.indexOf(source);
        const next = Music.SOURCES[(index + step + Music.SOURCES.length) % Music.SOURCES.length];
        chooseSource(next.id, false);
        box.querySelector('[data-source="' + next.id + '"]').focus();
      });
      box.appendChild(button);
    });
  }

  /* Picking a new source after a search asks it straight away. */
  function chooseSource(id, scroll) {
    if (state.source === id && current) return;
    state.source = id;
    remember();
    renderSources();
    if (current) run(scroll);
  }

  function refreshGo() {
    const ready = state.mode === 'songs' ? state.seeds.length > 0 : !!state.genre;
    $('go').disabled = !ready;
  }

  /* ---------- Finding music ---------- */

  const cache = new Map();
  let current = null;
  let runToken = 0;

  function queryKey() {
    if (state.mode === 'songs') return 'songs|' + state.seeds.map(Music.keyOf).sort().join('+');
    return 'genre|' + Music.norm(state.genre);
  }

  function describe() {
    if (state.mode === 'genre') return state.genre;
    const titles = state.seeds.map((seed) => '“' + seed.title + '”');
    return titles.length > 1 ? titles.slice(0, -1).join(', ') + ' and ' + titles[titles.length - 1] : titles[0];
  }

  async function run(scroll = true) {
    if ($('go').disabled) return;
    const source = sourceById(state.source);
    const key = source.id + '|' + queryKey();
    const token = ++runToken;
    stopAudio();

    $('results-area').hidden = false;
    $('results-title').textContent = 'From ' + source.name;
    $('results').replaceChildren();
    $('more').hidden = true;
    setStatus('Asking ' + source.name + '…', true);
    renderSwitch(source);
    $('go').disabled = true;
    if (scroll) $('results-area').scrollIntoView({ behavior: 'smooth', block: 'start' });

    try {
      let entry = cache.get(key);
      if (!entry) {
        const pool = state.mode === 'songs'
          ? await source.like(state.seeds.slice())
          : await source.genre(Music.findGenre(state.genre));
        entry = { songs: pool.list(), shown: new Set() };
        if (token !== runToken) return;
        cache.set(key, entry);
      }
      if (token !== runToken) return;
      current = { key, entry, source };
      showPage();
    } catch (error) {
      if (token !== runToken) return;
      current = { key, entry: null, source };
      const message = error instanceof Music.SourceError
        ? error.message
        : source.name + " isn't answering right now.";
      setStatus(message + ' Try another source below.', false, true);
      $('switch').classList.add('is-urgent');
    } finally {
      if (token === runToken) refreshGo();
    }
  }

  function showPage() {
    const { entry, source } = current;
    const options = () => ({
      seeds: state.mode === 'songs' ? state.seeds : [],
      exclude: new Set([...entry.shown, ...hidden.songs]),
      avoidArtists: hiddenArtists(),
      count: PAGE,
    });
    let picked = Music.choose(entry.songs, options());
    if (picked.length < 6 && entry.shown.size) {
      // Seen them all: start again from the top.
      entry.shown.clear();
      picked = Music.choose(entry.songs, options());
    }
    picked.forEach((song) => entry.shown.add(Music.keyOf(song)));
    renderSongs($('results'), picked, true);
    $('more').hidden = entry.songs.length <= picked.length;
    if (!picked.length) {
      setStatus(source.name + " didn't find anything for " + describe() + '. Try another source below.', false, true);
      $('switch').classList.add('is-urgent');
    } else {
      setStatus(picked.length + ' songs for ' + describe() + '.');
      $('switch').classList.remove('is-urgent');
    }
  }

  function setStatus(text, busy, problem) {
    const status = $('status');
    status.textContent = text;
    status.classList.toggle('is-busy', !!busy);
    status.classList.toggle('is-problem', !!problem);
  }

  function renderSwitch(source) {
    const box = $('switch-chips');
    box.replaceChildren();
    $('switch').classList.remove('is-urgent');
    Music.SOURCES.filter((other) => other.id !== source.id).forEach((other) => {
      const chip = el('button', 'chip', other.name);
      chip.type = 'button';
      chip.addEventListener('click', () => chooseSource(other.id, true));
      box.appendChild(chip);
    });
  }

  $('go').addEventListener('click', () => run());
  $('more').addEventListener('click', () => {
    if (!current || !current.entry) return;
    stopAudio();
    showPage();
    $('results-area').scrollIntoView({ behavior: 'smooth', block: 'start' });
  });

  /* ---------- Song lists ---------- */

  const isSaved = (song) => savedSongs.some((item) => Music.keyOf(item) === Music.keyOf(song));

  function toggleSaved(song) {
    if (isSaved(song)) {
      savedSongs = savedSongs.filter((item) => Music.keyOf(item) !== Music.keyOf(song));
    } else {
      const { score, ...keep } = song;
      savedSongs.unshift(keep);
      savedSongs = savedSongs.slice(0, 300);
    }
    write(SAVED_KEY, savedSongs);
    renderSaved();
    document.querySelectorAll('.song').forEach((row) => {
      if (row.dataset.key === Music.keyOf(song)) {
        const heart = row.querySelector('.song-save');
        heart.setAttribute('aria-pressed', String(isSaved(song)));
      }
    });
  }

  const searchLink = (base, song) => base + encodeURIComponent(song.artist + ' ' + song.title);

  function renderSongs(list, songs, showReason) {
    list.replaceChildren();
    songs.forEach((song) => {
      const row = el('li', 'song');
      row.dataset.key = Music.keyOf(song);
      row.dataset.artist = Music.norm(song.artist);

      const play = el('button', 'song-art');
      play.type = 'button';
      if (song.art) play.style.backgroundImage = 'url("' + String(song.art).replace(/"/g, '%22') + '")';
      play.setAttribute('aria-label', (song.youtube ? 'Watch ' : 'Play a preview of ') + song.title);
      play.appendChild(icon(song.youtube ? 'video' : 'play'));
      play.addEventListener('click', () => playSong(song, row));

      const meta = el('div', 'song-meta');
      meta.append(el('strong', 'song-title', song.title), el('span', 'song-artist', song.artist));
      if (showReason && song.reason) meta.appendChild(el('span', 'song-why', song.reason));

      const links = el('div', 'song-links');
      const up = el('button', 'thumb');
      up.type = 'button';
      up.title = 'More like this';
      up.setAttribute('aria-label', 'More like ' + song.title);
      up.appendChild(icon('thumb'));
      up.addEventListener('click', () => moreLike(song));
      const down = el('button', 'thumb is-down');
      down.type = 'button';
      down.title = 'Less like this';
      down.setAttribute('aria-label', 'Less like ' + song.title);
      down.appendChild(icon('thumb'));
      down.addEventListener('click', () => lessLike(song, row));
      const youtube = el('a', '', 'YouTube');
      youtube.href = song.youtube ? 'https://www.youtube.com/watch?v=' + song.youtube : searchLink('https://www.youtube.com/results?search_query=', song);
      const spotify = el('a', '', 'Spotify');
      spotify.href = searchLink('https://open.spotify.com/search/', song);
      [youtube, spotify].forEach((link) => { link.target = '_blank'; link.rel = 'noopener'; });
      links.append(up, down, youtube, spotify);
      meta.appendChild(links);

      const heart = el('button', 'song-save');
      heart.type = 'button';
      heart.setAttribute('aria-label', 'Save ' + song.title);
      heart.setAttribute('aria-pressed', String(isSaved(song)));
      heart.appendChild(icon('heart'));
      heart.addEventListener('click', () => toggleSaved(song));

      row.append(play, meta, heart);
      list.appendChild(row);
    });
  }

  function renderSaved() {
    renderSongs($('saved'), savedSongs, false);
    $('saved-empty').hidden = savedSongs.length > 0;
    $('tab-saved').textContent = savedSongs.length ? 'Saved (' + savedSongs.length + ')' : 'Saved';
  }

  /* Hides the song and leaves its artist out of future results, with a way to undo. */
  function lessLike(song, row) {
    const songKey = Music.keyOf(song);
    const artistKey = Music.norm(song.artist);
    if (!hidden.songs.includes(songKey)) hidden.songs = hidden.songs.concat(songKey).slice(-500);
    if (!hidden.artists.some((artist) => artist.key === artistKey)) hidden.artists = hidden.artists.concat({ key: artistKey, name: song.artist }).slice(-200);
    saveHidden();
    renderHidden();
    if (playingRow && playingRow.dataset.artist === artistKey) stopAudio();

    // Other songs by the same artist go too.
    const removed = [];
    row.parentNode.querySelectorAll('.song').forEach((other) => {
      if (other !== row && other.dataset.artist === artistKey) {
        removed.push([other, other.nextSibling]);
        other.remove();
      }
    });
    const note = el('li', 'song-hidden');
    note.setAttribute('role', 'status');
    note.appendChild(el('span', '', 'Got it. You’ll see less from ' + song.artist + '.'));
    const undo = el('button', 'link-button', 'Undo');
    undo.type = 'button';
    undo.addEventListener('click', () => {
      unhide(artistKey, songKey);
      note.replaceWith(row);
      removed.forEach(([other, next]) => {
        if (next && next.parentNode) next.parentNode.insertBefore(other, next);
        else row.parentNode.appendChild(other);
      });
    });
    note.appendChild(undo);
    row.replaceWith(note);
  }

  function unhide(artistKey, songKey) {
    hidden.artists = hidden.artists.filter((artist) => artist.key !== artistKey);
    if (songKey) hidden.songs = hidden.songs.filter((key) => key !== songKey);
    else hidden.songs = hidden.songs.filter((key) => key.split('|')[0] !== artistKey);
    saveHidden();
    renderHidden();
  }

  function renderHidden() {
    const box = $('hidden-artists');
    box.replaceChildren();
    hidden.artists.slice().reverse().forEach((artist) => {
      const chip = el('button', 'chip hidden-chip');
      chip.type = 'button';
      chip.setAttribute('aria-label', 'Show ' + artist.name + ' again');
      chip.append(artist.name, el('span', '', '×'));
      chip.addEventListener('click', () => unhide(artist.key));
      box.appendChild(chip);
    });
    $('hidden-box').hidden = !hidden.artists.length;
  }

  $('hidden-clear').addEventListener('click', () => {
    hidden.songs = [];
    hidden.artists = [];
    saveHidden();
    renderHidden();
  });

  function moreLike(song) {
    state.mode = 'songs';
    state.seeds = [{ title: song.title, artist: song.artist, art: song.art || '' }];
    remember();
    tabs.show('find');
    showMode();
    renderSeeds();
    window.scrollTo({ top: 0, behavior: 'smooth' });
    run(false);
  }

  /* ---------- Playing ---------- */

  const audio = new Audio();
  audio.preload = 'none';
  let playingRow = null;

  function markPlaying(row, on) {
    if (!row) return;
    row.classList.toggle('is-playing', on);
    const button = row.querySelector('.song-art');
    if (!button || button.querySelector('.is-video')) return;
    button.replaceChild(icon(on ? 'pause' : 'play'), button.querySelector('svg'));
  }

  function stopAudio() {
    audio.pause();
    markPlaying(playingRow, false);
    playingRow = null;
  }

  audio.addEventListener('ended', stopAudio);
  audio.addEventListener('error', () => {
    if (playingRow) flash(playingRow, "That preview won't play.");
    stopAudio();
  });

  function flash(row, text) {
    const old = row.querySelector('.song-flash');
    if (old) old.remove();
    const note = el('span', 'song-flash', text);
    note.setAttribute('role', 'status');
    row.querySelector('.song-meta').appendChild(note);
    setTimeout(() => note.remove(), 4000);
  }

  async function playSong(song, row) {
    if (song.youtube) {
      stopAudio();
      openPlayer(song);
      return;
    }
    if (playingRow === row) { stopAudio(); return; }
    stopAudio();
    closePlayer();
    let preview = song.preview;
    if (!preview) {
      flash(row, 'Looking for a preview…');
      preview = await Music.findPreview(song);
      song.preview = preview;
    }
    if (!preview) {
      flash(row, 'No preview for this one. Try the YouTube link.');
      return;
    }
    const old = row.querySelector('.song-flash');
    if (old) old.remove();
    audio.src = preview;
    playingRow = row;
    markPlaying(row, true);
    audio.play().catch(() => {
      flash(row, "That preview won't play.");
      stopAudio();
    });
  }

  function openPlayer(song) {
    const frame = el('iframe');
    frame.src = 'https://www.youtube-nocookie.com/embed/' + encodeURIComponent(song.youtube) + '?autoplay=1&rel=0';
    frame.title = song.title + ' by ' + song.artist;
    frame.allow = 'autoplay; encrypted-media; picture-in-picture';
    frame.allowFullscreen = true;
    $('player-frame').replaceChildren(frame);
    $('player-title').textContent = song.title + ' · ' + song.artist;
    $('player').hidden = false;
    document.body.classList.add('has-player');
  }

  function closePlayer() {
    $('player-frame').replaceChildren();
    $('player').hidden = true;
    document.body.classList.remove('has-player');
  }

  $('player-close').addEventListener('click', closePlayer);

  /* ---------- Links from other apps ----------
     ?song=Coldplay - Yellow&song=Radiohead - Creep&source=listenbrainz  or  ?genre=jazz&source=apple
     fills in the search and runs it straight away. */

  function startFromLink() {
    const params = new URLSearchParams(location.search);
    const source = params.get('source');
    if (source && sourceById(source)) {
      state.source = source;
      renderSources();
    }
    const songs = params.getAll('song')
      .map((text) => text.split(/\s+[-–—]\s+/))
      .filter((parts) => parts.length >= 2 && parts[0].trim() && parts.slice(1).join(' - ').trim())
      .slice(0, MAX_SEEDS)
      .map((parts) => ({ artist: parts[0].trim(), title: parts.slice(1).join(' - ').trim(), art: '' }));
    const genre = (params.get('genre') || '').trim().slice(0, 60);
    if (songs.length) {
      state.mode = 'songs';
      state.seeds = songs;
    } else if (genre) {
      state.mode = 'genre';
      state.genre = genre;
      const known = Music.GENRES.some((item) => item.name === genre);
      $('genre-other').value = known ? '' : genre;
      renderGenres();
    } else {
      return;
    }
    remember();
    tabs.show('find');
    showMode();
    renderSeeds();
    run();
  }

  /* ---------- Start ---------- */

  const tabs = setupTabs('v3-music-tab', () => { stopAudio(); });
  showMode();
  renderSeeds();
  renderGenres();
  renderSources();
  renderSaved();
  renderHidden();
  startFromLink();
})();
