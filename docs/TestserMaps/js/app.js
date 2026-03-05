// ============================================================
// TestserMaps - Main Application
// Orchestrates all modules, handles UI state, and wires events.
// ============================================================

import { MapManager } from './map.js';
import { SearchManager } from './search.js';
import { RoutingManager } from './routing.js';
import { NavigationManager } from './navigation.js';
import { VoiceManager } from './voice.js';
import {
  formatDistance,
  formatDuration,
  haversineDistance,
  storage,
  showToast
} from './utils.js';

// ---- Application State ----
const state = {
  mode: 'explore', // explore | search | routing | navigating
  theme: storage.get('theme', 'light'),
  travelMode: 'driving',
  origin: null, // { name, address, lat, lng }
  destination: null, // { name, address, lat, lng }
  route: null,
  userPosition: null,
  highContrast: storage.get('high_contrast', false),
  largeText: storage.get('large_text', false),
  pinTarget: null // null | 'origin' | 'destination' — for pick-on-map mode
};

// ---- Module Instances ----
const mapMgr = new MapManager('map');
const searchMgr = new SearchManager();
const routingMgr = new RoutingManager();
const navMgr = new NavigationManager();
const voiceMgr = new VoiceManager();

// ---- DOM References (cached after DOMContentLoaded) ----
let dom = {};

// ---- Initialization ----
document.addEventListener('DOMContentLoaded', () => {
  cacheDomRefs();
  initMap();
  initTheme();
  initAccessibility();
  bindSearchEvents();
  bindRouteEvents();
  bindNavigationEvents();
  bindSettingsEvents();
  bindMapControlEvents();
  registerServiceWorker();
});

function cacheDomRefs() {
  dom = {
    // Search
    searchContainer: document.getElementById('search-container'),
    searchInput: document.getElementById('search-input'),
    searchResults: document.getElementById('search-results'),
    btnSearch: document.getElementById('btn-search'),
    btnClearSearch: document.getElementById('btn-clear-search'),

    // Route planning
    routePlanning: document.getElementById('route-planning'),
    inputOrigin: document.getElementById('input-origin'),
    inputDestination: document.getElementById('input-destination'),
    btnCloseRoute: document.getElementById('btn-close-route'),
    btnPinOrigin: document.getElementById('btn-pin-origin'),
    btnPinDestination: document.getElementById('btn-pin-destination'),
    pinModeBanner: document.getElementById('pin-mode-banner'),
    travelModes: document.querySelectorAll('.travel-mode-btn'),
    routeSummary: document.getElementById('route-summary'),
    summaryTime: document.getElementById('summary-time'),
    summaryDistance: document.getElementById('summary-distance'),
    btnStartNav: document.getElementById('btn-start-nav'),

    // Place card
    placeCard: document.getElementById('place-card'),
    placeName: document.getElementById('place-name'),
    placeAddress: document.getElementById('place-address'),
    btnDirections: document.getElementById('btn-directions'),
    btnClosePlaceCard: document.getElementById('btn-close-place'),

    // Bottom sheet (directions)
    bottomSheet: document.getElementById('bottom-sheet'),
    bottomSheetHandle: document.getElementById('bottom-sheet-handle'),
    directionsListEl: document.getElementById('directions-list'),

    // Navigation banner
    navBanner: document.getElementById('nav-banner'),
    navDistToTurn: document.getElementById('nav-dist-to-turn'),
    navTurnIcon: document.getElementById('nav-turn-icon'),
    navTurnInstruction: document.getElementById('nav-turn-instruction'),
    navStreetName: document.getElementById('nav-street-name'),

    // Navigation bottom bar
    navBottomBar: document.getElementById('nav-bottom-bar'),
    navEtaTime: document.getElementById('nav-eta-time'),
    navEtaDistance: document.getElementById('nav-eta-distance'),
    btnEndNav: document.getElementById('btn-end-nav'),
    btnNavVoice: document.getElementById('btn-nav-voice'),

    // Rerouting banner
    reroutingBanner: document.getElementById('rerouting-banner'),

    // Map controls
    btnMyLocation: document.getElementById('btn-my-location'),
    btnZoomIn: document.getElementById('btn-zoom-in'),
    btnZoomOut: document.getElementById('btn-zoom-out'),

    // Settings
    btnSettings: document.getElementById('btn-settings'),
    settingsOverlay: document.getElementById('settings-overlay'),
    settingsPanel: document.getElementById('settings-panel'),
    btnCloseSettings: document.getElementById('btn-close-settings'),
    toggleDarkMode: document.getElementById('toggle-dark-mode'),
    toggleVoice: document.getElementById('toggle-voice'),
    toggleHighContrast: document.getElementById('toggle-high-contrast'),
    toggleLargeText: document.getElementById('toggle-large-text'),
    voiceSelect: document.getElementById('voice-select'),

    // Loading
    loadingBar: document.getElementById('loading-bar')
  };
}

