const cacheName = "DefaultCompany-Bull3D_v0.3-0.2";
const contentToCache = [
    "Build/webgl_1.4.7.loader.js",
    "Build/webgl_1.4.7.framework.js.unityweb",
    "Build/webgl_1.4.7.data.unityweb",
    "Build/webgl_1.4.7.wasm.unityweb",
    "TemplateData/style.css"
];

self.addEventListener('install', function (e) {
    console.log('[Service Worker] Install');
    self.skipWaiting();

    e.waitUntil((async function () {
      const cache = await caches.open(cacheName);
      // Pre-cache files individually so a single failed request can't
      // abort the install and leave the SW in a broken state.
      await Promise.all(contentToCache.map(async (url) => {
        try {
          await cache.add(url);
        } catch (err) {
          console.warn(`[Service Worker] Skipped pre-cache for ${url}:`, err);
        }
      }));
    })());
});

self.addEventListener('activate', function (e) {
    // Drop caches from prior deployments so a stale wasm/data file
    // can't survive a redeploy.
    e.waitUntil((async function () {
      const keys = await caches.keys();
      await Promise.all(keys.filter((k) => k !== cacheName).map((k) => caches.delete(k)));
      await self.clients.claim();
    })());
});

self.addEventListener('fetch', function (e) {
    // Only intercept GETs. Range requests return 206 partial content —
    // never cache those, otherwise we serve a partial wasm on the next load
    // and the runtime crashes with "memory access out of bounds".
    if (e.request.method !== 'GET' || e.request.headers.has('range')) return;

    e.respondWith((async function () {
      const cache = await caches.open(cacheName);
      const cached = await cache.match(e.request);
      if (cached) return cached;

      try {
        const response = await fetch(e.request);
        // Only store complete, same-origin 200 responses.
        if (response && response.status === 200 && response.type === 'basic') {
          cache.put(e.request, response.clone());
        }
        return response;
      } catch (err) {
        const fallback = await cache.match(e.request);
        if (fallback) return fallback;
        throw err;
      }
    })());
});
