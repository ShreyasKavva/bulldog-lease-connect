import { createFileRoute, Link } from "@tanstack/react-router";
import { useState } from "react";
import { useQuery } from "@tanstack/react-query";
import { fetchCampuses, fetchActiveListingCountsByCampus, type Campus } from "@/lib/leaseup/campuses";
import { fetchAllPriceStats, fetchNeighborhoodBreakdown, type CampusPriceStat } from "@/lib/leaseup/pricing";
import { cn } from "@/lib/utils";

export const Route = createFileRoute("/market")({
  head: () => ({
    meta: [
      { title: "Sublease Prices — Market Data | LeaseUp" },
      { name: "description", content: "Real-time sublease pricing data by campus and bedroom count. See median, average, and range across active student listings." },
      { property: "og:title", content: "Sublease Market Data — LeaseUp" },
      { property: "og:description", content: "Median sublease prices, neighborhood breakdowns, and pricing trends by campus." },
      { property: "og:url", content: "https://leasup.co/market" },
    ],
    links: [{ rel: "canonical", href: "https://leasup.co/market" }],
  }),
  component: MarketPage,
});

function MarketPage() {
  const { data: campuses = [] } = useQuery({ queryKey: ["campuses"], queryFn: fetchCampuses });
  const { data: stats = [] } = useQuery({ queryKey: ["campus-price-stats"], queryFn: fetchAllPriceStats });

  const [selected, setSelected] = useState<string | null>(null);
  const activeId = selected ?? campuses[0]?.id ?? null;
  const active = campuses.find((c) => c.id === activeId) ?? null;

  // "Active listings" must agree with /campuses and /sublease/$slug, so it is
  // counted live off listings.status rather than derived from the price-stats
  // view (which drops bedroom groups with fewer than 3 comps).
  const { data: liveCounts = {} } = useQuery({
    queryKey: ["active-listing-counts-by-campus"],
    queryFn: fetchActiveListingCountsByCampus,
    staleTime: 60 * 1000,
  });
  const activeListingCount = activeId ? (liveCounts[activeId] ?? 0) : 0;

  const { data: neighborhoods = [] } = useQuery({
    queryKey: ["neighborhood-breakdown", activeId],
    queryFn: () => fetchNeighborhoodBreakdown(activeId!),
    enabled: !!activeId,
  });

  const forCampus: CampusPriceStat[] = stats.filter((s) => s.campus_id === activeId).sort((a, b) => a.beds - b.beds);
  const totalListings = forCampus.reduce((sum, s) => sum + Number(s.listing_count), 0);
  const overallMedian = forCampus.length
    ? Math.round(forCampus.reduce((sum, s) => sum + Number(s.median_price) * Number(s.listing_count), 0) / Math.max(1, totalListings))
    : 0;
  const overallAvg = forCampus.length
    ? Math.round(forCampus.reduce((sum, s) => sum + Number(s.avg_price) * Number(s.listing_count), 0) / Math.max(1, totalListings))
    : 0;

  return (
    <div className="min-h-screen bg-background pb-20">
      <main className="mx-auto max-w-5xl px-4 py-8">
        <header className="mb-6">
          <h1 className="text-3xl font-extrabold tracking-tight">Sublease market data</h1>
          <p className="mt-1 text-sm text-muted-foreground">
            Live pricing trends across active student subleases. Updated daily.
          </p>
        </header>

        {/* Campus selector pills */}
        <div className="mb-6 -mx-1 flex gap-2 overflow-x-auto px-1 pb-1">
          {campuses.map((c: Campus) => (
            <button
              key={c.id}
              onClick={() => setSelected(c.id)}
              className={cn(
                "whitespace-nowrap rounded-full px-4 py-1.5 text-sm font-bold transition",
                activeId === c.id ? "bg-primary text-primary-foreground" : "bg-surface border hover:bg-muted",
              )}
            >
              {c.short_name}
            </button>
          ))}
        </div>

        {active && (
          <>
            {/* Overview cards */}
            <div className="grid grid-cols-3 gap-3">
              <StatCard label="Active listings" value={activeListingCount ? activeListingCount.toString() : "—"} />
              <StatCard label="Average price" value={overallAvg ? `$${Math.round(overallAvg).toLocaleString("en-US")}/mo` : "—"} />
              <StatCard label="Median price" value={overallMedian ? `$${Math.round(overallMedian).toLocaleString("en-US")}/mo` : "—"} />
            </div>

            {/* Price by bedroom */}
            <section className="mt-8 rounded-2xl border bg-surface p-4">
              <h2 className="mb-3 text-lg font-extrabold">Price by bedroom — {active.short_name}</h2>
              {forCampus.length === 0 ? (
                <p className="text-sm text-muted-foreground">Not enough listings of the same bedroom size yet to show price comps. Check back soon.</p>
              ) : (
                <div className="overflow-x-auto">
                  <table className="w-full text-sm">
                    <thead>
                      <tr className="border-b text-xs uppercase text-muted-foreground">
                        <th className="py-2 text-left font-bold">Beds</th>
                        <th className="py-2 text-right font-bold">Listings</th>
                        <th className="py-2 text-right font-bold">Min</th>
                        <th className="py-2 text-right font-bold">Median</th>
                        <th className="py-2 text-right font-bold">Avg</th>
                        <th className="py-2 text-right font-bold">Max</th>
                      </tr>
                    </thead>
                    <tbody>
                      {forCampus.map((s) => (
                        <tr key={s.beds} className="border-b last:border-0">
                          <td className="py-2 font-bold">{s.beds}BR</td>
                          <td className="py-2 text-right">{s.listing_count}</td>
                          <td className="py-2 text-right">${Math.round(s.min_price).toLocaleString("en-US")}</td>
                          <td className="py-2 text-right font-bold text-primary">${Math.round(s.median_price).toLocaleString("en-US")}</td>
                          <td className="py-2 text-right">${Math.round(s.avg_price).toLocaleString("en-US")}</td>
                          <td className="py-2 text-right">${Math.round(s.max_price).toLocaleString("en-US")}</td>
                        </tr>
                      ))}
                    </tbody>
                  </table>
                </div>
              )}
            </section>

            {/* Neighborhood breakdown */}
            <section className="mt-6 rounded-2xl border bg-surface p-4">
              <h2 className="mb-3 text-lg font-extrabold">Neighborhood breakdown</h2>
              {neighborhoods.length === 0 ? (
                <p className="text-sm text-muted-foreground">Not enough neighborhood-tagged data yet.</p>
              ) : (
                <div className="overflow-x-auto">
                  <table className="w-full text-sm">
                    <thead>
                      <tr className="border-b text-xs uppercase text-muted-foreground">
                        <th className="py-2 text-left font-bold">Neighborhood</th>
                        <th className="py-2 text-right font-bold pl-2">Listings</th>
                        <th className="py-2 text-right font-bold pl-2">Avg</th>
                        <th className="py-2 text-right font-bold pl-2">Median</th>
                      </tr>
                    </thead>
                    <tbody>
                      {neighborhoods.map((n) => (
                        <tr key={n.area} className="border-b last:border-0">
                          <td className="py-2 font-semibold">{n.area}</td>
                          <td className="py-2 text-right pl-2">{n.listing_count}</td>
                          <td className="py-2 text-right pl-2">${Math.round(n.avg_price).toLocaleString("en-US")}</td>
                          <td className="py-2 text-right font-bold text-primary pl-2">${Math.round(n.median_price).toLocaleString("en-US")}</td>
                        </tr>
                      ))}
                    </tbody>
                  </table>
                </div>
              )}
            </section>

            <p className="mt-6 text-xs text-muted-foreground">
              {totalListings > 0
                ? `Data updated daily. Based on ${totalListings} active listings at ${active.short_name} (last 90 days).`
                : `Data updated daily. Prices shown reflect listings at ${active.short_name} from the last 90 days.`}
            </p>

            <div className="mt-6">
              <Link
                to="/sublease/$slug"
                params={{ slug: active.slug }}
                className="inline-flex items-center gap-2 rounded-full bg-primary px-5 py-2.5 text-sm font-bold text-primary-foreground hover:bg-primary/90"
              >
                Browse listings at {active.short_name} →
              </Link>
            </div>
          </>
        )}
      </main>
    </div>
  );
}

function StatCard({ label, value }: { label: string; value: string }) {
  return (
    <div className="rounded-2xl border bg-surface p-3 sm:p-4">
      <div className="text-xs font-bold uppercase text-muted-foreground">{label}</div>
      <div className="mt-2 text-base sm:text-2xl font-extrabold tracking-tight">{value}</div>
    </div>
  );
}
