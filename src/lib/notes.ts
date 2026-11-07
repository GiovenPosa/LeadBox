// Notes: a running log kept across a relationship's whole lifecycle.
// See supabase/migrations/20261108_notes.sql.
//
// A note belongs to the one thing it was written on. What you see is the
// notes from everything connected to what you're looking at (its "scope"), so
// a note written on an enquiry still shows on the lead it became.

import { supabase } from "./supabaseClient";
import { logActivity } from "./activity";
import { originLabel, scopeFilter, scopeFor, subjectRef, type Subject, type SubjectKind } from "./subjects";

export type NoteSubjectKind = SubjectKind;

/** The thing a note is written on */
export type NoteSubject = Subject;

export type Note = {
  id: string;
  created_at: string;
  edited_at: string | null;
  body: string;
  contact_id: string | null;
  inquiry_id: string | null;
  outreach_id: string | null;
  lead_id: string | null;
};

const NOTE_COLUMNS = "id, created_at, edited_at, body, contact_id, inquiry_id, outreach_id, lead_id";

/** The timeline for a subject, newest first */
export async function fetchNotes(subject: NoteSubject): Promise<Note[]> {
  const scope = await scopeFor(subject);
  const { data, error } = await supabase
    .from("notes")
    .select(NOTE_COLUMNS)
    .or(scopeFilter(scope))
    .order("created_at", { ascending: false });
  if (error) throw new Error(error.message);
  return (data ?? []) as Note[];
}

export async function addNote(subject: NoteSubject, body: string): Promise<Note> {
  const { data, error } = await supabase
    .from("notes")
    .insert({ ...subjectRef(subject), body: body.trim() })
    .select(NOTE_COLUMNS)
    .single();
  if (error) throw new Error(error.message);
  logActivity("note.added", "Added a note", data as Note);
  return data as Note;
}

export async function editNote(noteId: string, body: string): Promise<Note> {
  const { data, error } = await supabase
    .from("notes")
    .update({ body: body.trim(), edited_at: new Date().toISOString() })
    .eq("id", noteId)
    .select(NOTE_COLUMNS)
    .single();
  if (error) throw new Error(error.message);
  return data as Note;
}

export async function deleteNote(noteId: string): Promise<void> {
  const { error } = await supabase.from("notes").delete().eq("id", noteId);
  if (error) throw new Error(error.message);
}

/** Where a note was written, from the point of view of the subject being viewed */
export const noteOrigin = (note: Note, viewing: NoteSubject) => originLabel(note, viewing);
