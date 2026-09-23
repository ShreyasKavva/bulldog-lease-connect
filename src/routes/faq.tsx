/**
 * /faq — answers to the questions students actually ask. Public, no auth.
 * Q475 — accessible accordion (real buttons, aria-expanded, keyboard-operable)
 * with FAQPage JSON-LD that matches the visible text exactly.
 *
 * Honesty rules: no "verified students" / ".edu verified" claims (school email
 * is not confirmed by an emailed link), no paid features, no "matching"
 * language, no invented stats.
 */
import { useState } from "react";
import { createFileRoute, Link } from "@tanstack/react-router";
import { ChevronDown } from "lucide-react";

const TITLE = "Frequently asked questions — LeaseUp";
const DESC =
  "Answers about posting a sublease, messaging a poster, the school-email badge, staying safe, and how subleasing works on LeaseUp.";

const FAQS: { q: string; a: React.ReactNode; ld: string }[] = [
  {
    q: "What is LeaseUp?",
    a: (
      <>
        LeaseUp is a sublease marketplace for college students. A student who needs to fill their
        room posts it; another student finds it and messages them directly. That is the whole
        product — no fees, no middleman.
      </>
    ),
    ld: "LeaseUp is a sublease marketplace for college students. A student who needs to fill their room posts it; another student finds it and messages them directly. That is the whole product — no fees, no middleman.",
  },
  {
    q: "Does it cost anything?",
    a: <>No. Posting a sublease and messaging a poster are both free, and messaging always will be.</>,
    ld: "No. Posting a sublease and messaging a poster are both free, and messaging always will be.",
  },
  {
    q: "How do I post a sublease?",
    a: (
      <>
        Sign up, then tap Post. You add a title, your campus, your dates, the monthly rent, a few
        photos and a short description — most people finish in about a minute. Your listing appears
        in browse as soon as you publish, and you can edit or remove it any time from My Listings.
      </>
    ),
    ld: "Sign up, then tap Post. You add a title, your campus, your dates, the monthly rent, a few photos and a short description — most people finish in about a minute. Your listing appears in browse as soon as you publish, and you can edit or remove it any time from My Listings.",
  },
  {
    q: "How does messaging work?",
    a: (
      <>
        Open a listing and tap Message. The conversation happens on LeaseUp and it is free. Keep
        the conversation here rather than moving straight to text or another app — if something
        goes wrong later, the on-platform thread is the record we can review.
      </>
    ),
    ld: "Open a listing and tap Message. The conversation happens on LeaseUp and it is free. Keep the conversation here rather than moving straight to text or another app — if something goes wrong later, the on-platform thread is the record we can review.",
  },
  {
    q: "Why is the map pin approximate?",
    a: (
      <>
        For the poster's privacy, the map shows an approximate area near campus, not the exact
        address — we never collect a street address for the public listing at all. Once you have
        connected with the poster in messages and you both feel comfortable, the poster shares the
        exact address with you directly.
      </>
    ),
    ld: "For the poster's privacy, the map shows an approximate area near campus, not the exact address — we never collect a street address for the public listing at all. Once you have connected with the poster in messages and you both feel comfortable, the poster shares the exact address with you directly.",
  },
  {
    q: "What does the heart / save button do?",
    a: (
      <>
        Tapping the heart saves a listing to your Saved page so you can find it again quickly.
        Saving is private — the poster is not told who saved their place.
      </>
    ),
    ld: "Tapping the heart saves a listing to your Saved page so you can find it again quickly. Saving is private — the poster is not told who saved their place.",
  },
  {
    q: "How do I edit or take down my listing?",
    a: (
      <>
        Go to My Listings. From there you can edit the details, mark the place as rented (which
        removes it from browse and adds a completed sublease to your profile), or delete the
        listing entirely. Changes take effect immediately.
      </>
    ),
    ld: "Go to My Listings. From there you can edit the details, mark the place as rented (which removes it from browse and adds a completed sublease to your profile), or delete the listing entirely. Changes take effect immediately.",
  },
  {
    q: "What does the school-email badge mean?",
    a: (
      <>
        It means the account was signed up with an address on a school domain (like .edu). It tells
        you the poster had access to a school inbox — nothing more. It is not an identity check, a
        background check, or a guarantee. Still meet in person, see the place, and trust your own
        judgement.
      </>
    ),
    ld: "It means the account was signed up with an address on a school domain (like .edu). It tells you the poster had access to a school inbox — nothing more. It is not an identity check, a background check, or a guarantee. Still meet in person, see the place, and trust your own judgement.",
  },
  {
    q: "How do I stay safe when subleasing from a stranger?",
    a: (
      <>
        Meet in daylight and bring a friend when you go to see a place. Never pay anything before
        you have seen the apartment in person and signed something. Never wire money, and never pay
        by gift card, cash transfer app to a stranger, or any method you cannot reverse — those are
        the hallmarks of a rental scam. If a poster pressures you to pay before a visit, walk away
        and report the listing.
      </>
    ),
    ld: "Meet in daylight and bring a friend when you go to see a place. Never pay anything before you have seen the apartment in person and signed something. Never wire money, and never pay by gift card, cash transfer app to a stranger, or any method you cannot reverse — those are the hallmarks of a rental scam. If a poster pressures you to pay before a visit, walk away and report the listing.",
  },
  {
    q: "How do I report a listing or a user?",
    a: (
      <>
        Every listing has a Report option — tap it, pick a reason, and add details if you want. You
        can report signed in or signed out, and we review every report. You can also email us at{" "}
        <a href="mailto:hi@leasup.co" className="font-medium text-primary underline">
          hi@leasup.co
        </a>
        .
      </>
    ),
    ld: "Every listing has a Report option — tap it, pick a reason, and add details if you want. You can report signed in or signed out, and we review every report. You can also email us at hi@leasup.co.",
  },
  {
    q: "Does LeaseUp handle the lease or the money?",
    a: (
      <>
        No. You and the other student agree the terms directly, the same as any sublease. Read your
        own lease first — most require your landlord's written sign-off before you can sublet.
      </>
    ),
    ld: "No. You and the other student agree the terms directly, the same as any sublease. Read your own lease first — most require your landlord's written sign-off before you can sublet.",
  },
];

