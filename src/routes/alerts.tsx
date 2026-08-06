import { createFileRoute, useNavigate } from "@tanstack/react-router";
import { useQuery, useQueryClient } from "@tanstack/react-query";
import { useSession } from "@/lib/leaseup/use-session";
import { supabase } from "@/integrations/supabase/client";
import type { SavedSearch } from "@/lib/leaseup/types";
import { MessagesSheet } from "@/components/leaseup/MessagesSheet";
import { PostListingDialog } from "@/components/leaseup/PostListingDialog";
import { useState } from "react";
import { Bell, BellOff, Trash2, Search, ChevronLeft } from "lucide-react";
import { toast } from "sonner";
import { Link } from "@tanstack/react-router";

export const Route = createFileRoute("/alerts")({
  head: () => ({
    meta: [
      { title: "Search alerts — LeaseUp" },
      { name: "description", content: "Get notified the moment a new sublease matches your saved filters." },
    ],
  }),
  component: AlertsPage,
});

function AlertsPage() {
  const { user, loading } = useSession();
  const navigate = useNavigate();
  const qc = useQueryClient();
  const [posting, setPosting] = useState(false);
  const [messagesOpen, setMessagesOpen] = useState(false);

  const { data: alerts = [], isLoading } = useQuery({
    queryKey: ["saved-searches", user?.id],
    queryFn: async () => {
      const { data, error } = await supabase
        .from("saved_searches")
        .select("*")
        .order("created_at", { ascending: false });
      if (error) throw error;
      return (data ?? []) as SavedSearch[];
    },
    enabled: !!user,
  });

  if (loading) return <div className="min-h-screen bg-background" />;
  if (!user) { navigate({ to: "/auth", search: { mode: "in" } }); return null; }

  async function toggle(a: SavedSearch) {
    qc.setQueryData<SavedSearch[]>(["saved-searches", user!.id], (prev) =>
      (prev ?? []).map((s) => (s.id === a.id ? { ...s, notify: !a.notify } : s)),
    );
    const { error } = await supabase.from("saved_searches").update({ notify: !a.notify }).eq("id", a.id);
    if (error) { qc.invalidateQueries({ queryKey: ["saved-searches", user!.id] }); toast.error(error.message); }
  }

  async function remove(a: SavedSearch) {
    qc.setQueryData<SavedSearch[]>(["saved-searches", user!.id], (prev) =>
      (prev ?? []).filter((s) => s.id !== a.id),
    );
    const { error } = await supabase.from("saved_searches").delete().eq("id", a.id);
    if (error) { qc.invalidateQueries({ queryKey: ["saved-searches", user!.id] }); toast.error(error.message); }
    else toast.success("Alert deleted");
  }

  return (
    <div className="min-h-[100dvh] bg-background pb-24">

      <main className="mx-auto max-w-2xl px-4 pt-16">
        <div className="flex items-center gap-2 py-2">
          <Link to="/profile" className="inline-flex items-center gap-1 text-sm font-semibold text-muted-foreground hover:text-foreground">
            <ChevronLeft className="h-4 w-4" /> Profile
          </Link>
        </div>
        <header className="mb-4">
          <h1 className="text-2xl font-extrabold tracking-tight">Search alerts</h1>
          <p className="text-sm text-muted-foreground">
            We'll ping you the second a new listing matches.
          </p>
        </header>

        {isLoading ? (
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
            <h3 className="mt-4 text-lg font-bold">No alerts yet</h3>
            <p className="mt-1 text-sm text-muted-foreground">
              Set up filters in Browse, then tap <strong>Save this search</strong>.
            </p>
            <Link
              to="/browse"
              className="mt-5 inline-flex items-center gap-2 rounded-full bg-primary px-4 py-2 text-sm font-bold text-primary-foreground hover:bg-primary-dark"
            >
              <Search className="h-4 w-4" /> Browse listings
            </Link>
          </div>
        ) : (
          <ul className="space-y-3">
            {alerts.map((a) => (
              <li key={a.id} className="rounded-2xl bg-surface p-4 shadow-card-md">
                <div className="flex items-start justify-between gap-3">
                  <div className="min-w-0">
                    <div className="flex items-center gap-2">
                      <h3 className="truncate text-base font-extrabold">{a.name}</h3>
                      {a.notify ? (
                        <span className="rounded-full bg-green-100 px-2 py-0.5 text-[10px] font-bold text-green-700">ON</span>
                      ) : (
                        <span className="rounded-full bg-muted px-2 py-0.5 text-[10px] font-bold text-muted-foreground">PAUSED</span>
                      )}
                    </div>
                    <div className="mt-1.5 flex flex-wrap gap-1.5 text-[11px]">
                      {a.max_price != null && <Tag>Max ${a.max_price}</Tag>}
                      {a.min_beds != null && <Tag>{a.min_beds}+ beds</Tag>}
                      {a.area && <Tag>{a.area}</Tag>}
                      {a.furnished_only && <Tag>Furnished</Tag>}
                      {a.pet_friendly_only && <Tag>Pets ok</Tag>}
                      {a.keyword && <Tag>"{a.keyword}"</Tag>}
                    </div>
                    <MatchCount searchId={a.id} />
                    {a.last_notified_at && (
                      <p className="mt-1 text-[11px] text-muted-foreground">
                        Last checked: {new Date(a.last_notified_at).toLocaleString()}
                      </p>
                    )}
                  </div>
                  <div className="flex shrink-0 gap-1">
                    <button
                      onClick={() => toggle(a)}
                      title={a.notify ? "Pause alerts" : "Resume alerts"}
                      className="grid h-9 w-9 place-items-center rounded-full bg-background hover:bg-muted"
                    >
                      {a.notify ? <Bell className="h-4 w-4 text-primary" /> : <BellOff className="h-4 w-4 text-muted-foreground" />}
                    </button>
                    <button
                      onClick={() => remove(a)}
                      title="Delete alert"
                      className="grid h-9 w-9 place-items-center rounded-full bg-background text-red-500 hover:bg-red-50"
                    >
                      <Trash2 className="h-4 w-4" />
                    </button>
                  </div>
                </div>
              </li>
            ))}
          </ul>
        )}
      </main>

      <PostListingDialog open={posting} onOpenChange={setPosting} />
      <MessagesSheet open={messagesOpen} onOpenChange={setMessagesOpen} initialConversationId={null} />
    </div>
  );
}

function Tag({ children }: { children: React.ReactNode }) {
  return (
    <span className="rounded-full bg-background px-2 py-0.5 font-semibold text-foreground">
      {children}
    </span>
  );
}

function MatchCount({ searchId }: { searchId: string }) {
  const { data } = useQuery({
    queryKey: ["saved-search-matches", searchId],
    queryFn: async () => {
      const { data, error } = await supabase.rpc("count_saved_search_matches" as any, { _search_id: searchId });
      if (error) return 0;
      return typeof data === "number" ? data : 0;
    },
  });
  if (data == null) return null;
  return (
    <p className="mt-2 text-[11px] font-semibold text-primary">
      This search matches {data} active listing{data === 1 ? "" : "s"}
    </p>
  );
}
