/**
 * Q151 — Saved alerts manager. Lists the current user's saved searches
 * (matched by user_id or their account email) and lets them delete one.
 *
 * Signed-out lookup by email is intentionally not supported: saved_searches
 * rows are private, so anon SELECT would leak other people's alert emails.
 */
import { createFileRoute, Link } from "@tanstack/react-router";
import { useQuery, useQueryClient } from "@tanstack/react-query";
import { ChevronLeft, Bell, Trash2 } from "lucide-react";
import { toast } from "sonner";
import { supabase } from "@/integrations/supabase/client";
import { useSession, useMyProfile } from "@/lib/leaseup/use-session";
import { openSignIn } from "@/components/leaseup/SignInModal";

export const Route = createFileRoute("/saved-alerts")({
  head: () => ({
    meta: [
      { title: "Your search alerts — LeaseUp" },
      { name: "description", content: "Manage the sublease searches we email you about when new listings match." },
      { property: "og:title", content: "Your search alerts — LeaseUp" },
      { property: "og:description", content: "Manage the sublease searches we email you about when new listings match." },
      { property: "og:type", content: "website" },
      { name: "twitter:card", content: "summary" },
    ],
  }),
  component: SavedAlertsPage,
});

type AlertRow = {
  id: string;
  name: string;
  email: string | null;
  campus_id: string | null;
  max_price: number | null;
  min_beds: number | null;
  keyword: string | null;
  filters: Record<string, unknown> | null;
  created_at: string;
};

