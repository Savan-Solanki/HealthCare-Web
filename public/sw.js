/**
 * Medkwik HMS — Service Worker
 *
 * This service worker acts as a transparent pass-through.
 * It replaces any previously cached service worker (e.g. Firebase)
 * that may have enforced a restrictive Content Security Policy
 * blocking connections to external domains like AWS S3.
 *
 * All fetch requests are handled by the browser's native network
 * stack without any CSP enforcement from the service worker layer.
 */

// Install immediately — skip waiting so the new SW activates right away
self.addEventListener("install", (event) => {
  self.skipWaiting();
});

// Claim all clients immediately so the new SW controls the page
self.addEventListener("activate", (event) => {
  event.waitUntil(
    (async () => {
      // Clear any caches from the previous service worker
      const cacheNames = await caches.keys();
      await Promise.all(cacheNames.map((name) => caches.delete(name)));

      // Take control of all open pages
      await self.clients.claim();
    })()
  );
});

// Pass-through fetch handler — let the browser handle all requests natively
// No CSP enforcement, no caching, no interception
self.addEventListener("fetch", (event) => {
  // Do nothing — let the browser handle the request normally
  return;
});
