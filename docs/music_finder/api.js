/* Music Finder API: use Music Finder's recommendations in your own web app.

   <script src="https://testserhere.github.io/music_finder/api.js"></script>
   const result = await MusicFinder.recommend({ songs: [{ title: 'Yellow', artist: 'Coldplay' }] });

   Everything runs in the visitor's browser and asks the same free music services the
   Music Finder page does. No keys, no accounts. See api.html for the full guide. */

(function () {
  'use strict';

  const SOURCE_ORDER = ['deezer', 'listenbrainz', 'youtube', 'apple'];
  const here = (document.currentScript && document.currentScript.src) || location.href;

  // sources.js holds the real work. It's loaded from next to this file if the page doesn't have it yet.
  const ready = window.MusicSources
    ? Promise.resolve(window.MusicSources)
    : new Promise((resolve, reject) => {
      const script = document.createElement('script');
      script.src = new URL('sources.js', here).href;
      script.onload = () => (window.MusicSources ? resolve(window.MusicSources) : reject(new Error('Music Finder did not load.')));
      script.onerror = () => reject(new Error('Music Finder could not be loaded.'));
      document.head.appendChild(script);
    });

  const isSong = (song) => song && typeof song.title === 'string' && typeof song.artist === 'string' && song.title.trim() && song.artist.trim();

  /* The fields an app can rely on. Missing ones are empty strings. */
  function tidy(song, source) {
    return {
      title: song.title,
      artist: song.artist,
      art: song.art || '',
      preview: song.preview || '',
      youtube: song.youtube || '',
      link: song.link || '',
      reason: song.reason || '',
      source,
    };
  }

  /* options:
       songs        1 to 3 songs you like, each { title, artist }
       genre        or a genre, like 'rock' or 'shoegaze'
       source       'deezer', 'listenbrainz', 'youtube', 'apple' or 'auto' (the default: tries each until one works)
       count        how many songs to return, 1 to 50 (default 20)
       exclude      songs to leave out, each { title, artist }
       avoidArtists artist names to leave out
     Resolves to { source, songs: [{ title, artist, art, preview, youtube, link, reason, source }] }. */
  async function recommend(options) {
    const Music = await ready;
    const settings = options || {};
    const seeds = (Array.isArray(settings.songs) ? settings.songs : []).filter(isSong).slice(0, 3)
      .map((song) => ({ title: song.title.trim(), artist: song.artist.trim() }));
    const genre = typeof settings.genre === 'string' ? settings.genre.trim() : '';
    if (!seeds.length && !genre) throw new Error('MusicFinder.recommend needs songs or a genre.');

    const count = Math.min(50, Math.max(1, Math.floor(Number(settings.count) || 20)));
    const wanted = settings.source && settings.source !== 'auto' ? [settings.source] : SOURCE_ORDER;
    wanted.forEach((id) => {
      if (!Music.SOURCES.some((source) => source.id === id)) throw new Error('Unknown source "' + id + '". Use ' + SOURCE_ORDER.join(', ') + ' or auto.');
    });
    const exclude = new Set((Array.isArray(settings.exclude) ? settings.exclude : []).filter(isSong).map(Music.keyOf));
    const avoidArtists = new Set((Array.isArray(settings.avoidArtists) ? settings.avoidArtists : []).map(Music.norm));

    let lastError = null;
    for (const id of wanted) {
      const source = Music.SOURCES.find((item) => item.id === id);
      try {
        const pool = seeds.length ? await source.like(seeds) : await source.genre(Music.findGenre(genre));
        const picked = Music.choose(pool.list(), { seeds, exclude, avoidArtists, count });
        // With "auto", a source that finds very little hands over to the next one.
        if (picked.length >= Math.min(count, 5) || wanted.length === 1) {
          return { source: id, songs: picked.map((song) => tidy(song, id)) };
        }
      } catch (error) {
        lastError = error;
      }
    }
    throw lastError || new Error('No source found songs for that.');
  }

  /* Songs matching what someone typed, for building your own search box. */
  async function search(query) {
    const Music = await ready;
    const text = String(query || '').trim();
    if (!text) return [];
    return (await Music.searchSongs(text)).map((song) => tidy(song, 'search'));
  }

  /* A 30-second preview address for a song, or '' when there isn't one. */
  async function preview(song) {
    const Music = await ready;
    if (!isSong(song)) return '';
    return Music.findPreview(song);
  }

  async function sources() {
    const Music = await ready;
    return Music.SOURCES.map(({ id, name, blurb }) => ({ id, name, about: blurb }));
  }

  async function genres() {
    const Music = await ready;
    return Music.GENRES.map((genre) => genre.name);
  }

  /* A link that opens the Music Finder page with the search filled in and running. */
  function link(options) {
    const settings = options || {};
    const url = new URL('index.html', here);
    (Array.isArray(settings.songs) ? settings.songs : []).filter(isSong).slice(0, 3)
      .forEach((song) => url.searchParams.append('song', song.artist.trim() + ' - ' + song.title.trim()));
    if (!url.searchParams.has('song') && typeof settings.genre === 'string' && settings.genre.trim()) url.searchParams.set('genre', settings.genre.trim());
    if (settings.source && settings.source !== 'auto') url.searchParams.set('source', settings.source);
    return url.href;
  }

  window.MusicFinder = { version: 1, ready: ready.then(() => true), recommend, search, preview, sources, genres, link };
})();
