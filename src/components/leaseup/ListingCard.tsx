import { Link } from "@tanstack/react-router";
/**
 * ListingCard — Airbnb-style listing tile used in grid views (browse,
 * saved, campus pages, homepage). Deliberately minimal: full-bleed photo,
 * clean typography, no badge clutter.
 *
 * The only trust signal on the card is a small green check next to the
 * lister's name when their email is verified.
 */
import type { Listing } from "@/lib/leaseup/types";
import { Heart, Check, ChevronLeft, ChevronRight, Home } from "lucide-react";
import { postedAgo } from "@/lib/leaseup/constants";
import { CardPriceBadge } from "./PriceBadge";
import { cn } from "@/lib/utils";
import { useRef, useState } from "react";
import { useReactionPicker } from "./useReactionPicker";
import { useSession } from "@/lib/leaseup/use-session";
import { openSignIn } from "./SignInModal";
import { openSaveToCollection } from "./SaveToCollectionModal";
import { useListingRating } from "@/lib/leaseup/ratings";

function fmtDate(iso: string | null) {
  if (!iso) return null;
  const d = new Date(iso);
  if (Number.isNaN(d.getTime())) return null;
  return d.toLocaleDateString("en-US", { month: "short", day: "numeric" });
}

/** Cross-year ranges append the end year so "Aug 31 – Aug 30" reads correctly. */
function fmtDateRange(fromIso: string | null, toIso: string | null) {
  const from = fmtDate(fromIso);
  if (!from) return null;
  const to = fmtDate(toIso);
  if (!to) return from;
  const startYear = new Date(fromIso as string).getFullYear();
  const endYear = new Date(toIso as string).getFullYear();
  return startYear === endYear ? `${from} – ${to}` : `${from} – ${to}, ${endYear}`;
}

/**
 * Q143 — urgency badge: only when move-in is between today and 45 days out.
 * Anything in the past or further away shows nothing.
 */
function availableBadge(iso: string | null | undefined) {
  if (!iso) return null;
  const d = new Date(iso);
  if (Number.isNaN(d.getTime())) return null;
  const today = new Date();
  today.setHours(0, 0, 0, 0);
  const days = (d.getTime() - today.getTime()) / 86_400_000;
  if (days < 0 || days > 45) return null;
  return `Available ${d.toLocaleDateString("en-US", { month: "short", day: "numeric" })}`;
}


/** Airbnb-style dot strip: max 5 dots, active one kept centered when possible. */
function PhotoDots({ count, index }: { count: number; index: number }) {
  const max = 5;
  const visible = Math.min(count, max);
  let start = 0;
  if (count > max) {
    start = Math.min(Math.max(index - 2, 0), count - max);
  }
  return (
    <div className="pointer-events-none absolute inset-x-0 bottom-2 flex items-center justify-center gap-1.5">
      {Array.from({ length: visible }).map((_, i) => {
        const idx = start + i;
        const active = idx === index;
        return (
          <span
            key={idx}
            className={cn(
              "rounded-full transition-all",
              active ? "h-1.5 w-1.5 bg-white" : "h-1 w-1 bg-white/40",
            )}
          />
        );
      })}
    </div>
  );
}

