// ============================================================
// TestserMaps Service Worker
// Handles offline caching for tiles, API responses, and app shell
// ============================================================

const CACHE_VERSION = 'testser-maps-v1';
const TILE_CACHE = 'testser-tiles-v1';
const API_CACHE = 'testser-api-v1';
const STATIC_CACHE = 'testser-static-v1';

// App shell files to precache on install
const APP_SHELL = [
  '/',
  '/index.html',
  '/css/styles.css',
  '/js/utils.js',
  '/js/map.js',
  '/js/search.js',
  '/js/routing.js',
  '/js/navigation.js',
  '/js/voice.js',
  '/js/app.js',
  '/manifest.json',
  '/icons/icon-192.svg',
  '/icons/icon-512.svg'
];

// External CDN resources to cache
const CDN_RESOURCES = [
  'https://unpkg.com/leaflet@1.9.4/dist/leaflet.css',
  'https://unpkg.com/leaflet@1.9.4/dist/leaflet.js'
];

// Max tiles to cache (prevent storage bloat)
const MAX_TILE_CACHE_SIZE = 500;

// ---- Install: precache app shell ----
self.addEventListener('install', (event) => {
  event.waitUntil(
    Promise.all([
      caches.open(STATIC_CACHE).then((cache) => {
        return cache.addAll(APP_SHELL).catch((err) => {
          console.warn('SW: Some app shell files failed to cache:', err);
        });
      }),
      caches.open(STATIC_CACHE).then((cache) => {
        return cache.addAll(CDN_RESOURCES).catch((err) => {
          console.warn('SW: Some CDN resources failed to cache:', err);
        });
      })
    ]).then(() => self.skipWaiting())
  );
});

// ---- Activate: clean old caches ----
self.addEventListener('activate', (event) => {
  const validCaches = [STATIC_CACHE, TILE_CACHE, API_CACHE];
  event.waitUntil(
    caches.keys().then((keys) => {
      return Promise.all(
        keys
          .filter((key) => !validCaches.includes(key))
          .map((key) => {
            console.log('SW: Deleting old cache:', key);
            return caches.delete(key);
          })
      );
    }).then(() => self.clients.claim())
  );
});

// ---- Fetch: strategy based on request type ----
self.addEventListener('fetch', (event) => {
  const url = new URL(event.request.url);

  // Map tiles: cache-first with LRU eviction
  if (isTileRequest(url)) {
    event.respondWith(tileStrategy(event.request));
    return;
  }

  // Nominatim / OSRM API calls: network-first, fall back to cache
  if (isApiRequest(url)) {
    event.respondWith(apiStrategy(event.request));
    return;
  }

  // CDN resources (Leaflet): cache-first
  if (isCdnRequest(url)) {
    event.respondWith(cacheFirst(event.request, STATIC_CACHE));
    return;
  }

  // App shell: cache-first, fallback to network
  event.respondWith(cacheFirst(event.request, STATIC_CACHE));
});

// ---- Request type detection ----

function isTileRequest(url) {
  return (
    url.hostname.includes('tile.openstreetmap.org') ||
    url.hostname.includes('basemaps.cartocdn.com')
  );
}

function isApiRequest(url) {
  return (
    url.hostname.includes('nominatim.openstreetmap.org') ||
    url.hostname.includes('router.project-osrm.org')
  );
}

function isCdnRequest(url) {
  return url.hostname === 'unpkg.com';
}

// ---- Caching strategies ----

// Cache-first: check cache, fall back to network
async function cacheFirst(request, cacheName) {
  const cached = await caches.match(request);
  if (cached) return cached;

  try {
    const response = await fetch(request);
    if (response.ok) {
      const cache = await caches.open(cacheName);
      cache.put(request, response.clone());
    }
    return response;
  } catch (err) {
    // If offline and not in cache, return a basic offline page for navigation requests
    if (request.mode === 'navigate') {
      return caches.match('/index.html');
    }
    throw err;
  }
}

// Tile strategy: cache-first with size limit
async function tileStrategy(request) {
  const cache = await caches.open(TILE_CACHE);
  const cached = await cache.match(request);
  if (cached) return cached;

  try {
    const response = await fetch(request);
    if (response.ok) {
      // Evict oldest tiles if cache is too large
      await enforceTileCacheLimit(cache);
      cache.put(request, response.clone());
    }
    return response;
  } catch (err) {
    // Return a transparent 1x1 PNG for missing tiles when offline
    return new Response(
      Uint8Array.from(atob(
        'iVBORw0KGgoAAAANSUhEUgAAAAEAAAABCAYAAAAfFcSJAAAAC0lEQVQI12NgAAIABQAB' +
        'Nl7BcQAAAABJRU5ErkJggg=='
      ), c => c.charCodeAt(0)),
      { headers: { 'Content-Type': 'image/png' } }
    );
  }
}

// API strategy: network-first, cache as fallback
async function apiStrategy(request) {
  try {
    const response = await fetch(request);
    if (response.ok) {
      const cache = await caches.open(API_CACHE);
      cache.put(request, response.clone());
    }
    return response;
  } catch (err) {
    const cached = await caches.match(request);
    if (cached) return cached;
    return new Response(JSON.stringify({ error: 'offline' }), {
      status: 503,
      headers: { 'Content-Type': 'application/json' }
    });
  }
}

// Evict oldest tiles when cache exceeds limit
async function enforceTileCacheLimit(cache) {
  const keys = await cache.keys();
  if (keys.length > MAX_TILE_CACHE_SIZE) {
    // Delete oldest 50 tiles
    const toDelete = keys.slice(0, 50);
    await Promise.all(toDelete.map((key) => cache.delete(key)));
  }
}
