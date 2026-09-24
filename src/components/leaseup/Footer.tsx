/**
 * Q106 Part C — global footer. 4 columns on desktop, 2 on tablet, stacked on
 * mobile. Campus column is data-driven: top 6 campuses by active listings.
 * Hidden on full-screen flows (a single message thread).
 */
import { Link, useRouterState } from "@tanstack/react-router";
import { useQuery } from "@tanstack/react-query";
import { ArrowUpRight } from "lucide-react";
import { fetchCampuses } from "@/lib/leaseup/campuses";
import { fetchCampusListingCounts } from "@/lib/leaseup/queries";

const headingCls = "mb-3 text-xs font-semibold uppercase tracking-wider text-muted-foreground";
const linkCls = "flex min-h-11 items-center rounded text-sm outline-none focus-visible:ring-2 focus-visible:ring-[#4F46E5] focus-visible:ring-offset-2 focus-visible:ring-offset-0 text-gray-600 transition-colors hover:text-foreground dark:text-muted-foreground";

export function Footer() {
  const path = useRouterState({ select: (s) => s.location.pathname });
  const hidden =
    path.startsWith("/post/") ||
    (path.startsWith("/messages/") && path !== "/messages");

  const { data: campuses = [] } = useQuery({
    queryKey: ["campuses"],
    queryFn: fetchCampuses,
    staleTime: Infinity,
    enabled: !hidden,
  });
  const { data: counts } = useQuery({
    queryKey: ["campus-listing-counts"],
    queryFn: fetchCampusListingCounts,
    staleTime: 5 * 60 * 1000,
    enabled: !hidden,
  });

  if (hidden) return null;

  // Q184 — max 6 campus links so the four columns stay roughly even.
  const topCampuses = campuses
    .map((c) => ({ ...c, n: counts?.get(c.id) ?? 0 }))
    .filter((c) => c.n > 0)
    .sort((a, b) => b.n - a.n)
    .slice(0, 6);

  return (
    <footer className="mt-10 border-t border-gray-100 bg-gray-50 dark:border-border dark:bg-surface">
      <div className="mx-auto grid max-w-7xl gap-10 px-6 py-12 sm:grid-cols-2 lg:grid-cols-4">
        {/* Brand */}
        <div>
          <p className="text-lg font-bold text-gray-900 dark:text-foreground">LeaseUp</p>
          <p className="mt-1 text-sm text-gray-600 dark:text-muted-foreground">Sublease near your campus.</p>
        </div>

        {/* For Students */}
        <div>
          <h2 className={headingCls}>For Students</h2>
          <Link to="/browse" className={linkCls}>Browse subleases</Link>
          <Link to="/post" className={linkCls}>Post a sublease</Link>
          <Link to="/looking" className={linkCls}>Roommate Search</Link>
          <Link to="/saved" className={linkCls}>Saved</Link>
        </div>

        {/* Company */}
        <div>
          <h2 className={headingCls}>Company</h2>
          <Link to="/about" className={linkCls}>About</Link>
          <Link to="/faq" className={linkCls}>FAQ</Link>
          <Link to="/ambassador" className={linkCls}>Ambassador</Link>
          <a href="mailto:hi@leasup.co" className={linkCls}>Contact</a>
          <a
            href="https://leasup.co"
            target="_blank"
            rel="noreferrer"
            className={`${linkCls} w-fit gap-1`}
          >
            leasup.co <ArrowUpRight className="h-3 w-3" />
          </a>
        </div>

        {/* Top Campuses — rightmost, capped at 6 */}
        <div>
          <h2 className={headingCls}>Top Campuses</h2>
          {topCampuses.length === 0 ? (
            <Link to="/campuses" className={linkCls}>All campuses</Link>
          ) : (
            <>
              {topCampuses.map((c) => (
                <Link
                  key={c.id}
                  to="/sublease/$slug"
                  params={{ slug: c.slug }}
                  className={linkCls}
                >
                  {c.short_name || c.name}
                </Link>
              ))}
              <Link to="/campuses" className={linkCls}>All campuses →</Link>
            </>
          )}
        </div>
      </div>

      {/* Q184 — full-width bottom bar; copyright no longer floats mid-footer. */}
      <div className="border-t border-gray-100 dark:border-border">
        <div className="mx-auto flex max-w-7xl flex-col items-center justify-between gap-2 px-6 py-5 text-xs text-gray-500 sm:flex-row dark:text-muted-foreground">
          <p>© 2026 LeaseUp · Built for college students.</p>
        </div>
      </div>
    </footer>
  );
}
