-- Logic moves out of the database and into code.
--
-- What these functions and triggers did now happens in:
--   - the lead app's API routes (src/app/api), as Postgres transactions:
--       convert_inquiry_to_lead   → POST /api/leads/convert
--       remove_lead               → POST /api/leads/remove
--       promote_outreach_to_lead  → POST /api/leads/promote
--       delete_contact            → POST /api/contacts/delete
--       sync_outreach_stage_from_lead (trigger) → the promote and remove routes
--   - the website's enquiry Worker (gios-build2 worker/enquiry.ts):
--       link_enquiry_contact (trigger) and contact_for_enquiry → contactFor()
--
-- The rules about the data itself stay in the database: unique emails,
-- "email or phone", "a lead has a contact", the stage list and the foreign keys.
--
-- RUN THIS LAST, only once both are live:
--   1. the lead app with the API routes is deployed (with SUPABASE_DB_URL set)
--   2. the website's Worker with contactFor() is deployed
-- Before that, the live app and website still rely on these.
--
-- get_or_create_contact predates this work and is left alone.

drop trigger if exists leads_sync_outreach_stage on public.leads;
drop function if exists public.sync_outreach_stage_from_lead();

drop trigger if exists booking_inquiries_link_contact on public.booking_inquiries;
drop function if exists public.link_enquiry_contact();
drop function if exists public.contact_for_enquiry(text, text, text, text);
drop function if exists public.contact_for_enquiry(text, text, text);

drop function if exists public.convert_inquiry_to_lead(uuid);
drop function if exists public.remove_lead(uuid);
drop function if exists public.promote_outreach_to_lead(uuid, uuid, text, text, text, text);
drop function if exists public.delete_contact(uuid);
