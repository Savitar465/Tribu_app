-- ============================================================================
-- Tribu — consolidated schema (migrations 0001–0026 merged).
--
-- Use this single file to bootstrap a BRAND-NEW Supabase project:
--   psql "$DATABASE_URL" -f supabase/schema.sql
-- or paste it into the SQL editor of the Supabase dashboard.
--
-- The step-by-step files in supabase/migrations/ remain the source of truth
-- for databases that already exist (they were applied incrementally there);
-- this file produces exactly the same final state in one shot. Idempotent:
-- safe to run more than once.
--
-- After running it, remember the pieces SQL can't carry:
--   * Deploy the Edge Functions: supabase functions deploy process-billing --no-verify-jwt
--                                 supabase functions deploy send-push --no-verify-jwt
--   * Web Push secrets:          supabase secrets set VAPID_KEYS=<jwk-json> VAPID_SUBJECT=<mailto:...>
--   * Function secret:           supabase secrets set BILLING_CRON_SECRET=<random-secret>
--   * Vault secrets for pg_cron (run once in SQL):
--       select vault.create_secret('https://<project-ref>.supabase.co', 'project_url');
--       select vault.create_secret('<random-secret>', 'billing_cron_secret');
-- ============================================================================

-- ---------------------------------------------------------------------------
-- Tables
-- ---------------------------------------------------------------------------

create table if not exists public.profiles (
  id             uuid primary key references auth.users (id) on delete cascade,
  full_name      text,
  email          text,
  mono           text,
  exchange_rate  numeric not null default 6.96,
  -- Day (yyyy-mm-dd) the official BCB rate was last auto-applied.
  rate_synced_on date,
  created_at     timestamptz not null default now()
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
  -- Optional per-group brand color (custom "others" groups).
  color          text,
  -- Round each member's cuota up to the next whole Bs.
  round_cuota    boolean not null default false,
  -- Last billing cycle processed (yyyy-mm), the per-member cuota (Bs) and the
  -- Bs-per-USD rate frozen at the billing day — display converts at this rate
  -- so totals only change when the next charge runs.
  billed_cycle   text,
  billed_cuota   numeric,
  billed_rate    numeric,
  -- Public URL of the admin's payment QR image (bucket payment-qr).
  qr_image_url   text,
  -- International payment methods configured by the admin.
  paypal_info    text,
  bank_info      text,
  -- False when the admin manages the plan without occupying a slot.
  admin_participates boolean not null default true,
  -- True when this group is payable together with the owner's other joint
  -- groups (one QR / receipt for the whole bundle).
  joint_pay      boolean not null default false,
  -- True on the single group whose payment methods the joint bundle uses.
  joint_method   boolean not null default false,
  -- Variable monthly price (e.g. luz, agua): billing waits until the admin
  -- confirms this month's price. `price_confirmed_cycle` is the last cycle
  -- (yyyy-mm) whose price was confirmed; `price_request_cycle` dedupes the
  -- "update the price" notification across billing runs.
  variable_price boolean not null default false,
  price_confirmed_cycle text,
  price_request_cycle   text,
  created_at     timestamptz not null default now()
);
create index if not exists groups_owner_idx on public.groups (owner_id);
-- At most one collection-method source per owner.
drop index if exists groups_joint_method_owner_idx;
create unique index groups_joint_method_owner_idx
  on public.groups (owner_id)
  where joint_method;

-- Roster members tracked per group (linked to real users via user_id).
create table if not exists public.group_participants (
  id              uuid primary key default gen_random_uuid(),
  group_id        uuid not null references public.groups (id) on delete cascade,
  name            text not null,
  color           text not null default '#5b8cff',
  paid            boolean not null default false,
  proof_pending   boolean not null default false,
  is_self         boolean not null default false,
  sort            int not null default 0,
  -- Email the member was added with; user_id links to a profile when the
  -- email belongs to an existing app user.
  email           text,
  user_id         uuid references public.profiles (id) on delete set null,
  -- Public URL of the member's transfer receipt (bucket payment-proofs).
  proof_url       text,
  -- Prepaid balance (Bs) the monthly cuota is deducted from, plus a submitted
  -- prepay awaiting admin approval and the last cycle settled per participant.
  prepaid_balance numeric not null default 0,
  prepay_pending  numeric,
  prepay_months   int,
  billed_cycle    text,
  -- Cycles (yyyy-mm) a submitted receipt is paying.
  pay_cycles      text[],
  -- User who submitted the pending proof (null = the member themself).
  proof_by        uuid references public.profiles (id) on delete set null,
  -- Admin-set price override and the currency it's defined in (null = the
  -- group's currency / the default split).
  custom_amount   numeric check (custom_amount is null or custom_amount > 0),
  custom_currency text check (custom_currency is null or custom_currency in ('BOB', 'USD')),
  -- Percentage of the group total (1–100); overrides custom_amount when set.
  -- Recalculated at each billing cycle's exchange rate.
  custom_pct      numeric check (custom_pct is null or (custom_pct > 0 and custom_pct <= 100))
);
create index if not exists participants_group_idx on public.group_participants (group_id);

