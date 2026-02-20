"use client";

import { useEffect } from "react";

export function PwaRegister() {
  useEffect(() => {
    if (typeof window === "undefined") return;
    if (!("serviceWorker" in navigator)) return;

    // Register the SW at the root so it can control the whole app.
    navigator.serviceWorker
      .register("/service-worker.js")
      .catch((err) => console.warn("[PWA] service worker registration failed", err));
  }, []);

  return null;
}
