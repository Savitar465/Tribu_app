-- Update the member self-update guard for the prepaid/arrears columns.
-- A non-admin member may only change the proof-submission fields on their own
-- row: proof_pending, proof_url, pay_cycles, prepay_pending, prepay_months.
-- Everything else — including paid, prepaid_balance and billed_cycle (which
-- would allow self-approval or self-crediting) — stays admin-only. Idempotent.

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
     or new.billed_cycle    is distinct from old.billed_cycle then
    raise exception 'Members may only submit their own payment proof';
  end if;
  return new;
end;
$$;

notify pgrst, 'reload schema';
