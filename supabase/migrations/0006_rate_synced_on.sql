-- Track the day the official BCB rate was last auto-applied to a profile, so the
-- app adopts the official rate at most once per calendar day (manual overrides
-- via the FX screen still stand until the next day's sync). Idempotent.

alter table public.profiles
  add column if not exists rate_synced_on date;

notify pgrst, 'reload schema';
