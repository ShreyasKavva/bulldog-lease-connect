import { useQuery } from "@tanstack/react-query";
import { Link } from "@tanstack/react-router";
import { Sparkline } from "./Charts";
import { fetchListingDailyStats, fetchListingBenchmark } from "@/lib/leaseup/analytics.queries";
import type { Listing } from "@/lib/leaseup/types";
import { supabase } from "@/integrations/supabase/client";

export function ListingStatsPanel({ listing }: { listing: Listing }) {
  const { data: daily = [] } = useQuery({
    queryKey: ["listing-daily-stats", listing.id, 7],
    queryFn: () => fetchListingDailyStats(listing.id, 7),
  });
  const { data: counts } = useQuery({
    queryKey: ["listing-quick-counts", listing.id],
    queryFn: async () => {
      const [sav, convs] = await Promise.all([
        supabase.from("saved_listings").select("listing_id", { count: "exact", head: true }).eq("listing_id", listing.id),
        supabase.from("conversations").select("id").eq("listing_id", listing.id),
      ]);
      const convIds = (convs.data ?? []).map((c: any) => c.id);
      let msgCount = 0;
      if (convIds.length) {
        const m = await supabase.from("messages").select("id", { count: "exact", head: true }).in("conversation_id", convIds).neq("sender_id", listing.user_id);
        msgCount = m.count ?? 0;
      }
      return { saves: sav.count ?? 0, messages: msgCount };
    },
  });
  const { data: bench } = useQuery({
    queryKey: ["listing-benchmark", listing.id],
    queryFn: () => fetchListingBenchmark(listing.id),
  });

  // Build a 7-day series including today, filling gaps with 0
  const days: { date: string; views: number }[] = [];
  for (let i = 6; i >= 0; i--) {
    const d = new Date(Date.now() - i * 86400000).toISOString().slice(0, 10);
    const row = daily.find((r) => r.date === d);
    days.push({ date: d, views: row?.views ?? 0 });
  }
  // Convert running totals to deltas
  const deltas = days.map((d, i) => Math.max(0, d.views - (i > 0 ? days[i - 1].views : d.views)));
  // Ensure today shows current view_count - yesterday snapshot if no snapshot today yet
  if (deltas.every((v) => v === 0) && listing.view_count) {
    deltas[deltas.length - 1] = listing.view_count;
  }

  const ageDays = Math.max(0, Math.floor((Date.now() - new Date(listing.created_at).getTime()) / 86400000));
  const weekViews = deltas.reduce((a, b) => a + b, 0);
  const avgViews = Math.round(bench?.avg_views ?? 0);

  let compareLine = "📊 Stats build up over the first 48 hours";
  if (ageDays >= 2 && avgViews > 0) {
    const diff = Math.round(((listing.view_count - avgViews) / avgViews) * 100);
    if (diff >= 10) compareLine = `📈 Your listing gets ${diff}% more views than similar ${listing.beds}BR listings nearby`;
    else if (diff <= -10) compareLine = `📉 Similar ${listing.beds}BR listings average ${avgViews} views — yours has ${listing.view_count}. Consider lowering your price or adding photos.`;
    else compareLine = `📊 Your listing performs in line with similar ${listing.beds}BR listings (avg ${avgViews})`;
  }

  const labels = ["S", "M", "T", "W", "T", "F", "S"];
  const todayDow = new Date().getDay();

  return (
    <div className="mt-3 rounded-xl border bg-background/60 p-3 text-sm">
      <div className="flex flex-wrap items-center gap-x-4 gap-y-1 text-xs font-semibold">
        <span>👀 <span className="tabular-nums">{weekViews}</span> views this week</span>
        <span>❤️ <span className="tabular-nums">{counts?.saves ?? 0}</span> saves</span>
        <span>💬 <span className="tabular-nums">{counts?.messages ?? 0}</span> messages</span>
        <span className="text-muted-foreground">📅 Posted {ageDays === 0 ? "today" : `${ageDays}d ago`}</span>
      </div>
      <div className="mt-3 flex flex-col gap-1">
        <Sparkline data={deltas} />
        <div className="flex justify-between px-[2px] text-[10px] font-semibold text-muted-foreground">
          {days.map((_, i) => {
            const dow = (todayDow - 6 + i + 7) % 7;
            return <span key={i}>{labels[dow]}</span>;
          })}
        </div>
      </div>
      <div className="mt-2 text-xs text-muted-foreground">{compareLine}</div>
      <div className="mt-3 flex justify-end">
        <Link
          to="/my-listings/$listingId/analytics"
          params={{ listingId: listing.id }}
          className="text-xs font-bold text-primary hover:underline"
        >
          View full analytics →
        </Link>
      </div>
    </div>
  );
}
