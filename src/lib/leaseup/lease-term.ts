/**
 * Q155 — human-readable lease term derived from a listing's date range.
 * Returns null when there's no end date (nothing to summarize).
 */
export function leaseTermLabel(
  fromIso: string | null | undefined,
  toIso: string | null | undefined,
): string | null {
  if (!toIso) return null;
  const to = new Date(toIso);
  if (Number.isNaN(to.getTime())) return null;

  if (fromIso) {
    const from = new Date(fromIso);
    if (!Number.isNaN(from.getTime())) {
      const days = (to.getTime() - from.getTime()) / 86_400_000;
      if (days > 270) return "📅 Full year";
    }
  }

  const m = to.getMonth(); // 0-indexed
  if (m >= 4 && m <= 7) return "🌞 Summer";
  if (m >= 7 && m <= 11) return "🍂 Fall semester";
  if (m <= 3) return "❄️ Spring semester";
  return null;
}
