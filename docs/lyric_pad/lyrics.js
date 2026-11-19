/* Lyric Pad: a songwriting notepad with rhymes and word ideas from Datamuse. */

(function () {
  'use strict';

  const { $, read, write, el, getJson } = window.V3Tools;
  const { setStatus } = window.V3Apps;

  const SONGS_KEY = 'v3-lyrics-songs';
  const CURRENT_KEY = 'v3-lyrics-current';

  const KINDS = [
    { id: 'rhyme', label: 'Rhymes', param: 'rel_rhy', bySyllables: true },
    { id: 'near', label: 'Near rhymes', param: 'rel_nry', bySyllables: true },
    { id: 'meaning', label: 'Same meaning', param: 'ml' },
    { id: 'sounds', label: 'Sounds like', param: 'sl' },
    { id: 'describe', label: 'Describes it', param: 'rel_jjb' },
    { id: 'next', label: 'Comes next', param: 'lc' },
  ];

  /* ---------- Songs ---------- */

  let songs = read(SONGS_KEY, []);
  if (!Array.isArray(songs) || !songs.length) songs = [newSong()];
  let current = songs.find((song) => song.id === read(CURRENT_KEY, '')) || songs[0];

  function newSong() {
    return { id: 's' + Date.now().toString(36) + Math.random().toString(36).slice(2, 6), title: '', text: '', updated: Date.now() };
  }

  function saveSongs() {
    write(SONGS_KEY, songs);
    write(CURRENT_KEY, current.id);
  }

  const songName = (song) => song.title.trim() || (song.text.trim().split('\n')[0] || '').slice(0, 30) || 'Untitled song';

  function showSongList() {
    const select = $('songs');
    select.replaceChildren();
    songs.slice().sort((a, b) => b.updated - a.updated).forEach((song) => {
      const option = el('option', '', songName(song));
      option.value = song.id;
      select.appendChild(option);
    });
    select.value = current.id;
  }

  function openSong(song) {
    current = song;
    $('title').value = song.title;
    $('lyrics').value = song.text;
    saveSongs();
    showSongList();
    countLines();
  }

  $('songs').addEventListener('change', (event) => {
    const song = songs.find((item) => item.id === event.target.value);
    if (song) openSong(song);
  });

  $('new-song').addEventListener('click', () => {
    const song = newSong();
    songs.push(song);
    openSong(song);
    $('title').focus();
  });

  $('delete-song').addEventListener('click', () => {
    if ((current.text.trim() || current.title.trim()) && !confirm('Delete “' + songName(current) + '”? This can’t be undone.')) return;
    songs = songs.filter((song) => song !== current);
    if (!songs.length) songs.push(newSong());
    openSong(songs.slice().sort((a, b) => b.updated - a.updated)[0]);
  });

  let saveTimer = 0;
  function changed() {
    current.title = $('title').value;
    current.text = $('lyrics').value;
    current.updated = Date.now();
    clearTimeout(saveTimer);
    saveTimer = setTimeout(() => {
      saveSongs();
      const select = $('songs');
      const option = Array.from(select.options).find((item) => item.value === current.id);
      if (option) option.textContent = songName(current);
    }, 400);
  }
  $('title').addEventListener('input', changed);

  /* ---------- Syllables ---------- */

  // A rule-of-thumb count: vowel groups, minus a silent e, never less than one.
  function syllables(word) {
    let text = word.toLowerCase().replace(/[^a-z]/g, '');
    if (!text) return 0;
    if (text.length <= 3) return 1;
    text = text.replace(/(?:[^laeiouy]es|ed|[^laeiouy]e)$/, '').replace(/^y/, '');
    const groups = text.match(/[aeiouy]{1,2}/g);
    return Math.max(1, groups ? groups.length : 1);
  }

  const lineSyllables = (line) => line.split(/[\s\-–—]+/).reduce((sum, word) => sum + syllables(word), 0);

  function countLines() {
    const lines = $('lyrics').value.split('\n');
    const gutter = $('gutter');
    gutter.replaceChildren();
    lines.forEach((line) => gutter.appendChild(el('span', '', line.trim() ? String(lineSyllables(line)) : '')));
    gutter.scrollTop = $('lyrics').scrollTop;
  }

  const lyrics = $('lyrics');
  lyrics.addEventListener('input', () => { changed(); countLines(); followCursor(); });
  lyrics.addEventListener('scroll', () => { $('gutter').scrollTop = lyrics.scrollTop; });
  ['click', 'keyup'].forEach((name) => lyrics.addEventListener(name, followCursor));

  /* ---------- Word helper ---------- */

  let kind = KINDS[0];
  let wordTimer = 0;
  let token = 0;

  function showKinds() {
    const box = $('kinds');
    box.replaceChildren();
    KINDS.forEach((item) => {
      const chip = el('button', 'chip', item.label);
      chip.type = 'button';
      chip.setAttribute('aria-pressed', String(item === kind));
      chip.addEventListener('click', () => {
        kind = item;
        showKinds();
        lookUp();
      });
      box.appendChild(chip);
    });
  }

  /* The word to help with: the one under the cursor, or the last word of the line above
     when you're starting a new line (that's the one you want to rhyme with). */
  function wordAtCursor() {
    const text = lyrics.value;
    const at = lyrics.selectionStart;
    const lineStart = text.lastIndexOf('\n', at - 1) + 1;
    const before = text.slice(lineStart, at);
    if (!before.trim()) {
      const above = text.slice(0, Math.max(0, lineStart - 1)).split('\n').reverse().find((line) => line.trim());
      return above ? lastWord(above) : '';
    }
    const left = text.slice(0, at).match(/[\p{L}']+$/u);
    const right = text.slice(at).match(/^[\p{L}']+/u);
    const word = (left ? left[0] : '') + (right ? right[0] : '');
    return word || lastWord(before);
  }

  function lastWord(line) {
    const words = line.match(/[\p{L}']+/gu);
    return words ? words[words.length - 1] : '';
  }

  function followCursor() {
    clearTimeout(wordTimer);
    wordTimer = setTimeout(() => {
      const word = wordAtCursor().replace(/^'+|'+$/g, '').toLowerCase();
      if (word && word !== $('word').value.trim().toLowerCase()) {
        $('word').value = word;
        lookUp();
      }
    }, 450);
  }

  $('word').addEventListener('input', () => {
    clearTimeout(wordTimer);
    wordTimer = setTimeout(lookUp, 400);
  });

  async function lookUp() {
    const word = $('word').value.trim().toLowerCase();
    const mine = ++token;
    const box = $('words');
    if (!word) {
      box.replaceChildren();
      setStatus($('status'), 'Tap a word in your lyrics, or type one above.');
      return;
    }
    setStatus($('status'), 'Finding ' + kind.label.toLowerCase() + ' for “' + word + '”…', 'busy');
    try {
      const results = await getJson('https://api.datamuse.com/words?md=s&max=80&' + kind.param + '=' + encodeURIComponent(word));
      if (mine !== token) return;
      showWords(results.filter((item) => item.word && item.word !== word));
      setStatus($('status'), results.length ? '' : 'Nothing found for “' + word + '”. Try another word or kind.');
    } catch (_) {
      if (mine === token) setStatus($('status'), "Word ideas aren't loading right now. Try again soon.", 'problem');
    }
  }

  function showWords(results) {
    const box = $('words');
    box.replaceChildren();
    if (!results.length) return;
    const groups = new Map();
    results.forEach((item) => {
      const key = kind.bySyllables ? (item.numSyllables || syllables(item.word)) : 0;
      if (!groups.has(key)) groups.set(key, []);
      groups.get(key).push(item.word);
    });
    [...groups.keys()].sort((a, b) => a - b).forEach((key) => {
      const group = el('div', 'word-group');
      if (kind.bySyllables) group.appendChild(el('span', 'word-group-label', key + (key === 1 ? ' syllable' : ' syllables')));
      const chips = el('div', 'chips');
      groups.get(key).forEach((word) => {
        const chip = el('button', 'chip', word);
        chip.type = 'button';
        chip.title = 'Add “' + word + '” to your lyrics';
        chip.addEventListener('click', () => insert(word));
        chips.appendChild(chip);
      });
      group.appendChild(chips);
      box.appendChild(group);
    });
  }

  /* Adds a word where the cursor is, with spaces around it as needed. */
  function insert(word) {
    const start = lyrics.selectionStart;
    const end = lyrics.selectionEnd;
    const text = lyrics.value;
    const before = text.slice(0, start);
    const after = text.slice(end);
    const lead = before && !/[\s(]$/.test(before) ? ' ' : '';
    const trail = after && !/^[\s.,!?;:)]/.test(after) ? ' ' : '';
    lyrics.value = before + lead + word + trail + after;
    const caret = (before + lead + word).length;
    lyrics.focus();
    lyrics.setSelectionRange(caret, caret);
    changed();
    countLines();
  }

  showKinds();
  openSong(current);
  setStatus($('status'), 'Tap a word in your lyrics, or type one above.');
})();
