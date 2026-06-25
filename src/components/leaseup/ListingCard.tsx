import type { Listing } from "@/lib/leaseup/types";
import { Heart, BadgeCheck, Bed, MapPin, Eye } from "lucide-react";
import { isNew, timeAgo } from "@/lib/leaseup/constants";
import { SafeScoreBadge } from "./SafeScoreBadge";
import { cn } from "@/lib/utils";

export function ListingCard({
  listing, saved, onSave, onOpen,
}: {
  listing: Listing;
  saved: boolean;
  onSave: () => void;
  onOpen: () => void;
}) {
  const photo = listing.photo_urls?.[0];
  return (
    <article
      onClick={onOpen}
      className="group cursor-pointer overflow-hidden rounded-xl bg-surface shadow-card transition hover:shadow-card-md"
    >
      <div className="relative aspect-[4/3] bg-muted">
        {photo ? (
          <img src={photo} alt={listing.title} className="h-full w-full object-cover" loading="lazy" />
        ) : (
          <div className="flex h-full w-full items-center justify-center text-4xl">🏠</div>
        )}
        <button
          onClick={(e) => { e.stopPropagation(); onSave(); }}
          aria-label="Save"
          className="absolute right-3 top-3 grid h-9 w-9 place-items-center rounded-full bg-white/95 shadow hover:scale-105 transition"
        >
          <Heart className={cn("h-4 w-4", saved ? "fill-destructive text-destructive" : "text-foreground")} />
        </button>
        <div className="absolute left-3 top-3 flex gap-1.5">
          {isNew(listing.created_at) && (
            <span className="rounded-full bg-primary px-2 py-0.5 text-[10px] font-bold uppercase text-white">New</span>
          )}
          <span className={cn(
            "rounded-full px-2 py-0.5 text-[10px] font-bold uppercase text-white",
            listing.type === "transfer" ? "bg-success" : "bg-foreground/80",
          )}>
            {listing.type === "transfer" ? "Transfer" : "Sublease"}
          </span>
        </div>
      </div>
      <div className="p-3">
        <div className="flex items-baseline justify-between gap-2">
          <div className="text-lg font-extrabold">${listing.price.toLocaleString()}<span className="text-xs font-medium text-muted-foreground">/mo</span></div>
          <div className="flex items-center gap-1 text-xs text-muted-foreground">
            <Bed className="h-3 w-3" />{listing.beds} bd · {Number(listing.baths)} ba
          </div>
        </div>
        <h3 className="mt-1 line-clamp-1 text-sm font-bold">{listing.title}</h3>
        <div className="mt-1 flex items-center gap-1 text-xs text-muted-foreground">
          <MapPin className="h-3 w-3" />{listing.area ?? "Athens, GA"}
        </div>
        <div className="mt-2 flex flex-wrap gap-1">
          <SafeScoreBadge score={listing.safe_score} />
          {listing.furnished && <span className="rounded-full bg-primary-light px-2 py-0.5 text-[10px] font-semibold text-primary-dark">Furnished</span>}
          {listing.utilities_included && <span className="rounded-full bg-success-light px-2 py-0.5 text-[10px] font-semibold text-success">Utilities</span>}
          {listing.pet_friendly && <span className="rounded-full bg-accent px-2 py-0.5 text-[10px] font-semibold text-accent-foreground">Pets OK</span>}
        </div>
        <div className="mt-3 flex items-center gap-2 border-t pt-2">
          <div
            className="grid h-6 w-6 place-items-center rounded-full text-xs"
            style={{ background: listing.profile?.banner_color ?? "#2563EB" }}
          >{listing.profile?.avatar_emoji ?? "🙂"}</div>
          <span className="text-xs font-semibold">{listing.profile?.name ?? "Student"}</span>
          {listing.profile?.verified_email && <BadgeCheck className="h-3.5 w-3.5 text-success" />}
          <span className="ml-auto text-[10px] text-muted-foreground">{timeAgo(listing.created_at)}</span>
        </div>
      </div>
    </article>
  );
}
