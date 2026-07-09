-- Per-member custom pricing. `group_participants.custom_amount` overrides the
-- group's per-member split for that member, expressed in the GROUP's currency
-- (like groups.amount): USD groups convert at the official rate captured on
-- each billing day and respect `round_cuota`, so exchange-rate and rounding
-- rules keep working. Null = the member pays the default split.
--
-- The member self-update guard gains the new column: only the group's admin
-- may change a member's price. Idempotent.

alter table public.group_participants
  add column if not exists custom_amount numeric check (custom_amount is null or custom_amount > 0);

-- Guard (see 0009/0019/0020) with custom_amount added to the forbidden list.
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
     or new.custom_amount   is distinct from old.custom_amount
     or new.billed_cycle    is distinct from old.billed_cycle then
    raise exception 'Members may only submit their own payment proof';
  end if;
  if new.proof_by is distinct from old.proof_by
     and new.proof_by is not null
     and new.proof_by <> (select auth.uid()) then
    raise exception 'proof_by must be the submitting user';
  end if;
  return new;
end;
$$;

notify pgrst, 'reload schema';
