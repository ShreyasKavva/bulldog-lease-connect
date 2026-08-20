/**
 * /saved/$collection — listings inside one saved collection (Q91).
 * Rename / delete the collection from the header; hearts remove with undo.
 */
import { createFileRoute, Link, useNavigate } from "@tanstack/react-router";
import { useEffect, useMemo, useState } from "react";
import { useQuery, useQueryClient } from "@tanstack/react-query";
import { ArrowLeft, X } from "lucide-react";
import { toast } from "sonner";
import { useSession } from "@/lib/leaseup/use-session";
import { ListingCard } from "@/components/leaseup/ListingCard";
import { openSignIn } from "@/components/leaseup/SignInModal";
import {
  DEFAULT_COLLECTION,
  deleteCollection,
  fetchCollections,
  removeFromCollection,
  renameCollection,
  saveToCollection,
} from "@/lib/leaseup/collections";
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

export const Route = createFileRoute("/saved/$collection")({
  head: () => ({
    meta: [
      { title: "Saved collection — LeaseUp" },
      { name: "description", content: "Subleases you saved to this collection on LeaseUp." },
      { property: "og:title", content: "Saved collection — LeaseUp" },
      { property: "og:description", content: "Subleases you saved to this collection on LeaseUp." },
    ],
  }),
  component: CollectionPage,
});

function CollectionPage() {
  const { collection } = Route.useParams();
  const name = decodeURIComponent(collection);
  const { user } = useSession();
  const qc = useQueryClient();
  const navigate = useNavigate();
  const [editing, setEditing] = useState(false);
  const [draft, setDraft] = useState(name);

  const { data: collections = [], isLoading } = useQuery({
    queryKey: ["collections", user?.id],
    queryFn: () => fetchCollections(user!.id),
    enabled: !!user?.id,
  });

  const entry = collections.find((c) => c.name === name);
  const savedAt = entry?.savedAt ?? {};

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
    const arr = [...(entry?.listings ?? [])];
    if (sortBy === "price_asc") return arr.sort((a, b) => (a?.price ?? 0) - (b?.price ?? 0));
    if (sortBy === "price_desc") return arr.sort((a, b) => (b?.price ?? 0) - (a?.price ?? 0));
    if (sortBy === "ending_soon")
      return arr.sort((a, b) => {
        const ta = a?.available_to ? new Date(a.available_to).getTime() : Infinity;
        const tb = b?.available_to ? new Date(b.available_to).getTime() : Infinity;
        return ta - tb;
      });
    return arr.sort(
      (a, b) =>
        new Date(savedAt[b?.id] ?? b?.created_at ?? 0).getTime() -
        new Date(savedAt[a?.id] ?? a?.created_at ?? 0).getTime(),
    );
  }, [entry, sortBy, savedAt]);

  function refresh() {
    if (!user) return;
    qc.invalidateQueries({ queryKey: ["collections", user.id] });
    qc.invalidateQueries({ queryKey: ["saved", user.id] });
    qc.invalidateQueries({ queryKey: ["saved-listings", user.id] });
  }

  async function unsave(l: Listing) {
    if (!user) return;
    try {
      await removeFromCollection(user.id, l.id, name);
      refresh();
      toast.success(`Removed from ${name}`, {
        duration: 5000,
        action: {
          label: "Undo",
          onClick: async () => {
            await saveToCollection(user.id, l.id, name);
            refresh();
          },
        },
      });
    } catch {
      toast.error("Couldn't remove that listing");
    }
  }

  async function saveName() {
    const next = draft.trim();
    if (!user || !next || next === name) { setEditing(false); return; }
    try {
      await renameCollection(user.id, name, next);
      refresh();
      setEditing(false);
      navigate({ to: "/saved/$collection", params: { collection: next } });
    } catch {
      toast.error("Couldn't rename that collection");
    }
  }

  async function removeCollection() {
    if (!user) return;
    try {
      await deleteCollection(user.id, name);
      refresh();
      navigate({ to: "/saved" });
    } catch {
      toast.error("Couldn't delete that collection");
    }
  }

  if (!user) {
    return (
      <div className="min-h-screen bg-background">
        <div className="mx-auto max-w-md p-12 text-center">
          <h2 className="text-xl font-bold">Sign in to see saved subleases</h2>
          <button
            type="button"
            onClick={() => openSignIn("/saved")}
            className="mt-4 rounded-full bg-foreground px-5 py-2.5 text-sm font-semibold text-background"
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
        <div className="flex items-center gap-3">
          <Link to="/saved" aria-label="Back to collections" className="rounded-full p-2 hover:bg-muted">
            <ArrowLeft className="h-5 w-5" />
          </Link>
          <h1 className="flex-1 truncate text-2xl font-bold">{name}</h1>
          <button
            type="button"
            onClick={() => { setDraft(name); setEditing(true); }}
            className="text-sm text-muted-foreground hover:text-foreground"
          >
            Edit
          </button>
        </div>

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
          <div className="mx-auto max-w-md py-20 text-center">
            <div className="text-5xl">🏠</div>
            <h2 className="mt-4 text-lg font-bold">Nothing saved here yet</h2>
            <Link
              to="/browse"
              className="mt-5 inline-block rounded-full bg-foreground px-5 py-2.5 text-sm font-semibold text-background"
            >
              Browse subleases
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

      {editing && (
        <div className="fixed inset-0 z-[1000] grid place-items-center bg-black/40 p-4" onClick={() => setEditing(false)}>
          <div className="w-full max-w-sm rounded-2xl bg-surface p-6 shadow-xl" onClick={(e) => e.stopPropagation()}>
            <div className="flex items-start justify-between">
              <h2 className="text-lg font-semibold">Edit collection</h2>
              <button type="button" onClick={() => setEditing(false)} aria-label="Close" className="rounded-full p-1 hover:bg-muted">
                <X className="h-4 w-4" />
              </button>
            </div>
            <input
              value={draft}
              onChange={(e) => setDraft(e.target.value)}
              className="mt-4 w-full rounded-xl border border-border bg-background px-3 py-2 text-sm outline-none focus:border-foreground"
            />
            <button
              type="button"
              onClick={saveName}
              className="mt-4 w-full rounded-full bg-foreground py-3 text-sm font-semibold text-background"
            >
              Save
            </button>
            {name !== DEFAULT_COLLECTION && (
              <button
                type="button"
                onClick={removeCollection}
                className="mt-3 w-full py-2 text-sm font-medium text-red-600 hover:underline"
              >
                Delete collection
              </button>
            )}
          </div>
        </div>
      )}
    </div>
  );
}
