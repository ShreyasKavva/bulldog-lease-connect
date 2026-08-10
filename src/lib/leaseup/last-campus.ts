/**
 * Q148 — remembers the last campus a guest showed interest in (campus pill
 * click or campus landing page visit) so the homepage can personalise itself
 * without requiring a login.
 */
import { useEffect, useState } from "react";

export const LAST_CAMPUS_KEY = "leasup_last_campus";

export function getLastCampusSlug(): string | null {
  if (typeof window === "undefined") return null;
  try {
    return window.localStorage.getItem(LAST_CAMPUS_KEY);
  } catch {
    return null;
  }
}

export function setLastCampusSlug(slug: string | null | undefined) {
  if (typeof window === "undefined" || !slug) return;
  try {
    window.localStorage.setItem(LAST_CAMPUS_KEY, slug);
  } catch {
    /* storage blocked — personalisation is best-effort */
  }
}

/** SSR-safe read: always null on the server, hydrates after mount. */
export function useLastCampusSlug(): string | null {
  const [slug, setSlug] = useState<string | null>(null);
  useEffect(() => {
    setSlug(getLastCampusSlug());
  }, []);
  return slug;
}
