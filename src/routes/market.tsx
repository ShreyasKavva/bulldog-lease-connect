import { createFileRoute, Link } from "@tanstack/react-router";
import { looksLikeStreetAddress } from "@/lib/leaseup/area";
import { useQuery } from "@tanstack/react-query";
import { fetchCampuses, fetchActiveListingCountsByCampus, type Campus } from "@/lib/leaseup/campuses";
import { fetchAllPriceStats, fetchNeighborhoodBreakdown, type CampusPriceStat } from "@/lib/leaseup/pricing";
import { cn } from "@/lib/utils";

export const Route = createFileRoute("/market")({
  // Q521 — the selected campus lives in the URL (?campus=<slug>) so it is
  // shareable and survives reload and the back button.
  validateSearch: (search: Record<string, unknown>): { campus?: string } => ({
    campus: typeof search?.campus === "string" && /^[a-z0-9-]{1,80}$/.test(search.campus) ? search.campus : undefined,
  }),
  head: () => ({
    meta: [
      { title: "Sublease Prices — Market Data | LeaseUp" },
      { name: "description", content: "Sublease price data by campus and bedroom count, built from active student listings on LeaseUp. Coverage grows as students post." },
      { property: "og:title", content: "Sublease Market Data — LeaseUp" },
      { property: "og:description", content: "Sublease price data by campus, built from active student listings on LeaseUp." },
      { name: "twitter:description", content: "Sublease price data by campus, built from active student listings on LeaseUp." },
      { property: "og:url", content: "https://leasup.co/market" },
      { property: "og:image", content: "https://leasup.co/og-image.png" },
      { name: "twitter:card", content: "summary_large_image" },
      { name: "twitter:image", content: "https://leasup.co/og-image.png" },
    ],
    links: [{ rel: "canonical", href: "https://leasup.co/market" }],
  }),
  // Q502 — seed the page's two first-paint queries on the server so the SSR
  // HTML carries the real heading, copy and price tables instead of a pulse
  // skeleton. Same keys/functions as the useQuery calls below; public reads.
  loader: async ({ context }) => {
    await Promise.all([
      context.queryClient.ensureQueryData({ queryKey: ["campuses"], queryFn: fetchCampuses }),
      context.queryClient.ensureQueryData({ queryKey: ["campus-price-stats"], queryFn: fetchAllPriceStats }),
      context.queryClient.ensureQueryData({ queryKey: ["active-listing-counts-by-campus"], queryFn: fetchActiveListingCountsByCampus }),
    ]).catch(() => undefined);
  },
  component: MarketPage,
});

// Q457 — a price stat built on one or two listings is not market data.
// The campus_price_stats view already refuses bedroom groups below 3 comps;
// the neighborhood RPC has no such floor, so we apply the same one here.
const MIN_COMPS = 3;

/** Q521 — one indigo focus ring for every control on the page. */
const FOCUS =
  "outline-none focus-visible:ring-2 focus-visible:ring-[#4F46E5] focus-visible:ring-offset-2 focus-visible:ring-offset-background";
const PRIMARY_LINK = cn(
  "inline-flex min-h-11 items-center gap-2 rounded-full bg-[#4F46E5] px-5 py-2.5 text-sm font-bold text-white hover:bg-[#4338CA]",
  FOCUS,
);
const SECONDARY_LINK = cn(
  "inline-flex min-h-11 items-center gap-2 rounded-full border bg-surface px-5 py-2.5 text-sm font-bold hover:bg-muted",
  FOCUS,
);

const bedLabel = (beds: number) => (Number(beds) === 0 ? "Studio" : `${beds} bedroom${Number(beds) === 1 ? "" : "s"}`);
const money = (n: number) => `$${Math.round(Number(n)).toLocaleString("en-US")}`;

function Intro() {
  return (
    <>
      <h1 className="text-3xl font-extrabold tracking-tight">Sublease market data</h1>
      <p className="mt-2 max-w-2xl text-sm text-muted-foreground">
        Sublease prices by campus and bedroom count, built from active student listings on LeaseUp.
        A price only shows once at least 3 listings back it up, so coverage grows as students post.
      </p>
    </>
  );
}

