// What the home dashboard shows: tasks due this week, a summary of the
// pipeline, and what's happened today and this week.

import { supabase } from "./supabaseClient";
import { TASK_COLUMNS, endOfWeekISO, sortTasks, type Task } from "./tasks";
import { LEAD_STAGES, embeddedLead, type LeadRef, type LeadStage } from "./leads";
import type { ScorecardRow } from "./outreachStats";
import { todayISO } from "./outreach";
import type { ActivityKind } from "./activity";
import type { SubjectRefs } from "./subjects";

type Named = { name: string | null; email: string | null } | null;

/** A task with the name of what it's about, for listing outside its own page */
export type DashboardTask = Task & {
  contact: Named;
  inquiry: Named;
  outreach: { business_name: string } | null;
  lead: { id: string; contact: Named } | null;
};

export type FeedItem = SubjectRefs & {
  id: string;
  at: string;
  kind: ActivityKind | "enquiry.received";
  summary: string;
  /** the name of what it's about, e.g. "V Nails", for lines that don't say */
  about: string | null;
};

export type DashboardData = {
  tasks: DashboardTask[];
  feed: FeedItem[];
  newEnquiries: number;
  enquiriesThisWeek: number;
  openLeads: number;
  pipelineValue: number;
  leadsByStage: Record<LeadStage, number>;
  messagedThisWeek: number;
  /** outreach businesses promoted to leads this week (not enquiries converted) */
  outreachLeadsThisWeek: number;
  /** every outreach business, for the scorecard */
  outreach: ScorecardRow[];
};

/** Monday of this week, yyyy-mm-dd */
export function startOfWeekISO(): string {
  const day = new Date().getDay(); // 0 = Sunday
  return todayISO(-((day + 6) % 7));
}

const startOfWeekTimestamp = () => new Date(`${startOfWeekISO()}T00:00:00`).toISOString();

const nameOf = (n: Named) => n?.name || n?.email || null;

/** What a task is about, in a few words: "Sarah Mitchell", "V Nails" */
export function taskAbout(task: DashboardTask): string {
  return (
    nameOf(task.lead?.contact ?? null) ??
    nameOf(task.contact) ??
    nameOf(task.inquiry) ??
    task.outreach?.business_name ??
    ""
  );
}

type ActivityRow = SubjectRefs & {
  id: string;
  created_at: string;
  kind: string;
  summary: string;
  contact: Named;
  inquiry: Named;
  outreach: { business_name: string } | null;
  lead: { contact: Named } | null;
};

type ReceivedRow = { id: string; created_at: string; name: string | null; email: string | null };

// this week's activity, with the names of what each line is about
const activityQuery = (since: string) =>
  supabase
    .from("activity")
    .select(
      "id, created_at, kind, summary, contact_id, inquiry_id, outreach_id, lead_id, contact:contacts(name, email), inquiry:booking_inquiries(name, email), outreach:outreach(business_name), lead:leads(contact:contacts(name, email))"
    )
    .gte("created_at", since)
    .order("created_at", { ascending: false })
    .limit(60);

const receivedQuery = (since: string) =>
  supabase
    .from("booking_inquiries")
    .select("id, created_at, name, email")
    .gte("created_at", since)
    .order("created_at", { ascending: false });

// lines whose summary doesn't already name what they're about
const NEEDS_ABOUT = new Set(["task.done", "note.added"]);

