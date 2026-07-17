const CACHE_VERSION = "intervium-shell-v15-report-edit-layout";
const SHELL_RESOURCES = [
  "/",
  "/index.html",
  "/app.js",
  "/app.css",
  "/theme-init.js",
  "/utils/theme.js",
  "/utils/format.js",
  "/components/icons.js",
  "/api/client.js",
  "/views/resources.js",
  "/navigation/routes.js",
  "/reports/signature-canvas.js",
  "/clients/forms.js",
  "/documents/totals.js",
  "/styles/reports.css",
  "/offline.html",
  "/offline.css",
  "/offline.js",
  "/manifest.webmanifest",
  "/icons/intervium-192.png",
  "/icons/intervium-512.png",
  "/icons/intervium-maskable-512.png",
  "/icons/apple-touch-icon.png"
];

self.addEventListener("install", (event) => {
  event.waitUntil(
    caches.open(CACHE_VERSION)
      .then((cache) => cache.addAll(SHELL_RESOURCES))
      .then(() => self.skipWaiting())
  );
});

self.addEventListener("activate", (event) => {
  event.waitUntil(
    caches.keys()
      .then((keys) => Promise.all(keys.filter((key) => key !== CACHE_VERSION).map((key) => caches.delete(key))))
      .then(() => self.clients.claim())
  );
});

self.addEventListener("message", (event) => {
  if (event.data?.type === "SKIP_WAITING") self.skipWaiting();
});

function isPrivateRequest(url) {
  return url.pathname.startsWith("/api/") ||
    url.pathname.startsWith("/uploads/") ||
    url.pathname.endsWith("/pdf") ||
    url.hostname === "res.cloudinary.com";
}

async function networkOnly(request) {
  try {
    return await fetch(request);
  } catch {
    if (new URL(request.url).pathname.startsWith("/api/")) {
      return new Response(JSON.stringify({ error: "Connexion indisponible. Réessayez lorsque le réseau sera rétabli." }), {
        status: 503,
        headers: { "Content-Type": "application/json", "Cache-Control": "no-store" }
      });
    }
    return new Response("Ressource indisponible hors connexion.", { status: 503 });
  }
}

async function networkFirst(request, fallback = "/offline.html") {
  const cache = await caches.open(CACHE_VERSION);
  try {
    const response = await fetch(request);
    if (response.ok && response.type === "basic") await cache.put(request, response.clone());
    return response;
  } catch {
    return (await cache.match(request)) || (await cache.match(fallback));
  }
}

async function cacheFirst(request) {
  const cache = await caches.open(CACHE_VERSION);
  const cached = await cache.match(request);
  if (cached) return cached;
  const response = await fetch(request);
  if (response.ok && response.type === "basic") await cache.put(request, response.clone());
  return response;
}

self.addEventListener("fetch", (event) => {
  const request = event.request;
  if (request.method !== "GET") return;
  const url = new URL(request.url);

  if (isPrivateRequest(url)) {
    event.respondWith(networkOnly(request));
    return;
  }
  if (request.mode === "navigate") {
    event.respondWith(networkFirst(request));
    return;
  }
  if (["script", "style", "manifest"].includes(request.destination)) {
    event.respondWith(networkFirst(request, "/offline.html"));
    return;
  }
  if (url.origin === self.location.origin) {
    event.respondWith(cacheFirst(request));
  }
});
