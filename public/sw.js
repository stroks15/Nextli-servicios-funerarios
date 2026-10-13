const CACHE_NAME = 'nextli-configurator-v1';
const CORE = [
  '/',
  '/?modo=trabajador',
  '/configurator.css',
  '/catalog.css',
  '/config.js',
  '/cert-assets.js',
  '/certificate.js',
  '/inventory.js',
  '/app.js',
  '/manifest.webmanifest',
  '/images/nextli-logo.png'
];
self.addEventListener('install', event => {
  event.waitUntil(caches.open(CACHE_NAME).then(cache => cache.addAll(CORE)).then(() => self.skipWaiting()));
});
self.addEventListener('activate', event => {
  event.waitUntil(caches.keys().then(keys => Promise.all(keys.filter(key => key !== CACHE_NAME).map(key => caches.delete(key)))).then(() => self.clients.claim()));
});
self.addEventListener('fetch', event => {
  const request = event.request;
  if (request.method !== 'GET' || new URL(request.url).origin !== self.location.origin) return;
  event.respondWith(fetch(request).then(response => {
    if (response && response.ok) {
      const copy = response.clone();
      caches.open(CACHE_NAME).then(cache => cache.put(request, copy)).catch(() => {});
    }
    return response;
  }).catch(() => caches.match(request).then(cached => cached || (request.mode === 'navigate' ? caches.match('/') : Promise.reject(new Error('Sin conexión'))))));
});