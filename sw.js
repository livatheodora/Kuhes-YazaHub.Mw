// OneSignal handles push delivery now (not Supabase) — this pulls their
// push/notificationclick handling into our existing service worker instead
// of registering a second one. See SETUP.md §9.
importScripts("https://cdn.onesignal.com/sdks/web/v16/OneSignalSDKWorker.js");

const CACHE_NAME = "kuhes-yaza-v9";
const FILES_CACHE = "kuhes-yaza-files-v1";
const ASSETS = [
  "/",
  "/index.html",
  "/admin.html",
  "/diagnosis.html",
  "/about-page.html",
  "/viewers-page.html",
  "/market-page.html",
  "/style.css",
  "/app.js",
  "/admin.js",
  "/diagnosis.js",
  "/manifest.json",
  "/kuhes.png"
];

self.addEventListener("install", (event) => {
  event.waitUntil(
    caches.open(CACHE_NAME).then((cache) => cache.addAll(ASSETS)).catch(() => {})
  );
  self.skipWaiting();
});

self.addEventListener("activate", (event) => {
  event.waitUntil(
    caches.keys().then((keys) =>
      Promise.all(
        keys
          .filter((k) => k !== CACHE_NAME && k !== FILES_CACHE)
          .map((k) => caches.delete(k))
      )
    )
  );
  self.clients.claim();
});

self.addEventListener("fetch", (event) => {
  const url = event.request.url;

  // Uploaded files (PDFs, images) from Supabase storage: cache-first, so
  // anything a student has already opened/downloaded stays available
  // offline. Revalidate in the background when the network is up.
  if (url.includes("/storage/v1/object/public/")) {
    event.respondWith(
      caches.open(FILES_CACHE).then(async (cache) => {
        const cached = await cache.match(event.request);
        const networkFetch = fetch(event.request)
          .then((res) => {
            if (res && res.ok) cache.put(event.request, res.clone());
            return res;
          })
          .catch(() => null);
        return cached || (await networkFetch) || new Response("Offline", { status: 503 });
      })
    );
    return;
  }

  // Supabase REST/API calls (table reads): network-first, fall back to the
  // last successful response if offline.
  if (url.includes("supabase.co")) {
    event.respondWith(fetch(event.request).catch(() => caches.match(event.request)));
    return;
  }

  // App shell: cache-first
  event.respondWith(
    caches.match(event.request).then((cached) => cached || fetch(event.request))
  );
});
