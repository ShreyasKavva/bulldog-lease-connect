/**
 * SaveToCollectionModal — Airbnb-style "Save to collection" sheet (Q91).
 *
 * Mounted once in __root.tsx. Any heart button anywhere calls
 * `openSaveToCollection(listingId)` and this listens for the event, so no
 * page has to thread props down to its cards.
 */
import { useEffect, useMemo, useState } from "react";
import { useQuery, useQueryClient } from "@tanstack/react-query";
import { Check, Plus, X } from "lucide-react";
import { toast } from "sonner";
import { cn } from "@/lib/utils";
import { useSession } from "@/lib/leaseup/use-session";
import {
  DEFAULT_COLLECTION,
  fetchCollections,
  removeFromCollection,
  saveToCollection,
} from "@/lib/leaseup/collections";

const EVENT = "lu:save-collection";

/** Fire from anywhere to open the "Save to collection" modal. */
export function openSaveToCollection(listingId: string) {
  window.dispatchEvent(new CustomEvent(EVENT, { detail: { listingId } }));
}

export function SaveToCollectionModal() {
  const { user } = useSession();
  const qc = useQueryClient();
  const [listingId, setListingId] = useState<string | null>(null);
  const [creating, setCreating] = useState(false);
  const [newName, setNewName] = useState("");

  useEffect(() => {
    function onOpen(e: Event) {
      const id = (e as CustomEvent<{ listingId: string }>).detail?.listingId;
      if (id) { setListingId(id); setCreating(false); setNewName(""); }
    }
    window.addEventListener(EVENT, onOpen);
    return () => window.removeEventListener(EVENT, onOpen);
  }, []);

  useEffect(() => {
    if (!listingId) return;
    function onKey(e: KeyboardEvent) { if (e.key === "Escape") setListingId(null); }
    document.addEventListener("keydown", onKey);
    return () => document.removeEventListener("keydown", onKey);
  }, [listingId]);

  const { data: collections = [] } = useQuery({
    queryKey: ["collections", user?.id],
    queryFn: () => fetchCollections(user!.id),
    enabled: !!user?.id && !!listingId,
  });

  const rows = useMemo(() => {
    if (collections.length) return collections;
    return [{ name: DEFAULT_COLLECTION, listings: [] }];
  }, [collections]);

  function refresh() {
    if (!user) return;
    qc.invalidateQueries({ queryKey: ["collections", user.id] });
    qc.invalidateQueries({ queryKey: ["saved", user.id] });
    qc.invalidateQueries({ queryKey: ["saved-listings", user.id] });
  }

  async function toggle(name: string, isIn: boolean) {
    if (!user || !listingId) return;
    try {
      if (isIn) {
        await removeFromCollection(user.id, listingId, name);
        toast.success(`Removed from ${name}`);
      } else {
        await saveToCollection(user.id, listingId, name);
        toast.success(`Saved to ${name}`);
      }
      refresh();
    } catch {
      toast.error("Couldn't update your saved listings");
    }
  }

  async function create() {
    const name = newName.trim();
    if (!user || !listingId || !name) return;
    try {
      await saveToCollection(user.id, listingId, name);
      setCreating(false);
      setNewName("");
      toast.success(`Saved to ${name}`);
      refresh();
    } catch {
      toast.error("Couldn't create that collection");
    }
  }

  if (!listingId || !user) return null;

  return (
    <div className="fixed inset-0 z-[1000] grid place-items-center bg-black/40 p-4" onClick={() => setListingId(null)}>
      <div
        className="w-full max-w-sm rounded-2xl bg-surface p-6 shadow-xl"
        onClick={(e) => e.stopPropagation()}
        role="dialog"
        aria-label="Save to collection"
      >
        <div className="flex items-start justify-between">
          <h2 className="text-lg font-semibold">Save to collection</h2>
          <button
            type="button"
            onClick={() => setListingId(null)}
            aria-label="Close"
            className="grid h-7 w-7 place-items-center rounded-full text-muted-foreground hover:bg-muted"
          >
            <X className="h-4 w-4" />
          </button>
        </div>

        <div className="mt-4 max-h-[45vh] space-y-1 overflow-y-auto">
          {rows.map((c) => {
            const isIn = c.listings.some((l) => l.id === listingId);
            const cover = c.listings.map((l) => (l.photo_urls?.length ? l.photo_urls : l.photos)?.[0]).find(Boolean);
            return (
              <button
                key={c.name}
                type="button"
                onClick={() => toggle(c.name, isIn)}
                className="flex w-full items-center gap-3 rounded-xl p-2 text-left transition hover:bg-muted/60"
              >
                {cover ? (
                  <img src={cover} alt="" className="h-12 w-12 shrink-0 rounded-lg object-cover" />
                ) : (
                  <div className="grid h-12 w-12 shrink-0 place-items-center rounded-lg bg-muted text-lg">🏠</div>
                )}
                <div className="min-w-0 flex-1">
                  <p className="truncate font-medium">{c.name}</p>
                  <p className="text-sm text-muted-foreground">
                    {c.listings.length} place{c.listings.length === 1 ? "" : "s"}
                  </p>
                </div>
                <span
                  className={cn(
                    "grid h-6 w-6 shrink-0 place-items-center rounded-md border",
                    isIn ? "border-foreground bg-foreground text-background" : "border-border",
                  )}
                >
                  {isIn && <Check className="h-4 w-4" />}
                </span>
              </button>
            );
          })}

          {creating ? (
            <div className="flex items-center gap-2 p-2">
              <input
                autoFocus
                value={newName}
                onChange={(e) => setNewName(e.target.value)}
                onKeyDown={(e) => { if (e.key === "Enter") create(); }}
                placeholder="Collection name"
                className="min-w-0 flex-1 rounded-xl border border-border bg-background px-3 py-2 text-sm outline-none focus:border-foreground"
              />
              <button
                type="button"
                onClick={create}
                className="shrink-0 rounded-full bg-foreground px-4 py-1.5 text-sm font-medium text-background"
              >
                Create
              </button>
            </div>
          ) : (
            <button
              type="button"
              onClick={() => setCreating(true)}
              className="flex w-full items-center gap-3 rounded-xl p-2 text-left text-muted-foreground transition hover:bg-muted/60"
            >
              <span className="grid h-12 w-12 shrink-0 place-items-center rounded-lg border border-dashed border-border">
                <Plus className="h-4 w-4" />
              </span>
              <span className="text-sm">New collection</span>
            </button>
          )}
        </div>

        <button
          type="button"
          onClick={() => setListingId(null)}
          className="mt-5 w-full rounded-full bg-foreground py-3 text-sm font-semibold text-background"
        >
          Done
        </button>
      </div>
    </div>
  );
}
