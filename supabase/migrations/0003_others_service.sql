-- Add the "others" catalog entry so users can create a fully customized group.
-- groups.service_id is a NOT NULL FK to public.services, so a custom group still
-- needs a services row to point at; the user supplies the real name/cost per group.
-- Idempotent: safe to run more than once.

insert into public.services (id, name, mono, color, default_plan) values
  ('others', 'Grupo personalizado', '+', '#7b8794', 'Personalizado')
on conflict (id) do update
  set name = excluded.name, mono = excluded.mono, color = excluded.color, default_plan = excluded.default_plan;

notify pgrst, 'reload schema';
