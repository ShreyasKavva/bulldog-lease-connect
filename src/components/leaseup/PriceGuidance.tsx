import { useEffect, useState } from "react";
import { fetchCampusPriceStats, type PriceStats, computePriceLabel, LABEL_META } from "@/lib/leaseup/pricing";
import { cn } from "@/lib/utils";

/** Live "is this priced right?" feedback under the price input on Post a Listing. */
export function PriceGuidance({
  campusId, beds, price, onPickMedian,
}: {
  campusId: string | null | undefined;
  beds: number | null | undefined;
  price: number | null | undefined;
  onPickMedian?: (median: number) => void;
}) {
  const [stats, setStats] = useState<PriceStats | null>(null);
  const [loading, setLoading] = useState(false);

  useEffect(() => {
    if (!campusId || beds == null) { setStats(null); return; }
    let cancelled = false;
    setLoading(true);
    fetchCampusPriceStats(campusId, beds)
      .then((s) => { if (!cancelled) setStats(s); })
      .finally(() => { if (!cancelled) setLoading(false); });
    return () => { cancelled = true; };
  }, [campusId, beds]);

  if (loading) return <div className="text-xs text-muted-foreground">Loading market data…</div>;
  if (!stats || !stats.has_data) {
    return <div className="rounded-lg bg-background p-2 text-xs text-muted-foreground">Not enough comps yet to show a price range for this bed count.</div>;
  }

  const min = stats.min_price!;
  const max = stats.max_price!;
  const median = stats.median_price!;
  const p25 = stats.p25_price!;
  const p75 = stats.p75_price!;
  const range = Math.max(1, max - min);

  // Where the user's price sits, as %
  const pct = price ? Math.max(0, Math.min(100, ((price - min) / range) * 100)) : null;
  const medianPct = ((median - min) / range) * 100;

  // Pseudo-stat for label computation
  const fakeStat = { campus_id: "", beds: 0, listing_count: stats.listing_count!, min_price: min, p25_price: p25, median_price: median, avg_price: stats.avg_price!, p75_price: p75, max_price: max };
  const label = price ? computePriceLabel(price, fakeStat) : null;

  let msg = "";
  let tone = "text-muted-foreground";
  if (price != null && label) {
    if (label === "great_deal") { msg = "🔥 This is a great deal — expect lots of interest"; tone = "text-orange-600 font-bold"; }
    else if (label === "good_price") { msg = "✅ Competitive price — you'll get strong response"; tone = "text-success font-bold"; }
    else if (label === "fair_price") { msg = "≈ Fair market price for this area"; tone = "text-muted-foreground font-semibold"; }
    else if (label === "above_market") { msg = `⚠ Above market. Listings at or below the median get ~2× more messages.`; tone = "text-destructive font-bold"; }
  }

  return (
    <div className="space-y-2 rounded-lg border bg-background p-3 text-xs">
      <div className="flex items-center justify-between">
        <span className="font-bold uppercase text-muted-foreground">Campus range · {stats.listing_count} comps</span>
        {label && label !== "no_data" && (
          <span className={cn("rounded-full px-2 py-0.5 text-[10px] font-bold", LABEL_META[label].tone)}>
            {LABEL_META[label].icon} {LABEL_META[label].text}
          </span>
        )}
      </div>

      <div className="relative h-2 rounded-full bg-muted">
        {/* Median marker */}
        <div className="absolute -top-1 h-4 w-px bg-foreground/40" style={{ left: `${medianPct}%` }} />
        {/* User's price marker */}
        {pct != null && (
          <div
            className="absolute -top-1 h-4 w-4 -translate-x-1/2 rounded-full border-2 border-white bg-primary shadow"
            style={{ left: `${pct}%`, transition: "left 250ms ease-out" }}
          />
        )}
      </div>
      <div className="flex justify-between text-[10px] text-muted-foreground">
        <span>${min}</span>
        <span className="font-bold text-foreground">Median ${median}</span>
        <span>${max}</span>
      </div>

      {msg && <p className={cn("pt-1", tone)}>{msg}</p>}

      {price != null && label === "above_market" && onPickMedian && (
        <button
          type="button"
          onClick={() => onPickMedian(median)}
          className="mt-1 inline-flex items-center gap-1 rounded-full bg-primary-light px-3 py-1 text-[11px] font-bold text-primary-dark hover:bg-primary/15"
        >
          Try ${median} →
        </button>
      )}
    </div>
  );
}
