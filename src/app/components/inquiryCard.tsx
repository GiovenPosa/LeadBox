"use client";

import { useState, useEffect } from "react";
import { createPortal } from "react-dom";
import styles from "./inquiryCard.module.css";
import {
  HiMiniWindow,
  HiCurrencyPound,
  HiMiniCube,
  HiXMark,
  HiCheck,
} from "react-icons/hi2";

export type OpportunityStatus = "new" | "contacted" | "won" | "lost" | "bad";

export type BookingInquiry = {
  id: string;
  created_at: string;
  name: string | null;
  email: string | null;
  phone: string | null;
  selected_types: string[] | null;
  selected_package: string | null;
  budget: number | null;
  message: string | null;
  user_agent: string | null;
  source_page: string | null;
  opportunity_status: OpportunityStatus;
  seen_at: string | null;
};

type InquiryCardProps = {
  inquiry: BookingInquiry;
  onStatusChange: (id: string, status: OpportunityStatus) => void;
  onSeen: (id: string) => void;
};

const STATUS_ORDER: OpportunityStatus[] = ["new", "contacted", "won", "lost", "bad"];

const STATUS_CONFIG: Record<OpportunityStatus, { label: string; className: string }> = {
  new: { label: "New", className: styles.statusNew },
  contacted: { label: "Contacted", className: styles.statusContacted },
  won: { label: "Won", className: styles.statusWon },
  lost: { label: "Lost", className: styles.statusLost },
  bad: { label: "Bad", className: styles.statusBad },
};

function formatDate(dateString: string): string {
  const date = new Date(dateString);
  const now = new Date();
  const diffMs = now.getTime() - date.getTime();
  const diffMins = Math.floor(diffMs / 60000);
  const diffHours = Math.floor(diffMs / 3600000);
  const diffDays = Math.floor(diffMs / 86400000);

  if (diffMins < 1) return "Just now";
  if (diffMins < 60) return `${diffMins}m ago`;
  if (diffHours < 24) return `${diffHours}h ago`;
  if (diffDays < 7) return `${diffDays}d ago`;

  return date.toLocaleDateString("en-GB", {
    day: "numeric",
    month: "short",
    year: date.getFullYear() !== now.getFullYear() ? "numeric" : undefined,
  });
}

function formatBudget(budget: number): string {
  if (budget >= 1000) {
    return `£${(budget / 1000).toFixed(budget % 1000 === 0 ? 0 : 1)}k`;
  }
  return `£${budget}`;
}

