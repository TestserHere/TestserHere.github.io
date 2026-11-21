/* Stargazing Tonight: rates each night from darkness, clouds and moonlight. */

(function () {
  'use strict';

  const { $, read, write, el, getJson } = window.V3Tools;
  const { setStatus, combobox } = window.V3Apps;
  const Sky = window.Sky;

  const PLACE_KEY = 'v3-stars-place';
  const STEP = 10 * 60 * 1000;
  const HOUR = 3600 * 1000;

  /* ---------- Places ---------- */

  combobox({
    input: $('place-search'),
    list: $('place-list'),
    async search(query) {
      const data = await getJson('https://geocoding-api.open-meteo.com/v1/search?count=6&language=en&name=' + encodeURIComponent(query));
      return (data.results || []).map((place) => ({
        name: place.name,
        area: [place.admin1, place.country].filter(Boolean).join(', '),
        lat: place.latitude,
        lng: place.longitude,
      }));
    },
    describe: (place) => ({ title: place.name, sub: place.area }),
    onPick: (place) => usePlace(place),
  });

  $('locate').addEventListener('click', () => {
    if (!navigator.geolocation) {
      setStatus($('status'), "This browser can't share your location. Search for a town instead.", 'problem');
      return;
    }
    setStatus($('status'), 'Finding you…', 'busy');
    navigator.geolocation.getCurrentPosition(
      (position) => usePlace({ name: 'Your location', area: '', lat: position.coords.latitude, lng: position.coords.longitude }),
      () => setStatus($('status'), "Couldn't get your location. Search for a town instead.", 'problem'),
      { timeout: 15000, maximumAge: 600000 },
    );
  });

  function usePlace(place) {
    write(PLACE_KEY, place);
    load(place);
  }

  /* ---------- Rating ---------- */

  let token = 0;

  async function load(place) {
    const mine = ++token;
    setStatus($('status'), 'Checking the sky over ' + place.name + '…', 'busy');
    try {
      const params = new URLSearchParams({
        latitude: place.lat.toFixed(3),
        longitude: place.lng.toFixed(3),
        hourly: 'cloud_cover,visibility,relative_humidity_2m,precipitation_probability',
        daily: 'sunrise,sunset',
        timezone: 'auto',
        timeformat: 'unixtime',
        past_days: '1',
        forecast_days: '5',
      });
      const data = await getJson('https://api.open-meteo.com/v1/forecast?' + params);
      if (mine !== token) return;
      const nights = buildNights(place, data);
      if (!nights.length) throw new Error('no nights');
      show(place, data.timezone, nights);
      setStatus($('status'), '');
    } catch (_) {
      if (mine === token) setStatus($('status'), "The forecast isn't loading right now. Try again in a minute.", 'problem');
    }
  }

  /* The forecast for the hour a moment falls in. Hours start on the local hour,
     which isn't always a whole UTC hour (Adelaide is UTC+10:30, for example). */
  function hourlyLookup(data) {
    const times = data.hourly.time.map((time) => time * 1000);
    return (time) => {
      const index = Math.floor((time - times[0]) / HOUR);
      if (index < 0 || index >= times.length) return null;
      return {
        cloud: data.hourly.cloud_cover[index],
        visibility: data.hourly.visibility[index],
        humidity: data.hourly.relative_humidity_2m[index],
        rain: data.hourly.precipitation_probability[index],
      };
    };
  }

  /* 0 to 1 for one moment of the night. */
  function rate(place, time, weather) {
    const sun = Sky.sunAltitude(new Date(time), place.lat, place.lng);
    const dark = sun < -18 ? 1 : sun < -12 ? 0.65 : sun < -6 ? 0.25 : 0;
    const moonUp = Sky.moonAltitude(new Date(time), place.lat, place.lng);
    const moon = Sky.moonLight(new Date(time));
    const moonGlow = moonUp > 0 ? moon.fraction * Math.min(1, 0.4 + moonUp / 30) : 0;
    const cloud = weather && weather.cloud != null ? weather.cloud / 100 : 0.5;
    const haze = weather && weather.humidity != null ? Math.max(0, (weather.humidity - 75) / 100) : 0;
    const rain = weather && weather.rain != null ? weather.rain / 100 : 0;
    const clear = Math.max(0, 1 - cloud) * (1 - haze) * (1 - rain * 0.6);
    return { score: dark * clear * (1 - 0.55 * moonGlow), sun, dark, moonUp, moon, cloud };
  }

  /* Each night runs from sunset to the next sunrise. */
  function buildNights(place, data) {
    const weather = hourlyLookup(data);
    const sunsets = data.daily.sunset.map((time) => time * 1000);
    const sunrises = data.daily.sunrise.map((time) => time * 1000);
    const now = Date.now();
    const nights = [];
    for (let i = 0; i < sunsets.length - 1; i++) {
      const start = sunsets[i];
      const end = sunrises[i + 1];
      if (!start || !end || end <= now) continue;
      const samples = [];
      for (let time = Math.max(start, nights.length ? start : Math.min(now, end)); time <= end; time += STEP) {
        const spot = weather(time);
        if (!spot && time > now + 2 * HOUR) continue;
        samples.push(Object.assign({ time }, rate(place, time, spot)));
      }
      if (!samples.length) continue;
      nights.push(summarise(start, end, samples));
      if (nights.length >= 4) break;
    }
    return nights;
  }

  function summarise(start, end, samples) {
    const darkSamples = samples.filter((sample) => sample.dark >= 0.65);
    const scored = samples.slice().sort((a, b) => b.score - a.score);
    const top = scored.slice(0, Math.max(1, Math.round(samples.length / 4)));
    const score = Math.round((top.reduce((sum, sample) => sum + sample.score, 0) / top.length) * 100);
    const darkSet = darkSamples.length ? darkSamples : samples;
    const cloud = Math.round((darkSet.reduce((sum, sample) => sum + sample.cloud, 0) / darkSet.length) * 100);
    const middle = samples[Math.floor(samples.length / 2)];
    const fullDark = samples.filter((sample) => sample.dark === 1);
    return {
      start,
      end,
      samples,
      score,
      cloud,
      best: scored[0],
      darkFrom: fullDark.length ? fullDark[0].time : null,
      darkTo: fullDark.length ? fullDark[fullDark.length - 1].time : null,
      moon: middle.moon,
      moonUpShare: samples.filter((sample) => sample.moonUp > 0 && sample.dark > 0).length / Math.max(1, samples.filter((sample) => sample.dark > 0).length),
    };
  }

  function verdict(score) {
    if (score >= 75) return 'Excellent';
    if (score >= 55) return 'Good';
    if (score >= 35) return 'Fair';
    if (score >= 15) return 'Poor';
    return 'Not tonight';
  }

  /* ---------- Showing ---------- */

  function show(place, timeZone, nights) {
    const clock = new Intl.DateTimeFormat(undefined, { hour: 'numeric', minute: '2-digit', timeZone });
    const hourOnly = new Intl.DateTimeFormat(undefined, { hour: 'numeric', timeZone });
    const weekday = new Intl.DateTimeFormat(undefined, { weekday: 'long', timeZone });
    const night = nights[0];
    const label = verdict(night.score);

    $('sky').hidden = false;
    $('place').textContent = [place.name, place.area].filter(Boolean).join(', ') + ' · ' + (night.start > Date.now() ? 'Tonight' : 'Right now');
    $('score').textContent = String(night.score);
    $('verdict').textContent = label;
    $('sky-card').dataset.level = label.toLowerCase().replace(/\s/g, '-');
    $('summary').textContent = sentence(night, clock);

    $('dark').textContent = night.darkFrom ? clock.format(night.darkFrom) + ' – ' + clock.format(night.darkTo) : 'Never fully dark';
    $('best').textContent = night.best.score > 0.05 ? clock.format(night.best.time) : '—';
    $('clouds').textContent = night.cloud + '%';
    drawMoon(night.moon, place.lat);
    $('moon-name').textContent = Sky.phaseName(night.moon.phase);
    $('moon-lit-text').textContent = Math.round(night.moon.fraction * 100) + '% lit';

    // One bar per hour.
    const box = $('hours');
    box.replaceChildren();
    night.samples.filter((sample, index) => index % 6 === 0).forEach((sample) => {
      const bar = el('div', 'hour');
      bar.setAttribute('role', 'listitem');
      const fill = el('span', 'hour-fill');
      fill.style.height = Math.max(4, Math.round(sample.score * 100)) + '%';
      fill.dataset.level = verdict(Math.round(sample.score * 100)).toLowerCase().replace(/\s/g, '-');
      bar.append(el('span', 'hour-track'), el('span', 'hour-label', hourOnly.format(sample.time).replace(/\s/g, '')), el('span', 'hour-cloud', Math.round(sample.cloud * 100) + '%'));
      bar.firstChild.appendChild(fill);
      bar.setAttribute('aria-label', clock.format(sample.time) + ': ' + Math.round(sample.score * 100) + ' out of 100, ' + Math.round(sample.cloud * 100) + '% cloud');
      box.appendChild(bar);
    });

    const list = $('nights');
    list.replaceChildren();
    nights.slice(1).forEach((other) => {
      const card = el('div', 'night');
      card.dataset.level = verdict(other.score).toLowerCase().replace(/\s/g, '-');
      card.append(el('span', '', weekday.format(other.start)), el('strong', '', String(other.score)), el('span', 'muted', verdict(other.score)));
      list.appendChild(card);
    });

    const tips = $('tips');
    tips.replaceChildren();
    tipsFor(night).forEach((tip) => tips.appendChild(el('li', '', tip)));

    if (window.IssPasses) window.IssPasses.show(place, timeZone, $('iss'), $('iss-note'));
  }

  function sentence(night, clock) {
    const parts = [];
    if (night.cloud <= 15) parts.push('Clear skies.');
    else if (night.cloud <= 40) parts.push('A few clouds around.');
    else if (night.cloud <= 70) parts.push('Patchy cloud, so look for gaps.');
    else parts.push('Mostly cloudy.');
    const lit = night.moon.fraction;
    if (lit < 0.1) parts.push('Hardly any moon, so faint stars will show.');
    else if (night.moonUpShare < 0.25) parts.push('The moon stays low or out of the way most of the night.');
    else if (lit > 0.85) parts.push('A bright moon will wash out fainter stars.');
    else if (lit > 0.4) parts.push('The moon will brighten the sky for part of the night.');
    else parts.push('A thin moon, so it won’t get in the way much.');
    if (night.best.score > 0.05) parts.push('Best around ' + clock.format(night.best.time) + '.');
    return parts.join(' ');
  }

  function tipsFor(night) {
    const tips = ['Give your eyes 20 minutes in the dark to adjust, and avoid looking at bright screens.'];
    if (night.moon.fraction > 0.6) tips.push('Bright moon tonight: it’s a great time to look at the moon itself with binoculars.');
    else tips.push('Find a spot away from street lights. Even a park can help a lot.');
    if (night.cloud > 50) tips.push('With this much cloud, check again later. Gaps can open up quickly.');
    tips.push('Planets don’t twinkle like stars do, which is how you can spot them.');
    return tips;
  }

  /* Draws the lit part of the moon. The southern hemisphere sees it the other way round. */
  function drawMoon(moon, lat) {
    const r = 17;
    const k = 2 * moon.fraction - 1;
    const waxing = moon.phase < 0.5;
    const rx = Math.abs(k) * r;
    const d = 'M20 3 A' + r + ' ' + r + ' 0 0 1 20 37 A' + rx.toFixed(2) + ' ' + r + ' 0 0 ' + (k > 0 ? 1 : 0) + ' 20 3Z';
    const path = $('moon-lit');
    path.setAttribute('d', d);
    const mirror = waxing === lat < 0;
    path.setAttribute('transform', mirror ? 'translate(40 0) scale(-1 1)' : '');
  }

  const savedPlace = read(PLACE_KEY, null);
  if (savedPlace && typeof savedPlace.lat === 'number' && typeof savedPlace.lng === 'number') load(savedPlace);
  else setStatus($('status'), 'Search for a town or use your location to see tonight’s sky.');
})();
