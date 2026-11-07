-- Outreach businesses can become leads.
--
-- 1. Contacts: email becomes optional, but every contact needs an email or a
--    phone number. Outreach businesses often have no email; enquiries always
--    do, and matching enquiries to contacts by email still works.
-- 2. Qualification answers belong to the lead, not the enquiry, so a lead
--    without an enquiry (from outreach) can be qualified too.
-- 3. leads.outreach_id links a lead to the outreach business it came from.
-- 4. promote_outreach_to_lead() creates (or reuses) the contact and the lead
--    in one step.
--
-- Run after 20261108_leads_contact.sql and 20261108_contacts_admin_write.sql.

-- 1. Contacts: an email or a phone number
alter table public.contacts
  alter column email drop not null;

alter table public.contacts
  drop constraint if exists contacts_email_or_phone;

alter table public.contacts
  add constraint contacts_email_or_phone
  check (email is not null or cardinality(phone_numbers) > 0);

-- 2. Qualification answers keyed by lead
alter table public.lead_qualifications
  add column if not exists lead_id uuid references public.leads (id) on delete cascade;

update public.lead_qualifications q
set lead_id = l.id
from public.leads l
where l.inquiry_id = q.inquiry_id and q.lead_id is null;

-- 20261108_leads_2_table.sql already made every enquiry with answers a lead,
-- so nothing should be left without one; anything that is can't be reached
delete from public.lead_qualifications where lead_id is null;

do $$
declare
  pk text;
begin
  select conname into pk
  from pg_constraint
  where conrelid = 'public.lead_qualifications'::regclass and contype = 'p';
  if pk is not null then
    execute format('alter table public.lead_qualifications drop constraint %I', pk);
  end if;
end;
$$;

alter table public.lead_qualifications
  alter column lead_id set not null;

alter table public.lead_qualifications
  add primary key (lead_id);

-- still recorded for enquiry leads; empty for outreach ones
alter table public.lead_qualifications
  alter column inquiry_id drop not null;

-- 3. Where an outreach lead came from. Deleting the outreach row keeps the
-- lead: it has its own contact.
alter table public.leads
  add column if not exists outreach_id uuid unique references public.outreach (id) on delete set null;

-- Removing a lead: its qualification answers go with it (cascade); an
-- enquiry goes back to contacted
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
    update public.booking_inquiries
    set opportunity_status = 'contacted'
    where id = v_inquiry_id;
  end if;
end;
$$;

-- 4. Promote an outreach business to a lead.
-- Pass p_contact_id to use an existing contact. Otherwise the details are
-- used to find a contact by email or create a new one (an email or a phone is
-- required). Promoting the same business again returns its existing lead.
create or replace function public.promote_outreach_to_lead(
  p_outreach_id uuid,
  p_contact_id uuid,
  p_name text,
  p_email text,
  p_phone text,
  p_business text
)
returns public.leads
language plpgsql
security invoker
set search_path = public
as $$
declare
  v_contact_id uuid := p_contact_id;
  v_name text := nullif(trim(p_name), '');
  v_email text := nullif(trim(p_email), '');
  v_phone text := nullif(trim(p_phone), '');
  v_business text := nullif(trim(p_business), '');
  result public.leads;
begin
  select * into result from public.leads where outreach_id = p_outreach_id;
  if found then
    return result;
  end if;

  if v_contact_id is null then
    if v_email is not null then
      select id into v_contact_id from public.contacts where email = v_email::citext limit 1;
    end if;

    if v_contact_id is null then
      if v_email is null and v_phone is null then
        raise exception 'Add an email or a phone number for the contact.';
      end if;

      insert into public.contacts (email, name, phone_numbers, business_name)
      values (v_email, v_name, case when v_phone is null then '{}'::text[] else array[v_phone] end, v_business)
      returning id into v_contact_id;
    else
      -- an existing contact with that email: fill in what it's missing
      update public.contacts
      set
        name = coalesce(nullif(trim(name), ''), v_name),
        business_name = coalesce(nullif(trim(business_name), ''), v_business),
        phone_numbers = case
          when v_phone is null or v_phone = any (phone_numbers) then phone_numbers
          else array_append(phone_numbers, v_phone)
        end
      where id = v_contact_id;
    end if;
  end if;

  insert into public.leads (outreach_id, contact_id)
  values (p_outreach_id, v_contact_id)
  returning * into result;

  return result;
end;
$$;

grant execute on function public.promote_outreach_to_lead(uuid, uuid, text, text, text, text) to authenticated;
