"use client";

import { useEffect, useRef, useCallback } from "react";

/**
 * useFitTextWidth
 * 
 * A hook that measures the actual rendered width of wrapped text
 * and sets the container width to match the widest line.
 * 
 * CSS cannot measure text width after wrapping - this hook solves that.
 * 
 * @param text - The text content to measure (triggers remeasure on change)
 * @returns A ref to attach to the text element (h1, p, span, etc.)
 * 
 * @example
 * ```tsx
 * const nameRef = useFitTextWidth(user.name);
 * return <h1 ref={nameRef}>{user.name}</h1>
 * ```
 */
export function useFitTextWidth<T extends HTMLElement = HTMLElement>(
  text: string | null | undefined
) {
  const ref = useRef<T>(null);

  const measure = useCallback(() => {
    const el = ref.current;
    if (!el) return;

    // Reset to auto first to allow natural wrapping
    el.style.width = "auto";

    // Force reflow, then measure each line
    requestAnimationFrame(() => {
      const range = document.createRange();
      const textNode = el.firstChild;

      if (!textNode || textNode.nodeType !== Node.TEXT_NODE) {
        // If no direct text node, try selecting all contents
        range.selectNodeContents(el);
      } else {
        range.selectNodeContents(el);
      }

      const rects = range.getClientRects();

      // Find the widest line
      let maxWidth = 0;
      for (const rect of rects) {
        if (rect.width > maxWidth) maxWidth = rect.width;
      }

      // Set exact width (add 1px for subpixel rounding safety)
      if (maxWidth > 0) {
        el.style.width = `${Math.ceil(maxWidth) + 1}px`;
      }

      range.detach();
    });
  }, []);

  // Measure on text change
  useEffect(() => {
    measure();
  }, [text, measure]);

  // Remeasure on window resize (text may wrap differently)
  useEffect(() => {
    const handleResize = () => {
      // Debounce resize measurements
      const timeout = setTimeout(measure, 100);
      return () => clearTimeout(timeout);
    };

    window.addEventListener("resize", handleResize);
    return () => window.removeEventListener("resize", handleResize);
  }, [measure]);

  return ref;
}

export default useFitTextWidth;