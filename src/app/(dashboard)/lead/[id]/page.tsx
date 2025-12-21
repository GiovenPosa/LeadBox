"use client";

import { useEffect, useMemo, useState } from "react";
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
  HiOutlinePlusCircle,
  HiOutlineMinusCircle,
  HiChevronDown,
  HiChevronUp,
  HiMiniArrowUp,
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
  HiOutlinePaperClip,
} from "react-icons/hi2";
import { useFitTextWidth } from "../../../hooks/useFitTextWidth";
import QualifiedSummary, {
  type FormState,
  type Timeline,
  type Goal,
  type SelectedPackage,
  type ContentStatus,
} from "../../../components/qualifiedSummary";
import LeadPageSkeleton from "./skeletons/leadPageSkeleton";

/* =========================================================
   Types
========================================================= */

export type OpportunityStatus = "new" | "contacted" | "qualified" | "won" | "lost" | "bad";

export type CarouselTab = "qualification" | "proposal" | "onboarding";

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

type LeadQualificationStatus = "draft" | "qualified";

type LeadQualificationRow = {
  inquiry_id: string;
  qualified_by: string;
  status: LeadQualificationStatus;
  form_data: FormState;
  qualified_at: string | null;
  updated_at: string;
};

/* =========================================================
   Status Config
========================================================= */

const STATUS_ORDER: OpportunityStatus[] = ["new", "contacted", "qualified", "won", "lost", "bad"];

const STATUS_CONFIG: Record<
  OpportunityStatus,
  { label: string; className: string }
> = {
  new: { label: "New", className: cardStyles.statusNew },
  contacted: { label: "Contacted", className: cardStyles.statusContacted },
  qualified: { label: "Qualified", className: cardStyles.statusQualified },
  won: { label: "Won", className: cardStyles.statusWon },
  lost: { label: "Lost", className: cardStyles.statusLost },
  bad: { label: "Bad", className: cardStyles.statusBad },
};

/* =========================================================
   Helpers
========================================================= */

