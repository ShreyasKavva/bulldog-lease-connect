/**
 * Q179 — every accredited US school now has a campus page, so most of them
 * start with zero listings. Instead of a dead end we show three things:
 * a "be the first" CTA, an email capture so we can tell them when their
 * school goes live, and nearby campuses that already have subleases.
 */
import { useState } from "react";
import { Link } from "@tanstack/react-router";
import { useQuery } from "@tanstack/react-query";
import { toast } from "sonner";
import { MapPin, Plus } from "lucide-react";
import { fetchNearbyCampuses, requestCampusNotify, type Campus } from "@/lib/leaseup/campuses";
import { useSession } from "@/lib/leaseup/use-session";

export function CampusEmptyState({ campus }: { campus: Campus }) {
  const { user } = useSession();
  const [email, setEmail] = useState("");
  const [sent, setSent] = useState(false);
  const [busy, setBusy] = useState(false);

  const { data: nearby = [] } = useQuery({
    queryKey: ["nearby-campuses", campus.id],
    queryFn: () => fetchNearbyCampuses(campus.id, 4),
    staleTime: 5 * 60 * 1000,
  });

  async function notifyMe(e: React.FormEvent) {
    e.preventDefault();
    const value = (email || user?.email || "").trim();
    if (!/^\S+@\S+\.\S+$/.test(value)) {
      toast.error("Enter a valid email");
      return;
    }
    setBusy(true);
    try {
      await requestCampusNotify(campus.id, value, user?.id ?? null);
      setSent(true);
      toast.success(`We'll email you when ${campus.short_name ?? campus.name} goes live`);
    } catch {
      toast.error("Couldn't save that — try again");
    } finally {
      setBusy(false);
    }
  }

  return (
    <div className="space-y-6">
      <div className="rounded-3xl border border-border bg-surface p-8 text-center sm:p-12">
        <div className="mx-auto mb-4 grid h-12 w-12 place-items-center rounded-full bg-primary-light text-primary">
          <MapPin className="h-6 w-6" />
        </div>
        <h3 className="text-lg font-extrabold">No subleases at {campus.name} yet</h3>
        <p className="mx-auto mt-2 max-w-md text-sm text-muted-foreground">
          LeaseUp is brand new here. Post the first sublease and every student searching
          {" "}{campus.short_name ?? campus.name} will see it.
        </p>
        <Link
          to="/post"
          className="mt-5 inline-flex items-center gap-1.5 rounded-full bg-primary px-5 py-2.5 text-sm font-bold text-primary-foreground hover:bg-primary-dark"
        >
          <Plus className="h-4 w-4" />
          Post the first sublease
        </Link>

        <div className="mx-auto mt-8 max-w-sm border-t border-border pt-6">
          {sent ? (
            <p className="text-sm font-semibold text-primary">
              You're on the list — we'll email you the moment listings appear.
            </p>
          ) : (
            <>
              <p className="text-sm font-semibold">Just looking? Get notified.</p>
              <form onSubmit={notifyMe} className="mt-3 flex gap-2">
                <input
                  type="email"
                  value={email || user?.email || ""}
                  onChange={(e) => setEmail(e.target.value)}
                  placeholder="you@school.edu"
                  aria-label="Email for campus notifications"
                  className="min-w-0 flex-1 rounded-full border border-border bg-background px-4 py-2 text-sm outline-none focus:border-primary"
                />
                <button
                  type="submit"
                  disabled={busy}
                  className="shrink-0 rounded-full bg-foreground px-4 py-2 text-sm font-bold text-background disabled:opacity-50"
                >
                  {busy ? "…" : "Notify me"}
                </button>
              </form>
            </>
          )}
        </div>
      </div>

      {nearby.length > 0 && (
        <div>
          <h3 className="mb-3 text-sm font-bold uppercase tracking-wide text-muted-foreground">
            Nearby campuses with listings
          </h3>
          <div className="grid gap-3 sm:grid-cols-2 lg:grid-cols-4">
            {nearby.map((c) => (
              <Link
                key={c.id}
                to="/campus/$slug"
                params={{ slug: c.slug }}
                className="rounded-2xl border border-border bg-surface p-4 transition hover:border-primary/50"
              >
                <div className="truncate font-semibold">{c.short_name ?? c.name}</div>
                <div className="mt-0.5 truncate text-xs text-muted-foreground">
                  {c.city}, {c.state} · {c.distance_miles} mi away
                </div>
                <div className="mt-2 text-xs font-bold text-primary">
                  {c.listing_count} sublease{c.listing_count === 1 ? "" : "s"}
                </div>
              </Link>
            ))}
          </div>
        </div>
      )}
    </div>
  );
}
