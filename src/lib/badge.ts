export async function setAndroidAppBadge(count: number) {
  if (typeof window === "undefined") return;

  // Only bother on Android; other platforms may behave inconsistently.
  const ua = window.navigator.userAgent || "";
  const isAndroid = /Android/i.test(ua);
  if (!isAndroid) return;

  const n = window.navigator as any;
  try {
    if (typeof n.setAppBadge === "function") {
      if (count > 0) await n.setAppBadge(count);
      else if (typeof n.clearAppBadge === "function") await n.clearAppBadge();
      return;
    }

    // Fallback: try via service worker registration if available.
    if ("serviceWorker" in navigator) {
      const reg = await navigator.serviceWorker.ready;
      const r = reg as any;
      if (typeof r.setAppBadge === "function") {
        if (count > 0) await r.setAppBadge(count);
        else if (typeof r.clearAppBadge === "function") await r.clearAppBadge();
      }
    }
  } catch {
    // Ignore — badging is best-effort.
  }
}
