"use client";

import styles from "./dockbar.module.css";
import { HiInbox, HiOutlineInbox, HiMiniUsers, HiOutlineUsers, HiMiniChartBar, HiOutlineChartBar, HiMiniRocketLaunch, HiOutlineRocketLaunch } from "react-icons/hi2";
import Link from "next/link";

type DockBarProps = {
  activePage: "inbox" | "contacts" | "projects" | "analytics";
  inboxUnseenCount?: number;
  onSearchClick?: () => void;
};

export default function DockBar({ activePage, inboxUnseenCount = 0, onSearchClick }: DockBarProps) {
  const showBadge = inboxUnseenCount > 0;

  return (
    <nav className={styles.dockBar} aria-label="Main navigation">
      <div className={styles.dockInner}>
        <DockItem
          icon={<HiOutlineInbox size={25} />}
          activeIcon={<HiInbox size={25} />}
          label="Inbox"
          href="/"
          active={activePage === "inbox"}
          badge={showBadge ? inboxUnseenCount : undefined}
        />
        <DockItem
          icon={<HiOutlineUsers size={25} />}
          activeIcon={<HiMiniUsers size={25} />}
          label="Contacts"
          href="/contacts"
          active={activePage === "contacts"}
        />
        <DockItem
          icon={<HiOutlineRocketLaunch size={25} />}
          activeIcon={<HiMiniRocketLaunch size={25} />}
          label="Projects"
          active={activePage === "projects"}
          onClick={onSearchClick}
        />
        <DockItem
          icon={<HiOutlineChartBar size={25} />}
          activeIcon={<HiMiniChartBar size={25} />}
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
  activeIcon: React.ReactNode;
  label: string;
  href?: string;
  active?: boolean;
  disabled?: boolean;
  badge?: number;
  onClick?: () => void;
};

function DockItem({ icon, activeIcon, label, href, active, disabled, badge, onClick }: DockItemProps) {
  const showBadge = badge !== undefined && badge > 0;
  const className = `${styles.dockItem} ${active ? styles.dockItemActive : ""} ${disabled ? styles.dockItemDisabled : ""}`;

  const content = (
    <>
      <span className={styles.dockIconWrapper}>
        <span className={styles.dockIcon}>{active ? activeIcon : icon}</span>
        {showBadge && (
          <span className={styles.dockBadge} aria-label={`${badge} new`}>
            {badge > 99 ? "99+" : badge}
          </span>
        )}
      </span>
      <span className={styles.dockLabel}>{label}</span>
    </>
  );

  if (onClick) {
    return (
      <button onClick={onClick} className={className}>
        {content}
      </button>
    );
  }

  if (disabled || !href) {
    return (
      <span className={className} tabIndex={-1}>
        {content}
      </span>
    );
  }

  // Active page - no navigation needed
  if (active) {
    return (
      <span className={className} aria-current="page">
        {content}
      </span>
    );
  }

  // Use anchor for all items for consistent behavior
  return (
    <Link
      href={href!}
      className={className}
    >
      {content}
    </Link>
  );
}