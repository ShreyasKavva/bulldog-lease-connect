import { Link } from "@tanstack/react-router";
import { Shield, MessageSquare, FileText, MapPin, Sparkles, ArrowRight, Eye, BadgeCheck } from "lucide-react";

export function LandingPage() {
  return (
    <div className="min-h-screen bg-background text-foreground">
      {/* Nav */}
      <header className="sticky top-0 z-30 border-b bg-background/85 backdrop-blur">
        <div className="mx-auto flex max-w-7xl items-center justify-between px-5 py-4">
          <div className="flex items-center gap-2">
            <span className="grid h-8 w-8 place-items-center rounded-lg bg-primary text-base font-extrabold text-primary-foreground">L</span>
            <span className="text-lg font-extrabold tracking-tight">LeaseUp</span>
          </div>
          <nav className="hidden items-center gap-7 text-sm font-semibold text-muted-foreground md:flex">
            <a href="#features" className="hover:text-foreground">Features</a>
            <a href="#how" className="hover:text-foreground">How it works</a>
            <a href="#trust" className="hover:text-foreground">Trust</a>
          </nav>
          <div className="flex items-center gap-2">
            <Link to="/auth" search={{ mode: "in" }} className="hidden rounded-md px-3 py-2 text-sm font-bold text-foreground hover:bg-surface sm:inline-flex">Sign in</Link>
            <Link to="/auth" search={{ mode: "up" }} className="inline-flex items-center gap-1 rounded-md bg-primary px-4 py-2 text-sm font-bold text-primary-foreground hover:bg-primary-dark">
              Get started <ArrowRight className="h-3.5 w-3.5" />
            </Link>
          </div>
        </div>
      </header>

      {/* Hero */}
      <section className="relative overflow-hidden border-b">
        <div className="absolute inset-0 -z-10 bg-[radial-gradient(circle_at_top_right,theme(colors.primary/20),transparent_55%)]" />
        <div className="mx-auto grid max-w-7xl items-center gap-12 px-5 py-20 lg:grid-cols-2 lg:py-28">
          <div>
            <div className="inline-flex items-center gap-2 rounded-full border bg-surface px-3 py-1 text-xs font-bold text-muted-foreground">
              <Sparkles className="h-3.5 w-3.5 text-primary" /> Built for students · Free at every campus
            </div>
            <h1 className="mt-5 text-5xl font-extrabold leading-[1.05] tracking-tight sm:text-6xl">
              Student subleases <span className="text-primary">without the sketch.</span>
            </h1>
            <p className="mt-5 max-w-xl text-lg text-muted-foreground">
              Verified <span className="font-semibold text-foreground">.edu</span> profiles, a SafeScore on every listing, and an AI that reads your lease before you sign. LeaseUp is the trust layer on top of every "anyone need a sublease?" group chat — at every campus.
            </p>
            <div className="mt-7 flex flex-wrap gap-3">
              <Link to="/auth" search={{ mode: "up" }} className="inline-flex items-center gap-1 rounded-lg bg-primary px-5 py-3 text-sm font-bold text-primary-foreground shadow-card hover:bg-primary-dark">
                Browse listings <ArrowRight className="h-4 w-4" />
              </Link>
              <Link to="/auth" search={{ mode: "up" }} className="inline-flex items-center rounded-lg border bg-surface px-5 py-3 text-sm font-bold hover:bg-background">
                Post a sublease — free
              </Link>
            </div>
            <div className="mt-6 flex flex-wrap items-center gap-5 text-xs font-semibold text-muted-foreground">
              <span className="flex items-center gap-1.5"><BadgeCheck className="h-4 w-4 text-success" /> Verified .edu emails</span>
              <span className="flex items-center gap-1.5"><Shield className="h-4 w-4 text-primary" /> SafeScore on every listing</span>
              <span className="flex items-center gap-1.5"><Eye className="h-4 w-4" /> Every major US campus</span>
            </div>
          </div>

          {/* Mock phone */}
          <div className="relative mx-auto w-full max-w-md">
            <div className="rounded-[2.5rem] border-8 border-foreground/90 bg-foreground/90 shadow-card-lg">
              <div className="overflow-hidden rounded-[2rem] bg-background">
                <div className="aspect-[9/16] bg-gradient-to-br from-primary/15 via-background to-background p-5">
                  <div className="flex items-center justify-between text-xs font-bold text-muted-foreground">
                    <span>9:41</span><span>LeaseUp</span>
                  </div>
                  <div className="mt-6 space-y-3">
                    {[
                      { p: 720, t: "Spring sublease near North Campus", sc: 92, area: "Five Points" },
                      { p: 540, t: "1BR @ The Mark — utilities incl.", sc: 84, area: "Downtown" },
                      { p: 875, t: "Lease transfer · The Standard", sc: 78, area: "East Campus" },
                    ].map((l, i) => (
                      <div key={i} className="rounded-xl bg-surface p-3 shadow-card">
                        <div className="flex items-baseline justify-between">
                          <div className="text-base font-extrabold">${l.p}<span className="text-[10px] font-medium text-muted-foreground">/mo</span></div>
                          <span className="rounded-full bg-success-light px-2 py-0.5 text-[10px] font-bold text-success">SafeScore {l.sc}</span>
                        </div>
                        <div className="mt-1 line-clamp-1 text-sm font-bold">{l.t}</div>
                        <div className="mt-1 flex items-center gap-1 text-[11px] text-muted-foreground">
                          <MapPin className="h-3 w-3" />{l.area}
                        </div>
                      </div>
                    ))}
                  </div>
                </div>
              </div>
            </div>
          </div>
        </div>
      </section>

      {/* Stats strip */}
      <section className="border-b bg-surface">
        <div className="mx-auto grid max-w-7xl grid-cols-2 gap-6 px-5 py-8 text-center sm:grid-cols-4">
          {[
            ["100%", ".edu verified"],
            ["0", "scam complaints"],
            ["<2 min", "to post"],
            ["AI", "lease review"],
          ].map(([n, l]) => (
            <div key={l}>
              <div className="text-3xl font-extrabold text-primary">{n}</div>
              <div className="mt-1 text-xs font-semibold uppercase tracking-wide text-muted-foreground">{l}</div>
            </div>
          ))}
        </div>
      </section>

      {/* Features */}
      <section id="features" className="mx-auto max-w-7xl px-5 py-20">
        <div className="mx-auto max-w-2xl text-center">
          <h2 className="text-4xl font-extrabold tracking-tight">Everything Instagram DMs aren't.</h2>
          <p className="mt-3 text-muted-foreground">A real product instead of a "looking for a sublease 🥺" story.</p>
        </div>
        <div className="mt-12 grid gap-5 md:grid-cols-3">
          {[
            { i: BadgeCheck, t: ".edu verified profiles", d: "Sign up with your campus email. No randos, no bots, no off-campus landlords pretending to be students." },
            { i: Shield, t: "SafeScore on every listing", d: "Photos, lease terms, verified email, profile completeness — graded automatically so you know what you're walking into." },
            { i: FileText, t: "AI lease analysis", d: "Upload the lease, get plain-English flags on the sketchy clauses before you sign. Built into your account." },
            { i: MessageSquare, t: "Built-in messaging", d: "Talk to the lister inside LeaseUp. No more giving your number to a stranger from a Reddit post." },
            { i: MapPin, t: "Map + scroll view", d: "Browse a Five Points walkup on a map or thumb through listings like TikTok. Whatever your vibe." },
            { i: Sparkles, t: "Find My Match", d: "Tell us your budget, beds, and dates. Get notified the moment something fits." },
          ].map(({ i: Icon, t, d }) => (
            <div key={t} className="rounded-2xl border bg-surface p-6 shadow-card transition hover:shadow-card-md">
              <div className="grid h-11 w-11 place-items-center rounded-xl bg-primary-light text-primary-dark">
                <Icon className="h-5 w-5" />
              </div>
              <h3 className="mt-4 text-lg font-extrabold">{t}</h3>
              <p className="mt-1.5 text-sm text-muted-foreground">{d}</p>
            </div>
          ))}
        </div>
      </section>

      {/* How it works */}
      <section id="how" className="border-y bg-surface">
        <div className="mx-auto max-w-7xl px-5 py-20">
          <div className="mx-auto max-w-2xl text-center">
            <h2 className="text-4xl font-extrabold tracking-tight">Sign your lease without losing $1,800.</h2>
          </div>
          <div className="mt-12 grid gap-6 md:grid-cols-3">
            {[
              ["01", "Verify your .edu", "Sign up with your campus email. We auto-detect your school and mark you verified."],
              ["02", "Browse with SafeScore", "Every listing shows trust signals. Sort by price, area, dates, furnished — find your fit."],
              ["03", "Run it through AI", "Before signing, drop the lease into the analyzer. Get flags on early termination, deposit, and fee clauses."],
            ].map(([n, t, d]) => (
              <div key={n} className="rounded-2xl bg-background p-6 shadow-card">
                <div className="text-sm font-extrabold text-primary">{n}</div>
                <h3 className="mt-2 text-lg font-extrabold">{t}</h3>
                <p className="mt-2 text-sm text-muted-foreground">{d}</p>
              </div>
            ))}
          </div>
        </div>
      </section>

      {/* Trust */}
      <section id="trust" className="mx-auto max-w-7xl px-5 py-20">
        <div className="grid items-center gap-10 lg:grid-cols-2">
          <div>
            <h2 className="text-4xl font-extrabold tracking-tight">Why students trust LeaseUp.</h2>
            <p className="mt-4 text-muted-foreground">
              Scams in the student sublease market are everywhere — fake listings, deposits sent over Venmo, "landlords" who ghost.
              LeaseUp puts identity, accountability, and AI between you and a bad lease.
            </p>
            <ul className="mt-6 space-y-3 text-sm">
              {[
                "Real students only — .edu email required",
                "Listings auto-graded for completeness and red flags",
                "Reports + admin moderation queue on every listing",
                "Privacy-first messaging — your phone stays yours",
                "Lease analysis powered by GPT-class models",
              ].map((x) => (
                <li key={x} className="flex items-start gap-2">
                  <BadgeCheck className="mt-0.5 h-4 w-4 flex-shrink-0 text-success" />
                  <span>{x}</span>
                </li>
              ))}
            </ul>
          </div>
          <div className="rounded-3xl border bg-gradient-to-br from-primary/10 via-surface to-surface p-8 shadow-card">
            <div className="text-xs font-bold uppercase tracking-wider text-primary">SafeScore breakdown</div>
            <div className="mt-3 text-5xl font-extrabold">87 <span className="text-base font-bold text-muted-foreground">/ 100</span></div>
            <div className="mt-5 space-y-3 text-sm">
              {[
                ["Verified .edu email", 15],
                ["3+ photos", 15],
                ["Detailed description", 15],
                ["Address + map pin", 10],
                ["Lease dates set", 10],
                ["Complete profile", 22],
              ].map(([label, val]) => (
                <div key={label as string}>
                  <div className="flex items-center justify-between text-xs font-semibold">
                    <span>{label}</span><span className="text-muted-foreground">+{val}</span>
                  </div>
                  <div className="mt-1 h-1.5 overflow-hidden rounded-full bg-background">
                    <div className="h-full rounded-full bg-primary" style={{ width: `${(val as number) * 4}%` }} />
                  </div>
                </div>
              ))}
            </div>
          </div>
        </div>
      </section>

      {/* CTA */}
      <section className="border-t bg-foreground text-background">
        <div className="mx-auto max-w-5xl px-5 py-20 text-center">
          <h2 className="text-4xl font-extrabold tracking-tight sm:text-5xl">Your sublease shouldn't be a leap of faith.</h2>
          <p className="mx-auto mt-4 max-w-xl text-base text-background/70">
            Join students at campuses across the country using LeaseUp to find — and post — subleases that don't suck.
          </p>
          <div className="mt-8 flex flex-wrap justify-center gap-3">
            <Link to="/auth" search={{ mode: "up" }} className="inline-flex items-center gap-1 rounded-lg bg-primary px-6 py-3 text-sm font-bold text-primary-foreground hover:bg-primary-dark">
              Get started — it's free <ArrowRight className="h-4 w-4" />
            </Link>
            <Link to="/auth" search={{ mode: "in" }} className="inline-flex items-center rounded-lg border border-background/30 px-6 py-3 text-sm font-bold hover:bg-background/10">
              Sign in
            </Link>
          </div>
        </div>
      </section>

      <footer className="border-t bg-background">
        <div className="mx-auto flex max-w-7xl flex-col items-center justify-between gap-3 px-5 py-8 text-xs text-muted-foreground sm:flex-row">
          <div className="flex items-center gap-2">
            <span className="grid h-6 w-6 place-items-center rounded bg-primary text-[10px] font-extrabold text-primary-foreground">L</span>
            <span className="font-bold text-foreground">LeaseUp</span>
            <span>· Built by students, for students.</span>
          </div>
          <div>© {new Date().getFullYear()} leasup.co</div>
        </div>
      </footer>
    </div>
  );
}
