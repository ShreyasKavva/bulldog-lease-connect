/**
 * ScrollView — TikTok/Reels-style vertical snap feed. The DEFAULT home view
 * for authenticated users (see routes/index.tsx).
 *
 * Implementation notes:
 *   - Uses CSS scroll-snap on a full-height container; each listing is one
 *     snap point. Don't add intermediate non-snapping elements between cards
 *     or scroll behavior breaks on iOS.
 *   - View tracking: each card increments listings.view_count when it enters
 *     the viewport (debounced upstream to one count per session per listing).
 *   - Gestures: double-tap = save (heart), long-press = reaction picker,
 *     horizontal swipe on the image gallery = next photo.
 *   - Overlaid UI (action rail, poster avatar, gradient) sits on top of the
 *     image with absolute positioning. Keep z-index discipline.
 */
import { useEffect, useMemo, useRef, useState } from "react";
import type { Listing } from "@/lib/leaseup/types";
import { Heart, MessageCircle, ArrowRight, Flame, BedDouble, Bath, MapPin, Calendar, Scale } from "lucide-react";
import { cn } from "@/lib/utils";
import { useReactionPicker } from "./useReactionPicker";
import { ShareToStoryButton } from "./ShareToStoryButton";
import { PriceLabelBadge } from "./PriceLabelBadge";

function timeAgo(iso: string) {
  const s = Math.floor((Date.now() - new Date(iso).getTime()) / 1000);
  if (s < 60) return "just now";
  if (s < 3600) return `${Math.floor(s / 60)}m ago`;
  if (s < 86400) return `${Math.floor(s / 3600)}h ago`;
  return `${Math.floor(s / 86400)}d ago`;
}

function fmtDate(d: string | null) {
  if (!d) return null;
  return new Date(d).toLocaleDateString(undefined, { month: "short", day: "numeric" });
}

