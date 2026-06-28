import { useEffect, useState } from "react";
import { fetchCampusPriceStats, type PriceStats, computePriceLabel } from "@/lib/leaseup/pricing";
import { PriceLabelBadge } from "./PriceLabelBadge";

/** Detailed comparison bar shown in ListingDetailSheet. */
export function PriceComparisonPanel({
  price, campusId, beds,
}: {
  price: number;
  campusId: string | null;
  beds: number;
}) {
  const [stats, setStats] = useState<PriceStats | null>(null);
  useEffect(() => {
    if (!campusId) return;
    fetchCampusPriceStats(campusId, beds).then(setStats);
  }, [campusId, beds]);

  if (!stats) return null;
  if (!stats.has_data) {
    return (
      <div className="rounded-xl border bg-background p-3 text-xs text-muted-foreground">
        Not enough data to compare — fewer than 3 similar listings on campus right now.
      </div>
    );
  }

  const { min_price: min, max_price: max, median_price: median, p25_price: p25, p75_price: p75, listing_count } = stats as Required<PriceStats>;
  const range = Math.max(1, max - min);
  const pct = Math.max(0, Math.min(100, ((price - min) / range) * 100));
  const medianPct = ((median - min) / range) * 100;
  const fakeStat = { campus_id: "", beds: 0, listing_count, min_price: min, p25_price: p25, median_price: median, avg_price: stats.avg_price!, p75_price: p75, max_price: max };
  const label = computePriceLabel(price, fakeStat);
  const diffPct = Math.round(((price - median) / median) * 100);
  // percentile = % of comps strictly cheaper than this price (approx via linear interp between known quartiles)
  const percentile = price <= min ? 0
    : price >= max ? 100
    : price <= p25 ? (price - min) / Math.max(1, p25 - min) * 25
    : price <= median ? 25 + (price - p25) / Math.max(1, median - p25) * 25
    : price <= p75 ? 50 + (price - median) / Math.max(1, p75 - median) * 25
    : 75 + (price - p75) / Math.max(1, max - p75) * 25;

  let copy = "";
  if (label === "great_deal") copy = `🔥 This listing is ${Math.abs(diffPct)}% below the median — a great deal.`;
  else if (label === "good_price") copy = `✅ ${diffPct === 0 ? "At" : `${Math.abs(diffPct)}% below`} the median — a competitive price.`;
  else if (label === "fair_price") copy = `≈ ${diffPct > 0 ? `${diffPct}% above` : "around"} the median — within the fair range.`;
  else copy = `⚠ ${diffPct}% above the median — above market for this bed count.`;

  return (
    <div className="rounded-xl border bg-background p-3 text-xs space-y-2">
      <div className="flex items-center justify-between">
        <span className="font-bold uppercase text-muted-foreground">📊 Price analysis · {listing_count} comps</span>
        <PriceLabelBadge price={price} campusId={campusId} beds={beds} label={label} />
      </div>

      <div className="relative h-2 rounded-full bg-muted">
        <div className="absolute inset-y-0 rounded-full bg-success/30" style={{ left: `${(p25 - min) / range * 100}%`, right: `${100 - (p75 - min) / range * 100}%` }} />
        <div className="absolute -top-1 h-4 w-px bg-foreground/40" style={{ left: `${medianPct}%` }} />
        <div className="absolute -top-1 h-4 w-4 -translate-x-1/2 rounded-full border-2 border-white bg-primary shadow" style={{ left: `${pct}%`, transition: "left 600ms ease-out" }} />
      </div>
      <div className="flex justify-between text-[10px] text-muted-foreground">
        <span>${min}</span>
        <span>Median ${median}</span>
        <span>${max}</span>
      </div>

      <div className="text-[11px] text-muted-foreground">
        Top {Math.round(percentile)}% most affordable {beds}BR listings — last 90 days.
      </div>
      <p className="pt-1 text-foreground font-semibold">{copy}</p>
    </div>
  );
}
