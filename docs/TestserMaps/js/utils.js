// ============================================================
// TestserMaps - Utility Functions
// Geographic calculations, formatting, debounce, caching
// ============================================================

const EARTH_RADIUS_M = 6371000; // Earth's radius in meters

/**
 * Calculate distance between two geographic points using Haversine formula.
 * @param {number} lat1 - Latitude of point 1
 * @param {number} lon1 - Longitude of point 1
 * @param {number} lat2 - Latitude of point 2
 * @param {number} lon2 - Longitude of point 2
 * @returns {number} Distance in meters
 */
export function haversineDistance(lat1, lon1, lat2, lon2) {
  const dLat = toRad(lat2 - lat1);
  const dLon = toRad(lon2 - lon1);
  const a =
    Math.sin(dLat / 2) ** 2 +
    Math.cos(toRad(lat1)) * Math.cos(toRad(lat2)) * Math.sin(dLon / 2) ** 2;
  return EARTH_RADIUS_M * 2 * Math.atan2(Math.sqrt(a), Math.sqrt(1 - a));
}

function toRad(deg) {
  return (deg * Math.PI) / 180;
}

/**
 * Find the nearest point on a polyline to a given position.
 * Returns the index of the closest segment, projected point, and distance.
 * @param {Array<[number,number]>} polyline - Array of [lat, lng] coordinates
 * @param {[number,number]} point - [lat, lng] of the test point
 * @returns {{ index: number, projected: [number,number], distance: number }}
 */
export function nearestPointOnPolyline(polyline, point) {
  let bestDist = Infinity;
  let bestIdx = 0;
  let bestProj = polyline[0];

  for (let i = 0; i < polyline.length - 1; i++) {
    const proj = projectPointOnSegment(point, polyline[i], polyline[i + 1]);
    const dist = haversineDistance(point[0], point[1], proj[0], proj[1]);
    if (dist < bestDist) {
      bestDist = dist;
      bestIdx = i;
      bestProj = proj;
    }
  }

  return { index: bestIdx, projected: bestProj, distance: bestDist };
}

/**
 * Project a point onto a line segment (geographic coordinates).
 * Uses local flat-earth approximation which is accurate for short segments.
 */
function projectPointOnSegment(point, segStart, segEnd) {
  // Convert to local meters relative to segStart
  const cosLat = Math.cos(toRad(segStart[0]));
  const dx = (segEnd[1] - segStart[1]) * cosLat;
  const dy = segEnd[0] - segStart[0];
  const px = (point[1] - segStart[1]) * cosLat;
  const py = point[0] - segStart[0];

  const lenSq = dx * dx + dy * dy;
  if (lenSq === 0) return segStart;

  let t = (px * dx + py * dy) / lenSq;
  t = Math.max(0, Math.min(1, t));

  return [segStart[0] + t * dy, segStart[1] + (t * dx) / cosLat];
}

/**
 * Format a distance value for display.
 * @param {number} meters - Distance in meters
 * @returns {string} Formatted string (e.g., "200 m", "1.3 km")
 */
export function formatDistance(meters) {
  if (meters < 1000) {
    return `${Math.round(meters)} m`;
  }
  return `${(meters / 1000).toFixed(1)} km`;
}

/**
 * Format a duration value for display.
 * @param {number} seconds - Duration in seconds
 * @returns {string} Formatted string (e.g., "5 min", "1 hr 23 min")
 */
export function formatDuration(seconds) {
  if (seconds < 60) return 'Less than a minute';
  const mins = Math.round(seconds / 60);
  if (mins < 60) return `${mins} min`;
  const hrs = Math.floor(mins / 60);
  const remainMins = mins % 60;
  if (remainMins === 0) return `${hrs} hr`;
  return `${hrs} hr ${remainMins} min`;
}

/**
 * Create a debounced version of a function.
 * @param {Function} fn - Function to debounce
 * @param {number} delay - Delay in milliseconds
 * @returns {Function} Debounced function
 */
