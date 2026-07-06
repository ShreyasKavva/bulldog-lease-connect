// Web Push subscription helper (Q77).
// Handles permission request, service worker subscription, and Supabase upsert.
import { supabase } from "@/integrations/supabase/client";

const VAPID_PUBLIC_KEY = (import.meta.env.VITE_VAPID_PUBLIC_KEY as string | undefined) || "";

export function pushSupported() {
  if (typeof window === "undefined") return false;
  return "serviceWorker" in navigator && "PushManager" in window && "Notification" in window;
}

export function pushPermission(): NotificationPermission | "unsupported" {
  if (!pushSupported()) return "unsupported";
  return Notification.permission;
}

function urlBase64ToUint8Array(base64String: string) {
  const padding = "=".repeat((4 - (base64String.length % 4)) % 4);
  const base64 = (base64String + padding).replace(/-/g, "+").replace(/_/g, "/");
  const raw = atob(base64);
  const out = new Uint8Array(raw.length);
  for (let i = 0; i < raw.length; i++) out[i] = raw.charCodeAt(i);
  return out;
}

/**
 * Ask for notification permission, subscribe via the active service worker,
 * and persist the subscription to `push_subscriptions` for the signed-in user.
 * Returns the outcome so callers can toast.
 */
export async function subscribeToPush(userId: string): Promise<
  | { ok: true }
  | { ok: false; reason: "unsupported" | "denied" | "no-vapid" | "no-sw" | "error"; error?: unknown }
> {
  if (!pushSupported()) return { ok: false, reason: "unsupported" };
  if (!VAPID_PUBLIC_KEY) {
    console.warn(
      "[push] VITE_VAPID_PUBLIC_KEY is not set. Generate keys with `npx web-push generate-vapid-keys` and add VITE_VAPID_PUBLIC_KEY (client) and VAPID_PRIVATE_KEY (server) as secrets.",
    );
    return { ok: false, reason: "no-vapid" };
  }
  try {
    const permission = await Notification.requestPermission();
    if (permission !== "granted") return { ok: false, reason: "denied" };

    const reg = await navigator.serviceWorker.getRegistration();
    if (!reg) return { ok: false, reason: "no-sw" };

    let sub = await reg.pushManager.getSubscription();
    if (!sub) {
      sub = await reg.pushManager.subscribe({
        userVisibleOnly: true,
        applicationServerKey: urlBase64ToUint8Array(VAPID_PUBLIC_KEY),
      });
    }
    const json = sub.toJSON();
    const { error } = await (supabase as any).from("push_subscriptions").upsert(
      {
        user_id: userId,
        endpoint: sub.endpoint,
        subscription: json,
        user_agent: typeof navigator !== "undefined" ? navigator.userAgent : null,
        updated_at: new Date().toISOString(),
      },
      { onConflict: "user_id,endpoint" },
    );
    if (error) return { ok: false, reason: "error", error };
    return { ok: true };
  } catch (error) {
    return { ok: false, reason: "error", error };
  }
}