// ============================================================
// MAP INITIALIZATION
// ============================================================

function initMap() {
  // Try to use last known position or default to London
  const lastPos = storage.get('last_position', [51.505, -0.09]);
  const lastZoom = storage.get('last_zoom', 13);
  mapMgr.init(lastPos, lastZoom);

  // Save map position on move
  mapMgr.map.on('moveend', () => {
    const c = mapMgr.map.getCenter();
    storage.set('last_position', [c.lat, c.lng]);
    storage.set('last_zoom', mapMgr.map.getZoom());
  });

  // Map click handler: place a marker, show place card, OR handle pin mode
  mapMgr.map.on('click', async (e) => {
    if (state.mode === 'navigating') return;

    const { lat, lng } = e.latlng;

    // ---- Pin-on-map mode: set origin or destination from tap ----
    if (state.pinTarget) {
      showLoading(true);
      try {
        const result = await searchMgr.reverseGeocode(lat, lng);
        applyPinResult(result);
      } catch {
        // Fallback to raw coordinates if reverse geocode fails
        applyPinResult({
          name: `${lat.toFixed(5)}, ${lng.toFixed(5)}`,
          address: '',
          lat,
          lng,
          type: 'coordinate'
        });
      } finally {
        showLoading(false);
      }
      return;
    }

    // ---- Normal explore mode: show place card ----
    if (state.mode === 'routing') return;

    showLoading(true);
    try {
      const result = await searchMgr.reverseGeocode(lat, lng);
      showPlaceCard(result);
      mapMgr.setSearchMarker([lat, lng], result.name);
    } catch {
      showToast('Could not identify this location');
    } finally {
      showLoading(false);
    }
  });

  // Try to get current location on startup
  requestUserLocation(false);
}

// ============================================================
// THEME & ACCESSIBILITY
// ============================================================

function initTheme() {
  applyTheme(state.theme);
  if (dom.toggleDarkMode) {
    dom.toggleDarkMode.checked = state.theme === 'dark';
  }
}

function applyTheme(theme) {
  state.theme = theme;
  document.documentElement.setAttribute('data-theme', theme);
  mapMgr.setTheme(theme);
  storage.set('theme', theme);

  // Update meta theme-color
  const meta = document.querySelector('meta[name="theme-color"]');
  if (meta) {
    meta.content = theme === 'dark' ? '#1a1a2e' : '#4285f4';
  }
}

function initAccessibility() {
  if (state.highContrast) {
    document.documentElement.setAttribute('data-contrast', 'high');
    if (dom.toggleHighContrast) dom.toggleHighContrast.checked = true;
  }
  if (state.largeText) {
    document.documentElement.setAttribute('data-text-size', 'large');
    if (dom.toggleLargeText) dom.toggleLargeText.checked = true;
  }
}

// ============================================================
// SEARCH EVENTS
// ============================================================

function bindSearchEvents() {
  const debouncedSearch = searchMgr.createDebouncedSearch((results, err) => {
    if (err) {
      showToast('Search failed. Check your connection.');
      return;
    }
    renderSearchResults(results);
  }, 400);

  // Input handler
  dom.searchInput.addEventListener('input', () => {
    const query = dom.searchInput.value.trim();
    if (query.length < 2) {
      hideSearchResults();
      return;
    }
    const viewbox = mapMgr.getCenter();
    debouncedSearch(query, { viewbox });
  });

  // Focus: show recent searches if input is empty
  dom.searchInput.addEventListener('focus', () => {
    if (dom.searchInput.value.trim().length < 2) {
      const recent = searchMgr.getRecent();
      if (recent.length > 0) {
        renderSearchResults(recent, true);
      }
    }
  });

  // Clear button
  dom.btnClearSearch.addEventListener('click', () => {
    dom.searchInput.value = '';
    hideSearchResults();
    mapMgr.clearSearchMarker();
    hidePlaceCard();
    dom.searchInput.focus();
  });

  // Close search results when clicking outside
  document.addEventListener('click', (e) => {
    if (
      !dom.searchContainer.contains(e.target) &&
      !dom.searchResults.contains(e.target)
    ) {
      hideSearchResults();
    }
  });
}

