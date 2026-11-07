-- Notes: a running log on a contact, an enquiry, an outreach business or a
-- lead, kept across the whole lifecycle.
--
-- Each note belongs to exactly one thing (the one it was written on). The app
-- shows notes from everything connected to what you're looking at, so a note
-- written on an enquiry still shows once it's a lead, without being copied:
-- see src/lib/notes.ts.
--
-- Deleting an enquiry, outreach business or contact deletes its notes (the
-- confirm dialogs say so). Removing a lead isn't a deletion, so the lead
-- route moves its notes to the contact first; deleting a promoted outreach
-- business moves its notes to the lead.
--
-- Existing outreach notes (outreach.notes) become each business's first note.
-- The old column is left in place but no longer used by the app.

create table public.notes (
  id uuid primary key default gen_random_uuid(),
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now(),
  -- set when the text is changed after it was written
  edited_at timestamptz,
  author_id uuid default auth.uid(),

  body text not null check (length(trim(body)) > 0),

  contact_id uuid references public.contacts (id) on delete cascade,
  inquiry_id uuid references public.booking_inquiries (id) on delete cascade,
  outreach_id uuid references public.outreach (id) on delete cascade,
  lead_id uuid references public.leads (id) on delete cascade,

  constraint notes_one_subject
    check (num_nonnulls(contact_id, inquiry_id, outreach_id, lead_id) = 1)
);

alter table public.notes enable row level security;

create policy "Admins manage notes"
  on public.notes
  for all
  to authenticated
  using (exists (select 1 from public.app_admins a where a.user_id = auth.uid()))
  with check (exists (select 1 from public.app_admins a where a.user_id = auth.uid()));

create trigger notes_set_updated_at
  before update on public.notes
  for each row execute function set_updated_at();

create index notes_contact_id_idx on public.notes (contact_id) where contact_id is not null;
create index notes_inquiry_id_idx on public.notes (inquiry_id) where inquiry_id is not null;
create index notes_outreach_id_idx on public.notes (outreach_id) where outreach_id is not null;
create index notes_lead_id_idx on public.notes (lead_id) where lead_id is not null;

-- Existing outreach notes become the first note on their business
insert into public.notes (outreach_id, body, created_at, updated_at)
select id, trim(notes), updated_at, updated_at
from public.outreach
where nullif(trim(notes), '') is not null;

comment on column public.outreach.notes is
  'Legacy: moved into public.notes by 20261108_notes.sql. No longer used by the app; safe to drop.';
