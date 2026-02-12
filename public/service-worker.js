importScripts("https://js.pusher.com/beams/service-worker.js");

self.addEventListener('push', function (event) {
    // The Pusher Beams SDK handles the push event for us, but having a listener here
    // can help with debugging or custom handling if needed.
    console.log('[Service Worker] Push Received.');
});
