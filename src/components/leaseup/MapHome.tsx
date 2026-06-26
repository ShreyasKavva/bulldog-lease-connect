import { useEffect, useRef, useState } from "react";
import type LType from "leaflet";
import type { Listing } from "@/lib/leaseup/types";
import { UGA_CENTER, isNew } from "@/lib/leaseup/constants";
import { SafeScoreBadge } from "./SafeScoreBadge";
import { Eye, X, MessageCircle, ArrowRight, Bed, CalendarDays } from "lucide-react";
import { Button } from "@/components/ui/button";

export function MapHome({
  listings, center, onSelectListing, onMessageListing, hotThreshold,
}: {
  listings: Listing[];
  center: [number, number];
  onSelectListing: (l: Listing) => void;
  onMessageListing: (l: Listing) => void;
  hotThreshold?: number; // price threshold below which a listing is a "hot deal"
}) {
  const ref = useRef<HTMLDivElement>(null);
  const mapRef = useRef<LType.Map | null>(null);
  const Lref = useRef<typeof LType | null>(null);
  const pinsLayerRef = useRef<LType.LayerGroup | null>(null);
  const youRef = useRef<LType.LayerGroup | null>(null);
  const listingsRef = useRef(listings);
  const hotRef = useRef(hotThreshold);
  const selectedIdRef = useRef<string | null>(null);

  listingsRef.current = listings;
  hotRef.current = hotThreshold;

  const [preview, setPreview] = useState<Listing | null>(null);
  selectedIdRef.current = preview?.id ?? null;

  // init map
  useEffect(() => {
    let cancelled = false;
    (async () => {
      const L = (await import("leaflet")).default;
      if (cancelled || !ref.current || mapRef.current) return;
      Lref.current = L;
      const map = L.map(ref.current, { zoomControl: false, attributionControl: false }).setView(center, 15);
      L.tileLayer("https://{s}.basemaps.cartocdn.com/light_all/{z}/{x}/{y}{r}.png", {
        maxZoom: 19,
        subdomains: "abcd",
      }).addTo(map);
      L.control.zoom({ position: "topright" }).addTo(map);
      mapRef.current = map;
      renderPins();
      addYouMarker();
    })();
    return () => {
      cancelled = true;
      mapRef.current?.remove();
      mapRef.current = null;
    };
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, []);

  // recenter when campus center changes
  useEffect(() => {
    if (mapRef.current) mapRef.current.setView(center, 15);
  }, [center[0], center[1]]); // eslint-disable-line react-hooks/exhaustive-deps

  function addYouMarker() {
    if (!navigator.geolocation || !Lref.current || !mapRef.current) return;
    navigator.geolocation.getCurrentPosition(
      (pos) => {
        const L = Lref.current!;
        const map = mapRef.current!;
        youRef.current?.remove();
        const layer = L.layerGroup().addTo(map);
        youRef.current = layer;
        const { latitude, longitude } = pos.coords;
        L.circle([latitude, longitude], {
          radius: 800,
          color: "#2563EB",
          weight: 1,
          opacity: 0.4,
          fillColor: "#2563EB",
          fillOpacity: 0.08,
        }).addTo(layer);
        L.marker([latitude, longitude], {
          icon: L.divIcon({
            className: "",
            html: `<div style="position:relative;width:18px;height:18px;"><div style="position:absolute;inset:0;background:#2563EB;border:3px solid white;border-radius:50%;box-shadow:0 2px 6px rgba(37,99,235,.5)"></div><div style="position:absolute;inset:-6px;border-radius:50%;background:#2563EB;opacity:.25;animation:pulseDot 2s ease-out infinite"></div></div>`,
            iconSize: [18, 18],
            iconAnchor: [9, 9],
          }),
        }).addTo(layer);
      },
      () => { /* silent fallback to campus center */ },
      { timeout: 4000 },
    );
  }

  function pinHtml(l: Listing, selected: boolean) {
    const isHot = hotRef.current != null && l.price <= hotRef.current;
    const fresh = isNew(l.created_at);
    const bg = selected ? "#2563EB" : isHot ? "#EA580C" : "#FFFFFF";
    const fg = selected || isHot ? "#FFFFFF" : "#2563EB";
    const scale = selected ? "transform:scale(1.18);" : "";
    return `<div style="position:relative;${scale}transition:transform .18s cubic-bezier(.34,1.56,.64,1);">
      <div style="background:${bg};color:${fg};font-weight:800;font-size:13px;padding:5px 10px;border-radius:999px;box-shadow:0 2px 8px rgba(0,0,0,.18);white-space:nowrap;border:1px solid rgba(0,0,0,.06);font-family:-apple-system,BlinkMacSystemFont,sans-serif;">${isHot ? "🔥 " : ""}$${l.price}</div>
      <div style="position:absolute;left:50%;bottom:-4px;width:0;height:0;border-left:5px solid transparent;border-right:5px solid transparent;border-top:6px solid ${bg};transform:translateX(-50%);"></div>
      ${fresh ? `<div style="position:absolute;top:-3px;right:-3px;width:8px;height:8px;background:#2563EB;border:1.5px solid white;border-radius:50%;"></div>` : ""}
    </div>`;
  }

  function renderPins() {
    const L = Lref.current; const map = mapRef.current;
    if (!L || !map) return;
    pinsLayerRef.current?.remove();
    const layer = L.layerGroup().addTo(map);
    pinsLayerRef.current = layer;
    const selectedId = selectedIdRef.current;
    listingsRef.current.forEach((l) => {
      if (l.lat == null || l.lng == null) return;
      const sel = selectedId === l.id;
      const m = L.marker([l.lat, l.lng], {
        icon: L.divIcon({
          className: "",
          html: pinHtml(l, sel),
          iconSize: [60, 28],
          iconAnchor: [30, 28],
        }),
        zIndexOffset: sel ? 1000 : 0,
      }).addTo(layer);
      m.on("click", () => setPreview(l));
    });
  }

  // re-render pins when listings or selection changes
  useEffect(() => { renderPins(); }, [listings, preview]); // eslint-disable-line react-hooks/exhaustive-deps

  function closePreview() { setPreview(null); }

  // Tap on map (anywhere not a pin) closes preview
  useEffect(() => {
    const map = mapRef.current; if (!map) return;
    const handler = () => setPreview(null);
    map.on("click", handler);
    return () => { map.off("click", handler); };
  }, []);

  return (
    <div className="relative h-[100dvh] w-full overflow-hidden bg-background">
      <div ref={ref} className="absolute inset-0" />
      <style>{`@keyframes pulseDot { 0% { transform: scale(.8); opacity: .6 } 100% { transform: scale(2.2); opacity: 0 } }`}</style>

      {/* Preview card */}
      {preview && (
        <div className="pointer-events-auto absolute inset-x-0 bottom-16 z-30 px-3 pb-3 md:bottom-3">
          <div className="mx-auto max-w-md rounded-2xl bg-surface p-3 shadow-card-lg">
            <div className="flex items-start gap-3">
              {preview.photo_urls?.[0] ? (
                <img src={preview.photo_urls[0]} alt={preview.title} className="h-20 w-20 shrink-0 rounded-xl object-cover" />
              ) : (
                <div className="grid h-20 w-20 shrink-0 place-items-center rounded-xl bg-muted text-3xl">🏠</div>
              )}
              <div className="min-w-0 flex-1">
                <div className="flex items-start justify-between gap-2">
                  <div className="min-w-0">
                    <div className="text-lg font-extrabold leading-tight">
                      ${preview.price.toLocaleString()}<span className="text-xs font-medium text-muted-foreground">/mo</span>
                    </div>
                    <div className="truncate text-sm font-bold">{preview.title}</div>
                  </div>
                  <button onClick={closePreview} aria-label="Close" className="grid h-7 w-7 shrink-0 place-items-center rounded-full bg-background text-muted-foreground hover:bg-border">
                    <X className="h-4 w-4" />
                  </button>
                </div>
                <div className="mt-1 flex items-center gap-3 text-xs text-muted-foreground">
                  <span className="inline-flex items-center gap-1"><Bed className="h-3 w-3" />{preview.beds} bd · {Number(preview.baths)} ba</span>
                  {preview.available_from && (
                    <span className="inline-flex items-center gap-1"><CalendarDays className="h-3 w-3" />{new Date(preview.available_from).toLocaleDateString(undefined, { month: "short", day: "numeric" })}</span>
                  )}
                </div>
                <div className="mt-1.5 flex flex-wrap items-center gap-1.5">
                  <SafeScoreBadge score={preview.safe_score} />
                  {(preview.view_count ?? 0) > 0 && (
                    <span className="inline-flex items-center gap-1 text-[11px] font-semibold text-muted-foreground">
                      <Eye className="h-3 w-3" />{preview.view_count} views
                    </span>
                  )}
                </div>
              </div>
            </div>
            <div className="mt-3 flex gap-2">
              <Button
                onClick={() => onMessageListing(preview)}
                className="flex-1 gap-1 bg-success hover:bg-success/90 text-success-foreground font-bold"
              >
                <MessageCircle className="h-4 w-4" />Message
              </Button>
              <Button
                onClick={() => { onSelectListing(preview); closePreview(); }}
                className="flex-1 gap-1 bg-primary hover:bg-primary-dark text-primary-foreground font-bold"
              >
                View Details<ArrowRight className="h-4 w-4" />
              </Button>
            </div>
          </div>
        </div>
      )}
    </div>
  );
}

export const DEFAULT_CENTER = UGA_CENTER;
