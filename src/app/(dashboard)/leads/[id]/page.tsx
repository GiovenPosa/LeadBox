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
  HiOutlineTrash,
  HiMiniPaperAirplane,
  HiMiniMapPin,
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
import ContactHeader, { type ContactSummary } from "../../../components/contactHeader";
import { useDelayedFlag } from "../../../hooks/useDelayedFlag";
import NotesTimeline from "../../../components/notesTimeline";
import TaskList from "../../../components/taskList";
import { logActivity } from "../../../../lib/activity";
import { contactSaveError } from "../../../components/contactEditor";
import QualifiedSummary, {
  type FormState,
  type Timeline,
  type Goal,
  type SelectedPackage,
  type ContentStatus,
} from "../../../components/qualifiedSummary";
import LeadPageSkeleton from "./skeletons/leadPageSkeleton";
import Toast, { type ToastType } from "../../../components/toast";
import { Field, Select, TextArea, TextInput } from "../../../components/formFields";
import ConfirmDialog from "../../../components/confirmDialog";
import Button from "../../../components/button";
import { LEAD_STAGES, removeLead, type LeadStage } from "../../../../lib/leads";
import {
  OUTREACH_COLUMNS,
  channelLabel,
  formatShortDate,
  industryLabel,
  type OutreachRow,
} from "../../../../lib/outreach";
import { ChannelIcon } from "../../../components/channelIcon";

/* =========================================================
   Types
========================================================= */


export type CarouselTab = "qualification" | "proposal" | "onboarding" | "tasks" | "notes";

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
  seen_at: string | null;
};

type Lead = {
  id: string;
  stage: LeadStage;
  /** where the lead came from: an enquiry or an outreach business (or neither, later) */
  inquiry_id: string | null;
  outreach_id: string | null;
  contact_id: string | null;
};

type LeadQualificationStatus = "draft" | "qualified";

type LeadQualificationRow = {
  lead_id: string;
  inquiry_id: string | null;
  qualified_by: string;
  status: LeadQualificationStatus;
  form_data: FormState;
  qualified_at: string | null;
  updated_at: string;
};

/* =========================================================
   Status Config
========================================================= */

// The badge shows the lead's stage, in the inquiry card's status colours
const STATUS_ORDER: LeadStage[] = LEAD_STAGES.map((s) => s.value);

const STAGE_CLASS: Record<LeadStage, string> = {
  qualifying: cardStyles.statusNew,
  proposal: cardStyles.statusContacted,
  onboarding: cardStyles.statusQualified,
  won: cardStyles.statusWon,
  lost: cardStyles.statusLost,
};