const FAQ_LD = {
  "@context": "https://schema.org",
  "@type": "FAQPage",
  mainEntity: FAQS.map(({ q, ld }) => ({
    "@type": "Question",
    name: q,
    acceptedAnswer: { "@type": "Answer", text: ld },
  })),
};

export const Route = createFileRoute("/faq")({
  head: () => ({
    meta: [
      { title: TITLE },
      { name: "description", content: DESC },
      { property: "og:title", content: TITLE },
      { property: "og:description", content: DESC },
      { property: "og:type", content: "website" },
      { property: "og:url", content: "https://leasup.co/faq" },
      { name: "twitter:card", content: "summary" },
      { name: "twitter:title", content: TITLE },
      { name: "twitter:description", content: DESC },
    ],
    links: [{ rel: "canonical", href: "https://leasup.co/faq" }],
    scripts: [{ type: "application/ld+json", children: JSON.stringify(FAQ_LD) }],
  }),
  component: FaqPage,
});

function FaqPage() {
  // Multiple panels may be open at once; all closed by default.
  const [open, setOpen] = useState<ReadonlySet<number>>(new Set());

  const toggle = (i: number) =>
    setOpen((prev) => {
      const next = new Set(prev);
      if (next.has(i)) next.delete(i);
      else next.add(i);
      return next;
    });

  return (
    <div className="mx-auto max-w-3xl px-5 py-14 sm:px-6 sm:py-16">
      <h1 className="mb-3 text-3xl font-bold text-gray-900 sm:text-4xl dark:text-foreground">
        Frequently asked questions
      </h1>
      <p className="mb-8 leading-relaxed text-gray-600 dark:text-muted-foreground">
        The short version of how LeaseUp works. Something missing? Email{" "}
        <a href="mailto:hi@leasup.co" className="font-medium text-primary underline">
          hi@leasup.co
        </a>
        .
      </p>

      <div className="space-y-3">
        {FAQS.map(({ q, a }, i) => {
          const isOpen = open.has(i);
          return (
            <section
              key={q}
              className="overflow-hidden rounded-2xl border border-gray-100 dark:border-border"
            >
              <h2>
                <button
                  type="button"
                  aria-expanded={isOpen}
                  aria-controls={`faq-panel-${i}`}
                  id={`faq-button-${i}`}
                  onClick={() => toggle(i)}
                  className="flex min-h-11 w-full items-center justify-between gap-3 px-5 py-4 text-left text-base font-semibold text-gray-900 transition-colors hover:text-primary dark:text-foreground"
                >
                  {q}
                  <ChevronDown
                    className={`h-5 w-5 shrink-0 text-primary transition-transform ${isOpen ? "rotate-180" : ""}`}
                    aria-hidden="true"
                  />
                </button>
              </h2>
              {isOpen && (
                <div
                  id={`faq-panel-${i}`}
                  role="region"
                  aria-labelledby={`faq-button-${i}`}
                  className="px-5 pb-5 leading-relaxed text-gray-600 dark:text-muted-foreground"
                >
                  {a}
                </div>
              )}
            </section>
          );
        })}
      </div>

      <p className="mt-10 text-sm text-gray-600 dark:text-muted-foreground">
        Ready when you are —{" "}
        <Link to="/browse" className="font-medium text-primary underline">
          browse subleases
        </Link>{" "}
        or{" "}
        <Link to="/post" className="font-medium text-primary underline">
          post yours
        </Link>
        .
      </p>
    </div>
  );
}
