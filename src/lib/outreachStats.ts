// The outreach scorecard: how far businesses get after being messaged, and
// which channels, industries and objections matter. Worked out from the
// outreach rows, so nothing extra is stored.

import {
  CHANNELS,
  INDUSTRIES,
  OBJECTIONS,
  daysFromToday,
  todayISO,
  type Channel,
  type Industry,
  type Objection,
  type Stage,
} from "./outreach";

export type ScorecardRow = {
  id: string;
  stage: Stage;
  channel: Channel;
  industry: Industry;
  first_contacted_on: string; // yyyy-mm-dd
  objection: Objection | null;
  /** promoted to a lead (also true if the stage was later changed by hand) */
  is_lead: boolean;
};

export type Period = "week" | "month" | "all";

export const PERIODS: { value: Period; label: string }[] = [
  { value: "week", label: "This week" },
  { value: "month", label: "This month" },
  { value: "all", label: "All time" },
];

// How far along each stage is; "no reply" got no further than being messaged
const DEPTH: Record<Stage, number> = { messaged: 0, no_reply: 0, replied: 1, mockup: 2, chat: 3, converted: 4 };

export const FUNNEL_STEPS = [
  { depth: 0, label: "Messaged" },
  { depth: 1, label: "Replied" },
  { depth: 2, label: "Mock-up" },
  { depth: 3, label: "Chat" },
  { depth: 4, label: "Lead" },
] as const;

/** How far a business got. A recorded objection means they replied, and a lead got all the way. */
function depthOf(row: ScorecardRow) {
  if (row.is_lead) return 4;
  return Math.max(DEPTH[row.stage], row.objection ? 1 : 0);
}

// Messaged in the last few days with no answer yet isn't a "no" yet
const AWAITING_DAYS = 3;

const isAwaiting = (row: ScorecardRow) => depthOf(row) === 0 && row.stage !== "no_reply" && -daysFromToday(row.first_contacted_on) < AWAITING_DAYS;

export type Breakdown = { key: string; label: string; messaged: number; replied: number; leads: number; replyRate: number | null };

export type Scorecard = {
  messaged: number;
  awaiting: number;
  /** reached each step of the funnel, by depth */
  reached: number[];
  /** replies out of those it's fair to judge (not still awaiting); null when there are none */
  replyRate: number | null;
  leadRate: number | null;
  byChannel: Breakdown[];
  byIndustry: Breakdown[];
  objections: { key: Objection; label: string; count: number }[];
};

function inPeriod(row: ScorecardRow, period: Period, weekStart: string) {
  if (period === "all") return true;
  if (period === "week") return row.first_contacted_on >= weekStart;
  return row.first_contacted_on.slice(0, 7) === todayISO().slice(0, 7);
}

const rate = (part: number, whole: number) => (whole > 0 ? part / whole : null);

function breakdown<K extends string>(
  rows: ScorecardRow[],
  keyOf: (r: ScorecardRow) => K,
  labels: { value: K; label: string }[]
): Breakdown[] {
  return labels
    .map(({ value, label }) => {
      const group = rows.filter((r) => keyOf(r) === value);
      const judged = group.filter((r) => !isAwaiting(r));
      const replied = group.filter((r) => depthOf(r) >= 1).length;
      return {
        key: value,
        label,
        messaged: group.length,
        replied,
        leads: group.filter((r) => depthOf(r) >= 4).length,
        replyRate: rate(replied, judged.length),
      };
    })
    .filter((b) => b.messaged > 0)
    .sort((a, b) => (b.replyRate ?? -1) - (a.replyRate ?? -1) || b.messaged - a.messaged);
}

export function scorecard(all: ScorecardRow[], period: Period, weekStart: string): Scorecard {
  const rows = all.filter((r) => inPeriod(r, period, weekStart));
  const judged = rows.filter((r) => !isAwaiting(r));
  const reached = FUNNEL_STEPS.map((step) => rows.filter((r) => depthOf(r) >= step.depth).length);

  const objectionCounts = new Map<Objection, number>();
  for (const r of rows) if (r.objection) objectionCounts.set(r.objection, (objectionCounts.get(r.objection) ?? 0) + 1);

  return {
    messaged: rows.length,
    awaiting: rows.length - judged.length,
    reached,
    replyRate: rate(judged.filter((r) => depthOf(r) >= 1).length, judged.length),
    leadRate: rate(reached[4], rows.length),
    byChannel: breakdown(rows, (r) => r.channel, CHANNELS),
    byIndustry: breakdown(rows, (r) => r.industry, INDUSTRIES),
    objections: OBJECTIONS.filter((o) => objectionCounts.has(o.value))
      .map((o) => ({ key: o.value, label: o.label, count: objectionCounts.get(o.value)! }))
      .sort((a, b) => b.count - a.count),
  };
}

export const formatRate = (r: number | null) => (r === null ? "–" : `${Math.round(r * 100)}%`);

/** A yyyy-mm-dd date moved by whole days, in local time */
function addDays(iso: string, days: number) {
  const [y, m, d] = iso.split("-").map(Number);
  const date = new Date(y, m - 1, d + days);
  return `${date.getFullYear()}-${String(date.getMonth() + 1).padStart(2, "0")}-${String(date.getDate()).padStart(2, "0")}`;
}

export type WeekTotals = { start: string; messaged: number; replied: number; awaiting: number };

/** Businesses messaged in each of the last few weeks (oldest first), and how many of them replied */
export function weeklyTrend(all: ScorecardRow[], weekStart: string, weeks = 8): WeekTotals[] {
  return Array.from({ length: weeks }, (_, i) => {
    const start = addDays(weekStart, -7 * (weeks - 1 - i));
    const end = addDays(start, 7);
    const rows = all.filter((r) => r.first_contacted_on >= start && r.first_contacted_on < end);
    return {
      start,
      messaged: rows.length,
      replied: rows.filter((r) => depthOf(r) >= 1).length,
      awaiting: rows.filter(isAwaiting).length,
    };
  });
}
