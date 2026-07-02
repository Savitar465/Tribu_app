-- Let custom ("others") groups carry their own brand color so they aren't all
-- identical grey. Nullable: for catalog services the color falls back to the
-- services entry. Idempotent.

alter table public.groups
  add column if not exists color text;

notify pgrst, 'reload schema';
