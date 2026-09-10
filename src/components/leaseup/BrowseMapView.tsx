/**
 * BrowseMapView — Airbnb-style explore map for /browse (Q90, restyled in Q177).
 *
 * Desktop: 45% scrollable compact card list on the left, 55% map on the right.
 * Mobile: full-screen map with a "Show X subleases" pill that opens a
 * bottom sheet containing the same compact card list.
 *
 * Q177 changes:
 *  - CARTO Positron basemap (shared constant) + visible-but-subtle attribution
 *  - Airbnb-style white price pills (hover / selected / viewed states)
 *  - Deterministic collision fan-out so no pill hides another
 *  - Approximate location only: every point is jittered from the listing id and
 *    the selected listing renders a ~250m area circle instead of a precise pin
 *  - One campus anchor label + custom top-right zoom / fullscreen controls
 */
import { useEffect, useMemo, useRef, useState } from "react";
// @ts-ignore - leaflet types are optional here
import type LType from "leaflet";
import { Link } from "@tanstack/react-router";
import { Check, X } from "lucide-react";
import { cn } from "@/lib/utils";
import type { Listing } from "@/lib/leaseup/types";
import { BASEMAP_URL, BASEMAP_OPTIONS } from "@/lib/leaseup/map-tiles";
import { useRecentViews } from "@/lib/leaseup/recent-views";
import { posterName } from "@/lib/leaseup/display-name";

/** Fallback only — the real center comes from the selected campus (Q177). */
const DEFAULT_CENTER: [number, number] = [39.8283, -98.5795];

/** Home campus — UGA, Athens GA. Used when there are no plottable listings. */
const UGA_FALLBACK: [number, number] = [33.948, -83.3773];


/** Stable pseudo-random hash from the listing id (no Math.random → no SSR drift). */
function hashId(id: string): number {
  let h = 2166136261;
  for (let i = 0; i < id.length; i++) {
    h ^= id.charCodeAt(i);
    h = Math.imul(h, 16777619);
  }
  return h >>> 0;
}

function seededOffset(id: string): [number, number] {
  const h = hashId(id);
  const a = (h % 10000) / 10000;
  const b = ((Math.imul(h, 48271) >>> 0) % 10000) / 10000;
  return [(a - 0.5) * 0.04, (b - 0.5) * 0.04];
}

/**
 * Privacy jitter (Q177): never plot the exact address. ~120–260m, stable per id.
 */
function privacyJitter(id: string): [number, number] {
  const h = hashId(id);
  const angle = ((h % 3600) / 3600) * Math.PI * 2;
  const dist = 0.0011 + (((Math.imul(h, 2246822519) >>> 0) % 1000) / 1000) * 0.0013; // deg lat
  return [Math.sin(angle) * dist, Math.cos(angle) * dist];
}

/**
 * Best available approximate position: the listing's own coordinates (jittered),
 * else a stable scatter around its campus, else around the map center.
 */
function coordsFor(
  l: Listing,
  center: [number, number],
  campusCoords?: Record<string, [number, number]>,
): [number, number] {
  const [jy, jx] = privacyJitter(l.id);
  if (l.lat != null && l.lng != null) return [l.lat + jy, l.lng + jx];
  const base = (l.campus_id && campusCoords?.[l.campus_id]) || center;
  const [dy, dx] = seededOffset(l.id);
  return [base[0] + dy, base[1] + dx];
}

type PinState = "default" | "active" | "viewed";

function pinHtml(l: Listing, state: PinState) {
  const bg = state === "active" ? "#222222" : "#FFFFFF";
  const fg = state === "active" ? "#FFFFFF" : state === "viewed" ? "#717171" : "#222222";
  return `<div class="lu-map-pin" style="background:${bg};color:${fg};">$${l.price.toLocaleString()}</div>`;
}

