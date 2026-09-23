/**
 * Q101 Part A — "Great price" badge.
 *
 * Compares a listing's price against the average price of ACTIVE listings on
 * the same campus. The average is fetched once per campus per session
 * (react-query, Infinity staleTime) so a grid of 40 cards makes one request.
 *
 * Rules:
 *   <= 80% of campus avg → "Great price" (solid green)
 *   anything above       → no badge (we never show negative signals)
 *   < 3 listings on the campus, or any error → no badge (fails silently)
 */
import { useQuery } from "@tanstack/react-query";
import { supabase } from "@/integrations/supabase/client";
import { cn } from "@/lib/utils";

const MIN_SAMPLE = 3;

/**
 * Q467 — one request for the whole page instead of one per campus.
 * Previously each distinct campus on screen fired its own prices query; a
 * mixed grid meant N round trips. Now every active listing's (campus, price)
 * pair is fetched once, cached for the session, and averaged in the browser.
 * The inputs and the MIN_SAMPLE rule are identical, so the badge shows on
 * exactly the same listings as before.
 */
async function fetchCampusAverages(): Promise<Record<string, number>> {
  const { data, error } = await supabase
    .from("listings")
    .select("campus_id, price")
    .eq("is_active", true)
    .eq("status", "active")
    .limit(2000);
  if (error || !data) return {};
  const sums: Record<string, { total: number; n: number }> = {};
  for (const row of data) {
    const id = (row as { campus_id: string | null }).campus_id;
    const price = Number((row as { price: number | null }).price);
    if (!id || !Number.isFinite(price) || price <= 0) continue;
    const bucket = (sums[id] ??= { total: 0, n: 0 });
    bucket.total += price;
    bucket.n += 1;
  }
  const averages: Record<string, number> = {};
  for (const [id, { total, n }] of Object.entries(sums)) {
    if (n >= MIN_SAMPLE) averages[id] = total / n;
  }
  return averages;
}

/** Cached once for the whole session. Never throws. */
export function useCampusAverage(campusId: string | null | undefined) {
  const query = useQuery({
    queryKey: ["campus-avg-prices"],
    enabled: !!campusId,
    staleTime: Infinity,
    gcTime: Infinity,
    retry: false,
    queryFn: () => fetchCampusAverages().catch(() => ({} as Record<string, number>)),
  });
  return { ...query, data: campusId ? query.data?.[campusId] ?? null : null };
}

export type PriceTier = { label: string; tone: "great" } | null;

export function priceTier(price: number, avg: number | null | undefined): PriceTier {
  if (!avg || !Number.isFinite(avg) || avg <= 0 || !Number.isFinite(price) || price <= 0) return null;
  const ratio = price / avg;
  if (ratio <= 0.8) return { label: "Great price", tone: "great" };
  return null;
}

export function PriceBadgePill({
  tier,
  className,
}: {
  tier: NonNullable<PriceTier>;
  className?: string;
}) {
  return (
    <span
      className={cn("rounded-full bg-green-500 px-2 py-0.5 text-xs font-semibold text-white", className)}
    >
      {tier.label}
    </span>
  );
}

/** Badge for a listing card — absolutely positioned bottom-left of the photo. */
export function CardPriceBadge({
  price,
  campusId,
  className,
}: {
  price: number;
  campusId: string | null | undefined;
  className?: string;
}) {
  const { data: avg } = useCampusAverage(campusId);
  const tier = priceTier(price, avg);
  if (!tier) return null;
  return (
    <PriceBadgePill
      tier={tier}
      className={cn("pointer-events-none absolute bottom-2 left-2 shadow-sm", className)}
    />
  );
}

/** Inline badge for the listing detail page, shown next to the price. */
export function InlinePriceBadge({
  price,
  campusId,
}: {
  price: number;
  campusId: string | null | undefined;
}) {
  const { data: avg } = useCampusAverage(campusId);
  const tier = priceTier(price, avg);
  if (!tier) return null;
  return <PriceBadgePill tier={tier} />;
}
