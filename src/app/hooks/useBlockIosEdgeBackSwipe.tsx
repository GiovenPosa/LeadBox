"use client";

import { useEffect } from "react";

/**
 * Blocks iOS Safari "swipe from edge to go back" by preventing touchstart
 * when the touch begins near the left edge (optionally right too).
 *
 * Note: This is a best-effort workaround. iOS may still allow the gesture
 * in some cases / versions / contexts.
 */
export function useBlockIosEdgeBackSwipe(enabled: boolean, opts?: { edgePx?: number; blockRightEdge?: boolean }) {
  useEffect(() => {
    if (!enabled) return;

    const edgePx = opts?.edgePx ?? 16;
    const blockRightEdge = opts?.blockRightEdge ?? false;

    const onTouchStart = (e: TouchEvent) => {
      // Only single-finger gestures
      if (e.touches.length !== 1) return;

      const t = e.touches[0];
      const x = t.clientX;
      const w = window.innerWidth;

      const nearLeft = x <= edgePx;
      const nearRight = blockRightEdge ? x >= (w - edgePx) : false;

      if (nearLeft || nearRight) {
        // Critical: listener must be passive:false for preventDefault to work.
        e.preventDefault();
      }
    };

    // Must be passive:false, or iOS will ignore preventDefault()
    document.addEventListener("touchstart", onTouchStart, { passive: false });

    return () => {
      document.removeEventListener("touchstart", onTouchStart as any);
    };
  }, [enabled, opts?.edgePx, opts?.blockRightEdge]);
}