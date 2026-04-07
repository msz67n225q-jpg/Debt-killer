// ZERO — Service Worker
// Cache-first for app shell; network-first for everything else.

const CACHE = 'zero-v4';
const SHELL = [
  '/',
  '/index.html',
  '/manifest.json',
  '/icons/icon-192.png',
  '/icons/icon-512.png',
  '/icons/icon-1024.png',
  '/icons/apple-touch-icon.png',
  '/icons/splash-750x1334.png',
  '/icons/splash-828x1792.png',
  '/icons/splash-1080x2340.png',
  '/icons/splash-1125x2436.png',
  '/icons/splash-1170x2532.png',
  '/icons/splash-1179x2556.png',
  '/icons/splash-1242x2688.png',
  '/icons/splash-1284x2778.png',
  '/icons/splash-1290x2796.png',
];

// ── Install: pre-cache the app shell ───────────────────────────────────────
self.addEventListener('install', e => {
  e.waitUntil(
    caches.open(CACHE).then(c => c.addAll(SHELL))
  );
  self.skipWaiting();
});

// ── Activate: delete old caches ─────────────────────────────────────────────
self.addEventListener('activate', e => {
  e.waitUntil(
    caches.keys().then(keys =>
      Promise.all(keys.filter(k => k !== CACHE).map(k => caches.delete(k)))
    )
  );
  self.clients.claim();
});

// ── Fetch: cache-first for shell, network-first for remote ──────────────────
self.addEventListener('fetch', e => {
  // Only handle same-origin GET requests
  if (e.request.method !== 'GET') return;
  const url = new URL(e.request.url);
  if (url.origin !== self.location.origin) return;

  // index.html: network-first so updates are always picked up
  const isHTML = e.request.url.endsWith('/') || e.request.url.endsWith('.html');
  if (isHTML) {
    e.respondWith(
      fetch(e.request).then(res => {
        const clone = res.clone();
        caches.open(CACHE).then(c => c.put(e.request, clone));
        return res;
      }).catch(() => caches.match(e.request))
    );
    return;
  }

  // Everything else: cache-first, populate on miss
  e.respondWith(
    caches.match(e.request).then(cached => {
      if (cached) return cached;
      return fetch(e.request).then(res => {
        if (res && res.status === 200) {
          const clone = res.clone();
          caches.open(CACHE).then(c => c.put(e.request, clone));
        }
        return res;
      }).catch(() => caches.match('/index.html'));
    })
  );
});
