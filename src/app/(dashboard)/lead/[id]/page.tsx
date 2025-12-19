"use client";

import { useEffect, useMemo, useState, useRef } from "react";
import { createPortal } from "react-dom";
import { useRouter, useParams } from "next/navigation";
import styles from "../../homePage.module.css";
import leadStyles from "./leadPage.module.css";
import cardStyles from "../../../components/component-styles/inquiryCard.module.css";
import { useDashboard } from "@/src/app/context/dashboardContext";
import { supabase } from "../../../../lib/supabaseClient";
import {
  HiMiniWindow,
  HiCurrencyPound,
  HiMiniCube,
  HiChevronLeft,
  HiMiniEllipsisHorizontal,
  HiXMark,
  HiCheck,
} from "react-icons/hi2";
import {
  HiOutlineGlobeAlt,
  HiOutlineLink,
  HiOutlineCalendarDays,
  HiOutlineBuildingOffice2,
  HiOutlineUserGroup,
  HiOutlineShoppingBag,
  HiOutlineDocumentText,
  HiOutlinePuzzlePiece,
  HiOutlineRectangleStack,
  HiOutlineMagnifyingGlass,
  HiOutlineExclamationTriangle,
  HiOutlineArrowRightCircle,
  HiOutlineRocketLaunch,
  HiOutlinePencilSquare,
} from "react-icons/hi2";
import { useFitTextWidth } from "../../../hooks/useFitTextWidth";

/* =========================================================
   Types
========================================================= */

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

type Timeline =
  | "ASAP"
  | "1-2 weeks"
  | "2-4 weeks"
  | "1-2 months"
  | "3+ months"
  | "Not sure";

type Goal =
  | "More leads"
  | "Look premium"
  | "Improve conversion"
  | "Showcase work"
  | "Rank on Google"
  | "Faster site"
  | "Clear pricing"
  | "Launch MVP"
  | "Build credibility"
  | "User signups"
  | "Book demos"
  | "Local visibility"
  | "Stand out"
  | "Mobile-first"
  | "Refresh brand"
  | "Other";

type SelectedPackage = "Starter" | "Redesign" | "Lead System";
type ContentStatus = "Ready" | "Partly ready" | "Need help" | "Brand assets ready" | "Unknown";

type FormState = {
  timeline: Timeline;
  goals: Goal[];
  challenges: string;
  selected_package: SelectedPackage;
  websiteUrl: string;
  businessName: string;
  targetAudience: string;
  products: string;
  contentStatus: ContentStatus;
  pagesNeeded: string;
  seoPriority: "Low" | "Medium" | "High";
  integrations: string;
  nextSteps: string;
  meetingNotes: string;
};

/* =========================================================
   Status Config (shared with inquiryCard)
========================================================= */

const STATUS_ORDER: OpportunityStatus[] = ["new", "contacted", "won", "lost", "bad"];

const STATUS_CONFIG: Record<OpportunityStatus, { label: string; className: string }> = {
  new: { label: "New", className: cardStyles.statusNew },
  contacted: { label: "Contacted", className: cardStyles.statusContacted },
  won: { label: "Won", className: cardStyles.statusWon },
  lost: { label: "Lost", className: cardStyles.statusLost },
  bad: { label: "Bad", className: cardStyles.statusBad },
};

/* =========================================================
   Helpers
========================================================= */

function formatBudget(budget: number | null) {
  if (budget == null) return "—";
  if (budget >= 1000) return `£${(budget / 1000).toFixed(budget % 1000 === 0 ? 0 : 1)}k`;
  return `£${budget}`;
}

function formatDateTime(iso: string) {
  const d = new Date(iso);
  return d.toLocaleString("en-GB", {
    day: "2-digit",
    month: "short",
    year: "numeric",
    hour: "2-digit",
    minute: "2-digit",
  });
}

type MobileHeaderProps = {   
  name: string;   
  onBack: () => void; 
}; 

function MobileHeader({ name, onBack }: MobileHeaderProps) {
  return (     
    <header className={leadStyles.mobileHeader}>       
      <button          
        className={leadStyles.backButton}          
        onClick={onBack}         
        aria-label="Go back"       
      >         
        <HiChevronLeft size={30} />       
      </button>       
      <h1 className={leadStyles.mobileHeaderTitle}>{name}</h1>  
       <button          
        className={leadStyles.editButton}          
        aria-label="Edit inquiry details"       
      >         
        <HiMiniEllipsisHorizontal size={22} />
      </button>       
    </header>   
  ); 
}