function SavedAlertsPage() {
  const { user, loading } = useSession();
  const { data: profile } = useMyProfile();
  const qc = useQueryClient();
  const email = (profile?.email || user?.email || "").toLowerCase();

  const { data: alerts = [], isLoading } = useQuery({
    queryKey: ["saved-alerts", user?.id, email],
    enabled: !!user,
    queryFn: async () => {
      const filter = email
        ? `user_id.eq.${user!.id},email.eq.${email}`
        : `user_id.eq.${user!.id}`;
      const { data, error } = await supabase
        .from("saved_searches")
        .select("id, name, email, campus_id, max_price, min_beds, keyword, filters, created_at")
        .or(filter)
        .order("created_at", { ascending: false });
      if (error) throw error;
      return (data ?? []) as unknown as AlertRow[];
    },
  });

  const { data: campuses = [] } = useQuery({
    queryKey: ["campuses-min"],
    queryFn: async () => {
      const { data } = await supabase.from("campuses").select("id, name");
      return (data ?? []) as { id: string; name: string }[];
    },
  });
  const campusName = (id: string | null) => campuses.find((c) => c.id === id)?.name ?? null;

  async function remove(id: string) {
    qc.setQueryData<AlertRow[]>(["saved-alerts", user?.id, email], (prev) =>
      (prev ?? []).filter((a) => a.id !== id),
    );
    const { error } = await supabase.from("saved_searches").delete().eq("id", id);
    if (error) {
      qc.invalidateQueries({ queryKey: ["saved-alerts", user?.id, email] });
      toast.error(error.message);
    } else {
      toast.success("Alert removed");
    }
  }

  return (
    <div className="min-h-[100dvh] bg-background pb-24">
      <main className="mx-auto max-w-2xl px-4 pt-16">
        <div className="py-2">
          <Link to="/browse" className="inline-flex items-center gap-1 text-sm font-semibold text-muted-foreground hover:text-foreground">
            <ChevronLeft className="h-4 w-4" /> Browse
          </Link>
        </div>

        <header className="mb-5">
          <h1 className="text-2xl font-extrabold tracking-tight">Your search alerts</h1>
          <p className="text-sm text-muted-foreground">
            We'll email you when new listings match these searches
          </p>
        </header>

        {loading ? (
          <div className="h-24 animate-pulse rounded-2xl bg-surface" />
        ) : !user ? (
          <div className="rounded-2xl bg-surface p-10 text-center shadow-card-md">
            <div className="mx-auto grid h-14 w-14 place-items-center rounded-full bg-primary-light">
              <Bell className="h-7 w-7 text-primary" />
            </div>
            <h3 className="mt-4 text-lg font-bold">Sign in to manage your alerts</h3>
            <p className="mt-1 text-sm text-muted-foreground">
              Alerts are tied to your email — sign in with the address you used to save them.
            </p>
            <button
              type="button"
              onClick={() => openSignIn("/saved-alerts")}
              className="mt-5 rounded-full bg-primary px-4 py-2 text-sm font-bold text-primary-foreground hover:bg-primary-dark"
            >
              Sign in
            </button>
          </div>
        ) : isLoading ? (
          <div className="space-y-3">
            {Array.from({ length: 3 }).map((_, i) => (
              <div key={i} className="h-24 animate-pulse rounded-2xl bg-surface" />
            ))}
          </div>
        ) : alerts.length === 0 ? (
          <div className="rounded-2xl bg-surface p-10 text-center shadow-card-md">
            <div className="mx-auto grid h-14 w-14 place-items-center rounded-full bg-primary-light">
              <Bell className="h-7 w-7 text-primary" />
            </div>
            <h3 className="mt-4 text-lg font-bold">No saved alerts yet</h3>
            <Link
              to="/browse"
              className="mt-5 inline-flex items-center gap-2 rounded-full bg-primary px-4 py-2 text-sm font-bold text-primary-foreground hover:bg-primary-dark"
            >
              Browse listings →
            </Link>
          </div>
        ) : (
          <ul className="space-y-3">
            {alerts.map((a) => {
              const f = (a.filters ?? {}) as Record<string, unknown>;
              const beds = a.min_beds ?? (typeof f.min_beds === "number" ? f.min_beds : null);
              const max = a.max_price ?? (typeof f.max_price === "number" ? f.max_price : null);
              const min = typeof f.min_price === "number" ? (f.min_price as number) : null;
              const kw = a.keyword ?? (typeof f.q === "string" ? (f.q as string) : null);
              const campus = campusName(a.campus_id);
              return (
                <li key={a.id} className="rounded-2xl bg-surface p-4 shadow-card-md">
                  <div className="flex items-start justify-between gap-3">
                    <div className="min-w-0">
                      <h3 className="truncate text-base font-extrabold">{campus ?? a.name}</h3>
                      <div className="mt-1.5 flex flex-wrap gap-1.5 text-[11px]">
                        {beds != null && <Chip>{beds === 0 ? "Studio" : `${beds}+ beds`}</Chip>}
                        {(min != null || max != null) && (
                          <Chip>
                            {min != null && max != null
                              ? `$${min}–$${max}`
                              : max != null
                                ? `Under $${max}`
                                : `$${min}+`}
                          </Chip>
                        )}
                        {kw && <Chip>"{kw}"</Chip>}
                        {beds == null && min == null && max == null && !kw && <Chip>All listings</Chip>}
                      </div>
                      <p className="mt-2 text-[11px] text-muted-foreground">
                        Saved {new Date(a.created_at).toLocaleDateString("en-US", { month: "short", day: "numeric", year: "numeric" })}
                      </p>
                    </div>
                    <button
                      onClick={() => remove(a.id)}
                      className="inline-flex shrink-0 items-center gap-1 rounded-full border border-red-300 px-3 py-1.5 text-xs font-bold text-red-600 hover:bg-red-50 dark:hover:bg-red-950/30"
                    >
                      <Trash2 className="h-3.5 w-3.5" /> Delete
                    </button>
                  </div>
                </li>
              );
            })}
          </ul>
        )}
      </main>
    </div>
  );
}

function Chip({ children }: { children: React.ReactNode }) {
  return (
    <span className="rounded-full bg-background px-2 py-0.5 font-semibold text-foreground">{children}</span>
  );
}
