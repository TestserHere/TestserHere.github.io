// ============================================================
// TestserMaps - Routing Manager
// Handles route calculation via OSRM (Open Source Routing Machine)
// public demo server. Supports driving, walking, and cycling profiles.
// ============================================================

import { formatManeuverInstruction, getManeuverIcon, formatDistance, formatDuration, storage } from './utils.js';

const OSRM_BASE = 'https://router.project-osrm.org/route/v1';

// OSRM profile names
const PROFILE_MAP = {
  driving: 'driving',
  walking: 'foot',
  cycling: 'bike'
};

// Average speeds in m/s used to estimate duration when OSRM
// falls back to the driving profile for other modes
const AVG_SPEED = {
  driving: null, // use OSRM's own estimate
  walking: 1.4,  // ~5 km/h
  cycling: 4.2   // ~15 km/h
};

export class RoutingManager {
  constructor() {
    this.lastRoute = null;
    this.abortController = null;
  }

  /**
   * Calculate a route between two points.
   * @param {[number,number]} origin - [lat, lng] of start point
   * @param {[number,number]} destination - [lat, lng] of end point
   * @param {string} mode - Travel mode: 'driving', 'walking', or 'cycling'
   * @returns {Promise<object>} Parsed route object
   */
  async calculateRoute(origin, destination, mode = 'driving') {
    // Cancel pending request
    if (this.abortController) {
      this.abortController.abort();
    }
    this.abortController = new AbortController();

    const profile = PROFILE_MAP[mode] || 'driving';

    // OSRM uses longitude,latitude order
    const coords = `${origin[1]},${origin[0]};${destination[1]},${destination[0]}`;
    const params = new URLSearchParams({
      overview: 'full',
      geometries: 'geojson',
      steps: 'true',
      annotations: 'duration,distance'
    });

    const url = `${OSRM_BASE}/${profile}/${coords}?${params}`;

    try {
      const response = await fetch(url, {
        signal: this.abortController.signal
      });

      let usedFallback = false;

      if (!response.ok) {
        // If the profile isn't available (e.g. cycling/walking on demo server),
        // re-request with the driving profile but keep the original mode so we
        // can recalculate durations based on realistic speeds.
        if (response.status === 400 && mode !== 'driving') {
          console.warn(`OSRM ${mode} profile unavailable, using driving geometry with ${mode} speed`);
          const fallbackUrl = `${OSRM_BASE}/driving/${coords}?${params}`;
          const fbResponse = await fetch(fallbackUrl, {
            signal: this.abortController.signal
          });
          if (!fbResponse.ok) throw new Error(`OSRM error: ${fbResponse.status}`);
          const fbData = await fbResponse.json();
          if (fbData.code !== 'Ok' || !fbData.routes?.length) {
            throw new Error(fbData.message || 'No route found');
          }
          usedFallback = true;
          const route = this.parseRoute(fbData.routes[0], mode, usedFallback);
          this.lastRoute = route;
          storage.set('last_route', { route, origin, destination, mode, timestamp: Date.now() });
          return route;
        }
        throw new Error(`OSRM error: ${response.status}`);
      }

      const data = await response.json();

      if (data.code !== 'Ok' || !data.routes || data.routes.length === 0) {
        throw new Error(data.message || 'No route found');
      }

      const route = this.parseRoute(data.routes[0], mode, usedFallback);
      this.lastRoute = route;

      // Cache the last route for offline viewing
      storage.set('last_route', {
        route,
        origin,
        destination,
        mode,
        timestamp: Date.now()
      });

      return route;
    } catch (err) {
      if (err.name === 'AbortError') return null;
      console.error('Routing error:', err);
      throw err;
    }
  }

  /**
   * Parse an OSRM route response into a clean object.
   * When the driving profile was used as a fallback for walking/cycling,
   * durations are recalculated from distance / average speed.
   * @param {object} osrmRoute - Raw OSRM route object
   * @param {string} mode - Requested travel mode
   * @param {boolean} fallback - Whether driving profile was used as fallback
   * @returns {object} Parsed route
   */
  parseRoute(osrmRoute, mode, fallback = false) {
    const geometry = osrmRoute.geometry;
    const speed = AVG_SPEED[mode]; // null for driving (use OSRM values)
    const needsRecalc = fallback && speed;

    // Convert GeoJSON coordinates [lng, lat] to Leaflet [lat, lng]
    const coordinates = geometry.coordinates.map(([lng, lat]) => [lat, lng]);

    // Parse all legs and their steps
    const steps = [];
    for (const leg of osrmRoute.legs) {
      for (const step of leg.steps) {
        const maneuver = step.maneuver;
        const instruction = formatManeuverInstruction(maneuver, step.name);
        const icon = getManeuverIcon(maneuver);

        const stepDuration = needsRecalc
          ? step.distance / speed
          : step.duration;

        steps.push({
          instruction,
          icon,
          distance: step.distance, // meters
          duration: stepDuration,   // seconds
          name: step.name || '',
          maneuver: {
            type: maneuver.type,
            modifier: maneuver.modifier || '',
            location: [maneuver.location[1], maneuver.location[0]] // [lat, lng]
          },
          // Step geometry for highlighting
          geometry: step.geometry
            ? step.geometry.coordinates.map(([lng, lat]) => [lat, lng])
            : []
        });
      }
    }

    const totalDuration = needsRecalc
      ? osrmRoute.distance / speed
      : osrmRoute.duration;

    return {
      coordinates,
      steps,
      distance: osrmRoute.distance,  // total meters
      duration: totalDuration,        // total seconds
      mode,
      summary: {
        distance: formatDistance(osrmRoute.distance),
        duration: formatDuration(totalDuration)
      }
    };
  }

  /**
   * Get the last calculated route (from memory or localStorage).
   * @returns {object|null}
   */
  getLastRoute() {
    if (this.lastRoute) return this.lastRoute;
    const cached = storage.get('last_route');
    if (cached) return cached.route;
    return null;
  }

  /**
   * Clear the cached route.
   */
  clearLastRoute() {
    this.lastRoute = null;
    storage.remove('last_route');
  }
}
