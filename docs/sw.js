/* Halyard service worker.

   Strategy: network-first with a cache fallback, plus a full precache at install.
   Cache-first would be marginally faster, but it pins whatever was cached the
   first time — you would keep running old code until the cache name changed.
   Network-first means the app is always current when the server is reachable
   and still works completely offline when it is not. */
const CACHE = 'halyard-v6';
const ASSETS = [
  '.',
  'index.html',
  'styles.css',
  'app.js',
  'manifest.webmanifest',
  'data/flags.json',
  'data/flag-svgs.json',
  'fonts/bricolage-latin.woff2',
  'fonts/bricolage-latin-ext.woff2',
  'fonts/instrument-latin.woff2',
  'fonts/instrument-latin-ext.woff2',
  'icons/icon-192.png',
  'icons/icon-512.png',
  'icons/icon-maskable-512.png',
];

self.addEventListener('install', (e) => {
  e.waitUntil(
    caches.open(CACHE)
      .then((c) => c.addAll(ASSETS))
      .then(() => self.skipWaiting())
  );
});

self.addEventListener('activate', (e) => {
  e.waitUntil(
    caches.keys()
      .then((keys) => Promise.all(keys.filter((k) => k !== CACHE).map((k) => caches.delete(k))))
      .then(() => self.clients.claim())
  );
});

self.addEventListener('fetch', (e) => {
  const req = e.request;
  if (req.method !== 'GET') return;
  if (new URL(req.url).origin !== self.location.origin) return;

  e.respondWith(
    fetch(req)
      .then((res) => {
        if (res && res.ok && res.type === 'basic') {
          const copy = res.clone();
          caches.open(CACHE).then((c) => c.put(req, copy));
        }
        return res;
      })
      .catch(() =>
        caches.match(req, { ignoreSearch: true })
          .then((hit) => hit || caches.match('index.html'))
      )
  );
});
