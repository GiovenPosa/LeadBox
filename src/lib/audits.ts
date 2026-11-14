// Website audits: requests from gios.build/website-audit. The website's
// Worker saves each one in `audits` (gios-build2 repo,
// supabase/migrations/20261115_audits.sql) and files it as an enquiry with
// source_page "/website-audit"; a background Workflow then gathers the
// site's facts into audits.facts. The whole feature is described in
// gios-build2/docs/website-audit/spec.md.

import { supabase } from "./supabaseClient";

export const AUDIT_SOURCE = "/website-audit";

export type AuditStatus =
  | "queued"
  | "held"
  | "gathering"
  | "writing"
  | "review"
  | "ready"
  | "sent"
  | "failed"
  | "rejected";

// The parts of the facts the panel shows (the full shape is the Worker's
// worker/audit/facts.ts)
export type SpeedRun = {
  performance: number | null;
  seo: number | null;
  accessibility: number | null;
  lcpMs: number | null;
  tbtMs: number | null;
  weightKb: number | null;
  field: { overall: string | null; lcpMs: number | null } | null;
};

export type AuditPage = {
  url: string;
  title: string | null;
  description: string | null;
  h1: string[];
  words: number;
  imagesMissingAlt: number;
  noindex: boolean;
};

export type AuditFacts = {
  url: string;
  gatheredAt: string;
  speed: { mobile: SpeedRun | null; desktop: SpeedRun | null };
  screenshot: string | null;
  site: {
    finalUrl: string | null;
    https: boolean;
    redirects: { http: boolean | null; otherHost: boolean | null };
    sitemap: { found: boolean; urls: number };
    platform: string | null;
    pages: AuditPage[];
    places: Record<string, number>;
    phoneOnSite: string | null;
    contactForm: boolean;
    bookingLinks: string[];
    socialLinks: string[];
    businessData: { name: string | null; address: string | null; openingHours: boolean } | null;
  } | null;
  profile: {
    found: boolean;
    name: string | null;
    rating: number | null;
    reviews: number | null;
    nameMatches: boolean | null;
    addressMatches: boolean | null;
    phoneMatches: boolean | null;
  } | null;
  gaps: string[];
};

export type Audit = {
  id: string;
  created_at: string;
  url: string;
  status: AuditStatus;
  fail_reason: string | null;
  facts: AuditFacts | null;
};

/** The audit an enquiry was filed for, or null (a repeat request within 30
 *  days files an enquiry but no new audit) */
export async function fetchAuditForInquiry(inquiryId: string): Promise<Audit | null> {
  const { data, error } = await supabase
    .from("audits")
    .select("id, created_at, url, status, fail_reason, facts")
    .eq("inquiry_id", inquiryId)
    .order("created_at", { ascending: false })
    .limit(1)
    .maybeSingle();
  if (error) throw new Error(error.message);
  return (data as Audit | null) ?? null;
}

/** still on its way: worth checking again shortly */
export const auditInProgress = (status: AuditStatus) => status === "queued" || status === "gathering" || status === "writing";
