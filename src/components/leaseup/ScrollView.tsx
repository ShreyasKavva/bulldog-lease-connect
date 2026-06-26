import { useEffect, useMemo, useRef, useState } from "react";
import type { Listing } from "@/lib/leaseup/types";
import { Heart, MessageCircle, ArrowRight, Flame, BedDouble, Bath, MapPin, Calendar, Scale } from "lucide-react";
import { SafeScoreBadge } from "./SafeScoreBadge";
import { cn } from "@/lib/utils";

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
}: {
  listings: Listing[];
  savedIds: Set<string>;
  onSave: (l: Listing) => void;
  onMessage: (l: Listing) => void;
  onOpen: (l: Listing) => void;
  pinnedIds?: Set<string>;
  onPin?: (l: Listing) => void;
}) {
  const containerRef = useRef<HTMLDivElement>(null);
  const [activeIdx, setActiveIdx] = useState(0);

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
    };
    el.addEventListener("scroll", handler, { passive: true });
    return () => el.removeEventListener("scroll", handler);
  }, []);

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
    <div className="relative -mx-4 -my-5">
      <div
        ref={containerRef}
        className="h-[calc(100vh-7.5rem)] snap-y snap-mandatory overflow-y-scroll scroll-smooth bg-black"
        style={{ scrollbarWidth: "none" }}
      >
        {listings.map((l, i) => {
          const photo = l.photo_urls?.[0] ?? l.photos?.[0];
          const fire = isFireDeal(l);
          const saved = savedIds.has(l.id);
          return (
            <section
              key={l.id}
              className="relative h-full w-full snap-start snap-always overflow-hidden"
            >
              {photo ? (
                <img
                  src={photo}
                  alt={l.title}
                  className="absolute inset-0 h-full w-full object-cover"
                  loading={i < 2 ? "eager" : "lazy"}
                />
              ) : (
                <div className="absolute inset-0 grid place-items-center bg-gradient-to-br from-primary/40 to-primary-dark/60 text-7xl">🏠</div>
              )}

              {/* Top gradient + bottom gradient */}
              <div className="absolute inset-x-0 top-0 h-32 bg-gradient-to-b from-black/70 to-transparent" />
              <div className="absolute inset-x-0 bottom-0 h-2/3 bg-gradient-to-t from-black/90 via-black/50 to-transparent" />

              {/* Top-left: posted ago */}
              <div className="absolute left-4 top-4 rounded-full bg-black/40 px-3 py-1 text-xs font-bold text-white backdrop-blur">
                Posted {timeAgo(l.created_at)}
              </div>

              {/* Top-right: SafeScore */}
              <div className="absolute right-4 top-4">
                <SafeScoreBadge score={l.safe_score ?? 0} />
              </div>

              {/* Fire deal */}
              {fire && (
                <div className="absolute right-4 top-16 flex items-center gap-1 rounded-full bg-orange-500/90 px-3 py-1 text-xs font-bold text-white shadow-lg animate-pulse">
                  <Flame className="h-3.5 w-3.5 fill-yellow-300 text-yellow-300" />
                  Hot deal
                </div>
              )}

              {/* Bottom-left: info */}
              <div className="absolute inset-x-0 bottom-0 p-5 pr-24 text-white">
                <div className="flex items-baseline gap-2">
                  <span className="text-4xl font-black tracking-tight">${l.price.toLocaleString()}</span>
                  <span className="text-sm font-semibold text-white/70">/mo</span>
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
              <div className="absolute bottom-5 right-4 flex flex-col items-center gap-3">
                <button
                  onClick={(e) => { e.stopPropagation(); onSave(l); }}
                  aria-label={saved ? "Unsave" : "Save"}
                  className={cn(
                    "grid h-12 w-12 place-items-center rounded-full backdrop-blur transition active:scale-90",
                    saved ? "bg-red-500 text-white" : "bg-white/20 text-white hover:bg-white/30"
                  )}
                >
                  <Heart className={cn("h-6 w-6", saved && "fill-current")} />
                </button>
                <button
                  onClick={(e) => { e.stopPropagation(); onMessage(l); }}
                  aria-label="Message"
                  className="grid h-12 w-12 place-items-center rounded-full bg-white/20 text-white backdrop-blur transition hover:bg-white/30 active:scale-90"
                >
                  <MessageCircle className="h-6 w-6" />
                </button>
                <button
                  onClick={(e) => { e.stopPropagation(); onOpen(l); }}
                  aria-label="View details"
                  className="grid h-12 w-12 place-items-center rounded-full bg-primary text-primary-foreground shadow-lg transition hover:bg-primary-dark active:scale-90"
                >
                  <ArrowRight className="h-6 w-6" />
                </button>
              </div>
            </section>
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
    </div>
  );
}
