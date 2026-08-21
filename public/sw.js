const CACHE = "trouble-diner-v2-pop-demo";
const CORE = [
  "./",
  "./index.html",
  "./manifest.webmanifest",
  "./assets/favicon.png",
  "./assets/icon-192.png",
  "./assets/icon-512.png",
  "./assets/crew-mascot.png",
  "./assets/restaurant-map.png"
];

self.addEventListener("install", (event) => {
  event.waitUntil(caches.open(CACHE).then((cache) => cache.addAll(CORE)).then(() => self.skipWaiting()));
});

self.addEventListener("activate", (event) => {
  event.waitUntil(
    caches.keys().then((keys) => Promise.all(keys.filter((key) => key !== CACHE).map((key) => caches.delete(key)))).then(() => self.clients.claim())
  );
});

self.addEventListener("fetch", (event) => {
  const request = event.request;
  if (request.method !== "GET") return;
  const url = new URL(request.url);
  if (url.pathname.includes("/api/")) return;

  if (request.mode === "navigate") {
    event.respondWith(fetch(request).then((response) => {
      const clone = response.clone();
      caches.open(CACHE).then((cache) => cache.put("./index.html", clone));
      return response;
    }).catch(() => caches.match("./index.html")));
    return;
  }

  event.respondWith(caches.match(request).then((cached) => {
    const network = fetch(request).then((response) => {
      if (response.ok && url.origin === self.location.origin) caches.open(CACHE).then((cache) => cache.put(request, response.clone()));
      return response;
    });
    return cached || network;
  }));
});