export default function InquiryCard({ inquiry, onStatusChange, onSeen }: InquiryCardProps) {
  const [isHovered, setIsHovered] = useState(false);
  const [showStatusMenu, setShowStatusMenu] = useState(false);
  const [showStatusPanel, setShowStatusPanel] = useState(false);
  const [isMobile, setIsMobile] = useState(false);
  const [mounted, setMounted] = useState(false);

  // Track mount state for portal
  useEffect(() => {
    setMounted(true);
  }, []);

  // Detect mobile on mount and resize
  useEffect(() => {
    const checkMobile = () => {
      setIsMobile(window.innerWidth <= 768);
    };
    
    checkMobile();
    window.addEventListener("resize", checkMobile);
    return () => window.removeEventListener("resize", checkMobile);
  }, []);

  // Prevent scrolling when panel is open
  useEffect(() => {
    if (!showStatusPanel) return;

    const preventScroll = (e: TouchEvent) => {
      // Allow scrolling inside the panel if it has overflow
      const target = e.target as HTMLElement;
      if (target.closest(`.${styles.statusPanel}`)) {
        return;
      }
      e.preventDefault();
    };

    document.addEventListener("touchmove", preventScroll, { passive: false });
    
    return () => {
      document.removeEventListener("touchmove", preventScroll);
    };
  }, [showStatusPanel]);

  const config = STATUS_CONFIG[inquiry.opportunity_status];
  const hasTags = inquiry.selected_package || inquiry.budget != null || inquiry.source_page;

  // ✅ Dot is purely visual: new + unseen
  const showNewDot = inquiry.opportunity_status === "new" && !inquiry.seen_at;

  const handleCardClick = () => {
    // ✅ Only mark seen if currently unseen
    if (showNewDot) onSeen(inquiry.id);
  };

  const handleStatusClick = (e: React.MouseEvent) => {
    e.stopPropagation(); // ✅ don't mark seen when opening status menu
    
    if (isMobile) {
      setShowStatusPanel(true);
    } else {
      setShowStatusMenu((v) => !v);
    }
  };

  const handleStatusSelect = (status: OpportunityStatus) => {
    onStatusChange(inquiry.id, status);
    setShowStatusMenu(false);
    setShowStatusPanel(false);
  };

  const closePanel = () => {
    setShowStatusPanel(false);
  };

  return (
    <>
      <article
        className={styles.card}
        onClick={handleCardClick}
        onMouseEnter={() => setIsHovered(true)}
        onMouseLeave={() => {
          setIsHovered(false);
          setShowStatusMenu(false);
        }}
        role="button"
        tabIndex={0}
        onKeyDown={(e) => {
          if (e.key === "Enter" || e.key === " ") handleCardClick();
        }}
      >
        <div className={styles.cardContent}>
          {/* Main Row */}
          <div className={styles.mainRow}>
            <div className={styles.primaryInfo}>
              {/* Name */}
              <span className={styles.name}>
                {showNewDot && <span className={styles.newDot} />}
                {inquiry.name || "Unnamed"}
              </span>

              {/* Status Badge */}
              <div className={styles.statusWrapper}>
                <button
                  className={`${styles.status} ${config.className}`}
                  onClick={handleStatusClick}
                  title="Click to change status"
                  type="button"
                  aria-expanded={showStatusMenu || showStatusPanel}
                  aria-haspopup="listbox"
                >
                  {config.label}
                </button>

                {/* Status Dropdown - Desktop only */}
                {showStatusMenu && !isMobile && (
                  <div className={styles.statusMenu} role="listbox">
                    {STATUS_ORDER.map((status) => (
                      <button
                        key={status}
                        className={`${styles.statusOption} ${STATUS_CONFIG[status].className} ${
                          status === inquiry.opportunity_status ? styles.statusOptionActive : ""
                        }`}
                        onClick={(e) => {
                          e.stopPropagation(); // ✅ don't mark seen when selecting status
                          handleStatusSelect(status);
                        }}
                        role="option"
                        aria-selected={status === inquiry.opportunity_status}
                      >
                        {STATUS_CONFIG[status].label}
                      </button>
                    ))}
                  </div>
                )}
              </div>
            </div>

            {/* Timestamp */}
            <time className={styles.timestamp} dateTime={inquiry.created_at}>
              {formatDate(inquiry.created_at)}
            </time>
          </div>

          {/* Contact Links */}
          <div className={styles.contact}>
            {inquiry.email && (
              <a
                href={`mailto:${inquiry.email}`}
                className={styles.contactLink}
                onClick={(e) => e.stopPropagation()} // ✅ don't mark seen for mail clicks
              >
               
                <span>{inquiry.email}</span>
              </a>
            )}
            {inquiry.phone && (
              <a
                href={`tel:${inquiry.phone}`}
                className={styles.contactLink}
                onClick={(e) => e.stopPropagation()} // ✅ don't mark seen for tel clicks
              >
                
                <span>{inquiry.phone}</span>
              </a>
            )}
          </div>

          {/* Message */}
          {inquiry.message && <p className={styles.message}>"{inquiry.message}"</p>}

          {/* Tags Row */}
          {hasTags && (
            <div className={styles.tagsRow}>
              {inquiry.selected_package && (
                <span className={`${styles.tag} ${styles.tagPackage}`}>
                  <HiMiniCube size={20} />
                  {inquiry.selected_package}
                </span>
              )}
              {inquiry.budget != null && (
                <span className={`${styles.tag} ${styles.tagBudget}`}>
                  <HiCurrencyPound size={15} />
                  {formatBudget(inquiry.budget)}
                </span>
              )}
              {inquiry.source_page && (
                <span className={`${styles.tag} ${styles.tagSource}`}>
                  <HiMiniWindow size={20} />
                  {inquiry.source_page}
                </span>
              )}
            </div>
          )}
        </div>
      </article>

      {/* Status Bottom Sheet Panel - Mobile only (rendered via Portal) */}
      {mounted && createPortal(
        <>
          {/* Backdrop */}
          <div
            className={`${styles.panelBackdrop} ${showStatusPanel ? styles.panelBackdropVisible : ""}`}
            onClick={(e) => {
              e.stopPropagation();
              closePanel();
            }}
            onTouchMove={(e) => e.preventDefault()}
            aria-hidden="true"
          />

          {/* Panel */}
          <div
            className={`${styles.statusPanel} ${showStatusPanel ? styles.statusPanelOpen : ""}`}
            role="dialog"
            aria-modal="true"
            aria-label="Change status"
            onClick={(e) => e.stopPropagation()}
            onTouchMove={(e) => e.stopPropagation()}
          >
            {/* Handle */}
            <div className={styles.panelHandle}>
              <div className={styles.panelHandleBar} />
            </div>

            {/* Header */}
            <div className={styles.panelHeader}>
              <h2 className={styles.panelTitle}>Update Status</h2>
              <button
                className={styles.panelCloseButton}
                onClick={(e) => {
                  e.stopPropagation();
                  closePanel();
                }}
                aria-label="Close"
              >
                <HiXMark size={24} />
              </button>
            </div>

            {/* Inquiry Info */}
            <div className={styles.panelInquiryInfo}>
              <span className={styles.panelInquiryName}>{inquiry.name || "Unnamed"}</span>
              {inquiry.email && (
                <span className={styles.panelInquiryEmail}>{inquiry.email}</span>
              )}
              {(inquiry.selected_package || inquiry.budget != null) && (
                <div className={styles.panelInquiryMeta}>
                  {inquiry.selected_package && (
                    <span className={styles.panelInquiryTag}>
                      <HiMiniCube size={25} />
                      {inquiry.selected_package}
                    </span>
                  )}
                  {inquiry.budget != null && (
                    <span className={styles.panelInquiryTag}>
                      <HiCurrencyPound size={25} />
                      {formatBudget(inquiry.budget)}
                    </span>
                  )}
                </div>
              )}
             
            </div>

            {/* Status Options */}
            <div className={styles.panelOptions} role="listbox">
              {STATUS_ORDER.map((status) => {
                const statusConfig = STATUS_CONFIG[status];
                const isActive = status === inquiry.opportunity_status;
                
                return (
                  <button
                    key={status}
                    className={`${styles.panelOption} ${statusConfig.className} ${isActive ? styles.panelOptionActive : ""}`}
                    onClick={(e) => {
                      e.stopPropagation();
                      handleStatusSelect(status);
                    }}
                    role="option"
                    aria-selected={isActive}
                  >
                    <span className={styles.panelOptionLabel}>
                      {statusConfig.label}
                    </span>
                    {isActive && (
                      <HiCheck size={20} className={styles.panelOptionCheck} />
                    )}
                  </button>
                );
              })}
            </div>

            {/* Footer spacer for safe area */}
            <div className={styles.panelFooter} />
          </div>
        </>,
        document.body
      )}
    </>
  );
}