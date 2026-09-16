/**
 * Q161 — inline "vs campus average" pill shown next to a listing's price.
 * Renders nothing when there aren't at least 3 other active listings to
 * compare against, or when the query fails.
 */
import { useQuery } from "@tanstack/react-query";
import { supabase } from "@/integrations/supabase/client";

const MIN_SAMPLE = 3;

async function fetchPeerAverage(campusId: string, excludeId: string): Promise<number | null> {
  const { data, error } = await supabase
    .from("listings")
    .select("price")
    .eq("campus_id", campusId)
    .eq("is_active", true)
    .eq("status", "active")
    .neq("id", excludeId)
    .limit(500);
  if (error || !data) return null;
  const prices = data
    .map((r) => Number(r?.price))
    .filter((p) => Number.isFinite(p) && p > 0);
  if (prices.length < MIN_SAMPLE) return null;
  return prices.reduce((a, b) => a + b, 0) / prices.length;
}

export function PriceContextBadge({
  price,
  campusId,
  listingId,
}: {
  price: number;
  campusId?: string | null;
  listingId?: string | null;
}) {
  const { data: avg, isLoading } = useQuery({
    queryKey: ["price-context-avg", campusId, listingId],
    enabled: !!campusId && !!listingId,
    staleTime: 5 * 60 * 1000,
    retry: false,
    queryFn: () => fetchPeerAverage(campusId!, listingId!).catch(() => null),
  });

  if (!campusId || !listingId) return null;
  if (isLoading) {
    return (
      <span
        className="ml-2 inline-flex h-5 w-32 animate-pulse rounded-full bg-muted align-middle"
        aria-hidden
      />
    );
  }
  if (!avg || !Number.isFinite(avg) || avg <= 0 || !Number.isFinite(price) || price <= 0) return null;

  const pctDiff = ((price - avg) / avg) * 100;
  const base = "text-xs px-2 py-0.5 rounded-full inline-flex items-center gap-1 ml-2 font-semibold";

  if (pctDiff <= -10) {
    return (
      <span className={`${base} bg-green-100 text-green-700`}>
        💰 {Math.abs(pctDiff).toFixed(0)}% below campus avg
      </span>
    );
  }
  if (pctDiff >= 10) {
    return (
      <span className={`${base} bg-gray-100 text-gray-600`}>
        ↑ {pctDiff.toFixed(0)}% above campus avg
      </span>
    );
  }
  return (
    <span className={`${base} bg-teal-50 text-teal-600`}>
      ≈ Near campus avg (${Math.round(avg).toLocaleString("en-US")}/mo)
    </span>
  );
}
