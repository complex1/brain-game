/* Registers the service worker so the site can be installed and played offline. */
(function () {
  "use strict";
  if (!("serviceWorker" in navigator)) return;
  if (location.protocol !== "https:" && location.hostname !== "localhost" && location.hostname !== "127.0.0.1") return;

  // This file lives at assets/js/pwa.js; the worker sits at the site root.
  const script = document.currentScript;
  const swUrl = new URL("../../sw.js", script ? script.src : location.href);

  window.addEventListener("load", function () {
    navigator.serviceWorker.register(swUrl.href).catch(function () {
      /* Offline support is optional; the site works without it. */
    });
  });
})();
