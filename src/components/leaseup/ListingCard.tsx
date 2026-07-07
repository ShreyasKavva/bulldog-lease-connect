/**
 * ListingCard — the canonical listing tile used in grid views (browse,
 * saved, my-listings, trending, etc.). ScrollView renders its own
 * full-screen variant; keep visual parity between them.
 *
 * Layered signals on the card (order matters for visual hierarchy):
 *   - FeaturedBadge       (paid boost active)
 *   - VerificationBadge   (unverified/basic/verified/premium tier)
 *   - SecureDepositBadge  (escrow enabled)
 *   - PriceLabelBadge     (Deal / Fair / Above Market vs. campus median)
 *   - SafeScoreBadge      (0–100 trust score)
 *   - "Just posted" + "Available soon" + "Hot deal" flame
 *
 * Reactions: long-press / double-tap opens useReactionPicker. Toggling a
 * reaction writes to listing_reactions and fires a notification to the
 * poster.
 */
import type { Listing } from "@/lib/leaseup/types";
import { Heart, BadgeCheck, Bed, MapPin, Eye, Scale, Clock, Flame } from "lucide-react";
import { PriceLabelBadge } from "./PriceLabelBadge";
import { VerificationBadge } from "./VerificationBadge";
import { isNew, timeAgo } from "@/lib/leaseup/constants";

import { SecureDepositBadge, FeaturedBadge } from "./SecureDepositBadge";
import { cn } from "@/lib/utils";
import { useState } from "react";
import { useReactionPicker } from "./useReactionPicker";

function isJustPosted(iso: string) {
  return Date.now() - new Date(iso).getTime() < 1000 * 60 * 60 * 2;
}
function isAvailableSoon(iso: string | null) {
  if (!iso) return false;
  const diff = new Date(iso).getTime() - Date.now();
  return diff >= 0 && diff < 1000 * 60 * 60 * 24 * 14;
}

