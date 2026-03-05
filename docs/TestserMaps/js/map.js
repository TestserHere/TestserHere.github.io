// ============================================================
// TestserMaps - Map Manager
// Handles Leaflet map initialization, tile layers, markers,
// route polylines, and user location display.
// ============================================================

export class MapManager {
  constructor(containerId) {
    this.map = null;
    this.containerId = containerId;

    // Tile layers (light + dark)
    this.lightTiles = null;
    this.darkTiles = null;
    this.currentTiles = null;

    // Markers
    this.originMarker = null;
    this.destinationMarker = null;
    this.searchMarker = null;

    // User location
    this.userMarker = null;
    this.accuracyCircle = null;

    // Route
    this.routeLine = null;
    this.stepMarkers = [];

    // State
    this.isFollowing = false;
  }

  /**
   * Initialize the Leaflet map.
   * @param {[number,number]} center - Initial center [lat, lng]
   * @param {number} zoom - Initial zoom level
   */
  init(center = [51.505, -0.09], zoom = 13) {
    this.map = L.map(this.containerId, {
      center,
      zoom,
      zoomControl: false, // We use custom controls
      attributionControl: true,
      maxZoom: 19,
      minZoom: 3
    });

    // Set up tile layers
    this.lightTiles = L.tileLayer(
      'https://tile.openstreetmap.org/{z}/{x}/{y}.png',
      {
        maxZoom: 19,
        attribution:
          '&copy; <a href="https://www.openstreetmap.org/copyright">OpenStreetMap</a>'
      }
    );

    this.darkTiles = L.tileLayer(
      'https://{s}.basemaps.cartocdn.com/dark_all/{z}/{x}/{y}{r}.png',
      {
        maxZoom: 19,
        subdomains: 'abcd',
        attribution:
          '&copy; <a href="https://www.openstreetmap.org/copyright">OpenStreetMap</a> &copy; <a href="https://carto.com/">CARTO</a>'
      }
    );

    // Default to light tiles
    this.currentTiles = this.lightTiles;
    this.currentTiles.addTo(this.map);

    return this.map;
  }

  /**
   * Switch between light and dark tile layers.
   * @param {'light'|'dark'} theme
   */
  setTheme(theme) {
    const newTiles = theme === 'dark' ? this.darkTiles : this.lightTiles;
    if (newTiles === this.currentTiles) return;

    this.map.removeLayer(this.currentTiles);
    newTiles.addTo(this.map);
    this.currentTiles = newTiles;
  }

  /**
   * Create a custom colored SVG marker icon.
   * @param {string} color - Hex color for the marker
   * @returns {L.DivIcon} Leaflet DivIcon
   */
  createMarkerIcon(color = '#4285f4') {
    return L.divIcon({
      className: 'custom-marker',
      html: `
        <svg width="30" height="42" viewBox="0 0 30 42" xmlns="http://www.w3.org/2000/svg">
          <path d="M15 0C6.716 0 0 6.716 0 15c0 10.5 15 27 15 27s15-16.5 15-27C30 6.716 23.284 0 15 0z"
                fill="${color}"/>
          <circle cx="15" cy="14" r="6" fill="white"/>
        </svg>`,
      iconSize: [30, 42],
      iconAnchor: [15, 42],
      popupAnchor: [0, -42]
    });
  }

  /**
   * Set the origin marker on the map.
   */
  setOriginMarker(latlng) {
    if (this.originMarker) {
      this.originMarker.setLatLng(latlng);
    } else {
      this.originMarker = L.marker(latlng, {
        icon: this.createMarkerIcon('#4285f4'),
        alt: 'Starting point'
      }).addTo(this.map);
    }
  }

  /**
   * Set the destination marker on the map.
   */
  setDestinationMarker(latlng) {
    if (this.destinationMarker) {
      this.destinationMarker.setLatLng(latlng);
    } else {
      this.destinationMarker = L.marker(latlng, {
        icon: this.createMarkerIcon('#ea4335'),
        alt: 'Destination'
      }).addTo(this.map);
    }
  }

