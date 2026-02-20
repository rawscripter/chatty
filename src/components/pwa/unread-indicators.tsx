"use client";

import { useCallback, useEffect, useRef } from "react";

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

function setDocumentTitleUnread(total: number) {
  const base = "Chatty";
  if (typeof document === "undefined") return;
  document.title = total > 0 ? `(${total}) ${base}` : base;
}

async function setFaviconBadge(total: number) {
  if (typeof document === "undefined") return;

  const link = (document.querySelector('link[rel~="icon"]') as HTMLLinkElement | null) ?? undefined;
  if (!link?.href) return;

  // Preserve original so we can restore.
  const originalHref = link.dataset.originalHref || link.href;
  if (!link.dataset.originalHref) link.dataset.originalHref = originalHref;

  if (total <= 0) {
    link.href = originalHref;
    return;
  }

  try {
    const img = new Image();
    img.crossOrigin = "anonymous";
    img.src = originalHref;

    await new Promise<void>((resolve, reject) => {
      img.onload = () => resolve();
      img.onerror = () => reject(new Error("favicon load failed"));
    });

    const size = 64;
    const canvas = document.createElement("canvas");
    canvas.width = size;
    canvas.height = size;
    const ctx = canvas.getContext("2d");
    if (!ctx) return;

    ctx.clearRect(0, 0, size, size);
    ctx.drawImage(img, 0, 0, size, size);

    // Badge bubble
    const bubbleR = 16;
    const cx = size - bubbleR;
    const cy = bubbleR;

    ctx.beginPath();
    ctx.arc(cx, cy, bubbleR, 0, Math.PI * 2);
    ctx.fillStyle = "#EF4444"; // red-500
    ctx.fill();
    ctx.lineWidth = 3;
    ctx.strokeStyle = "#ffffff";
    ctx.stroke();

    // Count text
    const text = total > 99 ? "99+" : String(total);
    ctx.fillStyle = "#ffffff";
    ctx.font = "bold 18px system-ui, -apple-system, Segoe UI, Roboto, sans-serif";
    ctx.textAlign = "center";
    ctx.textBaseline = "middle";
    ctx.fillText(text, cx, cy + 1);

    link.href = canvas.toDataURL("image/png");
  } catch {
    // Best-effort only.
  }
}

export function UnreadIndicators() {
  const lastRef = useRef<number>(-1);

  const sync = useCallback(async () => {
    const total = await fetchUnreadTotal();
    if (total === lastRef.current) return;
    lastRef.current = total;

    setDocumentTitleUnread(total);
    await setFaviconBadge(total);
  }, []);

  useEffect(() => {
    // Initial
    sync();

    // Poll so it works across all chats (not only the open one).
    const interval = window.setInterval(sync, 30_000);

    const onVisible = () => {
      if (document.visibilityState === "visible") sync();
    };
    const onFocus = () => sync();

    document.addEventListener("visibilitychange", onVisible);
    window.addEventListener("focus", onFocus);

    return () => {
      window.clearInterval(interval);
      document.removeEventListener("visibilitychange", onVisible);
      window.removeEventListener("focus", onFocus);
    };
  }, [sync]);

  return null;
}
