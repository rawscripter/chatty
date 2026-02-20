"use client";

import { useCallback, useEffect } from "react";
import { setAndroidAppBadge } from "@/lib/badge";

async function fetchUnreadTotal() {
  try {
    const res = await fetch("/api/unread", { cache: "no-store" });
    const json = await res.json();
    const total = json?.data?.unreadTotal;
    return typeof total === "number" ? total : 0;
  } catch {
    return 0;
  }
}

export function AndroidBadgeSync() {
  const sync = useCallback(async () => {
    const total = await fetchUnreadTotal();
    await setAndroidAppBadge(total);
  }, []);

  useEffect(() => {
    // Initial sync.
    sync();

    const onVisible = () => {
      if (document.visibilityState === "visible") sync();
    };
    const onFocus = () => sync();

    document.addEventListener("visibilitychange", onVisible);
    window.addEventListener("focus", onFocus);

    return () => {
      document.removeEventListener("visibilitychange", onVisible);
      window.removeEventListener("focus", onFocus);
    };
  }, [sync]);

  return null;
}