function renderSearchResults(results, isRecent = false) {
  if (!results || results.length === 0) {
    hideSearchResults();
    return;
  }

  dom.searchResults.innerHTML = '';

  if (isRecent) {
    const header = document.createElement('div');
    header.style.cssText =
      'padding:10px 16px 4px;font-size:12px;font-weight:600;color:var(--text-muted);text-transform:uppercase;letter-spacing:0.5px;';
    header.textContent = 'Recent';
    dom.searchResults.appendChild(header);
  }

  results.forEach((result) => {
    const item = document.createElement('div');
    item.className = 'search-result-item';
    item.setAttribute('role', 'option');
    item.innerHTML = `
      <span class="result-icon">${isRecent ? '\u{1F553}' : '\u{1F4CD}'}</span>
      <div class="result-text">
        <div class="result-name">${escapeHtml(result.name)}</div>
        <div class="result-address">${escapeHtml(result.address)}</div>
      </div>
    `;
    item.addEventListener('click', () => selectSearchResult(result));
    dom.searchResults.appendChild(item);
  });

  dom.searchResults.classList.add('visible');
}

function hideSearchResults() {
  dom.searchResults.classList.remove('visible');
}

function selectSearchResult(result) {
  hideSearchResults();
  dom.searchInput.value = result.name;
  searchMgr.addToRecent(result);

  // Show marker and fly to location
  mapMgr.setSearchMarker([result.lat, result.lng], result.name);
  mapMgr.flyTo([result.lat, result.lng], 16);

  // Show place card
  showPlaceCard(result);
}

// ============================================================
// PLACE CARD
// ============================================================

function showPlaceCard(result) {
  state.destination = result;
  dom.placeName.textContent = result.name;
  dom.placeAddress.textContent = result.address;
  dom.placeCard.classList.add('visible');
}

function hidePlaceCard() {
  dom.placeCard.classList.remove('visible');
}

// ============================================================
// ROUTE PLANNING
// ============================================================

function bindRouteEvents() {
  // Bottom sheet handle: toggle collapsed/expanded
  dom.bottomSheetHandle.addEventListener('click', () => {
    dom.bottomSheet.classList.toggle('collapsed');
  });

  // "Directions" button on place card
  dom.btnDirections.addEventListener('click', () => {
    enterRouteMode();
  });

  // Close place card
  dom.btnClosePlaceCard.addEventListener('click', () => {
    hidePlaceCard();
    mapMgr.clearSearchMarker();
  });

  // Close route planning
  dom.btnCloseRoute.addEventListener('click', () => {
    exitRouteMode();
  });

  // Travel mode buttons
  dom.travelModes.forEach((btn) => {
    btn.addEventListener('click', () => {
      dom.travelModes.forEach((b) => b.classList.remove('active'));
      btn.classList.add('active');
      state.travelMode = btn.dataset.mode;
      // Recalculate if we have both endpoints
      if (state.origin && state.destination) {
        calculateRoute();
      }
    });
  });

  // Start Navigation button
  dom.btnStartNav.addEventListener('click', () => {
    startNavigation();
  });

  // Route input listeners (for manual origin/destination entry)
  const debouncedOriginSearch = searchMgr.createDebouncedSearch((results) => {
    renderRouteSearchResults(results, 'origin');
  }, 400);

  const debouncedDestSearch = searchMgr.createDebouncedSearch((results) => {
    renderRouteSearchResults(results, 'destination');
  }, 400);

  dom.inputOrigin.addEventListener('input', () => {
    const q = dom.inputOrigin.value.trim();
    if (q.length >= 2) debouncedOriginSearch(q, { viewbox: mapMgr.getCenter() });
  });

  dom.inputDestination.addEventListener('input', () => {
    const q = dom.inputDestination.value.trim();
    if (q.length >= 2) debouncedDestSearch(q, { viewbox: mapMgr.getCenter() });
  });

  // Pin-on-map buttons
  dom.btnPinOrigin.addEventListener('click', () => {
    enterPinMode('origin');
  });

  dom.btnPinDestination.addEventListener('click', () => {
    enterPinMode('destination');
  });
}

