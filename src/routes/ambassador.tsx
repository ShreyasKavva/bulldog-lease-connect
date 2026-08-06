import { createFileRoute, Link, useSearch } from "@tanstack/react-router";
import { useState } from "react";
import { useServerFn } from "@tanstack/react-start";
import { z } from "zod";
import { submitAmbassadorApplication } from "@/lib/leaseup/ambassador-apply.functions";
import { Sparkles, Megaphone, MessageSquare, CheckCircle2 } from "lucide-react";

const searchSchema = z.object({ campus: z.string().optional() });

export const Route = createFileRoute("/ambassador")({
  validateSearch: searchSchema,
  head: () => ({
    meta: [
      { title: "Campus Ambassador Program | LeaseUp" },
      {
        name: "description",
        content:
          "Help bring LeaseUp to your campus. Be the first to post subleases and help students find housing.",
      },
      { property: "og:title", content: "Campus Ambassador Program | LeaseUp" },
      {
        property: "og:description",
        content:
          "Help bring LeaseUp to your campus. Be the first to post subleases and help students find housing.",
      },
      { property: "og:type", content: "website" },
      { name: "twitter:card", content: "summary" },
    ],
  }),
  component: AmbassadorLandingPage,
});

function prettyCampus(slug?: string) {
  if (!slug) return "your school";
  return slug
    .split("-")
    .map((w) => w.charAt(0).toUpperCase() + w.slice(1))
    .join(" ");
}

function AmbassadorLandingPage() {
  const { campus } = useSearch({ from: "/ambassador" });
  const school = prettyCampus(campus);

  return (
    <div className="min-h-screen bg-background pb-24">
      <main className="mx-auto max-w-2xl px-4 pt-20">
        <div className="inline-flex items-center gap-2 rounded-full bg-primary-light px-3 py-1 text-xs font-bold text-primary-dark">
          <Sparkles className="h-3.5 w-3.5" /> Campus Ambassador Program
        </div>
        <h1 className="mt-4 text-4xl font-black leading-tight tracking-tight sm:text-5xl">
          Be the first to bring LeaseUp to your campus.
        </h1>
        <p className="mt-4 text-lg text-muted-foreground">
          We're launching at one campus at a time. If you're at {school} and want to help
          students stop overpaying rent — here's how.
        </p>

        {/* Part B: What ambassadors do */}
        <section className="mt-10 space-y-4">
          <h2 className="text-sm font-bold uppercase tracking-wide text-muted-foreground">
            What ambassadors do
          </h2>
          <DoCard
            icon={<Megaphone className="h-5 w-5" />}
            title="Post the first listings"
            body="Sublease something yourself or help 2–3 friends post theirs. That's the seed that makes the campus page feel real."
          />
          <DoCard
            icon={<MessageSquare className="h-5 w-5" />}
            title="Spread the word"
            body="Share the campus page in your GroupMe, Discord, or class group chat. One post at the right time can drive 20+ sign-ups."
          />
          <DoCard
            icon={<CheckCircle2 className="h-5 w-5" />}
            title="Give feedback"
            body="You're on the ground. We're not. Tell us what works, what doesn't, and what students at your school actually need."
          />
        </section>

        {/* Part C: What ambassadors get */}
        <section className="mt-10 rounded-2xl bg-surface p-6 shadow-card-md">
          <h2 className="text-base font-black">What you get</h2>
          <ul className="mt-3 space-y-2 text-sm">
            <li>→ Your name in the campus page credits ("Brought to [Campus] by [Name]")</li>
            <li>→ First to know about every new feature before it ships</li>
            <li>→ Direct line to the founders — your feedback shapes the product</li>
            <li>→ A reference if you're applying to startups, product roles, or housing companies</li>
          </ul>
          <p className="mt-4 text-xs text-muted-foreground">
            Compensation details vary. Mention it in your application and we'll talk.
          </p>
        </section>

        {/* Part D: Application form */}
        <section id="apply" className="mt-10">
          <h2 className="text-2xl font-black">Apply</h2>
          <p className="mt-1 text-sm text-muted-foreground">Takes about a minute.</p>
          <ApplicationForm defaultSchool={campus ? school : ""} />
        </section>

        {/* Part E: Social proof / context */}
        <section className="mt-12 rounded-2xl border border-border bg-background p-6">
          <h2 className="text-base font-black">Why campus-by-campus?</h2>
          <p className="mt-2 text-sm text-muted-foreground">
            Facebook Marketplace works everywhere but trusts no one. We're building the
            opposite — a small, verified community at each school where everyone's a real
            student. That only works if the first 20 people are real. Ambassadors are how
            we get there.
          </p>
        </section>

        {/* Part F: Footer CTAs */}
        <section className="mt-10 grid gap-3 sm:grid-cols-2">
          <Link
            to="/sublease/$slug"
            params={{ slug: "university-of-georgia" }}
            className="rounded-2xl bg-surface p-4 text-sm font-semibold shadow-card-md hover:bg-primary-light"
          >
            Already at UGA? → Browse subleases
          </Link>
          <Link
            to="/post"
            className="rounded-2xl bg-primary p-4 text-sm font-bold text-primary-foreground shadow-card-md hover:bg-primary-dark"
          >
            Have a sublease to post? → Post for free
          </Link>
        </section>
      </main>
    </div>
  );
}

