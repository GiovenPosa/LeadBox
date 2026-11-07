-- An outreach business that becomes a lead moves to a "converted" stage
-- (shown as "Lead"), like an enquiry's "converted" status. From then on the
-- deal is tracked on the lead.
--
-- The lead app's API routes set it: /api/leads/promote moves the business to
-- converted, /api/leads/remove moves it back to replied. (An earlier version
-- of this file did that with a trigger; 20261108_move_logic_to_app.sql drops
-- it if it was created.)
--
-- Run after 20261108_outreach_leads.sql. Safe to run again.

alter table public.outreach
  drop constraint if exists outreach_stage_check;

alter table public.outreach
  add constraint outreach_stage_check
  check (stage in ('messaged', 'replied', 'mockup', 'chat', 'quoted', 'converted', 'won', 'lost', 'no_reply'));

-- Businesses already promoted
update public.outreach o
set stage = 'converted'
from public.leads l
where l.outreach_id = o.id and o.stage <> 'converted';
