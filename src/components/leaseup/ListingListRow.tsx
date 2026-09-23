/**
 * Q160 — compact horizontal row used by the /browse "List" view.
 */
import { Link } from "@tanstack/react-router";
import { Heart } from "lucide-react";
import { ListingPhoto } from "./ListingPhoto";
import { cn } from "@/lib/utils";
import type { Listing } from "@/lib/leaseup/types";
import { formatDateRange } from "@/lib/leaseup/dates";



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
  const dates = formatDateRange(listing?.available_from, listing?.available_to);

  /** Plain left-click keeps the slide-out; modified clicks open the real URL. */
  function handleOpenLink(e: React.MouseEvent) {
    e.stopPropagation();
    if (e.metaKey || e.ctrlKey || e.shiftKey || e.altKey || e.button !== 0) return;
    e.preventDefault();
    onOpen?.();
  }

  return (
    <div
      role="button"
      tabIndex={0}
      onClick={() => onOpen?.()}
      onKeyDown={(e) => { if (e.key === "Enter") onOpen?.(); }}
      className="relative mb-2 flex min-h-24 cursor-pointer overflow-hidden rounded-xl border border-border bg-surface shadow-sm transition hover:shadow-md sm:min-h-28"
    >
      {/* Q482 — shared honest placeholder, also used when a photo fails to load. */}
      <ListingPhoto
        src={photo}
        alt={listing?.title ?? "Listing photo"}
        size="sm"
        loading="lazy"
        className="h-full w-36 shrink-0 object-cover"
      />


      <div className="flex min-w-0 flex-1 flex-col justify-center gap-0.5 px-3 py-2 pr-10">
        <Link
          to="/listing/$id"
          params={{ id: listing.id }}
          onClick={handleOpenLink}
          className="block min-w-0"
        >
          <p className="truncate text-sm font-semibold text-foreground">{listing?.title ?? "Sublease"}</p>
        </Link>
        <p className="text-sm font-bold text-primary">
          ${listing?.price ?? 0}
          <span className="text-xs font-medium text-muted-foreground">/mo</span>
        </p>
        <p className="truncate text-xs text-muted-foreground">
          {[campusName, bedLabel, listing?.area].filter(Boolean).join(" · ")}
        </p>
        {dates && (
          <p className="truncate text-xs text-muted-foreground/70">{dates}</p>
        )}
        {/* Q181 — primary CTA, identical to the grid + map cards */}
        <Link
          to="/listing/$id"
          params={{ id: listing.id }}
          onClick={handleOpenLink}
          className="mt-2 block w-full rounded-full bg-[#4F46E5] px-4 py-2 text-center text-sm font-semibold text-white shadow-sm transition-all duration-150 hover:-translate-y-0.5 hover:bg-[#4338CA] hover:shadow-md sm:inline-block sm:w-auto sm:self-start"
        >
          View listing →
        </Link>
      </div>

      <button
        type="button"
        aria-label={saved ? "Unsave listing" : "Save listing"}
        onClick={(e) => { e.stopPropagation(); onSave?.(); }}
        className="absolute right-2 top-2 rounded-full border border-border bg-surface/90 p-1.5 transition hover:scale-105"
      >
        <Heart className={cn("h-4 w-4", saved ? "fill-red-500 text-red-500" : "text-muted-foreground")} />
      </button>
    </div>
  );
}
