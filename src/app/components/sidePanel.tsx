"use client";

import { useEffect, useId, useSyncExternalStore, type FormEvent, type ReactNode } from "react";
import { createPortal } from "react-dom";
import { HiXMark } from "react-icons/hi2";
import styles from "./component-styles/sidePanel.module.css";
import { useRestoreFocus } from "../hooks/useRestoreFocus";

// The app's side panel: a drawer from the right on desktop, a bottom sheet on
// phones. It brings the frame (backdrop, header with close, scrolling body,
// footer); the content and actions are the caller's. It stays mounted while
// closed so it can slide back out.

type SidePanelProps = {
  open: boolean;
  onClose: () => void;
  title: ReactNode;
  /** a quieter line under the title */
  subtitle?: ReactNode;
  /** the action row along the bottom */
  footer?: ReactNode;
  /** makes the panel a form, so Enter in a field submits it */
  onSubmit?: (e: FormEvent<HTMLFormElement>) => void;
  /** false while something is saving: Escape and the backdrop won't close it */
  dismissible?: boolean;
  children: ReactNode;
};

const subscribeNoop = () => () => {};

export default function SidePanel({
  open,
  onClose,
  title,
  subtitle,
  footer,
  onSubmit,
  dismissible = true,
  children,
}: SidePanelProps) {
  // true only in the browser, so the portal never renders on the server
  const mounted = useSyncExternalStore(subscribeNoop, () => true, () => false);
  const titleId = useId();
  useRestoreFocus(open);

  useEffect(() => {
    if (!open) return;
    const onKey = (e: KeyboardEvent) => {
      if (e.key === "Escape" && dismissible) onClose();
    };
    window.addEventListener("keydown", onKey);
    return () => window.removeEventListener("keydown", onKey);
  }, [open, dismissible, onClose]);

  if (!mounted) return null;

  const content = (
    <>
      <header className={styles.header}>
        <div className={styles.heading}>
          <h2 id={titleId} className={styles.title}>
            {title}
          </h2>
          {subtitle && <p className={styles.subtitle}>{subtitle}</p>}
        </div>
        <button type="button" className={styles.closeBtn} onClick={onClose} aria-label="Close">
          <HiXMark size={22} />
        </button>
      </header>

      <div className={styles.body}>{children}</div>

      {footer && <footer className={styles.footer}>{footer}</footer>}
    </>
  );

  return createPortal(
    <>
      <div
        className={`${styles.backdrop} ${open ? styles.backdropVisible : ""}`}
        onClick={() => dismissible && onClose()}
        aria-hidden="true"
      />
      <div
        className={`${styles.panel} ${open ? styles.panelOpen : ""}`}
        role="dialog"
        aria-modal="true"
        aria-labelledby={titleId}
        // inert hides a closed panel from screen readers and moves focus out
        // (aria-hidden would hide it while focus was still inside)
        inert={!open}
      >
        {onSubmit ? (
          <form className={styles.frame} onSubmit={onSubmit} noValidate>
            {content}
          </form>
        ) : (
          <div className={styles.frame}>{content}</div>
        )}
      </div>
    </>,
    document.body
  );
}

/** A divided group of fields in the panel's body */
export function PanelSection({ children }: { children: ReactNode }) {
  return <div className={styles.section}>{children}</div>;
}

/** Two fields side by side (one column on very small phones) */
export function PanelRow({ children, wide }: { children: ReactNode; wide?: boolean }) {
  return <div className={wide ? styles.rowWide : styles.row}>{children}</div>;
}

/** An error message at the top of the panel's body */
export function PanelError({ children }: { children: ReactNode }) {
  return (
    <p className={styles.error} role="alert">
      {children}
    </p>
  );
}

/** A highlighted note with an action, e.g. a next step for the thing being edited */
export function PanelCallout({
  icon,
  title,
  children,
  action,
}: {
  icon: ReactNode;
  title: string;
  children?: ReactNode;
  action: ReactNode;
}) {
  return (
    <div className={styles.callout}>
      <span className={styles.calloutIcon} aria-hidden="true">
        {icon}
      </span>
      <div className={styles.calloutText}>
        <p className={styles.calloutTitle}>{title}</p>
        {children && <p className={styles.calloutBody}>{children}</p>}
      </div>
      <div className={styles.calloutAction}>{action}</div>
    </div>
  );
}

/**
 * The footer's layout: Cancel (and Delete, when there is one) on the left,
 * the main action on its own on the right.
 */
export function PanelFooter({ start, children }: { start: ReactNode; children: ReactNode }) {
  return (
    <>
      <div className={styles.footerStart}>{start}</div>
      <div className={styles.footerActions}>{children}</div>
    </>
  );
}