function CompactCard({
  listing, active, onClick,
}: { listing: Listing; active: boolean; onClick: () => void }) {
  const photo = (listing.photo_urls?.length ? listing.photo_urls : listing.photos)?.[0];
  return (
    <div
      role="button"
      tabIndex={0}
      onClick={onClick}
      onKeyDown={(e) => { if (e.key === "Enter") onClick?.(); }}
      className={cn(
        "flex w-full cursor-pointer items-center gap-3 rounded-xl p-2 text-left transition hover:bg-muted/60",
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
            {posterName(listing)}
          </span>
          {listing.profile?.verified_email && <Check className="h-3 w-3 shrink-0 text-success" aria-label="Verified" />}
        </p>
        {/* Q181 — same primary CTA as the grid/list cards */}
        <button
          type="button"
          onClick={(e) => { e.stopPropagation(); onClick?.(); }}
          className="mt-2 rounded-full bg-[#4F46E5] px-4 py-2 text-sm font-semibold text-white shadow-sm transition-all duration-150 hover:-translate-y-0.5 hover:bg-[#4338CA] hover:shadow-md"
        >
          View listing →
        </button>
      </div>
    </div>
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
            {posterName(listing)}
          </span>
          {listing.profile?.verified_email && <Check className="h-3 w-3 shrink-0 text-success" />}
        </p>
        <p className="mt-1 text-[11px] text-muted-foreground">Approximate area shown</p>
        <Link
          to="/listing/$id"
          params={{ id: listing.id }}
          className="mt-2 inline-block rounded-full bg-[#4F46E5] px-4 py-2 text-sm font-semibold text-white shadow-sm transition-all duration-150 hover:-translate-y-0.5 hover:bg-[#4338CA] hover:shadow-md"
        >
          View listing →
        </Link>
      </div>
    </div>
  );
}

export function BrowseMapView({
  listings,
  center,
  centerLabel,
  campusCoords,
}: {
  listings: Listing[];
  /** Campus coordinates for the current search — the map opens here. */
  center?: [number, number] | null;
  centerLabel?: string;
  /** campus id -> coordinates, so pins land near the right school. */
  campusCoords?: Record<string, [number, number]>;
}) {
  const mapCenter = useMemo<[number, number]>(
    () => center ?? DEFAULT_CENTER,
    [center?.[0], center?.[1]],
  );
  
  const elRef = useRef<HTMLDivElement>(null);
  const shellRef = useRef<HTMLDivElement>(null);
  const mapRef = useRef<LType.Map | null>(null);
  const Lref = useRef<typeof LType | null>(null);
  const layerRef = useRef<LType.LayerGroup | null>(null);
  const anchorRef = useRef<LType.Marker | null>(null);
  const listingsRef = useRef(listings);
  const activeRef = useRef<string | null>(null);
  const [ready, setReady] = useState(false);
  const [activeId, setActiveId] = useState<string | null>(null);
  const [sheetOpen, setSheetOpen] = useState(false);
  const viewed = useRecentViews();

  listingsRef.current = listings;
  activeRef.current = activeId;

  const active = useMemo(() => listings.find((l) => l.id === activeId) ?? null, [listings, activeId]);

  useEffect(() => {
    if (typeof window === "undefined") return;
    let cancelled = false;
    let viewportInitialized = false;
    let ro: ResizeObserver | null = null;
    let raf = 0;
    (async () => {
      const L = (await import("leaflet")).default;
      if (cancelled || !elRef.current || mapRef.current) return;
      Lref.current = L;
      // A view MUST exist before any layer is added — Leaflet throws
      // "Set map center and zoom first." otherwise, which aborted the rest of
      // this effect in the production build (no tiles, no attribution, no pins).
      const map = L.map(elRef.current, {
        zoomControl: false,
        attributionControl: true,
        center: center ?? UGA_FALLBACK,
        zoom: 13,
      });
      // Basemap first, unconditionally — it must never depend on listings data.
      L.tileLayer(BASEMAP_URL, { ...BASEMAP_OPTIONS }).addTo(map);
      map.attributionControl.setPrefix("");
      map.on("click", () => setActiveId(null));
      mapRef.current = map;

      const initializeViewport = () => {
        const container = elRef.current;
        if (cancelled || mapRef.current !== map || !container) return;
        if (container.clientWidth < 1 || container.clientHeight < 1) return;

        try {
          map.invalidateSize();
          fitToResults(map, L);
        } catch {
          /* fitting must never block the layers below */
        }
        viewportInitialized = true;
        setReady(true);
      };


      // The container can still be laying out on first paint; measure on the
      // next frame, then fit. Without this Leaflet computes a 0x0 viewport
      // and falls back to world zoom 0.
      raf = requestAnimationFrame(initializeViewport);

      // Any later resize (view toggle, sheet, orientation) re-measures.
      if (typeof ResizeObserver !== "undefined" && elRef.current) {
        ro = new ResizeObserver(() => {
          const container = elRef.current;
          if (cancelled || mapRef.current !== map || !container) return;
          if (container.clientWidth < 1 || container.clientHeight < 1) return;
          if (!viewportInitialized) initializeViewport();
          else map.invalidateSize();
        });
        ro.observe(elRef.current);
      }
    })();
    return () => {
      cancelled = true;
      if (raf) cancelAnimationFrame(raf);
      ro?.disconnect();
      mapRef.current?.remove();
      mapRef.current = null;
    };
  }, []);


  // Campus anchor label (one per map)
  useEffect(() => {
    const L = Lref.current;
    const map = mapRef.current;
    if (!L || !map || !ready) return;
    anchorRef.current?.remove();
    anchorRef.current = null;
    if (!center || !centerLabel) return;
    anchorRef.current = L.marker(center, {
      interactive: false,
      keyboard: false,
      zIndexOffset: -500,
      icon: L.divIcon({
        className: "lu-anchor-wrap",
        html: `<div class="lu-map-anchor"><svg viewBox="0 0 24 24" width="13" height="13" fill="currentColor" style="vertical-align:-2px;margin-right:4px"><path d="M12 2a7 7 0 0 0-7 7c0 5.25 7 13 7 13s7-7.75 7-13a7 7 0 0 0-7-7zm0 9.5A2.5 2.5 0 1 1 12 6.5a2.5 2.5 0 0 1 0 5z"/></svg>${centerLabel}</div>`,
        iconSize: [0, 0],
        iconAnchor: [0, 0],
      }),
    }).addTo(map);
  }, [ready, centerLabel, center?.[0], center?.[1]]);

  // Re-render pins on listing / selection change, with collision fan-out.
  useEffect(() => {
    const L = Lref.current;
    const map = mapRef.current;
    if (!ready || !L || !map) return;
    layerRef.current?.remove();
    const layer = L.layerGroup().addTo(map);
    layerRef.current = layer;

    const placed: { x: number; y: number }[] = [];
    listings.forEach((l) => {
      const [lat, lng] = coordsFor(l, mapCenter, campusCoords);
      let point = map.latLngToLayerPoint([lat, lng]);

      // Deterministic fan-out: nudge along a spiral until clear of placed pins.
      const step = 34;
      for (let i = 0; i < 12; i++) {
        const clash = placed.some(
          (p) => Math.abs(p.x - point.x) < 62 && Math.abs(p.y - point.y) < 28,
        );
        if (!clash) break;
        const angle = (hashId(l.id) % 8) * (Math.PI / 4) + i * 1.1;
        point = L.point(
          point.x + Math.cos(angle) * step,
          point.y + Math.sin(angle) * (step * 0.6),
        );
      }
      placed.push({ x: point.x, y: point.y });
      const pos = map.layerPointToLatLng(point);

      const isActive = l.id === activeId;
      const state: PinState = isActive ? "active" : viewed.includes(l.id) ? "viewed" : "default";

      if (isActive) {
        // Approximate area circle instead of a precise address pin.
        L.circle(pos, {
          radius: 250,
          color: "rgba(34,34,34,0.25)",
          weight: 1,
          fillColor: "#222222",
          fillOpacity: 0.08,
        }).addTo(layer);
      }

      const marker = L.marker(pos, {
        icon: L.divIcon({
          className: "lu-map-pin-wrap",
          html: pinHtml(l, state),
          iconSize: [56, 26],
          iconAnchor: [28, 13],
        }),
        zIndexOffset: isActive ? 1000 : 0,
      }).addTo(layer);
      marker.on("click", (e: any) => {
        e.originalEvent?.stopPropagation?.();
        setActiveId(l.id);
      });
    });
  }, [listings, activeId, ready, mapCenter, campusCoords, viewed]);

  /** Re-fit whenever the result set or campus changes. */
  useEffect(() => {
    const L = Lref.current;
    const map = mapRef.current;
    if (!ready || !L || !map) return;
    const raf = requestAnimationFrame(() => {
      map.invalidateSize();
      fitToResults(map, L);
    });
    return () => cancelAnimationFrame(raf);
  }, [ready, listings, center?.[0], center?.[1]]); // eslint-disable-line react-hooks/exhaustive-deps

  /**
   * Q191/Q195 — open on the listings, not the world. Always re-measure the
   * container first, then fit the viewport to the current result set
   * (padded, zoom capped at 14). One listing centres at zoom 14; none falls
   * back to the selected campus, then UGA.
   */
  function fitToResults(map: LType.Map, L: typeof LType) {
    if (typeof window === "undefined" || mapRef.current !== map) return false;
    const container = elRef.current;
    if (!container || container.clientWidth < 1 || container.clientHeight < 1) return false;

    map.invalidateSize();
    let pts = listingsRef.current
      .map((l) => coordsFor(l, mapCenter, campusCoords))
      .filter(([lat, lng]) => Number.isFinite(lat) && Number.isFinite(lng) && Math.abs(lat) <= 90 && Math.abs(lng) <= 180);
    if (pts.length >= 2) {
      // Trim far-flung outliers: if the set spans a continent, a literal
      // fitBounds leaves every pin unreadably piled. Fit the dense cluster
      // (points within a few degrees of the median) instead.
      const lats = pts.map((p) => p[0]).sort((a, b) => a - b);
      const lngs = pts.map((p) => p[1]).sort((a, b) => a - b);
      if (lats[lats.length - 1] - lats[0] > 6) {
        const medLat = lats[Math.floor(lats.length / 2)];
        const medLng = lngs[Math.floor(lngs.length / 2)];
        const core = pts.filter((p) => Math.abs(p[0] - medLat) <= 3 && Math.abs(p[1] - medLng) <= 4);
        if (core.length > 0) pts = core;
      }
      if (pts.length === 1) map.setView(pts[0], 14);
      else map.fitBounds(L.latLngBounds(pts), { padding: [48, 48], maxZoom: 14 });
    } else if (pts.length === 1) {
      map.setView(pts[0], 14);
    } else if (center) {
      map.setView(center, 14);
    } else {
      map.setView(UGA_FALLBACK, 13);
    }
    return true;
  }


  function focus(l: Listing) {
    setActiveId(l.id);
    setSheetOpen(false);
    const [lat, lng] = coordsFor(l, mapCenter, campusCoords);
    mapRef.current?.flyTo([lat, lng], 16);
  }

  function toggleFullscreen() {
    const el = shellRef.current;
    if (!el) return;
    if (document.fullscreenElement) document.exitFullscreen?.();
    else el.requestFullscreen?.();
    setTimeout(() => mapRef.current?.invalidateSize(), 250);
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
    <div>
    <div ref={shellRef} className="relative flex min-h-[60vh] w-full overflow-hidden rounded-none bg-surface md:h-[calc(100vh-220px)] md:min-h-[520px] md:rounded-2xl">
      <style>{`
        .lu-map-pin { display:inline-block; padding:6px 12px; border-radius:9999px;
          font-weight:600; font-size:13px; line-height:1;
          border:1px solid rgba(0,0,0,.06);
          box-shadow:0 2px 8px rgba(0,0,0,.22);
          white-space:nowrap;
          transition:transform .15s ease, box-shadow .15s ease;
          font-family:-apple-system,BlinkMacSystemFont,sans-serif; }
        .lu-map-pin-wrap:hover { z-index:900 !important; }
        .lu-map-pin-wrap:hover .lu-map-pin { transform:scale(1.06);
          box-shadow:0 4px 12px rgba(0,0,0,.25); }
        .lu-map-anchor { display:inline-block; transform:translate(-50%,-50%);
          background:#fff; color:#222; padding:6px 12px; border-radius:9999px;
          font-size:14px; font-weight:600; white-space:nowrap;
          box-shadow:0 2px 8px rgba(0,0,0,.15); border:1px solid rgba(0,0,0,.06);
          font-family:-apple-system,BlinkMacSystemFont,sans-serif; }
        .leaflet-control-attribution { font-size:9px !important; color:#9ca3af !important;
          background:rgba(255,255,255,.7) !important; border-radius:9999px !important;
          padding:1px 8px !important; margin:6px !important; box-shadow:none !important; }
        .leaflet-control-attribution a { color:#9ca3af !important; }
      `}</style>

      {/* Left list — desktop only */}
      <aside className="hidden w-[45%] shrink-0 overflow-y-auto border-r bg-surface md:block">
        {list}
      </aside>

      {/* Map — explicit non-zero box so Leaflet never measures 0x0. */}
      <div className="relative min-h-[60vh] w-full min-w-0 flex-1 md:h-full md:min-h-[520px]">
        <div ref={elRef} className="absolute inset-0 z-0 h-full w-full" />


        {/* Custom top-right controls */}
        <div className="absolute right-3 top-3 z-[600] flex flex-col items-end gap-2">
          <button
            type="button"
            onClick={toggleFullscreen}
            aria-label="Toggle fullscreen"
            className="grid h-10 w-10 place-items-center rounded-xl border border-[#e5e5e5] bg-white text-[#222] shadow-[0_2px_8px_rgba(0,0,0,0.15)] hover:bg-neutral-50"
          >
            <svg viewBox="0 0 24 24" className="h-4 w-4" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round">
              <path d="M8 3H5a2 2 0 0 0-2 2v3M16 3h3a2 2 0 0 1 2 2v3M8 21H5a2 2 0 0 1-2-2v-3M16 21h3a2 2 0 0 0 2-2v-3" />
            </svg>
          </button>
          <div className="overflow-hidden rounded-xl border border-[#e5e5e5] bg-white shadow-[0_2px_8px_rgba(0,0,0,0.15)]">
            <button
              type="button"
              aria-label="Zoom in"
              onClick={() => mapRef.current?.zoomIn()}
              className="grid h-10 w-10 place-items-center text-lg font-semibold text-[#222] hover:bg-neutral-50"
            >
              +
            </button>
            <div className="h-px bg-[#e5e5e5]" />
            <button
              type="button"
              aria-label="Zoom out"
              onClick={() => mapRef.current?.zoomOut()}
              className="grid h-10 w-10 place-items-center text-lg font-semibold text-[#222] hover:bg-neutral-50"
            >
              −
            </button>
          </div>
        </div>

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
    <p className="px-4 py-2 text-xs text-muted-foreground">
      Map shows approximate areas. Exact address is shared by the host after you connect.
    </p>
    </div>
  );
}
