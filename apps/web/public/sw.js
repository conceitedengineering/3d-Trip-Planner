const APP_SHELL_CACHE = 'app-shell-v1';
const TRANSIT_CACHE = 'transit-assets-v1';
const IMMUTABLE_CACHE = 'immutable-assets-v1';
const APP_SHELL_FILES = ['/', '/index.html', '/manifest.webmanifest'];
const TRANSIT_MAX_AGE_MS = 7 * 24 * 60 * 60 * 1000;

self.addEventListener('install', (event) => {
  event.waitUntil(caches.open(APP_SHELL_CACHE).then((cache) => cache.addAll(APP_SHELL_FILES)));
  self.skipWaiting();
});

self.addEventListener('activate', (event) => {
  event.waitUntil(self.clients.claim());
});

self.addEventListener('fetch', (event) => {
  const url = new URL(event.request.url);

  if (url.pathname === '/transit/manifest.json') {
    event.respondWith(networkFirst(event.request, TRANSIT_CACHE));
    return;
  }

  if (/\.[a-f0-9]{10}\.min\.json$/.test(url.pathname)) {
    event.respondWith(cacheFirst(event.request, IMMUTABLE_CACHE));
    return;
  }

  if (url.pathname.startsWith('/transit/')) {
    event.respondWith(staleWhileRevalidate(event.request, TRANSIT_CACHE));
    return;
  }

  if (url.origin === location.origin) {
    event.respondWith(cacheFirst(event.request, APP_SHELL_CACHE));
  }
});

async function cacheFirst(request, cacheName) {
  const cache = await caches.open(cacheName);
  const cached = await cache.match(request);
  if (cached) {
    return cached;
  }

  const response = await fetch(request);
  if (response.ok) {
    cache.put(request, response.clone());
  }
  return response;
}

async function networkFirst(request, cacheName) {
  const cache = await caches.open(cacheName);
  try {
    const response = await fetch(request);
    if (response.ok) {
      cache.put(request, stampResponse(response.clone()));
    }
    return response;
  } catch {
    return (await cache.match(request)) || new Response('Offline', { status: 503 });
  }
}

async function staleWhileRevalidate(request, cacheName) {
  const cache = await caches.open(cacheName);
  const cached = await cache.match(request);

  const stale = cached ? isStale(cached) : true;
  const networkPromise = fetch(request)
    .then((response) => {
      if (response.ok) {
        cache.put(request, stampResponse(response.clone()));
      }
      return response;
    })
    .catch(() => cached);

  if (cached && !stale) {
    void networkPromise;
    return cached;
  }

  return (await networkPromise) || cached || new Response('Offline', { status: 503 });
}

function stampResponse(response) {
  const headers = new Headers(response.headers);
  headers.set('sw-fetched-at', Date.now().toString());
  return new Response(response.body, {
    status: response.status,
    statusText: response.statusText,
    headers,
  });
}

function isStale(response) {
  const stamped = Number(response.headers.get('sw-fetched-at') || '0');
  return Date.now() - stamped > TRANSIT_MAX_AGE_MS;
}
