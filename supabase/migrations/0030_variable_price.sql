-- Variable monthly prices (e.g. luz, agua): the amount changes every month, so
-- the charge must wait for the admin to set this month's price. When the
-- billing day arrives for a `variable_price` group, the processors skip the
-- charge and notify the admin instead; confirming the price stamps
-- `price_confirmed_cycle` and the charge runs immediately.

alter table public.groups
  add column if not exists variable_price boolean not null default false,
  add column if not exists price_confirmed_cycle text,
  add column if not exists price_request_cycle text;

comment on column public.groups.variable_price is
  'True when the monthly amount changes every cycle (e.g. utilities): billing waits for the admin to confirm this month''s price.';
comment on column public.groups.price_confirmed_cycle is
  'Last cycle (yyyy-mm) whose price the admin confirmed; billing a variable-price group requires it to match the current cycle.';
comment on column public.groups.price_request_cycle is
  'Last cycle (yyyy-mm) the admin was asked to update the price for (dedupes the request notification across billing runs).';
