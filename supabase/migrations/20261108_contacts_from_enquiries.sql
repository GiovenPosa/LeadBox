-- Every enquiry gets a contact.
--
-- The old submit-inquiry edge function used to create a contact for each
-- enquiry and set booking_inquiries.contact_id. When the website form moved to
-- the Cloudflare Worker (21 Oct 2026) nothing took that over, so enquiries
-- since then have no contact. This puts it in the database instead, so it
-- happens however an enquiry is saved (the Worker, a script, a mock).
--
-- Contacts are matched by email (contacts.email is citext, so case doesn't
-- matter). A returning enquirer keeps one contact; a new phone number is added
-- to their list, and their name is filled in if it was missing.

-- Find or create the contact for these details, and return its id
create or replace function public.contact_for_enquiry(p_email text, p_name text, p_phone text)
returns uuid
language plpgsql
-- runs as the owner, so it works whatever role saves the enquiry
security definer
set search_path = public
as $$
declare
  v_contact_id uuid;
  v_email text := nullif(trim(p_email), '');
  v_name text := nullif(trim(p_name), '');
  v_phone text := nullif(trim(p_phone), '');
begin
  if v_email is null then
    return null;
  end if;

  select id into v_contact_id
  from public.contacts
  where email = v_email::citext
  limit 1;

  if v_contact_id is null then
    insert into public.contacts (email, name, phone_numbers)
    values (v_email, v_name, case when v_phone is null then '{}'::text[] else array[v_phone] end)
    returning id into v_contact_id;
  else
    update public.contacts
    set
      name = coalesce(nullif(trim(name), ''), v_name),
      phone_numbers = case
        when v_phone is null or v_phone = any (coalesce(phone_numbers, '{}')) then phone_numbers
        else array_append(coalesce(phone_numbers, '{}'), v_phone)
      end
    where id = v_contact_id;
  end if;

  return v_contact_id;
end;
$$;

-- Not callable from the app: only the trigger below uses it
revoke execute on function public.contact_for_enquiry(text, text, text) from public, anon, authenticated;

create or replace function public.link_enquiry_contact()
returns trigger
language plpgsql
-- as the owner too, so it can call contact_for_enquiry whoever saves the enquiry
security definer
set search_path = public
as $$
begin
  if new.contact_id is null then
    new.contact_id := public.contact_for_enquiry(new.email, new.name, new.phone);
  end if;
  return new;
end;
$$;

drop trigger if exists booking_inquiries_link_contact on public.booking_inquiries;

create trigger booking_inquiries_link_contact
  before insert on public.booking_inquiries
  for each row execute function public.link_enquiry_contact();

-- Give the enquiries already saved without one a contact, oldest first so a
-- contact's details come from their first enquiry and later numbers are added.
do $$
declare
  r record;
begin
  for r in
    select id, email, name, phone from public.booking_inquiries
    where contact_id is null and nullif(trim(email), '') is not null
    order by created_at
  loop
    update public.booking_inquiries
    set contact_id = public.contact_for_enquiry(r.email, r.name, r.phone)
    where id = r.id;
  end loop;
end;
$$;
