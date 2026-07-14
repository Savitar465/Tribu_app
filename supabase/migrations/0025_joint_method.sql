-- Joint-payment collection method: the admin picks ONE of their joint groups
-- whose payment methods (QR / PayPal / bank) the whole bundle uses. At most
-- one group per owner can be the source (partial unique index). Only the
-- owner can flip it (existing "groups: update own" policy). Idempotent.

alter table public.groups
  add column if not exists joint_method boolean not null default false;

drop index if exists groups_joint_method_owner_idx;
create unique index groups_joint_method_owner_idx
  on public.groups (owner_id)
  where joint_method;

notify pgrst, 'reload schema';
