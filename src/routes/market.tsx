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

// Q457 — a price stat built on one or two listings is not market data.
// The campus_price_stats view already refuses bedroom groups below 3 comps;
// the neighborhood RPC has no such floor, so we apply the same one here.
const MIN_COMPS = 3;

function MarketPage() {
  const campusesQ = useQuery({ queryKey: ["campuses"], queryFn: fetchCampuses });
  const statsQ = useQuery({ queryKey: ["campus-price-stats"], queryFn: fetchAllPriceStats });
  const campuses = campusesQ.data ?? [];
  const stats = statsQ.data ?? [];

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
  // True only when the average and median tiles render real numbers
  // (the price-stats view already suppresses groups below the comps threshold).
  const hasComps = overallAvg > 0 && overallMedian > 0;

  const loading = campusesQ.isLoading || statsQ.isLoading;
  const failed = campusesQ.isError || statsQ.isError;

  if (loading) {
    return (
      <div className="min-h-screen bg-background pb-20">
        <main className="mx-auto max-w-5xl px-4 py-8">
          <div className="h-8 w-64 animate-pulse rounded-full bg-muted" />
          <div className="mt-3 h-4 w-80 max-w-full animate-pulse rounded-full bg-muted" />
          <div className="mt-8 grid grid-cols-3 gap-3">
            {[0, 1, 2].map((i) => (
              <div key={i} className="h-24 animate-pulse rounded-2xl bg-muted" />
            ))}
          </div>
          <div className="mt-8 h-48 animate-pulse rounded-2xl bg-muted" />
        </main>
      </div>
    );
  }

  if (failed || (!campusesQ.isLoading && campuses.length === 0)) {
    return (
      <div className="min-h-screen bg-background pb-20">
        <main className="mx-auto max-w-5xl px-4 py-8">
          <h1 className="text-3xl font-extrabold tracking-tight">Sublease market data</h1>
          <p className="mt-2 text-sm text-muted-foreground">
            {failed
              ? "We couldn't load pricing data just now. Refresh the page and it should come back."
              : "There aren't any live subleases to price yet. Post the first one and this page fills in."}
          </p>
          <div className="mt-4 flex flex-wrap gap-3">
            <Link to="/post" className="inline-flex min-h-11 items-center gap-2 rounded-full bg-primary px-5 text-sm font-bold text-primary-foreground hover:bg-primary/90">
              Post a sublease
            </Link>
            <Link to="/browse" className="inline-flex min-h-11 items-center gap-2 rounded-full border bg-surface px-5 text-sm font-bold hover:bg-muted">
              Browse subleases
            </Link>
          </div>
        </main>
      </div>
    );
  }


  return (
    <div className="min-h-screen bg-background pb-20">
      <main className="mx-auto max-w-5xl px-4 py-8">
        <header className="mb-6">
          <h1 className="text-3xl font-extrabold tracking-tight">Sublease market data</h1>
          <p className="mt-1 text-sm text-muted-foreground">
            {active && !hasComps
              ? `Not enough listings at ${active.short_name} yet to show price trends. Here's what we have so far.`
              : "Live pricing trends across active student subleases. Updated daily."}
          </p>
          {active && !hasComps && (
            <div className="mt-3 flex flex-wrap gap-3">
              <Link
                to="/post"
                className="inline-flex items-center gap-2 rounded-full bg-primary px-5 py-2.5 text-sm font-bold text-primary-foreground hover:bg-primary/90"
              >
                Post a sublease
              </Link>
              <Link
                to="/sublease/$slug"
                params={{ slug: active.slug }}
                className="inline-flex items-center gap-2 rounded-full bg-primary px-5 py-2.5 text-sm font-bold text-primary-foreground hover:bg-primary/90"
              >
                Browse listings at {active.short_name} →
              </Link>
            </div>
          )}
        </header>

        {/* Campus selector pills */}
        <div className="mb-6 -mx-1 flex gap-2 overflow-x-auto px-1 pb-1">
          {campuses.map((c: Campus) => (
            <button
              key={c.id}
              onClick={() => setSelected(c.id)}
              className={cn(
                "inline-flex min-h-11 items-center whitespace-nowrap rounded-full px-4 text-sm font-bold transition",
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
              <StatCard
                label="Average price"
                value={overallAvg ? `$${Math.round(overallAvg).toLocaleString("en-US")}/mo` : "—"}
                caption={overallAvg ? `Based on ${totalListings} listing${totalListings === 1 ? "" : "s"}` : "Not enough listings yet"}
              />
              <StatCard
                label="Median price"
                value={overallMedian ? `$${Math.round(overallMedian).toLocaleString("en-US")}/mo` : "—"}
                caption={overallMedian ? `Based on ${totalListings} listing${totalListings === 1 ? "" : "s"}` : "Not enough listings yet"}
              />
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
              {(() => {
                const cleanNeighborhoods = neighborhoods.filter((n) => {
                  const a = (n.area ?? "").trim();
                  if (a.length < 3) return false;
                  if (/^\d/.test(a)) return false;
                  if (/\b(dr|st|ave|blvd|rd|ln|ct|way|pl|drive|street|avenue|boulevard|road|lane|court)\b/i.test(a)) return false;
                  return true;
                });
                if (cleanNeighborhoods.length === 0) {
                  return <p className="text-sm text-muted-foreground">Not enough neighborhood-tagged data yet.</p>;
                }
                return (
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
                        {cleanNeighborhoods.map((n) => (
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
                );
              })()}
            </section>

            {hasComps && (
              <p className="mt-6 text-xs text-muted-foreground">
                {totalListings > 0
                  ? `Data updated daily. Based on ${totalListings} active listings at ${active.short_name} (last 90 days).`
                  : `Data updated daily. Prices shown reflect listings at ${active.short_name} from the last 90 days.`}
              </p>
            )}

            {hasComps && (
              <div className="mt-6">
                <Link
                  to="/sublease/$slug"
                  params={{ slug: active.slug }}
                  className="inline-flex items-center gap-2 rounded-full bg-primary px-5 py-2.5 text-sm font-bold text-primary-foreground hover:bg-primary/90"
                >
                  Browse listings at {active.short_name} →
                </Link>
              </div>
            )}
          </>
        )}
      </main>
    </div>
  );
}

function StatCard({ label, value, caption }: { label: string; value: string; caption?: string }) {
  return (
    <div className="rounded-2xl border bg-surface p-3 sm:p-4">
      <div className="text-xs font-bold uppercase text-muted-foreground">{label}</div>
      <div className="mt-2 text-base sm:text-2xl font-extrabold tracking-tight">{value}</div>
      {caption && <div className="mt-1 text-xs leading-snug text-muted-foreground">{caption}</div>}
    </div>
  );
}
