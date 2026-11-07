-- Delete a contact from the lead app.
--
-- A contact goes with their enquiries: every enquiry belongs to a contact, so
-- leaving them behind unlinked would break that rule. A contact with a lead
-- can't be deleted; remove the lead first (a lead always needs a contact).
--
-- One function, so it all happens or nothing does. It runs as the owner, so
-- the app doesn't need broad delete rights on enquiries, and checks for an
-- admin (app_admins) itself. Returns how many enquiries were deleted.

create or replace function public.delete_contact(p_contact_id uuid)
returns integer
language plpgsql
security definer
set search_path = public
as $$
declare
  v_enquiries integer;
begin
  if not exists (select 1 from public.app_admins where user_id = auth.uid()) then
    raise exception 'Your account isn''t allowed to delete contacts.';
  end if;

  if exists (select 1 from public.leads where contact_id = p_contact_id) then
    raise exception 'This contact has a lead. Remove the lead first, then delete the contact.';
  end if;

  -- answers left over from before qualifications belonged to leads
  delete from public.lead_qualifications
  where inquiry_id in (select id from public.booking_inquiries where contact_id = p_contact_id);

  with deleted as (
    delete from public.booking_inquiries where contact_id = p_contact_id returning 1
  )
  select count(*) into v_enquiries from deleted;

  delete from public.contacts where id = p_contact_id;
  if not found then
    raise exception 'That contact no longer exists.';
  end if;

  return v_enquiries;
end;
$$;

revoke execute on function public.delete_contact(uuid) from public, anon;
grant execute on function public.delete_contact(uuid) to authenticated;
