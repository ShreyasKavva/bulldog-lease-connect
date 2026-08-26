/**
 * Q106 Part C — global footer. 4 columns on desktop, 2 on tablet, stacked on
 * mobile. Campus column is data-driven: top 6 campuses by active listings.
 * Hidden on full-screen flows (/post wizard, a single message thread).
 */
import { Link, useRouterState } from "@tanstack/react-router";
import { useQuery } from "@tanstack/react-query";
import { ArrowUpRight, Instagram, Twitter } from "lucide-react";
import { fetchCampuses } from "@/lib/leaseup/campuses";
import { fetchCampusListingCounts } from "@/lib/leaseup/queries";

const headingCls = "mb-3 text-xs font-semibold uppercase tracking-wider text-muted-foreground";
const linkCls = "block py-1 text-sm text-muted-foreground transition-colors hover:text-foreground";

export function Footer() {
  const path = useRouterState({ select: (s) => s.location.pathname });
  const hidden =
    path === "/post" ||
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

  const topCampuses = campuses
    .map((c) => ({ ...c, n: counts?.get(c.id) ?? 0 }))
    .filter((c) => c.n > 0)
    .sort((a, b) => b.n - a.n)
    .slice(0, 12);


  return (
    <footer className="mt-16 border-t border-gray-100 bg-gray-50 px-6 py-12 dark:border-border dark:bg-surface">
      <div className="mx-auto grid max-w-7xl gap-10 sm:grid-cols-2 lg:grid-cols-4">
        {/* Brand */}
        <div>
          <p className="text-lg font-bold text-gray-900 dark:text-foreground">LeaseUp</p>
          <p className="mt-1 text-sm text-gray-500 dark:text-muted-foreground">Sublease near your campus.</p>
          <div className="mt-4 flex items-center gap-3">
            <a
              href="https://instagram.com/leasup"
              target="_blank"
              rel="noreferrer"
              aria-label="LeaseUp on Instagram"
              className="grid h-9 w-9 place-items-center rounded-full border border-gray-200 text-muted-foreground transition-colors hover:text-foreground dark:border-border"
            >
              <Instagram className="h-4 w-4" />
            </a>
            <a
              href="https://x.com/leasup"
              target="_blank"
              rel="noreferrer"
              aria-label="LeaseUp on X"
              className="grid h-9 w-9 place-items-center rounded-full border border-gray-200 text-muted-foreground transition-colors hover:text-foreground dark:border-border"
            >
              <Twitter className="h-4 w-4" />
            </a>
          </div>
          <p className="mt-4 text-xs text-gray-400">© 2026 LeaseUp</p>
        </div>

        {/* For Students */}
        <div>
          <h2 className={headingCls}>For Students</h2>
          <Link to="/browse" className={linkCls}>Browse subleases</Link>
          <Link to="/post" className={linkCls}>Post a sublease</Link>
          <Link to="/looking" className={linkCls}>Roommate Search</Link>
          
        </div>

        {/* Top Campuses */}
        <div>
          <h2 className={headingCls}>Top Campuses</h2>
          {topCampuses.length === 0 ? (
            <Link to="/campuses" className={linkCls}>All campuses</Link>
          ) : (
            topCampuses.map((c) => (
              <Link
                key={c.id}
                to="/campus/$slug"
                params={{ slug: c.slug }}
                className={linkCls}
              >
                {c.name}
              </Link>
            ))
          )}
        </div>

        {/* Company */}
        <div>
          <h2 className={headingCls}>Company</h2>
          <Link to="/about" className={linkCls}>About</Link>
          <a href="mailto:hi@leasup.co" className={linkCls}>hi@leasup.co</a>
          <a
            href="https://leasup.co"
            target="_blank"
            rel="noreferrer"
            className={`${linkCls} inline-flex items-center gap-1`}
          >
            leasup.co <ArrowUpRight className="h-3 w-3" />
          </a>
          <p className="mt-2 text-xs text-gray-400">Built for college students.</p>

        </div>
      </div>
    </footer>
  );
}
