"use client";

import { useState, useEffect } from "react";
import styles from "./component-styles/topbar.module.css";
import { HiMiniBellAlert, HiSun, HiMoon, HiArrowRightOnRectangle, HiXMark } from "react-icons/hi2";

type TopBarProps = {
  title: string;
  breadcrumbs?: { label: string; href?: string }[];
  email?: string | null;
  onSignOut?: () => void;
};

export default function TopBar({ title, breadcrumbs = [], email, onSignOut }: TopBarProps) {
  const [theme, setTheme] = useState<"light" | "dark">("light");
  const [showUserPanel, setShowUserPanel] = useState(false);

  useEffect(() => {
    // Check for saved preference or system preference
    const saved = localStorage.getItem("theme") as "light" | "dark" | null;
    const systemDark = window.matchMedia("(prefers-color-scheme: dark)").matches;
    const initial = saved || (systemDark ? "dark" : "light");
    setTheme(initial);
    document.documentElement.setAttribute("data-theme", initial);
  }, []);

  // Prevent body scroll when panel is open
  useEffect(() => {
    if (showUserPanel) {
      document.body.style.overflow = "hidden";
    } else {
      document.body.style.overflow = "";
    }
    return () => {
      document.body.style.overflow = "";
    };
  }, [showUserPanel]);

  const toggleTheme = () => {
    const next = theme === "light" ? "dark" : "light";
    setTheme(next);
    document.documentElement.setAttribute("data-theme", next);
    localStorage.setItem("theme", next);
  };

  const handleSignOut = () => {
    setShowUserPanel(false);
    onSignOut?.();
  };

  const closePanel = () => {
    setShowUserPanel(false);
  };

  return (
    <>
      <header className={styles.topbar}>
        <div className={styles.left}>
          {/* Breadcrumbs - Desktop only */}
          <nav className={styles.breadcrumbs} aria-label="Breadcrumb">
            {breadcrumbs.map((crumb, index) => (
              <span key={index} className={styles.breadcrumbItem}>
                {crumb.href ? (
                  <a href={crumb.href} className={styles.breadcrumbLink}>
                    {crumb.label}
                  </a>
                ) : (
                  <span className={styles.breadcrumbText}>{crumb.label}</span>
                )}
                {index < breadcrumbs.length - 1 && (
                  <span className={styles.breadcrumbSep}>/</span>
                )}
              </span>
            ))}
          </nav>

          {/* User Avatar - Mobile only */}
          {email && (
            <button 
              className={styles.userAvatarButton}
              onClick={() => setShowUserPanel(true)}
              aria-label="User menu"
            >
              <span className={styles.userAvatar}>
                {email.charAt(0).toUpperCase()}
              </span>
            </button>
          )}
        </div>

        <div className={styles.right}>
          {/* Theme Toggle */}
          <button 
            className={styles.iconButton}
            onClick={toggleTheme}
            title={`Switch to ${theme === "light" ? "dark" : "light"} mode`}
            aria-label={`Switch to ${theme === "light" ? "dark" : "light"} mode`}
          >
            {theme === "light" ? (
             <HiMoon size={23} />
            ) : (
              <HiSun size={23} />
            )}
          </button>

          {/* Updates Button */}
          <button className={styles.iconButton} title="Updates">
           <HiMiniBellAlert size={23} />
          </button>
        </div>
      </header>

      {/* Bottom Sheet Panel */}
      {email && (
        <>
          {/* Backdrop */}
          <div 
            className={`${styles.panelBackdrop} ${showUserPanel ? styles.panelBackdropVisible : ""}`}
            onClick={closePanel}
            aria-hidden="true"
          />

          {/* Panel */}
          <div 
            className={`${styles.userPanel} ${showUserPanel ? styles.userPanelOpen : ""}`}
            role="dialog"
            aria-modal="true"
            aria-label="User menu"
          >
            {/* Handle */}
            <div className={styles.panelHandle}>
              <div className={styles.panelHandleBar} />
            </div>

            {/* Header */}
            <div className={styles.panelHeader}>
              <h2 className={styles.panelTitle}>Account</h2>
              <button 
                className={styles.panelCloseButton}
                onClick={closePanel}
                aria-label="Close"
              >
                <HiXMark size={24} />
              </button>
            </div>

            {/* User Info */}
            <div className={styles.panelUserInfo}>
              <div className={styles.panelAvatar}>
                {email.charAt(0).toUpperCase()}
              </div>
              <div className={styles.panelUserDetails}>
                <span className={styles.panelUserName}>
                  {email.split("@")[0]}
                </span>
                <span className={styles.panelUserEmail}>{email}</span>
              </div>
            </div>

            {/* Actions */}
            <div className={styles.panelActions}>
              <button 
                className={styles.panelSignOutButton}
                onClick={handleSignOut}
              >
                <span>Sign out</span>
              </button>
            </div>

            {/* Footer spacer for safe area */}
            <div className={styles.panelFooter} />
          </div>
        </>
      )}
    </>
  );
}