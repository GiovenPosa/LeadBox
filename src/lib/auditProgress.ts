// Where a running audit is up to, for the progress bar and window
// (auditSummary.tsx). The database only records the broad stage (queued,
// gathering, writing); within one, the steps follow their usual timings from
// a live run (Nov 2026: the site in seconds, each speed test about 25 s,
// Claude about 30 s), timed from when the stage began (updated_at). The bar
// never claims more than its stage: it creeps towards the stage's end and
// only passes it when the real status moves on.

import type { Audit } from "./audits";

export type Step = {
  key: string;
  label: string;
  /** what's happening, in a line */
  detail: string;
  status: "queued" | "gathering" | "writing";
  /** seconds into its stage that it usually starts */
  from: number;
};

export const STEPS: Step[] = [
  { key: "queue", label: "In the queue", detail: "Waiting for its turn, usually a moment.", status: "queued", from: 0 },
  { key: "site", label: "Reading the site", detail: "Up to ten pages: titles, headings, business details, towns named.", status: "gathering", from: 0 },
  { key: "phone", label: "Speed on a phone", detail: "Google loads the home page the way a phone on 4G would. The slowest step.", status: "gathering", from: 6 },
  { key: "computer", label: "Speed on a computer", detail: "The same test, on a desktop connection.", status: "gathering", from: 32 },
  { key: "profile", label: "Google Business Profile", detail: "Looking for a listing that links to the site, and its reviews.", status: "gathering", from: 56 },
  { key: "write", label: "Writing the report", detail: "Claude reads the facts and the phone screenshot, and writes it up.", status: "writing", from: 0 },
  { key: "check", label: "Checking the report", detail: "Every number checked against the facts, and the wording against the house rules.", status: "writing", from: 35 },
];

// how long each stage usually takes, and the share of the bar it fills
const STAGE = {
  queued: { seconds: 5, start: 0, end: 4 },
  gathering: { seconds: 70, start: 4, end: 64 },
  writing: { seconds: 50, start: 66, end: 96 },
} as const;

export type Progress = {
  /** 0 to 100 */
  percent: number;
  /** the step it's on (an index into STEPS) */
  current: number;
  /** seconds since the audit was requested */
  elapsed: number;
};

export function progressOf(audit: Audit, now: number): Progress {
  const elapsed = Math.max(0, Math.round((now - new Date(audit.created_at).getTime()) / 1000));
  if (audit.status !== "queued" && audit.status !== "gathering" && audit.status !== "writing") {
    return { percent: 100, current: STEPS.length, elapsed };
  }
  const stage = STAGE[audit.status];
  const inStage = Math.max(0, (now - new Date(audit.updated_at).getTime()) / 1000);
  // eases towards the stage's end and waits there, never past it
  const share = 1 - Math.exp(-inStage / (stage.seconds * 0.6));
  const percent = Math.round(stage.start + (stage.end - stage.start) * share);
  const steps = STEPS.map((step, index) => ({ step, index })).filter(({ step }) => step.status === audit.status);
  const current = [...steps].reverse().find(({ step }) => inStage >= step.from)?.index ?? steps[0].index;
  return { percent, current, elapsed };
}

/** "1:07" */
export const clock = (seconds: number) => `${Math.floor(seconds / 60)}:${String(seconds % 60).padStart(2, "0")}`;