export function ScrollView({
  listings,
  savedIds,
  onSave,
  onMessage,
  onOpen,
  pinnedIds,
  onPin,
  fullBleed = false,
}: {
  listings: Listing[];
  savedIds: Set<string>;
  onSave: (l: Listing) => void;
  onMessage: (l: Listing) => void;
  onOpen: (l: Listing) => void;
  pinnedIds?: Set<string>;
  onPin?: (l: Listing) => void;
  fullBleed?: boolean;
}) {
  const containerRef = useRef<HTMLDivElement>(null);
  const [activeIdx, setActiveIdx] = useState(0);
  const [showHint, setShowHint] = useState(() => {
    if (typeof window === "undefined") return false;
    return !localStorage.getItem("lu:scroll-hint-seen");
  });

  // Average price per bed count for "🔥 deal" badge
  const avgByBeds = useMemo(() => {
    const groups: Record<number, number[]> = {};
    for (const l of listings) {
      if (!l.beds || !l.price) continue;
      (groups[l.beds] ??= []).push(l.price);
    }
    const avg: Record<number, number> = {};
    for (const [beds, prices] of Object.entries(groups)) {
      avg[Number(beds)] = prices.reduce((a, b) => a + b, 0) / prices.length;
    }
    return avg;
  }, [listings]);

  function isFireDeal(l: Listing) {
    const avg = avgByBeds[l.beds];
    if (!avg) return false;
    return l.price <= avg * 0.85;
  }

  // Track active index by scroll position
  useEffect(() => {
    const el = containerRef.current;
    if (!el) return;
    const handler = () => {
      const idx = Math.round(el.scrollTop / el.clientHeight);
      setActiveIdx(idx);
      if (idx > 0 && showHint) {
        setShowHint(false);
        try { localStorage.setItem("lu:scroll-hint-seen", "1"); } catch {}
      }
    };
    el.addEventListener("scroll", handler, { passive: true });
    return () => el.removeEventListener("scroll", handler);
  }, [showHint]);

  // Keyboard navigation
  useEffect(() => {
    function onKey(e: KeyboardEvent) {
      const el = containerRef.current;
      if (!el) return;
      if (e.key === "ArrowDown" || e.key === "PageDown" || e.key === "j") {
        e.preventDefault();
        el.scrollBy({ top: el.clientHeight, behavior: "smooth" });
      } else if (e.key === "ArrowUp" || e.key === "PageUp" || e.key === "k") {
        e.preventDefault();
        el.scrollBy({ top: -el.clientHeight, behavior: "smooth" });
      }
    }
    window.addEventListener("keydown", onKey);
    return () => window.removeEventListener("keydown", onKey);
  }, []);

  if (listings.length === 0) {
    return (
      <div className="grid h-[70vh] place-items-center text-center">
        <div>
          <div className="text-5xl">🏠</div>
          <p className="mt-2 text-sm text-muted-foreground">No listings to scroll through.</p>
        </div>
      </div>
    );
  }

  return (
    <div className={cn("relative", fullBleed ? "h-[100dvh] w-screen" : "-mx-4 -my-5")}>
      <div
        ref={containerRef}
        className={cn(
          "snap-y snap-mandatory overflow-y-scroll scroll-smooth bg-black",
          fullBleed ? "h-[100dvh] w-screen" : "h-[calc(100vh-7.5rem)]",
        )}
        style={{ scrollbarWidth: "none" }}
      >
        {listings.map((l, i) => {
          const allPhotos = l.photo_urls?.length ? l.photo_urls : l.photos ?? [];
          const fire = isFireDeal(l);
          const saved = savedIds.has(l.id);
          return (
            <ScrollCard
              key={l.id}
              l={l}
              photos={allPhotos}
              fire={fire}
              saved={saved}
              eager={i < 2}
              active={i === activeIdx}
              onSave={() => onSave(l)}
              onMessage={() => onMessage(l)}
              onOpen={() => onOpen(l)}
              onPin={onPin ? () => onPin(l) : undefined}
              pinned={pinnedIds?.has(l.id) ?? false}
            />
          );
        })}
      </div>

      {/* Progress dots on the side */}
      <div className="pointer-events-none absolute right-2 top-1/2 hidden -translate-y-1/2 flex-col gap-1.5 md:flex">
        {listings.slice(0, 12).map((_, i) => (
          <div
            key={i}
            className={cn(
              "h-1.5 w-1.5 rounded-full transition-all",
              i === activeIdx ? "h-6 bg-white" : "bg-white/40"
            )}
          />
        ))}
        {listings.length > 12 && <div className="mt-1 text-[10px] font-bold text-white/70">+{listings.length - 12}</div>}
      </div>

      {/* Counter top-center */}
      <div className="pointer-events-none absolute left-1/2 top-3 -translate-x-1/2 rounded-full bg-black/40 px-3 py-1 text-xs font-bold text-white backdrop-blur">
        {activeIdx + 1} / {listings.length}
      </div>
      {/* First-visit swipe hint */}
      {showHint && listings.length > 1 && (
        <div className="pointer-events-none absolute inset-x-0 bottom-24 z-30 flex flex-col items-center gap-1 text-white">
          <div className="rounded-full bg-black/50 px-3 py-1.5 text-xs font-bold backdrop-blur">
            Swipe up for more
          </div>
          <ArrowRight className="h-5 w-5 -rotate-90 animate-bounce" />
        </div>
      )}
    </div>
  );
}

