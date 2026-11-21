/* When the International Space Station flies over: worked out on your device from its published orbit. */

window.IssPasses = (function () {
  'use strict';

  const { el, read, write } = window.V3Tools;

  const TLE_URL = 'https://celestrak.org/NORAD/elements/gp.php?CATNR=25544&FORMAT=TLE';
  const LIB_URL = 'https://cdn.jsdelivr.net/npm/satellite.js@5.0.0/dist/satellite.min.js';
  const TLE_KEY = 'v3-iss-tle';
  const DAYS = 5;
  const STEP = 20; // seconds between checks
  const MIN_ELEVATION = 10; // degrees above the horizon
  const EARTH_RADIUS = 6371; // km
  const RAD = Math.PI / 180;

  let library = null;
  function loadLibrary() {
    if (window.satellite) return Promise.resolve(window.satellite);
    library = library || new Promise((resolve, reject) => {
      const script = document.createElement('script');
      script.src = LIB_URL;
      script.onload = () => (window.satellite ? resolve(window.satellite) : reject(new Error('no library')));
      script.onerror = () => { library = null; reject(new Error('library failed')); };
      document.head.appendChild(script);
    });
    return library;
  }

  /* The orbit changes slowly, so it's kept for 12 hours (CelesTrak asks people not to fetch it too often). */
  async function loadOrbit() {
    const saved = read(TLE_KEY, null);
    if (saved && saved.lines && Date.now() - saved.at < 12 * 3600 * 1000) return saved.lines;
    try {
      const controller = new AbortController();
      const timer = setTimeout(() => controller.abort(), 15000);
      const response = await fetch(TLE_URL, { signal: controller.signal });
      clearTimeout(timer);
      if (!response.ok) throw new Error('orbit ' + response.status);
      const lines = (await response.text()).split(/\r?\n/).map((l) => l.trim()).filter((l) => /^[12] /.test(l));
      if (lines.length < 2) throw new Error('bad orbit');
      write(TLE_KEY, { at: Date.now(), lines: lines.slice(0, 2) });
      return lines.slice(0, 2);
    } catch (error) {
      if (saved && saved.lines && Date.now() - saved.at < 7 * 86400 * 1000) return saved.lines; // older is still close enough
      throw error;
    }
  }

  /* Direction of the sun as a unit vector, in the same frame the station's position comes in. */
  function sunVector(date) {
    const d = date / 86400000 - 10957.5; // days since 1 January 2000, noon
    const mean = (357.5291 + 0.98560028 * d) * RAD;
    const lon = mean + (1.9148 * Math.sin(mean) + 0.02 * Math.sin(2 * mean) + 0.0003 * Math.sin(3 * mean)) * RAD + (102.9372 + 180) * RAD;
    const tilt = 23.4397 * RAD;
    return { x: Math.cos(lon), y: Math.sin(lon) * Math.cos(tilt), z: Math.sin(lon) * Math.sin(tilt) };
  }

  /* The station shines only when sunlight reaches it, not when it's in Earth's shadow. */
  function sunlit(position, date) {
    const s = sunVector(date);
    const along = position.x * s.x + position.y * s.y + position.z * s.z;
    if (along > 0) return true;
    const r2 = position.x * position.x + position.y * position.y + position.z * position.z;
    return Math.sqrt(r2 - along * along) > EARTH_RADIUS;
  }

  const COMPASS = ['N', 'NNE', 'NE', 'ENE', 'E', 'ESE', 'SE', 'SSE', 'S', 'SSW', 'SW', 'WSW', 'W', 'WNW', 'NW', 'NNW'];
  const NAMES = { N: 'north', NNE: 'north-northeast', NE: 'northeast', ENE: 'east-northeast', E: 'east', ESE: 'east-southeast', SE: 'southeast', SSE: 'south-southeast',
    S: 'south', SSW: 'south-southwest', SW: 'southwest', WSW: 'west-southwest', W: 'west', WNW: 'west-northwest', NW: 'northwest', NNW: 'north-northwest' };
  const compass = (degrees) => COMPASS[Math.round((((degrees % 360) + 360) % 360) / 22.5) % 16];

  /* Passes you can actually see: the station is high enough, sunlit, and your sky is dark. */
  async function find(place, from) {
    const sat = await loadLibrary();
    const [line1, line2] = await loadOrbit();
    const record = sat.twoline2satrec(line1, line2);
    const observer = { latitude: place.lat * RAD, longitude: place.lng * RAD, height: 0.05 };
    const passes = [];
    let pass = null;
    const end = from + DAYS * 86400000;
    for (let t = from; t <= end; t += STEP * 1000) {
      const date = new Date(t);
      const state = sat.propagate(record, date);
      if (!state.position) continue;
      const look = sat.ecfToLookAngles(observer, sat.eciToEcf(state.position, sat.gstime(date)));
      const elevation = look.elevation / RAD;
      if (elevation >= MIN_ELEVATION) {
        const seen = sunlit(state.position, t) && window.Sky.sunAltitude(date, place.lat, place.lng) < -6;
        if (!pass) pass = { start: t, startAz: look.azimuth / RAD, max: 0, seenFrom: 0, seenTo: 0 };
        if (elevation > pass.max) { pass.max = elevation; pass.maxAt = t; pass.maxAz = look.azimuth / RAD; }
        if (seen) {
          if (!pass.seenFrom) { pass.seenFrom = t; pass.seenAz = look.azimuth / RAD; }
          pass.seenTo = t;
          pass.endAz = look.azimuth / RAD;
        }
      } else if (pass) {
        if (pass.seenFrom && pass.seenTo - pass.seenFrom >= 60000) passes.push(pass);
        pass = null;
      }
    }
    return passes;
  }

  function describe(pass, clock, day) {
    const minutes = Math.max(1, Math.round((pass.seenTo - pass.seenFrom) / 60000));
    const from = compass(pass.seenAz);
    const to = compass(pass.endAz);
    const how = pass.max >= 60 ? 'Almost overhead' : pass.max >= 35 ? 'High in the sky' : 'Low in the sky';
    return {
      when: day.format(pass.seenFrom) + ', ' + clock.format(pass.seenFrom),
      text: how + ' for ' + minutes + (minutes === 1 ? ' minute' : ' minutes') + '. Look ' + NAMES[from] + ', it moves toward the ' + NAMES[to] + '.',
      high: Math.round(pass.max),
      level: pass.max >= 35 ? 'good' : 'fair',
    };
  }

  let token = 0;

  /* Fills the "Space station" box on the Stargazing page. */
  async function show(place, timeZone, box, note) {
    const mine = ++token;
    note.textContent = 'Working out when the space station flies over…';
    box.replaceChildren();
    try {
      const passes = await find(place, Date.now());
      if (mine !== token) return;
      const clock = new Intl.DateTimeFormat(undefined, { hour: 'numeric', minute: '2-digit', timeZone });
      const day = new Intl.DateTimeFormat(undefined, { weekday: 'long', timeZone });
      if (!passes.length) {
        note.textContent = 'The space station won’t be visible from here in the next ' + DAYS + ' days. It flies over in the dark only at certain times of year.';
        return;
      }
      passes.slice(0, 6).forEach((pass) => {
        const info = describe(pass, clock, day);
        const row = el('div', 'iss-pass');
        row.dataset.level = info.level;
        const text = el('div', 'iss-text');
        text.append(el('strong', '', info.when), el('span', '', info.text));
        row.append(text, el('span', 'iss-high', info.high + '°'));
        row.lastChild.setAttribute('aria-label', 'Up to ' + info.high + ' degrees high');
        box.appendChild(row);
      });
      note.textContent = 'It looks like a bright, steady star moving across the sky, with no blinking lights. The number is how high it gets (90° is straight up).';
    } catch (_) {
      if (mine === token) note.textContent = 'Couldn’t work out the space station’s passes right now.';
    }
  }

  return { show, find, sunlit };
})();