export function ListingCard({
  listing, saved, onSave, onOpen, onHeart,
}: {
  listing: Listing;
  saved: boolean;
  onSave: () => void;
  onOpen: () => void;
  /** Q91: overrides the default "Save to collection" modal (e.g. remove-from-collection). */
  onHeart?: () => void;
  pinned?: boolean;
  onPin?: () => void;
  isHotDeal?: boolean;
}) {
  const photos = (listing.photo_urls?.length ? listing.photo_urls : listing.photos) ?? [];
  const [idx, setIdx] = useState(0);
  const [imgError, setImgError] = useState(false);
  const picker = useReactionPicker(listing.id);
  const touchStart = useRef<{ x: number; y: number } | null>(null);
  const swiped = useRef(false);
  const { user } = useSession();
  const rating = useListingRating(listing.id);

  const photo = photos[idx] ?? photos[0];
  const multi = photos.length > 1;

  const dates = fmtDateRange(listing.available_from, listing.available_to);
  const availableLabel = availableBadge(listing.available_from);

  const location = [listing.area, listing.profile ? null : null].filter(Boolean).join(" · ") || "Near campus";
  const views = listing.view_count ?? 0;

  function handleSave(e: React.MouseEvent) {
    e.stopPropagation();
    import("@/lib/haptics").then((m) => m.haptic(10));
    if (onHeart) { onHeart(); return; }
    if (!user) {
      openSignIn(typeof window !== "undefined" ? window.location.pathname : undefined);
      return;
    }
    openSaveToCollection(listing.id);
  }


  function step(e: React.MouseEvent, dir: 1 | -1) {
    e.stopPropagation();
    e.preventDefault();
    setIdx((p) => Math.min(Math.max(p + dir, 0), photos.length - 1));
  }

  function handlePhotoClick(e: React.MouseEvent<HTMLDivElement>) {
    if (swiped.current) { swiped.current = false; e.stopPropagation(); return; }
    const res = picker.handleClick(e);
    if (res.suppressed) { e.stopPropagation(); return; }
    onOpen();
  }

  function onTouchStart(e: React.TouchEvent) {
    const t = e.touches[0];
    touchStart.current = { x: t.clientX, y: t.clientY };
    swiped.current = false;
  }
  function onTouchEnd(e: React.TouchEvent) {
    const s = touchStart.current;
    touchStart.current = null;
    if (!s || !multi) return;
    const t = e.changedTouches[0];
    const dx = t.clientX - s.x;
    const dy = t.clientY - s.y;
    if (Math.abs(dx) < 40 || Math.abs(dx) < Math.abs(dy)) return;
    swiped.current = true;
    setIdx((p) => {
      const next = dx < 0 ? p + 1 : p - 1;
      return Math.min(Math.max(next, 0), photos.length - 1);
    });
  }

  return (
    <article className="lu-card-hover group cursor-pointer overflow-hidden rounded-2xl bg-surface shadow-none transition-all duration-150 hover:-translate-y-0.5 hover:shadow-md">
      <div
        ref={picker.containerRef}
        className="relative aspect-[4/3] overflow-hidden bg-muted"
        onClick={handlePhotoClick}
        onMouseLeave={() => setIdx(0)}
        onTouchStart={onTouchStart}
        onTouchEnd={onTouchEnd}
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
          <div className="flex h-full w-full items-center justify-center bg-gradient-to-br from-gray-100 to-gray-200 dark:from-muted dark:to-background">
            <Home className="h-8 w-8 text-gray-400" />
          </div>
        )}

        {/* Preload only the adjacent photos */}
        {multi && !imgError && (
          <div className="hidden">
            {[idx - 1, idx + 1].map((i) =>
              photos[i] ? <img key={i} src={photos[i]} alt="" aria-hidden /> : null,
            )}
          </div>
        )}

        {picker.overlay}

        {multi && !imgError && (
          <>
            {idx > 0 && (
              <button
                type="button"
                onClick={(e) => step(e, -1)}
                aria-label="Previous photo"
                className="absolute left-2 top-1/2 hidden h-7 w-7 -translate-y-1/2 place-items-center rounded-full bg-white text-gray-900 opacity-0 shadow-md transition hover:scale-105 group-hover:opacity-100 md:grid"
              >
                <ChevronLeft className="h-4 w-4" />
              </button>
            )}
            {idx < photos.length - 1 && (
              <button
                type="button"
                onClick={(e) => step(e, 1)}
                aria-label="Next photo"
                className="absolute right-2 top-1/2 hidden h-7 w-7 -translate-y-1/2 place-items-center rounded-full bg-white text-gray-900 opacity-0 shadow-md transition hover:scale-105 group-hover:opacity-100 md:grid"
              >
                <ChevronRight className="h-4 w-4" />
              </button>
            )}
            <div className="opacity-100 transition-opacity md:opacity-0 md:group-hover:opacity-100">
              <PhotoDots count={photos.length} index={idx} />
            </div>
          </>
        )}

        {/* Q123/Q143 — price tier + urgency move-in badges share the bottom-left row */}
        <div className="pointer-events-none absolute bottom-2 left-2 flex items-center gap-1">
          <CardPriceBadge price={listing.price} campusId={listing.campus_id} className="static bottom-auto left-auto" />
          {availableLabel && (
            <span className="rounded-full bg-white/90 px-2 py-0.5 text-xs font-medium text-gray-800 shadow-sm">
              {availableLabel}
            </span>
          )}
        </div>

        <button
          onClick={handleSave}
          aria-label={saved ? "Unsave" : "Save"}
          className="absolute right-3 top-3 flex h-8 items-center gap-1 transition-transform hover:scale-110 active:scale-95 touch-manipulation"
        >
          <Heart
            className={cn(
              "h-6 w-6 drop-shadow-[0_1px_2px_rgba(0,0,0,0.45)]",
              saved
                ? "scale-110 fill-[#FF5A5F] text-[#FF5A5F] transition-transform"
                : "fill-black/20 text-white transition-transform",
            )}
          />
          {/* Q143 — save count, hidden at zero */}
          {savesCount > 0 && (
            <span className="text-xs font-medium text-white drop-shadow-[0_1px_2px_rgba(0,0,0,0.45)]">
              {savesCount}
            </span>
          )}
        </button>
      </div>



      <div className="px-1 py-3" onClick={onOpen}>
        <h3 className="truncate text-sm font-medium text-foreground">{listing.title}</h3>
        <p className="mt-0.5 text-xs text-muted-foreground/80">
          {views > 0 && <>{views} view{views === 1 ? "" : "s"} · </>}
          Posted {postedAgo(listing.created_at)}
        </p>
        <p className="mt-0.5 truncate text-sm text-muted-foreground">{location}</p>
        {dates && <p className="mt-0.5 text-sm text-muted-foreground/70">{dates}</p>}
        <p className="mt-1 text-sm text-foreground">
          <span className="font-semibold">${listing.price.toLocaleString()}</span>
          <span className="font-normal">
            /mo · {listing.beds === 0 ? "Studio" : `${listing.beds} bd`} · {Number(listing.baths)} ba
          </span>
          {/* Q111 — review stars, only when the listing actually has reviews */}
          {rating && rating.count > 0 && (
            <span className="ml-1.5 whitespace-nowrap text-xs text-gray-600 dark:text-muted-foreground">
              <span className="text-amber-400">★</span> {rating.avg.toFixed(1)}
            </span>
          )}
        </p>
        {/* Q108 — .edu verified host signal (nothing shown when unverified) */}
        {listing.profile?.verified_email && (
          <span className="mt-1 inline-flex items-center gap-0.5 rounded-full border border-green-200 bg-green-50 px-1.5 py-0.5 text-[10px] font-semibold text-green-700">
            <Check className="h-2.5 w-2.5" /> Verified
          </span>
        )}
        <p className="mt-1 flex items-center gap-1 text-xs text-muted-foreground">
          {listing.user_id ? (
            <Link
              to="/profile/$userId"
              params={{ userId: listing.user_id }}
              onClick={(e: React.MouseEvent) => e.stopPropagation()}
              className="truncate hover:underline"
            >
              {listing.profile?.name || "Student"}
            </Link>
          ) : (
            <span className="truncate">{listing.profile?.name || "Student"}</span>
          )}
        </p>


      </div>
    </article>
  );
}
