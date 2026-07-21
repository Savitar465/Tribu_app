// Monthly charge processor, invoked daily by pg_cron (see migration
// 0013_schedule_billing.sql). For every group whose billing day arrived in the
// current America/La_Paz cycle and that hasn't been billed yet: capture the
// official BCB rate, freeze the per-member cuota, settle each member against
// their prepaid balance (auto-paid when it covers the cuota; otherwise the
// month starts unpaid and any remainder is kept as compensation for the next
// top-up), notify each member with an account, and stamp the cycle. Mirrors
// the client-side fallback in lib/store.tsx (`processBilling`) — whichever
// runs first wins; both are guarded by `billed_cycle` (per group and per
// participant).
//
// Deployed with --no-verify-jwt; access is guarded by the x-cron-secret
// header, which must match the BILLING_CRON_SECRET function secret.

import { createClient } from "npm:@supabase/supabase-js@2";

const OFICIAL_URL = "https://apibcb.cucu.bo/api/v1/tc/oficial";

/** Human label for a yyyy-mm cycle, e.g. "junio 2026". */
function cycleLabel(cycle: string): string {
  return new Date(`${cycle}-02T12:00:00`).toLocaleDateString("es", { month: "long", year: "numeric" });
}

/** Format bolivianos like the app's fmtBs (e.g. "10 Bs", "12.5 Bs"). */
function fmtBs(n: number): string {
  const v = Math.round(n * 100) / 100;
  const str = Number.isInteger(v) ? String(v) : v.toFixed(2).replace(/0+$/, "").replace(/\.$/, "");
  return `${str} Bs`;
}

async function fetchOfficialRate(): Promise<number | null> {
  try {
    const res = await fetch(OFICIAL_URL, { headers: { accept: "application/json" } });
    if (!res.ok) return null;
    const tc = (await res.json())?.tc_oficial ?? {};
    const rate = Number(tc.venta ?? tc.base ?? tc.valor);
    return rate && !Number.isNaN(rate) ? rate : null;
  } catch {
    return null;
  }
}

const json = (status: number, body: unknown) =>
  new Response(JSON.stringify(body), { status, headers: { "Content-Type": "application/json" } });

