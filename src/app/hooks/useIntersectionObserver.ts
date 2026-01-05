import { useEffect, useRef } from "react";

/**
 * Hook that observes when a target element enters the viewport.
 * Used for infinite scroll - triggers callback when sentinel becomes visible.
 * 
 * @param callback - Function to call when element enters viewport
 * @param enabled - Whether the observer should be active
 * @returns ref to attach to the sentinel element
 */
export function useIntersectionObserver(
  callback: () => void,
  enabled: boolean = true
) {
  const targetRef = useRef<HTMLDivElement>(null);

  useEffect(() => {
    const target = targetRef.current;

    // Don't observe if disabled or no target element
    if (!enabled || !target) return;

    const observer = new IntersectionObserver(
      (entries) => {
        // entries[0].isIntersecting is true when element is visible in viewport
        if (entries[0].isIntersecting) {
          callback();
        }
      },
      {
        // null = use the viewport as the root
        root: null,
        // Trigger 200px BEFORE the element actually enters viewport
        // This creates a seamless loading experience
        rootMargin: "200px",
        // 0 = trigger as soon as even 1px is visible
        threshold: 0,
      }
    );

    observer.observe(target);

    // Cleanup: disconnect observer when component unmounts
    // or when dependencies change
    return () => observer.disconnect();
  }, [callback, enabled]);

  return targetRef;
}