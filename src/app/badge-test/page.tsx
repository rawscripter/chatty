"use client";

import { useState } from "react";

export default function BadgeTestPage() {
  const [result, setResult] = useState<string>("");

  const setBadge = async (n: number) => {
    try {
      const nav: any = navigator;
      const hasNav = typeof nav?.setAppBadge === "function";
      const hasSw = "serviceWorker" in navigator;
      const reg: any = hasSw ? await navigator.serviceWorker.ready : null;
      const hasReg = typeof reg?.setAppBadge === "function";

      if (hasNav) await nav.setAppBadge(n);
      else if (hasReg) await reg.setAppBadge(n);
      else throw new Error("No setAppBadge support (navigator or SW registration). ");

      setResult(`OK: set badge to ${n}. (navigator:${hasNav} swReg:${hasReg})`);
    } catch (e: any) {
      setResult(`FAIL: ${String(e)}`);
    }
  };

  const clearBadge = async () => {
    try {
      const nav: any = navigator;
      const hasNav = typeof nav?.clearAppBadge === "function";
      const hasSw = "serviceWorker" in navigator;
      const reg: any = hasSw ? await navigator.serviceWorker.ready : null;
      const hasReg = typeof reg?.clearAppBadge === "function";

      if (hasNav) await nav.clearAppBadge();
      else if (hasReg) await reg.clearAppBadge();
      else throw new Error("No clearAppBadge support (navigator or SW registration). ");

      setResult(`OK: cleared badge. (navigator:${hasNav} swReg:${hasReg})`);
    } catch (e: any) {
      setResult(`FAIL: ${String(e)}`);
    }
  };

  return (
    <div style={{ padding: 16, fontFamily: "system-ui, -apple-system, Segoe UI, Roboto, sans-serif" }}>
      <h1 style={{ fontSize: 18, fontWeight: 600, marginBottom: 8 }}>Badge Test</h1>
      <p style={{ marginBottom: 12, opacity: 0.8 }}>
        Use these buttons, then go to your home screen and check if the Chatty icon shows a badge/dot.
      </p>
      <div style={{ display: "flex", gap: 8, flexWrap: "wrap" }}>
        <button onClick={() => setBadge(1)} style={{ padding: "8px 12px" }}>Set badge 1</button>
        <button onClick={() => setBadge(7)} style={{ padding: "8px 12px" }}>Set badge 7</button>
        <button onClick={() => setBadge(42)} style={{ padding: "8px 12px" }}>Set badge 42</button>
        <button onClick={clearBadge} style={{ padding: "8px 12px" }}>Clear badge</button>
      </div>
      <pre style={{ marginTop: 12, whiteSpace: "pre-wrap", background: "#111", color: "#eee", padding: 12, borderRadius: 8 }}>
        {result || "(no result yet)"}
      </pre>
    </div>
  );
}
