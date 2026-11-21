/* Song Snippet Quiz: name the song from a few seconds of its Deezer preview. */

(function () {
  'use strict';

  const { $, read, write, el } = window.V3Tools;
  const { deezer } = window.MusicSources;

  const KEY = 'v3-snippet';
  const ROUNDS = 10;
  const LENGTHS = [2, 5, 12]; // seconds you can hear, with 3, 2 and 1 points
  const MIXES = [
    { id: 'now', label: 'Top hits now', path: 'chart/0/tracks?limit=100' },
    { id: '80s', label: '80s', playlist: '80s Hits' },
    { id: '90s', label: '90s', playlist: '90s Hits' },
    { id: '00s', label: '2000s', playlist: '00s Hits' },
    { id: '10s', label: '2010s', playlist: '10s Hits' },
    { id: 'pop', label: 'Pop', path: 'chart/132/tracks?limit=100' },
    { id: 'rap', label: 'Hip-hop', path: 'chart/116/tracks?limit=100' },
    { id: 'rock', label: 'Rock', path: 'chart/152/tracks?limit=100' },
    { id: 'latin', label: 'Latin', path: 'chart/197/tracks?limit=100' },
    { id: 'kpop', label: 'K-pop', playlist: 'Top K-Pop' },
    { id: 'disney', label: 'Disney', playlist: 'Disney Hits (English Version)' },
  ];

  const saved = read(KEY, {});
  let mixId = MIXES.some((m) => m.id === saved.mix) ? saved.mix : 'now';
  const bests = saved.bests && typeof saved.bests === 'object' ? saved.bests : {};
  const remember = () => write(KEY, { mix: mixId, bests });

  const audio = new Audio();
  audio.preload = 'auto';
  let stopAt = 0;
  let game = null;

  /* "Song (feat. Someone) - Remastered 2011" becomes "Song". */
  const cleanTitle = (title) => String(title || '').replace(/\s*[([][^)\]]*(feat|with|remaster|version|edit|mix|live|from)[^)\]]*[)\]]/gi, '').replace(/\s+-\s+.*(remaster|version|edit|live|mono|stereo).*$/i, '').trim();
  const key = (track) => cleanTitle(track.title).toLowerCase() + '|' + track.artist.name.toLowerCase();

  async function loadTracks(mix) {
    let path = mix.path;
    if (mix.playlist) {
      const found = await deezer('search/playlist?q=' + encodeURIComponent(mix.playlist) + '&limit=10');
      const lists = found.data || [];
      const pick = lists.find((p) => p.title.toLowerCase() === mix.playlist.toLowerCase())
        || lists.find((p) => /deezer/i.test((p.user && p.user.name) || '')) || lists[0];
      if (!pick) throw new Error('no playlist');
      path = 'playlist/' + pick.id + '/tracks?limit=150';
    }
    const data = await deezer(path);
    const seen = new Set();
    return (data.data || []).filter((t) => {
      if (!t.preview || t.readable === false || !t.artist) return false;
      const k = key(t);
      if (seen.has(k)) return false;
      seen.add(k);
      return true;
    });
  }

  const shuffle = (list) => {
    const copy = list.slice();
    for (let i = copy.length - 1; i > 0; i--) {
      const j = Math.floor(Math.random() * (i + 1));
      [copy[i], copy[j]] = [copy[j], copy[i]];
    }
    return copy;
  };

  /* ---------- Setup ---------- */

  function showMixes() {
    $('mixes').replaceChildren(...MIXES.map((mix) => {
      const chip = el('button', 'chip', mix.label);
      chip.type = 'button';
      chip.setAttribute('aria-pressed', String(mix.id === mixId));
      chip.addEventListener('click', () => {
        mixId = mix.id;
        remember();
        showMixes();
      });
      return chip;
    }));
  }

  async function start() {
    const mix = MIXES.find((m) => m.id === mixId);
    $('start').disabled = true;
    $('setup-status').textContent = 'Getting songs…';
    try {
      const tracks = await loadTracks(mix);
      if (tracks.length < 8) throw new Error('too few');
      const picks = shuffle(tracks).slice(0, ROUNDS);
      game = { mix, tracks, picks, index: 0, score: 0, right: 0 };
      $('setup').hidden = true;
      $('over').hidden = true;
      $('play').hidden = false;
      $('setup-status').textContent = '';
      showRound();
    } catch (_) {
      $('setup-status').textContent = "Couldn't get songs from Deezer. Check your connection, or try a different mix.";
    } finally {
      $('start').disabled = false;
    }
  }

  /* ---------- Rounds ---------- */

  function showRound() {
    const track = game.picks[game.index];
    game.level = 0;
    game.answered = false;
    $('round').textContent = 'Song ' + (game.index + 1) + ' of ' + game.picks.length;
    $('progress').style.width = (game.index / game.picks.length) * 100 + '%';
    $('score').textContent = game.score;
    $('message').textContent = '';
    $('message').className = 'message';
    $('next').hidden = true;
    $('more').hidden = false;
    $('art').style.backgroundImage = '';
    $('listen').classList.remove('is-revealed');

    // Three wrong answers, by other artists where possible.
    const others = shuffle(game.tracks.filter((t) => t !== track && cleanTitle(t.title).toLowerCase() !== cleanTitle(track.title).toLowerCase()));
    const wrong = [];
    others.forEach((t) => {
      if (wrong.length < 3 && t.artist.name !== track.artist.name && !wrong.some((w) => w.artist.name === t.artist.name)) wrong.push(t);
    });
    others.forEach((t) => { if (wrong.length < 3 && !wrong.includes(t)) wrong.push(t); });
    const options = shuffle([track].concat(wrong));
    $('answers').replaceChildren(...options.map((t) => {
      const button = el('button', 'answer');
      button.type = 'button';
      button.append(el('strong', 'answer-title', cleanTitle(t.title)), el('span', 'answer-artist', t.artist.name));
      button.addEventListener('click', () => answer(t, button));
      button.dataset.right = String(t === track);
      return button;
    }));
    audio.src = track.preview;
    showLength();
    play();
  }

  function showLength() {
    const seconds = LENGTHS[game.level];
    $('length').textContent = game.answered ? 'Full preview' : seconds + (seconds === 1 ? ' second' : ' seconds') + ' · worth ' + (3 - game.level) + (game.level === 2 ? ' point' : ' points');
    $('more').hidden = game.answered || game.level >= LENGTHS.length - 1;
    $('more').textContent = game.level < LENGTHS.length - 1 ? 'Hear ' + LENGTHS[game.level + 1] + ' seconds' : '';
  }

  function play() {
    stopAt = game.answered ? 30 : LENGTHS[game.level];
    try { audio.currentTime = 0; } catch (_) { /* not loaded yet */ }
    audio.play().catch(() => { /* needs a tap first */ });
    $('listen').classList.add('is-playing');
  }

  audio.addEventListener('timeupdate', () => {
    if (audio.currentTime >= stopAt) audio.pause();
    const ring = $('ring');
    ring.style.setProperty('--done', Math.min(1, audio.currentTime / stopAt));
  });
  audio.addEventListener('pause', () => $('listen').classList.remove('is-playing'));
  audio.addEventListener('ended', () => $('listen').classList.remove('is-playing'));

  function answer(track, button) {
    if (!game || game.answered) return;
    game.answered = true;
    const right = game.picks[game.index];
    const correct = track === right;
    const got = correct ? 3 - game.level : 0;
    game.score += got;
    if (correct) game.right++;
    Array.from($('answers').children).forEach((b) => {
      b.disabled = true;
      if (b.dataset.right === 'true') b.classList.add('is-right');
      else if (b === button) b.classList.add('is-wrong');
      else b.classList.add('is-faded');
    });
    $('score').textContent = game.score;
    $('message').textContent = correct ? '+' + got + (got === 1 ? ' point' : ' points') : 'It was “' + cleanTitle(right.title) + '” by ' + right.artist.name + '.';
    $('message').className = 'message ' + (correct ? 'is-good' : 'is-bad');
    $('art').style.backgroundImage = right.album && right.album.cover_medium ? 'url("' + right.album.cover_medium + '")' : '';
    $('listen').classList.add('is-revealed');
    showLength();
    // Keep the song playing so you can enjoy it.
    stopAt = 30;
    if (audio.paused) audio.play().catch(() => {});
    $('next').hidden = false;
    $('next').textContent = game.index + 1 < game.picks.length ? 'Next song' : 'See your score';
    $('next').focus({ preventScroll: true });
  }

  function next() {
    if (!game) return;
    game.index++;
    if (game.index < game.picks.length) return showRound();
    audio.pause();
    $('play').hidden = true;
    $('over').hidden = false;
    const best = Math.max(bests[game.mix.id] || 0, game.score);
    bests[game.mix.id] = best;
    remember();
    $('over-title').textContent = game.score + ' points';
    $('over-text').textContent = game.right + ' of ' + game.picks.length + ' right with “' + game.mix.label + '”. '
      + (game.score === best ? 'Your best yet!' : 'Your best is ' + best + '.');
    $('again').focus({ preventScroll: true });
  }

  $('listen').addEventListener('click', () => {
    if (!game) return;
    if (!audio.paused) audio.pause();
    else play();
  });
  $('more').addEventListener('click', () => {
    if (!game || game.answered || game.level >= LENGTHS.length - 1) return;
    game.level++;
    showLength();
    play();
  });
  $('next').addEventListener('click', next);
  $('start').addEventListener('click', start);
  $('again').addEventListener('click', start);
  $('change').addEventListener('click', () => {
    audio.pause();
    $('over').hidden = true;
    $('play').hidden = true;
    $('setup').hidden = false;
  });

  window.V3Keys.add([
    { keys: ['1', '2', '3', '4'], label: '1 to 4', does: 'Choose an answer', press: (k) => '#answers > button:nth-child(' + k + ')' },
    { keys: [' '], label: 'Space', does: 'Play or replay the snippet', press: '#listen' },
    { keys: ['m'], label: 'M', does: 'Hear more', press: '#more' },
    { keys: ['Enter'], label: 'Enter', does: 'Start, next song, or play again', press: ['#next', '#start', '#again'] },
  ]);

  showMixes();
})();
