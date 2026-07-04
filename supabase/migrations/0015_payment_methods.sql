-- Receipt uploads + international payment methods.
-- `group_participants.proof_url` stores the member's transfer receipt image
-- (bucket `payment-proofs`, path `<group_id>/<participant_id>`), and the
-- groups table gains admin-configured ways to receive money from abroad:
-- `paypal_info` (email or paypal.me link) and `bank_info` (free-text account
-- details, e.g. UglyCash / bank transfer). Idempotent.

alter table public.groups
  add column if not exists paypal_info text,
  add column if not exists bank_info text;

alter table public.group_participants
  add column if not exists proof_url text;

-- Public bucket for receipts (unguessable uuid paths). 5 MB cap, images only.
insert into storage.buckets (id, name, public, file_size_limit, allowed_mime_types)
values ('payment-proofs', 'payment-proofs', true, 5242880, array['image/png', 'image/jpeg', 'image/webp'])
on conflict (id) do update
  set public = true,
      file_size_limit = excluded.file_size_limit,
      allowed_mime_types = excluded.allowed_mime_types;

-- Objects live at `<group_id>/...`; any member of that group (or its admin)
-- may upload/replace a receipt there.
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

notify pgrst, 'reload schema';
