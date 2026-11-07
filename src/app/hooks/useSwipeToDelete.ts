import { useCallback, useEffect, useRef, useState } from "react";

/* =========================================================
   Swipe-to-delete for a list row (touch only)

   Swipe left a little and let go: the row snaps open to show a Delete
   button. Swipe past the overcommit threshold (half the row's width) and
   let go: the row slides away and collapses, then onCommit runs.

   The drag moves the card by writing its transform directly, so a swipe
   doesn't re-render the card on every touchmove.
========================================================= */

/** Width of the Delete button a partial swipe reveals */
export const SWIPE_REVEAL_WIDTH = 88;
/** Let go past this and the row stays open */
const OPEN_AT = SWIPE_REVEAL_WIDTH / 2;
/** Let go past this share of the row's width and it deletes */
const COMMIT_RATIO = 0.5;
/** How far a finger moves before we decide it's a swipe or a scroll */
const AXIS_LOCK = 8;

const EASE = "cubic-bezier(0.32, 0.72, 0, 1)";

type Options = {
  enabled: boolean;
  onCommit: () => void;
};

export function useSwipeToDelete({ enabled, onCommit }: Options) {
  const rowRef = useRef<HTMLDivElement>(null);
  const cardRef = useRef<HTMLElement>(null);
  const actionRef = useRef<HTMLDivElement>(null);

  const [open, setOpen] = useState(false);
  const [armed, setArmed] = useState(false);

  const openRef = useRef(false);
  const removingRef = useRef(false);
  const swipedRef = useRef(false);
  const onCommitRef = useRef(onCommit);

  useEffect(() => {
    onCommitRef.current = onCommit;
  }, [onCommit]);

  useEffect(() => {
    openRef.current = open;
  }, [open]);

  const hideTimerRef = useRef<number | undefined>(undefined);

  const setX = useCallback((x: number, animate: boolean) => {
    const card = cardRef.current;
    const action = actionRef.current;
    if (!card) return;
    card.style.transition = animate ? `transform 0.3s ${EASE}` : "none";
    card.style.transform = x ? `translateX(${x}px)` : "";

    // The red layer only shows while the card is moved, so it can't peek
    // out at the rounded corners or through a tap highlight
    if (action) {
      action.style.setProperty("--swipe", `${Math.max(0, -x)}px`);
      window.clearTimeout(hideTimerRef.current);
      if (x !== 0) action.style.visibility = "visible";
      else if (animate) hideTimerRef.current = window.setTimeout(() => (action.style.visibility = ""), 300);
      else action.style.visibility = "";
    }
  }, []);

  const close = useCallback(() => {
    setX(0, true);
    setOpen(false);
    setArmed(false);
  }, [setX]);

  const commit = useCallback(() => {
    const row = rowRef.current;
    if (!row || removingRef.current) return;
    removingRef.current = true;
    setArmed(true);

    // slide the card off, then collapse the row's height
    setX(-row.offsetWidth, true);
    window.setTimeout(() => {
      row.style.height = `${row.offsetHeight}px`;
      void row.offsetHeight; // apply the fixed height before animating it
      row.style.transition = `height 0.25s ${EASE}, opacity 0.25s ease`;
      row.style.height = "0px";
      row.style.opacity = "0";
      window.setTimeout(() => onCommitRef.current(), 250);
    }, 220);
  }, [setX]);

  // The gesture
  useEffect(() => {
    const row = rowRef.current;
    if (!enabled || !row) return;

    let startX = 0;
    let startY = 0;
    let base = 0;
    let x = 0;
    let width = 1;
    let axis: "x" | "y" | null = null;
    let isArmed = false;

    const onStart = (e: TouchEvent) => {
      if (removingRef.current || e.touches.length > 1) return;
      const t = e.touches[0];
      startX = t.clientX;
      startY = t.clientY;
      base = openRef.current ? -SWIPE_REVEAL_WIDTH : 0;
      x = base;
      width = row.offsetWidth || 1;
      axis = null;
      isArmed = false;
      swipedRef.current = false;
    };

    const onMove = (e: TouchEvent) => {
      if (removingRef.current) return;
      const t = e.touches[0];
      const dx = t.clientX - startX;
      const dy = t.clientY - startY;

      if (!axis) {
        if (Math.abs(dx) < AXIS_LOCK && Math.abs(dy) < AXIS_LOCK) return;
        axis = Math.abs(dx) > Math.abs(dy) ? "x" : "y";
      }
      if (axis !== "x") return; // a scroll or pull-to-refresh, leave it alone

      // keep the page and pull-to-refresh still while swiping sideways
      e.preventDefault();
      e.stopPropagation();
      swipedRef.current = true;

      let next = base + dx;
      if (next > 0) next *= 0.2; // resist dragging right past closed
      x = next;

      const nowArmed = -x > width * COMMIT_RATIO;
      if (nowArmed !== isArmed) {
        isArmed = nowArmed;
        setArmed(nowArmed);
        if (nowArmed) navigator.vibrate?.(10);
      }
      setX(x, false);
    };

    const onEnd = () => {
      if (axis !== "x") return;
      axis = null;

      if (isArmed) {
        commit();
      } else if (-x > OPEN_AT) {
        setX(-SWIPE_REVEAL_WIDTH, true);
        setOpen(true);
      } else {
        setX(0, true);
        setOpen(false);
      }
    };

    row.addEventListener("touchstart", onStart, { passive: true });
    row.addEventListener("touchmove", onMove, { passive: false });
    row.addEventListener("touchend", onEnd);
    row.addEventListener("touchcancel", onEnd);
    return () => {
      row.removeEventListener("touchstart", onStart);
      row.removeEventListener("touchmove", onMove);
      row.removeEventListener("touchend", onEnd);
      row.removeEventListener("touchcancel", onEnd);
    };
  }, [enabled, commit, setX]);

  // An open row closes when you touch anywhere else
  useEffect(() => {
    if (!open) return;
    const onOutside = (e: TouchEvent) => {
      if (!rowRef.current?.contains(e.target as Node)) close();
    };
    document.addEventListener("touchstart", onOutside, { passive: true });
    return () => document.removeEventListener("touchstart", onOutside);
  }, [open, close]);

  /** True once if the last touch was a sideways swipe, so its click is ignored */
  const consumeSwipe = useCallback(() => {
    const swiped = swipedRef.current;
    swipedRef.current = false;
    return swiped;
  }, []);

  return { rowRef, cardRef, actionRef, open, armed, close, commit, consumeSwipe };
}
