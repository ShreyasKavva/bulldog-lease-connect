import { useEffect, useState } from "react";
import { Bell, X } from "lucide-react";
import { supabase } from "@/integrations/supabase/client";
import { pushSupported, pushPermission, subscribeToPush } from "@/lib/leaseup/push";
import { toast } from "sonner";

const ASKED_KEY = "lu_push_asked";
const SESSION_DISMISS = "lu_push_dismissed_session";

/**
 * Global, non-blocking banner that appears after a user sends their first
 * message. Asks for push permission once (respects dismissal).
 */
export function PushPermissionPrompt() {
  const [open, setOpen] = useState(false);
  const [busy, setBusy] = useState(false);

  useEffect(() => {
    if (typeof window === "undefined") return;
    if (!pushSupported()) return;
    const perm = pushPermission();
    if (perm !== "default") return; // already granted or denied
    if (localStorage.getItem(ASKED_KEY) === "true") return;
    if (sessionStorage.getItem(SESSION_DISMISS) === "true") return;

    const onSent = () => setOpen(true);
    window.addEventListener("lu:message-sent", onSent);
    return () => window.removeEventListener("lu:message-sent", onSent);
  }, []);

  const decline = () => {
    sessionStorage.setItem(SESSION_DISMISS, "true");
    setOpen(false);
  };

  const allow = async () => {
    setBusy(true);
    try {
      const { data } = await supabase.auth.getUser();
      const uid = data.user?.id;
      if (!uid) {
        decline();
        return;
      }
      const res = await subscribeToPush(uid);
      if (res.ok) {
        toast.success("Notifications on — we'll ping you when they reply.");
        localStorage.setItem(ASKED_KEY, "true");
      } else if (res.reason === "denied") {
        toast.message("You can enable notifications later in your browser settings.");
        localStorage.setItem(ASKED_KEY, "true");
      } else if (res.reason === "no-vapid") {
        toast.error("Push isn't fully set up yet. Try again soon.");
      } else if (res.reason === "unsupported") {
        localStorage.setItem(ASKED_KEY, "true");
      } else {
        toast.error("Couldn't enable notifications.");
      }
    } finally {
      setBusy(false);
      setOpen(false);
    }
  };

  if (!open) return null;

  return (
    <div
      className="fixed left-0 right-0 z-[9997] mx-auto max-w-md p-3"
      style={{ bottom: "calc(env(safe-area-inset-bottom, 0px) + 72px)" }}
      role="dialog"
      aria-label="Enable notifications"
    >
      <div className="lu-shadow rounded-2xl border border-slate-200 bg-white p-4">
        <div className="flex items-start gap-3">
          <div className="flex h-11 w-11 shrink-0 items-center justify-center rounded-xl bg-[#2563EB] text-white">
            <Bell className="h-5 w-5" />
          </div>
          <div className="min-w-0 flex-1">
            <div className="text-sm font-semibold text-slate-900">Get notified when they reply</div>
            <div className="mt-0.5 text-xs text-slate-500">
              We'll ping you the moment they write back — no need to keep refreshing.
            </div>
          </div>
          <button
            aria-label="Close"
            onClick={decline}
            className="-mr-1 -mt-1 flex h-8 w-8 items-center justify-center rounded-full text-slate-400 hover:bg-slate-100"
          >
            <X className="h-4 w-4" />
          </button>
        </div>
        <div className="mt-3 flex items-center justify-end gap-2">
          <button
            onClick={decline}
            className="min-h-11 rounded-lg px-3 text-sm font-medium text-slate-600 hover:bg-slate-50"
          >
            No thanks
          </button>
          <button
            onClick={allow}
            disabled={busy}
            className="min-h-11 rounded-lg bg-[#2563EB] px-4 text-sm font-semibold text-white hover:bg-[#1d4ed8] disabled:opacity-60"
          >
            {busy ? "Enabling…" : "Allow notifications"}
          </button>
        </div>
      </div>
    </div>
  );
}
