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

async function fetchCampusAverage(campusId: string): Promise<number | null> {
  const { data, error } = await supabase
    .from("listings")
    .select("price")
    .eq("campus_id", campusId)
    .eq("is_active", true)
    .eq("status", "active")
    .limit(500);
  if (error || !data || data.length < MIN_SAMPLE) return null;
  const prices = data.map((r) => Number(r.price)).filter((p) => Number.isFinite(p) && p > 0);
  if (prices.length < MIN_SAMPLE) return null;
  return prices.reduce((a, b) => a + b, 0) / prices.length;
}

/** Cached per campus for the whole session. Never throws. */
export function useCampusAverage(campusId: string | null | undefined) {
  return useQuery({
    queryKey: ["campus-avg-price", campusId],
    enabled: !!campusId,
    staleTime: Infinity,
    gcTime: Infinity,
    retry: false,
    queryFn: () => fetchCampusAverage(campusId!).catch(() => null),
  });
}

export type PriceTier = { label: string; tone: "great" | "below" } | null;

export function priceTier(price: number, avg: number | null | undefined): PriceTier {
  if (!avg || !Number.isFinite(avg) || avg <= 0 || !Number.isFinite(price) || price <= 0) return null;
  const ratio = price / avg;
  if (ratio <= 0.8) return { label: "Great price", tone: "great" };
  if (ratio <= 0.95) return { label: "Below avg", tone: "below" };
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
      className={cn(
        "rounded-full px-2 py-0.5 text-xs font-semibold",
        tier.tone === "great"
          ? "bg-green-500 text-white"
          : "bg-green-100 text-green-800 dark:bg-green-900/40 dark:text-green-300",
        className,
      )}
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
