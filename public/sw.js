const CACHE_VERSION = "v5";
const SHELL_CACHE = `boardsignal-shell-${CACHE_VERSION}`;
const STATIC_CACHE = `boardsignal-static-${CACHE_VERSION}`;
const PUBLIC_CACHE = `boardsignal-public-${CACHE_VERSION}`;
const ACTIVE_CACHES = new Set([SHELL_CACHE, STATIC_CACHE, PUBLIC_CACHE]);
const BOARDSIGNAL_CACHE_PREFIX = "boardsignal-";

const APP_SHELL = [
  "/offline",
  "/offline/player-room",
  "/offline/purepress-studio",
  "/boardsignal?source=pwa",
  "/manifest.webmanifest",
  "/icons/boardsignal-192.png",
  "/icons/boardsignal-512.png",
  "/icons/boardsignal-maskable-512.png",
];

self.addEventListener("install", (event) => {
  event.waitUntil(precacheSafeShell());
});

async function precacheSafeShell() {
  const shellCache = await caches.open(SHELL_CACHE);
  const staticCache = await caches.open(STATIC_CACHE);
  const discovered = new Set();
  for (const path of APP_SHELL) {
    const request = new Request(path, { cache: "reload" });
    const response = await fetch(request);
    if (!response.ok) throw new Error(`Application shell could not cache ${path}`);
    await shellCache.put(request, response.clone());
    const contentType = response.headers.get("content-type") || "";
    if (!contentType.includes("text/html")) continue;
    const html = await response.text();
    for (const match of html.matchAll(/(?:src|href)=["'](\/_next\/static\/[^"']+)["']/g)) discovered.add(match[1]);
  }
  await Promise.all([...discovered].map(async (path) => { const request = new Request(path, { cache: "reload" }); const response = await fetch(request); if (response.ok) await staticCache.put(request, response); }));
  await trimCache(STATIC_CACHE, 80);
}

self.addEventListener("message", (event) => { if (event.data?.type === "SKIP_WAITING") self.skipWaiting(); });
self.addEventListener("activate", (event) => { event.waitUntil((async () => { const keys = await caches.keys(); await Promise.all(keys.filter((key) => key.startsWith(BOARDSIGNAL_CACHE_PREFIX) && !ACTIVE_CACHES.has(key)).map((key) => caches.delete(key))); await self.clients.claim(); })()); });

self.addEventListener("fetch", (event) => {
  const request = event.request;
  if (request.method !== "GET") return;
  const url = new URL(request.url);
  if (url.origin !== self.location.origin) return;

  // Authenticated/private API payloads are always network-only and never enter Cache Storage.
  if (url.pathname.startsWith("/api/")) return;

  const isNavigation = request.mode === "navigate" || request.headers.get("accept")?.includes("text/html");
  if (isNavigation && url.pathname.startsWith("/boardsignal/player-room")) {
    event.respondWith(fetch(request).catch(() => caches.match("/offline/player-room").then((response) => response || caches.match("/offline"))));
    return;
  }

  // Admin HTML is never cached. PurePress falls back only to a safe shell whose
  // private content is hydrated from UID-scoped IndexedDB after owner identity is restored.
  if (url.pathname.startsWith("/admin")) {
    if (isNavigation) event.respondWith(fetch(request).catch(() => caches.match("/offline/purepress-studio").then((response) => response || caches.match("/offline"))));
    return;
  }
  if (url.pathname.startsWith("/client") || url.pathname.startsWith("/app") || url.pathname.startsWith("/connect")) {
    if (isNavigation) event.respondWith(fetch(request).catch(() => caches.match("/offline")));
    return;
  }
  if (isNavigation && (url.pathname.startsWith("/player/") || url.pathname.startsWith("/share/"))) {
    event.respondWith(fetch(request).catch(() => caches.match("/offline")));
    return;
  }
  if (url.pathname.startsWith("/stockfish/")) { event.respondWith(cacheFirst(request, STATIC_CACHE, 48)); return; }
  if (url.pathname.startsWith("/_next/static/")) { event.respondWith(cacheFirst(request, STATIC_CACHE, 80)); return; }
  if (url.pathname === "/manifest.webmanifest" || url.pathname.startsWith("/icons/") || /\.(?:css|js|png|jpg|jpeg|webp|svg|ico|woff2?)$/i.test(url.pathname)) { event.respondWith(cacheFirst(request, STATIC_CACHE, 80)); return; }
  if (isNavigation) event.respondWith(networkFirstPublic(request));
});

async function cacheFirst(request, cacheName, maxEntries) {
  const cache = await caches.open(cacheName); const cached = await cache.match(request); if (cached) return cached;
  const response = await fetch(request); if (response.ok) { await cache.put(request, response.clone()); await trimCache(cacheName, maxEntries); } return response;
}
async function networkFirstPublic(request) { try { const response=await fetch(request); if(response.ok){const cache=await caches.open(PUBLIC_CACHE);await cache.put(request,response.clone());await trimCache(PUBLIC_CACHE, 24);}return response;} catch { const cached=await caches.match(request); if(cached)return cached; return (await caches.match("/offline"))||Response.error(); } }
async function trimCache(cacheName,maxEntries){const cache=await caches.open(cacheName);const keys=await cache.keys();if(keys.length<=maxEntries)return;await Promise.all(keys.slice(0,keys.length-maxEntries).map((request)=>cache.delete(request)));}

self.addEventListener("push", (event) => {
  let payload = {};
  try { payload = event.data ? event.data.json() : {}; } catch { payload = { notification: { title: "BoardSignal", body: "You have a new private Player Room update." } }; }
  const notification = payload.notification || {}; const data = payload.data || {}; const title = notification.title || "BoardSignal"; const body = notification.body || "You have a new private Player Room update.";
  event.waitUntil(self.registration.showNotification(title, { body, icon: "/icons/boardsignal-192.png", badge: "/icons/boardsignal-192.png", data: { link: data.link || "/boardsignal/player-room" }, tag: data.type ? `boardsignal-${data.type}` : undefined }));
});
self.addEventListener("notificationclick", (event) => { event.notification.close(); const link = event.notification.data?.link || "/boardsignal/player-room"; event.waitUntil((async () => { const windows = await self.clients.matchAll({ type: "window", includeUncontrolled: true }); const existing = windows.find((client) => new URL(client.url).origin === self.location.origin); if (existing) { await existing.navigate(link); return existing.focus(); } return self.clients.openWindow(link); })()); });