// ---- Pin-on-Map Mode ----

function enterPinMode(target) {
  // Toggle off if already active for the same target
  if (state.pinTarget === target) {
    exitPinMode();
    return;
  }

  state.pinTarget = target;
  document.body.classList.add('pin-mode-active');
  dom.pinModeBanner.textContent =
    target === 'origin'
      ? 'Tap the map to set starting point'
      : 'Tap the map to set destination';
  dom.pinModeBanner.classList.add('visible');

  // Highlight the active pin button
  dom.btnPinOrigin.classList.toggle('active', target === 'origin');
  dom.btnPinDestination.classList.toggle('active', target === 'destination');
}

function exitPinMode() {
  state.pinTarget = null;
  document.body.classList.remove('pin-mode-active');
  dom.pinModeBanner.classList.remove('visible');
  dom.btnPinOrigin.classList.remove('active');
  dom.btnPinDestination.classList.remove('active');
}

function applyPinResult(result) {
  const target = state.pinTarget;
  exitPinMode();

  if (target === 'origin') {
    state.origin = result;
    dom.inputOrigin.value = result.name;
    mapMgr.setOriginMarker([result.lat, result.lng]);
  } else {
    state.destination = result;
    dom.inputDestination.value = result.name;
    mapMgr.setDestinationMarker([result.lat, result.lng]);
  }

  // Auto-calculate if both points are set
  if (state.origin && state.destination) {
    calculateRoute();
  }
}

function enterRouteMode() {
  state.mode = 'routing';
  hidePlaceCard();

  // Hide search bar, show route planning
  dom.searchContainer.style.display = 'none';
  dom.routePlanning.classList.add('visible');

  // Pre-fill destination if we have one
  if (state.destination) {
    dom.inputDestination.value = state.destination.name;
  }

  // Pre-fill origin with "My Location" if we have GPS
  if (state.userPosition) {
    state.origin = {
      name: 'My Location',
      address: '',
      lat: state.userPosition[0],
      lng: state.userPosition[1]
    };
    dom.inputOrigin.value = 'My Location';
  }

  // Auto-calculate if we have both
  if (state.origin && state.destination) {
    calculateRoute();
  }
}

function exitRouteMode() {
  state.mode = 'explore';
  state.route = null;
  exitPinMode();
  dom.routePlanning.classList.remove('visible');
  dom.searchContainer.style.display = '';
  dom.routeSummary.classList.remove('visible');
  dom.bottomSheet.classList.remove('visible');
  mapMgr.clearAll();
  dom.inputOrigin.value = '';
  dom.inputDestination.value = '';
}

function renderRouteSearchResults(results, field) {
  // Reuse the search results dropdown, positioned under the route inputs
  if (!results || results.length === 0) {
    hideSearchResults();
    return;
  }

  dom.searchResults.innerHTML = '';
  results.forEach((result) => {
    const item = document.createElement('div');
    item.className = 'search-result-item';
    item.innerHTML = `
      <span class="result-icon">\u{1F4CD}</span>
      <div class="result-text">
        <div class="result-name">${escapeHtml(result.name)}</div>
        <div class="result-address">${escapeHtml(result.address)}</div>
      </div>
    `;
    item.addEventListener('click', () => {
      hideSearchResults();
      if (field === 'origin') {
        state.origin = result;
        dom.inputOrigin.value = result.name;
        mapMgr.setOriginMarker([result.lat, result.lng]);
      } else {
        state.destination = result;
        dom.inputDestination.value = result.name;
        mapMgr.setDestinationMarker([result.lat, result.lng]);
      }
      if (state.origin && state.destination) {
        calculateRoute();
      }
    });
    dom.searchResults.appendChild(item);
  });

  dom.searchResults.classList.add('visible');
}

