// Monthly charge processor, invoked daily by pg_cron (see migration
// 0013_schedule_billing.sql). For every group whose billing day arrived in the
// current America/La_Paz cycle and that hasn't been billed yet: capture the
// official BCB rate, freeze the per-member cuota, notify each member with an
// account, and stamp the cycle. Mirrors the client-side fallback in
// lib/store.tsx (`processBilling`) — whichever runs first wins; both are
// guarded by `billed_cycle`.
//
// Deployed with --no-verify-jwt; access is guarded by the x-cron-secret
// header, which must match the BILLING_CRON_SECRET function secret.

import { createClient } from "npm:@supabase/supabase-js@2";

const OFICIAL_URL = "https://apibcb.cucu.bo/api/v1/tc/oficial";

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

  const { data: groups, error: gErr } = await supabase
    .from("groups")
    .select("*")
    .lte("billing_day", day)
    .or(`billed_cycle.is.null,billed_cycle.neq.${cycle}`);
  if (gErr) return json(500, { error: gErr.message });
  if (!groups || groups.length === 0) return json(200, { cycle, processed: 0 });

  // One official-rate capture per run; null → USD groups fall back to the
  // owner's stored rate (and are skipped if that's unavailable too).
  const official = await fetchOfficialRate();

  let processed = 0;
  const failures: string[] = [];

  for (const g of groups) {
    let rate = official;
    if (g.currency === "USD" && rate == null) {
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

    const { data: recipients, error: pErr } = await supabase
      .from("group_participants")
      .select("user_id")
      .eq("group_id", g.id)
      .not("user_id", "is", null);
    if (pErr) {
      failures.push(`${g.id}: ${pErr.message}`);
      continue;
    }

    if (recipients && recipients.length > 0) {
      const { error: nErr } = await supabase.from("notifications").insert(
        recipients.map((p) => ({
          user_id: p.user_id,
          group_id: g.id,
          title: `Cobro de ${g.name}`,
          body: `Se generó el cobro de ${month}: tu cuota es ${fmtBs(per)}.`,
        })),
      );
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

  return json(200, { cycle, processed, rate: official, failures });
});
