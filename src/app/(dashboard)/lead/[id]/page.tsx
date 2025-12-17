"use client";

import { useEffect, useMemo, useState } from "react";
import { useRouter, useParams } from "next/navigation";
import styles from "../../homePage.module.css";
import leadStyles from "./leadPage.module.css";
import { useDashboard } from "@/src/app/context/dashboardContext";
import { supabase } from "../../../../lib/supabaseClient";
import {
  HiMiniWindow,
  HiCurrencyPound,
  HiMiniCube,
} from "react-icons/hi2";
import {
  HiOutlineGlobeAlt,
  HiOutlineLink,
  HiOutlineCalendarDays,
  HiOutlineFlag,
} from "react-icons/hi2";

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
  | "Other";

type SiteStage = "No site" | "Has site" | "Redesign" | "Landing page" | "Ecommerce";
type ContentStatus = "Ready" | "Partly ready" | "Need help" | "Unknown";

type FormState = {
  timeline: Timeline;
  goals: Goal[];
  challenges: string;
  stage: SiteStage;
  websiteUrl: string;
  decisionMaker: "Yes" | "No" | "Unsure";
  contentStatus: ContentStatus;
  brandAssetsReady: boolean;
  pagesNeeded: string;
  seoPriority: "Low" | "Medium" | "High";
  integrations: string;
  nextSteps: string;
  meetingNotes: string;
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

  const { setActivePage, setPageTitle, setBreadcrumbs } = useDashboard();
  
  // Set page config on mount
  useEffect(() => {
    setActivePage("lead");
    setPageTitle("Lead");
    setBreadcrumbs([
      { label: "gios.build", href: "#" },
      { label: "Inbox", href: "/dashboard" },
      { label: inquiry?.name || "Lead" },
    ]);
  }, [setActivePage, setPageTitle, setBreadcrumbs, inquiry?.name]);

  const hasTags = Boolean(inquiry?.selected_package || inquiry?.budget != null || inquiry?.source_page);

  const initial: FormState | null = useMemo(() => {
    if (!inquiry) return null;

    const pkg = (inquiry.selected_package ?? "").toLowerCase();
    const inferredStage: SiteStage =
      pkg.includes("redesign") ? "Redesign" : pkg.includes("ecommerce") ? "Ecommerce" : "Has site";

    return {
      timeline: "2-4 weeks",
      goals: [],
      challenges: "",
      stage: inferredStage,
      websiteUrl: "",
      decisionMaker: "Unsure",
      contentStatus: "Unknown",
      brandAssetsReady: false,
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

  async function signOut() {
    await supabase.auth.signOut();
    router.replace("/login");
  }     

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

  function copyToClipboard(text: string) {
    navigator.clipboard?.writeText(text);
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

  /* ---------------- Loading / Error guards ---------------- */

  if (loading) {
    return (
      <div className={styles.workspace}>
        <div className={styles.main}>
          <div className={styles.canvas}>
            <div className={styles.pageHeader}>
              <h1 className={styles.pageTitle}>Loading lead…</h1>
            </div>
          </div>
        </div>
      </div>
    );
  }

  if (!inquiry) {
    return (
      <div className={styles.workspace}>
        <div className={styles.main}>
          <div className={styles.canvas}>
            <div className={styles.pageHeader}>
              <h1 className={styles.pageTitle}>Lead not found</h1>
            </div>

            {!!fetchError && (
              <div className={styles.errorBanner}>
                <span>{fetchError}</span>
              </div>
            )}

            <button className={leadStyles.smallBtn} type="button" onClick={() => router.back()}>
              Back
            </button>
          </div>
        </div>
      </div>
    );
  }

  if (!form || !initial) {
    return (
      <div className={styles.workspace}>
        <div className={styles.main}>
          <div className={styles.canvas}>
            <div className={styles.pageHeader}>
              <h1 className={styles.pageTitle}>Preparing form…</h1>
            </div>
          </div>
        </div>
      </div>
    );
  }

  /* =========================================================
     UI
  ========================================================= */

  return (
    <div className={styles.canvas}>
      <main className={leadStyles.layout}>
        <div className={leadStyles.card}>
          <div className={leadStyles.cardHeader}>
            <h1 className={leadStyles.cardName}>{inquiry.name || "Unnamed lead"}</h1>
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
              <p className={leadStyles.noteText}>{inquiry.message}</p>
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
              <div className={leadStyles.field}>
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

              <div className={leadStyles.field}>
                <label className={leadStyles.label}>
                  <HiOutlineFlag size={16} />
                  Decision maker?
                </label>
                <select
                  className={leadStyles.select}
                  value={form.decisionMaker}
                  onChange={(e) => update("decisionMaker", e.target.value as FormState["decisionMaker"])}
                >
                  {["Yes", "No", "Unsure"].map((v) => (
                    <option key={v} value={v}>
                      {v}
                    </option>
                  ))}
                </select>
              </div>

              <div className={leadStyles.field}>
                <label className={leadStyles.label}>
                  <HiOutlineGlobeAlt size={16} />
                  Project type
                </label>
                <select
                  className={leadStyles.select}
                  value={form.stage}
                  onChange={(e) => update("stage", e.target.value as SiteStage)}
                >
                  {["No site", "Has site", "Starter","Redesign", "Landing page"].map((v) => (
                    <option key={v} value={v}>
                      {v}
                    </option>
                  ))}
                </select>
              </div>

              <div className={leadStyles.field}>
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

              <div className={leadStyles.fieldFull}>
                <label className={leadStyles.label}>Goals (pick what applies)</label>
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

              <div className={leadStyles.fieldFull}>
                <label className={leadStyles.label}>Challenges / blockers</label>
                <textarea
                  className={leadStyles.textarea}
                  placeholder="What’s not working today? What’s stopping them from converting?"
                  value={form.challenges}
                  onChange={(e) => update("challenges", e.target.value)}
                  rows={4}
                />
              </div>

              <div className={leadStyles.field}>
                <label className={leadStyles.label}>Content status</label>
                <select
                  className={leadStyles.select}
                  value={form.contentStatus}
                  onChange={(e) => update("contentStatus", e.target.value as ContentStatus)}
                >
                  {["Ready", "Partly ready", "Need help", "Unknown"].map((v) => (
                    <option key={v} value={v}>
                      {v}
                    </option>
                  ))}
                </select>
              </div>

              <div className={leadStyles.field}>
                <label className={leadStyles.label}>SEO priority</label>
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

              <div className={leadStyles.fieldFull}>
                <label className={leadStyles.label}>Pages / sections needed</label>
                <input
                  className={leadStyles.input}
                  placeholder="Home, About, Services, Work, Contact, Pricing..."
                  value={form.pagesNeeded}
                  onChange={(e) => update("pagesNeeded", e.target.value)}
                />
              </div>

              <div className={leadStyles.fieldFull}>
                <label className={leadStyles.label}>Integrations</label>
                <input
                  className={leadStyles.input}
                  placeholder="Calendly, Stripe, Newsletter, CRM, Analytics..."
                  value={form.integrations}
                  onChange={(e) => update("integrations", e.target.value)}
                />
              </div>

              <div className={leadStyles.toggleRow}>
                <button
                  type="button"
                  className={`${leadStyles.toggle} ${form.brandAssetsReady ? leadStyles.toggleOn : ""}`}
                  onClick={() => update("brandAssetsReady", !form.brandAssetsReady)}
                >
                  <span className={leadStyles.toggleDot} />
                  Brand assets ready
                </button>
                
              </div>

              <div className={leadStyles.fieldFull}>
                <label className={leadStyles.label}>Next steps</label>
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

          {/* Meeting notes */}
          <div className={leadStyles.formCard}>
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
              Save draft
            </button>
              <button className={leadStyles.smallBtnPrimary} type="button" onClick={saveDraftLocal}>
              Create project
            </button>
          </div>
        
      </main>
    </div>

  );
}