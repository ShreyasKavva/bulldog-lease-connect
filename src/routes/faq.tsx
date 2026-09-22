/**
 * /faq — answers to the questions students actually ask. Public, no auth.
 */
import { createFileRoute } from "@tanstack/react-router";

const TITLE = "Frequently asked questions — LeaseUp";
const DESC =
  "Answers about posting a sublease, messaging a poster, the school-email badge, and how subleasing works on LeaseUp.";

const FAQS: { q: string; a: string }[] = [
  {
    q: "What is LeaseUp?",
    a: "A place for students to sublease their room to another student. Someone posts the place they need to fill; someone else messages them directly. That is the whole product.",
  },
  {
    q: "Does it cost anything?",
    a: "No. Posting a sublease and messaging a poster are both free.",
  },
  {
    q: "Who can post?",
    a: "Students. You sign up with your school email and post the place you are trying to fill.",
  },
  {
    q: "What does the school-email badge mean?",
    a: "It means the address you signed up with ends in your school's domain. It is not an identity check, and it does not mean we have confirmed who someone is. Meet in person, see the place, and trust your own judgement.",
  },
  {
    q: "How do I contact a poster?",
    a: "Open the listing and hit Message. The conversation stays on LeaseUp so you have a record of it. Keep it here rather than moving to text — if something goes wrong, the thread is the evidence.",
  },
  {
    q: "Does LeaseUp handle the lease or the money?",
    a: "No. You and the other student agree the terms directly, the same as any sublease. Read your own lease first — most require your landlord's sign-off to sublet.",
  },
  {
    q: "How do I take my listing down?",
    a: "Go to My Listings and remove it. It disappears from browse immediately.",
  },
  {
    q: "Something looks wrong on a listing.",
    a: "Every listing has a Report link at the bottom. Use it, or email hi@leasup.co.",
  },
];

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
  }),
  component: FaqPage,
});

function FaqPage() {
  return (
    <div className="mx-auto max-w-3xl px-5 py-14 sm:px-6 sm:py-16">
      <h1 className="mb-8 text-3xl font-bold text-gray-900 dark:text-foreground sm:text-4xl">
        Frequently asked questions
      </h1>

      <div className="space-y-4">
        {FAQS.map(({ q, a }) => (
          <section key={q} className="rounded-2xl border border-gray-100 p-5 dark:border-border">
            <h2 className="mb-2 text-lg font-semibold text-primary">{q}</h2>
            <p className="leading-relaxed text-gray-600 dark:text-muted-foreground">{a}</p>
          </section>
        ))}
      </div>
    </div>
  );
}
