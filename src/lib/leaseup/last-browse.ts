/**
 * Q448 — remembers the exact /browse state (filters, campus, sort, view, page)
 * a visitor last had, so a listing page reached with no in-app history can send
 * them back to that state instead of a bare /browse.
 *
 * sessionStorage only: it is per-tab and disappears with the session, which is
 * the right lifetime for "where I was a moment ago".
 */
const KEY = "leasup_last_browse";

export function saveLastBrowse(search: string) {
  if (typeof window === "undefined") return;
  try {
    window.sessionStorage.setItem(KEY, search.startsWith("?") ? search.slice(1) : search);
  } catch {
    /* private mode — remembering is a nicety, never a hard requirement */
  }
}

/** Returns the remembered /browse search params, or null when there is none. */
export function getLastBrowse(): Record<string, string> | null {
  if (typeof window === "undefined") return null;
  let raw: string | null = null;
  try {
    raw = window.sessionStorage.getItem(KEY);
  } catch {
    return null;
  }
  if (!raw) return null;
  const out: Record<string, string> = {};
  for (const [k, v] of new URLSearchParams(raw)) out[k] = v;
  return Object.keys(out).length ? out : null;
}