async function calculateRoute() {
  if (!state.origin || !state.destination) return;

  showLoading(true);
  try {
    const route = await routingMgr.calculateRoute(
      [state.origin.lat, state.origin.lng],
      [state.destination.lat, state.destination.lng],
      state.travelMode
    );

    if (!route) return;

    state.route = route;

    // Draw on map
    mapMgr.setOriginMarker([state.origin.lat, state.origin.lng]);
    mapMgr.setDestinationMarker([state.destination.lat, state.destination.lng]);
    mapMgr.drawRoute(route.coordinates);
    mapMgr.fitRoute();

    // Show summary
    dom.summaryTime.textContent = route.summary.duration;
    dom.summaryDistance.textContent = route.summary.distance;
    dom.routeSummary.classList.add('visible');

    // Show directions list with route overview
    renderDirectionsList(route);
    dom.bottomSheet.classList.remove('collapsed');
    dom.bottomSheet.classList.add('visible');
  } catch (err) {
    showToast('Could not calculate route. Try again.');
    console.error(err);
  } finally {
    showLoading(false);
  }
}

function renderDirectionsList(route) {
  const steps = route.steps;
  dom.directionsListEl.innerHTML = '';

  // ---- Route overview header ----
  const modeLabels = { driving: '\u{1F697} Driving', walking: '\u{1F6B6} Walking', cycling: '\u{1F6B2} Cycling' };
  const overview = document.createElement('div');
  overview.className = 'route-overview';
  overview.innerHTML = `
    <div class="overview-stat">
      <span class="stat-value">${route.summary.duration}</span>
      <span class="stat-label">Total time</span>
    </div>
    <div class="overview-divider" aria-hidden="true"></div>
    <div class="overview-stat">
      <span class="stat-value">${route.summary.distance}</span>
      <span class="stat-label">Total distance</span>
    </div>
    <span class="overview-mode">${modeLabels[route.mode] || route.mode}</span>
  `;
  dom.directionsListEl.appendChild(overview);

  // ---- Step-by-step directions with cumulative totals ----
  let cumulativeDist = 0;
  let cumulativeTime = 0;

  steps.forEach((step, index) => {
    cumulativeDist += step.distance;
    cumulativeTime += step.duration;

    const el = document.createElement('div');
    el.className = 'direction-step';
    el.setAttribute('role', 'listitem');
    el.setAttribute('aria-label', step.instruction);

    el.innerHTML = `
      <div class="step-icon">${step.icon}</div>
      <div class="step-content">
        <div class="step-instruction">${escapeHtml(step.instruction)}</div>
        <div class="step-detail">${formatDistance(step.distance)} &middot; ${formatDuration(step.duration)}</div>
        <div class="step-cumulative">${formatDistance(cumulativeDist)} &middot; ${formatDuration(cumulativeTime)} from start</div>
      </div>
    `;

    // Click to zoom to step on map
    el.addEventListener('click', () => {
      if (step.maneuver.location) {
        mapMgr.flyTo(step.maneuver.location, 17);
      }
    });

    dom.directionsListEl.appendChild(el);
  });
}

// ============================================================
// NAVIGATION MODE
// ============================================================

function bindNavigationEvents() {
  // End navigation button
  dom.btnEndNav.addEventListener('click', () => {
    endNavigation();
  });

  // Voice mute toggle
  dom.btnNavVoice.addEventListener('click', () => {
    const muted = voiceMgr.toggleMute();
    dom.btnNavVoice.textContent = muted ? '\u{1F507}' : '\u{1F50A}';
    dom.btnNavVoice.classList.toggle('muted', muted);
    showToast(muted ? 'Voice muted' : 'Voice unmuted');
  });

  // Navigation manager callbacks
  navMgr.onPositionUpdate = (pos) => {
    mapMgr.updateUserLocation(pos.latlng, pos.accuracy);
    state.userPosition = pos.latlng;

    if (state.mode === 'navigating') {
      updateNavigationUI();
    }
  };

  navMgr.onStepChange = (stepIndex, step) => {
    highlightDirectionStep(stepIndex);
    updateNavBanner(step);
  };

  navMgr.onOffRoute = () => {
    handleOffRoute();
  };

  navMgr.onArrival = () => {
    voiceMgr.speak('You have arrived at your destination.', { force: true });
    showToast('You have arrived!');
    setTimeout(() => endNavigation(), 3000);
  };
}

