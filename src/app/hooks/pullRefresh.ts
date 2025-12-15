"use client";

import { useRef, useState, useCallback, useEffect } from "react";

type UsePullToRefreshOptions = {
  onRefresh: () => Promise<void>;
  threshold?: number;
  maxPull?: number;
};

export function usePullToRefresh({
  onRefresh,
  threshold = 80,
  maxPull = 120,
}: UsePullToRefreshOptions) {
  const containerRef = useRef<HTMLDivElement>(null);
  const [pullDistance, setPullDistance] = useState(0);
  const [isRefreshing, setIsRefreshing] = useState(false);
  const [isPulling, setIsPulling] = useState(false);
  const [isSettling, setIsSettling] = useState(false);

  const startY = useRef(0);
  const startScrollTop = useRef(0);
  const rafId = useRef<number | null>(null);

  const canPull = useCallback(() => {
    if (!containerRef.current) return false;
    return containerRef.current.scrollTop <= 0;
  }, []);

  const handleTouchStart = useCallback(
    (e: TouchEvent) => {
      if (isRefreshing || isSettling) return;

      startY.current = e.touches[0].clientY;
      startScrollTop.current = containerRef.current?.scrollTop ?? 0;

      // Only start pulling if we're at the top
      if (canPull()) {
        setIsPulling(true);
      }
    },
    [isRefreshing, isSettling, canPull]
  );

  const handleTouchMove = useCallback(
    (e: TouchEvent) => {
      if (isRefreshing || isSettling) return;

      const currentY = e.touches[0].clientY;
      const diff = currentY - startY.current;

      // Check if we should start pulling (scrolled to top and pulling down)
      if (!isPulling && diff > 0 && canPull()) {
        setIsPulling(true);
        startY.current = currentY; // Reset start point
        return;
      }

      if (!isPulling) return;

      // Only pull down, not up
      if (diff > 0 && canPull()) {
        // Cancel any pending RAF
        if (rafId.current) {
          cancelAnimationFrame(rafId.current);
        }

        // Use RAF for smoother updates
        rafId.current = requestAnimationFrame(() => {
          // Exponential resistance - feels more natural
          const resistance = Math.max(0.3, 1 - (diff / (maxPull * 3)));
          const adjustedDiff = Math.min(diff * resistance, maxPull);
          setPullDistance(adjustedDiff);
        });

        // Prevent scroll while pulling
        if (diff > 5) {
          e.preventDefault();
        }
      } else if (diff <= 0) {
        // User scrolled back up, cancel pull
        setPullDistance(0);
        setIsPulling(false);
      }
    },
    [isPulling, isRefreshing, isSettling, canPull, maxPull]
  );

  const handleTouchEnd = useCallback(async () => {
    if (rafId.current) {
      cancelAnimationFrame(rafId.current);
    }

    if (!isPulling) return;

    setIsPulling(false);

    if (pullDistance >= threshold && !isRefreshing) {
      // Trigger refresh
      setIsRefreshing(true);
      setIsSettling(true);

      // Settle to refresh height
      setPullDistance(50);

      // Small delay for settle animation
      await new Promise((r) => setTimeout(r, 150));
      setIsSettling(false);

      try {
        await onRefresh();
      } finally {
        setIsSettling(true);
        setPullDistance(0);

        // Wait for collapse animation
        await new Promise((r) => setTimeout(r, 200));
        setIsRefreshing(false);
        setIsSettling(false);
      }
    } else {
      // Snap back
      setIsSettling(true);
      setPullDistance(0);

      setTimeout(() => {
        setIsSettling(false);
      }, 200);
    }
  }, [isPulling, pullDistance, threshold, isRefreshing, onRefresh]);

  useEffect(() => {
    const container = containerRef.current;
    if (!container) return;

    // Only add listeners on touch devices
    const isTouchDevice =
      "ontouchstart" in window || navigator.maxTouchPoints > 0;
    if (!isTouchDevice) return;

    container.addEventListener("touchstart", handleTouchStart, {
      passive: true,
    });
    container.addEventListener("touchmove", handleTouchMove, { passive: false });
    container.addEventListener("touchend", handleTouchEnd, { passive: true });
    container.addEventListener("touchcancel", handleTouchEnd, { passive: true });

    return () => {
      container.removeEventListener("touchstart", handleTouchStart);
      container.removeEventListener("touchmove", handleTouchMove);
      container.removeEventListener("touchend", handleTouchEnd);
      container.removeEventListener("touchcancel", handleTouchEnd);
      if (rafId.current) {
        cancelAnimationFrame(rafId.current);
      }
    };
  }, [handleTouchStart, handleTouchMove, handleTouchEnd]);

  // Progress from 0 to 1
  const progress = Math.min(pullDistance / threshold, 1);

  // Ready to refresh indicator
  const isReady = pullDistance >= threshold && !isRefreshing;

  return {
    containerRef,
    pullDistance,
    isRefreshing,
    isPulling,
    isSettling,
    progress,
    isReady,
  };
}