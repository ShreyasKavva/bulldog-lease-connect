/**
 * BrowseMapView — Airbnb-style explore map for /browse (Q90).
 *
 * Desktop: 45% scrollable compact card list on the left, 55% map on the right.
 * Mobile: full-screen map with a "Show X subleases" pill that opens a
 * bottom sheet containing the same compact card list.
 *
 * Leaflet is loaded lazily (only when this component mounts) and its CSS is
 * already linked from __root.tsx. Listings without lat/lng are scattered
 * deterministically around the campus center using their id as a seed so the
 * pins never jump between renders.
 */
import { useEffect, useMemo, useRef, useState } from "react";
// @ts-ignore - leaflet types are optional here
import type LType from "leaflet";
import { Link } from "@tanstack/react-router";
import { Check, X } from "lucide-react";
import { cn } from "@/lib/utils";
import type { Listing } from "@/lib/leaseup/types";

/** Fallback only — the real center comes from the selected campus (Q177). */
const DEFAULT_CENTER: [number, number] = [39.8283, -98.5795];

/** Stable pseudo-random offset from the listing id (no Math.random → no SSR drift). */
function seededOffset(id: string): [number, number] {
  let h = 2166136261;
  for (let i = 0; i < id.length; i++) {
    h ^= id.charCodeAt(i);
    h = Math.imul(h, 16777619);
  }
  const a = ((h >>> 0) % 10000) / 10000;
  const b = ((Math.imul(h, 48271) >>> 0) % 10000) / 10000;
  return [(a - 0.5) * 0.04, (b - 0.5) * 0.04];
}

function coordsFor(l: Listing, center: [number, number]): [number, number] {
  if (l.lat != null && l.lng != null) return [l.lat, l.lng];
  const [dy, dx] = seededOffset(l.id);
  return [center[0] + dy, center[1] + dx];
}

function pinHtml(l: Listing, active: boolean) {
  const bg = active ? "#111827" : "#FFFFFF";
  const fg = active ? "#FFFFFF" : "#111827";
  return `<div class="lu-map-pin" style="background:${bg};color:${fg};">$${l.price}</div>`;
}

function CompactCard({
  listing, active, onClick,
}: { listing: Listing; active: boolean; onClick: () => void }) {
  const photo = (listing.photo_urls?.length ? listing.photo_urls : listing.photos)?.[0];
  return (
    <button
      type="button"
      onClick={onClick}
      className={cn(
        "flex w-full items-center gap-3 rounded-xl p-2 text-left transition hover:bg-muted/60",
        active && "border-l-2 border-foreground bg-muted/50",
      )}
    >
      {photo ? (
        <img src={photo} alt={listing.title} loading="lazy" className="h-[100px] w-[100px] shrink-0 rounded-xl object-cover" />
      ) : (
        <div className="grid h-[100px] w-[100px] shrink-0 place-items-center rounded-xl bg-muted text-3xl">🏠</div>
      )}
      <div className="min-w-0 flex-1">
        <p className="truncate text-sm font-medium text-foreground">{listing.title}</p>
        <p className="mt-0.5 text-sm text-foreground">
          <span className="font-semibold">${listing.price.toLocaleString()}</span>
          <span className="text-muted-foreground">
            /mo · {listing.beds === 0 ? "Studio" : `${listing.beds} bd`} · {Number(listing.baths)} ba
          </span>
        </p>
        <p className="mt-0.5 truncate text-xs text-muted-foreground">{listing.area ?? "Near campus"}</p>
        <p className="mt-0.5 flex items-center gap-1 text-xs text-muted-foreground">
          <span className="truncate">
            {listing.profile?.name || listing.profile?.email?.split("@")[0] || "Student"}
          </span>
          {listing.profile?.verified_email && <Check className="h-3 w-3 shrink-0 text-success" aria-label="Verified" />}
        </p>
      </div>
    </button>
  );
}

function PopupCard({ listing, onClose }: { listing: Listing; onClose: () => void }) {
  const photo = (listing.photo_urls?.length ? listing.photo_urls : listing.photos)?.[0];
  return (
    <div className="w-[280px] overflow-hidden rounded-2xl bg-surface shadow-xl">
      <div className="relative">
        {photo ? (
          <img src={photo} alt={listing.title} className="aspect-[4/3] w-full object-cover" />
        ) : (
          <div className="grid aspect-[4/3] w-full place-items-center bg-muted text-4xl">🏠</div>
        )}
        <button
          type="button"
          onClick={onClose}
          aria-label="Close"
          className="absolute right-2 top-2 grid h-5 w-5 place-items-center rounded-full bg-surface text-foreground shadow"
        >
          <X className="h-3 w-3" />
        </button>
      </div>
      <div className="p-3">
        <p className="truncate text-sm font-medium">{listing.title}</p>
        <p className="mt-0.5 text-sm">
          <span className="font-semibold">${listing.price.toLocaleString()}</span>
          <span className="text-muted-foreground">
            /mo · {listing.beds === 0 ? "Studio" : `${listing.beds} bd`} · {Number(listing.baths)} ba
          </span>
        </p>
        <p className="mt-0.5 flex items-center gap-1 text-xs text-muted-foreground">
          <span className="truncate">
            {listing.profile?.name || listing.profile?.email?.split("@")[0] || "Student"}
          </span>
          {listing.profile?.verified_email && <Check className="h-3 w-3 shrink-0 text-success" />}
        </p>
        <Link
          to="/listing/$id"
          params={{ id: listing.id }}
          className="mt-2 inline-block text-sm font-medium text-foreground hover:underline"
        >
          View listing
        </Link>
      </div>
    </div>
  );
}

