import { createFileRoute, Link, useNavigate } from "@tanstack/react-router";
import { useQuery } from "@tanstack/react-query";
import { ArrowLeft } from "lucide-react";
import { Nav } from "@/components/leaseup/Nav";
import { useSession } from "@/lib/leaseup/use-session";
import { fetchListing } from "@/lib/leaseup/queries";
import {
  fetchListingDailyStats,
  fetchListingBenchmark,
  fetchListingMessageStats,
  fetchRecentSavers,
} from "@/lib/leaseup/analytics.queries";
import { LineChart, StatCard } from "@/components/leaseup/analytics/Charts";
import { supabase } from "@/integrations/supabase/client";

export const Route = createFileRoute("/my-listings/$listingId/analytics")({
  head: () => ({ meta: [{ title: "Listing analytics — LeaseUp" }] }),
  component: AnalyticsPage,
});

function AnalyticsPage() {
  const { listingId } = Route.useParams();
  const { user } = useSession();
  const navigate = useNavigate();

  const { data: listing, isLoading } = useQuery({
    queryKey: ["listing", listingId],
    queryFn: () => fetchListing(listingId),
  });

  const isOwner = !!(user && listing && listing.user_id === user.id);

  const { data: daily = [] } = useQuery({
    queryKey: ["listing-daily-stats", listingId, 30],
    queryFn: () => fetchListingDailyStats(listingId, 30),
    enabled: isOwner,
  });
  const { data: bench } = useQuery({
    queryKey: ["listing-benchmark", listingId],
    queryFn: () => fetchListingBenchmark(listingId),
    enabled: isOwner,
  });
  const { data: msgStats } = useQuery({
    queryKey: ["listing-msg-stats", listingId],
    queryFn: () => fetchListingMessageStats(listingId, listing!.user_id),
    enabled: isOwner,
  });
  const { data: savers = [] } = useQuery({
    queryKey: ["listing-savers", listingId],
    queryFn: () => fetchRecentSavers(listingId, 5),
    enabled: isOwner,
  });
  const { data: saveCount = 0 } = useQuery({
    queryKey: ["listing-save-count", listingId],
    queryFn: async () => {
      const { count } = await supabase.from("saved_listings").select("listing_id", { count: "exact", head: true }).eq("listing_id", listingId);
      return count ?? 0;
    },
    enabled: isOwner,
  });

  if (isLoading) {
    return <div className="min-h-screen bg-background p-12 text-center text-sm text-muted-foreground">Loading…</div>;
  }
  if (!listing) {
    return <div className="min-h-screen bg-background p-12 text-center">Listing not found.</div>;
  }
  if (!isOwner) {
    return (
      <div className="min-h-screen bg-background p-12 text-center">
        <h2 className="text-lg font-bold">Only the poster can view this dashboard.</h2>
        <Link to="/my-listings" className="mt-4 inline-block text-sm font-bold text-primary">← Back to my listings</Link>
      </div>
    );
  }

  const totalViews = listing.view_count ?? 0;
  const conversionRate = totalViews > 0 ? Math.round(((msgStats?.inbound ?? 0) / totalViews) * 10000) / 100 : 0;
  const responseRate = (msgStats?.inbound ?? 0) > 0 ? Math.round(((msgStats?.replies ?? 0) / (msgStats?.inbound ?? 1)) * 100) : 0;
  const saveRate = totalViews > 0 ? Math.round((saveCount / totalViews) * 1000) / 10 : 0;

  // Build daily view deltas
  const series: { date: string; count: number }[] = [];
  for (let i = 0; i < daily.length; i++) {
    const cur = daily[i].views;
    const prev = i > 0 ? daily[i - 1].views : cur;
    series.push({ date: daily[i].date, count: Math.max(0, cur - prev) });
  }
  if (series.length === 0 && totalViews > 0) {
    series.push({ date: new Date().toISOString().slice(0, 10), count: totalViews });
  }

  const median = Math.round(bench?.median_price ?? 0);
  const min = bench?.min_price ?? 0;
  const max = bench?.max_price ?? 0;
  const range = Math.max(1, max - min);
  const pricePct = Math.min(100, Math.max(0, ((listing.price - min) / range) * 100));
  const aboveMedian = median > 0 && listing.price > median;
  const medianDiff = median > 0 ? Math.round(((listing.price - median) / median) * 1000) / 10 : 0;

  // Recommendations
  const recs: string[] = [];
  const ageDays = Math.max(0, Math.floor((Date.now() - new Date(listing.created_at).getTime()) / 86400000));
  if (totalViews < 50 && ageDays > 3 && (listing.photos?.length ?? 0) < 5) {
    recs.push("📸 Listings with 5+ photos get 2× more views. You have " + (listing.photos?.length ?? 0) + " — consider adding more.");
  }
  if (saveRate < 2 && totalViews > 100) {
    recs.push("💰 Your save rate is below average. Consider reducing price by $25–50.");
  }
  if ((msgStats?.inbound ?? 0) > 0 && responseRate < 60) {
    recs.push("💬 You've replied to " + responseRate + "% of messages. Faster responses help you fill your sublease.");
  }
  if (!listing.is_featured) {
    recs.push("⚡ Boosted listings get 3× more views for 7 days — $9.99.");
  }

  return (
    <div className="min-h-screen bg-background pb-24">
      <Nav onPost={() => {}} onOpenMessages={() => navigate({ to: "/" })} onOpenProfile={() => navigate({ to: "/" })} search="" onSearch={() => {}} />
      <header className="border-b bg-surface">
        <div className="mx-auto flex max-w-5xl items-center gap-3 px-4 py-4">
          <Link to="/my-listings" className="rounded-md p-2 hover:bg-background"><ArrowLeft className="h-5 w-5" /></Link>
          <div className="h-12 w-16 shrink-0 overflow-hidden rounded-md bg-muted">
            {listing.photo_urls?.[0] && <img src={listing.photo_urls[0]} alt="" className="h-full w-full object-cover" />}
          </div>
          <div className="min-w-0 flex-1">
            <h1 className="truncate text-lg font-black">{listing.title}</h1>
            <div className="text-xs text-muted-foreground">${listing.price}/mo · {listing.beds} bd</div>
          </div>
          <span className={`rounded-full px-2 py-0.5 text-[10px] font-bold ${listing.status === "filled" ? "bg-success/15 text-success" : listing.is_active ? "bg-primary/15 text-primary" : "bg-muted"}`}>
            {listing.status === "filled" ? "✓ Filled" : listing.is_active ? "Active" : "Inactive"}
          </span>
        </div>
      </header>

      <main className="mx-auto max-w-5xl space-y-5 px-4 py-5">
        <div className="grid grid-cols-2 gap-3 sm:grid-cols-5">
          <StatCard icon="👀" label="Total views" value={totalViews} />
          <StatCard icon="❤️" label="Total saves" value={saveCount} />
          <StatCard icon="💬" label="Messages" value={msgStats?.inbound ?? 0} />
          <StatCard icon="↩️" label="Replies sent" value={msgStats?.replies ?? 0} />
          <div className="rounded-xl bg-surface p-4 shadow-card">
            <div className="text-xl">📈</div>
            <div className="mt-1 text-2xl font-black tabular-nums">{conversionRate}%</div>
            <div className="text-xs font-semibold text-muted-foreground">Conversion rate</div>
          </div>
        </div>

        <section className="rounded-xl bg-surface p-4 shadow-card">
          <h2 className="text-sm font-bold">Views over time</h2>
          <p className="mb-2 text-xs text-muted-foreground">Daily views since posting</p>
          <LineChart data={series} />
        </section>

        <section className="grid gap-3 sm:grid-cols-2">
          <div className="rounded-xl bg-surface p-4 shadow-card">
            <div className="text-sm font-bold">❤️ Save rate</div>
            <div className="mt-1 text-3xl font-black">{saveRate}%</div>
            <div className="text-xs text-muted-foreground">{saveCount} saves ÷ {totalViews} views</div>
            <div className="mt-2 text-xs">
              Campus average for {listing.beds}BR: <span className="font-bold">4.3%</span>{" "}
              {saveRate >= 4.3 ? <span className="text-success">↑ Above average</span> : <span className="text-muted-foreground">↓ Below average</span>}
            </div>
          </div>
          <div className="rounded-xl bg-surface p-4 shadow-card">
            <div className="text-sm font-bold">Who's saving your listing</div>
            <div className="mt-2 flex items-center gap-2">
              <div className="flex -space-x-2">
                {savers.length === 0 ? (
                  <span className="text-sm text-muted-foreground">No saves yet</span>
                ) : (
                  savers.map((s, i) => (
                    <div key={i} className="grid h-9 w-9 place-items-center rounded-full border-2 border-surface bg-primary/15 text-lg">{s.emoji}</div>
                  ))
                )}
              </div>
              {saveCount > 0 && (
                <div className="text-xs font-semibold text-muted-foreground">
                  {saveCount} student{saveCount === 1 ? "" : "s"} have this saved
                </div>
              )}
            </div>
          </div>
        </section>

        <section className="rounded-xl bg-surface p-4 shadow-card">
          <h2 className="text-sm font-bold">Message funnel</h2>
          <div className="mt-2 text-xs text-muted-foreground tabular-nums">
            {totalViews.toLocaleString()} views → {msgStats?.inbound ?? 0} messages → {msgStats?.replies ?? 0} replies
          </div>
          <div className="mt-3 grid gap-2 text-xs sm:grid-cols-2">
            <div>Views → message rate: <span className="font-bold">{conversionRate}%</span> <span className="text-muted-foreground">(campus avg: 1.9%)</span> {conversionRate >= 1.9 ? <span className="text-success">↑</span> : <span className="text-muted-foreground">↓</span>}</div>
            <div>Response rate: <span className="font-bold">{responseRate}%</span> <span className="text-muted-foreground">(campus avg: 64%)</span> {responseRate >= 64 ? <span className="text-success">↑</span> : <span className="text-muted-foreground">↓</span>}</div>
          </div>
        </section>

        {median > 0 && (
          <section className="rounded-xl bg-surface p-4 shadow-card">
            <h2 className="text-sm font-bold">Price comparison</h2>
            <div className="mt-1 text-xs text-muted-foreground">Your price: <span className="font-bold text-foreground">${listing.price}/mo</span></div>
            <div className="mt-3">
              <div className="text-[11px] text-muted-foreground">Campus range for {listing.beds}BR</div>
              <div className="relative mt-2 h-2 rounded-full bg-muted">
                <div className="absolute -top-1 h-4 w-[2px] bg-primary" style={{ left: `${pricePct}%` }} />
              </div>
              <div className="mt-1 flex justify-between text-[11px] text-muted-foreground tabular-nums">
                <span>${min}</span><span>${max}</span>
              </div>
            </div>
            <div className="mt-3 text-xs">
              Median: <span className="font-bold">${median}</span> · You're {medianDiff >= 0 ? `${medianDiff}% above` : `${Math.abs(medianDiff)}% below`} median
            </div>
            {aboveMedian ? (
              <div className="mt-2 rounded-md bg-amber-50 p-2 text-xs text-amber-900">Listings priced at or below median get 40% more messages on average.</div>
            ) : (
              <div className="mt-2 rounded-md bg-success/10 p-2 text-xs text-success">✓ Your price is competitive. This may be driving your above-average save rate.</div>
            )}
          </section>
        )}

        {(listing.photos?.length ?? 0) > 1 && (
          <section className="rounded-xl bg-surface p-4 shadow-card">
            <h2 className="text-sm font-bold">Photo performance</h2>
            <div className="mt-1 text-xs text-muted-foreground">Photo 1 (cover) gets the most views — each subsequent photo loses ~30% of viewers.</div>
            <div className="mt-3 grid grid-cols-3 gap-2 sm:grid-cols-5">
              {listing.photo_urls?.map((u, i) => {
                const est = Math.round(totalViews * Math.pow(0.7, i));
                return (
                  <div key={i} className="space-y-1">
                    <div className="aspect-square overflow-hidden rounded-md bg-muted"><img src={u} alt="" className="h-full w-full object-cover" /></div>
                    <div className="text-[11px] font-semibold tabular-nums">{est.toLocaleString()} views</div>
                  </div>
                );
              })}
            </div>
          </section>
        )}

        {recs.length > 0 && (
          <section className="rounded-xl border border-primary/20 bg-primary/5 p-4">
            <h2 className="text-sm font-bold">Recommendations</h2>
            <ul className="mt-2 space-y-2 text-sm">
              {recs.map((r, i) => <li key={i}>{r}</li>)}
            </ul>
          </section>
        )}
      </main>
    </div>
  );
}
