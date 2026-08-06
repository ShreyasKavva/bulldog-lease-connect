/**
 * Q101 C6 — global footer. Minimal by design: wordmark + two link columns.
 * Hidden on full-screen flows (/post wizard, a single message thread) — the
 * same hide logic as the mobile bottom nav.
 */
import { Link, useRouterState } from "@tanstack/react-router";

const CAMPUSES: { label: string; slug: string }[] = [
  { label: "UGA", slug: "uga" },
  { label: "OSU", slug: "osu" },
  { label: "UT Austin", slug: "ut-austin" },
  { label: "Michigan", slug: "michigan" },
  { label: "USC", slug: "usc" },
];

const headingCls = "mb-3 text-xs font-semibold uppercase tracking-wider text-muted-foreground";
const linkCls = "block py-1 text-sm text-muted-foreground transition-colors hover:text-foreground";

export function Footer() {
  const path = useRouterState({ select: (s) => s.location.pathname });
  const hidden =
    path === "/post" ||
    path.startsWith("/post/") ||
    (path.startsWith("/messages/") && path !== "/messages");
  if (hidden) return null;

  return (
    <footer className="mt-16 border-t border-border bg-surface px-6 py-10">
      <div className="mx-auto grid max-w-7xl gap-10 md:grid-cols-3">
        <div>
          <p className="text-lg font-bold text-foreground">LeaseUp</p>
          <p className="mt-1 text-sm text-muted-foreground">Find a sublease. Move in easy.</p>
          <p className="mt-4 text-xs text-muted-foreground/80">© 2026 LeaseUp</p>
        </div>

        <div>
          <h2 className={headingCls}>Explore</h2>
          <Link to="/browse" className={linkCls}>Browse subleases</Link>
          <Link to="/post" className={linkCls}>Post a sublease</Link>
          <Link to="/saved" className={linkCls}>Saved</Link>
          <Link to="/my-listings" className={linkCls}>My listings</Link>
        </div>

        <div>
          <h2 className={headingCls}>Campuses</h2>
          {CAMPUSES.map((c) => (
            <Link key={c.slug} to="/campus/$slug" params={{ slug: c.slug }} className={linkCls}>
              {c.label}
            </Link>
          ))}
        </div>
      </div>
    </footer>
  );
}
