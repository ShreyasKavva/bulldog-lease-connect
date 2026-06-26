import { Link } from "@tanstack/react-router";
import { ArrowRight, X } from "lucide-react";
import { useEffect, useState } from "react";

const DISMISS_KEY = "leaseup_guest_ribbon_dismissed_at";

export function GuestRibbon() {
  const [dismissed, setDismissed] = useState(true);

  useEffect(() => {
    try {
      const v = localStorage.getItem(DISMISS_KEY);
      if (!v) return setDismissed(false);
      const at = Number(v);
      // Re-show after 24h so guests get reminded
      if (Date.now() - at > 24 * 60 * 60 * 1000) setDismissed(false);
    } catch {
      setDismissed(false);
    }
  }, []);

  if (dismissed) return null;

  return (
    <div className="pointer-events-auto fixed inset-x-0 bottom-16 z-30 flex justify-center px-3 pb-2 md:bottom-3">
      <div className="flex w-full max-w-md items-center gap-2 rounded-full bg-foreground/95 px-3 py-2 text-surface shadow-card-lg backdrop-blur">
        <span className="grid h-7 w-7 shrink-0 place-items-center rounded-full bg-primary text-[11px] font-black text-primary-foreground">
          LU
        </span>
        <div className="min-w-0 flex-1">
          <div className="truncate text-xs font-bold">Browsing as a guest</div>
          <div className="truncate text-[11px] opacity-70">
            Sign up to message students &amp; post a listing
          </div>
        </div>
        <Link
          to="/auth"
          search={{ mode: "up" }}
          className="inline-flex shrink-0 items-center gap-1 rounded-full bg-primary px-3 py-1.5 text-[11px] font-bold text-primary-foreground hover:bg-primary-dark"
        >
          Join free
          <ArrowRight className="h-3 w-3" />
        </Link>
        <button
          onClick={() => {
            try {
              localStorage.setItem(DISMISS_KEY, String(Date.now()));
            } catch {}
            setDismissed(true);
          }}
          aria-label="Dismiss"
          className="grid h-6 w-6 shrink-0 place-items-center rounded-full text-surface/70 hover:bg-white/10"
        >
          <X className="h-3.5 w-3.5" />
        </button>
      </div>
    </div>
  );
}
