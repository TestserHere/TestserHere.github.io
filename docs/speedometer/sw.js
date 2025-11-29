const CACHE = 'speedometer-v1';
const FILES = ['index.html', 'speedometer.png', 'sw.js'];

self.addEventListener('install', e => {
  e.waitUntil(
    caches.open(CACHE).then(cache => {
      return Promise.all(
        FILES.map(file => {
          return fetch(file).then(response => {
            if (response.ok) {
              return cache.put(file, response);
            }
          }).catch(err => {
            console.warn(`Failed to cache ${file}:`, err);
          });
        })
      );
    })
  );
});

self.addEventListener('fetch', e => {
  e.respondWith(caches.match(e.request).then(r => r || fetch(e.request)));
});

