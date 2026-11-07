-- An industry for each contact.
--
-- Free text, not a fixed list: it will grow over time. It's filled in
-- automatically where we already know it, and only ever into a blank, so a
-- value typed in the app is never overwritten:
--   - an enquiry: the business types they ticked on the website form
--   - an outreach business promoted to a lead: its outreach industry
--
-- (A lead's channel isn't stored: an enquiry lead came from the website, an
-- outreach lead from its outreach channel.)
--
-- Run after 20261108_outreach_leads.sql.

alter table public.contacts
  add column if not exists industry text;

-- The enquiry trigger's helper now takes the industry too. Replaced rather
-- than overloaded, so there's one version.
drop function if exists public.contact_for_enquiry(text, text, text);

create or replace function public.contact_for_enquiry(
  p_email text,
  p_name text,
  p_phone text,
  p_industry text default null
)
returns uuid
language plpgsql
security definer
set search_path = public
as $$
declare
  v_contact_id uuid;
  v_email text := nullif(trim(p_email), '');
  v_name text := nullif(trim(p_name), '');
  v_phone text := nullif(trim(p_phone), '');
  v_industry text := nullif(trim(p_industry), '');
begin
  if v_email is null then
    return null;
  end if;

  select id into v_contact_id
  from public.contacts
  where email = v_email::citext
  limit 1;

  if v_contact_id is null then
    insert into public.contacts (email, name, phone_numbers, industry)
    values (v_email, v_name, case when v_phone is null then '{}'::text[] else array[v_phone] end, v_industry)
    returning id into v_contact_id;
  else
    update public.contacts
    set
      name = coalesce(nullif(trim(name), ''), v_name),
      industry = coalesce(nullif(trim(industry), ''), v_industry),
      phone_numbers = case
        when v_phone is null or v_phone = any (coalesce(phone_numbers, '{}')) then phone_numbers
        else array_append(coalesce(phone_numbers, '{}'), v_phone)
      end
    where id = v_contact_id;
  end if;

  return v_contact_id;
end;
$$;

revoke execute on function public.contact_for_enquiry(text, text, text, text) from public, anon, authenticated;

create or replace function public.link_enquiry_contact()
returns trigger
language plpgsql
security definer
set search_path = public
as $$
begin
  if new.contact_id is null then
    new.contact_id := public.contact_for_enquiry(
      new.email,
      new.name,
      new.phone,
      nullif(array_to_string(new.selected_types, ', '), '')
    );
  end if;
  return new;
end;
$$;

-- Promoting now also gives the contact the outreach business's industry
-- ("salons" becomes "Salons") if it has none. Otherwise as before.
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
  v_industry text;
  result public.leads;
begin
  select * into result from public.leads where outreach_id = p_outreach_id;
  if found then
    return result;
  end if;

  select initcap(replace(industry, '_', ' ')) into v_industry
  from public.outreach
  where id = p_outreach_id;

  if v_contact_id is null then
    if v_email is not null then
      select id into v_contact_id from public.contacts where email = v_email::citext limit 1;
    end if;

    if v_contact_id is null then
      if v_email is null and v_phone is null then
        raise exception 'Add an email or a phone number for the contact.';
      end if;

      insert into public.contacts (email, name, phone_numbers, business_name, industry)
      values (v_email, v_name, case when v_phone is null then '{}'::text[] else array[v_phone] end, v_business, v_industry)
      returning id into v_contact_id;
    else
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

  -- whichever contact it is, fill a blank industry
  update public.contacts
  set industry = v_industry
  where id = v_contact_id and nullif(trim(industry), '') is null;

  insert into public.leads (outreach_id, contact_id)
  values (p_outreach_id, v_contact_id)
  returning * into result;

  return result;
end;
$$;

-- Existing contacts: their latest enquiry's business types first, then the
-- industry of an outreach business they were promoted from
update public.contacts c
set industry = latest.types
from (
  select distinct on (contact_id)
    contact_id,
    nullif(array_to_string(selected_types, ', '), '') as types
  from public.booking_inquiries
  where contact_id is not null
  order by contact_id, created_at desc
) latest
where latest.contact_id = c.id
  and latest.types is not null
  and nullif(trim(c.industry), '') is null;

update public.contacts c
set industry = initcap(replace(o.industry, '_', ' '))
from public.leads l
join public.outreach o on o.id = l.outreach_id
where l.contact_id = c.id
  and nullif(trim(c.industry), '') is null;
