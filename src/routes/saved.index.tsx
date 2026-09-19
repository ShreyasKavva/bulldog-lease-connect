/**
 * /saved — every listing you've hearted, newest first.
 *
 * Hearts across the app save straight here; there are no collections.
 */
import { createFileRoute, Link, useNavigate } from "@tanstack/react-router";
import { useEffect, useMemo, useState } from "react";
import { useQuery, useQueryClient } from "@tanstack/react-query";
import { Heart } from "lucide-react";
import { toast } from "sonner";
import { useSession } from "@/lib/leaseup/use-session";
import { openSignIn } from "@/components/leaseup/SignInModal";
import { ListingCard } from "@/components/leaseup/ListingCard";
import { fetchSavedListings, toggleSaved } from "@/lib/leaseup/queries";
import type { Listing } from "@/lib/leaseup/types";

/** Q161 — saved-listing sort options, persisted to localStorage. */
const SAVED_SORT_KEY = "leasup_saved_sort";
const SAVED_SORTS = ["recent", "price_asc", "price_desc", "ending_soon"] as const;
type SavedSort = (typeof SAVED_SORTS)[number];
const SAVED_SORT_LABELS: Record<SavedSort, string> = {
  recent: "Recently saved",
  price_asc: "Price ↑",
  price_desc: "Price ↓",
  ending_soon: "Ending soonest",
};

export const Route = createFileRoute("/saved/")({
  head: () => ({
    meta: [
      { title: "Saved subleases — LeaseUp" },
      { name: "description", content: "Subleases you saved on LeaseUp." },
      { property: "og:title", content: "Saved subleases — LeaseUp" },
      { property: "og:description", content: "Subleases you saved on LeaseUp." },
    ],
  }),
  component: SavedPage,
});

function SavedPage() {
  const { user } = useSession();
  const qc = useQueryClient();
  const navigate = useNavigate();

  const { data: saved = [], isLoading } = useQuery({
    queryKey: ["saved-listings", user?.id],
    queryFn: () => fetchSavedListings(user!.id),
    enabled: !!user?.id,
  });

  const [sortBy, setSortBy] = useState<SavedSort>("recent");
  useEffect(() => {
    if (typeof window === "undefined") return;
    try {
      const stored = window.localStorage.getItem(SAVED_SORT_KEY);
      if (stored && (SAVED_SORTS as readonly string[]).includes(stored)) setSortBy(stored as SavedSort);
    } catch { /* ignore */ }
  }, []);
  function changeSort(next: SavedSort) {
    setSortBy(next);
    try { window.localStorage.setItem(SAVED_SORT_KEY, next); } catch { /* ignore */ }
  }

  const listings: Listing[] = useMemo(() => {
    const arr = [...saved];
    if (sortBy === "price_asc") return arr.sort((a, b) => (a?.price ?? 0) - (b?.price ?? 0));
    if (sortBy === "price_desc") return arr.sort((a, b) => (b?.price ?? 0) - (a?.price ?? 0));
    if (sortBy === "ending_soon")
      return arr.sort((a, b) => {
        const ta = a?.available_to ? new Date(a.available_to).getTime() : Infinity;
        const tb = b?.available_to ? new Date(b.available_to).getTime() : Infinity;
        return ta - tb;
      });
    return arr;
  }, [saved, sortBy]);

  function refresh() {
    if (!user) return;
    qc.invalidateQueries({ queryKey: ["saved", user.id] });
    qc.invalidateQueries({ queryKey: ["saved-listings", user.id] });
  }

  async function unsave(l: Listing) {
    if (!user) return null;
    try {
      await toggleSaved(user.id, l.id, true);
      refresh();
      toast.success("Removed from Saved", {
        duration: 5000,
        action: {
          label: "Undo",
          onClick: async () => {
            await toggleSaved(user.id, l.id, false);
            refresh();
          },
        },
      });
      return "unsaved" as const;
    } catch {
      toast.error("Couldn't remove that listing");
      return null;
    }
  }

  if (!user) {
    return (
      <div className="min-h-screen bg-background">
        <div className="mx-auto max-w-md p-12 text-center">
          <Heart className="mx-auto h-12 w-12 text-muted-foreground" />
          <h2 className="mt-4 text-xl font-bold">Sign in to see saved subleases</h2>
          <button
            type="button"
            onClick={() => openSignIn("/saved")}
            className="mt-4 inline-block rounded-full bg-foreground px-5 py-2.5 text-sm font-semibold text-background"
          >
            Sign in
          </button>
        </div>
      </div>
    );
  }

  return (
    <div className="min-h-screen bg-background">
      <main className="mx-auto max-w-7xl px-4 py-8 md:px-8">
        <h1 className="text-2xl font-bold">Saved subleases</h1>
        {listings.length > 0 && (
          <p className="mt-1 text-sm text-muted-foreground">
            {listings.length} sublease{listings.length === 1 ? "" : "s"}
          </p>
        )}

        {isLoading ? (
          <div className="mt-8 grid grid-cols-1 gap-6 sm:grid-cols-2 lg:grid-cols-3 xl:grid-cols-4">
            {[0, 1, 2, 3].map((i) => (
              <div key={i} className="animate-pulse">
                <div className="aspect-[4/3] rounded-2xl bg-muted" />
                <div className="mt-3 h-4 w-2/3 rounded bg-muted" />
              </div>
            ))}
          </div>
        ) : listings.length === 0 ? (
          <div className="mx-auto max-w-md py-16 text-center">
            <Heart className="mx-auto h-12 w-12 text-gray-300" strokeWidth={1.5} />
            <h2 className="mt-3 text-lg font-semibold text-gray-900 dark:text-foreground">Nothing saved yet</h2>
            <p className="mx-auto mt-1 max-w-xs text-sm text-gray-500">
              Tap the ♡ on any listing to save it for later.
            </p>
            <Link
              to="/browse"
              className="mt-4 inline-block rounded-full bg-gray-900 px-5 py-2.5 text-sm font-medium text-white dark:bg-white dark:text-gray-900"
            >
              Browse subleases →
            </Link>
          </div>
        ) : (
          <>
            <div className="mt-6 flex items-center justify-end">
              <label className="flex items-center gap-2 text-sm text-muted-foreground">
                Sort:
                <select
                  value={sortBy}
                  onChange={(e) => changeSort(e.target.value as SavedSort)}
                  className="rounded-lg border border-gray-200 bg-background px-2 py-1 text-sm text-foreground dark:border-border"
                >
                  {SAVED_SORTS.map((k) => (
                    <option key={k} value={k}>{SAVED_SORT_LABELS[k]}</option>
                  ))}
                </select>
              </label>
            </div>
            <div className="mt-4 grid grid-cols-1 gap-6 sm:grid-cols-2 lg:grid-cols-3 xl:grid-cols-4">
              {listings.map((l) => (
                <ListingCard
                  key={l.id}
                  listing={l}
                  saved
                  onSave={() => unsave(l)}
                  onHeart={() => unsave(l)}
                  onOpen={() => navigate({ to: "/listing/$id", params: { id: l.id } })}
                />
              ))}
            </div>
          </>
        )}
      </main>
    </div>
  );
}