function startNavigation() {
  if (!state.route) return;

  state.mode = 'navigating';

  // Hide route planning UI, show navigation UI
  dom.routePlanning.classList.remove('visible');
  dom.routeSummary.classList.remove('visible');
  dom.searchContainer.style.display = 'none';
  dom.placeCard.classList.remove('visible');

  // Show navigation elements
  dom.navBanner.classList.add('visible');
  dom.navBottomBar.classList.add('visible');
  dom.bottomSheet.classList.remove('collapsed');
  dom.bottomSheet.classList.add('visible');

  // Enable map following
  mapMgr.setFollowing(true);

  // Set initial voice mute state
  dom.btnNavVoice.textContent = voiceMgr.muted ? '\u{1F507}' : '\u{1F50A}';
  dom.btnNavVoice.classList.toggle('muted', voiceMgr.muted);

  // Start navigation engine
  navMgr.start(state.route);

  // Initial banner + ETA update
  if (state.route.steps.length > 0) {
    updateNavBanner(state.route.steps[0]);
    highlightDirectionStep(0);
  }

  // Populate ETA immediately from route totals
  dom.navEtaTime.textContent = state.route.summary.duration;
  dom.navEtaDistance.textContent = state.route.summary.distance;

  // Populate initial distance-to-turn from first real maneuver
  if (state.route.steps.length > 1) {
    dom.navDistToTurn.textContent = formatDistance(state.route.steps[0].distance);
  }

  // If we have position already, zoom to it
  if (state.userPosition) {
    mapMgr.flyTo(state.userPosition, 17);
  }

  // Initial voice announcement
  voiceMgr.speak('Navigation started. ' + state.route.steps[0]?.instruction, {
    force: true
  });
}

function endNavigation() {
  state.mode = 'explore';

  navMgr.stop();
  voiceMgr.stop();
  mapMgr.setFollowing(false);

  // Hide navigation UI
  dom.navBanner.classList.remove('visible');
  dom.navBottomBar.classList.remove('visible');
  dom.bottomSheet.classList.remove('visible');
  dom.reroutingBanner.classList.remove('visible');

  // Show search bar
  dom.searchContainer.style.display = '';

  // Clear route from map
  mapMgr.clearAll();

  state.route = null;
  state.origin = null;
  state.destination = null;
}

function updateNavigationUI() {
  if (state.mode !== 'navigating') return;

  const nextStep = navMgr.getNextStep() || navMgr.getCurrentStep();
  if (!nextStep) return;

  // Distance to next maneuver
  const distToManeuver = navMgr.getDistanceToNextManeuver();

  // Update banner distance
  if (distToManeuver >= 0) {
    dom.navDistToTurn.textContent = formatDistance(distToManeuver);
  }

  // Voice announcements
  voiceMgr.announceNavigation(
    nextStep,
    distToManeuver,
    navMgr.getAnnouncementState()
  );

  // Update remaining ETA
  const remaining = navMgr.getRemainingStats();
  dom.navEtaTime.textContent = formatDuration(remaining.duration);
  dom.navEtaDistance.textContent = formatDistance(remaining.distance);
}

function updateNavBanner(step) {
  if (!step) return;
  dom.navTurnIcon.textContent = step.icon;
  dom.navTurnInstruction.textContent = step.instruction;
  dom.navStreetName.textContent = step.name || '';
}

function highlightDirectionStep(index) {
  const steps = dom.directionsListEl.querySelectorAll('.direction-step');
  steps.forEach((el, i) => {
    el.classList.toggle('active', i === index);
  });

  // Scroll into view
  if (steps[index]) {
    steps[index].scrollIntoView({ behavior: 'smooth', block: 'nearest' });
  }
}

async function handleOffRoute() {
  dom.reroutingBanner.classList.add('visible');
  voiceMgr.announceRerouting();

  try {
    const newRoute = await routingMgr.calculateRoute(
      state.userPosition,
      [state.destination.lat, state.destination.lng],
      state.travelMode
    );

    if (newRoute) {
      state.route = newRoute;
      navMgr.updateRoute(newRoute);
      mapMgr.drawRoute(newRoute.coordinates);
      renderDirectionsList(newRoute);

      if (newRoute.steps.length > 0) {
        updateNavBanner(newRoute.steps[0]);
        highlightDirectionStep(0);
      }

      showToast('Route recalculated');
    }
  } catch {
    showToast('Could not recalculate route');
  } finally {
    dom.reroutingBanner.classList.remove('visible');
  }
}

// ============================================================
// MAP CONTROLS
// ============================================================

