// Notes: a running log kept across a relationship's whole lifecycle.
// See supabase/migrations/20261108_notes.sql.
//
// A note belongs to the one thing it was written on. What you see is the
// notes from everything connected to what you're looking at (its "scope"), so
// a note written on an enquiry still shows on the lead it became.

import { supabase } from "./supabaseClient";

export type NoteSubjectKind = "contact" | "inquiry" | "outreach" | "lead";

/** The thing a note is written on */
export type NoteSubject = { kind: NoteSubjectKind; id: string };

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

const COLUMN: Record<NoteSubjectKind, keyof Note> = {
  contact: "contact_id",
  inquiry: "inquiry_id",
  outreach: "outreach_id",
  lead: "lead_id",
};

type Scope = Record<NoteSubjectKind, string[]>;

const emptyScope = (): Scope => ({ contact: [], inquiry: [], outreach: [], lead: [] });

/**
 * Everything connected to a subject, whose notes belong in its timeline:
 *   - a lead: itself, the enquiry or outreach business it came from, its contact
 *   - an enquiry: itself, its contact, the lead it became
 *   - an outreach business: itself, the lead it became and that lead's contact
 *   - a contact: itself, all their enquiries and leads, and the outreach
 *     businesses those leads came from
 */
async function scopeFor(subject: NoteSubject): Promise<Scope> {
  const scope = emptyScope();
  scope[subject.kind].push(subject.id);
  const add = (kind: NoteSubjectKind, id: string | null | undefined) => {
    if (id && !scope[kind].includes(id)) scope[kind].push(id);
  };

  if (subject.kind === "lead") {
    const { data } = await supabase
      .from("leads")
      .select("inquiry_id, outreach_id, contact_id")
      .eq("id", subject.id)
      .maybeSingle();
    add("inquiry", data?.inquiry_id);
    add("outreach", data?.outreach_id);
    add("contact", data?.contact_id);
  } else if (subject.kind === "inquiry") {
    const [{ data: inquiry }, { data: lead }] = await Promise.all([
      supabase.from("booking_inquiries").select("contact_id").eq("id", subject.id).maybeSingle(),
      supabase.from("leads").select("id").eq("inquiry_id", subject.id).maybeSingle(),
    ]);
    add("contact", inquiry?.contact_id);
    add("lead", lead?.id);
  } else if (subject.kind === "outreach") {
    const { data: lead } = await supabase
      .from("leads")
      .select("id, contact_id")
      .eq("outreach_id", subject.id)
      .maybeSingle();
    add("lead", lead?.id);
    add("contact", lead?.contact_id);
  } else {
    const [{ data: inquiries }, { data: leads }] = await Promise.all([
      supabase.from("booking_inquiries").select("id").eq("contact_id", subject.id),
      supabase.from("leads").select("id, inquiry_id, outreach_id").eq("contact_id", subject.id),
    ]);
    for (const i of inquiries ?? []) add("inquiry", i.id);
    for (const l of leads ?? []) {
      add("lead", l.id);
      add("inquiry", l.inquiry_id);
      add("outreach", l.outreach_id);
    }
  }
  return scope;
}

/** The timeline for a subject, newest first */
export async function fetchNotes(subject: NoteSubject): Promise<Note[]> {
  const scope = await scopeFor(subject);
  const filters = (Object.keys(scope) as NoteSubjectKind[])
    .filter((kind) => scope[kind].length > 0)
    .map((kind) => `${COLUMN[kind]}.in.(${scope[kind].join(",")})`);

  const { data, error } = await supabase
    .from("notes")
    .select(NOTE_COLUMNS)
    .or(filters.join(","))
    .order("created_at", { ascending: false });
  if (error) throw new Error(error.message);
  return (data ?? []) as Note[];
}

export async function addNote(subject: NoteSubject, body: string): Promise<Note> {
  const { data, error } = await supabase
    .from("notes")
    .insert({ [COLUMN[subject.kind]]: subject.id, body: body.trim() })
    .select(NOTE_COLUMNS)
    .single();
  if (error) throw new Error(error.message);
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
export function noteOrigin(note: Note, viewing: NoteSubject): string | null {
  const kind = (Object.keys(COLUMN) as NoteSubjectKind[]).find((k) => note[COLUMN[k]]);
  if (!kind || (kind === viewing.kind && note[COLUMN[kind]] === viewing.id)) return null;
  return { contact: "On the contact", inquiry: "On the enquiry", outreach: "In Outreach", lead: "On the lead" }[kind];
}