export function ListingCard({
  listing, saved, onSave, onOpen, pinned, onPin, isHotDeal,
}: {
  listing: Listing;
  saved: boolean;
  onSave: () => void;
  onOpen: () => void;
  pinned?: boolean;
  onPin?: () => void;
  isHotDeal?: boolean;
}) {
  const photo = listing.photo_urls?.[0];
  const justPosted = isJustPosted(listing.created_at);
  const soon = isAvailableSoon(listing.available_from);
  const [pop, setPop] = useState(false);
  const [imgError, setImgError] = useState(false);
  const picker = useReactionPicker(listing.id);

  function handleSave(e: React.MouseEvent) {
    e.stopPropagation();
    setPop(true);
    setTimeout(() => setPop(false), 400);
    import("@/lib/haptics").then((m) => m.haptic(10));
    onSave();
  }

  function handlePhotoClick(e: React.MouseEvent<HTMLDivElement>) {
    const res = picker.handleClick(e);
    if (res.suppressed) { e.stopPropagation(); return; }
    onOpen();
  }

  return (
    <article
      className={cn(
        "lu-card-hover group cursor-pointer overflow-hidden rounded-xl bg-surface shadow-card",
        justPosted && "border-l-[3px] border-primary",
        listing.is_featured && "ring-2 ring-orange-400/70 ring-offset-1",
      )}
    >
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
            className="lu-card-img h-full w-full object-cover"
            loading="lazy"
            onError={() => setImgError(true)}
          />
        ) : (
          <div className="flex h-full w-full items-center justify-center text-4xl">🏠</div>
        )}
        {picker.overlay}

        {/* Top-right: save + compare */}
        <div className="absolute right-3 top-3 flex flex-col gap-1.5">
          <button
            onClick={handleSave}
            aria-label="Save"
            className="grid h-9 w-9 place-items-center rounded-full bg-white/95 shadow transition active:scale-90"
          >
            <Heart className={cn("h-4 w-4 transition", saved ? "fill-destructive text-destructive" : "text-foreground", pop && "lu-heart-pop")} />
          </button>
          {onPin && (
            <button
              onClick={(e) => { e.stopPropagation(); onPin(); }}
              aria-label={pinned ? "Remove from compare" : "Add to compare"}
              title={pinned ? "Pinned for compare" : "Compare"}
              className={cn(
                "grid h-9 w-9 place-items-center rounded-full shadow transition active:scale-90",
                pinned ? "bg-primary text-primary-foreground" : "bg-white/95 text-foreground",
              )}
            >
              <Scale className="h-4 w-4" />
            </button>
          )}
        </div>

        {/* Top-left tags */}
        <div className="absolute left-3 top-3 flex flex-wrap gap-1.5">
          {listing.is_featured && <FeaturedBadge />}
          {(() => {
            const b = (listing as any).bumped_at as string | null | undefined;
            if (!b) return null;
            const ms = new Date(b).getTime();
            if (Date.now() - ms > 1000 * 60 * 60 * 48) return null;
            return (
              <span className="rounded-full bg-black/60 px-2 py-0.5 text-[10px] font-semibold text-white shadow backdrop-blur">
                ↑ Refreshed
              </span>
            );
          })()}
          {justPosted || isNew(listing.created_at) ? (
            <span className="rounded-full bg-green-500 px-2 py-0.5 text-[10px] font-bold uppercase text-white shadow">✨ New</span>
          ) : (listing.view_count ?? 0) >= 20 ? (
            <span className="rounded-full bg-orange-500 px-2 py-0.5 text-[10px] font-bold uppercase text-white shadow">🔥 Popular</span>
          ) : null}
          <span className={cn(
            "rounded-full px-2 py-0.5 text-[10px] font-bold uppercase text-white shadow",
            listing.type === "transfer" ? "bg-success" : "bg-foreground/80",
          )}>
            {listing.type === "transfer" ? "Transfer" : "Sublease"}
          </span>
          {isHotDeal && (
            <span className="inline-flex items-center gap-1 rounded-full bg-orange-500 px-2 py-0.5 text-[10px] font-bold uppercase text-white shadow">
              <Flame className="h-3 w-3" /> Hot
            </span>
          )}
          {listing.deposit_escrow_enabled && <SecureDepositBadge compact />}
        </div>

        {/* Bottom-left badges over photo */}
        <div className="absolute bottom-2 left-2 flex flex-wrap items-center gap-1.5">
          {soon && (
            <span className="inline-flex items-center gap-1 rounded-full bg-orange-500/95 px-2 py-0.5 text-[10px] font-bold text-white shadow">
              <Clock className="h-3 w-3" /> Available soon
            </span>
          )}
          {(listing.view_count ?? 0) >= 10 && (
            <div className="inline-flex items-center gap-1 rounded-full bg-black/70 px-2 py-0.5 text-[10px] font-bold text-white backdrop-blur">
              <Eye className="h-3 w-3" />{listing.view_count} views
            </div>
          )}
        </div>

        {/* Poster avatar — overlaps photo bottom-right */}
        {listing.profile && (
          <div className="absolute -bottom-3 right-3 z-10">
            <div
              className="grid h-9 w-9 place-items-center rounded-full text-sm ring-2 ring-surface shadow"
              style={{ background: listing.profile.banner_color ?? "#2563EB" }}
              title={listing.profile.name}
            >
              {listing.profile.avatar_emoji ?? "🙂"}
            </div>
          </div>
        )}
      </div>

      <div className="p-3 pt-4" onClick={onOpen}>
        <div className="flex items-baseline justify-between gap-2">
          <div className="flex items-center gap-1.5">
            <div className="text-lg font-extrabold">${listing.price.toLocaleString()}<span className="text-xs font-medium text-muted-foreground">/mo</span></div>
            <PriceLabelBadge price={listing.price} campusId={(listing as any).campus_id} beds={listing.beds} size="xs" />
          </div>
          <div className="flex items-center gap-1 text-xs text-muted-foreground">
            <Bed className="h-3 w-3" />
            {listing.beds === 0 ? "Studio" : `${listing.beds} bd`} · {Number(listing.baths)} ba
          </div>
        </div>
        <h3 className="mt-1 line-clamp-1 text-sm font-bold">{listing.title}</h3>
        <div className="mt-1 flex items-center gap-1 text-xs text-muted-foreground">
          <MapPin className="h-3 w-3" />{listing.area ?? "Near campus"}
        </div>
        <div className="mt-2 flex flex-wrap gap-1">
          <VerificationBadge tier={(listing as any).verification_tier} pending={(listing as any).pending_review} />
          {listing.furnished && <span className="rounded-full bg-primary-light px-2 py-0.5 text-[10px] font-semibold text-primary-dark">Furnished</span>}
          {listing.utilities_included && <span className="rounded-full bg-success-light px-2 py-0.5 text-[10px] font-semibold text-success">Utilities</span>}
          {listing.pet_friendly && <span className="rounded-full bg-accent px-2 py-0.5 text-[10px] font-semibold text-accent-foreground">Pets OK</span>}
        </div>
        <div className="mt-3 flex items-center gap-2 border-t pt-2">
          <span className="text-xs font-semibold">{listing.profile?.name || listing.profile?.email?.split("@")[0] || "Student"}</span>
          {listing.profile?.verified_email && <BadgeCheck className="h-3.5 w-3.5 text-success" />}
          <span className="ml-auto text-[10px] text-muted-foreground">{timeAgo(listing.created_at)}</span>
        </div>
      </div>
    </article>
  );
}
