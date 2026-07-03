-- Monthly charge events. `billed_cycle` stamps the last processed cycle
-- (yyyy-mm) per group so the charge runs once a month, `billed_cuota` freezes
-- the per-member price (Bs) at the rate captured on the billing day, and
-- `notifications` stores the per-user feed generated on each charge. Idempotent.

alter table public.groups
  add column if not exists billed_cycle text,
  add column if not exists billed_cuota numeric;

create table if not exists public.notifications (
  id uuid primary key default gen_random_uuid(),
  user_id uuid not null references public.profiles (id) on delete cascade,
  group_id uuid references public.groups (id) on delete cascade,
  title text not null,
  body text not null default '',
  read boolean not null default false,
  created_at timestamptz not null default now()
);

create index if not exists notifications_user_created_idx
  on public.notifications (user_id, created_at desc);

alter table public.notifications enable row level security;

-- Each user reads and updates (marks read) only their own rows.
drop policy if exists "notifications: select own" on public.notifications;
create policy "notifications: select own" on public.notifications
  for select to authenticated
  using (user_id = (select auth.uid()));

drop policy if exists "notifications: update own" on public.notifications;
create policy "notifications: update own" on public.notifications
  for update to authenticated
  using (user_id = (select auth.uid()))
  with check (user_id = (select auth.uid()));

-- Inserts: yourself, or a group admin notifying that group's members.
drop policy if exists "notifications: insert own or admin" on public.notifications;
create policy "notifications: insert own or admin" on public.notifications
  for insert to authenticated
  with check (
    user_id = (select auth.uid())
    or (group_id is not null and public.is_group_admin(group_id, (select auth.uid())))
  );

notify pgrst, 'reload schema';
