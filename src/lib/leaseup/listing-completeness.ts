/**
 * Q158 — listing completeness score shown on the host dashboard.
 * Pure presentation math: 100 points across the fields that matter most.
 */
export type CompletenessInput = {
  title?: string | null;
  description?: string | null;
  price?: number | null;
  photos?: string[] | null;
  photo_urls?: string[] | null;
  campus_id?: string | null;
  available_from?: string | null;
  available_to?: string | null;
  roommate_prefs?: unknown;
};

function hasPrefs(prefs: unknown): boolean {
  if (!prefs || typeof prefs !== "object") return false;
  return Object.values(prefs as Record<string, unknown>).some((v) =>
    Array.isArray(v) ? v.length > 0 : v !== null && v !== undefined && v !== "",
  );
}

export function listingCompleteness(l: CompletenessInput): number {
  const photos = (l.photo_urls?.length ? l.photo_urls : l.photos) ?? [];
  let pct = 0;
  if ((l.title ?? "").trim().length > 0) pct += 10;
  if ((l.description ?? "").trim().length >= 50) pct += 15;
  if ((l.price ?? 0) > 0) pct += 10;
  if (photos.length >= 3) pct += 20;
  if (l.campus_id) pct += 10;
  if (l.available_from) pct += 10;
  if (l.available_to) pct += 10;
  if (hasPrefs(l.roommate_prefs)) pct += 15;
  return Math.min(pct, 100);
}

export function completenessStyle(pct: number): { label: string; className: string } {
  if (pct >= 80)
    return { label: `✅ ${pct}% complete`, className: "bg-green-50 text-green-700" };
  if (pct >= 50)
    return { label: `⚠️ ${pct}% complete`, className: "bg-amber-50 text-amber-700" };
  return { label: `📝 ${pct}% complete — add more details`, className: "bg-red-50 text-red-600" };
}
