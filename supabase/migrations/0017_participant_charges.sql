-- Monthly charges ledger. Each billing run inserts one row per (participant,
-- cycle) with the cuota frozen at that month's exchange rate, marked paid when
-- the prepaid balance covered it. Unpaid past rows are the member's arrears:
-- the admin sees who owes which months (at each month's price) and the member
-- can settle them all at once. `group_participants.pay_cycles` records which
-- cycles a submitted receipt is paying so approval marks exactly those rows.
-- Idempotent.

create table if not exists public.participant_charges (
  id             uuid primary key default gen_random_uuid(),
  group_id       uuid not null references public.groups (id) on delete cascade,
  participant_id uuid not null references public.group_participants (id) on delete cascade,
  cycle          text not null,               -- yyyy-mm
  cuota          numeric not null,            -- Bs charged that month
  paid           boolean not null default false,
  paid_at        timestamptz,
  created_at     timestamptz not null default now(),
  unique (participant_id, cycle)
);
create index if not exists charges_group_cycle_idx on public.participant_charges (group_id, cycle);

alter table public.participant_charges enable row level security;

drop policy if exists "charges: select via group" on public.participant_charges;
create policy "charges: select via group" on public.participant_charges
  for select to authenticated
  using (
    public.is_group_admin(group_id, (select auth.uid()))
    or public.is_group_member(group_id, (select auth.uid()))
  );

drop policy if exists "charges: admin writes" on public.participant_charges;
create policy "charges: admin writes" on public.participant_charges
  for all to authenticated
  using (public.is_group_admin(group_id, (select auth.uid())))
  with check (public.is_group_admin(group_id, (select auth.uid())));

grant select, insert, update, delete on public.participant_charges to authenticated;

alter table public.group_participants
  add column if not exists pay_cycles text[];

notify pgrst, 'reload schema';
