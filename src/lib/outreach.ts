// Outreach: businesses contacted first (see supabase/migrations/20261107_outreach.sql).
// The keys here must match the table's check constraints.

import type { LeadRef } from "./leads";

export type Industry = "salons" | "barbers" | "food" | "trades" | "fitness" | "pets" | "other";
export type Channel = "instagram" | "facebook" | "in_person" | "email" | "phone" | "other";
/**
 * Outreach covers the stages before a deal: once they're interested enough to
 * quote, the business is promoted to a lead, whose own stages (proposal, won,
 * lost, ...) take over. converted ("Lead") is set by promoting, not by hand.
 */
export type Stage = "messaged" | "replied" | "mockup" | "chat" | "converted" | "no_reply";
export type Objection =
  | "too_expensive"
  | "busy_enough"
  | "has_platform"
  | "not_now"
  | "burned_before"
  | "diy"
  | "not_decision_maker"
  | "wants_info"
  | "other";

export type OutreachRow = {
  id: string;
  created_at: string;
  updated_at: string;
  business_name: string;
  industry: Industry;
  channel: Channel;
  handle: string | null;
  town: string | null;
  first_contacted_on: string; // yyyy-mm-dd
  stage: Stage;
  objection: Objection | null;
  objection_reason: string | null;
  /** the soonest open task's title and due date, filled in by the page from tasks (not stored) */
  next_step: string | null;
  next_step_due: string | null; // yyyy-mm-dd
  /** the lead it was promoted to, embedded by OUTREACH_COLUMNS */
  leads?: LeadRef | LeadRef[] | null;
};

export type OutreachInput = Omit<OutreachRow, "id" | "created_at" | "updated_at" | "leads">;

export const OUTREACH_COLUMNS =
  "id, created_at, updated_at, business_name, industry, channel, handle, town, first_contacted_on, stage, objection, objection_reason, leads(id, stage)";

export const INDUSTRIES: { value: Industry; label: string }[] = [
  { value: "salons", label: "Salons" },
  { value: "barbers", label: "Barbers" },
  { value: "food", label: "Food & drink" },
  { value: "trades", label: "Trades" },
  { value: "fitness", label: "Fitness" },
  { value: "pets", label: "Pets" },
  { value: "other", label: "Other" },
];

export const CHANNELS: { value: Channel; label: string }[] = [
  { value: "instagram", label: "Instagram" },
  { value: "facebook", label: "Facebook" },
  { value: "in_person", label: "In person" },
  { value: "email", label: "Email" },
  { value: "phone", label: "Phone" },
  { value: "other", label: "Other" },
];

// In ladder order; won, lost and no reply are where a row ends up
export const STAGES: { value: Stage; label: string }[] = [
  { value: "messaged", label: "Messaged" },
  { value: "replied", label: "Replied" },
  { value: "mockup", label: "Mock-up" },
  { value: "chat", label: "Chat" },
  { value: "converted", label: "Lead" },
  { value: "no_reply", label: "No reply" },
];

export const OBJECTIONS: { value: Objection; label: string }[] = [
  { value: "too_expensive", label: "Too expensive" },
  { value: "busy_enough", label: "Busy enough already" },
  { value: "has_platform", label: "Already on an app or page" },
  { value: "not_now", label: "Not right now" },
  { value: "burned_before", label: "Bad experience before" },
  { value: "diy", label: "Doing it themselves" },
  { value: "not_decision_maker", label: "Not the decision-maker" },
  { value: "wants_info", label: "Wants more info" },
  { value: "other", label: "Other" },
];

const labelOf = <T extends string>(list: { value: T; label: string }[], value: T | null) =>
  list.find((o) => o.value === value)?.label ?? "";

export const industryLabel = (v: Industry) => labelOf(INDUSTRIES, v);
export const channelLabel = (v: Channel) => labelOf(CHANNELS, v);
export const stageLabel = (v: Stage) => labelOf(STAGES, v);
export const objectionLabel = (v: Objection | null) => labelOf(OBJECTIONS, v);

/** Stages where outreach is done, so follow-ups aren't due (a lead is followed up as a lead) */
export const CLOSED_STAGES: Stage[] = ["converted"];

/* ---------- dates (all local, as yyyy-mm-dd) ---------- */

export function todayISO(offsetDays = 0): string {
  const d = new Date();
  d.setDate(d.getDate() + offsetDays);
  const y = d.getFullYear();
  const m = String(d.getMonth() + 1).padStart(2, "0");
  const day = String(d.getDate()).padStart(2, "0");
  return `${y}-${m}-${day}`;
}

function parseISODate(iso: string): Date {
  const [y, m, d] = iso.split("-").map(Number);
  return new Date(y, m - 1, d);
}

/** Whole days from today to the date: negative is past */
export function daysFromToday(iso: string): number {
  const today = parseISODate(todayISO());
  return Math.round((parseISODate(iso).getTime() - today.getTime()) / 86400000);
}

export function formatShortDate(iso: string): string {
  const d = parseISODate(iso);
  const sameYear = d.getFullYear() === new Date().getFullYear();
  return d.toLocaleDateString("en-GB", {
    day: "numeric",
    month: "short",
    year: sameYear ? undefined : "numeric",
  });
}

/** "Today", "3d ago", "2w ago", or the date */
export function formatAgo(iso: string): string {
  const days = -daysFromToday(iso);
  if (days <= 0) return "Today";
  if (days === 1) return "Yesterday";
  if (days < 14) return `${days}d ago`;
  if (days < 60) return `${Math.floor(days / 7)}w ago`;
  return formatShortDate(iso);
}

export type DueState = "overdue" | "today" | "soon" | "later" | null;

/** How urgent the row's next step is; null when there's no due date or it's closed */
export function dueState(row: Pick<OutreachRow, "next_step_due" | "stage">): DueState {
  if (!row.next_step_due || CLOSED_STAGES.includes(row.stage)) return null;
  const days = daysFromToday(row.next_step_due);
  if (days < 0) return "overdue";
  if (days === 0) return "today";
  if (days <= 3) return "soon";
  return "later";
}

export function formatDue(iso: string): string {
  const days = daysFromToday(iso);
  if (days < -1) return `${-days}d overdue`;
  if (days === -1) return "Yesterday";
  if (days === 0) return "Today";
  if (days === 1) return "Tomorrow";
  if (days < 7) return parseISODate(iso).toLocaleDateString("en-GB", { weekday: "short" });
  return formatShortDate(iso);
}

/** Turns "@usanails", "usanails" or a full link into something openable */
export function handleUrl(handle: string, channel: Channel): string | null {
  const h = handle.trim();
  if (!h) return null;
  if (/^https?:\/\//i.test(h)) return h;
  const name = h.replace(/^@/, "");
  if (channel === "instagram") return `https://instagram.com/${name}`;
  if (channel === "facebook") return `https://facebook.com/${name}`;
  return null;
}