Deno.serve(async (req) => {
  const secret = Deno.env.get("BILLING_CRON_SECRET");
  if (!secret || req.headers.get("x-cron-secret") !== secret) {
    return json(401, { error: "unauthorized" });
  }

  const supabase = createClient(
    Deno.env.get("SUPABASE_URL")!,
    Deno.env.get("SUPABASE_SERVICE_ROLE_KEY")!,
  );

  // Billing runs on Bolivia time regardless of where the function executes.
  const today = new Date().toLocaleDateString("en-CA", { timeZone: "America/La_Paz" }); // yyyy-mm-dd
  const cycle = today.slice(0, 7);
  const day = Number(today.slice(8, 10));
  const month = new Date().toLocaleDateString("es", { month: "long", timeZone: "America/La_Paz" });
  // Billing days beyond this month's length (29–31) come due on its last day —
  // otherwise those groups would silently skip short months (e.g. day 31 in
  // February) and never charge that cycle.
  const [yy, mm] = [Number(today.slice(0, 4)), Number(today.slice(5, 7))];
  const lastDay = new Date(yy, mm, 0).getDate();

  const { data: groups, error: gErr } = await supabase
    .from("groups")
    .select("*")
    .lte("billing_day", day === lastDay ? 31 : day)
    .or(`billed_cycle.is.null,billed_cycle.neq.${cycle}`);
  if (gErr) return json(500, { error: gErr.message });
  const dueGroups = groups ?? [];

  // One official-rate capture per run; null → USD groups fall back to the
  // owner's stored rate (and are skipped if that's unavailable too).
  const official = dueGroups.length > 0 ? await fetchOfficialRate() : null;

  let processed = 0;
  const failures: string[] = [];

  for (const g of dueGroups) {
    const { data: roster, error: pErr } = await supabase
      .from("group_participants")
      .select("*")
      .eq("group_id", g.id);
    if (pErr) {
      failures.push(`${g.id}: ${pErr.message}`);
      continue;
    }

    // A rate is needed for USD groups AND for BOB groups where some member's
    // custom price is defined in USD.
    const needsRate =
      g.currency === "USD" ||
      (roster ?? []).some(
        (p) => p.custom_amount != null && (p.custom_currency ?? g.currency) === "USD",
      );
    let rate = official;
    if (needsRate && rate == null) {
      const { data: owner } = await supabase
        .from("profiles")
        .select("exchange_rate")
        .eq("id", g.owner_id)
        .single();
      rate = owner?.exchange_rate ?? null;
      if (rate == null) {
        failures.push(`${g.id}: sin tipo de cambio`);
        continue;
      }
    }

    const totalBs = g.currency === "USD" ? g.amount * (rate as number) : g.amount;
    const n = Math.max(1, g.members_target);
    const per = g.round_cuota ? Math.ceil(totalBs / n) : totalBs / n;

    // Settle each member against their prepaid balance. The per-participant
    // `billed_cycle` stamp makes this idempotent across retries.
    const round2 = (n: number) => Math.round(n * 100) / 100;
    const notes: { user_id: string; group_id: string; title: string; body: string }[] = [];
    const chargeRows: { group_id: string; participant_id: string; cycle: string; cuota: number; paid: boolean; paid_at: string | null }[] = [];
    let settleFailed = false;

    // The owner always hears about the run — even when they manage the plan
    // without occupying a slot (no is_self roster row).
    notes.push({
      user_id: g.owner_id,
      group_id: g.id,
      title: `Cobro de ${g.name}`,
      body: `Se generó el cobro de ${month}: la cuota es ${fmtBs(per)}.`,
    });

    for (const p of roster ?? []) {
      // The owner collects — their own row is untouched by the charge.
      if (p.is_self) continue;
      if (p.billed_cycle === cycle) continue; // already settled this cycle

      // A member's percentage of the group total takes precedence (recalculated
      // at this cycle's rate); otherwise their custom price (in its own
      // currency — custom_currency, falling back to the group's) overrides the
      // split, converted at the same rate and rounding rule as the group.
      const custom = p.custom_amount != null ? Number(p.custom_amount) : null;
      const customCur = p.custom_currency ?? g.currency;
      const customBs =
        p.custom_pct != null
          ? (totalBs * Number(p.custom_pct)) / 100
          : custom != null && customCur === "USD"
            ? custom * (rate as number)
            : custom;
      const cuota =
        customBs != null ? (g.round_cuota ? Math.ceil(customBs) : customBs) : per;

      let balance = Number(p.prepaid_balance) || 0;
      let paid = false;
      let body: string;
      if (cuota > 0 && balance >= cuota) {
        balance = round2(balance - cuota);
        paid = true;
        body = `Cuota de ${month} (${fmtBs(cuota)}) cubierta con tu saldo adelantado · te quedan ${fmtBs(balance)}.`;
        if (balance < cuota) body += " Recarga para seguir cubierto el próximo mes.";
      } else if (balance > 0) {
        body = `Tu saldo adelantado (${fmtBs(balance)}) no cubre la cuota de ${month} (${fmtBs(cuota)}). Se guardará como compensación para tu próxima recarga · mientras tanto paga tu cuota del mes.`;
      } else {
        body = `Se generó el cobro de ${month}: tu cuota es ${fmtBs(cuota)}.`;
      }

      const { error: sErr } = await supabase
        .from("group_participants")
        .update({ prepaid_balance: balance, paid, proof_pending: false, billed_cycle: cycle })
        .eq("id", p.id);
      if (sErr) {
        failures.push(`${g.id}/${p.id}: ${sErr.message}`);
        settleFailed = true;
        break; // don't stamp the group cycle — retry on the next run
      }
      chargeRows.push({
        group_id: g.id,
        participant_id: p.id,
        cycle,
        cuota,
        paid,
        paid_at: paid ? new Date().toISOString() : null,
      });
      if (p.user_id) {
        notes.push({ user_id: p.user_id, group_id: g.id, title: `Cobro de ${g.name}`, body });
      }
    }
    if (settleFailed) continue;

    // Ledger rows for this cycle (who owes which month, at that month's price).
    if (chargeRows.length > 0) {
      const { error: cErr } = await supabase
        .from("participant_charges")
        .upsert(chargeRows, { onConflict: "participant_id,cycle", ignoreDuplicates: true });
      if (cErr) {
        failures.push(`${g.id}: ${cErr.message}`);
        continue; // don't stamp the cycle — retry on the next run
      }
    }

    if (notes.length > 0) {
      const { error: nErr } = await supabase.from("notifications").insert(notes);
      if (nErr) {
        failures.push(`${g.id}: ${nErr.message}`);
        continue; // don't stamp the cycle — retry on the next run
      }
    }

    const { error: uErr } = await supabase
      .from("groups")
      .update({ billed_cycle: cycle, billed_cuota: per })
      .eq("id", g.id);
    if (uErr) {
      failures.push(`${g.id}: ${uErr.message}`);
      continue;
    }

    // Keep the owner's displayed rate in sync with the rate the charge used.
    if (official != null) {
      await supabase
        .from("profiles")
        .update({ exchange_rate: official, rate_synced_on: today })
        .eq("id", g.owner_id);
    }
    processed++;
  }

  // -------------------------------------------------------------------------
  // Staggered payment reminders: 3 and 7 days after a charge went unpaid.
  // `reminder_level` per charge (1 = 3-day sent, 2 = 7-day sent) keeps each
  // tier to a single notification; the message aggregates every owed month
  // at the price charged that month.
  // -------------------------------------------------------------------------
  let reminders = 0;
  const { data: unpaidAll, error: uaErr } = await supabase
    .from("participant_charges")
    .select("*")
    .eq("paid", false)
    .is("deleted_at", null); // archived (exported) rows are never dunned
  if (uaErr) failures.push(`reminders: ${uaErr.message}`);

  if (unpaidAll && unpaidAll.length > 0) {
    const pids = [...new Set(unpaidAll.map((c) => c.participant_id))];
    const { data: parts } = await supabase
      .from("group_participants")
      .select("id, user_id, group_id, name")
      .in("id", pids)
      .not("user_id", "is", null);
    const gids = [...new Set((parts ?? []).map((p) => p.group_id))];
    const { data: gs } = gids.length
      ? await supabase.from("groups").select("id, name").in("id", gids)
      : { data: [] as { id: string; name: string }[] };
    const groupName = new Map((gs ?? []).map((g) => [g.id, g.name]));

    const nowMs = Date.now();
    const tierFor = (c: { created_at: string }) => {
      const days = (nowMs - new Date(c.created_at).getTime()) / 86400000;
      return days >= 7 ? 2 : days >= 3 ? 1 : 0;
    };

    for (const p of parts ?? []) {
      const owed = unpaidAll
        .filter((c) => c.participant_id === p.id)
        .sort((a, b) => a.cycle.localeCompare(b.cycle));
      const bumps = owed.filter((c) => tierFor(c) > (c.reminder_level ?? 0));
      if (bumps.length === 0) continue;

      const detail = owed.map((c) => `${cycleLabel(c.cycle)} (${fmtBs(Number(c.cuota))})`).join(", ");
      const total = fmtBs(owed.reduce((a, c) => a + Number(c.cuota), 0));
      const { error: rErr } = await supabase.from("notifications").insert({
        user_id: p.user_id,
        group_id: p.group_id,
        title: `Recordatorio de pago · ${groupName.get(p.group_id) ?? "tu grupo"}`,
        body: `Tienes ${owed.length === 1 ? "1 cuota pendiente" : `${owed.length} cuotas pendientes`}: ${detail} · total ${total}. Ponte al día desde "Pagar cuota".`,
      });
      if (rErr) {
        failures.push(`remind ${p.id}: ${rErr.message}`);
        continue; // levels untouched — retried tomorrow
      }
      for (const c of bumps) {
        await supabase.from("participant_charges").update({ reminder_level: tierFor(c) }).eq("id", c.id);
      }
      reminders++;
    }
  }

  return json(200, { cycle, processed, reminders, rate: official, failures });
});
