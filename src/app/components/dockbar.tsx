"use client";

import styles from "./dockbar.module.css";
import { HiInbox, HiMiniUsers, HiMiniChartBar, HiMagnifyingGlass } from "react-icons/hi2";

type DockBarProps = {
  activePage: "inbox" | "contacts" | "search" | "analytics";
  inboxUnseenCount?: number;
  onSearchClick?: () => void;
};

export default function DockBar({ activePage, inboxUnseenCount = 0, onSearchClick }: DockBarProps) {
  const showBadge = inboxUnseenCount > 0;

  return (
    <nav className={styles.dockBar} aria-label="Main navigation">
      <div className={styles.dockInner}>
        <DockItem
          icon={<HiInbox size={22} />}
          label="Inbox"
          href="/"
          active={activePage === "inbox"}
          badge={showBadge ? inboxUnseenCount : undefined}
        />
        <DockItem
          icon={<HiMiniUsers size={22} />}
          label="Contacts"
          href="#"
          active={activePage === "contacts"}
          disabled
        />
        <DockItem
          icon={<HiMagnifyingGlass size={22} />}
          label="Search"
          active={activePage === "search"}
          onClick={onSearchClick}
        />
        <DockItem
          icon={<HiMiniChartBar size={22} />}
          label="Analytics"
          href="#"
          active={activePage === "analytics"}
          disabled
        />
      </div>
    </nav>
  );
}

type DockItemProps = {
  icon: React.ReactNode;
  label: string;
  href?: string;
  active?: boolean;
  disabled?: boolean;
  badge?: number;
  onClick?: () => void;
};

function DockItem({ icon, label, href, active, disabled, badge, onClick }: DockItemProps) {
  const showBadge = badge !== undefined && badge > 0;

  const content = (
    <>
      <span className={styles.dockIconWrapper}>
        <span className={styles.dockIcon}>{icon}</span>
        {showBadge && (
          <span className={styles.dockBadge} aria-label={`${badge} new`}>
            {badge > 99 ? "99+" : badge}
          </span>
        )}
      </span>
      <span className={styles.dockLabel}>{label}</span>
    </>
  );

  const className = `${styles.dockItem} ${active ? styles.dockItemActive : ""} ${disabled ? styles.dockItemDisabled : ""}`;

  if (onClick) {
    return (
      <button
        className={className}
        onClick={onClick}
        disabled={disabled}
        aria-current={active ? "page" : undefined}
      >
        {content}
      </button>
    );
  }

  return (
    <a
      href={disabled ? undefined : href}
      className={className}
      aria-current={active ? "page" : undefined}
      tabIndex={disabled ? -1 : 0}
    >
      {content}
    </a>
  );
}