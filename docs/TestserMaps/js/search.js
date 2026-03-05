// ============================================================
// TestserMaps - Search Manager
// Handles address lookup via Nominatim (OpenStreetMap geocoding).
// Includes debounced search, result caching, and recent searches.
// ============================================================

import { debounce, storage } from './utils.js';

const NOMINATIM_URL = 'https://nominatim.openstreetmap.org';
const MAX_RECENT = 10;

export class SearchManager {
  constructor() {
    this.recentSearches = storage.get('recent_searches', []);
    this.cache = new Map(); // In-memory cache for session
    this.abortController = null;
  }

  /**
   * Search for places matching a query string.
   * Uses Nominatim free geocoding API.
   * @param {string} query - Search query
   * @param {object} options - Optional parameters
   * @param {[number,number]} options.viewbox - Bias results near [lat, lng]
   * @returns {Promise<Array>} Array of result objects
   */
  async search(query, options = {}) {
    if (!query || query.trim().length < 2) return [];

    const cacheKey = query.trim().toLowerCase();
    if (this.cache.has(cacheKey)) {
      return this.cache.get(cacheKey);
    }

    // Cancel any pending request
    if (this.abortController) {
      this.abortController.abort();
    }
    this.abortController = new AbortController();

    const params = new URLSearchParams({
      q: query.trim(),
      format: 'json',
      limit: '6',
      addressdetails: '1'
    });

    // Bias results near the user's current view if available
    if (options.viewbox) {
      const [lat, lng] = options.viewbox;
      const d = 0.5; // ~50km bias box
      params.set('viewbox', `${lng - d},${lat + d},${lng + d},${lat - d}`);
      params.set('bounded', '0');
    }

    try {
      const response = await fetch(`${NOMINATIM_URL}/search?${params}`, {
        signal: this.abortController.signal,
        headers: {
          'Accept': 'application/json'
          // Nominatim requires a User-Agent; browsers send one automatically
        }
      });

      if (!response.ok) throw new Error(`Nominatim error: ${response.status}`);

      const data = await response.json();
      const results = data.map((item) => this.formatResult(item));

      // Cache results
      this.cache.set(cacheKey, results);

      return results;
    } catch (err) {
      if (err.name === 'AbortError') return []; // Request was cancelled
      console.error('Search error:', err);
      throw err;
    }
  }

  /**
   * Reverse geocode a lat/lng to an address.
   * @param {number} lat
   * @param {number} lng
   * @returns {Promise<object>} Result object
   */
  async reverseGeocode(lat, lng) {
    const params = new URLSearchParams({
      lat: lat.toString(),
      lon: lng.toString(),
      format: 'json',
      addressdetails: '1'
    });

    try {
      const response = await fetch(`${NOMINATIM_URL}/reverse?${params}`);
      if (!response.ok) throw new Error(`Reverse geocode error: ${response.status}`);
      const data = await response.json();
      return this.formatResult(data);
    } catch (err) {
      console.error('Reverse geocode error:', err);
      return {
        name: `${lat.toFixed(5)}, ${lng.toFixed(5)}`,
        address: '',
        lat,
        lng,
        type: 'coordinate'
      };
    }
  }

  /**
   * Create a debounced search function.
   * @param {Function} callback - Called with results array
   * @param {number} delay - Debounce delay in ms
   * @returns {Function} Debounced search trigger
   */
  createDebouncedSearch(callback, delay = 400) {
    return debounce(async (query, options) => {
      try {
        const results = await this.search(query, options);
        callback(results, null);
      } catch (err) {
        callback([], err);
      }
    }, delay);
  }

  /**
   * Format a Nominatim result into a consistent object.
   */
  formatResult(item) {
    const addr = item.address || {};
    const name =
      item.namedetails?.name ||
      addr.amenity ||
      addr.building ||
      addr.shop ||
      addr.tourism ||
      addr.road ||
      item.display_name?.split(',')[0] ||
      'Unknown';

    const parts = [];
    if (addr.road) parts.push(addr.road);
    if (addr.house_number) parts[0] = `${addr.house_number} ${parts[0] || ''}`;
    if (addr.city || addr.town || addr.village)
      parts.push(addr.city || addr.town || addr.village);
    if (addr.state) parts.push(addr.state);
    if (addr.country) parts.push(addr.country);

    return {
      name,
      address: parts.join(', ') || item.display_name || '',
      lat: parseFloat(item.lat),
      lng: parseFloat(item.lon),
      type: item.type || 'place',
      osmType: item.osm_type,
      boundingbox: item.boundingbox
    };
  }

  /**
   * Add a result to recent searches (stored in localStorage).
   */
  addToRecent(result) {
    // Remove duplicate if exists
    this.recentSearches = this.recentSearches.filter(
      (r) => !(r.lat === result.lat && r.lng === result.lng)
    );
    // Add to front
    this.recentSearches.unshift(result);
    // Trim to max
    if (this.recentSearches.length > MAX_RECENT) {
      this.recentSearches = this.recentSearches.slice(0, MAX_RECENT);
    }
    storage.set('recent_searches', this.recentSearches);
  }

  /**
   * Get recent searches.
   */
  getRecent() {
    return this.recentSearches;
  }

  /**
   * Clear recent searches.
   */
  clearRecent() {
    this.recentSearches = [];
    storage.remove('recent_searches');
  }
}
