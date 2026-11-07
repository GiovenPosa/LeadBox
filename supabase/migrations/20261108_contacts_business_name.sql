-- A business name for each contact.
--
-- Empty for now: the website form doesn't ask for one. It's for contacts
-- added by hand in the lead app, and for outreach businesses that turn into
-- leads, both still to come.

alter table public.contacts
  add column if not exists business_name text;
