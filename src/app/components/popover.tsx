"use client";

import { useEffect, useLayoutEffect, useRef, type ReactNode } from "react";
import styles from "./component-styles/popover.module.css";

type PopoverProps = {
  open: boolean;
  onClose: () => void;
  /** the button that opens it; sits in the same anchor so outside clicks can be told apart */
  trigger: ReactNode;
  /** which edge of the trigger the panel lines up with */
  align?: "start" | "end";
  /** fill the parent's width, for a form field */
  block?: boolean;
  /** make the panel exactly as wide as the trigger */
  matchWidth?: boolean;
  /** the panel's role; "dialog" by default, null when its content sets its own (e.g. a listbox) */
  role?: string | null;
  label?: string;
  className?: string;
  children: ReactNode;
};

// A small panel that drops down from its trigger, or up when there isn't room
// below. Closes on a click or tap outside, or on Escape.
export default function Popover({
  open,
  onClose,
  trigger,
  align = "end",
  block = false,
  matchWidth = false,
  role = "dialog",
  label,
  className,
  children,
}: PopoverProps) {
  const anchorRef = useRef<HTMLDivElement>(null);
  const panelRef = useRef<HTMLDivElement>(null);

  useEffect(() => {
    if (!open) return;
    const onPointer = (e: PointerEvent) => {
      if (!anchorRef.current?.contains(e.target as Node)) onClose();
    };
    const onKey = (e: KeyboardEvent) => {
      if (e.key === "Escape") onClose();
    };
    document.addEventListener("pointerdown", onPointer);
    document.addEventListener("keydown", onKey);
    return () => {
      document.removeEventListener("pointerdown", onPointer);
      document.removeEventListener("keydown", onKey);
    };
  }, [open, onClose]);

  // Open upwards if the panel would run off the bottom of the screen and fits above
  useLayoutEffect(() => {
    const anchor = anchorRef.current;
    const panel = panelRef.current;
    if (!open || !anchor || !panel) return;
    const a = anchor.getBoundingClientRect();
    const height = panel.offsetHeight;
    const fitsBelow = a.bottom + 6 + height <= window.innerHeight - 8;
    const fitsAbove = a.top - 6 - height >= 8;
    panel.classList.toggle(styles.up, !fitsBelow && fitsAbove);
  }, [open]);

  const panelClasses = [
    styles.panel,
    matchWidth ? styles.matchWidth : align === "start" ? styles.alignStart : styles.alignEnd,
    className,
  ]
    .filter(Boolean)
    .join(" ");

  return (
    <div ref={anchorRef} className={`${styles.anchor} ${block ? styles.block : ""}`}>
      {trigger}
      {open && (
        <div
          ref={panelRef}
          className={panelClasses}
          role={role ?? undefined}
          aria-label={role ? label : undefined}
        >
          {children}
        </div>
      )}
    </div>
  );
}