-- Per-month payment history shown on the History screen (legacy display data).
create table if not exists public.group_payments (
  id       uuid primary key default gen_random_uuid(),
  group_id uuid not null references public.groups (id) on delete cascade,
  month    text not null,
  ok       boolean not null default true,
  sort     int not null default 0
);
create index if not exists payments_group_idx on public.group_payments (group_id);

-- Monthly charges ledger: one row per (participant, cycle) with the cuota
-- frozen at that month's exchange rate. Unpaid past rows are arrears.
create table if not exists public.participant_charges (
  id             uuid primary key default gen_random_uuid(),
  group_id       uuid not null references public.groups (id) on delete cascade,
  participant_id uuid not null references public.group_participants (id) on delete cascade,
  cycle          text not null,               -- yyyy-mm
  cuota          numeric not null,            -- Bs charged that month
  paid           boolean not null default false,
  paid_at        timestamptz,
  -- Last automatic reminder tier sent (0 none, 1 at 3 days, 2 at 7 days).
  reminder_level int not null default 0,
  -- User whose payment settled the charge (null = system/prepaid/legacy).
  paid_by        uuid references public.profiles (id) on delete set null,
  -- Soft-delete stamp set when the admin archives exported rows.
  deleted_at     timestamptz,
  created_at     timestamptz not null default now(),
  unique (participant_id, cycle)
);
create index if not exists charges_group_cycle_idx on public.participant_charges (group_id, cycle);

-- Per-user notification feed (charges, approvals, reminders).
create table if not exists public.notifications (
  id         uuid primary key default gen_random_uuid(),
  user_id    uuid not null references public.profiles (id) on delete cascade,
  group_id   uuid references public.groups (id) on delete cascade,
  title      text not null,
  body       text not null default '',
  read       boolean not null default false,
  created_at timestamptz not null default now()
);
create index if not exists notifications_user_created_idx
  on public.notifications (user_id, created_at desc);

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
-- Membership helpers (SECURITY DEFINER → bypass RLS on their inner queries,
-- which keeps the group<->participant policies free of recursion).
-- ---------------------------------------------------------------------------

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

-- ---------------------------------------------------------------------------
-- Row Level Security
-- ---------------------------------------------------------------------------

alter table public.profiles            enable row level security;
alter table public.services            enable row level security;
alter table public.groups              enable row level security;
alter table public.group_participants  enable row level security;
alter table public.group_payments      enable row level security;
alter table public.participant_charges enable row level security;
alter table public.notifications       enable row level security;
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

-- groups: visible to the owner and to any member; only the owner writes.
drop policy if exists "groups: select own" on public.groups;
drop policy if exists "groups: select visible" on public.groups;
create policy "groups: select visible" on public.groups
  for select to authenticated
  using (owner_id = (select auth.uid()) or public.is_group_member(id, (select auth.uid())));
drop policy if exists "groups: insert own" on public.groups;
create policy "groups: insert own" on public.groups
  for insert to authenticated with check (owner_id = (select auth.uid()));
drop policy if exists "groups: update own" on public.groups;
create policy "groups: update own" on public.groups
  for update to authenticated using (owner_id = (select auth.uid())) with check (owner_id = (select auth.uid()));
drop policy if exists "groups: delete own" on public.groups;
create policy "groups: delete own" on public.groups
  for delete to authenticated using (owner_id = (select auth.uid()));

-- group_participants: roster visible to owner and members. The owner writes
-- freely; a member may update only their own row (guarded by the trigger below).
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

