// Offline support for Stabilis (knowledge/POLICY.md §17).
// - The crisis help page is stored at install, so it opens without connection even if never visited.
// - Pages and assets the person already opened keep working offline (network first for pages,
//   cache first for the content-hashed files under /_next/static/).
// - Nothing from /api/ is ever stored: those requests carry health data. Answers themselves live
//   only in the browser's storage, never in this cache.
const VERSION = new URL(self.location.href).searchParams.get("v") || "dev";
const CACHE = `stabilis-${VERSION}`;
const CRISIS_PAGE = "/ajuda-agora";
const PRECACHE = [CRISIS_PAGE, "/", "/icons/icon-192.png"];
const NETWORK_TIMEOUT_MS = 4000;

self.addEventListener("install", (event) => {
  event.waitUntil(caches.open(CACHE).then((cache) => cache.addAll(PRECACHE)).then(() => self.skipWaiting()));
});

self.addEventListener("activate", (event) => {
  event.waitUntil(
    caches
      .keys()
      .then((keys) => Promise.all(keys.filter((key) => key.startsWith("stabilis-") && key !== CACHE).map((key) => caches.delete(key))))
      .then(() => self.clients.claim()),
  );
});

function withTimeout(promise, ms) {
  return new Promise((resolve, reject) => {
    const timer = setTimeout(() => reject(new Error("timeout")), ms);
    promise.then(
      (value) => {
        clearTimeout(timer);
        resolve(value);
      },
      (error) => {
        clearTimeout(timer);
        reject(error);
      },
    );
  });
}

async function networkFirst(request, fallbackToCrisisPage) {
  const cache = await caches.open(CACHE);
  try {
    const response = await withTimeout(fetch(request), NETWORK_TIMEOUT_MS);
    if (response.ok) cache.put(request, response.clone());
    return response;
  } catch {
    const cached = await cache.match(request, { ignoreVary: true });
    if (cached) return cached;
    if (fallbackToCrisisPage) {
      const crisis = await cache.match(CRISIS_PAGE);
      if (crisis) return crisis;
    }
    return Response.error();
  }
}

async function cacheFirst(request) {
  const cache = await caches.open(CACHE);
  const cached = await cache.match(request);
  if (cached) return cached;
  const response = await fetch(request);
  if (response.ok) cache.put(request, response.clone());
  return response;
}

self.addEventListener("fetch", (event) => {
  const request = event.request;
  if (request.method !== "GET") return;
  const url = new URL(request.url);
  if (url.origin !== self.location.origin || url.pathname.startsWith("/api/")) return;
  if (url.pathname.startsWith("/_next/static/") || url.pathname.startsWith("/icons/")) {
    event.respondWith(cacheFirst(request));
  } else if (request.mode === "navigate") {
    event.respondWith(networkFirst(request, true));
  } else {
    event.respondWith(networkFirst(request, false));
  }
});
