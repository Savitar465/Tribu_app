// Web Push fan-out, invoked by the `notifications_push` database trigger (see
// migration 0026_push_subscriptions.sql) on every `notifications` insert: look
// up the user's device subscriptions and deliver the notification through each
// push service. `public/sw.js` renders the payload (title/body/url) in the
// device's native notification tray. Dead subscriptions (HTTP 404/410) are
// deleted so the table self-heals as users clear site data or rotate devices.
//
// Deployed with --no-verify-jwt; access is guarded by the x-cron-secret
// header, which must match the BILLING_CRON_SECRET function secret (same
// secret the billing cron uses — both callers live in the database).
//
// Secrets: VAPID_KEYS (JSON {publicKey, privateKey} in JWK format) and
// VAPID_SUBJECT (mailto: contact), set via `supabase secrets set`.

import { createClient } from "npm:@supabase/supabase-js@2";
import {
  ApplicationServer,
  importVapidKeys,
  PushMessageError,
} from "jsr:@negrel/webpush@0.3.0";

const json = (status: number, body: unknown) =>
  new Response(JSON.stringify(body), { status, headers: { "Content-Type": "application/json" } });

// The VAPID application server is process-wide: import keys once per isolate.
const serverPromise = (async () => {
  const vapidKeys = await importVapidKeys(JSON.parse(Deno.env.get("VAPID_KEYS")!), {
    extractable: false,
  });
  return ApplicationServer.new({
    contactInformation: Deno.env.get("VAPID_SUBJECT") ?? "mailto:admin@tribu.app",
    vapidKeys,
  });
})();

Deno.serve(async (req) => {
  const secret = Deno.env.get("BILLING_CRON_SECRET");
  if (!secret || req.headers.get("x-cron-secret") !== secret) {
    return json(401, { error: "unauthorized" });
  }

  let payload: { user_id?: string; group_id?: string | null; title?: string; body?: string };
  try {
    payload = await req.json();
  } catch {
    return json(400, { error: "invalid json" });
  }
  if (!payload.user_id || !payload.title) {
    return json(400, { error: "user_id and title are required" });
  }

  const supabase = createClient(
    Deno.env.get("SUPABASE_URL")!,
    Deno.env.get("SUPABASE_SERVICE_ROLE_KEY")!,
  );

  const { data: subs, error } = await supabase
    .from("push_subscriptions")
    .select("id, endpoint, p256dh, auth")
    .eq("user_id", payload.user_id);
  if (error) return json(500, { error: error.message });
  if (!subs || subs.length === 0) return json(200, { sent: 0 });

  const appServer = await serverPromise;
  const message = JSON.stringify({
    title: payload.title,
    body: payload.body ?? "",
    url: payload.group_id ? `/?group=${payload.group_id}` : "/",
  });

  let sent = 0;
  const failures: string[] = [];
  await Promise.all(
    subs.map(async (s) => {
      try {
        await appServer
          .subscribe({ endpoint: s.endpoint, keys: { p256dh: s.p256dh, auth: s.auth } })
          .pushTextMessage(message, { ttl: 24 * 60 * 60 });
        sent++;
      } catch (err) {
        // 410 Gone (and 404 on some push services) → the device unsubscribed.
        const status = err instanceof PushMessageError ? err.response.status : null;
        if (status === 410 || status === 404) {
          await supabase.from("push_subscriptions").delete().eq("id", s.id);
        } else {
          failures.push(`${s.id}: ${err instanceof Error ? err.toString() : String(err)}`);
        }
      }
    }),
  );

  return json(200, { sent, failures });
});
