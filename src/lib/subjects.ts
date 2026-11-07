// The things notes, tasks and activity can be about: a contact, an enquiry, an
// outreach business or a lead, and what each is connected to. Shared so notes
// and tasks follow a relationship through its lifecycle the same way.

import { supabase } from "./supabaseClient";

export type SubjectKind = "contact" | "inquiry" | "outreach" | "lead";

/** One contact, enquiry, outreach business or lead */
export type Subject = { kind: SubjectKind; id: string };

/** The column on notes, tasks and activity that points at each kind */
export const SUBJECT_COLUMN = {
  contact: "contact_id",
  inquiry: "inquiry_id",
  outreach: "outreach_id",
  lead: "lead_id",
} as const;

export type SubjectRefs = {
  contact_id: string | null;
  inquiry_id: string | null;
  outreach_id: string | null;
  lead_id: string | null;
};

type Scope = Record<SubjectKind, string[]>;

const KINDS = Object.keys(SUBJECT_COLUMN) as SubjectKind[];

/**
 * Everything connected to a subject, whose notes and tasks belong with it:
 *   - a lead: itself, the enquiry or outreach business it came from, its contact
 *   - an enquiry: itself, its contact, the lead it became
 *   - an outreach business: itself, the lead it became and that lead's contact
 *   - a contact: itself, all their enquiries and leads, and the outreach
 *     businesses those leads came from
 */
export async function scopeFor(subject: Subject): Promise<Scope> {
  const scope: Scope = { contact: [], inquiry: [], outreach: [], lead: [] };
  scope[subject.kind].push(subject.id);
  const add = (kind: SubjectKind, id: string | null | undefined) => {
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

/** A PostgREST or() filter matching rows about anything in the scope */
export function scopeFilter(scope: Scope): string {
  return KINDS.filter((kind) => scope[kind].length > 0)
    .map((kind) => `${SUBJECT_COLUMN[kind]}.in.(${scope[kind].join(",")})`)
    .join(",");
}

/** The column and id to save a row about this subject, e.g. { lead_id: "…" } */
export const subjectRef = (subject: Subject) => ({ [SUBJECT_COLUMN[subject.kind]]: subject.id });

/** Which kind of thing a row is about */
export const subjectOf = (row: SubjectRefs): Subject | null => {
  const kind = KINDS.find((k) => row[SUBJECT_COLUMN[k]]);
  return kind ? { kind, id: row[SUBJECT_COLUMN[kind]]! } : null;
};

/** Where a note or task was written, from the point of view of the subject being viewed */
export function originLabel(row: SubjectRefs, viewing: Subject): string | null {
  const from = subjectOf(row);
  if (!from || (from.kind === viewing.kind && from.id === viewing.id)) return null;
  return { contact: "On the contact", inquiry: "On the enquiry", outreach: "In Outreach", lead: "On the lead" }[from.kind];
}

/** Where to open a subject in the app */
export function subjectHref(subject: Subject): string {
  switch (subject.kind) {
    case "lead":
      return `/leads/${subject.id}`;
    case "inquiry":
      return `/inbox?open=${subject.id}`;
    case "outreach":
      return `/outreach?open=${subject.id}`;
    case "contact":
      return `/contacts?open=${subject.id}`;
  }
}
