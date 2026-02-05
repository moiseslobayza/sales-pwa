/* =========================================================
   sw.js — Service Worker (PWA offline) [iOS-friendly]
   - Precache assets
   - Navegación (abrir app): siempre sirve index.html del cache
   - Ignora query params (/?pwa=1) para que no rompa en iPhone
========================================================= */

const CACHE_NAME = "sandwicheria-v3";

const ASSETS = [
  "./",
  "./index.html",
  "./styles.css",
  "./app.js",
  "./manifest.json",
  "./icon-192.png",
  "./icon-512.png",
];

self.addEventListener("install", (event) => {
  event.waitUntil((async () => {
    const cache = await caches.open(CACHE_NAME);
    await cache.addAll(ASSETS);
  })());
  self.skipWaiting();
});

self.addEventListener("activate", (event) => {
  event.waitUntil((async () => {
    const keys = await caches.keys();
    await Promise.all(keys.map((k) => (k !== CACHE_NAME ? caches.delete(k) : null)));
    await self.clients.claim();
  })());
});

// Cache-first + navegación segura offline (clave para iPhone)
self.addEventListener("fetch", (event) => {
  const req = event.request;
  if (req.method !== "GET") return;

  // 1) Si es navegación (abrir la app / cambiar de pantalla)
  if (req.mode === "navigate") {
    event.respondWith((async () => {
      const cache = await caches.open(CACHE_NAME);

      // Siempre devolvé el index del cache (ignorando query params)
      const cachedIndex =
        (await cache.match("./index.html", { ignoreSearch: true })) ||
        (await cache.match("./", { ignoreSearch: true }));

      try {
        // Intento red para mantener actualizado cuando hay internet
        const fresh = await fetch(req);
        return fresh;
      } catch {
        // Sin internet: devolvé index cacheado
        return cachedIndex;
      }
    })());
    return;
  }

  // 2) Para assets (css/js/png): cache-first (ignorando query params)
  event.respondWith((async () => {
    const cache = await caches.open(CACHE_NAME);
    const cached = await cache.match(req, { ignoreSearch: true });
    if (cached) return cached;

    try {
      const res = await fetch(req);
      cache.put(req, res.clone());
      return res;
    } catch {
      return cached || Response.error();
    }
  })());
});
