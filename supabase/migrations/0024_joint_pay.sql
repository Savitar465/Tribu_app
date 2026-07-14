-- Joint payment ("pago conjunto"): the admin marks which of their groups can
-- be paid together. A member owing months across two or more of the same
-- admin's joint groups gets the combined-payment option — one QR, one receipt,
-- one transaction — while each group keeps its own ledger. Groups left
-- unmarked are always paid individually. Only the owner can flip the flag
-- (covered by the existing "groups: update own" policy). Idempotent.

alter table public.groups
  add column if not exists joint_pay boolean not null default false;

notify pgrst, 'reload schema';