function bindMapControlEvents() {
  // My Location button
  dom.btnMyLocation.addEventListener('click', () => {
    requestUserLocation(true);
  });

  // Zoom controls
  dom.btnZoomIn.addEventListener('click', () => {
    mapMgr.map.zoomIn();
  });

  dom.btnZoomOut.addEventListener('click', () => {
    mapMgr.map.zoomOut();
  });
}

function requestUserLocation(flyToUser = true) {
  if (!navigator.geolocation) {
    showToast('Geolocation is not supported by your browser.');
    return;
  }

  dom.btnMyLocation.classList.add('locating');

  navigator.geolocation.getCurrentPosition(
    (position) => {
      dom.btnMyLocation.classList.remove('locating');
      const { latitude, longitude, accuracy } = position.coords;
      state.userPosition = [latitude, longitude];
      mapMgr.updateUserLocation([latitude, longitude], accuracy);

      if (flyToUser) {
        mapMgr.flyTo([latitude, longitude], 16);
      }
    },
    (error) => {
      dom.btnMyLocation.classList.remove('locating');
      if (error.code === 1) {
        showToast('Location permission denied.');
      } else {
        showToast('Could not get your location.');
      }
    },
    {
      enableHighAccuracy: true,
      timeout: 10000,
      maximumAge: 60000
    }
  );

  // Also start continuous tracking if not already
  if (!navMgr.watchId && navigator.geolocation) {
    navMgr.startTracking();
  }
}

// ============================================================
// SETTINGS
// ============================================================

function bindSettingsEvents() {
  // Open settings
  dom.btnSettings.addEventListener('click', () => {
    dom.settingsOverlay.classList.add('visible');
    populateVoiceSelect();
  });

  // Close settings
  dom.btnCloseSettings.addEventListener('click', () => {
    dom.settingsOverlay.classList.remove('visible');
  });

  // Click overlay background to close
  dom.settingsOverlay.addEventListener('click', (e) => {
    if (e.target === dom.settingsOverlay) {
      dom.settingsOverlay.classList.remove('visible');
    }
  });

  // Dark mode toggle
  dom.toggleDarkMode.addEventListener('change', () => {
    applyTheme(dom.toggleDarkMode.checked ? 'dark' : 'light');
  });

  // Voice toggle
  dom.toggleVoice.addEventListener('change', () => {
    voiceMgr.setEnabled(dom.toggleVoice.checked);
  });

  // High contrast toggle
  dom.toggleHighContrast.addEventListener('change', () => {
    state.highContrast = dom.toggleHighContrast.checked;
    document.documentElement.setAttribute(
      'data-contrast',
      state.highContrast ? 'high' : ''
    );
    storage.set('high_contrast', state.highContrast);
  });

  // Large text toggle
  dom.toggleLargeText.addEventListener('change', () => {
    state.largeText = dom.toggleLargeText.checked;
    document.documentElement.setAttribute(
      'data-text-size',
      state.largeText ? 'large' : ''
    );
    storage.set('large_text', state.largeText);
  });

  // Voice selector
  dom.voiceSelect.addEventListener('change', () => {
    voiceMgr.setVoice(dom.voiceSelect.value);
  });
}

function populateVoiceSelect() {
  const voices = voiceMgr.getVoices();
  dom.voiceSelect.innerHTML = '';

  if (voices.length === 0) {
    const opt = document.createElement('option');
    opt.textContent = 'Default voice';
    dom.voiceSelect.appendChild(opt);
    return;
  }

  voices.forEach((voice) => {
    const opt = document.createElement('option');
    opt.value = voice.name;
    opt.textContent = `${voice.name} (${voice.lang})`;
    if (voiceMgr.selectedVoice && voice.name === voiceMgr.selectedVoice.name) {
      opt.selected = true;
    }
    dom.voiceSelect.appendChild(opt);
  });
}

// ============================================================
// UTILITIES
// ============================================================

function showLoading(active) {
  dom.loadingBar.classList.toggle('active', active);
}

function escapeHtml(text) {
  const el = document.createElement('span');
  el.textContent = text;
  return el.innerHTML;
}

// ============================================================
// SERVICE WORKER REGISTRATION
// ============================================================

function registerServiceWorker() {
  if ('serviceWorker' in navigator) {
    navigator.serviceWorker
      .register('/sw.js')
      .then((reg) => {
        console.log('Service Worker registered:', reg.scope);
      })
      .catch((err) => {
        console.warn('Service Worker registration failed:', err);
      });
  }
}
