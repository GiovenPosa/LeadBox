-- Leads, part 1 of 2: a "converted" enquiry status.
--
-- An enquiry is now New, Contacted, Converted (turned into a lead) or Bad;
-- what happens after conversion is tracked on the lead (part 2).
--
-- Run this on its own, before part 2: Postgres can't use a new enum value in
-- the same transaction that adds it. The old values (qualified, won, lost)
-- stay in the type, because Postgres can't drop enum values, but part 2 moves
-- every enquiry off them and the app no longer sets them.

alter type public.opportunity_status add value if not exists 'converted';
