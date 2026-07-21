-- Freeze the exchange rate a group was last charged at. USD group totals were
-- converting at the profile's daily-synced rate, so the displayed "precio
-- total" drifted every day; with the rate captured on the billing day, prices
-- only move when the next charge runs.

alter table public.groups
  add column if not exists billed_rate numeric;

comment on column public.groups.billed_rate is
  'Bs-per-USD rate used by the last billing run; null until first charge. Display converts at this rate so totals only change on the billing day.';
