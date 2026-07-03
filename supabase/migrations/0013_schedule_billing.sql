-- Schedule the process-billing Edge Function daily at 00:05 America/La_Paz
-- (04:05 UTC — Bolivia has no DST) via pg_cron + pg_net, so monthly charges
-- fire even if the group admin never opens the app.
--
-- Prerequisites (run once, NOT in this file — they hold secrets):
--   select vault.create_secret('https://<project-ref>.supabase.co', 'project_url');
--   select vault.create_secret('<random-secret>', 'billing_cron_secret');
-- and set the same secret on the function:
--   supabase secrets set BILLING_CRON_SECRET=<random-secret>
--
-- Idempotent: reschedules if the job already exists.

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
