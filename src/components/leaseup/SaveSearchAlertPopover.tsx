/**
 * Q150 — "🔔 Save this search" alert popover for /browse.
 *
 * Works signed-in (email pre-filled from the profile) and signed-out
 * (email-only alert row). Duplicate filters+email combos are reported back as
 * "Alert already set" instead of creating a second row.
 */
import { useEffect, useState } from "react";
import { Bell } from "lucide-react";
import { toast } from "sonner";
import { Popover, PopoverContent, PopoverTrigger } from "@/components/ui/popover";
import { supabase } from "@/integrations/supabase/client";
import { useSession, useMyProfile } from "@/lib/leaseup/use-session";

export type AlertFilters = Record<string, string | number | boolean>;

export function SaveSearchAlertPopover({
  filters,
  campusId,
  label,
}: {
  /** Normalized snapshot of the active filters (used for dedupe + storage). */
  filters: AlertFilters;
  campusId?: string | null;
  /** Human summary shown inside the popover. */
  label?: string;
}) {
  const { user } = useSession();
  const { data: profile } = useMyProfile();
  const [open, setOpen] = useState(false);
  const [email, setEmail] = useState("");
  const [busy, setBusy] = useState(false);

  useEffect(() => {
    if (open) setEmail((e) => e || profile?.email || user?.email || "");
  }, [open, profile?.email, user?.email]);

  async function save() {
    const addr = email.trim().toLowerCase();
    if (!/^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(addr) || addr.length > 255) {
      toast.error("Enter a valid email address");
      return;
    }
    setBusy(true);
    try {
      // Dedupe: same email + same filter snapshot = already set.
      const { data: existing } = await supabase
        .from("saved_searches")
        .select("id, filters")
        .eq("email", addr)
        .limit(50);
      const snapshot = JSON.stringify(filters);
      if ((existing ?? []).some((r) => JSON.stringify(r.filters ?? {}) === snapshot)) {
        toast("Alert already set");
        setOpen(false);
        return;
      }

      const { error } = await supabase.from("saved_searches").insert({
        user_id: user?.id ?? null,
        email: addr,
        name: label?.slice(0, 80) || "New matches",
        campus_id: campusId ?? null,
        filters: filters as never,
        keyword: typeof filters.q === "string" ? filters.q : null,
        max_price: typeof filters.max_price === "number" ? filters.max_price : null,
        min_beds: typeof filters.min_beds === "number" ? filters.min_beds : null,
        notify: true,
      });
      if (error) {
        // Unique index on (email, filters) — the alert already exists.
        if (error.code === "23505") { toast("Alert already set"); setOpen(false); return; }
        throw error;
      }
      toast.success("Alert saved! We'll email you when new matches appear.");
      setOpen(false);
    } catch (e) {
      toast.error(e instanceof Error ? e.message : "Could not save that alert");
    } finally {
      setBusy(false);
    }

  }

  return (
    <Popover open={open} onOpenChange={setOpen}>
      <PopoverTrigger asChild>
        <button className="inline-flex items-center gap-1 rounded-full bg-primary px-3 py-1.5 text-xs font-bold text-primary-foreground hover:bg-primary-dark">
          <Bell className="h-3.5 w-3.5" />Save this search
        </button>
      </PopoverTrigger>
      <PopoverContent align="end" sideOffset={8} className="w-80 rounded-2xl p-4">
        <div className="text-sm font-bold text-foreground">Get emailed when new listings match these filters</div>
        {label && <p className="mt-1 text-xs text-muted-foreground">{label}</p>}
        <input
          type="email"
          value={email}
          autoFocus
          onChange={(e) => setEmail(e.target.value.slice(0, 255))}
          onKeyDown={(e) => { if (e.key === "Enter" && !busy) save(); }}
          placeholder="you@university.edu"
          aria-label="Email for alerts"
          className="mt-3 w-full rounded-xl border border-border bg-background px-3 py-2 text-sm outline-none focus:border-primary"
        />
        <button
          onClick={save}
          disabled={busy}
          className="mt-3 w-full rounded-xl bg-primary px-3 py-2 text-sm font-bold text-primary-foreground hover:bg-primary-dark disabled:opacity-60"
        >
          {busy ? "Saving…" : "Save alert"}
        </button>
        <Link
          to="/saved-alerts"
          onClick={() => setOpen(false)}
          className="mt-2 block text-center text-xs font-semibold text-primary hover:underline"
        >
          Manage your alerts →
        </Link>
      </PopoverContent>
    </Popover>
  );
}