const STATUS_CONFIG = Object.fromEntries(
  LEAD_STAGES.map((s) => [s.value, { label: s.label, className: STAGE_CLASS[s.value] }])
) as Record<LeadStage, { label: string; className: string }>;

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
  // a quick load skips the skeleton; the page just fades in
  const showSkeleton = useDelayedFlag(loading);
  const [fetchError, setFetchError] = useState<string | null>(null);

  const [saving, setSaving] = useState(false);
  const [qualifying, setQualifying] = useState(false);

  const [toast, setToast] = useState<ToastType>(null);

  const [confirmDelete, setConfirmDelete] = useState(false);
  const [lead, setLead] = useState<Lead | null>(null);
  const [contact, setContact] = useState<ContactSummary | null>(null);
  const [outreach, setOutreach] = useState<OutreachRow | null>(null);
  const [deleting, setDeleting] = useState(false);

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

  const leadName = contact?.name || inquiry?.name || outreach?.business_name || "Lead";

  useEffect(() => {
    setActivePage("lead");
    setPageTitle("Lead");
    setBreadcrumbs([
      { label: "gios.build", href: "#" },
      { label: "Leads", href: "/leads" },
      { label: leadName },
    ]);
  }, [setActivePage, setPageTitle, setBreadcrumbs, leadName]);

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
    if (!lead) return null;

    const pkg = inquiry?.selected_package ?? "";
    let inferredPackage: SelectedPackage = "Starter";
    if (pkg.toLowerCase().includes("redesign")) inferredPackage = "Redesign";
    else if (pkg.toLowerCase().includes("lead")) inferredPackage = "Lead System";

    const base: FormState = {
      timeline: "2-4 weeks",
      goals: [],
      challenges: "",
      selected_package: inferredPackage,
      websiteUrl: "",
      // the business name lives on the contact; the form shows and edits that one value
      businessName: contact?.business_name ?? "",
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
        // the contact's value wins; an older saved answer only fills a gap
        businessName: contact?.business_name || qualification.form_data.businessName || "",
      };
    }

    return base;
  }, [lead, inquiry, qualification, contact]);

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

      // The route has the lead's id; it came from an enquiry or an outreach business
      const { data: leadData, error: leadErr } = await supabase
        .from("leads")
        .select("id, stage, inquiry_id, outreach_id, contact_id")
        .eq("id", id)
        .maybeSingle();

      if (cancelled) return;

      if (leadErr || !leadData) {
        setFetchError(leadErr?.message ?? null);
        setLoading(false);
        return;
      }

      setLead(leadData as Lead);

      if (leadData.inquiry_id) {
        const { data: inquiryData, error: inquiryErr } = await supabase
          .from("booking_inquiries")
          .select(
            "id, created_at, name, email, phone, selected_types, selected_package, budget, message, source_page, user_agent, seen_at"
          )
          .eq("id", leadData.inquiry_id)
          .single();
        if (cancelled) return;
        if (inquiryErr) setFetchError(inquiryErr.message);
        else setInquiry(inquiryData as BookingInquiry);
      } else if (leadData.outreach_id) {
        const { data: outreachData } = await supabase
          .from("outreach")
          .select(OUTREACH_COLUMNS)
          .eq("id", leadData.outreach_id)
          .maybeSingle();
        if (cancelled) return;
        setOutreach((outreachData as OutreachRow | null) ?? null);
      }

      // The person behind the lead, and how many times they've been in touch
      if (leadData.contact_id) {
        const [contactRes, overviewRes] = await Promise.all([
          supabase
            .from("contacts")
            .select("id, name, email, phone_numbers, business_name, industry, created_at")
            .eq("id", leadData.contact_id)
            .maybeSingle(),
          supabase.from("contacts_overview").select("inquiry_count").eq("id", leadData.contact_id).maybeSingle(),
        ]);
        if (cancelled) return;
        if (contactRes.data) {
          setContact({ ...(contactRes.data as ContactSummary), inquiry_count: overviewRes.data?.inquiry_count });
        }
      }

      // Pull saved qualification (draft/qualified) if exists
      const { data: qualData, error: qualErr } = await supabase
        .from("lead_qualifications")
        .select("lead_id, inquiry_id, qualified_by, status, form_data, qualified_at, updated_at")
        .eq("lead_id", leadData.id)
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

  function handleToastComplete() {
    setToast(null);
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
    if (!lead || !form || !userId) return;

    const nowIso = new Date().toISOString();

    const payload = {
      lead_id: lead.id,
      inquiry_id: lead.inquiry_id,
      qualified_by: userId,
      status: nextStatus,
      form_data: form,
      qualified_at: nextStatus === "qualified" ? nowIso : null,
      updated_at: nowIso,
    };

    const { data, error } = await supabase
      .from("lead_qualifications")
      .upsert(payload, { onConflict: "lead_id" })
      .select("lead_id, inquiry_id, qualified_by, status, form_data, qualified_at, updated_at")
      .single();

    if (error) throw error;

    setQualification(data as LeadQualificationRow);
    await saveBusinessNameToContact();
  }

  // One business name per person: saving the form writes it to the contact,
  // so the Contacts list, the Leads table and the header all show it
  async function saveBusinessNameToContact() {
    if (!contact || !form) return;
    const next = form.businessName.trim() || null;
    if (next === (contact.business_name ?? null)) return;

    const { data, error } = await supabase
      .from("contacts")
      .update({ business_name: next })
      .eq("id", contact.id)
      .select("id");
    // no row back means row security blocked it without an error
    if (error || !data?.length) throw new Error(contactSaveError(error));
    setContact({ ...contact, business_name: next });
  }

  async function saveDraftRemote() {
    if (!lead || !form) return;
    setSaving(true);
    setFetchError(null);
    setToast("saving");  

    try {
      await upsertQualification("draft");
      setToast("saved");  
    } catch (e) {
      setFetchError((e as { message?: string } | null)?.message ?? "Failed to save draft.");
      setToast(null);  // Clear on error
    } finally {
      setSaving(false);
    }
  }

  async function qualifyRemote() {
    if (!lead || !form) return;
    setQualifying(true);
    setFetchError(null);
    setToast("qualifying"); 

    try {
      await upsertQualification("qualified");

      // qualified: a lead still in qualifying moves on to its proposal
      if (lead?.stage === "qualifying") {
        const { error: stageErr } = await supabase
          .from("leads")
          .update({ stage: "proposal" })
          .eq("id", lead.id);
        if (stageErr) throw stageErr;
        setLead({ ...lead, stage: "proposal" });
      }

      logActivity("lead.qualified", `${leadName} was qualified`, { lead_id: lead?.id, contact_id: lead?.contact_id });

      // Exit edit mode and collapse form after qualifying
      setIsEditMode(false);
      setIsFormExpanded(false);

      setToast("qualified");
    } catch (e) {
      setFetchError((e as { message?: string } | null)?.message ?? "Failed to qualify lead.");
      setToast(null);
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

  const handleStatusSelect = async (stage: LeadStage) => {
    if (!lead) return;

    const prev = lead;
    setLead({ ...lead, stage });
    setShowStatusMenu(false);
    setShowStatusPanel(false);

    const { error } = await supabase.from("leads").update({ stage }).eq("id", lead.id);

    if (error) {
      setLead(prev);
      setFetchError(error.message);
    } else if (prev.stage !== stage) {
      logActivity("lead.stage", `${leadName} moved to ${STATUS_CONFIG[stage].label}`, {
        lead_id: lead.id,
        contact_id: lead.contact_id,
      });
    }
  };

  const closePanel = () => setShowStatusPanel(false);

  /* ---------------- Delete ---------------- */

  // Removes the lead, not the enquiry: that goes back to Contacted in the Inbox
  async function deleteLead() {
    if (!lead) return;
    setDeleting(true);
    setFetchError(null);

    try {
      await removeLead(lead.id);
      router.replace("/leads");
    } catch (e) {
      setConfirmDelete(false);
      setFetchError(e instanceof Error ? e.message : "Couldn't remove this lead.");
      setDeleting(false);
    }
  }

  /* ---------------- Loading / Error guards ---------------- */

  if (loading) {
    return (
      <>
        <MobileHeader name={"Leads"} onBack={handleBack} />
        <div className={styles.canvas}>{showSkeleton && <LeadPageSkeleton />}</div>
      </>
    );
  }

  if (!lead) {
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

  const statusConfig = STATUS_CONFIG[lead.stage];

  // The lead's contact; before the leads_contact migration, the enquiry's own details
  const headerContact: ContactSummary = contact ?? {
    id: lead.id,
    name: inquiry?.name ?? outreach?.business_name ?? null,
    email: inquiry?.email ?? null,
    phone_numbers: inquiry?.phone ? [inquiry.phone] : [],
    business_name: outreach?.business_name ?? null,
    created_at: inquiry?.created_at ?? new Date().toISOString(),
  };

  const stageBadge = (
    <div
      className={cardStyles.statusWrapper}
      onMouseLeave={() => setShowStatusMenu(false)}
    >
      <button
        className={`${cardStyles.status} ${statusConfig.className}`}
        onClick={handleStatusClick}
        title="Click to change stage"
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
                status === lead.stage ? cardStyles.statusOptionActive : ""
              }`}
              onClick={(e) => {
                e.stopPropagation();
                handleStatusSelect(status);
              }}
              role="option"
              aria-selected={status === lead.stage}
            >
              {STATUS_CONFIG[status].label}
            </button>
          ))}
        </div>
      )}
    </div>
  );

  return (
    <>
      <Toast type={toast} onComplete={handleToastComplete} />
      <MobileHeader name={"Leads"} onBack={handleBack} />

      <div className={styles.canvas}>
        {/* fades in softly in place of the page skeleton (globals.css) */}
        <main className={`${leadStyles.layout} blur-in-soft`}>
          {!!fetchError && (
            <div className={styles.errorBanner}>
              <span>{fetchError}</span>
            </div>
          )}

          {/* Lead Header Card */}
          <div className={leadStyles.card}>
            <ContactHeader
              contact={headerContact}
              badge={stageBadge}
              aside={
                inquiry
                  ? `Received ${formatDateTime(inquiry.created_at)}`
                  : outreach
                    ? `First messaged ${formatShortDate(outreach.first_contacted_on)}`
                    : undefined
              }
            />

            {/* An outreach lead: the business you messaged, in place of an enquiry */}
            {outreach && (
              <>
                <div className={leadStyles.tagsRow}>
                  <span className={`${leadStyles.tag} ${leadStyles.tagPackage}`}>
                    <HiMiniPaperAirplane size={16} />
                    Outreach · {industryLabel(outreach.industry)}
                  </span>
                  <span className={`${leadStyles.tag} ${leadStyles.tagSource}`}>
                    <ChannelIcon channel={outreach.channel} />
                    {outreach.handle || channelLabel(outreach.channel)}
                  </span>
                  {outreach.town && (
                    <span className={`${leadStyles.tag} ${leadStyles.tagBudget}`}>
                      <HiMiniMapPin size={16} />
                      {outreach.town}
                    </span>
                  )}
                </div>
              </>
            )}

            {!!inquiry?.message && (
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

            {inquiry && hasTags && (
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
            <button
              className={`${leadStyles.carouselItem} ${activeTab === "tasks" ? leadStyles.carouselItemActive : ""}`}
              onClick={() => setActiveTab("tasks")}
              type="button"
            >
              Tasks
            </button>
            <button
              className={`${leadStyles.carouselItem} ${activeTab === "notes" ? leadStyles.carouselItemActive : ""}`}
              onClick={() => setActiveTab("notes")}
              type="button"
            >
              Notes
            </button>
          </div>

          {/* Tasks: this lead's, and those from its enquiry or outreach business and its contact */}
          {activeTab === "tasks" && (
            <div className={leadStyles.notesPanel}>
              <TaskList subject={{ kind: "lead", id: lead.id }} />
            </div>
          )}

          {/* Notes: this lead's, and those from its enquiry or outreach business and its contact */}
          {activeTab === "notes" && (
            <div className={leadStyles.notesPanel}>
              <NotesTimeline subject={{ kind: "lead", id: lead.id }} />
            </div>
          )}

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
                <Field icon={<HiOutlineCalendarDays size={16} />} label="Timeline" htmlFor="q-timeline">
                  <Select
                    id="q-timeline"
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
                  </Select>
                </Field>

                <Field icon={<HiOutlineBuildingOffice2 size={16} />} label="Business Name" htmlFor="q-business-name">
                  <TextInput
                    id="q-business-name"
                    placeholder={contact ? "Saved to the contact too" : "Enter business name..."}
                    value={form.businessName}
                    onChange={(e) => update("businessName", e.target.value)}
                  />
                </Field>

                <Field icon={<HiOutlineGlobeAlt size={16} />} label="Selected Package" htmlFor="q-selected-package">
                  <Select
                    id="q-selected-package"
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
                  </Select>
                </Field>

                <Field icon={<HiOutlineLink size={16} />} label="Current site URL" htmlFor="q-current-site-url">
                  <TextInput
                    id="q-current-site-url"
                    placeholder="https://..."
                    value={form.websiteUrl}
                    onChange={(e) => update("websiteUrl", e.target.value)}
                  />
                </Field>

                <Field icon={<HiOutlineShoppingBag size={16} />} label="Products" htmlFor="q-products">
                  <TextInput
                    id="q-products"
                    placeholder="What products/services do they offer?"
                    value={form.products}
                    onChange={(e) => update("products", e.target.value)}
                  />
                </Field>

                <Field icon={<HiOutlineUserGroup size={16} />} label="Target Audience" htmlFor="q-target-audience">
                  <TextInput
                    id="q-target-audience"
                    placeholder="Who are their ideal customers?"
                    value={form.targetAudience}
                    onChange={(e) => update("targetAudience", e.target.value)}
                  />
                </Field>

                <Field icon={<HiOutlineDocumentText size={16} />} label="Content status" htmlFor="q-content-status">
                  <Select
                    id="q-content-status"
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
                  </Select>
                </Field>

                <Field icon={<HiOutlinePuzzlePiece size={16} />} label="Integrations" htmlFor="q-integrations">
                  <TextInput
                    id="q-integrations"
                    placeholder="Calendly, Stripe, Newsletter, CRM, Analytics..."
                    value={form.integrations}
                    onChange={(e) => update("integrations", e.target.value)}
                  />
                </Field>

                <Field icon={<HiOutlineRectangleStack size={16} />} label="Pages / sections needed" htmlFor="q-pages-sections-needed">
                  <TextInput
                    id="q-pages-sections-needed"
                    placeholder="Home, About, Services, Work, Contact, Pricing..."
                    value={form.pagesNeeded}
                    onChange={(e) => update("pagesNeeded", e.target.value)}
                  />
                </Field>

                <Field icon={<HiOutlineMagnifyingGlass size={16} />} label="SEO priority" htmlFor="q-seo-priority">
                  <Select
                    id="q-seo-priority"
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
                  </Select>
                </Field>

                <Field icon={<HiOutlineExclamationTriangle size={16} />} label="Challenges / blockers" htmlFor="q-challenges-blockers">
                  <TextArea
                    id="q-challenges-blockers"
                    placeholder="What's not working today? What's stopping you from converting?"
                    value={form.challenges}
                    onChange={(e) => update("challenges", e.target.value)}
                    rows={4}
                  />
                </Field>

                <Field icon={<HiOutlineArrowRightCircle size={16} />} label="Next steps" htmlFor="q-next-steps">
                  <TextArea
                    id="q-next-steps"
                    placeholder="Agree a call, request assets, send proposal, book build slot..."
                    value={form.nextSteps}
                    onChange={(e) => update("nextSteps", e.target.value)}
                    rows={3}
                  />
                </Field>

              </div>

              <div className={leadStyles.formGridBot} >
                <Field icon={<HiOutlineRocketLaunch size={16} />} label="Goals (pick what applies)">
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
                </Field>

                <Field icon={<HiOutlinePaperClip size={16} />} label="Meeting notes" htmlFor="q-meeting-notes">
                  <TextArea
                    id="q-meeting-notes"
                    placeholder={`Example:\n- Goal: more leads from mobile\n- Pain: site feels outdated + slow\n- Must have: pricing page + enquiry funnel\n- Timeline: wants it live before <date>\n`}
                    value={form.meetingNotes}
                    onChange={(e) => update("meetingNotes", e.target.value)}
                    rows={9}
                  />
                </Field>
              </div>
             
            </div>
          )}

          <Button
            variant="ghostDanger"
            size="sm"
            icon={<HiOutlineTrash size={18} />}
            className={leadStyles.deleteLeadBtn}
            onClick={() => setConfirmDelete(true)}
          >
            Remove lead
          </Button>
        </main>
      </div>

      <ConfirmDialog
        variant="danger"
        open={confirmDelete}
        title="Remove this lead?"
        message={
          inquiry
            ? `${leadName}'s qualification answers will be deleted and the enquiry goes back to Contacted in the Inbox. Notes move to the contact.`
            : outreach
              ? `${leadName}'s qualification answers will be deleted and ${outreach.business_name} goes back to Replied in Outreach. Notes move to the contact.`
              : `${leadName}'s qualification answers will be deleted. Notes move to the contact.`
        }
        confirmLabel="Remove lead"
        busyLabel="Removing…"
        busy={deleting}
        onConfirm={deleteLead}
        onCancel={() => setConfirmDelete(false)}
      />

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
                <h2 className={cardStyles.panelTitle}>Update stage</h2>
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
                    {leadName}
                  </span>
                  {headerContact.email && (
                    <span className={cardStyles.panelInquiryEmail}>{headerContact.email}</span>
                  )}
                  {inquiry && (inquiry.selected_package || inquiry.budget != null) && (
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
                    const isActive = status === lead.stage;

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