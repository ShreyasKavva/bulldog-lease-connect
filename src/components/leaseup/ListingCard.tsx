/**
 * ListingCard — Airbnb-style listing tile used in grid views (browse,
 * saved, campus pages, homepage). Deliberately minimal: full-bleed photo,
 * clean typography, no badge clutter.
 *
 * The only trust signal on the card is a small green check next to the
 * lister's name when their email is verified.
 */
import type { Listing } from "@/lib/leaseup/types";
import { Heart, Check } from "lucide-react";
import { timeAgo } from "@/lib/leaseup/constants";
import { cn } from "@/lib/utils";
import { useState } from "react";
import { useReactionPicker } from "./useReactionPicker";

function fmtDate(iso: string | null) {
  if (!iso) return null;
  const d = new Date(iso);
  if (Number.isNaN(d.getTime())) return null;
  return d.toLocaleDateString("en-US", { month: "short", day: "numeric" });
}

export function ListingCard({
  listing, saved, onSave, onOpen,
}: {
  listing: Listing;
  saved: boolean;
  onSave: () => void;
  onOpen: () => void;
  pinned?: boolean;
  onPin?: () => void;
  isHotDeal?: boolean;
}) {
  const photo = listing.photo_urls?.[0] ?? listing.photos?.[0];
  const [imgError, setImgError] = useState(false);
  const picker = useReactionPicker(listing.id);

  const from = fmtDate(listing.available_from);
  const to = fmtDate(listing.available_to);
  const dates = from ? (to ? `${from} – ${to}` : from) : null;

  const location = [listing.area, listing.profile ? null : null].filter(Boolean).join(" · ") || "Near campus";
  const views = listing.view_count ?? 0;

  function handleSave(e: React.MouseEvent) {
    e.stopPropagation();
    import("@/lib/haptics").then((m) => m.haptic(10));
    onSave();
  }

  function handlePhotoClick(e: React.MouseEvent<HTMLDivElement>) {
    const res = picker.handleClick(e);
    if (res.suppressed) { e.stopPropagation(); return; }
    onOpen();
  }

  return (
    <article className="group cursor-pointer overflow-hidden rounded-2xl bg-surface shadow-none transition-shadow duration-200 hover:shadow-md">
      <div
        ref={picker.containerRef}
        className="relative aspect-[4/3] overflow-hidden bg-muted"
        onClick={handlePhotoClick}
        {...picker.bind}
      >
        {photo && !imgError ? (
          <img
            src={photo}
            alt={listing.title}
            className="h-full w-full object-cover transition-transform duration-300 group-hover:scale-[1.03]"
            loading="lazy"
            onError={() => setImgError(true)}
          />
        ) : (
          <div className="flex h-full w-full items-center justify-center text-4xl">🏠</div>
        )}
        {picker.overlay}

        <button
          onClick={handleSave}
          aria-label={saved ? "Unsave" : "Save"}
          className="absolute right-3 top-3 grid h-8 w-8 place-items-center transition-transform hover:scale-110 active:scale-95 touch-manipulation"
        >
          <Heart
            className={cn(
              "h-6 w-6 drop-shadow-[0_1px_2px_rgba(0,0,0,0.45)]",
              saved ? "fill-destructive text-destructive" : "fill-black/20 text-white",
            )}
          />
        </button>
      </div>

      <div className="px-1 py-3" onClick={onOpen}>
        <h3 className="truncate text-sm font-medium text-foreground">{listing.title}</h3>
        {views > 0 && (
          <p className="mt-0.5 text-xs text-muted-foreground/80">
            {views} view{views === 1 ? "" : "s"} · Posted {timeAgo(listing.created_at)}
          </p>
        )}
        <p className="mt-0.5 truncate text-sm text-muted-foreground">{location}</p>
        {dates && <p className="mt-0.5 text-sm text-muted-foreground/70">{dates}</p>}
        <p className="mt-1 text-sm text-foreground">
          <span className="font-semibold">${listing.price.toLocaleString()}</span>
          <span className="font-normal">
            /mo · {listing.beds === 0 ? "Studio" : `${listing.beds} bd`} · {Number(listing.baths)} ba
          </span>
        </p>
        <p className="mt-1 flex items-center gap-1 text-xs text-muted-foreground">
          <span className="truncate">
            {listing.profile?.name || listing.profile?.email?.split("@")[0] || "Student"}
          </span>
          {listing.profile?.verified_email && (
            <Check className="h-3 w-3 shrink-0 text-success" aria-label="Verified" />
          )}
        </p>
      </div>
    </article>
  );
}
