"use client";

import { usePushNotifications } from "../hooks/usePushNotifications";
import { HiBell, HiBellSlash, HiBellAlert } from "react-icons/hi2";
import styles from "./component-styles/notificationToggle.module.css";

type NotificationToggleProps = {
  variant?: "button" | "switch" | "card" | "icon";
  showLabel?: boolean;
};

export default function NotificationToggle({
  variant = "button",
  showLabel = true,
}: NotificationToggleProps) {
  const {
    permission,
    isSubscribed,
    isLoading,
    error,
    subscribe,
    unsubscribe,
  } = usePushNotifications();

  const handleToggle = async () => {
    if (isLoading) return;

    if (isSubscribed) {
      await unsubscribe();
    } else {
      await subscribe();
    }
  };

  // Don't render if not supported
  if (permission === "unsupported") {
    return null;
  }

  // Denied state - show info (except for icon variant)
  if (permission === "denied") {
    if (variant === "icon") {
      return (
        <button
          className={styles.iconButton}
          title="Notifications blocked - enable in browser settings"
          disabled
        >
          <HiBellSlash size={23} />
        </button>
      );
    }
    
    return (
      <div className={styles.deniedState}>
        <HiBellSlash size={18} />
        {showLabel && (
          <span className={styles.deniedText}>
            Notifications blocked. Enable in browser settings.
          </span>
        )}
      </div>
    );
  }

  // Icon variant - compact for topbar
  if (variant === "icon") {
    return (
      <button
        className={`${styles.iconButton} ${isSubscribed ? styles.iconButtonActive : ""}`}
        onClick={handleToggle}
        disabled={isLoading}
        title={isSubscribed ? "Notifications enabled" : "Enable notifications"}
        aria-label={isSubscribed ? "Disable notifications" : "Enable notifications"}
      >
        {isLoading ? (
          <span className={styles.iconSpinner} />
        ) : isSubscribed ? (
          <HiBell size={23} />
        ) : (
          <HiBellSlash size={23} />
        )}
      </button>
    );
  }

  // Button variant
  if (variant === "button") {
    return (
      <button
        className={`${styles.toggleButton} ${isSubscribed ? styles.subscribed : ""}`}
        onClick={handleToggle}
        disabled={isLoading}
        title={isSubscribed ? "Disable notifications" : "Enable notifications"}
      >
        {isLoading ? (
          <span className={styles.spinner} />
        ) : isSubscribed ? (
          <HiBell size={18} />
        ) : (
          <HiBellSlash size={18} />
        )}
        {showLabel && (
          <span className={styles.buttonLabel}>
            {isLoading
              ? "..."
              : isSubscribed
                ? "Notifications on"
                : "Enable notifications"}
          </span>
        )}
      </button>
    );
  }

  // Switch variant
  if (variant === "switch") {
    return (
      <label className={styles.switchContainer}>
        {showLabel && (
          <span className={styles.switchLabel}>
            <HiBell size={16} />
            Push notifications
          </span>
        )}
        <button
          role="switch"
          aria-checked={isSubscribed}
          className={`${styles.switch} ${isSubscribed ? styles.switchOn : ""}`}
          onClick={handleToggle}
          disabled={isLoading}
        >
          <span className={styles.switchThumb} />
        </button>
      </label>
    );
  }

  // Card variant - more detailed
  if (variant === "card") {
    return (
      <div className={styles.card}>
        <div className={styles.cardIcon}>
          {isSubscribed ? <HiBell size={24} /> : <HiBellAlert size={24} />}
        </div>
        <div className={styles.cardContent}>
          <h4 className={styles.cardTitle}>
            {isSubscribed ? "Notifications enabled" : "Enable notifications"}
          </h4>
          <p className={styles.cardDescription}>
            {isSubscribed
              ? "You'll receive alerts for new inquiries"
              : "Get notified instantly when new leads come in"}
          </p>
          {error && <p className={styles.cardError}>{error}</p>}
        </div>
        <button
          className={`${styles.cardButton} ${isSubscribed ? styles.cardButtonOff : ""}`}
          onClick={handleToggle}
          disabled={isLoading}
        >
          {isLoading ? "..." : isSubscribed ? "Turn off" : "Turn on"}
        </button>
      </div>
    );
  }

  return null;
}