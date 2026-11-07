"use client";

import { useState, useEffect, useSyncExternalStore } from "react";
import { createPortal } from "react-dom";
import styles from "./component-styles/inquiryCard.module.css";
import {
  HiMiniWindow,
  HiCurrencyPound,
  HiMiniCube,
  HiXMark,
  HiCheck,
  HiTrash,
  HiOutlineTrash,
  HiMiniBolt,
} from "react-icons/hi2";
import { useRouter } from "next/navigation";
import { useSwipeToDelete } from "../hooks/useSwipeToDelete";
import { useMediaQuery } from "../hooks/useMediaQuery";
import { embeddedLead, leadHref, type LeadRef } from "../../lib/leads";

/**
 * An enquiry is New, Contacted or Bad until it's turned into a lead, which
 * makes it Converted; from there the lead's own stage tracks the deal.
 */
export type OpportunityStatus = "new" | "contacted" | "converted" | "bad";

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
  /** the lead it was turned into, embedded by the inbox query */
  leads?: LeadRef | LeadRef[] | null;
};

type InquiryCardProps = {
  inquiry: BookingInquiry;
  onStatusChange: (id: string, status: OpportunityStatus) => void;
  onSeen: (id: string) => void;
  /** "button": the desktop hover button (asks first). "swipe": a committed mobile swipe. */
  onDelete: (id: string, via: "button" | "swipe") => void;
  /** open the enquiry in the side panel */
  onOpen: (id: string) => void;
};

// Converted isn't picked from the menu: the Turn into lead button sets it
const STATUS_ORDER: OpportunityStatus[] = ["new", "contacted", "bad"];

const STATUS_CONFIG: Record<OpportunityStatus, { label: string; className: string }> = {
  new: { label: "New", className: styles.statusNew },
  contacted: { label: "Contacted", className: styles.statusContacted },
  converted: { label: "Lead", className: styles.statusQualified },
  bad: { label: "Bad", className: styles.statusBad },
};

const subscribeNoop = () => () => {};

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

export default function InquiryCard({ inquiry, onStatusChange, onSeen, onDelete, onOpen }: InquiryCardProps) {
  const [isHovered, setIsHovered] = useState(false);
  const [showStatusMenu, setShowStatusMenu] = useState(false);
  const [showStatusPanel, setShowStatusPanel] = useState(false);
  const isMobile = useMediaQuery("(max-width: 768px)");
  // true only in the browser, so the status sheet's portal never renders on the server
  const mounted = useSyncExternalStore(subscribeNoop, () => true, () => false);
  const router = useRouter();
  const lead = embeddedLead(inquiry.leads);

  const {
    rowRef: swipeRowRef,
    cardRef: swipeCardRef,
    actionRef: swipeActionRef,
    open: swipeOpen,
    armed: swipeArmed,
    close: closeSwipe,
    commit: commitSwipe,
    consumeSwipe,
  } = useSwipeToDelete({
    enabled: isMobile,
    onCommit: () => onDelete(inquiry.id, "swipe"),
  });


  


  // Prevent scrolling when panel is open
  useEffect(() => {
    if (!showStatusPanel) return;

    const preventScroll = (e: TouchEvent) => {
      // Allow scrolling inside the panel content area
      const target = e.target as HTMLElement;
      if (target.closest(`.${styles.panelContent}`)) {
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
    // the click that ends a sideways swipe, or a tap on an open row, just closes it
    if (consumeSwipe()) return;
    if (swipeOpen) {
      closeSwipe();
      return;
    }
    if (showNewDot) onSeen(inquiry.id);
    onOpen(inquiry.id);
  };

  const openLead = (e: React.MouseEvent) => {
    e.stopPropagation();
    if (lead) router.push(leadHref(lead.id));
  };

  const handleStatusClick = (e: React.MouseEvent) => {
    e.stopPropagation(); // ✅ don't mark seen when opening status menu

    // a converted enquiry's status is its lead, so the badge opens the lead
    if (lead) return openLead(e);

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
      <div ref={swipeRowRef} className={styles.swipeRow}>
      {isMobile && (
        <div
          ref={swipeActionRef}
          className={`${styles.swipeAction} ${swipeArmed ? styles.swipeActionArmed : ""}`}
        >
          <button
            type="button"
            className={styles.swipeDeleteBtn}
            onClick={(e) => {
              e.stopPropagation();
              commitSwipe();
            }}
            tabIndex={swipeOpen ? 0 : -1}
            aria-hidden={!swipeOpen}
          >
            <HiTrash size={20} />
            <span>Delete</span>
          </button>
        </div>
      )}
      <article
        ref={swipeCardRef}
        // fades in softly when the cards replace their skeletons, or a new enquiry arrives (globals.css)
        className={`${styles.card} blur-in-soft`}
        onClick={handleCardClick}
        onMouseEnter={() => setIsHovered(true)}
        onMouseLeave={() => {
          setIsHovered(false);
          setShowStatusMenu(false);
        }}
        role="button"
        tabIndex={0}
        aria-haspopup="dialog"
        onKeyDown={(e) => {
          if (e.target !== e.currentTarget) return;
          if (e.key === "Enter" || e.key === " ") {
            e.preventDefault();
            handleCardClick();
          }
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
                  title={lead ? "Open lead" : "Click to change status"}
                  type="button"
                  aria-expanded={lead ? undefined : showStatusMenu || showStatusPanel}
                  aria-haspopup={lead ? undefined : "listbox"}
                >
                  {lead && <HiMiniBolt size={12} />}
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
                onClick={(e) => e.stopPropagation()} 
              >
                <span>{inquiry.email}</span>
              </a>
            )}
            {inquiry.phone && (
              <a
                href={`tel:${inquiry.phone}`}
                className={styles.contactLink}
                onClick={(e) => e.stopPropagation()} 
              >
                <span>{inquiry.phone}</span>
              </a>
            )}
          </div>

          {/* Message */}
          {inquiry.message && (
            <div className={styles.messageBlock}>
              <p className={styles.message}>{inquiry.message}</p>
            </div>
          )}

          {/* Tags Row */}
          {hasTags && (
            <div className={styles.tagsRow}>
              {inquiry.selected_package && (
                <span className={`${styles.tag} ${styles.tagPackage}`}>
                  <HiMiniCube size={18} />
                  {inquiry.selected_package}
                </span>
              )}
              {inquiry.budget != null && (
                <span className={`${styles.tag} ${styles.tagBudget}`}>
                  <HiCurrencyPound size={18} />
                  {formatBudget(inquiry.budget)}
                </span>
              )}
              {inquiry.source_page && (
                <span className={`${styles.tag} ${styles.tagSource}`}>
                  <HiMiniWindow size={18} />
                  {inquiry.source_page}
                </span>
              )}
            </div>
          )}
        </div>

        {/* Desktop: appears on hover, asks before deleting */}
        <button
          type="button"
          className={styles.hoverDelete}
          onClick={(e) => {
            e.stopPropagation();
            onDelete(inquiry.id, "button");
          }}
          aria-label={`Delete ${inquiry.name || "enquiry"}`}
          title="Delete enquiry"
        >
          <HiOutlineTrash size={16} />
        </button>
      </article>
      </div>

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

            {/* Scrollable Content */}
            <div className={styles.panelContent}>
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
                        <HiMiniCube size={22} />
                        {inquiry.selected_package}
                      </span>
                    )}
                    {inquiry.budget != null && (
                      <span className={styles.panelInquiryTag}>
                        <HiCurrencyPound size={24} />
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
          </div>
        </>,
        document.body
      )}
    </>
  );
}