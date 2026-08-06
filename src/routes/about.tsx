/**
 * /about — plain-spoken story of why LeaseUp exists. Public, no auth.
 */
import { createFileRoute, Link } from "@tanstack/react-router";

const TITLE = "About LeaseUp — Student Sublease Marketplace";
const DESC =
  "LeaseUp is the sublease marketplace built for college students: verified .edu accounts, semester-ready dates, and direct messaging with no fees.";

export const Route = createFileRoute("/about")({
  head: () => ({
    meta: [
      { title: TITLE },
      { name: "description", content: DESC },
      { property: "og:title", content: TITLE },
      { property: "og:description", content: DESC },
      { property: "og:type", content: "website" },
      { property: "og:url", content: "https://leasup.co/about" },
      { name: "twitter:card", content: "summary" },
      { name: "twitter:title", content: TITLE },
      { name: "twitter:description", content: DESC },
    ],
    links: [{ rel: "canonical", href: "https://leasup.co/about" }],
  }),
  component: AboutPage,
});

const STATS = [
  { value: "55+", label: "active subleases" },
  { value: "3", label: "campuses" },
  { value: "2025", label: "founded" },
];

function AboutPage() {
  return (
    <div className="mx-auto max-w-3xl px-6 py-16">
      <h1 className="mb-4 text-3xl font-bold text-gray-900 dark:text-foreground">
        We're making student subleasing less terrible.
      </h1>

      <div className="space-y-6 text-lg leading-relaxed text-gray-600 dark:text-muted-foreground">
        <p>
          Every semester, thousands of college students need to sublease their apartment — maybe
          they're studying abroad, going home for the summer, or found somewhere better. And
          thousands more need a place near campus on a semester timeline.
        </p>
        <p>
          The problem? Craigslist is sketchy. Facebook Marketplace is chaotic. Property management
          companies don't do short-term. Students end up paying two rents or scrambling last minute.
        </p>
        <p>
          LeaseUp is the sublease marketplace built specifically for college students. Verified .edu
          accounts. Semester-ready dates. Direct messaging — no middleman, no application fee, no BS.
        </p>
      </div>

      <p className="mt-10 text-xl font-semibold text-gray-900 dark:text-foreground">
        Our mission: make it as easy to sublease your apartment as it is to post a photo.
      </p>

      <div className="mt-8 border-t border-gray-100 pt-8 dark:border-border">
        <div className="grid grid-cols-3 gap-4">
          {STATS.map((s) => (
            <div key={s.label}>
              <div className="text-2xl font-bold text-gray-900 dark:text-foreground">{s.value}</div>
              <div className="text-sm text-gray-500 dark:text-muted-foreground">{s.label}</div>
            </div>
          ))}
        </div>
      </div>

      <div className="mt-10">
        <Link
          to="/browse"
          className="inline-block rounded-full bg-gray-900 px-6 py-3 text-sm font-medium text-white hover:bg-black dark:bg-foreground dark:text-background"
        >
          Find a sublease near you →
        </Link>
      </div>
    </div>
  );
}
