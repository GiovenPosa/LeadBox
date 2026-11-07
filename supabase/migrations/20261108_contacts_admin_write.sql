-- Let the lead app add and edit contacts.
--
-- Contacts used to be created only by the server (the old submit-inquiry
-- function, now the enquiry trigger), so row level security only let signed-in
-- users read them. The app now adds contacts by hand, edits them, and saves a
-- lead's business name onto its contact, so admins need insert and update too.
-- Without these, an update matches no rows and quietly changes nothing.
--
-- Admins are the users listed in app_admins, as elsewhere in this database.
-- Deleting contacts is still not allowed from the app.

drop policy if exists "Admins add contacts" on public.contacts;
create policy "Admins add contacts"
  on public.contacts
  for insert
  to authenticated
  with check (exists (select 1 from public.app_admins a where a.user_id = auth.uid()));

drop policy if exists "Admins edit contacts" on public.contacts;
create policy "Admins edit contacts"
  on public.contacts
  for update
  to authenticated
  using (exists (select 1 from public.app_admins a where a.user_id = auth.uid()))
  with check (exists (select 1 from public.app_admins a where a.user_id = auth.uid()));