function formatBudget(budget: number | null) {
  if (budget == null) return "—";
  if (budget >= 1000)
    return `£${(budget / 1000).toFixed(budget % 1000 === 0 ? 0 : 1)}k`;
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
        <HiChevronLeft size={26} />
        <h1 className={leadStyles.mobileHeaderTitle}>{name}</h1>
      </button>
      <button className={leadStyles.editButton} aria-label="Edit inquiry details">
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
  const params = useParams<{ id: string }>();
  const id = params?.id;

  const [email, setEmail] = useState<string | null>(null);
  const [userId, setUserId] = useState<string | null>(null);

  const [inquiry, setInquiry] = useState<BookingInquiry | null>(null);
  const [qualification, setQualification] = useState<LeadQualificationRow | null>(null);

  const [loading, setLoading] = useState(true);
  const [fetchError, setFetchError] = useState<string | null>(null);

  const [saving, setSaving] = useState(false);
  const [qualifying, setQualifying] = useState(false);

  const [toast, setToast] = useState<null | "draft" | "qualified">(null);

  // Form expanded state - for new/unqualified leads
  const [isFormExpanded, setIsFormExpanded] = useState(false);
  // Edit mode - for qualified leads wanting to edit
  const [isEditMode, setIsEditMode] = useState(false);
  
  // Carousel tab state
  const [activeTab, setActiveTab] = useState<CarouselTab>("qualification");

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

  useEffect(() => setMounted(true), []);

  useEffect(() => {
    const checkMobile = () => setIsMobile(window.innerWidth <= 768);
    checkMobile();
    window.addEventListener("resize", checkMobile);
    return () => window.removeEventListener("resize", checkMobile);
  }, []);

  useEffect(() => {
    if (!showStatusPanel) return;

    const preventScroll = (e: TouchEvent) => {
      const target = e.target as HTMLElement;
      if (target.closest(`.${cardStyles.panelContent}`)) return;
      e.preventDefault();
    };

    document.addEventListener("touchmove", preventScroll, { passive: false });
    return () => document.removeEventListener("touchmove", preventScroll);
  }, [showStatusPanel]);

  useEffect(() => {
    setActivePage("lead");
    setPageTitle("Lead");
    setBreadcrumbs([
      { label: "gios.build", href: "#" },
      { label: "Inbox", href: "/" },
      { label: inquiry?.name || "Lead" },
    ]);
  }, [setActivePage, setPageTitle, setBreadcrumbs, inquiry?.name]);

  const hasTags = Boolean(
    inquiry?.selected_package || inquiry?.budget != null || inquiry?.source_page
  );

  // Determine if this lead is already qualified
  const isAlreadyQualified = qualification?.status === "qualified";
  
  // Show form if: expanded by user OR editing a qualified lead
  const showForm = isFormExpanded || isEditMode;
  
  // Show summary if: qualified and not editing
  const showSummary = isAlreadyQualified && !isEditMode;

  // Build a base default initial, then override with saved qualification.form_data if it exists.
  const initial: FormState | null = useMemo(() => {
    if (!inquiry) return null;

    const pkg = inquiry.selected_package ?? "";
    let inferredPackage: SelectedPackage = "Starter";
    if (pkg.toLowerCase().includes("redesign")) inferredPackage = "Redesign";
    else if (pkg.toLowerCase().includes("lead")) inferredPackage = "Lead System";

    const base: FormState = {
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

    // If we already have saved/qualified data, use it as the initial.
    if (qualification?.form_data) {
      return {
        ...base,
        ...qualification.form_data,
        selected_package: qualification.form_data.selected_package ?? base.selected_package,
        goals: qualification.form_data.goals ?? [],
      };
    }

    return base;
  }, [inquiry, qualification]);

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

      if (!id) {
        setLoading(false);
        setFetchError("Missing lead id in route.");
        return;
      }

      const { data: sessionData } = await supabase.auth.getSession();
      const session = sessionData.session;
      const sessionEmail = session?.user?.email ?? null;
      const sessionUserId = session?.user?.id ?? null;

      if (!sessionEmail || !sessionUserId) {
        router.replace("/login");
        return;
      }

      if (cancelled) return;
      setEmail(sessionEmail);
      setUserId(sessionUserId);

      const { data: inquiryData, error: inquiryErr } = await supabase
        .from("booking_inquiries")
        .select(
          "id, created_at, name, email, phone, selected_types, selected_package, budget, message, source_page, user_agent, opportunity_status, seen_at"
        )
        .eq("id", id)
        .single();

      if (cancelled) return;

      if (inquiryErr) {
        setInquiry(null);
        setQualification(null);
        setFetchError(inquiryErr.message);
        setLoading(false);
        return;
      }

      setInquiry(inquiryData as BookingInquiry);

      // Pull saved qualification (draft/qualified) if exists
      const { data: qualData, error: qualErr } = await supabase
        .from("lead_qualifications")
        .select("inquiry_id, qualified_by, status, form_data, qualified_at, updated_at")
        .eq("inquiry_id", id)
        .maybeSingle();

      if (cancelled) return;

      if (qualErr) {
        setFetchError(qualErr.message);
        setQualification(null);
      } else {
        setQualification((qualData as LeadQualificationRow) ?? null);
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
    setToast(null);
  }

  function toggleGoal(goal: Goal) {
    setForm((prev) => {
      if (!prev) return prev;
      const has = prev.goals.includes(goal);
      return {
        ...prev,
        goals: has ? prev.goals.filter((g) => g !== goal) : [...prev.goals, goal],
      };
    });
    setToast(null);
  }

  function handleBack() {
    router.back();
  }

  function showToast(kind: "draft" | "qualified") {
    setToast(kind);
    window.setTimeout(() => setToast(null), 1400);
  }

  function handleToggleForm() {
    setIsFormExpanded((prev) => !prev);
  }

  function handleEditQualification() {
    setIsEditMode(true);
  }

  function handleCancelEdit() {
    setIsEditMode(false);
    // Reset form to initial state
    if (initial) setForm(initial);
  }

  /* ---------------- Supabase persistence ---------------- */

  async function upsertQualification(nextStatus: LeadQualificationStatus) {
    if (!inquiry || !form || !userId) return;

    const nowIso = new Date().toISOString();

    const payload = {
      inquiry_id: inquiry.id,
      qualified_by: userId,
      status: nextStatus,
      form_data: form,
      qualified_at: nextStatus === "qualified" ? nowIso : null,
      updated_at: nowIso,
    };

    const { data, error } = await supabase
      .from("lead_qualifications")
      .upsert(payload, { onConflict: "inquiry_id" })
      .select("inquiry_id, qualified_by, status, form_data, qualified_at, updated_at")
      .single();

    if (error) throw error;

    setQualification(data as LeadQualificationRow);
  }

  async function saveDraftRemote() {
    if (!inquiry || !form) return;
    setSaving(true);
    setFetchError(null);

    try {
      await upsertQualification("draft");
      showToast("draft");
    } catch (e: any) {
      setFetchError(e?.message ?? "Failed to save draft.");
    } finally {
      setSaving(false);
    }
  }

  async function qualifyRemote() {
    if (!inquiry || !form) return;
    setQualifying(true);
    setFetchError(null);

    try {
      await upsertQualification("qualified");

      const { error: statusErr } = await supabase
        .from("booking_inquiries")
        .update({ opportunity_status: "qualified" })
        .eq("id", inquiry.id);

      if (statusErr) throw statusErr;

      setInquiry((prev) => (prev ? { ...prev, opportunity_status: "qualified" } : prev));
      
      // Exit edit mode and collapse form after qualifying
      setIsEditMode(false);
      setIsFormExpanded(false);

      showToast("qualified");
    } catch (e: any) {
      setFetchError(e?.message ?? "Failed to qualify lead.");
    } finally {
      setQualifying(false);
    }
  }

  /* ---------------- Status handlers ---------------- */

  const handleStatusClick = (e: React.MouseEvent) => {
    e.stopPropagation();
    if (isMobile) setShowStatusPanel(true);
    else setShowStatusMenu((v) => !v);
  };

  const handleStatusSelect = async (status: OpportunityStatus) => {
    if (!inquiry) return;

    const prev = inquiry;
    setInquiry({ ...inquiry, opportunity_status: status });
    setShowStatusMenu(false);
    setShowStatusPanel(false);

    const { error } = await supabase
      .from("booking_inquiries")
      .update({ opportunity_status: status })
      .eq("id", inquiry.id);

    if (error) {
      setInquiry(prev);
      setFetchError(error.message);
    }
  };

  const closePanel = () => setShowStatusPanel(false);

  /* ---------------- Loading / Error guards ---------------- */

  if (loading) {
    return (
      <>
        <MobileHeader name={"Inbox"} onBack={handleBack} />
        <div className={styles.canvas}>
          <LeadPageSkeleton />
        </div>
      </>
    );
  }

  if (!inquiry) {
    return (
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
    );
  }

  if (!form || !initial) {
    return (
      <div className={styles.canvas}>
        <div className={styles.pageHeader}>
          <h1 className={styles.pageTitle}>Preparing form…</h1>
        </div>
      </div>
    );
  }

  /* =========================================================
     UI
  ========================================================= */

  const statusConfig = STATUS_CONFIG[inquiry.opportunity_status];

  return (
    <>
      <MobileHeader name={"Inbox"} onBack={handleBack} />

      <div className={styles.canvas}>
        <main className={leadStyles.layout}>
          {!!fetchError && (
            <div className={styles.errorBanner}>
              <span>{fetchError}</span>
            </div>
          )}

          {/* Lead Header Card */}
          <div className={leadStyles.card}>
            <div className={leadStyles.cardHeader}>
              <div className={leadStyles.cardNameRow}>
                <h1 ref={nameRef} className={leadStyles.cardName}>
                  {inquiry.name || "Unnamed lead"}
                </h1>

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

              <span className={leadStyles.metaPill}>{formatDateTime(inquiry.created_at)}</span>
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
                  className={`${leadStyles.noteText} ${
                    noteExpanded ? leadStyles.noteTextExpanded : ""
                  }`}
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

          <div className={leadStyles.carouselRow}>
            <button
              className={`${leadStyles.carouselItem} ${activeTab === "qualification" ? leadStyles.carouselItemActive : ""}`}
              onClick={() => setActiveTab("qualification")}
              type="button"
            >
              Qualification
            </button>
            <button
              className={`${leadStyles.carouselItem} ${activeTab === "proposal" ? leadStyles.carouselItemActive : ""}`}
              onClick={() => setActiveTab("proposal")}
              type="button"
            >
              Proposal
            </button>
            <button
              className={`${leadStyles.carouselItem} ${activeTab === "onboarding" ? leadStyles.carouselItemActive : ""}`}
              onClick={() => setActiveTab("onboarding")}
              type="button"
            >
              Onboarding
            </button>
          </div>

          {/* Qualification Tab Content */}
          {activeTab === "qualification" && (
            <>
              {/* Qualified Summary View */}
              {showSummary && (
                <QualifiedSummary
                  form={form}
                  qualifiedAt={qualification?.qualified_at ?? null}
                  onEdit={handleEditQualification}
                />
              )}

              {/* Add Qualification Button (for new/unqualified leads) */}
              {!showSummary && !showForm && (
                <button
                  className={leadStyles.addQualificationBtn}
                  onClick={handleToggleForm}
                  type="button"
                >
                  <HiOutlinePlusCircle size={20} />
                  <span>Add Qualification</span>
                  {qualification?.status === "draft" && (
                    <span className={leadStyles.draftLabel}>Draft</span>
                  )}
                </button>
              )}
            </>
          )}

          {/* Proposal Tab Content */}
          {activeTab === "proposal" && (
            <button
              className={leadStyles.addQualificationBtn}
              onClick={() => {/* TODO: Add proposal form */}}
              type="button"
            >
              <HiOutlinePlusCircle size={20} />
              <span>Add Proposal</span>
            </button>
          )}

          {/* Onboarding Tab Content */}
          {activeTab === "onboarding" && (
            <button
              className={leadStyles.addQualificationBtn}
              onClick={() => {/* TODO: Add onboarding form */}}
              type="button"
            >
              <HiOutlinePlusCircle size={20} />
              <span>Add Onboarding</span>
            </button>
          )}

          {/* Qualification Form (expanded or edit mode) */}
          {activeTab === "qualification" && showForm && (
            <div className={leadStyles.formCard}>
              <div className={leadStyles.topRow}>
                <button
                  className={leadStyles.formCardHeader}
                  onClick={isEditMode ? handleCancelEdit : handleToggleForm}
                  type="button"
                >
                  {isEditMode ? (
                    <HiXMark size={18} />
                  ) : isFormExpanded ? (
                    <HiOutlineMinusCircle size={20} />
                  ) : (
                    <HiOutlinePlusCircle size={20} />
                  )}
                  <h2 className={leadStyles.formCardTitle}>
                    {isEditMode ? "Edit Qualification" : "Add Qualification"}
                  </h2>
                  {qualification?.status === "draft" && (
                    <span className={leadStyles.draftTitle}>Draft</span>
                  )}
                </button>
                <div className={leadStyles.rightButtons}>
                  {isDirty && (
                    <button
                      className={leadStyles.smallBtn}
                      type="button"
                      onClick={saveDraftRemote}
                      disabled={saving || qualifying}
                      >
                      {saving ? "Saving…" : "Save"}
                    </button>
                  )} 
                  <button
                    className={leadStyles.smallBtnPrimary}
                    type="button"
                    onClick={qualifyRemote}
                    disabled={saving || qualifying}
                    title={isAlreadyQualified ? "Update qualification" : "Qualify this lead"}
                  >
                  <HiMiniArrowUp size={20}/>
                  </button>
                </div>
              </div>

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
                    {["ASAP", "1-2 weeks", "2-4 weeks", "1-2 months", "3+ months", "Not sure"].map(
                      (t) => (
                        <option key={t} value={t}>
                          {t}
                        </option>
                      )
                    )}
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
                    onChange={(e) =>
                      update("selected_package", e.target.value as SelectedPackage)
                    }
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
                    {["Ready", "Partly ready", "Need help", "Brand assets ready", "Unknown"].map(
                      (v) => (
                        <option key={v} value={v}>
                          {v}
                        </option>
                      )
                    )}
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
                    onChange={(e) =>
                      update("seoPriority", e.target.value as FormState["seoPriority"])
                    }
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

              <div className={leadStyles.formGridBot} >
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

                <div className={leadStyles.formCardIn}>
                  <label className={leadStyles.label}>
                    <HiOutlinePaperClip size={16} />
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
              </div>
             
            </div>
          )}

          {!!toast && (
            <div className={leadStyles.toast}>
              {toast === "draft" ? "Saved" : "Qualified ✓"}
            </div>
          )}
        </main>
      </div>

      {/* Status Bottom Sheet Panel - Mobile only */}
      {mounted &&
        createPortal(
          <>
            <div
              className={`${cardStyles.panelBackdrop} ${
                showStatusPanel ? cardStyles.panelBackdropVisible : ""
              }`}
              onClick={(e) => {
                e.stopPropagation();
                closePanel();
              }}
              onTouchMove={(e) => e.preventDefault()}
              aria-hidden="true"
            />

            <div
              className={`${cardStyles.statusPanel} ${
                showStatusPanel ? cardStyles.statusPanelOpen : ""
              }`}
              role="dialog"
              aria-modal="true"
              aria-label="Change status"
              onClick={(e) => e.stopPropagation()}
            >
              <div className={cardStyles.panelHandle}>
                <div className={cardStyles.panelHandleBar} />
              </div>

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

              <div className={cardStyles.panelContent}>
                <div className={cardStyles.panelInquiryInfo}>
                  <span className={cardStyles.panelInquiryName}>
                    {inquiry.name || "Unnamed"}
                  </span>
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

                <div className={cardStyles.panelOptions} role="listbox">
                  {STATUS_ORDER.map((status) => {
                    const config = STATUS_CONFIG[status];
                    const isActive = status === inquiry.opportunity_status;

                    return (
                      <button
                        key={status}
                        className={`${cardStyles.panelOption} ${config.className} ${
                          isActive ? cardStyles.panelOptionActive : ""
                        }`}
                        onClick={(e) => {
                          e.stopPropagation();
                          handleStatusSelect(status);
                        }}
                        role="option"
                        aria-selected={isActive}
                      >
                        <span className={cardStyles.panelOptionLabel}>{config.label}</span>
                        {isActive && (
                          <HiCheck size={20} className={cardStyles.panelOptionCheck} />
                        )}
                      </button>
                    );
                  })}
                </div>

                <div className={cardStyles.panelFooter} />
              </div>
            </div>
          </>,
          document.body
        )}
    </>
  );
}