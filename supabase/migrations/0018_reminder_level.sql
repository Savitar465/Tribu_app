-- Staggered automatic payment reminders. `reminder_level` tracks the last
-- reminder tier sent for an unpaid charge (0 = none, 1 = sent at 3 days,
-- 2 = sent at 7 days) so the daily process-billing run never notifies the
-- same tier twice. Idempotent.

alter table public.participant_charges
  add column if not exists reminder_level int not null default 0;

notify pgrst, 'reload schema';
