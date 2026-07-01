-- Optional demo seeder. Populates the CURRENT user's account with the sample
-- data from the original prototype so the app is immediately explorable.
-- SECURITY INVOKER: runs under the caller's RLS, so it can only ever touch the
-- caller's own rows. Idempotent — re-running resets the sample data.

create or replace function public.load_sample_data()
returns void
language plpgsql
security invoker
set search_path = ''
as $$
declare
  uid uuid := (select auth.uid());
  g_spotify uuid;
  g_netflix uuid;
  g_youtube uuid;
  g_disney  uuid;
  g_chatgpt uuid;
begin
  if uid is null then
    raise exception 'Not authenticated';
  end if;

  -- Reset any previous data for this user (groups cascade to participants).
  delete from public.groups where owner_id = uid;
  delete from public.wallet_transactions where user_id = uid;

  insert into public.wallets (user_id, balance, auto_fund)
  values (uid, 318, true)
  on conflict (user_id) do update set balance = 318, auto_fund = true;

  update public.profiles set exchange_rate = 6.96 where id = uid;

  -- Groups (role = the user's relationship; self_status = their own cuota).
  insert into public.groups (owner_id, service_id, name, amount, currency, members_target, billing_day, role, self_status, due)
    values (uid, 'spotify', 'Spotify Premium', 60, 'BOB', 6, 5,  'admin',  'paid',    '05/07') returning id into g_spotify;
  insert into public.groups (owner_id, service_id, name, amount, currency, members_target, billing_day, role, self_status, due)
    values (uid, 'netflix', 'Netflix',         65, 'BOB', 5, 2,  'member', 'pending', '02/07') returning id into g_netflix;
  insert into public.groups (owner_id, service_id, name, amount, currency, members_target, billing_day, role, self_status, due)
    values (uid, 'youtube', 'YouTube Premium', 45, 'BOB', 5, 10, 'member', 'paid',    '10/07') returning id into g_youtube;
  insert into public.groups (owner_id, service_id, name, amount, currency, members_target, billing_day, role, self_status, due)
    values (uid, 'disney',  'Disney+',         50, 'BOB', 4, 28, 'member', 'overdue', '28/06') returning id into g_disney;
  insert into public.groups (owner_id, service_id, name, amount, currency, members_target, billing_day, role, self_status, due)
    values (uid, 'chatgpt', 'ChatGPT Team',    30, 'USD', 5, 15, 'admin',  'paid',    '15/07') returning id into g_chatgpt;

  -- Rosters. `paid` count drives the admin collection math; `proof_pending`
  -- drives the approval alert; `is_self` marks the current user's row.
  insert into public.group_participants (group_id, name, color, paid, proof_pending, is_self, sort) values
    (g_spotify, 'Juan Pérez',    '#5b8cff', true,  false, false, 0),
    (g_spotify, 'Pedro Rojas',   '#36d07a', true,  false, false, 1),
    (g_spotify, 'Ana Gutiérrez', '#f5b53d', true,  false, false, 2),
    (g_spotify, 'Carlos Mamani', '#ff6b6b', false, true,  false, 3),
    (g_spotify, 'María Flores',  '#9b6bff', false, false, false, 4),
    (g_spotify, 'Tú',            '#5b8cff', true,  false, true,  5);

  insert into public.group_participants (group_id, name, color, paid, proof_pending, is_self, sort) values
    (g_netflix, 'Juan Pérez',    '#5b8cff', true,  false, false, 0),
    (g_netflix, 'Pedro Rojas',   '#36d07a', true,  false, false, 1),
    (g_netflix, 'Ana Gutiérrez', '#f5b53d', true,  false, false, 2),
    (g_netflix, 'Carlos Mamani', '#ff6b6b', false, false, false, 3),
    (g_netflix, 'Tú',            '#5b8cff', false, false, true,  4);

  insert into public.group_participants (group_id, name, color, paid, proof_pending, is_self, sort) values
    (g_youtube, 'Juan Pérez',    '#5b8cff', true,  false, false, 0),
    (g_youtube, 'Pedro Rojas',   '#36d07a', true,  false, false, 1),
    (g_youtube, 'Ana Gutiérrez', '#f5b53d', true,  false, false, 2),
    (g_youtube, 'María Flores',  '#9b6bff', true,  false, false, 3),
    (g_youtube, 'Tú',            '#5b8cff', true,  false, true,  4);

  insert into public.group_participants (group_id, name, color, paid, proof_pending, is_self, sort) values
    (g_disney, 'Juan Pérez',    '#5b8cff', true,  false, false, 0),
    (g_disney, 'Pedro Rojas',   '#36d07a', false, false, false, 1),
    (g_disney, 'Carlos Mamani', '#ff6b6b', false, false, false, 2),
    (g_disney, 'Tú',            '#5b8cff', true,  false, true,  3);

  insert into public.group_participants (group_id, name, color, paid, proof_pending, is_self, sort) values
    (g_chatgpt, 'Juan Pérez',    '#5b8cff', true,  false, false, 0),
    (g_chatgpt, 'Pedro Rojas',   '#36d07a', true,  false, false, 1),
    (g_chatgpt, 'Ana Gutiérrez', '#f5b53d', true,  false, false, 2),
    (g_chatgpt, 'María Flores',  '#9b6bff', false, false, false, 3),
    (g_chatgpt, 'Tú',            '#5b8cff', true,  false, true,  4);

  -- Six-month payment history for every group (April missed).
  insert into public.group_payments (group_id, month, ok, sort)
  select g.id, m.month, m.ok, m.sort
  from (values (g_spotify), (g_netflix), (g_youtube), (g_disney), (g_chatgpt)) as g(id),
       (values ('Ene', true, 0), ('Feb', true, 1), ('Mar', true, 2), ('Abr', false, 3), ('May', true, 4), ('Jun', true, 5))
         as m(month, ok, sort);

  -- Wallet movements (newest first via descending timestamps).
  insert into public.wallet_transactions (user_id, label, sub, amount, created_at) values
    (uid, 'Depósito',        '16 jun · QR Simple',    50,  now() - interval '0 day'),
    (uid, 'Spotify Premium', '05 jun · cuota junio', -10,  now() - interval '11 day'),
    (uid, 'Netflix',         '02 jun · cuota junio', -13,  now() - interval '14 day'),
    (uid, 'Depósito',        '01 jun · Tigo Money',   60,  now() - interval '15 day');
end;
$$;

-- Only signed-in users may seed their own data.
revoke execute on function public.load_sample_data() from public, anon;
grant execute on function public.load_sample_data() to authenticated;
