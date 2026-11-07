-- Outreach keeps only the stages before a deal: messaged, replied, mock-up,
-- chat and no reply, plus converted ("Lead"), set when the business is
-- promoted. Quoting, winning and losing happen on the lead.
--
-- Any business still on a removed stage moves to the nearest one left:
-- quoted to chat, won to converted (if it has a lead) or chat, lost to no_reply.

update public.outreach o
set stage = case
  when o.stage = 'quoted' then 'chat'
  when o.stage = 'won' and exists (select 1 from public.leads l where l.outreach_id = o.id) then 'converted'
  when o.stage = 'won' then 'chat'
  when o.stage = 'lost' then 'no_reply'
  else o.stage
end
where o.stage in ('quoted', 'won', 'lost');

alter table public.outreach
  drop constraint if exists outreach_stage_check;

alter table public.outreach
  add constraint outreach_stage_check
  check (stage in ('messaged', 'replied', 'mockup', 'chat', 'converted', 'no_reply'));
