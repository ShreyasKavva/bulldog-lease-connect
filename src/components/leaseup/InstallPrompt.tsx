import { useEffect, useState } from "react";
import { X } from "lucide-react";

const VISIT_KEY = "lu_visit_count";
const DISMISS_KEY = "dismissed_install_prompt";
const INSTALLED_KEY = "lu_pwa_installed";

type BIPEvent = Event & {
  prompt: () => Promise<void>;
  userChoice: Promise<{ outcome: "accepted" | "dismissed" }>;
};

function isStandalone() {
  if (typeof window === "undefined") return false;
  return (
    window.matchMedia?.("(display-mode: standalone)").matches ||
    (window.navigator as any).standalone === true
  );
}

function isIOS() {
  if (typeof navigator === "undefined") return false;
  const ua = navigator.userAgent || "";
  return /iPhone|iPad|iPod/i.test(ua) && !/CriOS|FxiOS|EdgiOS/i.test(ua);
}

export function InstallPrompt() {
  const [open, setOpen] = useState(false);
  const [deferred, setDeferred] = useState<BIPEvent | null>(null);
  const [ios, setIos] = useState(false);

  useEffect(() => {
    if (typeof window === "undefined") return;
    if (isStandalone() || localStorage.getItem(INSTALLED_KEY) === "true") return;
    if (localStorage.getItem(DISMISS_KEY) === "true") return;

    const n = Number(localStorage.getItem(VISIT_KEY) || "0") + 1;
    localStorage.setItem(VISIT_KEY, String(n));

    const onBIP = (e: Event) => {
      e.preventDefault();
      setDeferred(e as BIPEvent);
      if (n >= 3) setOpen(true);
    };
    const onInstalled = () => {
      localStorage.setItem(INSTALLED_KEY, "true");
      setOpen(false);
    };
    window.addEventListener("beforeinstallprompt", onBIP);
    window.addEventListener("appinstalled", onInstalled);

    // iOS — no beforeinstallprompt; show instructions after 3 visits
    if (n >= 3 && isIOS()) {
      setIos(true);
      setOpen(true);
    }
    return () => {
      window.removeEventListener("beforeinstallprompt", onBIP);
      window.removeEventListener("appinstalled", onInstalled);
    };
  }, []);

  const dismiss = (permanent = false) => {
    if (permanent) localStorage.setItem(DISMISS_KEY, "true");
    setOpen(false);
  };

  const install = async () => {
    if (!deferred) return dismiss(true);
    try {
      await deferred.prompt();
      const res = await deferred.userChoice;
      if (res.outcome === "accepted") localStorage.setItem(INSTALLED_KEY, "true");
    } catch {}
    setDeferred(null);
    setOpen(false);
  };

  if (!open) return null;

  return (
    <div
      className="fixed bottom-0 left-0 right-0 z-[9998] mx-auto max-w-md p-3 pb-[max(env(safe-area-inset-bottom),12px)]"
      role="dialog"
      aria-label="Install LeaseUp"
    >
      <div className="lu-shadow rounded-2xl border border-slate-200 bg-white p-4">
        <div className="flex items-start gap-3">
          <div className="flex h-11 w-11 shrink-0 items-center justify-center rounded-xl bg-[#2563EB] text-lg font-extrabold text-white">L↑</div>
          <div className="min-w-0 flex-1">
            <div className="text-sm font-semibold text-slate-900">📱 Add LeaseUp to your home screen</div>
            <div className="mt-0.5 text-xs text-slate-500">
              {ios
                ? "Tap the Share button, then \"Add to Home Screen\"."
                : "Open it like an app — no browser bar."}
            </div>
          </div>
          <button
            aria-label="Close"
            onClick={() => dismiss(true)}
            className="-mr-1 -mt-1 flex h-8 w-8 items-center justify-center rounded-full text-slate-400 hover:bg-slate-100"
          >
            <X className="h-4 w-4" />
          </button>
        </div>
        <div className="mt-3 flex items-center justify-end gap-2">
          <button
            onClick={() => dismiss(true)}
            className="min-h-11 rounded-lg px-3 text-sm font-medium text-slate-600 hover:bg-slate-50"
          >
            Not now
          </button>
          {!ios && (
            <button
              onClick={install}
              className="min-h-11 rounded-lg bg-[#2563EB] px-4 text-sm font-semibold text-white hover:bg-[#1d4ed8]"
            >
              Add to Home Screen
            </button>
          )}
        </div>
      </div>
    </div>
  );
}
