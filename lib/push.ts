import type { SupabaseClient } from "@supabase/supabase-js";

// Web Push subscription management. The service worker (public/sw.js) renders
// incoming pushes; the send-push Edge Function delivers them for every
// `notifications` insert. Here the browser opts a device in/out and mirrors
// the subscription into `push_subscriptions` (one row per endpoint).

/** Decode a base64url VAPID public key into the bytes pushManager expects. */
function urlBase64ToUint8Array(base64Url: string): Uint8Array {
  const padded = base64Url + "=".repeat((4 - (base64Url.length % 4)) % 4);
  const raw = atob(padded.replace(/-/g, "+").replace(/_/g, "/"));
  return Uint8Array.from(raw, (c) => c.charCodeAt(0));
}

/** True when this browser can receive Web Push (on iOS: only once installed to the home screen). */
export function pushSupported(): boolean {
  return (
    typeof window !== "undefined" &&
    "serviceWorker" in navigator &&
    "PushManager" in window &&
    "Notification" in window
  );
}

/** The device's current push subscription, if the user opted in earlier. */
export async function getPushSubscription(): Promise<PushSubscription | null> {
  if (!pushSupported()) return null;
  const reg = await navigator.serviceWorker.ready;
  return reg.pushManager.getSubscription();
}

/**
 * Ask for notification permission and register this device for pushes.
 * Must be called from a user gesture (iOS requirement). Returns false when
 * the user denied permission or the environment can't do push.
 */
export async function enablePush(supabase: SupabaseClient): Promise<boolean> {
  if (!pushSupported()) return false;
  const vapidKey = process.env.NEXT_PUBLIC_VAPID_PUBLIC_KEY;
  if (!vapidKey) return false;

  const permission = await Notification.requestPermission();
  if (permission !== "granted") return false;

  const { data } = await supabase.auth.getSession();
  const userId = data.session?.user.id;
  if (!userId) return false;

  const reg = await navigator.serviceWorker.ready;
  const sub =
    (await reg.pushManager.getSubscription()) ??
    (await reg.pushManager.subscribe({
      userVisibleOnly: true,
      applicationServerKey: urlBase64ToUint8Array(vapidKey) as BufferSource,
    }));

  const json = sub.toJSON();
  if (!json.endpoint || !json.keys?.p256dh || !json.keys?.auth) return false;
  const { error } = await supabase.from("push_subscriptions").upsert(
    { user_id: userId, endpoint: json.endpoint, p256dh: json.keys.p256dh, auth: json.keys.auth },
    { onConflict: "endpoint" },
  );
  return !error;
}

/** Unregister this device: drop the DB row and the browser subscription. */
export async function disablePush(supabase: SupabaseClient): Promise<void> {
  const sub = await getPushSubscription();
  if (!sub) return;
  await supabase.from("push_subscriptions").delete().eq("endpoint", sub.endpoint);
  await sub.unsubscribe();
}
