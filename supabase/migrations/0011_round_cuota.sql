-- Per-group option: round each member's cuota up to the next whole Bs so the
-- admin collects tidy amounts (the small surplus covers rate drift). Idempotent.

alter table public.groups
  add column if not exists round_cuota boolean not null default false;

notify pgrst, 'reload schema';
