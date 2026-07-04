-- Per-group payment QR (Bolivia: cuotas se pagan escaneando el QR bancario
-- del admin). `groups.qr_image_url` stores the public URL of the image kept
-- in the `payment-qr` Storage bucket under `<group_id>/qr`. Only the group
-- admin (owner) writes; anyone with the URL can view (a payment QR is meant
-- to be shared). Idempotent.

alter table public.groups
  add column if not exists qr_image_url text;

-- Public bucket: images are served via their public URL (members may not be
-- signed in on the device they pay from). 5 MB cap, images only.
insert into storage.buckets (id, name, public, file_size_limit, allowed_mime_types)
values ('payment-qr', 'payment-qr', true, 5242880, array['image/png', 'image/jpeg', 'image/webp'])
on conflict (id) do update
  set public = true,
      file_size_limit = excluded.file_size_limit,
      allowed_mime_types = excluded.allowed_mime_types;

-- Objects live at `<group_id>/...`; only that group's admin may write them.
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

-- Read via the Storage API for signed-in users (public URL already bypasses RLS).
drop policy if exists "payment-qr: read" on storage.objects;
create policy "payment-qr: read" on storage.objects
  for select to authenticated
  using (bucket_id = 'payment-qr');

notify pgrst, 'reload schema';
