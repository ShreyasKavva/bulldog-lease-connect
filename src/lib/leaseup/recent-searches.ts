/**
 * Q164 — remembers the last 5 browse searches (filters + a human label) in
 * localStorage so the search bar can offer one-tap re-runs.
 */
export const RECENT_SEARCHES_KEY = "leasup_recent_searches";
const MAX = 5;

export type RecentSearch = {
  campus?: string;
  bedrooms?: string;
  maxPrice?: number;
  query?: string;
  movein?: string;
  label: string;
};

function keyOf(s: RecentSearch) {
  return [s.campus ?? "", s.bedrooms ?? "", s.maxPrice ?? "", s.query ?? "", s.movein ?? ""].join("|");
}

export function getRecentSearches(): RecentSearch[] {
  if (typeof window === "undefined") return [];
  try {
    const raw = window.localStorage.getItem(RECENT_SEARCHES_KEY);
    const parsed = raw ? JSON.parse(raw) : [];
    if (!Array.isArray(parsed)) return [];
    return parsed
      .filter((e): e is RecentSearch => !!e && typeof e === "object" && typeof e.label === "string")
      .slice(0, MAX);
  } catch {
    return [];
  }
}

export function pushRecentSearch(entry: RecentSearch): RecentSearch[] {
  if (typeof window === "undefined") return [];
  const current = getRecentSearches();
  if (!entry.label.trim()) return current;
  const next = [entry, ...current.filter((e) => keyOf(e) !== keyOf(entry))].slice(0, MAX);
  try {
    window.localStorage.setItem(RECENT_SEARCHES_KEY, JSON.stringify(next));
  } catch {
    /* storage blocked — best effort */
  }
  return next;
}

export function clearRecentSearches() {
  if (typeof window === "undefined") return;
  try {
    window.localStorage.removeItem(RECENT_SEARCHES_KEY);
  } catch {
    /* ignore */
  }
}