export function debounce(fn, delay) {
  let timer;
  return function (...args) {
    clearTimeout(timer);
    timer = setTimeout(() => fn.apply(this, args), delay);
  };
}

/**
 * Convert OSRM maneuver type + modifier into a human-readable instruction.
 * @param {object} maneuver - OSRM maneuver object
 * @param {string} streetName - Name of the street
 * @returns {string} Human-readable instruction
 */
export function formatManeuverInstruction(maneuver, streetName) {
  const { type, modifier } = maneuver;
  const onto = streetName ? ` onto ${streetName}` : '';

  const directionMap = {
    left: 'left',
    right: 'right',
    'sharp left': 'sharp left',
    'sharp right': 'sharp right',
    'slight left': 'slight left',
    'slight right': 'slight right',
    straight: 'straight',
    uturn: 'a U-turn'
  };

  const direction = directionMap[modifier] || modifier || '';

  switch (type) {
    case 'depart':
      return `Head ${direction}${onto}`;
    case 'arrive':
      return 'You have arrived at your destination';
    case 'turn':
      return `Turn ${direction}${onto}`;
    case 'continue':
      return `Continue ${direction}${onto}`;
    case 'merge':
      return `Merge ${direction}${onto}`;
    case 'fork':
      return `Take the ${direction} fork${onto}`;
    case 'off ramp':
      return `Take the exit${onto}`;
    case 'on ramp':
      return `Take the ramp${onto}`;
    case 'roundabout':
    case 'rotary':
      return `Enter the roundabout and take the exit${onto}`;
    case 'roundabout turn':
      return `At the roundabout, turn ${direction}${onto}`;
    case 'end of road':
      return `At the end of the road, turn ${direction}${onto}`;
    case 'new name':
      return `Continue${onto}`;
    case 'notification':
      return streetName || 'Continue on the current road';
    default:
      if (direction) return `${direction}${onto}`;
      return `Continue${onto}`;
  }
}

/**
 * Get a maneuver icon (emoji) based on the OSRM maneuver type and modifier.
 */
export function getManeuverIcon(maneuver) {
  const { type, modifier } = maneuver;

  if (type === 'depart') return '\u{1F6A9}'; // flag
  if (type === 'arrive') return '\u{1F3C1}'; // checkered flag

  switch (modifier) {
    case 'left':
    case 'sharp left':
    case 'slight left':
      return '\u2B05\uFE0F'; // left arrow
    case 'right':
    case 'sharp right':
    case 'slight right':
      return '\u27A1\uFE0F'; // right arrow
    case 'uturn':
      return '\u21A9\uFE0F'; // u-turn
    case 'straight':
      return '\u2B06\uFE0F'; // up arrow
    default:
      if (type === 'roundabout' || type === 'rotary') return '\u{1F504}'; // arrows circle
      return '\u2B06\uFE0F'; // default up arrow
  }
}

/**
 * Simple localStorage wrapper with JSON serialization.
 */
export const storage = {
  get(key, fallback = null) {
    try {
      const val = localStorage.getItem(`testser_${key}`);
      return val !== null ? JSON.parse(val) : fallback;
    } catch {
      return fallback;
    }
  },
  set(key, value) {
    try {
      localStorage.setItem(`testser_${key}`, JSON.stringify(value));
    } catch {
      // Storage full or unavailable
    }
  },
  remove(key) {
    try {
      localStorage.removeItem(`testser_${key}`);
    } catch {
      // Ignore
    }
  }
};

/**
 * Show a toast notification.
 * @param {string} message - Toast message text
 * @param {number} duration - Duration in ms (default 3000)
 */
export function showToast(message, duration = 3000) {
  const container = document.getElementById('toast-container');
  if (!container) return;

  const toast = document.createElement('div');
  toast.className = 'toast';
  toast.textContent = message;
  toast.setAttribute('role', 'alert');
  toast.setAttribute('aria-live', 'polite');
  container.appendChild(toast);

  setTimeout(() => {
    toast.remove();
  }, duration);
}