function MarketPage() {
  const search = Route.useSearch();
  const campusesQ = useQuery({ queryKey: ["campuses"], queryFn: fetchCampuses });
  const statsQ = useQuery({ queryKey: ["campus-price-stats"], queryFn: fetchAllPriceStats });
  const campuses = campusesQ.data ?? [];
  const stats = statsQ.data ?? [];

  const fromUrl = search.campus ? campuses.find((c) => c.slug === search.campus) : undefined;
  const active: Campus | null = fromUrl ?? campuses[0] ?? null;
  const activeId = active?.id ?? null;
  const unknownCampus = !!search.campus && campuses.length > 0 && !fromUrl;

  // "Active listings" must agree with /campuses and /sublease/$slug, so it is
  // counted live off listings.status rather than derived from the price-stats
  // view (which drops bedroom groups with fewer than 3 comps).
  const { data: liveCounts = {} } = useQuery({
    queryKey: ["active-listing-counts-by-campus"],
    queryFn: fetchActiveListingCountsByCampus,
    staleTime: 60 * 1000,
  });
  const activeListingCount = activeId ? (liveCounts[activeId] ?? 0) : 0;

  const neighborhoodsQ = useQuery({
    queryKey: ["neighborhood-breakdown", activeId],
    queryFn: () => fetchNeighborhoodBreakdown(activeId!),
    enabled: !!activeId,
  });
  const neighborhoods = neighborhoodsQ.data ?? [];

  const forCampus: CampusPriceStat[] = stats.filter((s) => s.campus_id === activeId).sort((a, b) => a.beds - b.beds);
  const totalListings = forCampus.reduce((sum, s) => sum + Number(s.listing_count), 0);
  // Q521 — a listing-weighted mean of per-bedroom averages IS the overall
  // average of those listings. The old "median price" tile was a weighted
  // mean of medians — not a median of anything — so it is gone.
  const overallAvg = totalListings > 0
    ? Math.round(forCampus.reduce((sum, s) => sum + Number(s.avg_price) * Number(s.listing_count), 0) / totalListings)
    : 0;
  const hasComps = overallAvg > 0 && totalListings >= MIN_COMPS;

  const loading = campusesQ.isLoading || statsQ.isLoading;
  const failed = campusesQ.isError || statsQ.isError;

  if (loading) {
    return (
      <div className="min-h-screen bg-background pb-20">
        <main className="mx-auto max-w-5xl px-4 py-8" aria-busy="true">
          {/* Q502 — real heading and copy even while data loads. */}
          <Intro />
          <p role="status" className="sr-only">Loading market data…</p>
          <div className="mt-8 grid grid-cols-2 gap-3" aria-hidden="true">
            {[0, 1].map((i) => (
              <div key={i} className="h-24 animate-pulse rounded-2xl bg-muted" />
            ))}
          </div>
          <div className="mt-8 h-48 animate-pulse rounded-2xl bg-muted" aria-hidden="true" />
        </main>
      </div>
    );
  }

  if (failed || campuses.length === 0) {
    return (
      <div className="min-h-screen bg-background pb-20">
        <main className="mx-auto max-w-5xl px-4 py-8">
          <Intro />
          <p className="mt-4 text-sm text-foreground" role={failed ? "alert" : undefined}>
            {failed
              ? "We couldn't load pricing data just now."
              : "There aren't any live subleases to price yet. Post the first one and this page fills in."}
          </p>
          <div className="mt-4 flex flex-wrap gap-3">
            {failed && (
              <button
                type="button"
                onClick={() => { void campusesQ.refetch(); void statsQ.refetch(); }}
                className={PRIMARY_LINK}
              >
                Try again
              </button>
            )}
            <Link to="/post" className={failed ? SECONDARY_LINK : PRIMARY_LINK}>Post a sublease</Link>
            <Link to="/browse" className={SECONDARY_LINK}>Browse subleases</Link>
          </div>
        </main>
      </div>
    );
  }

  const tiles: Array<{ label: string; value: string; caption?: string }> = [];
  // Rule: never show a renter a zero count — the tile is left out instead.
  if (activeListingCount > 0) {
    tiles.push({ label: "Active listings", value: activeListingCount.toLocaleString("en-US") });
  }
  if (hasComps) {
    tiles.push({
      label: "Average rent",
      value: `${money(overallAvg)}/mo`,
      caption: `Based on ${totalListings} listing${totalListings === 1 ? "" : "s"}`,
    });
  }

  return (
    <div className="min-h-screen bg-background pb-20">
      <main className="mx-auto max-w-5xl px-4 py-8">
        <header className="mb-6">
          <Intro />
          {unknownCampus && (
            <p role="status" className="mt-3 text-sm text-foreground">
              We couldn't find that campus, so we're showing {active?.short_name ?? "another campus"} instead.
            </p>
          )}
          {active && (
            <p className="mt-3 text-sm text-muted-foreground">
              {hasComps
                ? `Pricing from active student subleases at ${active.short_name}, read live on page load.`
                : `Not enough listings at ${active.short_name} yet to show prices. Here's what we have so far.`}
            </p>
          )}
          {active && !hasComps && (
            <div className="mt-3 flex flex-wrap gap-3">
              <Link to="/post" className={PRIMARY_LINK}>Post a sublease</Link>
              <Link to="/sublease/$slug" params={{ slug: active.slug }} className={SECONDARY_LINK}>
                Browse listings at {active.short_name} →
              </Link>
              {/* Q465 — thin campus data should always offer the full feed too. */}
              <Link to="/browse" className={SECONDARY_LINK}>Browse all subleases</Link>
            </div>
          )}
        </header>

        {/* Campus selector — real links, so the choice is in the URL. */}
        <nav aria-label="Choose a campus" className="mb-6">
          <ul className="-mx-1 flex flex-wrap gap-2 px-1 pb-1">
            {campuses.map((c: Campus) => {
              const on = activeId === c.id;
              return (
                <li key={c.id}>
                  <Link
                    to="/market"
                    search={{ campus: c.slug }}
                    resetScroll={false}
                    aria-current={on ? "page" : undefined}
                    className={cn(
                      "inline-flex min-h-11 items-center whitespace-nowrap rounded-full px-4 text-sm font-bold transition",
                      FOCUS,
                      on ? "bg-[#4F46E5] text-white" : "border bg-surface hover:bg-muted",
                    )}
                  >
                    {c.short_name}
                  </Link>
                </li>
              );
            })}
          </ul>
        </nav>

        {active && (
          <>
            {tiles.length > 0 && (
              <div className={cn("grid gap-3", tiles.length > 1 ? "grid-cols-1 min-[400px]:grid-cols-2" : "grid-cols-1 sm:max-w-xs")}>
                {tiles.map((t) => <StatCard key={t.label} {...t} />)}
              </div>
            )}

            {/* Price by bedroom */}
            <section className="mt-8 rounded-2xl border bg-surface p-4" aria-labelledby="market-beds">
              <h2 id="market-beds" className="mb-3 text-lg font-extrabold">Price by bedroom — {active.short_name}</h2>
              {forCampus.length === 0 ? (
                <p className="text-sm text-muted-foreground">Not enough listings of the same bedroom size yet to show prices. Check back soon.</p>
              ) : (
                <div className="overflow-x-auto" tabIndex={0} role="region" aria-labelledby="market-beds">
                  <table className="w-full text-sm">
                    <caption className="sr-only">Monthly rent by bedroom count at {active.short_name}</caption>
                    <thead>
                      <tr className="border-b text-xs uppercase text-muted-foreground">
                        <th scope="col" className="py-2 text-left font-bold">Size</th>
                        <th scope="col" className="py-2 pl-2 text-right font-bold">Listings</th>
                        <th scope="col" className="py-2 pl-2 text-right font-bold">Min</th>
                        <th scope="col" className="py-2 pl-2 text-right font-bold">Median</th>
                        <th scope="col" className="py-2 pl-2 text-right font-bold">Avg</th>
                        <th scope="col" className="py-2 pl-2 text-right font-bold">Max</th>
                      </tr>
                    </thead>
                    <tbody>
                      {forCampus.map((s) => (
                        <tr key={s.beds} className="border-b last:border-0">
                          <th scope="row" className="whitespace-nowrap py-2 text-left font-bold">{bedLabel(s.beds)}</th>
                          <td className="py-2 pl-2 text-right">{s.listing_count}</td>
                          <td className="py-2 pl-2 text-right">{money(s.min_price)}</td>
                          <td className="py-2 pl-2 text-right font-bold text-[#4F46E5]">{money(s.median_price)}</td>
                          <td className="py-2 pl-2 text-right">{money(s.avg_price)}</td>
                          <td className="py-2 pl-2 text-right">{money(s.max_price)}</td>
                        </tr>
                      ))}
                    </tbody>
                  </table>
                </div>
              )}
            </section>

            {/* Neighborhood breakdown */}
            <section className="mt-6 rounded-2xl border bg-surface p-4" aria-labelledby="market-hoods" aria-busy={neighborhoodsQ.isLoading}>
              <h2 id="market-hoods" className="mb-3 text-lg font-extrabold">Neighborhood breakdown</h2>
              {neighborhoodsQ.isLoading ? (
                <>
                  <p role="status" className="sr-only">Loading neighborhoods…</p>
                  <div className="h-20 animate-pulse rounded-xl bg-muted" aria-hidden="true" />
                </>
              ) : neighborhoodsQ.isError ? (
                <div role="alert" className="flex flex-wrap items-center gap-3 text-sm">
                  <span>We couldn't load neighborhoods.</span>
                  <button type="button" onClick={() => void neighborhoodsQ.refetch()} className={SECONDARY_LINK}>
                    Try again
                  </button>
                </div>
              ) : (() => {
                const cleanNeighborhoods = neighborhoods.filter((n) => {
                  const a = (n.area ?? "").trim();
                  // Q473 — the shared rule set is the source of truth.
                  if (looksLikeStreetAddress(a)) return false;
                  if (a.length < 3) return false;
                  if (/^\d/.test(a)) return false;
                  if (/\b(pl|place)\b/i.test(a)) return false;
                  return true;
                });
                // Q457 — same comps floor as the bedroom table.
                const priced = cleanNeighborhoods.filter((n) => Number(n.listing_count) >= MIN_COMPS);
                const thin = cleanNeighborhoods.length - priced.length;
                if (priced.length === 0) {
                  return (
                    <p className="text-sm text-muted-foreground">
                      {thin > 0
                        ? `We need at least ${MIN_COMPS} listings in a neighborhood before showing a price for it. Check back as more students post.`
                        : "Not enough neighborhood-tagged data yet."}
                    </p>
                  );
                }
                return (
                  <div className="overflow-x-auto" tabIndex={0} role="region" aria-labelledby="market-hoods">
                    <table className="w-full text-sm">
                      <caption className="sr-only">Monthly rent by neighborhood near {active.short_name}</caption>
                      <thead>
                        <tr className="border-b text-xs uppercase text-muted-foreground">
                          <th scope="col" className="py-2 text-left font-bold">Neighborhood</th>
                          <th scope="col" className="py-2 pl-2 text-right font-bold">Listings</th>
                          <th scope="col" className="py-2 pl-2 text-right font-bold">Avg</th>
                          <th scope="col" className="py-2 pl-2 text-right font-bold">Median</th>
                        </tr>
                      </thead>
                      <tbody>
                        {priced.map((n) => (
                          <tr key={n.area} className="border-b last:border-0">
                            <th scope="row" className="break-words py-2 text-left font-semibold">{n.area}</th>
                            <td className="py-2 pl-2 text-right">{n.listing_count}</td>
                            <td className="py-2 pl-2 text-right">{money(n.avg_price)}</td>
                            <td className="py-2 pl-2 text-right font-bold text-[#4F46E5]">{money(n.median_price)}</td>
                          </tr>
                        ))}
                      </tbody>
                    </table>
                    {thin > 0 && (
                      <p className="mt-3 text-xs text-muted-foreground">
                        Neighborhoods with fewer than {MIN_COMPS} listings are left out until there's enough to price them fairly.
                      </p>
                    )}
                  </div>
                );
              })()}
            </section>

            {hasComps && (
              <>
                {/* Q473 — every active listing at this campus, read live. */}
                <p className="mt-6 text-xs text-muted-foreground">
                  {`Based on ${totalListings} active listing${totalListings === 1 ? "" : "s"} at ${active.short_name} right now. Updates as students post.`}
                </p>
                <div className="mt-6">
                  <Link to="/sublease/$slug" params={{ slug: active.slug }} className={PRIMARY_LINK}>
                    Browse listings at {active.short_name} →
                  </Link>
                </div>
              </>
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
      <div className="mt-2 whitespace-nowrap text-xl font-extrabold tracking-tight sm:text-2xl">{value}</div>
      {caption && <div className="mt-1 text-xs leading-snug text-muted-foreground">{caption}</div>}
    </div>
  );
}
