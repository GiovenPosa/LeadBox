"use client";

import { useEffect, useId, useSyncExternalStore, type ReactNode } from "react";
import { createPortal } from "react-dom";
import { HiMiniXMark } from "react-icons/hi2";
import styles from "./component-styles/auditModal.module.css";
import { useRestoreFocus } from "../hooks/useRestoreFocus";

const subscribeNoop = () => () => {};

/**
 * The audit window: a wide card centred over everything (a bottom sheet on
 * phones), like the confirm dialog. It shows a running audit's progress, then
 * its results (auditSummary.tsx decides which).
 */
export default function AuditModal({
  open,
  title,
  subtitle,
  onClose,
  children,
}: {
  open: boolean;
  title: string;
  subtitle?: ReactNode;
  onClose: () => void;
  children: ReactNode;
}) {
  // true only in the browser, so the portal never renders on the server
  const mounted = useSyncExternalStore(subscribeNoop, () => true, () => false);
  const titleId = useId();
  useRestoreFocus(open);

  // Escape closes it, and the page behind doesn't scroll while it's open
  useEffect(() => {
    if (!open) return;
    const onKey = (e: KeyboardEvent) => {
      if (e.key === "Escape") onClose();
    };
    window.addEventListener("keydown", onKey);
    const overflow = document.body.style.overflow;
    document.body.style.overflow = "hidden";
    return () => {
      window.removeEventListener("keydown", onKey);
      document.body.style.overflow = overflow;
    };
  }, [open, onClose]);

  if (!mounted) return null;

  return createPortal(
    <>
      <div className={`${styles.backdrop} ${open ? styles.backdropVisible : ""}`} onClick={onClose} aria-hidden="true" />
      <div
        className={`${styles.dialog} ${open ? styles.dialogOpen : ""}`}
        role="dialog"
        aria-modal="true"
        aria-labelledby={titleId}
        inert={!open}
      >
        <header className={styles.head}>
          <div>
            <h2 id={titleId} className={styles.title}>
              {title}
            </h2>
            {subtitle && <div className={styles.subtitle}>{subtitle}</div>}
          </div>
          <button type="button" className={styles.close} onClick={onClose} aria-label="Close">
            <HiMiniXMark size={20} />
          </button>
        </header>
        <div className={styles.body}>{children}</div>
      </div>
    </>,
    document.body
  );
}
