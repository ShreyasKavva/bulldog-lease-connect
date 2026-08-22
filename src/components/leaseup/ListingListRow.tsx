/**
 * Q160 — compact horizontal row used by the /browse "List" view.
 */
import { Heart } from "lucide-react";
import { cn } from "@/lib/utils";
import type { Listing } from "@/lib/leaseup/types";

function fmtDate(d?: string | null) {
  if (!d) return null;
  const dt = new Date(d);
  if (Number.isNaN(dt.getTime())) return null;
  return dt.toLocaleDateString(undefined, { month: "short", day: "numeric" });
}

export function ListingListRow({
  listing,
  campusName,
  saved,
  onSave,
  onOpen,
}: {
  listing: Listing;
  campusName?: string | null;
  saved?: boolean;
  onSave?: () => void;
  onOpen?: () => void;
}) {
  const photo = listing?.photo_urls?.[0] ?? null;
  const beds = listing?.beds ?? 0;
  const bedLabel = beds === 0 ? "Studio" : `${beds} bd`;
  const from = fmtDate(listing?.available_from);
  const to = fmtDate(listing?.available_to);

  return (
    <div
      role="button"
      tabIndex={0}
      onClick={() => onOpen?.()}
      onKeyDown={(e) => { if (e.key === "Enter") onOpen?.(); }}
      className="relative mb-2 flex min-h-24 cursor-pointer overflow-hidden rounded-xl border border-border bg-surface shadow-sm transition hover:shadow-md sm:min-h-28"
    >
      {photo ? (
        <img
          src={photo}
          alt={listing?.title ?? "Listing photo"}
          loading="lazy"
          className="h-full w-36 shrink-0 object-cover"
        />
      ) : (
        <div className="flex h-full w-36 shrink-0 items-center justify-center bg-muted text-2xl">🏠</div>
      )}

      <div className="flex min-w-0 flex-1 flex-col justify-center gap-0.5 px-3 py-2 pr-10">
        <p className="truncate text-sm font-semibold text-foreground">{listing?.title ?? "Sublease"}</p>
        <p className="text-sm font-bold text-primary">
          ${listing?.price ?? 0}
          <span className="text-xs font-medium text-muted-foreground">/mo</span>
        </p>
        <p className="truncate text-xs text-muted-foreground">
          {[campusName, bedLabel, listing?.area].filter(Boolean).join(" · ")}
        </p>
        {(from || to) && (
          <p className="truncate text-xs text-muted-foreground/70">
            {from ?? "Flexible"}{to ? ` – ${to}` : ""}
          </p>
        )}
      </div>

      <button
        type="button"
        aria-label={saved ? "Unsave listing" : "Save listing"}
        onClick={(e) => { e.stopPropagation(); onSave?.(); }}
        className="absolute right-2 top-2 rounded-full bg-surface/90 p-1.5 shadow-sm transition hover:scale-105"
      >
        <Heart className={cn("h-4 w-4", saved ? "fill-red-500 text-red-500" : "text-muted-foreground")} />
      </button>
    </div>
  );
}
