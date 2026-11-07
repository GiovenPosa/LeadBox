-- Leads, part 2 of 2: the leads table. Run after part 1.
--
-- An enquiry (booking_inquiries) is someone getting in touch. When Gio decides
-- it's worth pursuing, he turns it into a lead, which then goes through its own
-- stages: qualifying, proposal, onboarding, then won or lost.
--
-- inquiry_id is optional so a lead can come from somewhere else later (e.g. an
-- outreach reply). It's unique, so an enquiry becomes at most one lead, and
-- deleting the enquiry deletes its lead.
--
-- The lead's qualification answers stay in lead_qualifications, keyed by the
-- enquiry, as before.

create table public.leads (
  id uuid primary key default gen_random_uuid(),
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now(),
  created_by uuid default auth.uid(),

  inquiry_id uuid unique references public.booking_inquiries (id) on delete cascade,
  stage text not null default 'qualifying'
    check (stage in ('qualifying', 'proposal', 'onboarding', 'won', 'lost'))
);

alter table public.leads enable row level security;

create policy "Signed-in users manage leads"
  on public.leads
  for all
  to authenticated
  using (true)
  with check (true);

create trigger leads_set_updated_at
  before update on public.leads
  for each row execute function set_updated_at();

create index leads_stage_idx on public.leads (stage);

-- Turn an enquiry into a lead and mark the enquiry converted, in one step.
-- Calling it again for the same enquiry returns the existing lead.
create or replace function public.convert_inquiry_to_lead(p_inquiry_id uuid)
returns public.leads
language plpgsql
security invoker
set search_path = public
as $$
declare
  result public.leads;
begin
  insert into public.leads (inquiry_id)
  values (p_inquiry_id)
  on conflict (inquiry_id) do nothing;

  update public.booking_inquiries
  set opportunity_status = 'converted'
  where id = p_inquiry_id;

  select * into result from public.leads where inquiry_id = p_inquiry_id;
  return result;
end;
$$;

-- Undo a conversion: remove the lead and its qualification answers, and put
-- the enquiry back to contacted.
create or replace function public.remove_lead(p_lead_id uuid)
returns void
language plpgsql
security invoker
set search_path = public
as $$
declare
  v_inquiry_id uuid;
begin
  delete from public.leads where id = p_lead_id returning inquiry_id into v_inquiry_id;

  if v_inquiry_id is not null then
    delete from public.lead_qualifications where inquiry_id = v_inquiry_id;
    update public.booking_inquiries
    set opportunity_status = 'contacted'
    where id = v_inquiry_id;
  end if;
end;
$$;

grant execute on function public.convert_inquiry_to_lead(uuid) to authenticated;
grant execute on function public.remove_lead(uuid) to authenticated;

-- Existing enquiries on the old statuses: qualified, won and lost were really
-- lead stages, so those enquiries become leads at the matching stage. So does
-- anything that already has qualification answers.
insert into public.leads (inquiry_id, stage, created_at)
select
  b.id,
  case b.opportunity_status::text
    when 'won' then 'won'
    when 'lost' then 'lost'
    else 'qualifying'
  end,
  coalesce(q.qualified_at, b.created_at)
from public.booking_inquiries b
left join public.lead_qualifications q on q.inquiry_id = b.id
where b.opportunity_status::text in ('qualified', 'won', 'lost')
   or q.inquiry_id is not null
on conflict (inquiry_id) do nothing;

update public.booking_inquiries
set opportunity_status = 'converted'
where id in (select inquiry_id from public.leads where inquiry_id is not null);
