/* Music Finder: the free music services it asks for ideas.
   None of them needs an API key, an account or a subscription.

   Every source has two finders:
     like(seeds)  - songs similar to 1 to 3 songs, each { title, artist }
     genre(genre) - songs in a genre, { name, deezer?, apple?, tag? }
   Both return a Pool of scored songs. choose() then picks a varied list from it. */

window.MusicSources = (function () {
  'use strict';

  const TIMEOUT = 12000;
  const enc = encodeURIComponent;
  const sleep = (ms) => new Promise((resolve) => setTimeout(resolve, ms));

  /* A problem worth showing to the visitor as it is. */
  class SourceError extends Error {}

  /* ---------- Fetching ---------- */

  async function getJson(url, ms = TIMEOUT) {
    const controller = new AbortController();
    const timer = setTimeout(() => controller.abort(), ms);
    try {
      const response = await fetch(url, { signal: controller.signal });
      if (!response.ok) throw new Error('HTTP ' + response.status);
      return await response.json();
    } finally {
      clearTimeout(timer);
    }
  }

  // Deezer doesn't allow browser fetches, but it does answer JSONP.
  let jsonpCount = 0;
  function jsonp(url, ms = TIMEOUT) {
    return new Promise((resolve, reject) => {
      const name = '__musicFinder' + (jsonpCount++);
      const script = document.createElement('script');
      const timer = setTimeout(() => finish(new Error('Timed out')), ms);
      function finish(error, data) {
        clearTimeout(timer);
        window[name] = function () { /* a late reply is ignored */ };
        script.remove();
        if (error) reject(error); else resolve(data);
      }
      window[name] = (data) => finish(null, data);
      script.onerror = () => finish(new Error('Could not load'));
      script.src = url + (url.includes('?') ? '&' : '?') + 'output=jsonp&callback=' + name;
      document.head.appendChild(script);
    });
  }

  // Deezer allows 50 requests every 5 seconds, so the page keeps under that.
  const deezerTimes = [];
  async function deezerSlot() {
    for (;;) {
      const now = Date.now();
      while (deezerTimes.length && now - deezerTimes[0] > 5000) deezerTimes.shift();
      if (deezerTimes.length < 40) {
        deezerTimes.push(now);
        return;
      }
      await sleep(5050 - (now - deezerTimes[0]));
    }
  }

  async function deezer(path) {
    await deezerSlot();
    const data = await jsonp('https://api.deezer.com/' + path);
    if (!data || data.error) throw new Error((data && data.error && data.error.message) || 'Deezer error');
    return data;
  }

  /* ---------- Songs ---------- */

  function norm(text) {
    return String(text || '')
      .toLowerCase()
      .replace(/\(.*?\)|\[.*?\]/g, ' ')
      .replace(/\b(feat|ft)\.?\s.*$/, ' ')
      .replace(/[^\p{L}\p{N}]+/gu, ' ')
      .trim();
  }

  const keyOf = (song) => norm(song.artist) + '|' + norm(song.title);

  function listNames(names) {
    const list = [...names];
    if (list.length <= 1) return list.join('');
    return list.slice(0, -1).join(', ') + ' and ' + list[list.length - 1];
  }

  /* Songs collect a score from every way they were found, plus the seeds that led to them. */
  class Pool {
    constructor(why) {
      this.songs = new Map();
      this.why = why;
    }
    add(song, score, via) {
      if (!song || !song.title || !song.artist) return;
      const key = keyOf(song);
      let entry = this.songs.get(key);
      if (!entry) {
        entry = Object.assign({}, song, { score: 0, via: new Set() });
        this.songs.set(key, entry);
      }
      entry.score += score;
      if (via) entry.via.add(via);
      // Keep whichever copy has a preview or artwork.
      if (!entry.preview && song.preview) entry.preview = song.preview;
      if (!entry.art && song.art) entry.art = song.art;
    }
    get size() { return this.songs.size; }
    list() {
      return [...this.songs.values()].map((song) => {
        const { via, score, ...rest } = song;
        return Object.assign(rest, { score, reason: this.why(listNames(via)) });
      });
    }
  }

  /* Picks a varied list: the best scores first, a little shuffled, at most two songs per artist. */
  function choose(candidates, options) {
    const { seeds = [], exclude = new Set(), avoidArtists = new Set(), count = 20, perArtist = 2 } = options || {};
    const seedKeys = new Set(seeds.map(keyOf));
    const ranked = candidates
      .filter((song) => !seedKeys.has(keyOf(song)) && !exclude.has(keyOf(song)) && !avoidArtists.has(norm(song.artist)))
      .map((song) => ({ song, rank: song.score * (0.7 + Math.random() * 0.6) }))
      .sort((a, b) => b.rank - a.rank);
    const perArtistCount = new Map();
    const picked = [];
    for (const { song } of ranked) {
      const artist = norm(song.artist);
      const used = perArtistCount.get(artist) || 0;
      if (used >= perArtist) continue;
      perArtistCount.set(artist, used + 1);
      picked.push(song);
      if (picked.length >= count) break;
    }
    return picked;
  }

  /* ---------- Genres shown as chips ---------- */

  const GENRES = [
    { name: 'Pop', deezer: 132, apple: 14, tag: 'pop' },
    { name: 'Rock', deezer: 152, apple: 21, tag: 'rock' },
    { name: 'Hip-Hop', deezer: 116, apple: 18, tag: 'hip hop' },
    { name: 'R&B', deezer: 165, apple: 15, tag: 'contemporary r&b' },
    { name: 'Dance', deezer: 113, apple: 17, tag: 'dance' },
    { name: 'Electronic', deezer: 106, apple: 7, tag: 'electronic' },
    { name: 'Alternative', deezer: 85, apple: 20, tag: 'alternative rock' },
    { name: 'Indie', apple: 20, tag: 'indie' },
    { name: 'Country', apple: 6, tag: 'country' },
    { name: 'Jazz', deezer: 129, apple: 11, tag: 'jazz' },
    { name: 'Classical', deezer: 98, apple: 5, tag: 'classical' },
    { name: 'Metal', deezer: 464, apple: 1153, tag: 'metal' },
    { name: 'Folk', deezer: 466, apple: 1289, tag: 'folk' },
    { name: 'Soul & Funk', deezer: 169, apple: 15, tag: 'soul' },
    { name: 'Reggae', deezer: 144, apple: 24, tag: 'reggae' },
    { name: 'Blues', deezer: 153, apple: 2, tag: 'blues' },
    { name: 'Latin', deezer: 197, apple: 12, tag: 'latin' },
    { name: 'K-Pop', apple: 51, tag: 'k-pop' },
    { name: 'Soundtrack', deezer: 173, apple: 16, tag: 'soundtrack' },
  ];

  /* Typed genres are matched to the chips where possible, so "hip hop" still gets the charts. */
  function findGenre(text) {
    const wanted = norm(text).replace(/ /g, '');
    if (!wanted) return null;
    const known = GENRES.find((genre) => norm(genre.name).replace(/ /g, '') === wanted);
    return known || { name: text.trim(), tag: text.trim().toLowerCase() };
  }

  /* ---------- Deezer ---------- */

  function fromDeezer(track) {
    if (!track || !track.artist) return null;
    return {
      id: 'dz:' + track.id,
      title: track.title_short || track.title,
      artist: track.artist.name,
      art: track.album && (track.album.cover_medium || track.album.cover),
      preview: track.preview || '',
      link: track.link,
    };
  }

  // Deezer's search finds nothing when it's given both artist:"" and track:"", so it gets plain words.
  async function deezerFindTrack(song) {
    const result = await deezer('search?limit=10&q=' + enc(song.artist + ' ' + song.title));
    const tracks = (result.data || []).filter((track) => track && track.artist);
    const sameArtist = tracks.filter((track) => norm(track.artist.name) === norm(song.artist));
    return sameArtist.find((track) => norm(track.title) === norm(song.title)) || sameArtist[0] || tracks[0] || null;
  }

  async function deezerFindArtist(seed) {
    const track = await deezerFindTrack(seed);
    return track ? track.artist : null;
  }

  async function deezerLike(seeds) {
    const pool = new Pool((names) => 'Similar to ' + names);
    const found = (await Promise.all(seeds.map((seed) => deezerFindArtist(seed).catch(() => null)))).filter(Boolean);
    if (!found.length) throw new SourceError("Deezer couldn't find those songs.");
    const seedArtists = new Set(found.map((artist) => norm(artist.name)));
    const relatedScores = new Map();

    await Promise.all(found.map(async (artist) => {
      const [radio, related] = await Promise.all([
        deezer('artist/' + artist.id + '/radio?limit=50').catch(() => ({ data: [] })),
        deezer('artist/' + artist.id + '/related?limit=15').catch(() => ({ data: [] })),
      ]);
      radio.data.forEach((track, index) => {
        const song = fromDeezer(track);
        if (!song) return;
        // The seed's own artist fills these mixes, so their songs count for less.
        const own = seedArtists.has(norm(song.artist)) ? 0.3 : 1;
        pool.add(song, 0.6 * own * (1 - index / 100), artist.name);
      });
      related.data.forEach((other, index) => {
        if (seedArtists.has(norm(other.name))) return;
        const entry = relatedScores.get(other.id) || { artist: other, score: 0, via: new Set() };
        entry.score += 1 - index / 20;
        entry.via.add(artist.name);
        relatedScores.set(other.id, entry);
      });
    }));

    // Artists related to more than one of your songs come first.
    const best = [...relatedScores.values()].sort((a, b) => b.score - a.score).slice(0, 10);
    await Promise.all(best.map(async ({ artist, score, via }) => {
      const top = await deezer('artist/' + artist.id + '/top?limit=4').catch(() => ({ data: [] }));
      top.data.forEach((track, index) => {
        via.forEach((name) => pool.add(fromDeezer(track), 1.5 * (score / via.size) * (1 - index * 0.15), name));
      });
    }));
    return pool;
  }

  async function deezerGenre(genre) {
    if (genre.deezer) {
      const pool = new Pool(() => 'Top ' + genre.name + ' on Deezer');
      const chart = await deezer('chart/' + genre.deezer + '/tracks?limit=100');
      chart.data.forEach((track, index) => pool.add(fromDeezer(track), 1 - index / 150));
      if (pool.size) return pool;
    }
    // Any other genre: songs from playlists named after it.
    const playlists = await deezer('search/playlist?limit=6&q=' + enc(genre.name));
    const lists = (playlists.data || []).filter((list) => list.nb_tracks >= 10).slice(0, 3);
    if (!lists.length) throw new SourceError('Deezer has no playlists for "' + genre.name + '".');
    const pool = new Pool((names) => 'From the playlist ' + names);
    await Promise.all(lists.map(async (list, listIndex) => {
      const tracks = await deezer('playlist/' + list.id + '/tracks?limit=60').catch(() => ({ data: [] }));
      tracks.data.forEach((track, index) => pool.add(fromDeezer(track), (1 - listIndex * 0.15) * (1 - index / 120), '“' + list.title + '”'));
    }));
    return pool;
  }

  /* Songs by an artist, for sources that only name artists. */
  async function songsByArtist(name, count) {
    const wanted = norm(name);
    try {
      // Several artists can share a name, so the one with the most fans wins.
      const result = await deezer('search/artist?limit=10&q=' + enc(name));
      const artist = (result.data || [])
        .filter((item) => norm(item.name) === wanted)
        .sort((a, b) => (b.nb_fan || 0) - (a.nb_fan || 0))[0];
      if (artist) {
        const top = await deezer('artist/' + artist.id + '/top?limit=' + count);
        const songs = (top.data || []).map(fromDeezer).filter(Boolean);
        if (songs.length) return songs;
      }
    } catch (_) { /* try Apple instead */ }
    try {
      const result = await getJson('https://itunes.apple.com/search?entity=song&attribute=artistTerm&limit=10&term=' + enc(name));
      return result.results.map(fromItunes).filter((song) => norm(song.artist) === wanted).slice(0, count);
    } catch (_) {
      return [];
    }
  }

  /* ---------- Apple Music (iTunes) ---------- */

  const STORE = (() => {
    const region = (navigator.language || '').split('-')[1];
    return region && /^[a-z]{2}$/i.test(region) ? region.toLowerCase() : 'us';
  })();

  function fromItunes(item) {
    return {
      id: 'it:' + item.trackId,
      title: item.trackName,
      artist: item.artistName,
      art: item.artworkUrl100 && item.artworkUrl100.replace('100x100', '200x200'),
      preview: item.previewUrl || '',
      link: item.trackViewUrl,
      genre: item.primaryGenreName,
    };
  }

  function fromAppleChart(entry) {
    const links = [].concat(entry.link || []).map((link) => link.attributes || {});
    const preview = links.find((link) => /audio/.test(link.type || '') || /preview/i.test(link['im:assetType'] || ''));
    const page = links.find((link) => /html/.test(link.type || '')) || links[0] || {};
    const images = [].concat(entry['im:image'] || []);
    return {
      id: 'ac:' + ((entry.id && entry.id.attributes && entry.id.attributes['im:id']) || entry['im:name'].label),
      title: entry['im:name'].label,
      artist: entry['im:artist'].label,
      art: images.length ? images[images.length - 1].label : '',
      preview: preview ? preview.href : '',
      link: page.href,
    };
  }

  // Apple's genre names, from most to least specific.
  const APPLE_GENRES = [
    [/k-?pop/, 51, 'K-Pop'], [/hip|rap/, 18, 'Hip-Hop'], [/r&b|soul|funk/, 15, 'R&B'], [/metal/, 1153, 'Metal'],
    [/alternative|indie|punk|grunge|emo/, 20, 'Alternative'], [/rock/, 21, 'Rock'], [/electro|house|techno|edm|trance/, 7, 'Electronic'],
    [/dance/, 17, 'Dance'], [/country|americana/, 6, 'Country'], [/jazz/, 11, 'Jazz'], [/classical|orchestr|opera/, 5, 'Classical'],
    [/folk/, 1289, 'Folk'], [/reggae|dancehall/, 24, 'Reggae'], [/blues/, 2, 'Blues'], [/latin|reggaeton|salsa/, 12, 'Latin'],
    [/soundtrack|film|anime|game/, 16, 'Soundtrack'], [/singer/, 10, 'Singer/Songwriter'], [/pop/, 14, 'Pop'],
  ];

  function appleGenre(name) {
    const text = String(name || '').toLowerCase();
    const match = APPLE_GENRES.find(([pattern]) => pattern.test(text));
    return match ? { id: match[1], name: match[2] } : null;
  }

  // Apple limits searches, so Deezer's album genre is the backup.
  async function deezerGenreName(seed) {
    try {
      const track = await deezerFindTrack(seed);
      if (!track || !track.album) return '';
      const album = await deezer('album/' + track.album.id);
      return ((album.genres && album.genres.data) || []).map((genre) => genre.name).join(' ');
    } catch (_) {
      return '';
    }
  }

  async function appleChart(id) {
    const url = (store) => 'https://itunes.apple.com/' + store + '/rss/topsongs/limit=100/genre=' + id + '/json';
    let data = await getJson(url(STORE)).catch(() => null);
    if (!data || !data.feed || !data.feed.entry) data = await getJson(url('us'));
    return [].concat((data.feed && data.feed.entry) || []).map(fromAppleChart);
  }

  async function itunesSearch(term, limit) {
    const data = await getJson('https://itunes.apple.com/search?entity=song&limit=' + limit + '&country=' + STORE + '&term=' + enc(term))
      .catch(() => getJson('https://itunes.apple.com/search?entity=song&limit=' + limit + '&term=' + enc(term)));
    return data.results.map(fromItunes);
  }

  async function appleLike(seeds) {
    const genres = new Map();
    await Promise.all(seeds.map(async (seed) => {
      const results = await itunesSearch(seed.artist + ' ' + seed.title, 3).catch(() => []);
      const genre = appleGenre(results.length ? results[0].genre : await deezerGenreName(seed));
      if (!genre) return;
      const entry = genres.get(genre.id) || { genre, seeds: [] };
      entry.seeds.push(seed.title);
      genres.set(genre.id, entry);
    }));
    if (!genres.size) throw new SourceError("Apple Music couldn't find those songs.");
    const pool = new Pool((names) => names);
    await Promise.all([...genres.values()].map(async ({ genre, seeds: titles }) => {
      const chart = await appleChart(genre.id).catch(() => []);
      const why = 'Top ' + genre.name + ', like ' + listNames(titles.map((title) => '“' + title + '”'));
      chart.forEach((song, index) => pool.add(song, titles.length * (1 - index / 150), why));
    }));
    if (!pool.size) throw new SourceError("Apple Music's charts aren't loading right now.");
    return pool;
  }

  async function appleGenreSongs(genre) {
    const match = genre.apple ? { id: genre.apple, name: genre.name } : appleGenre(genre.name);
    if (!match) throw new SourceError('Apple Music only has charts for main genres like Rock or Pop, not "' + genre.name + '".');
    const pool = new Pool(() => 'Top ' + match.name + ' on Apple Music');
    (await appleChart(match.id)).forEach((song, index) => pool.add(song, 1 - index / 150));
    return pool;
  }

  /* ---------- ListenBrainz (with MusicBrainz) ---------- */

  const LB_ALGORITHM = 'session_based_days_7500_session_300_contribution_5_threshold_10_limit_100_filter_True_skip_30';

  // MusicBrainz asks for no more than one request a second.
  let musicBrainzQueue = Promise.resolve();
  function musicBrainz(query) {
    const url = 'https://musicbrainz.org/ws/2/' + query + (query.includes('?') ? '&' : '?') + 'fmt=json';
    // When it's busy it says so, and a second try a moment later usually works.
    const run = musicBrainzQueue.then(() => getJson(url).catch(() => sleep(2000).then(() => getJson(url))));
    musicBrainzQueue = run.catch(() => null).then(() => sleep(1100));
    return run;
  }

  async function musicBrainzArtist(name) {
    const data = await musicBrainz('artist?limit=5&query=' + enc('artist:"' + name.replace(/"/g, '') + '"'));
    const artists = data.artists || [];
    return artists.find((artist) => norm(artist.name) === norm(name)) || artists[0] || null;
  }

  async function fillFromArtists(pool, artists, perArtist, enough) {
    for (let start = 0; start < artists.length && pool.size < enough; start += 6) {
      await Promise.all(artists.slice(start, start + 6).map(async ({ name, score, via }) => {
        const songs = await songsByArtist(name, perArtist);
        songs.forEach((song, index) => [].concat(via || [null]).forEach((seedName) => pool.add(song, score * (1 - index * 0.15), seedName)));
      }));
    }
  }

  async function listenBrainzLike(seeds) {
    const pool = new Pool((names) => 'Fans of ' + names + ' play this artist too');
    const seedNames = [...new Set(seeds.map((seed) => seed.artist))];
    const found = [];
    for (const name of seedNames) {
      const artist = await musicBrainzArtist(name).catch(() => null);
      if (artist) found.push(artist);
    }
    if (!found.length) throw new SourceError("MusicBrainz couldn't find those artists.");
    const seedIds = new Set(found.map((artist) => artist.id));
    const scores = new Map();

    await Promise.all(found.map(async (seedArtist) => {
      const similar = await getJson('https://labs.api.listenbrainz.org/similar-artists/json?algorithm=' + LB_ALGORITHM + '&artist_mbids=' + seedArtist.id).catch(() => []);
      const list = Array.isArray(similar) ? similar.filter((artist) => artist.artist_mbid && !seedIds.has(artist.artist_mbid)) : [];
      const top = list.length ? list[0].score : 1;
      list.slice(0, 25).forEach((artist) => {
        const entry = scores.get(artist.artist_mbid) || { name: artist.name, score: 0, via: [] };
        entry.score += artist.score / top;
        entry.via.push(seedArtist.name);
        scores.set(artist.artist_mbid, entry);
      });
    }));
    if (!scores.size) throw new SourceError("ListenBrainz doesn't have enough listening data for those artists yet.");

    const ranked = [...scores.values()].sort((a, b) => b.score - a.score).slice(0, 18);
    await fillFromArtists(pool, ranked, 3, 30);
    return pool;
  }

  async function listenBrainzGenre(genre) {
    const tag = (genre.tag || genre.name).toLowerCase().replace(/"/g, '');
    const data = await musicBrainz('artist?limit=60&query=' + enc('tag:"' + tag + '"'));
    const artists = (data.artists || []).filter((artist) => artist.type !== 'Orchestra' || tag === 'classical');
    if (!artists.length) throw new SourceError('MusicBrainz has no artists tagged "' + genre.name + '".');
    // Artists with more listener tags tend to be better known, so they're tried first.
    const ranked = artists
      .map((artist) => ({ name: artist.name, score: 0.5 + Math.random() * 0.5 + Math.min(1, (artist.tags || []).length / 10), via: null }))
      .sort((a, b) => b.score - a.score);
    const pool = new Pool(() => 'Tagged ' + genre.name.toLowerCase() + ' on MusicBrainz');
    await fillFromArtists(pool, ranked, 2, 30);
    if (!pool.size) throw new SourceError("Couldn't find songs for the artists tagged \"" + genre.name + '".');
    return pool;
  }

  /* ---------- YouTube (through public Invidious servers) ---------- */

  const YT_FALLBACK = ['https://yt.chocolatemoo53.com'];
  let ytServers = null;
  let ytWorking = null;

  async function youtubeServers() {
    if (ytServers) return ytServers;
    let listed = [];
    try {
      const data = await getJson('https://api.invidious.io/instances.json?sort_by=health', 8000);
      listed = data
        .filter(([, info]) => info && info.cors && info.api && info.type === 'https' && info.uri)
        .map(([, info]) => info.uri.replace(/\/$/, ''));
    } catch (_) { /* use the built-in list */ }
    ytServers = [...new Set(listed.concat(YT_FALLBACK))];
    return ytServers;
  }

  async function youtube(path) {
    const servers = await youtubeServers();
    const order = ytWorking ? [ytWorking].concat(servers.filter((server) => server !== ytWorking)) : servers;
    for (const server of order) {
      try {
        const data = await getJson(server + path, 10000);
        ytWorking = server;
        return data;
      } catch (_) {
        if (ytWorking === server) ytWorking = null;
      }
    }
    throw new SourceError('No YouTube server is answering right now. Try again later, or pick another source.');
  }

  const NOT_A_SONG = /playlist|full album|greatest hits|best songs|best of|top \d+|top songs|\bmix\b|mashup|compilation|\bhours?\b|non-?stop|medley|reaction|karaoke|tutorial|lesson|\bcover\b|slowed|sped up|8d audio|nightcore|podcast|interview|\blive (at|from|in)\b|concert|#shorts|\bvs\.?\b/i;
  const VIDEO_WORDS = /[([][^)\]]*(official|video|audio|lyric|visuali[sz]er|\bhd\b|4k|remaster|\bmv\b|m\/v)[^)\]]*[)\]]/gi;

  function fromVideo(video) {
    if (!video || !video.videoId || !video.title || NOT_A_SONG.test(video.title)) return null;
    if (video.lengthSeconds && (video.lengthSeconds < 90 || video.lengthSeconds > 600)) return null;
    let artist = String(video.author || '').replace(/\s*-\s*Topic$/i, '').replace(/VEVO$/i, '').replace(/^@/, '').trim();
    // "Artist | Song" keeps the song; "Song | Channel extras" drops the extras.
    const pieces = video.title.replace(VIDEO_WORDS, '').split(/\s*[|｜]\s*/).filter(Boolean);
    let title = (pieces.length > 1 && norm(pieces[0]) === norm(artist) ? pieces[1] : pieces[0] || '').replace(/\s{2,}/g, ' ').trim();
    const parts = title.match(/^(.+?)\s+[-–—]\s+(.+)$/);
    if (parts) {
      artist = parts[1].trim();
      title = parts[2].trim();
    }
    title = title.replace(/^["“'](.*)["”']$/, '$1').trim();
    if (!title || !artist) return null;
    return {
      id: 'yt:' + video.videoId,
      title,
      artist,
      art: 'https://i.ytimg.com/vi/' + video.videoId + '/mqdefault.jpg',
      youtube: video.videoId,
      link: 'https://www.youtube.com/watch?v=' + video.videoId,
    };
  }

  const RELATED_FIELDS = '?fields=recommendedVideos(videoId,title,author,lengthSeconds)';

  async function youtubeSearch(query) {
    const results = await youtube('/api/v1/search?type=video&q=' + enc(query));
    return Array.isArray(results) ? results.filter((item) => item.type === 'video' || item.videoId) : [];
  }

  async function youtubeLike(seeds) {
    const pool = new Pool((names) => 'Watched after ' + names);
    const seedKeys = new Set(seeds.map(keyOf));
    // Covers and other versions of your own songs aren't new music.
    const isSeedSong = (song) => seedKeys.has(keyOf(song)) || seeds.some((seed) => norm(song.title).startsWith(norm(seed.title)));
    let found = 0;
    // One at a time, so a slow server isn't flooded.
    for (const seed of seeds) {
      const results = await youtubeSearch(seed.artist + ' ' + seed.title);
      const wanted = norm(seed.title);
      const video = results.find((item) => norm(item.title).includes(wanted)) || results[0];
      if (!video) continue;
      found++;
      const details = await youtube('/api/v1/videos/' + video.videoId + RELATED_FIELDS).catch(() => null);
      const related = (details && details.recommendedVideos) || [];
      related.forEach((item, index) => {
        const song = fromVideo(item);
        if (song && !isSeedSong(song)) pool.add(song, 1 - index / 40, '“' + seed.title + '”');
      });
    }
    if (!found) throw new SourceError("YouTube couldn't find those songs.");
    return pool;
  }

  async function youtubeGenre(genre) {
    const pool = new Pool(() => genre.name + ' on YouTube');
    const results = await youtubeSearch(genre.name + ' songs official music video');
    results.forEach((item, index) => pool.add(fromVideo(item), 1 - index / 40));
    // Videos watched after the top results widen the list.
    const starts = results.filter((item) => fromVideo(item)).slice(0, 2);
    for (const item of starts) {
      const details = await youtube('/api/v1/videos/' + item.videoId + RELATED_FIELDS).catch(() => null);
      ((details && details.recommendedVideos) || []).forEach((video, index) => pool.add(fromVideo(video), 0.6 * (1 - index / 40)));
    }
    if (!pool.size) throw new SourceError('YouTube found no songs for "' + genre.name + '".');
    return pool;
  }

  /* ---------- Song search, for picking the songs you like ---------- */

  async function searchSongs(query) {
    try {
      const result = await deezer('search?limit=7&q=' + enc(query));
      const songs = result.data.map(fromDeezer).filter(Boolean);
      if (songs.length) return songs;
    } catch (_) { /* try Apple instead */ }
    return itunesSearch(query, 7);
  }

  /* A 30-second preview for a song found somewhere without one. */
  async function findPreview(song) {
    try {
      const track = await deezerFindTrack(song);
      if (track && track.preview && norm(track.artist.name) === norm(song.artist)) return track.preview;
    } catch (_) { /* try Apple instead */ }
    const results = await itunesSearch(song.artist + ' ' + song.title, 5).catch(() => []);
    const match = results.find((item) => norm(item.artist) === norm(song.artist) && item.preview) ||
      results.find((item) => item.preview && norm(item.title) === norm(song.title));
    return match ? match.preview : '';
  }

  const SOURCES = [
    { id: 'deezer', name: 'Deezer', blurb: 'Mixes and related artists. Good all-rounder, with previews.', like: deezerLike, genre: deezerGenre },
    { id: 'listenbrainz', name: 'ListenBrainz', blurb: 'What real listeners play together. Great for less famous artists.', like: listenBrainzLike, genre: listenBrainzGenre },
    { id: 'youtube', name: 'YouTube', blurb: 'What people watch next. Plays full songs.', like: youtubeLike, genre: youtubeGenre },
    { id: 'apple', name: 'Apple Music', blurb: 'Chart hits in the same genre as your songs.', like: appleLike, genre: appleGenreSongs },
  ];

  return { SOURCES, GENRES, SourceError, findGenre, choose, keyOf, norm, searchSongs, findPreview, deezer };
})();