function DoCard({ icon, title, body }: { icon: React.ReactNode; title: string; body: string }) {
  return (
    <div className="flex gap-3 rounded-2xl bg-surface p-4 shadow-card-md">
      <div className="grid h-9 w-9 shrink-0 place-items-center rounded-xl bg-primary-light text-primary-dark">
        {icon}
      </div>
      <div>
        <div className="text-sm font-bold">{title}</div>
        <p className="mt-0.5 text-sm text-muted-foreground">{body}</p>
      </div>
    </div>
  );
}

function ApplicationForm({ defaultSchool }: { defaultSchool: string }) {
  const submit = useServerFn(submitAmbassadorApplication);
  const [state, setState] = useState<{ status: "idle" | "submitting" | "success" | "error"; error?: string }>({
    status: "idle",
  });
  const [form, setForm] = useState({
    name: "",
    school: defaultSchool,
    email: "",
    reason: "",
    committed_to_post: false,
  });

  async function onSubmit(e: React.FormEvent) {
    e.preventDefault();
    setState({ status: "submitting" });
    try {
      await submit({ data: form });
      setState({ status: "success" });
    } catch (err) {
      setState({
        status: "error",
        error: err instanceof Error ? err.message : "Something went wrong",
      });
    }
  }

  if (state.status === "success") {
    return (
      <div className="mt-4 rounded-2xl bg-primary-light p-6 text-center">
        <CheckCircle2 className="mx-auto h-8 w-8 text-primary-dark" />
        <p className="mt-2 text-base font-bold text-primary-dark">
          Got it — we'll reply within 48 hours.
        </p>
      </div>
    );
  }

  return (
    <form onSubmit={onSubmit} className="mt-4 space-y-3">
      <Field label="Your name">
        <input
          required
          maxLength={120}
          value={form.name}
          onChange={(e) => setForm({ ...form, name: e.target.value })}
          className="w-full rounded-xl border border-border bg-background px-3 py-2 text-sm"
        />
      </Field>
      <Field label="Your school">
        <input
          required
          maxLength={160}
          placeholder="e.g. Georgia Tech"
          value={form.school}
          onChange={(e) => setForm({ ...form, school: e.target.value })}
          className="w-full rounded-xl border border-border bg-background px-3 py-2 text-sm"
        />
      </Field>
      <Field label="Your email">
        <input
          required
          type="email"
          maxLength={255}
          value={form.email}
          onChange={(e) => setForm({ ...form, email: e.target.value })}
          className="w-full rounded-xl border border-border bg-background px-3 py-2 text-sm"
        />
      </Field>
      <Field label="Why do you want to bring LeaseUp to your campus?">
        <textarea
          required
          maxLength={300}
          rows={4}
          value={form.reason}
          onChange={(e) => setForm({ ...form, reason: e.target.value })}
          className="w-full rounded-xl border border-border bg-background px-3 py-2 text-sm"
        />
        <div className="mt-1 text-right text-[11px] text-muted-foreground">
          {form.reason.length}/300
        </div>
      </Field>
      <label className="flex items-start gap-2 rounded-xl bg-surface p-3 text-sm">
        <input
          type="checkbox"
          checked={form.committed_to_post}
          onChange={(e) => setForm({ ...form, committed_to_post: e.target.checked })}
          className="mt-0.5 h-4 w-4"
        />
        <span>I'm willing to post at least 2 listings or help friends post within the first week</span>
      </label>
      {state.status === "error" && (
        <div className="rounded-xl bg-destructive/10 p-3 text-sm text-destructive">
          {state.error}
        </div>
      )}
      <button
        type="submit"
        disabled={state.status === "submitting"}
        className="w-full rounded-2xl bg-primary px-5 py-3.5 text-base font-extrabold text-primary-foreground shadow-card-md hover:bg-primary-dark disabled:opacity-60"
      >
        {state.status === "submitting" ? "Submitting…" : "Apply to be a LeaseUp Ambassador →"}
      </button>
    </form>
  );
}

function Field({ label, children }: { label: string; children: React.ReactNode }) {
  return (
    <label className="block">
      <div className="mb-1 text-xs font-bold uppercase tracking-wide text-muted-foreground">
        {label}
      </div>
      {children}
    </label>
  );
}
