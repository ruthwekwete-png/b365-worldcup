// B365 WC 2026 — Service Worker (cache-first, auto-update)
// Caches the shell on install; serves from cache first, falls back to network.
// When a new version of the data JS is pushed, the cache updates on next visit.

const CACHE_NAME = 'b365-wc-v2';
const SHELL_ASSETS = [
  '/b365-calendar/',
  '/b365-calendar/index.html',
  '/b365-calendar/wc_dashboard_data.js',
  '/b365-calendar/manifest.json',
  '/b365-calendar/icon-192.png',
  '/b365-calendar/icon-512.png',
];

// ── Install: pre-cache the app shell ─────────────────────────────────
self.addEventListener('install', (event) => {
  event.waitUntil(
    caches.open(CACHE_NAME).then((cache) => {
      console.log('[SW] Caching app shell');
      return cache.addAll(SHELL_ASSETS);
    })
  );
  // Activate immediately — don't wait for old tabs to close
  self.skipWaiting();
});

// ── Activate: clean up old caches ────────────────────────────────────
self.addEventListener('activate', (event) => {
  event.waitUntil(
    caches.keys().then((names) =>
      Promise.all(
        names
          .filter((name) => name !== CACHE_NAME)
          .map((name) => {
            console.log('[SW] Deleting old cache:', name);
            return caches.delete(name);
          })
      )
    )
  );
  // Take control of all open tabs immediately
  self.clients.claim();
});

// ── Fetch: cache-first, then network (with background update) ────────
self.addEventListener('fetch', (event) => {
  // Only handle GET requests within our scope
  if (event.request.method !== 'GET') return;

  event.respondWith(
    caches.match(event.request).then((cached) => {
      // Return cached version immediately if available
      const fetchPromise = fetch(event.request)
        .then((networkResponse) => {
          // Update the cache with the fresh version for next time
          if (networkResponse && networkResponse.status === 200) {
            const clone = networkResponse.clone();
            caches.open(CACHE_NAME).then((cache) => {
              cache.put(event.request, clone);
            });
          }
          return networkResponse;
        })
        .catch(() => {
          // Network failed — cached version (if any) was already returned
          return cached;
        });

      // Serve cache immediately; network update happens in background
      return cached || fetchPromise;
    })
  );
});
