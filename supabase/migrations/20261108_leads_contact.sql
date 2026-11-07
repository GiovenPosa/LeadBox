-- Every lead has a contact.
--
-- A lead is someone Gio is pursuing, so there's always a person to reach:
-- leads.contact_id is required. A lead from an enquiry takes the enquiry's
-- contact (every enquiry with an email gets one, see
-- 20261108_contacts_from_enquiries.sql); a lead from somewhere else later
-- (e.g. outreach) will need its contact created first.
--
-- A contact with a lead can't be deleted while the lead exists.
--
-- Also adds contacts.business_name if 20261108_contacts_business_name.sql
-- hasn't been run, since the lead page reads it.

alter table public.contacts
  add column if not exists business_name text;

alter table public.leads
  add column if not exists contact_id uuid references public.contacts (id) on delete restrict;

-- Existing leads take their enquiry's contact, creating it if the enquiry has none
update public.booking_inquiries b
set contact_id = public.contact_for_enquiry(b.email, b.name, b.phone)
from public.leads l
where l.inquiry_id = b.id and b.contact_id is null;

update public.leads l
set contact_id = b.contact_id
from public.booking_inquiries b
where l.inquiry_id = b.id and l.contact_id is null;

alter table public.leads
  alter column contact_id set not null;

create index if not exists leads_contact_id_idx on public.leads (contact_id);

-- Converting now carries the enquiry's contact over, and refuses an enquiry
-- without one (one with no email address).
create or replace function public.convert_inquiry_to_lead(p_inquiry_id uuid)
returns public.leads
language plpgsql
security invoker
set search_path = public
as $$
declare
  v_contact_id uuid;
  result public.leads;
begin
  select contact_id into v_contact_id
  from public.booking_inquiries
  where id = p_inquiry_id;

  if v_contact_id is null then
    raise exception 'This enquiry has no contact details, so it can''t become a lead. Add an email first.';
  end if;

  insert into public.leads (inquiry_id, contact_id)
  values (p_inquiry_id, v_contact_id)
  on conflict (inquiry_id) do nothing;

  update public.booking_inquiries
  set opportunity_status = 'converted'
  where id = p_inquiry_id;

  select * into result from public.leads where inquiry_id = p_inquiry_id;
  return result;
end;
$$;
