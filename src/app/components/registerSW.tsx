"use client";

import { useEffect } from "react";

export default function RegisterSW() {
  useEffect(() => {
    if (!("serviceWorker" in navigator)) return;

    (async () => {
      try {
        const reg = await navigator.serviceWorker.register("/sw.js", { scope: "/" });
        console.log("✅ SW registered:", reg.scope);
      } catch (err) {
        console.error("❌ SW registration failed:", err);
      }
    })();
  }, []);

  return null;
}