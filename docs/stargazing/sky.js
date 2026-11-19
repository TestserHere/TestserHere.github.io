/* Stargazing: where the sun and moon are, worked out with standard low-precision astronomy formulas
   (accurate to well under a degree, which is plenty for "is it dark yet?"). */

window.Sky = (function () {
  'use strict';

  const RAD = Math.PI / 180;
  const OBLIQUITY = RAD * 23.4397;
  const SUN_DISTANCE = 149598000; // km

  const daysSince2000 = (date) => date.valueOf() / 86400000 - 0.5 + 2440588 - 2451545;

  const rightAscension = (l, b) => Math.atan2(Math.sin(l) * Math.cos(OBLIQUITY) - Math.tan(b) * Math.sin(OBLIQUITY), Math.cos(l));
  const declination = (l, b) => Math.asin(Math.sin(b) * Math.cos(OBLIQUITY) + Math.cos(b) * Math.sin(OBLIQUITY) * Math.sin(l));
  const siderealTime = (d, lw) => RAD * (280.16 + 360.9856235 * d) - lw;
  const altitude = (hourAngle, phi, dec) => Math.asin(Math.sin(phi) * Math.sin(dec) + Math.cos(phi) * Math.cos(dec) * Math.cos(hourAngle));

  function sunCoords(d) {
    const M = RAD * (357.5291 + 0.98560028 * d);
    const C = RAD * (1.9148 * Math.sin(M) + 0.02 * Math.sin(2 * M) + 0.0003 * Math.sin(3 * M));
    const L = M + C + RAD * 102.9372 + Math.PI;
    return { dec: declination(L, 0), ra: rightAscension(L, 0) };
  }

  function moonCoords(d) {
    const L = RAD * (218.316 + 13.176396 * d);
    const M = RAD * (134.963 + 13.064993 * d);
    const F = RAD * (93.272 + 13.229350 * d);
    const l = L + RAD * 6.289 * Math.sin(M);
    const b = RAD * 5.128 * Math.sin(F);
    return { ra: rightAscension(l, b), dec: declination(l, b), dist: 385001 - 20905 * Math.cos(M) };
  }

  /* Height above the horizon in degrees. */
  function sunAltitude(date, lat, lng) {
    const d = daysSince2000(date);
    const c = sunCoords(d);
    return altitude(siderealTime(d, RAD * -lng) - c.ra, RAD * lat, c.dec) / RAD;
  }

  function moonAltitude(date, lat, lng) {
    const d = daysSince2000(date);
    const c = moonCoords(d);
    return altitude(siderealTime(d, RAD * -lng) - c.ra, RAD * lat, c.dec) / RAD;
  }

  /* fraction: 0 = new, 1 = full. phase: 0 new, 0.25 first quarter, 0.5 full, 0.75 last quarter. */
  function moonLight(date) {
    const d = daysSince2000(date);
    const s = sunCoords(d);
    const m = moonCoords(d);
    const elongation = Math.acos(Math.sin(s.dec) * Math.sin(m.dec) + Math.cos(s.dec) * Math.cos(m.dec) * Math.cos(s.ra - m.ra));
    const inc = Math.atan2(SUN_DISTANCE * Math.sin(elongation), m.dist - SUN_DISTANCE * Math.cos(elongation));
    const angle = Math.atan2(Math.cos(s.dec) * Math.sin(s.ra - m.ra), Math.sin(s.dec) * Math.cos(m.dec) - Math.cos(s.dec) * Math.sin(m.dec) * Math.cos(s.ra - m.ra));
    return {
      fraction: (1 + Math.cos(inc)) / 2,
      phase: 0.5 + (0.5 * inc * (angle < 0 ? -1 : 1)) / Math.PI,
    };
  }

  function phaseName(phase) {
    const names = ['New moon', 'Waxing crescent', 'First quarter', 'Waxing gibbous', 'Full moon', 'Waning gibbous', 'Last quarter', 'Waning crescent'];
    return names[Math.round(phase * 8) % 8];
  }

  return { sunAltitude, moonAltitude, moonLight, phaseName };
})();
