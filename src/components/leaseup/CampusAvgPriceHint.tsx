/**
 * Q156 — live "average sublease at this campus" helper shown under the price input.
 * Silently renders nothing when there's no campus, no data, or the query fails.
 */
import { useQuery } from "@tanstack/react-query";
import { supabase } from "@/integrations/supabase/client";

export function CampusAvgPriceHint({
  campusId,
  campusName,
}: {
  campusId: string | null | undefined;
  campusName?: string | null;
}) {
  const { data, isLoading } = useQuery({
    queryKey: ["campus-avg-price", campusId],
    enabled: !!campusId,
    staleTime: 300_000,
    queryFn: async () => {
      const { data, error } = await supabase
        .from("listings")
        .select("price, campuses(name)")
        .eq("campus_id", campusId!)
        .eq("is_active", true)
        .limit(500);
      if (error) throw error;
      const rows = (data ?? []) as Array<{ price: number; campuses?: { name?: string } | null }>;
      if (rows.length === 0) return null;
      const avg = Math.round(rows.reduce((s, r) => s + (r.price ?? 0), 0) / rows.length);
      return { avg, name: rows[0]?.campuses?.name ?? null };
    },
  });

  if (!campusId) return null;
  if (isLoading) {
    return <div className="mt-1 h-6 w-56 animate-pulse rounded bg-muted" aria-hidden />;
  }
  if (!data?.avg) return null;

  const name = campusName || data.name || "this campus";
  return (
    <p className="mt-1 rounded border border-amber-100 bg-amber-50 px-2 py-1 text-xs text-amber-700">
      💡 Average sublease at {name}: ${data.avg}/mo
    </p>
  );
}
