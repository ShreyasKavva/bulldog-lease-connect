/**
 * /about — plain-spoken story of why LeaseUp exists. Public, no auth.
 */
import { createFileRoute } from "@tanstack/react-router";

const TITLE = "About LeaseUp — Student Sublease Marketplace";
const DESC =
  "LeaseUp is the sublease marketplace built for college students: school email sign-up, semester-ready dates, and direct messaging with no fees.";

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

function AboutPage() {
  return (
    <div className="mx-auto max-w-3xl px-5 py-14 sm:px-6 sm:py-16">
      <h1 className="mb-8 text-3xl font-bold text-gray-900 dark:text-foreground sm:text-4xl">
        Why we built LeaseUp
      </h1>

      <div className="space-y-10">
        <section>
          <h2 className="mb-2 text-xl font-semibold text-gray-900 dark:text-foreground">
            The problem
          </h2>
          <p className="text-lg leading-relaxed text-gray-600 dark:text-muted-foreground">
            Every year, thousands of college students scramble to sublet their apartments before
            leaving for the summer or semester abroad — and thousands more desperately search for
            short-term housing near campus. They end up on Craigslist, Facebook groups, or random
            Reddit threads. It's chaotic, sketchy, and slow.
          </p>
        </section>

        <section>
          <h2 className="mb-2 text-xl font-semibold text-gray-900 dark:text-foreground">
            Our solution
          </h2>
          <p className="text-lg leading-relaxed text-gray-600 dark:text-muted-foreground">
            LeaseUp is the student sublease marketplace built for how college housing actually
            works. Semester-length stays. School email sign-up. Direct messages to real hosts — no
            agents, no middlemen, no fees. Post your sublease in 2 minutes. Find one in seconds.
          </p>
        </section>

        <section>
          <h2 className="mb-2 text-xl font-semibold text-gray-900 dark:text-foreground">
            Who we are
          </h2>
          <p className="text-lg leading-relaxed text-gray-600 dark:text-muted-foreground">
            We're students who lived this problem. LeaseUp started at the University of Georgia, and
            right now we're focused on doing each campus right — real listings, real students, real
            trust — before we grow.
          </p>
        </section>
      </div>

      <div className="mt-12 border-t border-gray-100 pt-8 dark:border-border">
        <p className="text-lg font-semibold text-gray-900 dark:text-foreground">
          Want LeaseUp at your campus?
        </p>
        <a
          href="mailto:hi@leasup.co"
          className="mt-4 inline-block rounded-full bg-gray-900 px-6 py-3 text-sm font-semibold text-white hover:bg-black dark:bg-foreground dark:text-background"
        >
          Email us at hi@leasup.co →
        </a>
      </div>
    </div>
  );
}

