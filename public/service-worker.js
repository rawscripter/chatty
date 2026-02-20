importScripts("https://js.pusher.com/beams/service-worker.js");

// NOTE:
// This service worker primarily exists for Pusher Beams push notifications.
// We also include a minimal fetch handler so the app meets Chrome's PWA
// installability criteria (manifest + service worker controlling the page).

self.addEventListener("push", (event) => {
  // Pusher Beams handles the actual notification display.
  // We additionally try to update the Android app badge best-effort.
  try {
    const data = event && event.data ? event.data.json() : null;
    const unread = data?.unreadTotal ?? data?.unread ?? data?.data?.unreadTotal;

    if (typeof unread === "number" && self.registration.setAppBadge) {
      if (unread > 0) self.registration.setAppBadge(unread);
      else if (self.registration.clearAppBadge) self.registration.clearAppBadge();
    } else if (self.registration.setAppBadge) {
      // Fallback: bump to 1 (will be corrected when the app opens/focuses).
      self.registration.setAppBadge(1);
    }
  } catch (e) {
    // Ignore.
  }

  console.log("[Service Worker] Push Received.");
});

self.addEventListener("fetch", (event) => {
  // No offline caching requested — just proxy to the network.
  event.respondWith(fetch(event.request));
});
