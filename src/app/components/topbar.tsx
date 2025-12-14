"use client";

import { useState, useEffect } from "react";
import styles from "./topbar.module.css";
import { HiMiniBellAlert, HiSun, HiMoon } from "react-icons/hi2";

type TopBarProps = {
  title: string;
  breadcrumbs?: { label: string; href?: string }[];
  onMenuToggle?: () => void;
};

export default function TopBar({ title, breadcrumbs = [], onMenuToggle }: TopBarProps) {
  const [theme, setTheme] = useState<"light" | "dark">("light");

  useEffect(() => {
    // Check for saved preference or system preference
    const saved = localStorage.getItem("theme") as "light" | "dark" | null;
    const systemDark = window.matchMedia("(prefers-color-scheme: dark)").matches;
    const initial = saved || (systemDark ? "dark" : "light");
    setTheme(initial);
    document.documentElement.setAttribute("data-theme", initial);
  }, []);

  const toggleTheme = () => {
    const next = theme === "light" ? "dark" : "light";
    setTheme(next);
    document.documentElement.setAttribute("data-theme", next);
    localStorage.setItem("theme", next);
  };

  return (
    <header className={styles.topbar}>
      <div className={styles.left}>
        {/* Mobile menu button */}
        <button 
          className={styles.menuButton}
          onClick={onMenuToggle}
          aria-label="Toggle menu"
        >
          <svg width="18" height="18" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2">
            <line x1="3" y1="6" x2="21" y2="6" />
            <line x1="3" y1="12" x2="21" y2="12" />
            <line x1="3" y1="18" x2="21" y2="18" />
          </svg>
        </button>

        {/* Breadcrumbs */}
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
           <HiMoon size={20} />
          ) : (
            <HiSun size={20} />
          )}
        </button>

        {/* Updates Button */}
        <button className={styles.iconButton} title="Updates">
         <HiMiniBellAlert size={20} />
        </button>

      </div>
    </header>
  );
}