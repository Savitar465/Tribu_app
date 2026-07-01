-- Tribu — schema, RLS, new-user trigger and reference data.
-- Single-user-with-login model: every row belongs to one authenticated user
-- (owner_id / user_id = auth.uid()). Group rosters are display-only
-- "participants" (not auth users), which keeps RLS owner-scoped and free of
-- the classic groups<->members policy recursion.
--
-- This script is idempotent: it is safe to run more than once.

-- ---------------------------------------------------------------------------
-- Tables
-- ---------------------------------------------------------------------------

create table if not exists public.profiles (
  id            uuid primary key references auth.users (id) on delete cascade,
  full_name     text,
  email         text,
  mono          text,
  exchange_rate numeric not null default 6.96,
  created_at    timestamptz not null default now()
);

-- Reference catalog of subscription services (brand metadata).
create table if not exists public.services (
  id           text primary key,
  name         text not null,
  mono         text not null,
  color        text not null,
  default_plan text
);

create table if not exists public.groups (
  id             uuid primary key default gen_random_uuid(),
  owner_id       uuid not null references public.profiles (id) on delete cascade,
  service_id     text not null references public.services (id),
  name           text not null,
  amount         numeric not null default 0,
  currency       text not null default 'BOB' check (currency in ('BOB', 'USD')),
  members_target int  not null default 1 check (members_target between 1 and 50),
  billing_day    int  not null default 5 check (billing_day between 1 and 31),
  role           text not null default 'admin' check (role in ('admin', 'member')),
  self_status    text not null default 'pending' check (self_status in ('paid', 'pending', 'overdue', 'review')),
  due            text,
  created_at     timestamptz not null default now()
);
create index if not exists groups_owner_idx on public.groups (owner_id);

-- Display-only roster members tracked per group (may not be app users).
create table if not exists public.group_participants (
  id            uuid primary key default gen_random_uuid(),
  group_id      uuid not null references public.groups (id) on delete cascade,
  name          text not null,
  color         text not null default '#5b8cff',
  paid          boolean not null default false,
  proof_pending boolean not null default false,
  is_self       boolean not null default false,
  sort          int not null default 0
);
create index if not exists participants_group_idx on public.group_participants (group_id);

-- Per-month payment history shown on the History screen.
create table if not exists public.group_payments (
  id       uuid primary key default gen_random_uuid(),
  group_id uuid not null references public.groups (id) on delete cascade,
  month    text not null,
  ok       boolean not null default true,
  sort     int not null default 0
);
create index if not exists payments_group_idx on public.group_payments (group_id);

create table if not exists public.wallets (
  user_id   uuid primary key references public.profiles (id) on delete cascade,
  balance   numeric not null default 0,
  auto_fund boolean not null default true
);

create table if not exists public.wallet_transactions (
  id         uuid primary key default gen_random_uuid(),
  user_id    uuid not null references public.profiles (id) on delete cascade,
  label      text not null,
  sub        text,
  amount     numeric not null,
  created_at timestamptz not null default now()
);
create index if not exists wallet_tx_user_idx on public.wallet_transactions (user_id, created_at desc);

-- ---------------------------------------------------------------------------
-- Row Level Security
-- ---------------------------------------------------------------------------

alter table public.profiles            enable row level security;
alter table public.services            enable row level security;
alter table public.groups              enable row level security;
alter table public.group_participants  enable row level security;
alter table public.group_payments      enable row level security;
alter table public.wallets             enable row level security;
alter table public.wallet_transactions enable row level security;

-- profiles: a user sees and edits only their own row.
drop policy if exists "profiles: select own" on public.profiles;
create policy "profiles: select own" on public.profiles
  for select to authenticated using (id = (select auth.uid()));
drop policy if exists "profiles: update own" on public.profiles;
create policy "profiles: update own" on public.profiles
  for update to authenticated using (id = (select auth.uid())) with check (id = (select auth.uid()));

-- services: readable by any signed-in user (reference data).
drop policy if exists "services: read" on public.services;
create policy "services: read" on public.services
  for select to authenticated using (true);

-- groups: full control of your own groups.
drop policy if exists "groups: select own" on public.groups;
create policy "groups: select own" on public.groups
  for select to authenticated using (owner_id = (select auth.uid()));
drop policy if exists "groups: insert own" on public.groups;
create policy "groups: insert own" on public.groups
  for insert to authenticated with check (owner_id = (select auth.uid()));
drop policy if exists "groups: update own" on public.groups;
create policy "groups: update own" on public.groups
  for update to authenticated using (owner_id = (select auth.uid())) with check (owner_id = (select auth.uid()));
drop policy if exists "groups: delete own" on public.groups;
create policy "groups: delete own" on public.groups
  for delete to authenticated using (owner_id = (select auth.uid()));

-- group_participants: scoped through the owning group (no recursion — the
-- groups policy never references this table).
drop policy if exists "participants: select via group" on public.group_participants;
create policy "participants: select via group" on public.group_participants
  for select to authenticated
  using (exists (select 1 from public.groups g where g.id = group_id and g.owner_id = (select auth.uid())));
