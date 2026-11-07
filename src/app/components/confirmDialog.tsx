"use client";

import { useEffect, useId, useSyncExternalStore } from "react";
import { createPortal } from "react-dom";
import styles from "./component-styles/confirmDialog.module.css";

export type ConfirmVariant = "neutral" | "danger";

type ConfirmDialogProps = {
  open: boolean;
  /** "danger" for anything that can't be undone, like a delete */
  variant?: ConfirmVariant;
  title: string;
  message: string;
  confirmLabel: string;
  busyLabel?: string;
  busy?: boolean;
  cancelLabel?: string;
  onConfirm: () => void;
  onCancel: () => void;
};

const subscribeNoop = () => () => {};

// The app's confirm step: a centred card on desktop, a bottom sheet on
// mobile. Neutral by default; the danger variant turns the confirm button red.
export default function ConfirmDialog({
  open,
  variant = "neutral",
  title,
  message,
  confirmLabel,
  busyLabel,
  busy = false,
  cancelLabel = "Cancel",
  onConfirm,
  onCancel,
}: ConfirmDialogProps) {
  // true only in the browser, so the portal never renders on the server
  const mounted = useSyncExternalStore(subscribeNoop, () => true, () => false);
  const titleId = useId();
  const messageId = useId();

  // Escape closes it, unless a delete is already running
  useEffect(() => {
    if (!open) return;
    const onKey = (e: KeyboardEvent) => {
      if (e.key === "Escape" && !busy) onCancel();
    };
    window.addEventListener("keydown", onKey);
    return () => window.removeEventListener("keydown", onKey);
  }, [open, busy, onCancel]);

  if (!mounted) return null;

  return createPortal(
    <>
      <div
        className={`${styles.backdrop} ${open ? styles.backdropVisible : ""}`}
        onClick={() => !busy && onCancel()}
        aria-hidden="true"
      />
      <div
        className={`${styles.dialog} ${open ? styles.dialogOpen : ""}`}
        role={variant === "danger" ? "alertdialog" : "dialog"}
        aria-modal="true"
        aria-labelledby={titleId}
        aria-describedby={messageId}
        aria-hidden={!open}
      >
        <h2 id={titleId} className={styles.title}>
          {title}
        </h2>
        <p id={messageId} className={styles.message}>
          {message}
        </p>
        <div className={styles.actions}>
          <button type="button" className={styles.cancelBtn} onClick={onCancel} disabled={busy}>
            {cancelLabel}
          </button>
          <button
            type="button"
            className={`${styles.confirmBtn} ${variant === "danger" ? styles.confirmDanger : styles.confirmNeutral}`}
            onClick={onConfirm}
            disabled={busy}
          >
            {busy ? busyLabel ?? confirmLabel : confirmLabel}
          </button>
        </div>
      </div>
    </>,
    document.body
  );
}
