-- Real shared groups. A user can see a group they OWN or are a PARTICIPANT of
-- (linked via group_participants.user_id). Membership/ownership checks go
-- through SECURITY DEFINER helpers so the group<->participant policies do not
-- recurse (the definer functions bypass RLS on their inner queries).
-- Idempotent.

-- Link existing owner "self" rows to their profile so ownership/membership
-- resolves uniformly through group_participants.user_id.
update public.group_participants gp
set user_id = g.owner_id
from public.groups g
where gp.group_id = g.id and gp.is_self and gp.user_id is null;

-- Helpers (SECURITY DEFINER, owned by the migration role → bypass RLS).
create or replace function public.is_group_member(p_group uuid, p_user uuid)
returns boolean language sql security definer stable set search_path = '' as $$
  select exists (
    select 1 from public.group_participants gp
    where gp.group_id = p_group and gp.user_id = p_user
  );
$$;

create or replace function public.is_group_admin(p_group uuid, p_user uuid)
returns boolean language sql security definer stable set search_path = '' as $$
  select exists (
    select 1 from public.groups g
    where g.id = p_group and g.owner_id = p_user
  );
$$;

revoke execute on function public.is_group_member(uuid, uuid) from public, anon;
revoke execute on function public.is_group_admin(uuid, uuid) from public, anon;
grant execute on function public.is_group_member(uuid, uuid) to authenticated;
grant execute on function public.is_group_admin(uuid, uuid) to authenticated;

-- groups: visible to the owner and to any member.
drop policy if exists "groups: select own" on public.groups;
drop policy if exists "groups: select visible" on public.groups;
create policy "groups: select visible" on public.groups
  for select to authenticated
  using (owner_id = (select auth.uid()) or public.is_group_member(id, (select auth.uid())));

-- group_participants: roster visible to owner and members. The owner writes
-- freely; a member may update only their own row (e.g. submit a payment proof).
drop policy if exists "participants: select via group" on public.group_participants;
create policy "participants: select via group" on public.group_participants
  for select to authenticated
  using (
    public.is_group_admin(group_id, (select auth.uid()))
    or public.is_group_member(group_id, (select auth.uid()))
  );

drop policy if exists "participants: write via group" on public.group_participants;
drop policy if exists "participants: admin writes" on public.group_participants;
create policy "participants: admin writes" on public.group_participants
  for all to authenticated
  using (public.is_group_admin(group_id, (select auth.uid())))
  with check (public.is_group_admin(group_id, (select auth.uid())));

drop policy if exists "participants: member updates own" on public.group_participants;
create policy "participants: member updates own" on public.group_participants
  for update to authenticated
  using (user_id = (select auth.uid()))
  with check (user_id = (select auth.uid()));

-- group_payments: visible to owner and members; only the owner writes.
drop policy if exists "payments: select via group" on public.group_payments;
create policy "payments: select via group" on public.group_payments
  for select to authenticated
  using (
    public.is_group_admin(group_id, (select auth.uid()))
    or public.is_group_member(group_id, (select auth.uid()))
  );

drop policy if exists "payments: write via group" on public.group_payments;
drop policy if exists "payments: admin writes" on public.group_payments;
create policy "payments: admin writes" on public.group_payments
  for all to authenticated
  using (public.is_group_admin(group_id, (select auth.uid())))
  with check (public.is_group_admin(group_id, (select auth.uid())));

notify pgrst, 'reload schema';
