-- Activity lines remember which task they were about, so unticking a task can
-- take its "Done" line back out of the feed. Ticking it again writes a fresh
-- one, so the feed shows each task's current state once, not every click.
--
-- Existing "Done" lines are matched to their task by what it was on and its
-- title. Lines for tasks that are no longer done are removed, and repeats of
-- the same task keep only the latest.

alter table public.activity
  add column if not exists task_id uuid references public.tasks (id) on delete set null;

update public.activity a
set task_id = t.id
from public.tasks t
where a.kind = 'task.done'
  and a.task_id is null
  and a.summary = 'Done: ' || t.title
  and (
    (a.outreach_id is not null and a.outreach_id = t.outreach_id)
    or (a.lead_id is not null and a.lead_id = t.lead_id)
    or (a.inquiry_id is not null and a.inquiry_id = t.inquiry_id)
    or (a.contact_id is not null and a.contact_id = t.contact_id)
  );

-- "Done" lines for tasks that aren't done any more
delete from public.activity a
using public.tasks t
where a.kind = 'task.done' and a.task_id = t.id and t.done_at is null;

-- repeats for the same task: keep the latest
delete from public.activity a
where a.kind = 'task.done'
  and a.task_id is not null
  and exists (
    select 1 from public.activity b
    where b.kind = 'task.done' and b.task_id = a.task_id and b.created_at > a.created_at
  );

create index if not exists activity_task_id_idx on public.activity (task_id) where task_id is not null;