function mergeFeed(activity: unknown[] | null, received: unknown[] | null): FeedItem[] {
  return [
    ...((activity ?? []) as ActivityRow[]).map((a) => ({
      id: a.id,
      at: a.created_at,
      kind: a.kind as ActivityKind,
      summary: a.summary,
      about: NEEDS_ABOUT.has(a.kind)
        ? nameOf(a.lead?.contact ?? null) ?? nameOf(a.contact) ?? nameOf(a.inquiry) ?? a.outreach?.business_name ?? null
        : null,
      contact_id: a.contact_id,
      inquiry_id: a.inquiry_id,
      outreach_id: a.outreach_id,
      lead_id: a.lead_id,
    })),
    // new enquiries come from the website, so they're read straight from the enquiries
    ...((received ?? []) as ReceivedRow[]).map((e) => ({
      id: `enquiry-${e.id}`,
      at: e.created_at,
      kind: "enquiry.received" as const,
      summary: `New enquiry from ${e.name || e.email}`,
      about: null,
      contact_id: null,
      inquiry_id: e.id,
      outreach_id: null,
      lead_id: null,
    })),
  ].sort((a, b) => b.at.localeCompare(a.at));
}

/** Just the activity feed, to refresh it after a change without reloading everything */
export async function fetchFeed(): Promise<FeedItem[]> {
  const since = startOfWeekTimestamp();
  const [activity, received] = await Promise.all([activityQuery(since), receivedQuery(since)]);
  return mergeFeed(activity.data, received.data);
}

export async function fetchDashboard(): Promise<DashboardData> {
  const weekStart = startOfWeekTimestamp();

  const [tasks, activity, received, unseen, leads, outreach] = await Promise.all([
    // open tasks due by the end of this week, overdue ones included
    supabase
      .from("tasks")
      .select(
        `${TASK_COLUMNS}, contact:contacts(name, email), inquiry:booking_inquiries(name, email), outreach:outreach(business_name), lead:leads(id, contact:contacts(name, email))`
      )
      .is("done_at", null)
      .lte("due_on", endOfWeekISO()),
    activityQuery(weekStart),
    receivedQuery(weekStart),
    supabase
      .from("booking_inquiries")
      .select("id", { count: "exact", head: true })
      .eq("opportunity_status", "new")
      .is("seen_at", null),
    supabase.from("leads").select("id, stage, created_at, outreach_id, inquiry:booking_inquiries(budget)"),
    supabase.from("outreach").select("id, created_at, stage, channel, industry, first_contacted_on, objection, leads(id)"),
  ]);

  const firstError = [tasks, activity, received, unseen, leads, outreach].find((r) => r.error)?.error;
  if (firstError) throw new Error(firstError.message);

  const feed = mergeFeed(activity.data, received.data);

  const outreachRows = (outreach.data ?? []) as unknown as (Omit<ScorecardRow, "is_lead"> & {
    created_at: string;
    leads: LeadRef | LeadRef[] | null;
  })[];

  const leadsByStage = Object.fromEntries(LEAD_STAGES.map((s) => [s.value, 0])) as Record<LeadStage, number>;
  let openLeads = 0;
  let pipelineValue = 0;
  let outreachLeadsThisWeek = 0;
  for (const lead of (leads.data ?? []) as unknown as {
    stage: LeadStage;
    created_at: string;
    outreach_id: string | null;
    inquiry: { budget: number | null } | null;
  }[]) {
    leadsByStage[lead.stage] += 1;
    if (lead.outreach_id && lead.created_at >= weekStart) outreachLeadsThisWeek += 1;
    if (lead.stage !== "won" && lead.stage !== "lost") {
      openLeads += 1;
      pipelineValue += lead.inquiry?.budget ?? 0;
    }
  }

  return {
    tasks: sortTasks((tasks.data ?? []) as unknown as DashboardTask[]) as DashboardTask[],
    feed,
    newEnquiries: unseen.count ?? 0,
    enquiriesThisWeek: received.data?.length ?? 0,
    openLeads,
    pipelineValue,
    leadsByStage,
    messagedThisWeek: outreachRows.filter((r) => r.created_at >= weekStart).length,
    outreachLeadsThisWeek,
    outreach: outreachRows.map((r) => ({
      id: r.id,
      stage: r.stage,
      channel: r.channel,
      industry: r.industry,
      first_contacted_on: r.first_contacted_on,
      objection: r.objection,
      is_lead: embeddedLead(r.leads) !== null,
    })),
  };
}
