-- Web Push: `push_subscriptions` stores each browser/device subscription the
-- user opted into (one row per endpoint; a user may have several devices).
-- A trigger on `notifications` forwards every inserted row to the `send-push`
-- Edge Function via pg_net, so pushes fire no matter who created the
-- notification (process-billing, the client fallback, or an admin action).
--
-- Prerequisites (already in Vault from 0013): `project_url` and
-- `billing_cron_secret`; the same secret guards send-push (x-cron-secret).
-- Idempotent.

create table if not exists public.push_subscriptions (
  id         uuid primary key default gen_random_uuid(),
  user_id    uuid not null references public.profiles (id) on delete cascade,
  endpoint   text not null unique,             -- push-service URL, unique per device
  p256dh     text not null,                    -- client public key (base64url)
  auth       text not null,                    -- client auth secret (base64url)
  created_at timestamptz not null default now()
);
create index if not exists push_subscriptions_user_idx on public.push_subscriptions (user_id);

alter table public.push_subscriptions enable row level security;

-- Each user manages only their own device subscriptions.
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

-- New public tables are no longer auto-exposed to the Data API.
grant select, insert, update, delete on public.push_subscriptions to authenticated;

-- Forward each new notification to the send-push Edge Function. SECURITY
-- DEFINER only to read Vault and enqueue the pg_net call; it is a trigger
-- function (return type `trigger`), so it is not callable through the Data
-- API, and EXECUTE is revoked below as belt-and-braces. Failures never block
-- the insert: pg_net is async and any setup error is swallowed.
create or replace function public.forward_notification_push()
returns trigger
language plpgsql
security definer
set search_path = ''
as $$
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
$$;

revoke execute on function public.forward_notification_push() from public, anon, authenticated;

drop trigger if exists notifications_push on public.notifications;
create trigger notifications_push
  after insert on public.notifications
  for each row execute function public.forward_notification_push();

notify pgrst, 'reload schema';
