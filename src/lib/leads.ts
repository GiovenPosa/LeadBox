// Leads: enquiries Gio has decided to pursue. Turning an enquiry into a lead
// marks the enquiry "converted"; from then on the lead's stage tracks the deal.
// The steps that change several tables at once run as transactions in the
// app's API routes (src/app/api/leads).

import { postJson } from "./api";
import type { PillTone } from "../app/components/pill";
import { INDUSTRIES } from "./outreach";

export type LeadStage = "qualifying" | "proposal" | "onboarding" | "won" | "lost";

export const LEAD_STAGES: { value: LeadStage; label: string; tone: PillTone }[] = [
  { value: "qualifying", label: "Qualifying", tone: "new" },
  { value: "proposal", label: "Proposal", tone: "contacted" },
  { value: "onboarding", label: "Onboarding", tone: "qualified" },
  { value: "won", label: "Won", tone: "won" },
  { value: "lost", label: "Lost", tone: "lost" },
];

export const leadStageLabel = (stage: LeadStage) =>
  LEAD_STAGES.find((s) => s.value === stage)?.label ?? stage;

export const leadStageTone = (stage: LeadStage): PillTone =>
  LEAD_STAGES.find((s) => s.value === stage)?.tone ?? "neutral";

/** The lead embedded on an enquiry row: just enough to link to it */
export type LeadRef = { id: string; stage: LeadStage };

/**
 * PostgREST embeds a one-to-one relation as an object, but older versions
 * send a one-item array; accept either.
 */
export function embeddedLead(value: LeadRef | LeadRef[] | null | undefined): LeadRef | null {
  if (!value) return null;
  return Array.isArray(value) ? value[0] ?? null : value;
}

/** Turn an enquiry into a lead (or get its existing lead) */
export async function convertInquiryToLead(inquiryId: string): Promise<LeadRef> {
  const { lead } = await postJson<{ lead: LeadRef }>("/api/leads/convert", { inquiryId });
  return lead;
}

/** Remove a lead and its qualification answers; its enquiry or outreach business steps back a stage */
export async function removeLead(leadId: string): Promise<void> {
  await postJson("/api/leads/remove", { leadId });
}

/** Promote an outreach business to a lead, using an existing contact or creating one */
export async function promoteOutreachToLead(
  outreachId: string,
  contact: { id: string } | { name: string; email: string; phone: string; business: string }
): Promise<LeadRef> {
  const { lead } = await postJson<{ lead: LeadRef }>(
    "/api/leads/promote",
    "id" in contact ? { outreachId, contactId: contact.id } : { outreachId, contact }
  );
  return lead;
}

export const leadHref = (leadId: string) => `/leads/${leadId}`;

/** The enquiry form's packages: ids as stored in booking_inquiries.selected_package (gios-build2 src/data/enquiry.ts) */
export const PACKAGES = [
  { value: "starter", label: "Starter" },
  { value: "redesign", label: "Redesign" },
  { value: "lead-system", label: "Growth" },
  { value: "not-sure", label: "Not sure" },
];

export const packageLabel = (id: string | null) =>
  PACKAGES.find((p) => p.value === id)?.label ?? id ?? "";

/** The enquiry form's business types (gios-build2 src/data/enquiry.ts) */
export const BUSINESS_TYPES = [
  "Trades & Home Services",
  "Food & Hospitality",
  "Health & Beauty",
  "Retail & E-commerce",
  "Professional Services",
  "Creative & Portfolio",
  "Startup",
  "Other",
];

/**
 * Suggestions for a contact's industry. It's free text that will grow, so
 * these only help keep spelling consistent: the website's types, the outreach
 * industries, then whatever contacts already use.
 */
export function industrySuggestions(inUse: (string | null | undefined)[] = []): string[] {
  const all = [...BUSINESS_TYPES, ...INDUSTRIES.map((i) => i.label), ...inUse];
  const seen = new Set<string>();
  return all.filter((value): value is string => {
    const key = value?.trim().toLowerCase();
    if (!key || seen.has(key)) return false;
    seen.add(key);
    return true;
  });
}
