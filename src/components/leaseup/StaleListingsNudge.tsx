import { useEffect, useState } from "react";
import { fetchStaleListings } from "@/lib/leaseup/pricing";
import { TrendingDown } from "lucide-react";

export function StaleListingsNudge({ userId, onEdit }: { userId: string; onEdit?: (listingId: string) => void }) {
  const [items, setItems] = useState<Awaited<ReturnType<typeof fetchStaleListings>>>([]);
  useEffect(() => {
    fetchStaleListings(userId).then(setItems).catch(() => setItems([]));
  }, [userId]);
  if (items.length === 0) return null;
  return (
    <div className="space-y-2">
      {items.map((it) => (
        <div key={it.listing_id} className="flex items-start gap-3 rounded-2xl border border-orange-200 bg-orange-50 p-3 dark:border-orange-900/50 dark:bg-orange-950/30">
          <TrendingDown className="mt-0.5 h-5 w-5 text-orange-600" />
          <div className="flex-1 text-sm">
            <div className="font-bold text-orange-900 dark:text-orange-200">📉 No messages yet after {it.days_active} days — "{it.title}"</div>
            <p className="mt-0.5 text-xs text-orange-800 dark:text-orange-300">
              Similar {it.beds}BR listings around <span className="font-bold">${Math.round(Number(it.median_price))}/mo</span> get more interest. Yours is at <span className="font-bold">${it.price}/mo</span>.
            </p>
            {onEdit && (
              <button
                onClick={() => onEdit(it.listing_id)}
                className="mt-2 inline-flex items-center gap-1 rounded-full bg-orange-600 px-3 py-1 text-[11px] font-bold text-white hover:bg-orange-700"
              >
                Lower my price →
              </button>
            )}
          </div>
        </div>
      ))}
    </div>
  );
}