-- participant_charges: a member reads only their OWN charge rows (fellow
-- members' amounts are private); the admin keeps full ledger visibility.
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
drop policy if exists "charges: admin writes" on public.participant_charges;
create policy "charges: admin writes" on public.participant_charges
  for all to authenticated
  using (public.is_group_admin(group_id, (select auth.uid())))
  with check (public.is_group_admin(group_id, (select auth.uid())));

-- notifications: each user reads/updates their own; inserts by oneself or by
-- a group admin notifying that group's members.
drop policy if exists "notifications: select own" on public.notifications;
create policy "notifications: select own" on public.notifications
  for select to authenticated
  using (user_id = (select auth.uid()));
drop policy if exists "notifications: update own" on public.notifications;
create policy "notifications: update own" on public.notifications
  for update to authenticated
  using (user_id = (select auth.uid()))
  with check (user_id = (select auth.uid()));
drop policy if exists "notifications: insert own or admin" on public.notifications;
create policy "notifications: insert own or admin" on public.notifications
  for insert to authenticated
  with check (
    user_id = (select auth.uid())
    or (group_id is not null and public.is_group_admin(group_id, (select auth.uid())))
  );

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
-- Member self-update guard: RLS lets a member update their own roster row,
-- but only the proof/prepay submission fields may change — paid, balances,
-- prices and identity fields stay admin-only (no self-approval/crediting).
-- ---------------------------------------------------------------------------

create or replace function public.enforce_participant_member_update()
returns trigger language plpgsql security definer set search_path = '' as $$
begin
  -- Group owner (admin) may change anything.
  if public.is_group_admin(new.group_id, (select auth.uid())) then
    return new;
  end if;
  -- Members: only the proof/prepay submission fields may change.
  if new.paid            is distinct from old.paid
     or new.name            is distinct from old.name
     or new.color           is distinct from old.color
     or new.sort            is distinct from old.sort
     or new.is_self         is distinct from old.is_self
     or new.user_id         is distinct from old.user_id
     or new.email           is distinct from old.email
     or new.group_id        is distinct from old.group_id
     or new.prepaid_balance is distinct from old.prepaid_balance
     or new.custom_amount   is distinct from old.custom_amount
     or new.custom_currency is distinct from old.custom_currency
     or new.custom_pct      is distinct from old.custom_pct
     or new.billed_cycle    is distinct from old.billed_cycle then
    raise exception 'Members may only submit their own payment proof';
  end if;
  if new.proof_by is distinct from old.proof_by
     and new.proof_by is not null
     and new.proof_by <> (select auth.uid()) then
    raise exception 'proof_by must be the submitting user';
  end if;
  return new;
end;
$$;

drop trigger if exists trg_participant_member_update on public.group_participants;
create trigger trg_participant_member_update
  before update on public.group_participants
  for each row execute function public.enforce_participant_member_update();

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

-- Backfill profiles + wallets for any users created before this script ran.
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
-- User lookup RPCs (profiles RLS is owner-only, so these controlled
-- SECURITY DEFINER lookups are the only way to find other users).
-- ---------------------------------------------------------------------------

-- Resolve an email to a minimal profile (at most one row).
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

-- Search registered users by name or email (≥2 chars, short page).
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

-- Minimal profile of every group owner the caller shares a group with (as
-- that group's owner or as a linked roster member) — lets the roster name
-- the admin instead of showing their row's literal "Tú".
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

-- ---------------------------------------------------------------------------
-- submit_payment_v2: submit one payment covering one or many participants
-- (possibly across groups), atomically. Each item pays a participant's listed
-- cycles. Rules:
--   * The caller must be a member or the admin of each participant's group.
--   * Admin caller → auto-approved: charges are marked paid (paid_by=caller),
--     no receipt required; the roster row's paid flag follows the current
--     cycle. Mirrors the manual approval flow.
--   * Member caller → the roster row goes into review (proof_pending) with
--     pay_cycles/proof_url/proof_by recorded; the admin approves as usual.
--   * When paying on behalf of someone else, the beneficiary is notified.
-- items: jsonb array of { "participant_id": uuid, "cycles": ["yyyy-mm", ...] }
-- ---------------------------------------------------------------------------
create or replace function public.submit_payment_v2(p_items jsonb, p_proof_url text default null)
returns jsonb language plpgsql security definer set search_path = '' as $$
declare
  v_uid uuid := (select auth.uid());
  v_cycle text := to_char(now() at time zone 'America/La_Paz', 'YYYY-MM');
  v_payer_name text;
  v_item jsonb;
  v_pid uuid;
  v_cycles text[];
  v_gp public.group_participants%rowtype;
  v_group public.groups%rowtype;
  v_is_admin boolean;
  v_approved int := 0;
  v_pending int := 0;
begin
  if v_uid is null then
    raise exception 'not authenticated';
  end if;
  if p_items is null or jsonb_typeof(p_items) <> 'array' or jsonb_array_length(p_items) = 0 then
    raise exception 'no payment items';
  end if;

  select coalesce(nullif(trim(pr.full_name), ''), pr.email, 'Un miembro')
    into v_payer_name
    from public.profiles pr where pr.id = v_uid;

  for v_item in select * from jsonb_array_elements(p_items) loop
    v_pid := (v_item ->> 'participant_id')::uuid;
    v_cycles := coalesce(
      (select array_agg(value #>> '{}') from jsonb_array_elements(v_item -> 'cycles')),
      array[]::text[]
    );
    if v_pid is null or array_length(v_cycles, 1) is null then
      raise exception 'invalid payment item';
    end if;

    select * into v_gp from public.group_participants where id = v_pid;
    if not found then
      raise exception 'participant not found';
    end if;
    select * into v_group from public.groups where id = v_gp.group_id;

    v_is_admin := v_group.owner_id = v_uid;
    if not v_is_admin and not public.is_group_member(v_gp.group_id, v_uid) then
      raise exception 'not a member of this group';
    end if;

    if v_is_admin then
      -- Admin payments need no receipt and no review: settle immediately.
      update public.participant_charges
         set paid = true, paid_at = now(), paid_by = v_uid, reminder_level = 0
       where participant_id = v_pid
         and cycle = any (v_cycles)
         and deleted_at is null
         and not paid;
      update public.group_participants
         set paid = case when v_cycle = any (v_cycles) then true else paid end,
             proof_pending = false,
             pay_cycles = null,
             proof_by = null
       where id = v_pid;
      v_approved := v_approved + 1;

      if v_gp.user_id is not null and v_gp.user_id <> v_uid then
        insert into public.notifications (user_id, group_id, title, body)
        values (
          v_gp.user_id,
          v_gp.group_id,
          'Pago registrado · ' || v_group.name,
          'El administrador registró tu pago de ' || array_to_string(v_cycles, ', ') || '.'
        );
      end if;
    else
      -- Member submission: the months go into review for the admin.
      update public.group_participants
         set proof_pending = true,
             proof_url = p_proof_url,
             pay_cycles = v_cycles,
             proof_by = case when v_gp.user_id is distinct from v_uid then v_uid else null end
       where id = v_pid;
      v_pending := v_pending + 1;

      if v_gp.user_id is not null and v_gp.user_id <> v_uid then
        insert into public.notifications (user_id, group_id, title, body)
        values (
          v_gp.user_id,
          v_gp.group_id,
          'Pago enviado por ti · ' || v_group.name,
          v_payer_name || ' envió un comprobante por tu cuota (' || array_to_string(v_cycles, ', ')
            || '). El administrador lo revisará.'
        );
      end if;
    end if;
  end loop;

  return jsonb_build_object('approved', v_approved, 'pending', v_pending);
end;
$$;

revoke execute on function public.submit_payment_v2(jsonb, text) from public, anon;
grant execute on function public.submit_payment_v2(jsonb, text) to authenticated;

-- ---------------------------------------------------------------------------
-- archive_paid_charges: soft-delete exported charge rows. Only the group's
-- admin may archive, and only rows that are already paid (unpaid rows are
-- live debts and must never disappear). Runs atomically; raises when any
-- requested row is not archivable so nothing is half-deleted.
-- ---------------------------------------------------------------------------
create or replace function public.archive_paid_charges(p_ids uuid[])
returns integer language plpgsql security definer set search_path = '' as $$
declare
  v_uid uuid := (select auth.uid());
  v_requested int := coalesce(array_length(p_ids, 1), 0);
  v_archived int;
begin
  if v_uid is null then
    raise exception 'not authenticated';
  end if;
  if v_requested = 0 then
    return 0;
  end if;

  update public.participant_charges c
     set deleted_at = now()
   where c.id = any (p_ids)
     and c.deleted_at is null
     and c.paid
     and public.is_group_admin(c.group_id, v_uid);
  get diagnostics v_archived = row_count;

  if v_archived <> v_requested then
    raise exception 'archive_paid_charges: % de % filas no se pueden archivar (no pagadas, ajenas o ya archivadas)',
      v_requested - v_archived, v_requested;
  end if;
  return v_archived;
end;
$$;

revoke execute on function public.archive_paid_charges(uuid[]) from public, anon;
grant execute on function public.archive_paid_charges(uuid[]) to authenticated;

-- ---------------------------------------------------------------------------
-- Storage: payment QR images and transfer receipts. Public buckets (images
-- are served via their public URL), 5 MB cap, images only.
-- ---------------------------------------------------------------------------

insert into storage.buckets (id, name, public, file_size_limit, allowed_mime_types)
values ('payment-qr', 'payment-qr', true, 5242880, array['image/png', 'image/jpeg', 'image/webp'])
on conflict (id) do update
  set public = true,
      file_size_limit = excluded.file_size_limit,
      allowed_mime_types = excluded.allowed_mime_types;

insert into storage.buckets (id, name, public, file_size_limit, allowed_mime_types)
values ('payment-proofs', 'payment-proofs', true, 5242880, array['image/png', 'image/jpeg', 'image/webp'])
on conflict (id) do update
  set public = true,
      file_size_limit = excluded.file_size_limit,
      allowed_mime_types = excluded.allowed_mime_types;

-- payment-qr objects live at `<group_id>/...`; only that group's admin writes.
drop policy if exists "payment-qr: admin insert" on storage.objects;
create policy "payment-qr: admin insert" on storage.objects
  for insert to authenticated
  with check (
    bucket_id = 'payment-qr'
    and public.is_group_admin(((storage.foldername(name))[1])::uuid, (select auth.uid()))
  );

drop policy if exists "payment-qr: admin update" on storage.objects;
create policy "payment-qr: admin update" on storage.objects
  for update to authenticated
  using (
    bucket_id = 'payment-qr'
    and public.is_group_admin(((storage.foldername(name))[1])::uuid, (select auth.uid()))
  )
  with check (
    bucket_id = 'payment-qr'
    and public.is_group_admin(((storage.foldername(name))[1])::uuid, (select auth.uid()))
  );

drop policy if exists "payment-qr: admin delete" on storage.objects;
create policy "payment-qr: admin delete" on storage.objects
  for delete to authenticated
  using (
    bucket_id = 'payment-qr'
    and public.is_group_admin(((storage.foldername(name))[1])::uuid, (select auth.uid()))
  );

drop policy if exists "payment-qr: read" on storage.objects;
create policy "payment-qr: read" on storage.objects
  for select to authenticated
  using (bucket_id = 'payment-qr');

-- payment-proofs objects live at `<group_id>/...`; any member of that group
-- (or its admin) may upload/replace a receipt there.
drop policy if exists "payment-proofs: member insert" on storage.objects;
create policy "payment-proofs: member insert" on storage.objects
  for insert to authenticated
  with check (
    bucket_id = 'payment-proofs'
    and (
      public.is_group_member(((storage.foldername(name))[1])::uuid, (select auth.uid()))
      or public.is_group_admin(((storage.foldername(name))[1])::uuid, (select auth.uid()))
    )
  );

drop policy if exists "payment-proofs: member update" on storage.objects;
create policy "payment-proofs: member update" on storage.objects
  for update to authenticated
  using (
    bucket_id = 'payment-proofs'
    and (
      public.is_group_member(((storage.foldername(name))[1])::uuid, (select auth.uid()))
      or public.is_group_admin(((storage.foldername(name))[1])::uuid, (select auth.uid()))
    )
  )
  with check (
    bucket_id = 'payment-proofs'
    and (
      public.is_group_member(((storage.foldername(name))[1])::uuid, (select auth.uid()))
      or public.is_group_admin(((storage.foldername(name))[1])::uuid, (select auth.uid()))
    )
  );

drop policy if exists "payment-proofs: admin delete" on storage.objects;
create policy "payment-proofs: admin delete" on storage.objects
  for delete to authenticated
  using (
    bucket_id = 'payment-proofs'
    and public.is_group_admin(((storage.foldername(name))[1])::uuid, (select auth.uid()))
  );

drop policy if exists "payment-proofs: read" on storage.objects;
create policy "payment-proofs: read" on storage.objects
  for select to authenticated
  using (bucket_id = 'payment-proofs');

-- ---------------------------------------------------------------------------
-- Seed the services catalog (including the "others" custom-group entry).
-- ---------------------------------------------------------------------------

insert into public.services (id, name, mono, color, default_plan) values
  ('spotify', 'Spotify Premium',     'S',  '#1DB954', 'Plan Familiar'),
  ('netflix', 'Netflix',             'N',  '#E50914', 'Premium 4K'),
  ('youtube', 'YouTube Premium',     'Y',  '#FF0000', 'Familiar'),
  ('disney',  'Disney+',             'D',  '#1f5fe0', 'Estándar'),
  ('chatgpt', 'ChatGPT Team',        'AI', '#10A37F', 'Equipo'),
  ('max',     'Max',                 'M',  '#0046ff', 'Estándar'),
  ('canva',   'Canva',               'C',  '#00c4cc', 'Equipos'),
  ('one',     'Google One',          'G',  '#e8a020', 'Premium'),
  ('others',  'Grupo personalizado', '+',  '#7b8794', 'Personalizado')
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
grant select, insert, update, delete on public.participant_charges to authenticated;
grant select, insert, update on public.notifications to authenticated;
grant select, update on public.profiles to authenticated;
grant select, update on public.wallets to authenticated;
grant select, insert on public.wallet_transactions to authenticated;

-- ---------------------------------------------------------------------------
-- Daily billing schedule: pg_cron + pg_net call the process-billing Edge
-- Function at 00:05 America/La_Paz (04:05 UTC — Bolivia has no DST).
-- Requires the vault secrets listed at the top of this file; without them the
-- job is scheduled but each run fails harmlessly until they exist.
-- ---------------------------------------------------------------------------

create extension if not exists pg_cron;
create extension if not exists pg_net;

do $$
begin
  if exists (select 1 from cron.job where jobname = 'process-billing-daily') then
    perform cron.unschedule('process-billing-daily');
  end if;
end $$;

select cron.schedule(
  'process-billing-daily',
  '5 4 * * *',
  $$
  select net.http_post(
    url := (select decrypted_secret from vault.decrypted_secrets where name = 'project_url')
           || '/functions/v1/process-billing',
    headers := jsonb_build_object(
      'Content-Type', 'application/json',
      'x-cron-secret', (select decrypted_secret from vault.decrypted_secrets where name = 'billing_cron_secret')
    ),
    body := '{}'::jsonb
  ) as request_id;
  $$
);

-- ---------------------------------------------------------------------------
-- Web Push (0026): device subscriptions + trigger forwarding every inserted
-- notification to the send-push Edge Function via pg_net.
-- ---------------------------------------------------------------------------

create table if not exists public.push_subscriptions (
  id         uuid primary key default gen_random_uuid(),
  user_id    uuid not null references public.profiles (id) on delete cascade,
  endpoint   text not null unique,
  p256dh     text not null,
  auth       text not null,
  created_at timestamptz not null default now()
);
create index if not exists push_subscriptions_user_idx on public.push_subscriptions (user_id);

alter table public.push_subscriptions enable row level security;

drop policy if exists "push: select own" on public.push_subscriptions;
create policy "push: select own" on public.push_subscriptions
  for select to authenticated
  using (user_id = (select auth.uid()));

drop policy if exists "push: insert own" on public.push_subscriptions;
create policy "push: insert own" on public.push_subscriptions
  for insert to authenticated
  with check (user_id = (select auth.uid()));

drop policy if exists "push: update own" on public.push_subscriptions;
create policy "push: update own" on public.push_subscriptions
  for update to authenticated
  using (user_id = (select auth.uid()))
  with check (user_id = (select auth.uid()));

drop policy if exists "push: delete own" on public.push_subscriptions;
create policy "push: delete own" on public.push_subscriptions
  for delete to authenticated
  using (user_id = (select auth.uid()));

grant select, insert, update, delete on public.push_subscriptions to authenticated;

create or replace function public.forward_notification_push()
returns trigger
language plpgsql
security definer
set search_path = ''
as $fn$
declare
  base_url text;
  secret   text;
begin
  select decrypted_secret into base_url from vault.decrypted_secrets where name = 'project_url';
  select decrypted_secret into secret   from vault.decrypted_secrets where name = 'billing_cron_secret';
  if base_url is null or secret is null then
    return new;
  end if;
  perform net.http_post(
    url := base_url || '/functions/v1/send-push',
    headers := jsonb_build_object(
      'Content-Type', 'application/json',
      'x-cron-secret', secret
    ),
    body := jsonb_build_object(
      'user_id', new.user_id,
      'group_id', new.group_id,
      'title', new.title,
      'body', new.body
    )
  );
  return new;
exception when others then
  return new;
end;
$fn$;

revoke execute on function public.forward_notification_push() from public, anon, authenticated;

drop trigger if exists notifications_push on public.notifications;
create trigger notifications_push
  after insert on public.notifications
  for each row execute function public.forward_notification_push();

-- Expose everything to PostgREST immediately.
notify pgrst, 'reload schema';
