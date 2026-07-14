-- Charge-ledger privacy: a non-admin member may only read their OWN charge
-- rows. Previously any group member could read the whole group's ledger
-- ("charges: select via group"), exposing fellow members' owed months and
-- amounts. Admins keep full visibility over their groups' ledgers.
-- Idempotent.

drop policy if exists "charges: select via group" on public.participant_charges;
drop policy if exists "charges: select own or admin" on public.participant_charges;
create policy "charges: select own or admin" on public.participant_charges
  for select to authenticated
  using (
    public.is_group_admin(group_id, (select auth.uid()))
    or exists (
      select 1
      from public.group_participants gp
      where gp.id = participant_id
        and gp.user_id = (select auth.uid())
    )
  );

notify pgrst, 'reload schema';
