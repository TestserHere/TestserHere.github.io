/* Higher or Lower: guess which topic got more Wikipedia page views in the last 30 days. */

(function () {
  'use strict';

  const { $, read, write } = window.V3Tools;

  const API = 'https://en.wikipedia.org/w/api.php';
  const BEST_KEY = 'v3-higher-best';
  const BATCH = 50;
  const reduceMotion = window.matchMedia('(prefers-reduced-motion: reduce)').matches;

  let queue = []; // titles not loaded yet, shuffled
  let ready = []; // loaded topics waiting to be shown
  let loading = null;
  let left = null;
  let right = null;
  let score = 0;
  let busy = false;
  let best = Number(read(BEST_KEY, 0)) || 0;

  const shuffle = (list) => {
    const copy = list.slice();
    for (let i = copy.length - 1; i > 0; i--) {
      const j = Math.floor(Math.random() * (i + 1));
      [copy[i], copy[j]] = [copy[j], copy[i]];
    }
    return copy;
  };

  /* Loads up to 50 topics in one request: views for the last 30 days, a picture and a short description. */
  async function loadBatch() {
    const titles = queue.splice(0, BATCH);
    if (!titles.length) return;
    const params = {
      action: 'query', format: 'json', formatversion: '2', origin: '*', redirects: '1',
      prop: 'pageviews|pageimages|description', pvipdays: '30', piprop: 'thumbnail', pithumbsize: '480',
      titles: titles.join('|'),
    };
    const pages = new Map();
    // Wikipedia may split the answer into parts; keep asking until it's all there.
    for (let part = 0; part < 6; part++) {
      const controller = new AbortController();
      const timer = setTimeout(() => controller.abort(), 15000);
      let data;
      try {
        const response = await fetch(API + '?' + new URLSearchParams(params), { signal: controller.signal });
        if (!response.ok) throw new Error('wiki ' + response.status);
        data = await response.json();
      } finally {
        clearTimeout(timer);
      }
      (data.query && data.query.pages || []).forEach((page) => {
        const known = pages.get(page.title) || {};
        pages.set(page.title, Object.assign(known, page, { pageviews: Object.assign({}, known.pageviews, page.pageviews) }));
      });
      if (!data.continue) break;
      Object.assign(params, data.continue);
    }
    const topics = [];
    pages.forEach((page) => {
      const days = Object.values(page.pageviews || {});
      const counted = days.filter((v) => typeof v === 'number');
      if (page.missing || counted.length < 20) return; // not enough days of data to be fair
      const views = Math.round((counted.reduce((a, b) => a + b, 0) / counted.length) * days.length);
      if (views < 1000) return;
      topics.push({ title: page.title, views, image: page.thumbnail ? page.thumbnail.source : '', desc: page.description || '' });
    });
    ready.push(...shuffle(topics));
  }

  async function nextTopic(different) {
    for (let tries = 0; tries < 4; tries++) {
      while (ready.length) {
        const topic = ready.shift();
        if (!different || (topic.title !== different.title && topic.views !== different.views)) {
          if (ready.length < 8 && queue.length && !loading) {
            loading = loadBatch().catch(() => {}).finally(() => { loading = null; });
          }
          return topic;
        }
      }
      if (!queue.length) queue = shuffle(window.HL_TOPICS);
      loading = loading || loadBatch().finally(() => { loading = null; });
      await loading;
    }
    throw new Error('no topics');
  }

  const format = (n) => n.toLocaleString();

  function showTopic(node, topic, revealed) {
    node.querySelector('.topic-name').textContent = topic.title;
    node.querySelector('.topic-desc').textContent = topic.desc ? topic.desc.charAt(0).toUpperCase() + topic.desc.slice(1) : '';
    const art = node.querySelector('.topic-art');
    art.style.backgroundImage = topic.image ? 'url("' + topic.image.replace(/"/g, '%22') + '")' : '';
    art.classList.toggle('is-empty', !topic.image);
    node.querySelector('.topic-views').textContent = revealed ? format(topic.views) + ' views' : '';
  }

  function render() {
    showTopic($('left'), left, true);
    showTopic($('right'), right, false);
    $('right').classList.remove('is-right', 'is-wrong');
    $('choose').hidden = false;
    $('score').textContent = score;
    $('best').textContent = best;
    $('higher').textContent = 'More than ' + left.title.replace(/ \(.*\)$/, '');
    $('lower').textContent = 'Fewer';
  }

  /* Counts the number up, then shows whether the guess was right. */
  function reveal(target, done) {
    const out = $('right').querySelector('.topic-views');
    if (reduceMotion) {
      out.textContent = format(target) + ' views';
      return done();
    }
    const start = performance.now();
    const length = 900;
    (function frame(now) {
      const t = Math.min(1, (now - start) / length);
      out.textContent = format(Math.round(target * (1 - Math.pow(1 - t, 3)))) + ' views';
      if (t < 1) requestAnimationFrame(frame);
      else done();
    })(start);
  }

  async function guess(higher) {
    if (busy || !left || !right) return;
    busy = true;
    $('choose').hidden = true;
    const right0 = right;
    const correct = higher ? right0.views > left.views : right0.views < left.views;
    let upcoming = null;
    const loadNext = nextTopic(right0).then((t) => { upcoming = t; }).catch(() => {});
    reveal(right0.views, async () => {
      $('right').classList.add(correct ? 'is-right' : 'is-wrong');
      if (!correct) {
        busy = false;
        return gameOver(right0);
      }
      score++;
      $('score').textContent = score;
      if (score > best) {
        best = score;
        write(BEST_KEY, best);
        $('best').textContent = best;
      }
      await new Promise((r) => setTimeout(r, reduceMotion ? 300 : 700));
      await loadNext;
      if (!upcoming) {
        busy = false;
        return setStatus("Couldn't load more topics. Check your connection and try again.", true);
      }
      left = right0;
      right = upcoming;
      render();
      busy = false;
    });
  }

  function gameOver(shown) {
    $('over').hidden = false;
    $('over-title').textContent = score === 0 ? 'Out first time!' : 'You scored ' + score;
    $('over-text').textContent = shown.title + ' had ' + format(shown.views) + ' views and ' + left.title + ' had ' + format(left.views) + '.'
      + (score > 0 && score === best ? ' That’s your best yet!' : '');
    $('again').focus({ preventScroll: true });
  }

  function setStatus(text, isError) {
    $('status').textContent = text;
    $('status').classList.toggle('is-error', !!isError);
  }

  async function start() {
    $('over').hidden = true;
    score = 0;
    setStatus(left ? '' : 'Loading topics…');
    try {
      left = await nextTopic(null);
      right = await nextTopic(left);
      setStatus('');
      $('versus').hidden = false;
      render();
    } catch (_) {
      setStatus("Couldn't reach Wikipedia. Check your connection and try again.", true);
    }
  }

  $('higher').addEventListener('click', () => guess(true));
  $('lower').addEventListener('click', () => guess(false));
  $('again').addEventListener('click', start);

  window.V3Keys.add([
    { keys: ['ArrowUp', 'h'], label: '↑ or H', does: 'More views', press: '#higher' },
    { keys: ['ArrowDown', 'l'], label: '↓ or L', does: 'Fewer views', press: '#lower' },
    { keys: ['Enter'], label: 'Enter', does: 'Play again', press: '#again' },
  ]);

  queue = shuffle(window.HL_TOPICS);
  start();
})();