drop policy if exists "participants: write via group" on public.group_participants;
create policy "participants: write via group" on public.group_participants
  for all to authenticated
  using (exists (select 1 from public.groups g where g.id = group_id and g.owner_id = (select auth.uid())))
  with check (exists (select 1 from public.groups g where g.id = group_id and g.owner_id = (select auth.uid())));

-- group_payments: scoped through the owning group.
drop policy if exists "payments: select via group" on public.group_payments;
create policy "payments: select via group" on public.group_payments
  for select to authenticated
  using (exists (select 1 from public.groups g where g.id = group_id and g.owner_id = (select auth.uid())));
drop policy if exists "payments: write via group" on public.group_payments;
create policy "payments: write via group" on public.group_payments
  for all to authenticated
  using (exists (select 1 from public.groups g where g.id = group_id and g.owner_id = (select auth.uid())))
  with check (exists (select 1 from public.groups g where g.id = group_id and g.owner_id = (select auth.uid())));

-- wallets & transactions: your own only.
drop policy if exists "wallets: select own" on public.wallets;
create policy "wallets: select own" on public.wallets
  for select to authenticated using (user_id = (select auth.uid()));
drop policy if exists "wallets: update own" on public.wallets;
create policy "wallets: update own" on public.wallets
  for update to authenticated using (user_id = (select auth.uid())) with check (user_id = (select auth.uid()));

drop policy if exists "wallet_tx: select own" on public.wallet_transactions;
create policy "wallet_tx: select own" on public.wallet_transactions
  for select to authenticated using (user_id = (select auth.uid()));
drop policy if exists "wallet_tx: insert own" on public.wallet_transactions;
create policy "wallet_tx: insert own" on public.wallet_transactions
  for insert to authenticated with check (user_id = (select auth.uid()));

-- ---------------------------------------------------------------------------
-- New-user trigger: create a profile + wallet automatically on sign-up.
-- ---------------------------------------------------------------------------

create or replace function public.handle_new_user()
returns trigger
language plpgsql
security definer
set search_path = ''
as $$
declare
  v_name  text;
  v_mono  text;
  parts   text[];
begin
  v_name := coalesce(nullif(new.raw_user_meta_data->>'full_name', ''), split_part(new.email, '@', 1));
  parts  := regexp_split_to_array(trim(v_name), '\s+');
  if array_length(parts, 1) >= 2 then
    v_mono := upper(left(parts[1], 1) || left(parts[2], 1));
  else
    v_mono := upper(left(v_name, 2));
  end if;

  insert into public.profiles (id, full_name, email, mono)
  values (new.id, v_name, new.email, v_mono)
  on conflict (id) do nothing;

  insert into public.wallets (user_id, balance, auto_fund)
  values (new.id, 0, true)
  on conflict (user_id) do nothing;

  return new;
end;
$$;

drop trigger if exists on_auth_user_created on auth.users;
create trigger on_auth_user_created
  after insert on auth.users
  for each row execute function public.handle_new_user();

-- Backfill profiles + wallets for any users that already existed before this
-- migration (e.g. accounts created while the schema was missing).
insert into public.profiles (id, full_name, email, mono)
select
  u.id,
  coalesce(nullif(u.raw_user_meta_data->>'full_name', ''), split_part(u.email, '@', 1)),
  u.email,
  upper(left(coalesce(nullif(u.raw_user_meta_data->>'full_name', ''), split_part(u.email, '@', 1)), 2))
from auth.users u
on conflict (id) do nothing;

insert into public.wallets (user_id)
select id from auth.users
on conflict (user_id) do nothing;

-- ---------------------------------------------------------------------------
-- Seed the services catalog.
-- ---------------------------------------------------------------------------

insert into public.services (id, name, mono, color, default_plan) values
  ('spotify', 'Spotify Premium', 'S',  '#1DB954', 'Plan Familiar'),
  ('netflix', 'Netflix',         'N',  '#E50914', 'Premium 4K'),
  ('youtube', 'YouTube Premium', 'Y',  '#FF0000', 'Familiar'),
  ('disney',  'Disney+',         'D',  '#1f5fe0', 'Estándar'),
  ('chatgpt', 'ChatGPT Team',    'AI', '#10A37F', 'Equipo'),
  ('max',     'Max',             'M',  '#0046ff', 'Estándar'),
  ('canva',   'Canva',           'C',  '#00c4cc', 'Equipos'),
  ('one',     'Google One',      'G',  '#e8a020', 'Premium')
on conflict (id) do update
  set name = excluded.name, mono = excluded.mono, color = excluded.color, default_plan = excluded.default_plan;

-- ---------------------------------------------------------------------------
-- Data API grants. RLS (above) still governs which rows are visible; these
-- grants make the tables reachable by the authenticated role via the REST API.
-- ---------------------------------------------------------------------------

grant usage on schema public to authenticated;
grant select on public.services to authenticated;
grant select, insert, update, delete on public.groups to authenticated;
grant select, insert, update, delete on public.group_participants to authenticated;
grant select, insert, update, delete on public.group_payments to authenticated;
grant select, update on public.profiles to authenticated;
grant select, update on public.wallets to authenticated;
grant select, insert on public.wallet_transactions to authenticated;

-- Ask PostgREST to reload its schema cache so the new tables are exposed
-- immediately (avoids "Could not find the table ... in the schema cache").
notify pgrst, 'reload schema';
