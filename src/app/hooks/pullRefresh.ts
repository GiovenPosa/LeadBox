"use client";

import { useRef, useState, useCallback, useEffect } from "react";

type UsePullToRefreshOptions = {
  onRefresh: () => Promise<void>;
  threshold?: number; // How far to pull before triggering (px)
  maxPull?: number; // Maximum pull distance (px)
};

export function usePullToRefresh({
  onRefresh,
  threshold = 80,
  maxPull = 100,
}: UsePullToRefreshOptions) {
  const containerRef = useRef<HTMLDivElement>(null);
  const [pullDistance, setPullDistance] = useState(0);
  const [isRefreshing, setIsRefreshing] = useState(false);
  const [isPulling, setIsPulling] = useState(false);

  const startY = useRef(0);
  const currentY = useRef(0);

  const canPull = useCallback(() => {
    if (!containerRef.current) return false;
    // Only allow pull when scrolled to top
    return containerRef.current.scrollTop <= 0;
  }, []);

  const handleTouchStart = useCallback(
    (e: TouchEvent) => {
      if (isRefreshing) return;
      if (!canPull()) return;

      startY.current = e.touches[0].clientY;
      setIsPulling(true);
    },
    [isRefreshing, canPull]
  );

  const handleTouchMove = useCallback(
    (e: TouchEvent) => {
      if (!isPulling || isRefreshing) return;

      currentY.current = e.touches[0].clientY;
      const diff = currentY.current - startY.current;

      // Only pull down, not up
      if (diff > 0 && canPull()) {
        // Apply resistance - the further you pull, the harder it gets
        const resistance = 0.5;
        const adjustedDiff = Math.min(diff * resistance, maxPull);
        setPullDistance(adjustedDiff);

        // Prevent default scroll when pulling
        if (adjustedDiff > 0) {
          e.preventDefault();
        }
      }
    },
    [isPulling, isRefreshing, canPull, maxPull]
  );

  const handleTouchEnd = useCallback(async () => {
    if (!isPulling) return;

    setIsPulling(false);

    if (pullDistance >= threshold && !isRefreshing) {
      // Trigger refresh
      setIsRefreshing(true);
      setPullDistance(threshold * 0.6); // Settle to a smaller height while refreshing

      try {
        await onRefresh();
      } finally {
        setIsRefreshing(false);
        setPullDistance(0);
      }
    } else {
      // Snap back
      setPullDistance(0);
    }
  }, [isPulling, pullDistance, threshold, isRefreshing, onRefresh]);

  useEffect(() => {
    const container = containerRef.current;
    if (!container) return;

    // Only add listeners on touch devices
    const isTouchDevice = "ontouchstart" in window || navigator.maxTouchPoints > 0;
    if (!isTouchDevice) return;

    container.addEventListener("touchstart", handleTouchStart, { passive: true });
    container.addEventListener("touchmove", handleTouchMove, { passive: false });
    container.addEventListener("touchend", handleTouchEnd, { passive: true });

    return () => {
      container.removeEventListener("touchstart", handleTouchStart);
      container.removeEventListener("touchmove", handleTouchMove);
      container.removeEventListener("touchend", handleTouchEnd);
    };
  }, [handleTouchStart, handleTouchMove, handleTouchEnd]);

  const progress = Math.min(pullDistance / threshold, 1);

  return {
    containerRef,
    pullDistance,
    isRefreshing,
    isPulling,
    progress,
  };
}