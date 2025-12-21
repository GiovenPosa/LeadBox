"use client";

import { useEffect, useState } from "react";
import { createPortal } from "react-dom";
import { HiCheck, HiMiniArrowPath } from "react-icons/hi2";
import styles from "./component-styles/toast.module.css";

export type ToastType = "saving" | "saved" | "qualifying" | "qualified" | null;

type ToastProps = {
  type: ToastType;
  onComplete?: () => void;
};

const TOAST_CONFIG: Record<
  Exclude<ToastType, null>,
  { label: string; icon: "loading" | "success"; variant: "neutral" | "success" }
> = {
  saving: { label: "Saving...", icon: "loading", variant: "neutral" },
  saved: { label: "Saved", icon: "success", variant: "neutral" },
  qualifying: { label: "Qualifying...", icon: "loading", variant: "neutral" },
  qualified: { label: "Qualified", icon: "success", variant: "success" },
};

export default function Toast({ type, onComplete }: ToastProps) {
  const [mounted, setMounted] = useState(false);
  const [visible, setVisible] = useState(false);
  const [currentType, setCurrentType] = useState<ToastType>(null);

  useEffect(() => {
    setMounted(true);
  }, []);

  useEffect(() => {
    if (type) {
      setCurrentType(type);
      // Small delay to trigger CSS transition
      requestAnimationFrame(() => {
        setVisible(true);
      });

      // Auto-dismiss success states
      if (type === "saved" || type === "qualified") {
        const timer = setTimeout(() => {
          setVisible(false);
          // Wait for exit animation before clearing
          setTimeout(() => {
            setCurrentType(null);
            onComplete?.();
          }, 200);
        }, 1800);
        return () => clearTimeout(timer);
      }
    } else {
      setVisible(false);
      setTimeout(() => setCurrentType(null), 200);
    }
  }, [type, onComplete]);

  if (!mounted || !currentType) return null;

  const config = TOAST_CONFIG[currentType];

  return createPortal(
    <div
      className={`${styles.toastContainer} ${visible ? styles.toastVisible : ""}`}
      role="status"
      aria-live="polite"
    >
      <div className={`${styles.toast} ${styles[`toast${config.variant.charAt(0).toUpperCase() + config.variant.slice(1)}`]}`}>
        <span className={styles.toastIcon}>
          {config.icon === "loading" ? (
            <HiMiniArrowPath size={15} className={styles.spinner} />
          ) : (
            <HiCheck className={styles.checkIcon} size={16} />
          )}
        </span>
        <span className={styles.toastLabel}>{config.label}</span>
      </div>
    </div>,
    document.body
  );
}