/*
 * Mental Game service worker.
 *
 * - On install it caches the app shell, then every game listed in
 *   data/games.json (index.html, style.css, game.js), so the whole catalog
 *   works offline with no build step.
 * - Same-origin requests are network-first (fresh deploys show up straight
 *   away) with a short timeout, falling back to the cache when offline or slow.
 * - Cross-origin requests (for example Find the Word's dictionary lookup) are
 *   left alone.
 *
 * Bump CACHE_VERSION to force every installed copy to drop its old files.
 */
"use strict";

const CACHE_VERSION = "v1";
const CACHE_NAME = "mental-game-" + CACHE_VERSION;
const NETWORK_TIMEOUT_MS = 4000;

const SHELL = [
  "./",
  "index.html",
  "manifest.webmanifest",
  "data/games.json",
  "assets/css/tokens.css",
  "assets/css/base.css",
  "assets/css/components.css",
  "assets/css/home.css",
  "assets/js/catalog.js",
  "assets/js/game-settings.js",
  "assets/js/pwa.js",
  "assets/icons/icon-192.png",
  "assets/icons/icon-512.png",
  "assets/icons/apple-touch-icon.png",
  "assets/icons/icon.svg",
];

async function precache() {
  const cache = await caches.open(CACHE_NAME);
  // The shell must succeed; a missing core file should fail the install.
  await cache.addAll(SHELL);

  // Games are best effort so one bad file never blocks installing the app.
  try {
    const res = await fetch("data/games.json", { cache: "no-cache" });
    const catalog = await res.json();
    const files = [];
    for (const game of catalog.games || []) {
      if (!game.path) continue;
      files.push(game.path, game.path + "index.html", game.path + "style.css", game.path + "game.js");
    }
    await Promise.all(
      files.map((file) =>
        cache.add(file).catch(function () {
          /* ignore individual failures */
        })
      )
    );
  } catch (err) {
    /* ignore: games get cached as they are visited */
  }
}

self.addEventListener("install", (event) => {
  event.waitUntil(precache().then(() => self.skipWaiting()));
});

self.addEventListener("activate", (event) => {
  event.waitUntil(
    caches
      .keys()
      .then((names) =>
        Promise.all(names.filter((n) => n.startsWith("mental-game-") && n !== CACHE_NAME).map((n) => caches.delete(n)))
      )
      .then(() => self.clients.claim())
  );
});

function networkFirst(request) {
  return new Promise((resolve) => {
    let settled = false;
    const fallback = () =>
      caches.match(request, { ignoreSearch: true }).then((cached) => cached || null);

    const timer = setTimeout(() => {
      fallback().then((cached) => {
        if (cached && !settled) {
          settled = true;
          resolve(cached);
        }
      });
    }, NETWORK_TIMEOUT_MS);

    fetch(request)
      .then((response) => {
        clearTimeout(timer);
        if (response && response.ok) {
          const copy = response.clone();
          caches.open(CACHE_NAME).then((cache) => cache.put(request, copy));
        }
        if (!settled) {
          settled = true;
          resolve(response);
        }
      })
      .catch(() => {
        clearTimeout(timer);
        if (settled) return;
        fallback().then((cached) => {
          settled = true;
          resolve(cached || Response.error());
        });
      });
  });
}

self.addEventListener("fetch", (event) => {
  const request = event.request;
  if (request.method !== "GET") return;
  const url = new URL(request.url);
  if (url.origin !== self.location.origin) return;
  event.respondWith(networkFirst(request));
});
