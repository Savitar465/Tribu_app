-- Per-member prepaid balance (replaces the shared "fondo común" flow).
-- A member pays several months in advance; once the admin approves the
-- receipt the amount is credited to `prepaid_balance` (Bs). Each monthly
-- charge deducts that month's frozen cuota from the balance and auto-marks
-- the member paid; leftovers roll over, shortfalls stay as compensation for
-- the next top-up. `prepay_pending`/`prepay_months` hold a submitted prepay
-- awaiting admin approval, and `billed_cycle` stamps the last cycle processed
-- per participant so the deduction never runs twice. Idempotent.

alter table public.group_participants
  add column if not exists prepaid_balance numeric not null default 0,
  add column if not exists prepay_pending numeric,
  add column if not exists prepay_months int,
  add column if not exists billed_cycle text;

notify pgrst, 'reload schema';
