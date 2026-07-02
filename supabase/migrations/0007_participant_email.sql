-- Support adding roster members by email / linking them to real app users.
-- `email` stores the address a member was invited with; `user_id` links to a
-- profile when the email belongs to an existing app user. Idempotent.

alter table public.group_participants
  add column if not exists email   text,
  add column if not exists user_id uuid references public.profiles (id) on delete set null;

-- Resolve an email to a minimal profile so an admin can add an existing app
-- user to a group. SECURITY DEFINER: profiles RLS is owner-only, so this
-- controlled lookup is the only way to find another user. Returns at most one
-- row (empty when the email is not registered).
create or replace function public.find_profile_by_email(p_email text)
returns table (id uuid, full_name text, mono text)
language sql
security definer
set search_path = ''
as $$
  select p.id, p.full_name, p.mono
  from public.profiles p
  where lower(p.email) = lower(trim(p_email))
  limit 1;
$$;

revoke execute on function public.find_profile_by_email(text) from public, anon;
grant execute on function public.find_profile_by_email(text) to authenticated;

notify pgrst, 'reload schema';
