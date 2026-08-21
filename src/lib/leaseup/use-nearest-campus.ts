/**
 * Q177 — "near you" fallback.
 *
 * First-time visitors have no saved campus and no recently-viewed listings, so
 * the homepage has nothing personal to show. This hook asks the browser for a
 * coarse location (once, cached in localStorage) and resolves the closest
 * campus we actually have listings for.
 *
 * Everything is best-effort: if the user denies permission, or geolocation is
 * unavailable, the hook simply returns null and callers fall back to their
 * existing behaviour.
 */
import { useEffect, useState } from "react";
import type { Campus } from "./campuses";

const KEY = "leasup_geo_campus";

type Cached = { campusId: string; at: number };

/** Great-circle distance in km. */
function distanceKm(aLat: number, aLng: number, bLat: number, bLng: number) {
  const R = 6371;
  const dLat = ((bLat - aLat) * Math.PI) / 180;
  const dLng = ((bLng - aLng) * Math.PI) / 180;
  const la1 = (aLat * Math.PI) / 180;
  const la2 = (bLat * Math.PI) / 180;
  const h =
    Math.sin(dLat / 2) ** 2 + Math.cos(la1) * Math.cos(la2) * Math.sin(dLng / 2) ** 2;
  return 2 * R * Math.asin(Math.sqrt(h));
}

export function nearestCampus(
  campuses: Campus[],
  lat: number,
  lng: number,
): Campus | null {
  let best: Campus | null = null;
  let bestD = Infinity;
  for (const c of campuses) {
    if (c.lat == null || c.lng == null) continue;
    const d = distanceKm(lat, lng, c.lat, c.lng);
    if (d < bestD) { bestD = d; best = c; }
  }
  return best;
}

/**
 * Returns the campus closest to the visitor, or null while unknown.
 * `enabled` should be false whenever we already know the user's campus — we
 * never want to prompt for location if we don't need it.
 */
export function useNearestCampus(campuses: Campus[], enabled = true): Campus | null {
  const [campusId, setCampusId] = useState<string | null>(null);

  useEffect(() => {
    if (!enabled || campuses.length === 0 || typeof window === "undefined") return;

    // Cached answer (30 days) — never re-prompts.
    try {
      const raw = window.localStorage.getItem(KEY);
      if (raw) {
        const cached = JSON.parse(raw) as Cached;
        if (cached?.campusId && Date.now() - cached.at < 30 * 864e5) {
          setCampusId(cached.campusId);
          return;
        }
      }
    } catch { /* ignore malformed cache */ }

    if (!("geolocation" in navigator)) return;

    let cancelled = false;
    navigator.geolocation.getCurrentPosition(
      (pos) => {
        if (cancelled) return;
        const c = nearestCampus(campuses, pos.coords.latitude, pos.coords.longitude);
        if (!c) return;
        setCampusId(c.id);
        try {
          window.localStorage.setItem(KEY, JSON.stringify({ campusId: c.id, at: Date.now() } satisfies Cached));
        } catch { /* storage full or blocked */ }
      },
      () => { /* denied or unavailable — stay null */ },
      { enableHighAccuracy: false, timeout: 8000, maximumAge: 864e5 },
    );
    return () => { cancelled = true; };
  }, [campuses, enabled]);

  return campuses.find((c) => c.id === campusId) ?? null;
}
