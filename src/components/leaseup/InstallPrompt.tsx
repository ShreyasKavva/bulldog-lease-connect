import { useEffect, useState } from "react";
import { X, Share } from "lucide-react";

const DISMISS_KEY = "dismissed_install_prompt";
const INSTALLED_KEY = "install_prompted";
const SESSION_DISMISS = "lu_install_dismissed_session";
const IOS_HINT_DISMISS = "lu_ios_hint_dismissed";
const MIN_LISTING_VIEWS = 2;

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

function isIOSSafari() {
  if (typeof navigator === "undefined") return false;
  const ua = navigator.userAgent || "";
  return /iPhone|iPad|iPod/i.test(ua) && !/CriOS|FxiOS|EdgiOS/i.test(ua);
}

function isMobile() {
  if (typeof window === "undefined") return false;
  return window.innerWidth < 768 || /Mobi|Android|iPhone|iPad|iPod/i.test(navigator.userAgent || "");
}

function listingViews() {
  if (typeof window === "undefined") return 0;
  return Number(localStorage.getItem("lu_listing_views") || "0");
}

export function InstallPrompt() {
  const [mode, setMode] = useState<"none" | "install" | "ios">("none");
  const [deferred, setDeferred] = useState<BIPEvent | null>(null);

  useEffect(() => {
    if (typeof window === "undefined") return;
    // Hide entirely if installed / already prompted permanently / not mobile.
    if (isStandalone() || localStorage.getItem(INSTALLED_KEY) === "true") return;
    if (localStorage.getItem(DISMISS_KEY) === "true") return;
    if (!isMobile()) return;
    if (sessionStorage.getItem(SESSION_DISMISS) === "true") return;

    const maybeShow = () => {
      if (listingViews() < MIN_LISTING_VIEWS) return;
      if (deferred) setMode("install");
      else if (isIOSSafari() && sessionStorage.getItem(IOS_HINT_DISMISS) !== "true") {
        setMode("ios");
      }
    };

    const onBIP = (e: Event) => {
      e.preventDefault();
      setDeferred(e as BIPEvent);
      maybeShow();
    };
    const onInstalled = () => {
      localStorage.setItem(INSTALLED_KEY, "true");
      setMode("none");
    };
    const onViewed = () => maybeShow();

    window.addEventListener("beforeinstallprompt", onBIP);
    window.addEventListener("appinstalled", onInstalled);
    window.addEventListener("lu:listing-viewed", onViewed);
    // Also check on mount (in case they arrive already past threshold).
    maybeShow();

    return () => {
      window.removeEventListener("beforeinstallprompt", onBIP);
      window.removeEventListener("appinstalled", onInstalled);
      window.removeEventListener("lu:listing-viewed", onViewed);
    };
  }, [deferred]);

  const dismissSession = () => {
    sessionStorage.setItem(SESSION_DISMISS, "true");
    setMode("none");
  };
  const dismissIOS = () => {
    sessionStorage.setItem(IOS_HINT_DISMISS, "true");
    setMode("none");
  };

  const install = async () => {
    if (!deferred) return dismissSession();
    try {
      await deferred.prompt();
      const res = await deferred.userChoice;
      if (res.outcome === "accepted") {
        localStorage.setItem(INSTALLED_KEY, "true");
      } else {
        sessionStorage.setItem(SESSION_DISMISS, "true");
      }
    } catch {}
    setDeferred(null);
    setMode("none");
  };

  if (mode === "none") return null;

  return (
    <div
      className="fixed left-0 right-0 z-[9998] mx-auto max-w-md p-3 md:hidden"
      style={{ bottom: "calc(env(safe-area-inset-bottom, 0px) + 72px)" }}
      role="dialog"
      aria-label="Install LeaseUp"
    >
      <div className="lu-shadow rounded-2xl border border-slate-200 bg-white p-4">
        <div className="flex items-start gap-3">
          <div className="flex h-11 w-11 shrink-0 items-center justify-center rounded-xl bg-[#2563EB] text-lg font-extrabold text-white">
            {mode === "ios" ? <Share className="h-5 w-5" /> : "L↑"}
          </div>
          <div className="min-w-0 flex-1">
            <div className="text-sm font-semibold text-slate-900">
              {mode === "ios"
                ? "Add LeaseUp to your home screen"
                : "Add LeaseUp to your home screen"}
            </div>
            <div className="mt-0.5 text-xs text-slate-500">
              {mode === "ios"
                ? 'Tap Share → "Add to Home Screen" to install LeaseUp.'
                : "Quick access from your home screen — no browser bar."}
            </div>
          </div>
          <button
            aria-label="Close"
            onClick={mode === "ios" ? dismissIOS : dismissSession}
            className="-mr-1 -mt-1 flex h-8 w-8 items-center justify-center rounded-full text-slate-400 hover:bg-slate-100"
          >
            <X className="h-4 w-4" />
          </button>
        </div>
        {mode === "install" && (
          <div className="mt-3 flex items-center justify-end gap-2">
            <button
              onClick={dismissSession}
              className="min-h-11 rounded-lg px-3 text-sm font-medium text-slate-600 hover:bg-slate-50"
            >
              Not now
            </button>
            <button
              onClick={install}
              className="min-h-11 rounded-lg bg-[#2563EB] px-4 text-sm font-semibold text-white hover:bg-[#1d4ed8]"
            >
              Install ↑
            </button>
          </div>
        )}
        {mode === "ios" && (
          <div className="mt-3 flex items-center justify-end">
            <button
              onClick={dismissIOS}
              className="min-h-11 rounded-lg bg-slate-900 px-4 text-sm font-semibold text-white hover:bg-slate-800"
            >
              Got it
            </button>
          </div>
        )}
      </div>
    </div>
  );
}
