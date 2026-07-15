-- The roster shows the group owner by their real name, but the owner's roster
-- row is stored as the literal "Tú" and profiles RLS is owner-only. This
-- controlled SECURITY DEFINER lookup (same pattern as find_profile_by_email)
-- returns the minimal profile of every owner the caller shares a group with,
-- either as that group's owner or as a linked roster member. Idempotent.

create or replace function public.get_group_owner_profiles()
returns table (id uuid, full_name text, mono text)
language sql
security definer
set search_path = ''
as $$
  select distinct p.id, p.full_name, p.mono
  from public.profiles p
  join public.groups g on g.owner_id = p.id
  where g.owner_id = auth.uid()
     or exists (
       select 1 from public.group_participants gp
       where gp.group_id = g.id and gp.user_id = auth.uid()
     );
$$;

revoke execute on function public.get_group_owner_profiles() from public, anon;
grant execute on function public.get_group_owner_profiles() to authenticated;
