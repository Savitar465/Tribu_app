-- Payments v2: combined multi-group payments, paying on behalf of another
-- member, admin auto-approval, admin-without-slot groups and archivable
-- (soft-deleted) exported charges.
--
--   * group_participants.proof_by  — user who submitted the pending proof
--     (null = the member themself; set when someone pays on their behalf).
--   * participant_charges.paid_by  — user whose payment settled the charge
--     (null = legacy/system, e.g. auto-settled from prepaid balance).
--   * participant_charges.deleted_at — soft-delete stamp; archived rows are
--     excluded from the app, arrears and reminders but never physically lost.
--   * groups.admin_participates    — false when the admin manages the plan
--     without occupying a subscription slot (no `is_self` roster row).
--   * submit_payment_v2(items, proof_url) — transactional submission across
--     one or many groups: members mark their (or a fellow member's) months in
--     review; a group's admin is auto-approved without a receipt.
--   * archive_paid_charges(ids)    — admin-only soft delete of exported,
--     already-paid charge rows.
-- Idempotent.

alter table public.group_participants
  add column if not exists proof_by uuid references public.profiles (id) on delete set null;

alter table public.participant_charges
  add column if not exists paid_by uuid references public.profiles (id) on delete set null,
  add column if not exists deleted_at timestamptz;

alter table public.groups
  add column if not exists admin_participates boolean not null default true;

-- Member self-update guard (see 0009/0019), extended: a member may set
-- `proof_by` only to themself (or clear it) — never impersonate another payer.
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
  if new.proof_by is distinct from old.proof_by
     and new.proof_by is not null
     and new.proof_by <> (select auth.uid()) then
    raise exception 'proof_by must be the submitting user';
  end if;
  return new;
end;
$$;

-- ---------------------------------------------------------------------------
-- submit_payment_v2: submit one payment covering one or many participants
-- (possibly across groups), atomically. Each item pays a participant's listed
-- cycles. Rules:
--   * The caller must be a member or the admin of each participant's group.
--   * Admin caller → auto-approved: charges are marked paid (paid_by=caller),
--     no receipt required; the roster row's paid flag follows the current
--     cycle. Mirrors the manual approval flow.
--   * Member caller → the roster row goes into review (proof_pending) with
--     pay_cycles/proof_url/proof_by recorded; the admin approves as usual.
--   * When paying on behalf of someone else, the beneficiary is notified.
-- items: jsonb array of { "participant_id": uuid, "cycles": ["yyyy-mm", ...] }
-- ---------------------------------------------------------------------------
create or replace function public.submit_payment_v2(p_items jsonb, p_proof_url text default null)
returns jsonb language plpgsql security definer set search_path = '' as $$
declare
  v_uid uuid := (select auth.uid());
  v_cycle text := to_char(now() at time zone 'America/La_Paz', 'YYYY-MM');
  v_payer_name text;
  v_item jsonb;
  v_pid uuid;
  v_cycles text[];
  v_gp public.group_participants%rowtype;
  v_group public.groups%rowtype;
  v_is_admin boolean;
  v_approved int := 0;
  v_pending int := 0;
begin
  if v_uid is null then
    raise exception 'not authenticated';
  end if;
  if p_items is null or jsonb_typeof(p_items) <> 'array' or jsonb_array_length(p_items) = 0 then
    raise exception 'no payment items';
  end if;

  select coalesce(nullif(trim(pr.full_name), ''), pr.email, 'Un miembro')
    into v_payer_name
    from public.profiles pr where pr.id = v_uid;

  for v_item in select * from jsonb_array_elements(p_items) loop
    v_pid := (v_item ->> 'participant_id')::uuid;
    v_cycles := coalesce(
      (select array_agg(value #>> '{}') from jsonb_array_elements(v_item -> 'cycles')),
      array[]::text[]
    );
    if v_pid is null or array_length(v_cycles, 1) is null then
      raise exception 'invalid payment item';
    end if;

    select * into v_gp from public.group_participants where id = v_pid;
    if not found then
      raise exception 'participant not found';
    end if;
    select * into v_group from public.groups where id = v_gp.group_id;

    v_is_admin := v_group.owner_id = v_uid;
    if not v_is_admin and not public.is_group_member(v_gp.group_id, v_uid) then
      raise exception 'not a member of this group';
    end if;

    if v_is_admin then
      -- Admin payments need no receipt and no review: settle immediately.
      update public.participant_charges
         set paid = true, paid_at = now(), paid_by = v_uid, reminder_level = 0
       where participant_id = v_pid
         and cycle = any (v_cycles)
         and deleted_at is null
         and not paid;
      update public.group_participants
         set paid = case when v_cycle = any (v_cycles) then true else paid end,
             proof_pending = false,
             pay_cycles = null,
             proof_by = null
       where id = v_pid;
      v_approved := v_approved + 1;

      if v_gp.user_id is not null and v_gp.user_id <> v_uid then
        insert into public.notifications (user_id, group_id, title, body)
        values (
          v_gp.user_id,
          v_gp.group_id,
          'Pago registrado · ' || v_group.name,
          'El administrador registró tu pago de ' || array_to_string(v_cycles, ', ') || '.'
        );
      end if;
    else
      -- Member submission: the months go into review for the admin.
      update public.group_participants
         set proof_pending = true,
             proof_url = p_proof_url,
             pay_cycles = v_cycles,
             proof_by = case when v_gp.user_id is distinct from v_uid then v_uid else null end
       where id = v_pid;
      v_pending := v_pending + 1;

      if v_gp.user_id is not null and v_gp.user_id <> v_uid then
        insert into public.notifications (user_id, group_id, title, body)
        values (
          v_gp.user_id,
          v_gp.group_id,
          'Pago enviado por ti · ' || v_group.name,
          v_payer_name || ' envió un comprobante por tu cuota (' || array_to_string(v_cycles, ', ')
            || '). El administrador lo revisará.'
        );
      end if;
    end if;
  end loop;

  return jsonb_build_object('approved', v_approved, 'pending', v_pending);
end;
$$;

revoke execute on function public.submit_payment_v2(jsonb, text) from public, anon;
grant execute on function public.submit_payment_v2(jsonb, text) to authenticated;

-- ---------------------------------------------------------------------------
-- archive_paid_charges: soft-delete exported charge rows. Only the group's
-- admin may archive, and only rows that are already paid (unpaid rows are
-- live debts and must never disappear). Runs atomically; raises when any
-- requested row is not archivable so nothing is half-deleted.
-- ---------------------------------------------------------------------------
create or replace function public.archive_paid_charges(p_ids uuid[])
returns integer language plpgsql security definer set search_path = '' as $$
declare
  v_uid uuid := (select auth.uid());
  v_requested int := coalesce(array_length(p_ids, 1), 0);
  v_archived int;
begin
  if v_uid is null then
    raise exception 'not authenticated';
  end if;
  if v_requested = 0 then
    return 0;
  end if;

  update public.participant_charges c
     set deleted_at = now()
   where c.id = any (p_ids)
     and c.deleted_at is null
     and c.paid
     and public.is_group_admin(c.group_id, v_uid);
  get diagnostics v_archived = row_count;

  if v_archived <> v_requested then
    raise exception 'archive_paid_charges: % de % filas no se pueden archivar (no pagadas, ajenas o ya archivadas)',
      v_requested - v_archived, v_requested;
  end if;
  return v_archived;
end;
$$;

revoke execute on function public.archive_paid_charges(uuid[]) from public, anon;
grant execute on function public.archive_paid_charges(uuid[]) to authenticated;

notify pgrst, 'reload schema';
