-- Remove the demo sample-data seeder before production. The 0002 migration
-- that created load_sample_data() is kept for history; this drops the function
-- so it can no longer be called. Idempotent.

drop function if exists public.load_sample_data();

notify pgrst, 'reload schema';
