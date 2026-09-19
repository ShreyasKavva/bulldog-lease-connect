/**
 * Q175 — semester label derived strictly from a listing's own date range so a
 * badge can never contradict the dates printed next to it.
 *
 *   starts Jan–Feb, ends Apr–Jun          → Spring
 *   starts May–Jun, ends Jul–Aug          → Summer
 *   starts Jul–Sep, ends Nov–Jan          → Fall
 *   spans ~8+ months                      → Full year
 *   anything else                         → no badge (null)
 */
export function leaseTermLabel(
  fromIso: string | null | undefined,
  toIso: string | null | undefined,
): string | null {
  if (!fromIso || !toIso) return null;
  const from = new Date(fromIso);
  const to = new Date(toIso);
  if (Number.isNaN(from.getTime()) || Number.isNaN(to.getTime())) return null;
  if (to.getTime() <= from.getTime()) return null;

  const months =
    (to.getFullYear() - from.getFullYear()) * 12 + (to.getMonth() - from.getMonth());
  if (months >= 8) return "📅 Full year";

  const s = from.getMonth(); // 0-indexed
  const e = to.getMonth();

  if (s <= 1 && e >= 3 && e <= 5) return "☀️ Spring semester";
  if (s >= 4 && s <= 5 && e >= 6 && e <= 7) return "🌞 Summer";
  if (s >= 6 && s <= 8 && (e >= 10 || e === 0)) return "🍂 Fall semester";
  return null;
}
