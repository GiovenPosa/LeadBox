// The activity log: what happened and when, for the dashboard's feed.
// See supabase/migrations/20261108_tasks_activity.sql. Changes made through
// the API routes are logged there (lib/server/activity.ts); changes the pages
// make directly are logged with logActivity.

import { supabase } from "./supabaseClient";
import type { SubjectRefs } from "./subjects";

export type ActivityKind =
  | "enquiry.status"
  | "enquiry.converted"
  | "enquiry.deleted"
  | "lead.stage"
  | "lead.qualified"
  | "lead.removed"
  | "outreach.added"
  | "outreach.stage"
  | "outreach.promoted"
  | "contact.added"
  | "contact.deleted"
  | "task.done"
  | "note.added";

/**
 * Add a line to the activity log. Never fails the change itself: if logging
 * fails, it's only noted in the console. Callers needn't wait for it.
 */
export async function logActivity(
  kind: ActivityKind,
  summary: string,
  refs: Partial<SubjectRefs> & { task_id?: string } = {}
): Promise<void> {
  const row = {
    kind,
    summary,
    task_id: refs.task_id ?? null,
    contact_id: refs.contact_id ?? null,
    inquiry_id: refs.inquiry_id ?? null,
    outreach_id: refs.outreach_id ?? null,
    lead_id: refs.lead_id ?? null,
  };
  const { error } = await supabase.from("activity").insert(row);
  if (error) console.warn("[activity] not logged:", error.message);
}

/** Take a task's "Done" line back out of the log, when it's unticked */
export async function unlogTaskDone(taskId: string): Promise<void> {
  const { error } = await supabase.from("activity").delete().eq("kind", "task.done").eq("task_id", taskId);
  if (error) console.warn("[activity] not removed:", error.message);
}
