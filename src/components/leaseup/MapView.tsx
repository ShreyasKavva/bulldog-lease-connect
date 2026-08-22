import { useEffect, useRef } from "react";
import type LType from "leaflet";
import type { Listing } from "@/lib/leaseup/types";
import { UGA_CENTER } from "@/lib/leaseup/constants";
import { BASEMAP_URL, BASEMAP_OPTIONS } from "@/lib/leaseup/map-tiles";

export function MapView({ listings, onSelect }: { listings: Listing[]; onSelect: (l: Listing) => void }) {
  const ref = useRef<HTMLDivElement>(null);
  const mapRef = useRef<LType.Map | null>(null);
  const Lref = useRef<typeof LType | null>(null);
  const listingsRef = useRef(listings);
  const selectRef = useRef(onSelect);
  listingsRef.current = listings;
  selectRef.current = onSelect;

  useEffect(() => {
    let cancelled = false;
    (async () => {
      const L = (await import("leaflet")).default;
      if (cancelled || !ref.current || mapRef.current) return;
      Lref.current = L;
      const map = L.map(ref.current).setView(UGA_CENTER, 14);
      L.tileLayer(BASEMAP_URL, { ...BASEMAP_OPTIONS }).addTo(map);
      L.marker(UGA_CENTER, {
        icon: L.divIcon({
          className: "",
          html: `<div style="width:18px;height:18px;background:#16A34A;border:3px solid white;border-radius:50%;box-shadow:0 2px 6px rgba(0,0,0,.3)"></div>`,
          iconSize: [18, 18], iconAnchor: [9, 9],
        }),
      }).addTo(map).bindPopup("UGA Campus");
      mapRef.current = map;
      renderPins();
    })();
    return () => { cancelled = true; mapRef.current?.remove(); mapRef.current = null; };
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, []);

  const pinsLayerRef = useRef<LType.LayerGroup | null>(null);
  function renderPins() {
    const L = Lref.current; const map = mapRef.current;
    if (!L || !map) return;
    pinsLayerRef.current?.remove();
    const layer = L.layerGroup().addTo(map);
    pinsLayerRef.current = layer;
    listingsRef.current.forEach((l) => {
      if (l.lat == null || l.lng == null) return;
      const icon = L.divIcon({
        className: "",
        html: `<div class="price-pin ${l.type === "transfer" ? "transfer" : ""}">$${l.price}</div>`,
        iconSize: [50, 24], iconAnchor: [25, 12],
      });
      const m = L.marker([l.lat, l.lng], { icon }).addTo(layer);
      m.bindPopup(`<div style="font-weight:700">${l.title}</div><div style="font-size:11px;color:#65676B">${l.area ?? ""}</div>`);
      m.on("click", () => selectRef.current(l));
    });
  }

  useEffect(() => { renderPins(); }, [listings]);

  return <div ref={ref} className="h-[calc(100vh-180px)] w-full rounded-xl overflow-hidden border" />;
}
