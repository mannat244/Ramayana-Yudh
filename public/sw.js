/**
 * Ramayana Yudh — Progressive Web App Service Worker
 * Provides offline shell support, asset caching, and meets Google Chrome PWA installability requirements.
 */

const CACHE_NAME = 'ramayana-yudh-v1';

// Core shell assets required for the app to start
const PRECACHE_ASSETS = [
  './',
  './index.html',
  './manifest.webmanifest',
  './icons/icon-192.png',
  './icons/icon-512.png',
  './icons/icon-maskable-192.png',
  './icons/icon-maskable-512.png'
];

self.addEventListener('install', (event) => {
  event.waitUntil(
    caches.open(CACHE_NAME).then((cache) => {
      // Precache critical app shell, silently ignore individual failures
      return Promise.allSettled(
        PRECACHE_ASSETS.map((asset) => cache.add(asset))
      );
    }).then(() => self.skipWaiting())
  );
});

self.addEventListener('activate', (event) => {
  event.waitUntil(
    caches.keys().then((cacheNames) => {
      return Promise.all(
        cacheNames
          .filter((name) => name !== CACHE_NAME)
          .map((name) => caches.delete(name))
      );
    }).then(() => self.clients.claim())
  );
});

self.addEventListener('fetch', (event) => {
  const request = event.request;

  // 1. Only handle GET requests
  if (request.method !== 'GET') {
    return;
  }

  // 2. Ignore non-HTTP/HTTPS schemes (e.g. chrome-extension://)
  if (!request.url.startsWith('http')) {
    return;
  }

  // 3. For range requests (audio, media streaming), bypass service worker cache
  if (request.headers.has('range')) {
    event.respondWith(fetch(request));
    return;
  }

  // 4. Stale-while-revalidate / Network-first strategy for app resources
  event.respondWith(
    caches.match(request).then((cachedResponse) => {
      // Fetch fresh version in the background or for network-first
      const fetchPromise = fetch(request)
        .then((networkResponse) => {
          // If valid response, clone and cache it for static assets
          if (
            networkResponse &&
            networkResponse.status === 200 &&
            networkResponse.type === 'basic'
          ) {
            const responseToCache = networkResponse.clone();
            // Do not cache large 3D glb files in standard cache storage to prevent quota exhaustion
            const isLargeModel = request.url.endsWith('.glb');
            if (!isLargeModel) {
              caches.open(CACHE_NAME).then((cache) => {
                cache.put(request, responseToCache);
              });
            }
          }
          return networkResponse;
        })
        .catch(() => {
          // If offline and request is HTML navigation, fallback to root index.html
          if (request.mode === 'navigate') {
            return caches.match('./index.html') || caches.match('./');
          }
          return null;
        });

      // Return cached version if available, otherwise wait for network fetch
      return cachedResponse || fetchPromise;
    })
  );
});

