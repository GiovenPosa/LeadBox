-- Outreach: businesses Gio has contacted first (cold DMs, walk-ins), as
-- opposed to booking_inquiries, which are people who came to him.
--
-- The stages follow the outreach playbook's ladder: messaged, replied,
-- mock-up, chat, quoted, then won or lost. The objection keys match the
-- playbook's reply scripts.
--
-- The lead app reads and writes this with the signed-in user's session, so
-- row level security allows authenticated users and nobody else.

create table public.outreach (
  id uuid primary key default gen_random_uuid(),
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now(),

  business_name text not null check (length(trim(business_name)) > 0),
  industry text not null default 'other'
    check (industry in ('salons', 'barbers', 'food', 'trades', 'fitness', 'pets', 'other')),
  channel text not null default 'instagram'
    check (channel in ('instagram', 'facebook', 'in_person', 'email', 'phone', 'other')),
  -- an @handle or a profile link
  handle text,
  town text,

  first_contacted_on date not null default current_date,
  stage text not null default 'messaged'
    check (stage in ('messaged', 'replied', 'mockup', 'chat', 'quoted', 'won', 'lost', 'no_reply')),

  objection text
    check (objection in ('too_expensive', 'busy_enough', 'has_platform', 'not_now', 'burned_before',
                         'diy', 'not_decision_maker', 'wants_info', 'other')),
  objection_reason text,

  next_step text,
  next_step_due date,
  notes text
);

alter table public.outreach enable row level security;

create policy "Signed-in users manage outreach"
  on public.outreach
  for all
  to authenticated
  using (true)
  with check (true);

-- the same updated_at helper the contacts table uses
create trigger outreach_set_updated_at
  before update on public.outreach
  for each row execute function set_updated_at();

-- follow-ups due soonest, for the "Due" filter
create index outreach_next_step_due_idx
  on public.outreach (next_step_due)
  where next_step_due is not null;
