"use client";

import { useEffect } from "react";

type Options = {
  edgePx?: number;
  blockLeft?: boolean;
  blockRight?: boolean;
};

export function useBlockIosEdgeSwipe(
  enabled: boolean,
  opts: Options = {}
) {
  useEffect(() => {
    if (!enabled) return;

    const {
      edgePx = 20,
      blockLeft = true,
      blockRight = true,
    } = opts;

    const onTouchStart = (e: TouchEvent) => {
      if (e.touches.length !== 1) return;

      const x = e.touches[0].clientX;
      const w = window.innerWidth;

      const nearLeft = blockLeft && x <= edgePx;
      const nearRight = blockRight && x >= w - edgePx;

      if (nearLeft || nearRight) {
        // Safari requires passive:false or this does nothing
        e.preventDefault();
      }
    };

    document.addEventListener("touchstart", onTouchStart, {
      passive: false,
    });

    return () => {
      document.removeEventListener("touchstart", onTouchStart as any);
    };
  }, [enabled, opts.edgePx, opts.blockLeft, opts.blockRight]);
}