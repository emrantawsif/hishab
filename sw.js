// Offline support. App files come from the network when it's quick (so
// updates arrive), otherwise from the cache, so the app opens offline.

const CACHE = 'hishab-v7';
const FONT_CACHE = 'hishab-fonts';
const NETWORK_TIMEOUT_MS = 3000;
const SHELL = [
  './',
  './index.html',
  './manifest.webmanifest',
  './css/app.css',
  './js/app.js',
  './js/state.js',
  './js/money.js',
  './js/share.js',
  './js/util.js',
  './js/avatar.js',
  './js/sync.js',
  './icons/icon.svg',
  './icons/icon-192.png',
  './icons/icon-512.png',
  './icons/apple-touch-icon.png',
  './icons/pan-96.png',
];

self.addEventListener('install', event => {
  event.waitUntil(caches.open(CACHE).then(cache => cache.addAll(SHELL)).then(() => self.skipWaiting()));
});

self.addEventListener('activate', event => {
  event.waitUntil(
    caches.keys()
      .then(keys => Promise.all(keys.filter(key => key !== CACHE && key !== FONT_CACHE).map(key => caches.delete(key))))
      .then(() => self.clients.claim()),
  );
});

self.addEventListener('fetch', event => {
  const { request } = event;
  if (request.method !== 'GET') return;
  const url = new URL(request.url);
  if (url.origin === location.origin) event.respondWith(networkFirst(request));
  else if (url.hostname === 'fonts.googleapis.com' || url.hostname === 'fonts.gstatic.com') event.respondWith(cacheFirst(request));
});

const timeout = ms => new Promise((_, reject) => setTimeout(() => reject(new Error('timeout')), ms));

async function networkFirst(request) {
  const cache = await caches.open(CACHE);
  // "no-cache" revalidates with the server (cheap 304s), so a new deploy shows up on the next open.
  // Navigation requests can't be cloned with options, so fetch those by URL.
  const fresh = request.mode === 'navigate' ? request.url : request;
  const network = fetch(fresh, { cache: 'no-cache' }).then(response => {
    if (response.ok) cache.put(request, response.clone());
    return response;
  });
  network.catch(() => {});
  try {
    return await Promise.race([network, timeout(NETWORK_TIMEOUT_MS)]);
  } catch {
    const cached = (await cache.match(request, { ignoreSearch: true }))
      || (request.mode === 'navigate' ? await cache.match('./index.html') : undefined);
    return cached || network.catch(() => Response.error());
  }
}

async function cacheFirst(request) {
  const cache = await caches.open(FONT_CACHE);
  const cached = await cache.match(request);
  if (cached) return cached;
  const response = await fetch(request);
  if (response.ok || response.type === 'opaque') cache.put(request, response.clone());
  return response;
}
