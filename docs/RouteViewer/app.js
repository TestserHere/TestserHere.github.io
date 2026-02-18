/**
 * Route Viewer — map places, compute route, export video or JSON
 * Uses MapLibre GL JS, OSRM for routing (route line follows roads), Nominatim for geocoding.
 * Base map: CARTO Voyager (same as route-viewer-map — detailed street map).
 */

(function () {
  const OSRM_BASE = 'https://router.project-osrm.org/route/v1';
  const NOMINATIM_BASE = 'https://nominatim.openstreetmap.org/search';
  const MAP_STYLE = 'https://basemaps.cartocdn.com/gl/voyager-gl-style/style.json';

  let map = null;
  let waypoints = [];
  let routeGeoJSON = null;
  let routeSourceId = 'route';
  let routeLayerId = 'route-line';
  let markersSourceId = 'waypoints';
  let currentMode = 'driving';
  let routeStats = { distance: null, duration: null };
  let drivingStats = null;
  let walkingStats = null;
  let recording = false;
  let mediaRecorder = null;
  let recordedChunks = [];

  const $ = (id) => document.getElementById(id);
  const placeInput = $('place-input');
  const addPlaceBtn = $('add-place');
  const waypointsList = $('waypoints-list');
  const clearWaypointsBtn = $('clear-waypoints');
  const reverseWaypointsBtn = $('reverse-waypoints');
  const modeTabs = document.querySelectorAll('.mode-tab');
  const statDistance = $('stat-distance');
  const statDuration = $('stat-duration');
  const bothStatsEl = $('both-stats');
  const statDriving = $('stat-driving');
  const statWalking = $('stat-walking');
  const computeRouteBtn = $('compute-route');
  const exportVideoBtn = $('export-video');
  const exportJsonBtn = $('export-json');
  const importJsonBtn = $('import-json');
  const importFileInput = $('import-file');
  const recordingIndicator = $('recording-indicator');
  const videoSpeedInput = $('video-speed');
  const videoSpeedValue = $('video-speed-value');
  const mapLoadingEl = $('map-loading');

  function initMap() {
    map = new maplibregl.Map({
      container: 'map',
      style: MAP_STYLE,
      center: [133, -25],   // Australia
      zoom: 4,
      pitch: 0,
      bearing: 0
    });

    map.addControl(new maplibregl.NavigationControl(), 'top-right');

    map.on('load', () => {
      map.resize();
      map.addSource(markersSourceId, {
        type: 'geojson',
        data: { type: 'FeatureCollection', features: [] }
      });
      map.addLayer({
        id: 'waypoints-circles',
        type: 'circle',
        source: markersSourceId,
        paint: {
          'circle-radius': 10,
          'circle-color': '#58a6ff',
          'circle-stroke-width': 2,
          'circle-stroke-color': '#fff'
        }
      });
      map.addLayer({
        id: 'waypoints-labels',
        type: 'symbol',
        source: markersSourceId,
        layout: {
          'text-field': ['get', 'number'],
          'text-size': 12,
          'text-offset': [0, 1.2]
        },
        paint: { 'text-color': '#fff' }
      });

      map.addSource(routeSourceId, {
        type: 'geojson',
        data: { type: 'FeatureCollection', features: [] }
      });
      map.addLayer({
        id: routeLayerId,
        type: 'line',
        source: routeSourceId,
        layout: { 'line-join': 'round', 'line-cap': 'round' },
        paint: {
          'line-color': '#58a6ff',
          'line-width': 5,
          'line-opacity': 0.9
        }
      });

      map.on('click', onMapClick);

      // Hide loading once map has painted and tiles are ready
      const hideLoading = () => {
        map.resize();
        if (mapLoadingEl) mapLoadingEl.classList.add('hidden');
      };
      map.once('idle', hideLoading);
      // Fallback if idle is slow (e.g. slow tile server)
      setTimeout(hideLoading, 8000);
    });
  }

  function onMapClick(e) {
    const { lng, lat } = e.lngLat;
    addWaypoint(lng, lat, `Point ${waypoints.length + 1}`);
  }

  function addWaypoint(lng, lat, label = null) {
    waypoints.push({ lng, lat, label: label || `Waypoint ${waypoints.length + 1}` });
    updateWaypointsList();
    updateMarkersSource();
    updateComputeButton();
    fitMapToWaypoints();
  }

  function updateWaypointsList() {
    waypointsList.innerHTML = waypoints
      .map((w, i) => `
        <li class="waypoint-item" data-index="${i}">
          <span class="waypoint-num">${i + 1}</span>
          <span class="waypoint-label" title="${escapeHtml(w.label)}">${escapeHtml(w.label)}</span>
          <button type="button" class="waypoint-remove" data-index="${i}">Remove</button>
        </li>
      `)
      .join('');

    waypointsList.querySelectorAll('.waypoint-remove').forEach(btn => {
      btn.addEventListener('click', (e) => {
        const i = parseInt(e.target.dataset.index, 10);
        waypoints.splice(i, 1);
        updateWaypointsList();
        updateMarkersSource();
        updateComputeButton();
        clearRoute();
      });
    });
  }

  function escapeHtml(s) {
    const div = document.createElement('div');
    div.textContent = s;
    return div.innerHTML;
  }

  function updateMarkersSource() {
    if (!map || !map.getSource(markersSourceId)) return;
    const features = waypoints.map((w, i) => ({
      type: 'Feature',
      geometry: { type: 'Point', coordinates: [w.lng, w.lat] },
      properties: { number: String(i + 1) }
    }));
    map.getSource(markersSourceId).setData({
      type: 'FeatureCollection',
      features
    });
  }

  function updateComputeButton() {
    computeRouteBtn.disabled = waypoints.length < 2;
  }

  function fitMapToWaypoints() {
    if (!map || waypoints.length === 0) return;
    const lngs = waypoints.map(w => w.lng);
    const lats = waypoints.map(w => w.lat);
    map.fitBounds(
      [[Math.min(...lngs), Math.min(...lats)], [Math.max(...lngs), Math.max(...lats)]],
      { padding: 60, maxZoom: 14, duration: 800 }
    );
  }

  async function geocode(query) {
    const params = new URLSearchParams({
      q: query,
      format: 'json',
      limit: '1'
    });
    const res = await fetch(`${NOMINATIM_BASE}?${params}`, {
      headers: { Accept: 'application/json' }
    });
    const data = await res.json();
    if (!data || data.length === 0) return null;
    const { lat, lon, display_name } = data[0];
    return { lat: parseFloat(lat), lng: parseFloat(lon), label: display_name };
  }

  async function addPlaceFromInput() {
    const query = placeInput.value.trim();
    if (!query) return;
    addPlaceBtn.disabled = true;
    addPlaceBtn.textContent = '…';
    try {
      const result = await geocode(query);
      if (result) {
        addWaypoint(result.lng, result.lat, result.label);
        placeInput.value = '';
      } else {
        alert('No place found. Try another search or click on the map.');
      }
    } catch (e) {
      alert('Search failed. Try again or add a point by clicking the map.');
    }
    addPlaceBtn.disabled = false;
    addPlaceBtn.textContent = '+ Add';
  }

  function clearRoute() {
    routeGeoJSON = null;
    routeStats = { distance: null, duration: null };
    drivingStats = null;
    walkingStats = null;
    if (bothStatsEl) bothStatsEl.classList.add('hidden');
    if (map && map.getSource(routeSourceId)) {
      map.getSource(routeSourceId).setData({ type: 'FeatureCollection', features: [] });
    }
    statDistance.textContent = '—';
    statDuration.textContent = '—';
    if (statDriving) statDriving.textContent = '—';
    if (statWalking) statWalking.textContent = '—';
  }

  function getDistanceFromLatLonInKm(lat1, lon1, lat2, lon2) {
    const R = 6371; // Earth's radius in km
    const dLat = ((lat2 - lat1) * Math.PI) / 180;
    const dLon = ((lon2 - lon1) * Math.PI) / 180;
    const a =
      Math.sin(dLat / 2) * Math.sin(dLat / 2) +
      Math.cos((lat1 * Math.PI) / 180) *
        Math.cos((lat2 * Math.PI) / 180) *
        Math.sin(dLon / 2) *
        Math.sin(dLon / 2);
    const c = 2 * Math.atan2(Math.sqrt(a), Math.sqrt(1 - a));
    return R * c;
  }

  /** Total distance (m) and duration (s) from waypoints using Haversine + assumed speeds (walk 5 km/h, drive 50 km/h). */
  function getRouteStatsFromWaypoints(mode) {
    if (waypoints.length < 2) return { distance: 0, duration: 0 };
    let totalKm = 0;
    for (let i = 0; i < waypoints.length - 1; i++) {
      const a = waypoints[i];
      const b = waypoints[i + 1];
      totalKm += getDistanceFromLatLonInKm(a.lat, a.lng, b.lat, b.lng);
    }
    const distanceMeters = Math.round(totalKm * 1000);
    const speedKmh = mode === 'walking' ? 5 : 50;
    const durationSeconds = Math.round((totalKm / speedKmh) * 3600);
    return { distance: distanceMeters, duration: durationSeconds };
  }

  function formatDistance(meters) {
    if (meters >= 1000) return (meters / 1000).toFixed(1) + ' km';
    return Math.round(meters) + ' m';
  }

  function formatDuration(seconds) {
    const h = Math.floor(seconds / 3600);
    const m = Math.floor((seconds % 3600) / 60);
    if (h > 0) return `${h}h ${m}m`;
    if (m > 0) return `${m} min`;
    return '< 1 min';
  }

  // Route geometry from OSRM always follows roads (driving/foot profile); we never draw straight lines.
  async function fetchRoute(profile) {
    const coords = waypoints.map(w => `${w.lng},${w.lat}`).join(';');
    const url = `${OSRM_BASE}/${profile}/${coords}?overview=full&geometries=geojson`;
    const res = await fetch(url);
    const data = await res.json();
    if (data.code !== 'Ok' || !data.routes || !data.routes[0]) {
      throw new Error(data.message || 'Route not found');
    }
    const route = data.routes[0];
    return {
      geometry: route.geometry,
      distance: route.distance,
      duration: route.duration
    };
  }

  function updateStatsDisplay() {
    const stats = currentMode === 'walking' ? walkingStats : drivingStats;
    if (stats) {
      statDistance.textContent = formatDistance(stats.distance);
      statDuration.textContent = formatDuration(stats.duration);
    }
    if (bothStatsEl && (drivingStats || walkingStats)) {
      bothStatsEl.classList.remove('hidden');
      if (statDriving) statDriving.textContent = drivingStats
        ? `${formatDuration(drivingStats.duration)} · ${formatDistance(drivingStats.distance)}`
        : '—';
      if (statWalking) statWalking.textContent = walkingStats
        ? `${formatDuration(walkingStats.duration)} · ${formatDistance(walkingStats.distance)}`
        : '—';
    }
  }

  async function computeRoute() {
    if (waypoints.length < 2) return;
    computeRouteBtn.disabled = true;
    computeRouteBtn.textContent = 'Computing…';
    clearRoute();
    try {
      const [drivingResult, walkingResult] = await Promise.all([
        fetchRoute('driving').catch(() => null),
        fetchRoute('foot').catch(() => null)
      ]);
      const primary = currentMode === 'walking' ? walkingResult : drivingResult;
      if (!primary) throw new Error('Could not compute route for selected mode');
      // Distance and duration from Haversine between waypoints + assumed speeds (not OSRM)
      drivingStats = getRouteStatsFromWaypoints('driving');
      walkingStats = getRouteStatsFromWaypoints('walking');
      routeGeoJSON = {
        type: 'Feature',
        properties: {},
        geometry: primary.geometry
      };
      routeStats = currentMode === 'walking' ? walkingStats : drivingStats;
      map.getSource(routeSourceId).setData({
        type: 'FeatureCollection',
        features: [routeGeoJSON]
      });
      updateStatsDisplay();
      fitMapToWaypoints();
    } catch (e) {
      alert('Could not compute route: ' + (e.message || 'Unknown error'));
    }
    computeRouteBtn.disabled = false;
    computeRouteBtn.textContent = 'Compute route';
  }

  function getRouteCoordinates() {
    if (!routeGeoJSON || !routeGeoJSON.geometry || routeGeoJSON.geometry.type !== 'LineString') return [];
    return routeGeoJSON.geometry.coordinates;
  }

  function segmentLengthMeters(a, b) {
    if (!Array.isArray(a) || !Array.isArray(b) || a.length < 2 || b.length < 2) return 0;
    return getDistanceFromLatLonInKm(a[1], a[0], b[1], b[0]) * 1000;
  }

  /** Build cumulative distance (m) along coords: cumDist[i] = distance from coords[0] to coords[i]. */
  function buildCumulativeDistances(coords) {
    const cum = [0];
    for (let i = 1; i < coords.length; i++) {
      const seg = segmentLengthMeters(coords[i - 1], coords[i]);
      cum.push(cum[i - 1] + seg);
    }
    return cum;
  }

  /** Get position [lng, lat] at distance d (meters) along the route; cumDist from buildCumulativeDistances. */
  function positionAtDistance(coords, cumDist, d) {
    const total = cumDist[cumDist.length - 1];
    if (total <= 0 || d <= 0) return coords[0].slice();
    if (d >= total) return coords[coords.length - 1].slice();
    let i = 0;
    while (i < cumDist.length - 1 && cumDist[i + 1] <= d) i++;
    const segStart = cumDist[i];
    const segEnd = cumDist[i + 1];
    const frac = segEnd > segStart ? (d - segStart) / (segEnd - segStart) : 0;
    const a = coords[i];
    const b = coords[i + 1];
    return [a[0] + (b[0] - a[0]) * frac, a[1] + (b[1] - a[1]) * frac];
  }

  function animateCameraAlongRoute(durationMs, onProgress, onFrame) {
    const coords = getRouteCoordinates();
    if (coords.length < 2) return Promise.resolve();

    const ZOOM = 17.5;
    const PITCH = 45;
    const BEARING_LOOKAHEAD_M = 40; // meters ahead for bearing
    const MAX_BEARING_DELTA = 2.5;
    let lastBearing = null;

    const cumDist = buildCumulativeDistances(coords);
    const totalDistM = cumDist[cumDist.length - 1];
    if (totalDistM <= 0) return Promise.resolve();

    return new Promise((resolve) => {
      const start = performance.now();

      function tick(now) {
        const elapsed = now - start;
        const t = Math.min(elapsed / durationMs, 1);
        const eased = 1 - Math.pow(1 - t, 1.8);
        const d = eased * totalDistM;

        const pos = positionAtDistance(coords, cumDist, d);
        const lngCur = pos[0];
        const latCur = pos[1];

        const dLook = Math.min(d + BEARING_LOOKAHEAD_M, totalDistM);
        const lookPos = positionAtDistance(coords, cumDist, dLook);
        const lngLook = lookPos[0];
        const latLook = lookPos[1];
        let bearing = (Math.atan2(
          (lngLook - lngCur) * Math.cos((latCur * Math.PI) / 180),
          latLook - latCur
        ) * 180) / Math.PI;
        if (lastBearing != null) {
          let delta = bearing - lastBearing;
          while (delta > 180) delta -= 360;
          while (delta < -180) delta += 360;
          delta = Math.max(-MAX_BEARING_DELTA, Math.min(MAX_BEARING_DELTA, delta));
          bearing = lastBearing + delta;
        }
        lastBearing = bearing;

        map.easeTo({
          center: [lngCur, latCur],
          bearing,
          pitch: PITCH,
          zoom: ZOOM,
          duration: 0
        });

        if (onFrame) onFrame(now);
        if (onProgress) onProgress(eased);

        if (t < 1) {
          requestAnimationFrame(tick);
        } else {
          resolve();
        }
      }
      requestAnimationFrame(tick);
    });
  }

  function startVideoRecording() {
    const coords = getRouteCoordinates();
    if (coords.length < 2) {
      alert('Compute a route first, then record video.');
      return;
    }

    // 16:9 output
    const OUT_W = 1920;
    const OUT_H = 1080;
    const outCanvas = document.createElement('canvas');
    outCanvas.width = OUT_W;
    outCanvas.height = OUT_H;
    const outCtx = outCanvas.getContext('2d');

    const CAPTURE_FPS = 30;
    const captureIntervalMs = 1000 / CAPTURE_FPS;
    let lastCaptureTime = 0;

    function captureFrameTo16x9() {
      const mapCanvas = map.getCanvas();
      const mw = mapCanvas.width;
      const mh = mapCanvas.height;
      if (mw === 0 || mh === 0) return;
      const scale = Math.max(OUT_W / mw, OUT_H / mh);
      const srcW = OUT_W / scale;
      const srcH = OUT_H / scale;
      const srcX = (mw - srcW) / 2;
      const srcY = (mh - srcH) / 2;
      outCtx.drawImage(mapCanvas, srcX, srcY, srcW, srcH, 0, 0, OUT_W, OUT_H);
    }

    function captureFrameThrottled(now) {
      if (now - lastCaptureTime >= captureIntervalMs) {
        lastCaptureTime = now;
        captureFrameTo16x9();
      }
    }

    const stream = outCanvas.captureStream(CAPTURE_FPS);
    const mime = MediaRecorder.isTypeSupported('video/webm;codecs=vp9')
      ? 'video/webm;codecs=vp9'
      : 'video/webm';
    mediaRecorder = new MediaRecorder(stream, { mimeType: mime, videoBitsPerSecond: 4000000 });
    recordedChunks = [];
    mediaRecorder.ondataavailable = (e) => {
      if (e.data.size) recordedChunks.push(e.data);
    };
    mediaRecorder.onstop = () => {
      recording = false;
      recordingIndicator.classList.add('hidden');
      exportVideoBtn.disabled = false;
      exportVideoBtn.textContent = 'Record video';
      const blob = new Blob(recordedChunks, { type: mime });
      const url = URL.createObjectURL(blob);
      const a = document.createElement('a');
      a.href = url;
      a.download = `route-${Date.now()}.webm`;
      a.click();
      URL.revokeObjectURL(url);
    };

    recording = true;
    recordingIndicator.classList.remove('hidden');
    exportVideoBtn.disabled = true;
    exportVideoBtn.textContent = 'Recording…';

    const speed = videoSpeedInput && !isNaN(parseFloat(videoSpeedInput.value))
      ? Math.max(0.1, Math.min(2, parseFloat(videoSpeedInput.value)))
      : 1;
    const baseDurationMs = 15000;
    const durationMs = Math.round(baseDurationMs / speed);
    lastCaptureTime = 0;
    captureFrameTo16x9(); // one frame so first captured frame is not black
    mediaRecorder.start(100);

    animateCameraAlongRoute(durationMs, null, (now) => captureFrameThrottled(now)).then(() => {
      setTimeout(() => {
        if (mediaRecorder && mediaRecorder.state === 'recording') {
          mediaRecorder.stop();
        }
      }, 500);
    });
  }

  function exportJson() {
    const coords = waypoints.map(w => ({ lng: w.lng, lat: w.lat, label: w.label }));
    const payload = {
      version: 1,
      exportedAt: new Date().toISOString(),
      waypoints: coords,
      route: routeGeoJSON
        ? {
            geometry: routeGeoJSON.geometry,
            distance: routeStats.distance,
            duration: routeStats.duration,
            mode: currentMode,
            driving: drivingStats ? { distance: drivingStats.distance, duration: drivingStats.duration } : null,
            walking: walkingStats ? { distance: walkingStats.distance, duration: walkingStats.duration } : null
          }
        : null
    };
    const blob = new Blob([JSON.stringify(payload, null, 2)], { type: 'application/json' });
    const url = URL.createObjectURL(blob);
    const a = document.createElement('a');
    a.href = url;
    a.download = `route-${Date.now()}.json`;
    a.click();
    URL.revokeObjectURL(url);
  }

  function importJson() {
    importFileInput.click();
  }

  function handleFileImport(e) {
    const file = e.target.files && e.target.files[0];
    if (!file) return;
    const reader = new FileReader();
    reader.onload = (ev) => {
      try {
        const data = JSON.parse(ev.target.result);
        if (!data.waypoints || !Array.isArray(data.waypoints)) {
          alert('Invalid route file: missing waypoints.');
          return;
        }
        waypoints = data.waypoints.map(w => ({
          lng: w.lng,
          lat: w.lat,
          label: w.label || `Waypoint`
        }));
        updateWaypointsList();
        updateMarkersSource();
        updateComputeButton();
        clearRoute();

        if (data.route && data.route.geometry) {
          routeGeoJSON = {
            type: 'Feature',
            properties: {},
            geometry: data.route.geometry
          };
          drivingStats = data.route.driving || null;
          walkingStats = data.route.walking || null;
          routeStats = {
            distance: data.route.distance ?? (currentMode === 'walking' ? walkingStats?.distance : drivingStats?.distance) ?? null,
            duration: data.route.duration ?? (currentMode === 'walking' ? walkingStats?.duration : drivingStats?.duration) ?? null
          };
          if (map && map.getSource(routeSourceId)) {
            map.getSource(routeSourceId).setData({
              type: 'FeatureCollection',
              features: [routeGeoJSON]
            });
          }
          if (data.route.mode) {
            currentMode = data.route.mode;
            modeTabs.forEach(t => t.classList.toggle('active', t.dataset.mode === currentMode));
          }
          updateStatsDisplay();
        }
        fitMapToWaypoints();
      } catch (err) {
        alert('Invalid or corrupted JSON file.');
      }
    };
    reader.readAsText(file);
    e.target.value = '';
  }

  function updateVideoSpeedLabel() {
    if (videoSpeedValue && videoSpeedInput) {
      const v = parseFloat(videoSpeedInput.value);
      videoSpeedValue.textContent = (v === Math.floor(v) ? v : v.toFixed(2)) + '×';
    }
  }

  function bindUi() {
    if (videoSpeedInput) {
      videoSpeedInput.addEventListener('input', updateVideoSpeedLabel);
      videoSpeedInput.addEventListener('change', updateVideoSpeedLabel);
      updateVideoSpeedLabel();
    }
    addPlaceBtn.addEventListener('click', addPlaceFromInput);
    placeInput.addEventListener('keydown', (e) => {
      if (e.key === 'Enter') addPlaceFromInput();
    });
    clearWaypointsBtn.addEventListener('click', () => {
      waypoints = [];
      updateWaypointsList();
      updateMarkersSource();
      updateComputeButton();
      clearRoute();
    });
    reverseWaypointsBtn.addEventListener('click', () => {
      waypoints.reverse();
      updateWaypointsList();
      updateMarkersSource();
      clearRoute();
      updateComputeButton();
    });
    modeTabs.forEach(tab => {
      tab.addEventListener('click', () => {
        currentMode = tab.dataset.mode;
        modeTabs.forEach(t => t.classList.toggle('active', t.dataset.mode === currentMode));
        if (routeGeoJSON && (currentMode === 'walking' ? walkingStats : drivingStats)) {
          const stats = currentMode === 'walking' ? walkingStats : drivingStats;
          routeStats = stats;
          updateStatsDisplay();
          const profile = currentMode === 'walking' ? 'foot' : 'driving';
          fetchRoute(profile).then((r) => {
            routeGeoJSON = { type: 'Feature', properties: {}, geometry: r.geometry };
            map.getSource(routeSourceId).setData({
              type: 'FeatureCollection',
              features: [routeGeoJSON]
            });
          }).catch(() => {});
        } else if (waypoints.length >= 2) {
          computeRoute();
        }
      });
    });
    computeRouteBtn.addEventListener('click', computeRoute);
    exportVideoBtn.addEventListener('click', startVideoRecording);
    exportJsonBtn.addEventListener('click', exportJson);
    importJsonBtn.addEventListener('click', importJson);
    importFileInput.addEventListener('change', handleFileImport);
  }

  function main() {
    initMap();
    bindUi();
    updateComputeButton();
  }

  if (document.readyState === 'loading') {
    document.addEventListener('DOMContentLoaded', main);
  } else {
    main();
  }
})();
