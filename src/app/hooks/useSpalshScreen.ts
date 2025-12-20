"use client";

import { useEffect, useState } from "react";

export function useSplashScreen(ready: boolean = true, minDuration: number = 2000) {
  const [minTimeElapsed, setMinTimeElapsed] = useState(false);

  // Start timer on mount
  useEffect(() => {
    const timer = setTimeout(() => {
      setMinTimeElapsed(true);
    }, minDuration);

    return () => clearTimeout(timer);
  }, [minDuration]);

  // Only dismiss when BOTH ready AND minimum time has passed
  useEffect(() => {
    if (!ready || !minTimeElapsed) return;

    const splash = document.getElementById("splash-screen");
    if (!splash) return;

    // Just hide it with CSS - don't remove from DOM
    splash.classList.add("hide");
  }, [ready, minTimeElapsed]);
}