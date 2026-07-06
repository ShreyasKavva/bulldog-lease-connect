import { createFileRoute, Link } from "@tanstack/react-router";
import { Check, Circle, Mail, Instagram, ArrowRight, ShieldCheck } from "lucide-react";

export const Route = createFileRoute("/about")({
  head: () => ({
    meta: [
      { title: "About | LeaseUp — Student Sublease Marketplace" },
      {
        name: "description",
        content:
          "LeaseUp is a free sublease marketplace for college students. Verified .edu students, no middlemen, no fees. Starting at the University of Georgia.",
      },
      { property: "og:title", content: "About | LeaseUp — Student Sublease Marketplace" },
      {
        property: "og:description",
        content:
          "LeaseUp is a free sublease marketplace for college students. Verified .edu students, no middlemen, no fees. Starting at the University of Georgia.",
      },
      { property: "og:type", content: "website" },
      { property: "og:url", content: "https://leasup.co/about" },
    ],
    links: [{ rel: "canonical", href: "https://leasup.co/about" }],
  }),
  component: AboutPage,
});

function AboutPage() {
  return (
    <div className="mx-auto max-w-3xl px-4 py-10 md:py-16">
      {/* PART A: Hero */}
      <section className="space-y-4">
        <h1 className="text-3xl font-bold leading-tight text-foreground md:text-4xl">
          We built LeaseUp because this problem is real.
        </h1>
        <p className="text-base leading-relaxed text-muted-foreground md:text-lg">
          Every May, thousands of students leave for internships and summer jobs while still paying rent on apartments that sit empty. The standard options — Facebook Marketplace, Craigslist, GroupMe posts — don't verify that you're a student, don't connect subleases with renters looking for them, and have no accountability when something goes wrong. We're building the thing that should have existed five years ago: a simple, verified marketplace just for students.
        </p>
      </section>

      {/* PART B: Why It's Free */}
      <section className="mt-14 space-y-4">
        <h2 className="text-xl font-bold text-foreground md:text-2xl">Why is it free?</h2>
        <div className="space-y-3 text-muted-foreground">
          <p>
            LeaseUp is free because sublease fees are how landlords and middlemen exploit students. We don't want to be one of them.
          </p>
          <p>
            How do we stay free? Right now, we're a small team focused on making this work at one campus. When we're bigger, we'll figure out a business model that doesn't penalize renters or listers.
          </p>
          <p className="font-semibold text-foreground">
            We commit to this: messaging between students will never cost money.
          </p>
        </div>
      </section>

      {/* PART C: How .edu Verification Works */}
      <section className="mt-14 space-y-4">
        <div className="flex items-center gap-2">
          <ShieldCheck className="h-5 w-5 text-primary" />
          <h2 className="text-xl font-bold text-foreground md:text-2xl">How does .edu verification work?</h2>
        </div>
        <div className="space-y-3 text-muted-foreground">
          <p>
            When you sign in with your university Google account (your .edu email), we can confirm you're a current student at that school. We don't store your academic records or GPA — we just check the email domain.
          </p>
          <p>
            Students who sign in with @uga.edu get a "✓ Verified UGA Student" badge on their profile and listings.
          </p>
          <p>
            Non-.edu sign-ins can still browse and post — but verified users are shown more prominently.
          </p>
        </div>
      </section>

      {/* PART D: The Team Section */}
      <section className="mt-14 space-y-4">
        <h2 className="text-xl font-bold text-foreground md:text-2xl">Who we are</h2>
        <div className="space-y-3 text-muted-foreground">
          <p>
            We're students and recent grads who've dealt with this exact problem. LeaseUp started at the University of Georgia and we're expanding one campus at a time.
          </p>
          <div className="flex flex-col gap-2 pt-1 text-sm text-muted-foreground">
            <div className="flex items-center gap-2">
              <Mail className="h-4 w-4 shrink-0" />
              <span>
                Questions? Feedback? Email us at:{" "}
                <a href="mailto:hello@leasup.co" className="font-medium text-primary underline underline-offset-2 hover:text-primary-dark">
                  hello@leasup.co
                </a>
              </span>
            </div>
            <div className="flex items-center gap-2">
              <Instagram className="h-4 w-4 shrink-0" />
              <span>
                Or DM us on Instagram:{" "}
                <a
                  href="https://instagram.com/leasup"
                  target="_blank"
                  rel="noopener noreferrer"
                  className="font-medium text-primary underline underline-offset-2 hover:text-primary-dark"
                >
                  @leasup
                </a>
              </span>
            </div>
          </div>
        </div>
      </section>

      {/* PART E: Campus Roadmap */}
      <section className="mt-14 space-y-4">
        <h2 className="text-xl font-bold text-foreground md:text-2xl">Where we are now</h2>
        <ul className="space-y-3">
          <li className="flex items-center gap-3">
            <Check className="h-5 w-5 shrink-0 text-success" />
            <span className="text-foreground">University of Georgia — Live</span>
          </li>
          <li className="flex items-center gap-3">
            <Circle className="h-5 w-5 shrink-0 text-muted-foreground" />
            <span className="text-muted-foreground">Georgia Tech — Coming soon</span>
          </li>
          <li className="flex items-center gap-3">
            <Circle className="h-5 w-5 shrink-0 text-muted-foreground" />
            <span className="text-muted-foreground">University of Florida — Coming soon</span>
          </li>
          <li className="flex items-center gap-3">
            <Circle className="h-5 w-5 shrink-0 text-muted-foreground" />
            <span className="text-muted-foreground">Auburn University — Coming soon</span>
          </li>
        </ul>
        <p className="pt-1 text-sm text-muted-foreground">
          Want LeaseUp at your school?{" "}
          <Link
            to="/ambassador"
            className="font-medium text-primary underline underline-offset-2 hover:text-primary-dark"
          >
            Apply to be a campus ambassador →
          </Link>
        </p>
      </section>

      {/* PART F: Footer CTAs */}
      <section className="mt-14 grid gap-4 sm:grid-cols-3">
        <CtaCard
          text="Ready to find a sublease?"
          to="/browse"
          label="Browse listings"
        />
        <CtaCard
          text="Have one to list?"
          to="/post"
          label="Post for free"
        />
        <CtaCard
          text="Want to bring us to your campus?"
          to="/ambassador"
          label="Become an ambassador"
        />
      </section>
    </div>
  );
}

function CtaCard({ text, to, label }: { text: string; to: string; label: string }) {
  return (
    <Link
      to={to as any}
      className="group flex flex-col gap-2 rounded-xl border border-border bg-surface p-5 transition hover:border-primary hover:shadow-card"
    >
      <span className="text-sm text-muted-foreground">{text}</span>
      <span className="inline-flex items-center gap-1 text-sm font-semibold text-primary">
        {label}
        <ArrowRight className="h-4 w-4 transition group-hover:translate-x-0.5" />
      </span>
    </Link>
  );
}