export function BrowseMapView({
  listings,
  center,
  centerLabel,
}: {
  listings: Listing[];
  /** Campus coordinates for the current search — the map opens here. */
  center?: [number, number] | null;
  centerLabel?: string;
}) {
  const mapCenter = useMemo<[number, number]>(
    () => center ?? DEFAULT_CENTER,
    [center?.[0], center?.[1]],
  );
  const zoom = center ? 14 : 4;
  const elRef = useRef<HTMLDivElement>(null);
  const mapRef = useRef<LType.Map | null>(null);
  const Lref = useRef<typeof LType | null>(null);
  const layerRef = useRef<LType.LayerGroup | null>(null);
  const listingsRef = useRef(listings);
  const activeRef = useRef<string | null>(null);
  const [ready, setReady] = useState(false);
  const [activeId, setActiveId] = useState<string | null>(null);
  const [sheetOpen, setSheetOpen] = useState(false);

  listingsRef.current = listings;
  activeRef.current = activeId;

  const active = useMemo(() => listings.find((l) => l.id === activeId) ?? null, [listings, activeId]);

  useEffect(() => {
    let cancelled = false;
    (async () => {
      const L = (await import("leaflet")).default;
      if (cancelled || !elRef.current || mapRef.current) return;
      Lref.current = L;
      const map = L.map(elRef.current, { zoomControl: true, attributionControl: false }).setView(mapCenter, zoom);
      L.tileLayer("https://{s}.tile.openstreetmap.org/{z}/{x}/{y}.png", { maxZoom: 19 }).addTo(map);
      map.on("click", () => setActiveId(null));
      mapRef.current = map;
      setReady(true);
    })();
    return () => {
      cancelled = true;
      mapRef.current?.remove();
      mapRef.current = null;
    };
  }, []);

  // Re-render pins on listing / selection change
  useEffect(() => {
    const L = Lref.current;
    const map = mapRef.current;
    if (!L || !map) return;
    layerRef.current?.remove();
    const layer = L.layerGroup().addTo(map);
    layerRef.current = layer;
    listings.forEach((l) => {
      const [lat, lng] = coordsFor(l, mapCenter);
      const isActive = l.id === activeId;
      const marker = L.marker([lat, lng], {
        icon: L.divIcon({ className: "lu-map-pin-wrap", html: pinHtml(l, isActive), iconSize: [56, 26], iconAnchor: [28, 26] }),
        zIndexOffset: isActive ? 1000 : 0,
      }).addTo(layer);
      marker.on("click", (e: any) => {
        e.originalEvent?.stopPropagation?.();
        setActiveId(l.id);
      });
    });
  }, [listings, activeId, ready, mapCenter]);

  /** Recenter whenever the visitor switches campus. */
  useEffect(() => {
    if (!ready || !center) return;
    mapRef.current?.setView(center, 14);
  }, [ready, center?.[0], center?.[1]]);

  function focus(l: Listing) {
    setActiveId(l.id);
    setSheetOpen(false);
    const [lat, lng] = coordsFor(l, mapCenter);
    mapRef.current?.flyTo([lat, lng], 16);
  }

  const list = (
    <div className="space-y-1 p-2">
      {centerLabel && (
        <p className="px-2 pb-1 pt-2 text-sm font-semibold text-foreground">
          Subleases around {centerLabel}
        </p>
      )}
      {listings.length === 0 ? (
        <p className="p-6 text-center text-sm text-muted-foreground">No subleases match those filters.</p>
      ) : (
        listings.map((l) => (
          <CompactCard key={l.id} listing={l} active={l.id === activeId} onClick={() => focus(l)} />
        ))
      )}
    </div>
  );

  return (
    <div className="relative flex h-[calc(100dvh-7rem)] w-full overflow-hidden rounded-none md:rounded-2xl">
      <style>{`
        .lu-map-pin { display:inline-block; padding:4px 10px; border-radius:9999px;
          font-weight:600; font-size:13px; box-shadow:0 2px 6px rgba(0,0,0,.18);
          white-space:nowrap; transition:transform .15s ease;
          font-family:-apple-system,BlinkMacSystemFont,sans-serif; }
        .lu-map-pin-wrap:hover { z-index:900 !important; }
        .lu-map-pin-wrap:hover .lu-map-pin { transform:scale(1.1); }
      `}</style>

      {/* Left list — desktop only */}
      <aside className="hidden w-[45%] shrink-0 overflow-y-auto border-r bg-surface md:block">
        {list}
      </aside>

      {/* Map */}
      <div className="relative min-w-0 flex-1">
        <div ref={elRef} className="absolute inset-0 z-0" />

        {active && (
          <div className="pointer-events-auto absolute left-1/2 top-4 z-[500] -translate-x-1/2">
            <PopupCard listing={active} onClose={() => setActiveId(null)} />
          </div>
        )}

        {/* Mobile pill */}
        <button
          type="button"
          onClick={() => setSheetOpen(true)}
          className="absolute bottom-6 left-1/2 z-[500] -translate-x-1/2 rounded-full bg-foreground px-6 py-3 text-sm font-semibold text-background shadow-lg md:hidden"
        >
          Show {listings.length} sublease{listings.length === 1 ? "" : "s"}
        </button>
      </div>

      {/* Mobile bottom sheet */}
      {sheetOpen && (
        <div className="absolute inset-0 z-[900] md:hidden" onClick={() => setSheetOpen(false)}>
          <div className="absolute inset-0 bg-black/30" />
          <div
            className="absolute inset-x-0 bottom-0 h-[60vh] overflow-y-auto rounded-t-2xl bg-surface shadow-xl"
            onClick={(e) => e.stopPropagation()}
          >
            <div className="sticky top-0 flex justify-center bg-surface py-2">
              <div className="h-1.5 w-10 rounded-full bg-border" />
            </div>
            {list}
          </div>
        </div>
      )}
    </div>
  );
}
