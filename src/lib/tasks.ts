// Tasks: things to do, with an optional due date, on a contact, an enquiry,
// an outreach business or a lead. See supabase/migrations/20261108_tasks_activity.sql.
//
// Like notes, a task belongs to the one thing it was set on, and you see the
// tasks from everything connected to what you're looking at (lib/subjects).

import { supabase } from "./supabaseClient";
import { logActivity, unlogTaskDone } from "./activity";
import { scopeFilter, scopeFor, subjectRef, type Subject, type SubjectRefs } from "./subjects";
import { daysFromToday, todayISO } from "./outreach";

export type Task = SubjectRefs & {
  id: string;
  created_at: string;
  title: string;
  due_on: string | null; // yyyy-mm-dd
  done_at: string | null;
};

export const TASK_COLUMNS = "id, created_at, title, due_on, done_at, contact_id, inquiry_id, outreach_id, lead_id";

/** Open tasks first, soonest due (undated last); then done ones, most recent first */
export function sortTasks(tasks: Task[]): Task[] {
  return [...tasks].sort((a, b) => {
    if (!a.done_at !== !b.done_at) return a.done_at ? 1 : -1;
    if (a.done_at && b.done_at) return b.done_at.localeCompare(a.done_at);
    if (a.due_on !== b.due_on) return !a.due_on ? 1 : !b.due_on ? -1 : a.due_on.localeCompare(b.due_on);
    return a.created_at.localeCompare(b.created_at);
  });
}

export type TaskDue = "overdue" | "today" | "soon" | "later" | null;

/** How urgent an open task is: overdue, today, within three days, or later */
export function taskDue(task: Pick<Task, "due_on" | "done_at">): TaskDue {
  if (task.done_at || !task.due_on) return null;
  const days = daysFromToday(task.due_on);
  if (days < 0) return "overdue";
  if (days === 0) return "today";
  if (days <= 3) return "soon";
  return "later";
}

/** The tasks for a subject and everything connected to it */
export async function fetchTasks(subject: Subject): Promise<Task[]> {
  const { data, error } = await supabase
    .from("tasks")
    .select(TASK_COLUMNS)
    .or(scopeFilter(await scopeFor(subject)));
  if (error) throw new Error(error.message);
  return sortTasks((data ?? []) as Task[]);
}

export async function addTask(subject: Subject, title: string, dueOn: string | null): Promise<Task> {
  const { data, error } = await supabase
    .from("tasks")
    .insert({ ...subjectRef(subject), title: title.trim(), due_on: dueOn })
    .select(TASK_COLUMNS)
    .single();
  if (error) throw new Error(error.message);
  return data as Task;
}

export async function updateTask(id: string, fields: { title?: string; due_on?: string | null }): Promise<Task> {
  const { data, error } = await supabase
    .from("tasks")
    .update(fields.title != null ? { ...fields, title: fields.title.trim() } : fields)
    .eq("id", id)
    .select(TASK_COLUMNS)
    .single();
  if (error) throw new Error(error.message);
  return data as Task;
}

/**
 * Tick a task off (or untick it). Ticking it off adds a "Done" line to the
 * activity feed; unticking takes that line back out, so a mis-click leaves no trace.
 */
export async function setTaskDone(task: Task, done: boolean): Promise<Task> {
  const { data, error } = await supabase
    .from("tasks")
    .update({ done_at: done ? new Date().toISOString() : null })
    .eq("id", task.id)
    .select(TASK_COLUMNS)
    .single();
  if (error) throw new Error(error.message);
  if (done) await logActivity("task.done", `Done: ${task.title}`, { ...task, task_id: task.id });
  else await unlogTaskDone(task.id);
  return data as Task;
}

export async function deleteTask(id: string): Promise<void> {
  const { error } = await supabase.from("tasks").delete().eq("id", id);
  if (error) throw new Error(error.message);
}

/** The last day of this week (Sunday), yyyy-mm-dd */
export function endOfWeekISO(): string {
  const day = new Date().getDay(); // 0 = Sunday
  return todayISO(day === 0 ? 0 : 7 - day);
}
