"use client";

import { useEffect, useId, useSyncExternalStore } from "react";
import { createPortal } from "react-dom";
import styles from "./component-styles/confirmDialog.module.css";
import Button from "./button";
import { useRestoreFocus } from "../hooks/useRestoreFocus";

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
  useRestoreFocus(open);

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
        // inert, not aria-hidden: it also moves focus out when the dialog closes
        inert={!open}
      >
        <h2 id={titleId} className={styles.title}>
          {title}
        </h2>
        <p id={messageId} className={styles.message}>
          {message}
        </p>
        <div className={styles.actions}>
          <Button variant="secondary" onClick={onCancel} disabled={busy}>
            {cancelLabel}
          </Button>
          <Button variant={variant === "danger" ? "danger" : "primary"} onClick={onConfirm} busy={busy}>
            {busy ? busyLabel ?? confirmLabel : confirmLabel}
          </Button>
        </div>
      </div>
    </>,
    document.body
  );
}
