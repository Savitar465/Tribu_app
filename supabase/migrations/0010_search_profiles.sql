-- Search registered users by name or email so an admin can add them to a
-- group from a single field. SECURITY DEFINER: profiles RLS is owner-only, so
-- this controlled lookup is the only way to find other users. Requires at
-- least 2 characters and returns a short, alphabetized page. Idempotent.

create or replace function public.search_profiles(p_query text)
returns table (id uuid, full_name text, email text, mono text)
language sql
security definer
set search_path = ''
as $$
  select p.id, p.full_name, p.email, p.mono
  from public.profiles p
  where length(trim(p_query)) >= 2
    and p.id <> auth.uid()
    and (
      p.full_name ilike '%' || trim(p_query) || '%'
      or p.email ilike '%' || trim(p_query) || '%'
    )
  order by p.full_name nulls last
  limit 8;
$$;

revoke execute on function public.search_profiles(text) from public, anon;
grant execute on function public.search_profiles(text) to authenticated;

notify pgrst, 'reload schema';