  /**
   * Set a search result marker (single point of interest).
   */
  setSearchMarker(latlng, name) {
    this.clearSearchMarker();
    this.searchMarker = L.marker(latlng, {
      icon: this.createMarkerIcon('#34a853'),
      alt: name || 'Search result'
    }).addTo(this.map);
  }

  clearSearchMarker() {
    if (this.searchMarker) {
      this.map.removeLayer(this.searchMarker);
      this.searchMarker = null;
    }
  }

  /**
   * Update the user's location marker and accuracy circle.
   * @param {[number,number]} latlng - [lat, lng]
   * @param {number} accuracy - Accuracy in meters
   */
  updateUserLocation(latlng, accuracy) {
    if (this.userMarker) {
      this.userMarker.setLatLng(latlng);
    } else {
      this.userMarker = L.marker(latlng, {
        icon: L.divIcon({
          className: '',
          html: '<div class="user-location-marker"></div>',
          iconSize: [20, 20],
          iconAnchor: [10, 10]
        }),
        zIndexOffset: 1000,
        alt: 'Your location'
      }).addTo(this.map);
    }

    if (this.accuracyCircle) {
      this.accuracyCircle.setLatLng(latlng).setRadius(accuracy);
    } else {
      this.accuracyCircle = L.circle(latlng, {
        radius: accuracy,
        className: 'user-location-accuracy',
        interactive: false
      }).addTo(this.map);
    }

    // Auto-follow user in navigation mode
    if (this.isFollowing) {
      this.map.setView(latlng, Math.max(this.map.getZoom(), 16), {
        animate: true,
        duration: 0.5
      });
    }
  }

  /**
   * Draw a route polyline on the map.
   * @param {Array<[number,number]>} coordinates - Array of [lat, lng]
   */
  drawRoute(coordinates) {
    this.clearRoute();
    this.routeLine = L.polyline(coordinates, {
      color: '#4285f4',
      weight: 6,
      opacity: 0.8,
      smoothFactor: 1,
      lineCap: 'round',
      lineJoin: 'round'
    }).addTo(this.map);
  }

  /**
   * Fit the map view to show the entire route plus markers.
   */
  fitRoute() {
    const bounds = L.latLngBounds([]);
    if (this.originMarker) bounds.extend(this.originMarker.getLatLng());
    if (this.destinationMarker) bounds.extend(this.destinationMarker.getLatLng());
    if (this.routeLine) bounds.extend(this.routeLine.getBounds());

    if (bounds.isValid()) {
      this.map.fitBounds(bounds, { padding: [60, 60] });
    }
  }

  /**
   * Clear route line and step markers from map.
   */
  clearRoute() {
    if (this.routeLine) {
      this.map.removeLayer(this.routeLine);
      this.routeLine = null;
    }
    this.stepMarkers.forEach((m) => this.map.removeLayer(m));
    this.stepMarkers = [];
  }

  /**
   * Clear all markers and route from the map.
   */
  clearAll() {
    this.clearRoute();
    this.clearSearchMarker();
    if (this.originMarker) {
      this.map.removeLayer(this.originMarker);
      this.originMarker = null;
    }
    if (this.destinationMarker) {
      this.map.removeLayer(this.destinationMarker);
      this.destinationMarker = null;
    }
  }

  /**
   * Enable/disable follow mode (map tracks user position).
   */
  setFollowing(enabled) {
    this.isFollowing = enabled;
  }

  /**
   * Pan and zoom to a specific location.
   */
  flyTo(latlng, zoom = 16) {
    this.map.flyTo(latlng, zoom, { duration: 1 });
  }

  /**
   * Get the current map center.
   */
  getCenter() {
    const c = this.map.getCenter();
    return [c.lat, c.lng];
  }

  /**
   * Invalidate the map size (call after container resize).
   */
  invalidateSize() {
    this.map.invalidateSize();
  }
}
