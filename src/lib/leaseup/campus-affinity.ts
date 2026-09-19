/**
 * Q280 — campus affinity.
 *
 * Every listing a visitor opens votes for its campus. Once a clear favourite
 * emerges (enough views, and a real majority of recent views) the homepage
 * rails switch to that campus instead of the profile/geo one — so someone who
 * keeps browsing Georgia Tech gets Georgia Tech recommendations even if their
 * profile says otherwise.
 *
 * Purely client-side and best-effort: storage blocked → no affinity, callers
 * fall back to profile campus, then browser location.
 */
import { useEffect, useState } from "react";

export const CAMPUS_AFFINITY_KEY = "leasup_campus_affinity";
/** Only the most recent N views count — interest moves. */
const WINDOW = 12;
/** Below this many views we don't claim to know anything. */
const MIN_VIEWS = 4;
/** Share of the window the leader must hold. */
const MIN_SHARE = 0.5;

function read(): string[] {
  if (typeof window === "undefined") return [];
  try {
    const raw = window.localStorage.getItem(CAMPUS_AFFINITY_KEY);
    const parsed = raw ? JSON.parse(raw) : [];
    return Array.isArray(parsed)
      ? parsed.filter((v) => typeof v === "string").slice(0, WINDOW)
      : [];
  } catch {
    return [];
  }
}

/** Record that the visitor opened a listing at this campus. */
export function pushCampusView(campusId: string | null | undefined) {
  if (typeof window === "undefined" || !campusId) return;
  try {
    const next = [campusId, ...read()].slice(0, WINDOW);
    window.localStorage.setItem(CAMPUS_AFFINITY_KEY, JSON.stringify(next));
  } catch {
    /* storage blocked — recommendations stay on the profile campus */
  }
}

/** The dominant campus in the recent view window, or null when unclear. */
export function getAffinityCampusId(): string | null {
  const views = read();
  if (views.length < MIN_VIEWS) return null;
  const counts = new Map<string, number>();
  for (const id of views) counts.set(id, (counts.get(id) ?? 0) + 1);
  let best: string | null = null;
  let bestN = 0;
  for (const [id, n] of counts) if (n > bestN) { best = id; bestN = n; }
  return bestN / views.length >= MIN_SHARE ? best : null;
}

/** SSR-safe read: null on the server, hydrates after mount. */
export function useAffinityCampusId(): string | null {
  const [id, setId] = useState<string | null>(null);
  useEffect(() => {
    setId(getAffinityCampusId());
  }, []);
  return id;
}
