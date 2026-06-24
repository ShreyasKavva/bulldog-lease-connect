import { useEffect, useRef } from "react";
import L from "leaflet";
import "leaflet/dist/leaflet.css";
import type { Listing } from "@/lib/leaseup/types";
import { UGA_CENTER } from "@/lib/leaseup/constants";

export function MapView({ listings, onSelect }: { listings: Listing[]; onSelect: (l: Listing) => void }) {
  const ref = useRef<HTMLDivElement>(null);
  const mapRef = useRef<L.Map | null>(null);

  useEffect(() => {
    if (!ref.current || mapRef.current) return;
    const map = L.map(ref.current).setView(UGA_CENTER, 14);
    L.tileLayer("https://{s}.tile.openstreetmap.org/{z}/{x}/{y}.png", {
      attribution: "© OpenStreetMap", maxZoom: 19,
    }).addTo(map);
    L.marker(UGA_CENTER, {
      icon: L.divIcon({
        className: "", html: `<div style="width:18px;height:18px;background:#16A34A;border:3px solid white;border-radius:50%;box-shadow:0 2px 6px rgba(0,0,0,.3)"></div>`,
        iconSize: [18, 18], iconAnchor: [9, 9],
      }),
    }).addTo(map).bindPopup("UGA Campus");
    mapRef.current = map;
    return () => { map.remove(); mapRef.current = null; };
  }, []);

  useEffect(() => {
    const map = mapRef.current;
    if (!map) return;
    const layer = L.layerGroup().addTo(map);
    listings.forEach((l) => {
      if (l.lat == null || l.lng == null) return;
      const icon = L.divIcon({
        className: "",
        html: `<div class="price-pin ${l.type === "transfer" ? "transfer" : ""}">$${l.price}</div>`,
        iconSize: [50, 24], iconAnchor: [25, 12],
      });
      const m = L.marker([l.lat, l.lng], { icon }).addTo(layer);
      m.bindPopup(`<div style="font-weight:700">${l.title}</div><div style="font-size:11px;color:#65676B">${l.area ?? ""}</div>`);
      m.on("click", () => onSelect(l));
    });
    return () => { layer.remove(); };
  }, [listings, onSelect]);

  return <div ref={ref} className="h-[calc(100vh-180px)] w-full rounded-xl overflow-hidden border" />;
}
