/**
 * Q149 — "Recently viewed" memory. Stores up to 5 listing ids (newest first)
 * in localStorage so the homepage can offer a re-entry point without login.
 */
import { useEffect, useState } from "react";

export const RECENT_VIEWS_KEY = "leasup_recent_views";
const MAX_RECENT = 5;

export function getRecentViews(): string[] {
  if (typeof window === "undefined") return [];
  try {
    const raw = window.localStorage.getItem(RECENT_VIEWS_KEY);
    const parsed = raw ? JSON.parse(raw) : [];
    return Array.isArray(parsed) ? parsed.filter((v) => typeof v === "string").slice(0, MAX_RECENT) : [];
  } catch {
    return [];
  }
}

export function pushRecentView(id: string | null | undefined) {
  if (typeof window === "undefined" || !id) return;
  try {
    const next = [id, ...getRecentViews().filter((v) => v !== id)].slice(0, MAX_RECENT);
    window.localStorage.setItem(RECENT_VIEWS_KEY, JSON.stringify(next));
  } catch {
    /* storage blocked — best effort */
  }
}

/** SSR-safe read: empty on the server, hydrates after mount. */
export function useRecentViews(): string[] {
  const [ids, setIds] = useState<string[]>([]);
  useEffect(() => {
    setIds(getRecentViews());
  }, []);
  return ids;
}