/* =========================================================
   Page
========================================================= */

export default function LeadPage() {
  const router = useRouter();

  // ✅ Fix for Next 16: useParams instead of props.params
  const params = useParams<{ id: string }>();
  const id = params?.id;

  const [email, setEmail] = useState<string | null>(null);
  const [inquiry, setInquiry] = useState<BookingInquiry | null>(null);
  const [loading, setLoading] = useState(true);
  const [fetchError, setFetchError] = useState<string | null>(null);

  const [savedToast, setSavedToast] = useState<null | "draft">(null);

  // Status panel state
  const [showStatusMenu, setShowStatusMenu] = useState(false);
  const [showStatusPanel, setShowStatusPanel] = useState(false);
  const [isMobile, setIsMobile] = useState(false);
  const [mounted, setMounted] = useState(false);

  const { setActivePage, setPageTitle, setBreadcrumbs } = useDashboard();
  const nameRef = useFitTextWidth<HTMLHeadingElement>(inquiry?.name);

  // Note expandable
  const [noteExpanded, setNoteExpanded] = useState(false);
  const NOTE_TRUNCATE_LENGTH = 100;
  const isNoteLong = (inquiry?.message?.length ?? 0) > NOTE_TRUNCATE_LENGTH;
  
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
      const target = e.target as HTMLElement;
      if (target.closest(`.${cardStyles.panelContent}`)) {
        return;
      }
      e.preventDefault();
    };

    document.addEventListener("touchmove", preventScroll, { passive: false });
    
    return () => {
      document.removeEventListener("touchmove", preventScroll);
    };
  }, [showStatusPanel]);

  // Set page config on mount
  useEffect(() => {
    setActivePage("lead");
    setPageTitle("Lead");
    setBreadcrumbs([
      { label: "gios.build", href: "#" },
      { label: "Inbox", href: "/" },
      { label: inquiry?.name || "Lead" },
    ]);
  }, [setActivePage, setPageTitle, setBreadcrumbs, inquiry?.name]);

  const hasTags = Boolean(inquiry?.selected_package || inquiry?.budget != null || inquiry?.source_page);

  const initial: FormState | null = useMemo(() => {
    if (!inquiry) return null;

    // Map inquiry.selected_package to FormState selected_package
    const pkg = inquiry.selected_package ?? "";
    let inferredPackage: SelectedPackage = "Starter";
    if (pkg.toLowerCase().includes("redesign")) {
      inferredPackage = "Redesign";
    } else if (pkg.toLowerCase().includes("lead")) {
      inferredPackage = "Lead System";
    }

    return {
      timeline: "2-4 weeks",
      goals: [],
      challenges: "",
      selected_package: inferredPackage,
      websiteUrl: "",
      businessName: "",
      targetAudience: "",
      products: "",
      contentStatus: "Unknown",
      pagesNeeded: "",
      seoPriority: "Medium",
      integrations: "",
      nextSteps: "",
      meetingNotes: "",
    };
  }, [inquiry]);

  const [form, setForm] = useState<FormState | null>(null);

  useEffect(() => {
    if (!initial) return;
    setForm(initial);
  }, [initial]);

  const isDirty = useMemo(() => {
    if (!form || !initial) return false;
    return JSON.stringify(form) !== JSON.stringify(initial);
  }, [form, initial]);

  /* ---------------- Auth + Fetch ---------------- */

  useEffect(() => {
    let cancelled = false;

    async function boot() {
      setLoading(true);
      setFetchError(null);

      // must have a route param
      if (!id) {
        setLoading(false);
        setFetchError("Missing lead id in route.");
        return;
      }

      const { data: sessionData } = await supabase.auth.getSession();
      const sessionEmail = sessionData.session?.user?.email ?? null;

      if (!sessionEmail) {
        router.replace("/login");
        return;
      }

      if (cancelled) return;
      setEmail(sessionEmail);

      const { data, error } = await supabase
        .from("booking_inquiries")
        .select(
          "id, created_at, name, email, phone, selected_types, selected_package, budget, message, source_page, user_agent, opportunity_status, seen_at"
        )
        .eq("id", id)
        .single();

      if (cancelled) return;

      if (error) {
        setInquiry(null);
        setFetchError(error.message);
      } else {
        setInquiry(data as BookingInquiry);
      }

      setLoading(false);
    }

    boot();

    return () => {
      cancelled = true;
    };
  }, [id, router]);


  /* ---------------- Form helpers ---------------- */

  function update<K extends keyof FormState>(key: K, value: FormState[K]) {
    setForm((prev) => (prev ? { ...prev, [key]: value } : prev));
    setSavedToast(null);
  }

  function toggleGoal(goal: Goal) {
    setForm((prev) => {
      if (!prev) return prev;
      const has = prev.goals.includes(goal);
      return { ...prev, goals: has ? prev.goals.filter((g) => g !== goal) : [...prev.goals, goal] };
    });
    setSavedToast(null);
  }

  function saveDraftLocal() {
    if (!inquiry || !form) return;
    try {
      localStorage.setItem(`leadDraft:${inquiry.id}`, JSON.stringify(form));
      setSavedToast("draft");
      setTimeout(() => setSavedToast(null), 1400);
    } catch {}
  }

  function loadDraftLocal() {
    if (!inquiry) return;
    try {
      const raw = localStorage.getItem(`leadDraft:${inquiry.id}`);
      if (!raw) return;
      setForm(JSON.parse(raw) as FormState);
    } catch {}
  }

  function handleBack() {
    router.back();
  }

  /* ---------------- Status handlers ---------------- */

  const handleStatusClick = (e: React.MouseEvent) => {
    e.stopPropagation();
    
    if (isMobile) {
      setShowStatusPanel(true);
    } else {
      setShowStatusMenu((v) => !v);
    }
  };

  const handleStatusSelect = async (status: OpportunityStatus) => {
    if (!inquiry) return;

    // Optimistic update
    const prev = inquiry;
    setInquiry({ ...inquiry, opportunity_status: status });
    setShowStatusMenu(false);
    setShowStatusPanel(false);

    // Persist to database
    const { error } = await supabase
      .from("booking_inquiries")
      .update({ opportunity_status: status })
      .eq("id", inquiry.id);

    if (error) {
      // Rollback on error
      setInquiry(prev);
      setFetchError(error.message);
    }
  };

  const closePanel = () => {
    setShowStatusPanel(false);
  };

  /* ---------------- Loading / Error guards ---------------- */

  if (loading) {
    return (
      <>
        <div className={styles.canvas}>
          <div className={styles.pageHeader}>
            <h1 className={styles.pageTitle}>Loading lead…</h1>
          </div>
        </div>
      </>
    );
  }

  if (!inquiry) {
    return (
      <>
        <div className={styles.canvas}>
          <div className={styles.pageHeader}>
            <h1 className={styles.pageTitle}>Lead not found</h1>
          </div>

          {!!fetchError && (
            <div className={styles.errorBanner}>
              <span>{fetchError}</span>
            </div>
          )}

          <button className={leadStyles.smallBtn} type="button" onClick={handleBack}>
            Back
          </button>
        </div>
      </>
    );
  }

  if (!form || !initial) {
    return (
      <>
        <div className={styles.canvas}>
          <div className={styles.pageHeader}>
            <h1 className={styles.pageTitle}>Preparing form…</h1>
          </div>
        </div>
      </>
    );
  }

  /* =========================================================
     UI
  ========================================================= */

  const statusConfig = STATUS_CONFIG[inquiry.opportunity_status];

  return (
    <>
      {/* Mobile Header with back button */}
      <MobileHeader name={inquiry.name || "Unnamed lead"} onBack={handleBack} />
      
      <div className={styles.canvas}>
        <main className={leadStyles.layout}>
          <div className={leadStyles.card}>
            <div className={leadStyles.cardHeader}>
              <div className={leadStyles.cardNameRow}>
                <h1 ref={nameRef} className={leadStyles.cardName}>{inquiry.name || "Unnamed lead"}</h1>
                
                {/* Status Badge */}
                <div 
                  className={cardStyles.statusWrapper}
                  onMouseLeave={() => setShowStatusMenu(false)}
                >
                  <button
                    className={`${cardStyles.status} ${statusConfig.className}`}
                    onClick={handleStatusClick}
                    title="Click to change status"
                    type="button"
                    aria-expanded={showStatusMenu || showStatusPanel}
                    aria-haspopup="listbox"
                  >
                    {statusConfig.label}
                  </button>

                  {/* Status Dropdown - Desktop only */}
                  {showStatusMenu && !isMobile && (
                    <div className={cardStyles.statusMenu} role="listbox">
                      {STATUS_ORDER.map((status) => (
                        <button
                          key={status}
                          className={`${cardStyles.statusOption} ${STATUS_CONFIG[status].className} ${
                            status === inquiry.opportunity_status ? cardStyles.statusOptionActive : ""
                          }`}
                          onClick={(e) => {
                            e.stopPropagation();
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
              
              <span className={leadStyles.metaPill}>
                {formatDateTime(inquiry.created_at)}
              </span>
            </div>
            <div className={leadStyles.contacts}>
              {inquiry.email && (
                <a className={leadStyles.contactsLink} href={`mailto:${inquiry.email}`}>
                  {inquiry.email}
                </a>
              )}
              {inquiry.phone && (
                <a className={leadStyles.contactsLink} href={`tel:${inquiry.phone}`}>
                  {inquiry.phone}
                </a>
              )}
            </div>
            {!!inquiry.message && (
              <div className={leadStyles.noteBlock}>
                <p 
                  className={`${leadStyles.noteText} ${noteExpanded ? leadStyles.noteTextExpanded : ""}`}
                >
                  {inquiry.message}
                </p>
                {isNoteLong && (
                  <button 
                    className={leadStyles.seeMoreBtn}
                    onClick={() => setNoteExpanded(!noteExpanded)}
                    type="button"
                  >
                    {noteExpanded ? "See less" : "... See more"}
                  </button>
                )}
              </div>
            )}
            {hasTags && (
              <div className={leadStyles.tagsRow}>
                {inquiry.selected_package && (
                  <span className={`${leadStyles.tag} ${leadStyles.tagPackage}`}>
                    <HiMiniCube size={18} />
                    {inquiry.selected_package}
                  </span>
                )}
                {inquiry.budget != null && (
                  <span className={`${leadStyles.tag} ${leadStyles.tagBudget}`}>
                    <HiCurrencyPound size={18} />
                    {formatBudget(inquiry.budget)}
                  </span>
                )}
                {inquiry.source_page && (
                  <span className={`${leadStyles.tag} ${leadStyles.tagSource}`}>
                    <HiMiniWindow size={18} />
                    {inquiry.source_page}
                  </span>
                )}
              </div>
            )}
          </div>

          
            <div className={leadStyles.formCard}>
              <div className={leadStyles.formGrid}>
                <div className={leadStyles.formCardIn}>
                  <label className={leadStyles.label}>
                    <HiOutlineCalendarDays size={16} />
                    Timeline
                  </label>
                  <select
                    className={leadStyles.select}
                    value={form.timeline}
                    onChange={(e) => update("timeline", e.target.value as Timeline)}
                  >
                    {["ASAP", "1-2 weeks", "2-4 weeks", "1-2 months", "3+ months", "Not sure"].map((t) => (
                      <option key={t} value={t}>
                        {t}
                      </option>
                    ))}
                  </select>
                </div>

                <div className={leadStyles.formCardIn}>
                  <label className={leadStyles.label}>
                    <HiOutlineBuildingOffice2 size={16} />
                    Business Name
                  </label>
                  <input
                    className={leadStyles.input}
                    placeholder="Enter business name..."
                    value={form.businessName}
                    onChange={(e) => update("businessName", e.target.value)}
                  />
                </div>

                <div className={leadStyles.formCardIn}>
                  <label className={leadStyles.label}>
                    <HiOutlineGlobeAlt size={16} />
                    Selected Package
                  </label>
                  <select
                    className={leadStyles.select}
                    value={form.selected_package}
                    onChange={(e) => update("selected_package", e.target.value as SelectedPackage)}
                  >
                    {["Starter", "Redesign", "Lead System"].map((v) => (
                      <option key={v} value={v}>
                        {v}
                      </option>
                    ))}
                  </select>
                </div>

                <div className={leadStyles.formCardIn}>
                  <label className={leadStyles.label}>
                    <HiOutlineLink size={16} />
                    Current site URL
                  </label>
                  <input
                    className={leadStyles.input}
                    placeholder="https://..."
                    value={form.websiteUrl}
                    onChange={(e) => update("websiteUrl", e.target.value)}
                  />
                </div>

                <div className={leadStyles.formCardIn}>
                  <label className={leadStyles.label}>
                    <HiOutlineShoppingBag size={16} />
                    Products
                  </label>
                  <input
                    className={leadStyles.input}
                    placeholder="What products/services do they offer?"
                    value={form.products}
                    onChange={(e) => update("products", e.target.value)}
                  />
                </div>

                <div className={leadStyles.formCardIn}>
                  <label className={leadStyles.label}>
                    <HiOutlineUserGroup size={16} />
                    Target Audience
                  </label>
                  <input
                    className={leadStyles.input}
                    placeholder="Who are their ideal customers?"
                    value={form.targetAudience}
                    onChange={(e) => update("targetAudience", e.target.value)}
                  />
                </div>

                <div className={leadStyles.formCardIn}>
                  <label className={leadStyles.label}>
                    <HiOutlineDocumentText size={16} />
                    Content status
                  </label>
                  <select
                    className={leadStyles.select}
                    value={form.contentStatus}
                    onChange={(e) => update("contentStatus", e.target.value as ContentStatus)}
                  >
                    {["Ready", "Partly ready", "Need help", "Brand assets ready", "Unknown"].map((v) => (
                      <option key={v} value={v}>
                        {v}
                      </option>
                    ))}
                  </select>
                </div>

                <div className={leadStyles.formCardIn}>
                  <label className={leadStyles.label}>
                    <HiOutlinePuzzlePiece size={16} />
                    Integrations
                  </label>
                  <input
                    className={leadStyles.input}
                    placeholder="Calendly, Stripe, Newsletter, CRM, Analytics..."
                    value={form.integrations}
                    onChange={(e) => update("integrations", e.target.value)}
                  />
                </div>

                <div className={leadStyles.formCardIn}>
                  <label className={leadStyles.label}>
                    <HiOutlineRectangleStack size={16} />
                    Pages / sections needed
                  </label>
                  <input
                    className={leadStyles.input}
                    placeholder="Home, About, Services, Work, Contact, Pricing..."
                    value={form.pagesNeeded}
                    onChange={(e) => update("pagesNeeded", e.target.value)}
                  />
                </div>

                <div className={leadStyles.formCardIn}>
                  <label className={leadStyles.label}>
                    <HiOutlineMagnifyingGlass size={16} />
                    SEO priority
                  </label>
                  <select
                    className={leadStyles.select}
                    value={form.seoPriority}
                    onChange={(e) => update("seoPriority", e.target.value as FormState["seoPriority"])}
                  >
                    {["Low", "Medium", "High"].map((v) => (
                      <option key={v} value={v}>
                        {v}
                      </option>
                    ))}
                  </select>
                </div>

                <div className={leadStyles.formCardIn}>
                  <label className={leadStyles.label}>
                    <HiOutlineExclamationTriangle size={16} />
                    Challenges / blockers
                  </label>
                  <textarea
                    className={leadStyles.textarea}
                    placeholder="What's not working today? What's stopping you from converting?"
                    value={form.challenges}
                    onChange={(e) => update("challenges", e.target.value)}
                    rows={4}
                  />
                </div>

                <div className={leadStyles.formCardIn}>
                  <label className={leadStyles.label}>
                    <HiOutlineArrowRightCircle size={16} />
                    Next steps
                  </label>
                  <textarea
                    className={leadStyles.textarea}
                    placeholder="Agree a call, request assets, send proposal, book build slot..."
                    value={form.nextSteps}
                    onChange={(e) => update("nextSteps", e.target.value)}
                    rows={3}
                  />
                </div>
              </div>
            </div>

            <div className={leadStyles.formCardIn}>
              <label className={leadStyles.label}>
                <HiOutlineRocketLaunch size={16} />
                Goals (pick what applies)
              </label>
              <div className={leadStyles.chips}>
                {(
                  [
                    "More leads",
                    "Look premium",
                    "Improve conversion",
                    "Showcase work",
                    "Rank on Google",
                    "Faster site",
                    "Clear pricing",
                    "Launch MVP",
                    "Build credibility",
                    "User signups",
                    "Book demos",
                    "Local visibility",
                    "Stand out",
                    "Mobile-first",
                    "Refresh brand",
                    "Other",
                  ] as Goal[]
                ).map((g) => {
                  const active = form.goals.includes(g);
                  return (
                    <button
                      key={g}
                      type="button"
                      className={`${leadStyles.chip} ${active ? leadStyles.chipActive : ""}`}
                      onClick={() => toggleGoal(g)}
                    >
                      {g}
                    </button>
                  );
                })}
              </div>
            </div>

            {/* Meeting notes */}
            <div className={leadStyles.formCardIn}>
              <label className={leadStyles.label}>
                <HiOutlinePencilSquare size={16} />
                Meeting notes
              </label>
              <textarea
                className={leadStyles.textarea}
                placeholder={`Example:\n- Goal: more leads from mobile\n- Pain: site feels outdated + slow\n- Must have: pricing page + enquiry funnel\n- Timeline: wants it live before <date>\n`}
                value={form.meetingNotes}
                onChange={(e) => update("meetingNotes", e.target.value)}
                rows={9}
              />
            </div>

            <div className={leadStyles.bottomRow}>
              <button className={leadStyles.smallBtn} type="button" onClick={saveDraftLocal}>
                Save
              </button>
                <button className={leadStyles.smallBtnPrimary} type="button" onClick={saveDraftLocal}>
                Qualify
              </button>
            </div>
          
        </main>
      </div>

      {/* Status Bottom Sheet Panel - Mobile only (rendered via Portal) */}
      {mounted && createPortal(
        <>
          {/* Backdrop */}
          <div
            className={`${cardStyles.panelBackdrop} ${showStatusPanel ? cardStyles.panelBackdropVisible : ""}`}
            onClick={(e) => {
              e.stopPropagation();
              closePanel();
            }}
            onTouchMove={(e) => e.preventDefault()}
            aria-hidden="true"
          />

          {/* Panel */}
          <div
            className={`${cardStyles.statusPanel} ${showStatusPanel ? cardStyles.statusPanelOpen : ""}`}
            role="dialog"
            aria-modal="true"
            aria-label="Change status"
            onClick={(e) => e.stopPropagation()}
          >
            {/* Handle */}
            <div className={cardStyles.panelHandle}>
              <div className={cardStyles.panelHandleBar} />
            </div>

            {/* Header */}
            <div className={cardStyles.panelHeader}>
              <h2 className={cardStyles.panelTitle}>Update Status</h2>
              <button
                className={cardStyles.panelCloseButton}
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
            <div className={cardStyles.panelContent}>
              {/* Inquiry Info */}
              <div className={cardStyles.panelInquiryInfo}>
                <span className={cardStyles.panelInquiryName}>{inquiry.name || "Unnamed"}</span>
                {inquiry.email && (
                  <span className={cardStyles.panelInquiryEmail}>{inquiry.email}</span>
                )}
                {(inquiry.selected_package || inquiry.budget != null) && (
                  <div className={cardStyles.panelInquiryMeta}>
                    {inquiry.selected_package && (
                      <span className={cardStyles.panelInquiryTag}>
                        <HiMiniCube size={22} />
                        {inquiry.selected_package}
                      </span>
                    )}
                    {inquiry.budget != null && (
                      <span className={cardStyles.panelInquiryTag}>
                        <HiCurrencyPound size={24} />
                        {formatBudget(inquiry.budget)}
                      </span>
                    )}
                  </div>
                )}
              </div>

              {/* Status Options */}
              <div className={cardStyles.panelOptions} role="listbox">
                {STATUS_ORDER.map((status) => {
                  const config = STATUS_CONFIG[status];
                  const isActive = status === inquiry.opportunity_status;
                  
                  return (
                    <button
                      key={status}
                      className={`${cardStyles.panelOption} ${config.className} ${isActive ? cardStyles.panelOptionActive : ""}`}
                      onClick={(e) => {
                        e.stopPropagation();
                        handleStatusSelect(status);
                      }}
                      role="option"
                      aria-selected={isActive}
                    >
                      <span className={cardStyles.panelOptionLabel}>
                        {config.label}
                      </span>
                      {isActive && (
                        <HiCheck size={20} className={cardStyles.panelOptionCheck} />
                      )}
                    </button>
                  );
                })}
              </div>

              {/* Footer spacer for safe area */}
              <div className={cardStyles.panelFooter} />
            </div>
          </div>
        </>,
        document.body
      )}
    </>
  );
}