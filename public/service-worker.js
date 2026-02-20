importScripts("https://js.pusher.com/beams/service-worker.js");

// NOTE:
// This service worker primarily exists for Pusher Beams push notifications.
// We also include a minimal fetch handler so the app meets Chrome's PWA
// installability criteria (manifest + service worker controlling the page).

self.addEventListener("push", () => {
  // The Pusher Beams SDK handles the push event for us, but having a listener here
  // can help with debugging or custom handling if needed.
  console.log("[Service Worker] Push Received.");
});

self.addEventListener("fetch", (event) => {
  // No offline caching requested — just proxy to the network.
  event.respondWith(fetch(event.request));
});
