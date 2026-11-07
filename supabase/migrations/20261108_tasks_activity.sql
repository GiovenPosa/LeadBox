-- Tasks and activity.
--
-- tasks: things to do, with an optional due date, on a contact, an enquiry,
-- an outreach business or a lead. Like notes, each belongs to exactly one
-- thing, and the app shows the tasks from everything connected to what you're
-- looking at, so they follow a relationship through its lifecycle. They
-- replace outreach's single next step (outreach.next_step / next_step_due),
-- which become each business's first open task.
--
-- activity: a log of what happened ("Sarah moved to Proposal"), written by the
-- app whenever something changes, for the dashboard's feed. A row keeps its
-- summary text even if what it refers to is later deleted.
--
-- Deleting what a task belongs to deletes the task; removing a lead moves its
-- tasks to the contact (the remove-lead route does it, as for notes).

create table public.tasks (
  id uuid primary key default gen_random_uuid(),
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now(),
  author_id uuid default auth.uid(),

  title text not null check (length(trim(title)) > 0),
  due_on date,
  done_at timestamptz,

  contact_id uuid references public.contacts (id) on delete cascade,
  inquiry_id uuid references public.booking_inquiries (id) on delete cascade,
  outreach_id uuid references public.outreach (id) on delete cascade,
  lead_id uuid references public.leads (id) on delete cascade,

  constraint tasks_one_subject
    check (num_nonnulls(contact_id, inquiry_id, outreach_id, lead_id) = 1)
);

alter table public.tasks enable row level security;

create policy "Admins manage tasks"
  on public.tasks
  for all
  to authenticated
  using (exists (select 1 from public.app_admins a where a.user_id = auth.uid()))
  with check (exists (select 1 from public.app_admins a where a.user_id = auth.uid()));

create trigger tasks_set_updated_at
  before update on public.tasks
  for each row execute function set_updated_at();

-- open tasks by due date, for the dashboard
create index tasks_open_due_idx on public.tasks (due_on) where done_at is null;
create index tasks_contact_id_idx on public.tasks (contact_id) where contact_id is not null;
create index tasks_inquiry_id_idx on public.tasks (inquiry_id) where inquiry_id is not null;
create index tasks_outreach_id_idx on public.tasks (outreach_id) where outreach_id is not null;
create index tasks_lead_id_idx on public.tasks (lead_id) where lead_id is not null;

-- Outreach next steps become open tasks (or done ones, for businesses that
-- are already leads)
insert into public.tasks (outreach_id, title, due_on, done_at, created_at, updated_at)
select
  id,
  coalesce(nullif(trim(next_step), ''), 'Follow up'),
  next_step_due,
  case when stage = 'converted' then updated_at end,
  updated_at,
  updated_at
from public.outreach
where nullif(trim(next_step), '') is not null or next_step_due is not null;

comment on column public.outreach.next_step is
  'Legacy: moved into public.tasks by 20261108_tasks_activity.sql. No longer used by the app; safe to drop.';
comment on column public.outreach.next_step_due is
  'Legacy: moved into public.tasks by 20261108_tasks_activity.sql. No longer used by the app; safe to drop.';

create table public.activity (
  id uuid primary key default gen_random_uuid(),
  created_at timestamptz not null default now(),
  actor_id uuid default auth.uid(),

  -- e.g. lead.stage, enquiry.converted, outreach.promoted, task.done
  kind text not null,
  -- what happened, in words, e.g. "Sarah Mitchell moved to Proposal"
  summary text not null,

  -- what it was about, for linking from the feed (kept if those are deleted)
  contact_id uuid references public.contacts (id) on delete set null,
  inquiry_id uuid references public.booking_inquiries (id) on delete set null,
  outreach_id uuid references public.outreach (id) on delete set null,
  lead_id uuid references public.leads (id) on delete set null
);

alter table public.activity enable row level security;

create policy "Admins read and add activity"
  on public.activity
  for all
  to authenticated
  using (exists (select 1 from public.app_admins a where a.user_id = auth.uid()))
  with check (exists (select 1 from public.app_admins a where a.user_id = auth.uid()));

create index activity_created_at_idx on public.activity (created_at desc);
