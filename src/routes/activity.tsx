import { createFileRoute, Link } from "@tanstack/react-router";
import { useActivity, activityTimeAgo, type ActivityItem } from "@/lib/leaseup/activity";
import { TopBar } from "@/components/leaseup/TopBar";
import { BottomNav } from "@/components/leaseup/BottomNav";
import { useEffect, useRef, useState } from "react";
import { cn } from "@/lib/utils";

export const Route = createFileRoute("/activity")({
  head: () => ({
    meta: [
      { title: "Activity — LeaseUp" },
      { name: "description", content: "Live activity from students posting, saving, and reacting to subleases." },
    ],
  }),
  component: ActivityPage,
});

function ActivityPage() {
  const { data: items = [], isLoading } = useActivity();
  const [visible, setVisible] = useState(50);
  const seenIds = useRef<Set<string>>(new Set());
  const [newIds, setNewIds] = useState<Set<string>>(new Set());

  useEffect(() => {
    const fresh = new Set<string>();
    for (const it of items) {
      if (!seenIds.current.has(it.id)) {
        if (seenIds.current.size > 0) fresh.add(it.id);
        seenIds.current.add(it.id);
      }
    }
    if (fresh.size > 0) {
      setNewIds(fresh);
      const t = setTimeout(() => setNewIds(new Set()), 800);
      return () => clearTimeout(t);
    }
  }, [items]);

  return (
    <div className="min-h-screen bg-background pb-24">
      <TopBar />
      <main className="mx-auto max-w-2xl px-4 py-5">
        <div className="mb-4 flex items-baseline justify-between">
          <h1 className="text-2xl font-extrabold">Activity</h1>
          <div className="text-xs text-muted-foreground">Live · anonymized</div>
        </div>

        {isLoading ? (
          <div className="space-y-2">
            {Array.from({ length: 6 }).map((_, i) => (
              <div key={i} className="h-16 animate-pulse rounded-xl border bg-surface" />
            ))}
          </div>
        ) : items.length === 0 ? (
          <EmptyState />
        ) : (
          <ul className="space-y-2">
            {items.slice(0, visible).map((it) => (
              <ActivityRow key={it.id} item={it} isNew={newIds.has(it.id)} />
            ))}
          </ul>
        )}

        {visible < items.length && (
          <div className="mt-4 flex justify-center">
            <button
              onClick={() => setVisible((v) => v + 50)}
              className="rounded-full border bg-surface px-4 py-2 text-sm font-semibold hover:bg-background"
            >
              Load more
            </button>
          </div>
        )}
      </main>
      <BottomNav />
    </div>
  );
}

function ActivityRow({ item, isNew }: { item: ActivityItem; isNew: boolean }) {
  const ctaLabel = item.kind === "price_drop" ? "See it" : "View";
  const hasCta = !!item.listing_id && (item.kind === "new_listing" || item.kind === "price_drop" || item.kind === "reaction");
  const tint = TINTS[item.kind];
  return (
    <li
      className={cn(
        "flex items-start gap-3 rounded-xl border bg-surface px-4 py-3 transition",
        isNew && "animate-[fade-in_0.4s_ease-out]",
      )}
      style={{ borderColor: "#E4E6EB" }}
    >
      <div
        className="grid h-10 w-10 flex-shrink-0 place-items-center rounded-full text-xl"
        style={{ background: tint }}
      >
        {item.emoji}
      </div>
      <div className="min-w-0 flex-1">
        <div className="text-sm leading-snug text-foreground">{item.text}</div>
        <div className="mt-0.5 text-[11px] text-muted-foreground">{activityTimeAgo(item.created_at)}</div>
      </div>
      {hasCta && (
        <Link
          to="/"
          search={{ listing: item.listing_id! } as any}
          className="self-center rounded-full bg-primary px-3 py-1.5 text-xs font-semibold text-primary-foreground hover:bg-primary-dark"
        >
          {ctaLabel} →
        </Link>
      )}
    </li>
  );
}

const TINTS: Record<string, string> = {
  new_listing:    "#EFF6FF",
  listing_saved:  "#FEE2E2",
  price_drop:     "#DCFCE7",
  listing_closed: "#FEF3C7",
  looking_for:    "#EDE9FE",
  reaction:       "#FFEDD5",
};

function EmptyState() {
  return (
    <div className="rounded-2xl border bg-surface p-8 text-center">
      <div className="text-5xl">🌟</div>
      <p className="mt-3 text-sm text-muted-foreground">
        Activity will show here as students post and save listings.
      </p>
      <Link
        to="/"
        className="mt-4 inline-flex items-center gap-2 rounded-full bg-primary px-4 py-2 text-sm font-bold text-primary-foreground hover:bg-primary-dark"
      >
        Be the first → Post a Listing
      </Link>
    </div>
  );
}
