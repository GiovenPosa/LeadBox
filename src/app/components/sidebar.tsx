"use client";

import { useState } from "react";
import styles from "./sidebar.module.css";
import { HiInbox, HiMiniUsers, HiMiniChartBar } from "react-icons/hi2";

type SidebarProps = {
  email: string | null;
  onSignOut: () => void;
  inboxUnseenCount: number;
};

export default function Sidebar({ email, onSignOut, inboxUnseenCount }: SidebarProps) {
  const [searchQuery, setSearchQuery] = useState("");

  return (
    <aside className={styles.sidebar}>
      {/* Workspace Header */}
      <div className={styles.workspaceHeader}>
        <button className={styles.workspaceButton}>
          <span className={styles.workspaceLogo}>G</span>
          <span className={styles.workspaceName}>gios.build</span>
          <svg 
            className={styles.chevron}
            width="10" 
            height="10" 
            viewBox="0 0 10 10" 
            fill="none"
          >
            <path 
              d="M2.5 4L5 6.5L7.5 4" 
              stroke="currentColor" 
              strokeWidth="1.5" 
              strokeLinecap="round" 
              strokeLinejoin="round"
            />
          </svg>
        </button>
      </div>

      {/* Search */}
      <div className={styles.searchWrapper}>
        <svg 
          className={styles.searchIcon}
          width="14" 
          height="14" 
          viewBox="0 0 24 24" 
          fill="none" 
          stroke="currentColor" 
          strokeWidth="2"
        >
          <circle cx="11" cy="11" r="8" />
          <path d="m21 21-4.35-4.35" />
        </svg>
        <input
          type="text"
          placeholder="Search..."
          value={searchQuery}
          onChange={(e) => setSearchQuery(e.target.value)}
          className={styles.searchInput}
        />
      </div>

      {/* Navigation */}
      <nav className={styles.nav}>
        <div className={styles.navSection}>
          <NavItem
            icon={<HiInbox size={20} />}
            label="Inbox"
            href="/"
            active
            badgeCount={inboxUnseenCount}
          />
          <NavItem 
            icon={<HiMiniUsers size={20} />}
            label="Contacts"
            href="#"
            disabled
          />
          <NavItem 
            icon={<HiMiniChartBar size={20} />}
            label="Analytics"
            href="#"
            disabled
          />
        </div>

        <div className={styles.navDivider} />

        <div className={styles.navSection}>
          <div className={styles.navSectionHeader}>
            <span>Pages</span>
            <button className={styles.addButton} title="Add page">
              <svg width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2">
                <line x1="12" y1="5" x2="12" y2="19" />
                <line x1="5" y1="12" x2="19" y2="12" />
              </svg>
            </button>
          </div>
        </div>
      </nav>

      {/* Footer */}
      <div className={styles.footer}>
        <div className={styles.userInfo}>
          <div className={styles.userAvatar}>
            {email?.charAt(0).toUpperCase() || "U"}
          </div>
          <span className={styles.userEmail}>{email}</span>
        </div>
        <button 
          onClick={onSignOut}
          className={styles.signOutButton}
          title="Sign out"
        >
          <svg width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="1.75">
            <path d="M9 21H5a2 2 0 0 1-2-2V5a2 2 0 0 1 2-2h4" />
            <polyline points="16 17 21 12 16 7" />
            <line x1="21" y1="12" x2="9" y2="12" />
          </svg>
        </button>
      </div>
    </aside>
  );
}

type NavItemProps = {
  icon: React.ReactNode;
  label: string;
  href: string;
  active?: boolean;
  disabled?: boolean;
  badgeCount?: number; // ✅ NEW
};

function NavItem({ icon, label, href, active, disabled, badgeCount }: NavItemProps) {
  const showBadge = !!badgeCount && badgeCount > 0;

  return (
    <a
      href={disabled ? undefined : href}
      className={`${styles.navItem} ${active ? styles.navItemActive : ""} ${disabled ? styles.navItemDisabled : ""}`}
      aria-current={active ? "page" : undefined}
      tabIndex={disabled ? -1 : 0}
    >
      <span className={styles.navIcon}>{icon}</span>

      <span className={styles.navLabel}>
        {label}
        {showBadge && <span className={styles.navDot} aria-hidden="true" />}
      </span>

      {showBadge && (
        <span className={styles.navBadge} aria-label={`${badgeCount} new inquiries`}>
          {badgeCount > 99 ? "99+" : badgeCount}
        </span>
      )}
    </a>
  );
}