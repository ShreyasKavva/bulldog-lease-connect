import { useQuery } from "@tanstack/react-query";
import { fetchAllPriceStats, findStat, computePriceLabel, LABEL_META, type PriceLabel } from "@/lib/leaseup/pricing";
import { cn } from "@/lib/utils";

export function usePriceStats() {
  return useQuery({
    queryKey: ["campus-price-stats"],
    queryFn: fetchAllPriceStats,
    staleTime: 5 * 60 * 1000,
  });
}

export function PriceLabelBadge({
  price, campusId, beds, size = "sm", label: explicitLabel,
}: {
  price: number;
  campusId?: string | null;
  beds?: number | null;
  size?: "xs" | "sm" | "md";
  label?: PriceLabel;
}) {
  const { data: stats } = usePriceStats();
  const label: PriceLabel = explicitLabel ?? computePriceLabel(price, findStat(stats, campusId, beds));
  if (label === "no_data") return null;
  const meta = LABEL_META[label];
  const sz = size === "xs" ? "px-1.5 py-0 text-[9px] gap-0.5" : size === "md" ? "px-2.5 py-1 text-xs gap-1" : "px-2 py-0.5 text-[10px] gap-0.5";
  return (
    <span className={cn("inline-flex items-center rounded-full font-bold whitespace-nowrap", sz, meta.tone)}>
      <span aria-hidden>{meta.icon}</span>
      <span>{meta.text}</span>
    </span>
  );
}
