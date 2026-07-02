-- Members can update only their own roster row (RLS), but that alone would let
-- them flip their own `paid` flag (self-approval). This trigger restricts a
-- non-admin update to changing `proof_pending` only; the group owner (admin)
-- may still change anything. Idempotent.

create or replace function public.enforce_participant_member_update()
returns trigger language plpgsql security definer set search_path = '' as $$
begin
  -- Group owner (admin) may change anything.
  if public.is_group_admin(new.group_id, (select auth.uid())) then
    return new;
  end if;
  -- Otherwise (a member editing their own row) only proof_pending may change.
  if new.paid     is distinct from old.paid
     or new.name    is distinct from old.name
     or new.color   is distinct from old.color
     or new.sort    is distinct from old.sort
     or new.is_self is distinct from old.is_self
     or new.user_id is distinct from old.user_id
     or new.email   is distinct from old.email
     or new.group_id is distinct from old.group_id then
    raise exception 'Members may only submit their own payment proof';
  end if;
  return new;
end;
$$;

drop trigger if exists trg_participant_member_update on public.group_participants;
create trigger trg_participant_member_update
  before update on public.group_participants
  for each row execute function public.enforce_participant_member_update();

notify pgrst, 'reload schema';