function ScrollCard({
  l, photos, fire, saved, eager, active,
  onSave, onMessage, onOpen, onPin, pinned,
}: {
  l: Listing;
  photos: string[];
  fire: boolean;
  saved: boolean;
  eager: boolean;
  active: boolean;
  onSave: () => void;
  onMessage: () => void;
  onOpen: () => void;
  onPin?: () => void;
  pinned: boolean;
}) {
  const [photoIdx, setPhotoIdx] = useState(0);
  const [pulseText, setPulseText] = useState<string | null>(null);
  const lastTap = useRef(0);
  const picker = useReactionPicker(l.id);

  useEffect(() => {
    if (!active) return;
    setPhotoIdx(0);
    // Activity pulse after 1.5s
    const t = setTimeout(() => {
      const opts: string[] = [];
      if ((l.view_count ?? 0) > 0) opts.push(`👀 ${l.view_count} students viewed this`);
      if (fire) opts.push(`🔥 Priced below campus average`);
      if (l.profile?.verified_email) opts.push(`✓ Verified .edu student`);
      if (opts.length === 0) opts.push(`📍 ${l.area ?? "Near campus"}`);
      setPulseText(opts[Math.floor(Math.random() * opts.length)]);
      const t2 = setTimeout(() => setPulseText(null), 3200);
      return () => clearTimeout(t2);
    }, 1500);
    return () => clearTimeout(t);
  }, [active, l, fire]);

  function handlePhotoTap(e: React.MouseEvent<HTMLDivElement>) {
    // Long-press / double-tap → reactions
    const res = picker.handleClick(e);
    if (res.suppressed) return;

    // Single tap: photo nav
    if (photos.length <= 1) return;
    const rect = e.currentTarget.getBoundingClientRect();
    const x = e.clientX - rect.left;
    const isLeft = x < rect.width / 2;
    const now = Date.now();
    lastTap.current = now;
    setTimeout(() => {
      if (lastTap.current !== now) return; // got double-tapped meanwhile
      setPhotoIdx((p) => {
        if (isLeft) return p === 0 ? photos.length - 1 : p - 1;
        return p === photos.length - 1 ? 0 : p + 1;
      });
    }, 290);
  }

  const photo = photos[photoIdx];

  return (
    <section className="relative h-full w-full snap-start snap-always overflow-hidden">
      {/* Photo with long-press / double-tap area */}
      <div
        ref={picker.containerRef}
        className="absolute inset-0 cursor-pointer"
        onClick={handlePhotoTap}
        {...picker.bind}
      >
        {photo ? (
          <img
            key={photo}
            src={photo}
            alt={l.title}
            className="absolute inset-0 h-full w-full animate-[lu-card-pop_400ms_ease-out] object-cover"
            loading={eager ? "eager" : "lazy"}
          />
        ) : (
          <div className="absolute inset-0 grid place-items-center bg-gradient-to-br from-primary/40 to-primary-dark/60 text-7xl">🏠</div>
        )}
        {picker.overlay}
      </div>

      {/* Photo progress bars */}
      {photos.length > 1 && (
        <div className="pointer-events-none absolute inset-x-3 top-2 z-10 flex gap-1">
          {photos.map((_, i) => (
            <div key={i} className="h-1 flex-1 overflow-hidden rounded-full bg-white/30">
              <div className={cn("h-full bg-white transition-all", i === photoIdx ? "w-full" : i < photoIdx ? "w-full opacity-60" : "w-0")} />
            </div>
          ))}
        </div>
      )}

      {/* Top gradient + bottom gradient */}
      <div className="pointer-events-none absolute inset-x-0 top-0 h-32 bg-gradient-to-b from-black/70 to-transparent" />
      <div className="pointer-events-none absolute inset-x-0 bottom-0 h-2/3 bg-gradient-to-t from-black/90 via-black/50 to-transparent" />

      {/* Top-left: posted ago */}
      <div className="pointer-events-none absolute left-4 top-5 rounded-full bg-black/40 px-3 py-1 text-xs font-bold text-white backdrop-blur">
        Posted {timeAgo(l.created_at)}
      </div>

      <div className="pointer-events-none absolute right-4 top-5">
      </div>

      {fire && (
        <div className="pointer-events-none absolute right-4 top-16 flex items-center gap-1 rounded-full bg-orange-500/90 px-3 py-1 text-xs font-bold text-white shadow-lg">
          <Flame className="h-3.5 w-3.5 fill-yellow-300 text-yellow-300" />
          Hot deal
        </div>
      )}

      {/* (Double-tap floating reaction now handled by useReactionPicker overlay) */}

      {/* Activity pulse */}
      {pulseText && (
        <div className="lu-activity-pulse pointer-events-none absolute bottom-32 left-1/2 z-20 rounded-full bg-white/95 px-4 py-2 text-xs font-bold text-foreground shadow-lg backdrop-blur">
          {pulseText}
        </div>
      )}

      {/* Bottom-left: info */}
      <div className="pointer-events-none absolute inset-x-0 bottom-0 p-5 pr-24 text-white">
        <div className="flex items-baseline gap-2">
          <span className="text-4xl font-black tracking-tight">${l.price.toLocaleString()}</span>
          <span className="text-sm font-semibold text-white/70">/mo</span>
          <PriceLabelBadge price={l.price} campusId={(l as any).campus_id} beds={l.beds} size="sm" />
        </div>
        <h2 className="mt-1 line-clamp-2 text-xl font-bold leading-tight">{l.title}</h2>
        <div className="mt-2 flex flex-wrap items-center gap-x-3 gap-y-1 text-sm font-semibold text-white/85">
          <span className="flex items-center gap-1"><BedDouble className="h-4 w-4" />{l.beds} bd</span>
          <span className="flex items-center gap-1"><Bath className="h-4 w-4" />{l.baths} ba</span>
          {l.area && <span className="flex items-center gap-1"><MapPin className="h-4 w-4" />{l.area}</span>}
          {(l.available_from || l.available_to) && (
            <span className="flex items-center gap-1">
              <Calendar className="h-4 w-4" />
              {fmtDate(l.available_from)}{l.available_to ? ` – ${fmtDate(l.available_to)}` : ""}
            </span>
          )}
        </div>
        <div className="mt-2 flex flex-wrap gap-1.5">
          {l.furnished && <span className="rounded-full bg-white/15 px-2 py-0.5 text-[11px] font-bold backdrop-blur">Furnished</span>}
          {l.utilities_included && <span className="rounded-full bg-white/15 px-2 py-0.5 text-[11px] font-bold backdrop-blur">Utilities incl.</span>}
          {l.pet_friendly && <span className="rounded-full bg-white/15 px-2 py-0.5 text-[11px] font-bold backdrop-blur">Pets OK</span>}
          {l.parking && <span className="rounded-full bg-white/15 px-2 py-0.5 text-[11px] font-bold backdrop-blur">Parking</span>}
        </div>
      </div>

      {/* Bottom-right: action buttons */}
      <div className="absolute bottom-5 right-4 z-20 flex flex-col items-center gap-3">
        <button
          onClick={(e) => { e.stopPropagation(); onSave(); }}
          aria-label={saved ? "Unsave" : "Save"}
          className={cn(
            "grid h-12 w-12 place-items-center rounded-full backdrop-blur transition active:scale-90",
            saved ? "bg-red-500 text-white" : "bg-white/20 text-white hover:bg-white/30"
          )}
        >
          <Heart className={cn("h-6 w-6", saved && "fill-current lu-heart-pop")} />
        </button>
        <button
          onClick={(e) => { e.stopPropagation(); onMessage(); }}
          aria-label="Message"
          className="grid h-12 w-12 place-items-center rounded-full bg-white/20 text-white backdrop-blur transition hover:bg-white/30 active:scale-90"
        >
          <MessageCircle className="h-6 w-6" />
        </button>
        <ShareToStoryButton listing={l} variant="icon" />
        {onPin && (
          <button
            onClick={(e) => { e.stopPropagation(); onPin(); }}
            aria-label="Pin to compare"
            className={cn(
              "grid h-12 w-12 place-items-center rounded-full backdrop-blur transition active:scale-90",
              pinned ? "bg-primary text-primary-foreground" : "bg-white/20 text-white hover:bg-white/30",
            )}
          >
            <Scale className="h-6 w-6" />
          </button>
        )}
        <button
          onClick={(e) => { e.stopPropagation(); onOpen(); }}
          aria-label="View details"
          className="grid h-12 w-12 place-items-center rounded-full bg-primary text-primary-foreground shadow-lg transition hover:bg-primary-dark active:scale-90"
        >
          <ArrowRight className="h-6 w-6" />
        </button>
      </div>
    </section>
  );
}

