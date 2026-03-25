const CACHE_NAME = 'executantul-cangurul-v1';
const APP_SHELL = [
  './',
  './index.html',
  './drawer_free.html',
  './robot.css',
  './manifest.webmanifest',
  './js/acorn_interpreter.js',
  './js/blockly_compressed.js',
  './js/blocks_compressed.js',
  './js/javascript_compressed.js',
  './js/python_compressed.js',
  './js/php_compressed.js',
  './js/lua_compressed.js',
  './js/dart_compressed.js',
  './js/ru.js',
  './js/ro_custom.js',
  './js/ace.js',
  './js/dialogs.js',
  './js/slider.js',
  './js/drwblocks.js',
  './js/drawer_free.js',
  './js/cng_parser.js',
  './js/colour.js',
  './js/drawer.js',
  './Media/app-icon.svg',
  './Media/drawer.png',
  './Media/icons.png',
  './Media/open.gif',
  './Media/save.gif',
  './Media/big-star.gif',
  './Media/star.gif',
  './Media/next-icon.png',
  './Media/prev-icon-gray.png',
  './Media/1x1.gif'
];

self.addEventListener('install', event => {
  event.waitUntil(
    caches.open(CACHE_NAME).then(cache => cache.addAll(APP_SHELL))
  );
  self.skipWaiting();
});

self.addEventListener('activate', event => {
  event.waitUntil(
    caches.keys().then(keys =>
      Promise.all(keys.filter(key => key !== CACHE_NAME).map(key => caches.delete(key)))
    )
  );
  self.clients.claim();
});

self.addEventListener('fetch', event => {
  if (event.request.method !== 'GET') {
    return;
  }
  event.respondWith(
    caches.match(event.request).then(cached => {
      if (cached) {
        return cached;
      }
      return fetch(event.request).then(response => {
        const copy = response.clone();
        caches.open(CACHE_NAME).then(cache => cache.put(event.request, copy));
        return response;
      }).catch(() => caches.match('./index.html'));
    })
  );
});
