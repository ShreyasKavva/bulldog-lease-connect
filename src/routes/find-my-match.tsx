import { createFileRoute, useNavigate } from "@tanstack/react-router";
import { useState } from "react";
import { FindMyMatchDialog } from "@/components/leaseup/FindMyMatchDialog";
import { Sparkles, Target, Zap } from "lucide-react";
import type { Listing } from "@/lib/leaseup/types";
import { ListingDetailSheet } from "@/components/leaseup/ListingDetailSheet";

export const Route = createFileRoute("/find-my-match")({
  head: () => ({
    meta: [
      { title: "Find My Match — LeaseUp" },
      { name: "description", content: "Answer 5 questions. Get your top 3 sublease matches at your campus ranked by fit." },
      { property: "og:title", content: "Find My Match — LeaseUp" },
      { property: "og:description", content: "Answer 5 questions. Get your top 3 sublease matches at your campus ranked by fit." },
      { property: "og:url", content: "https://leasup.co/find-my-match" },
      { property: "og:type", content: "website" },
    ],
    links: [{ rel: "canonical", href: "https://leasup.co/find-my-match" }],
  }),
  component: FindMyMatchPage,
});

function FindMyMatchPage() {
  const navigate = useNavigate();
  const [open, setOpen] = useState(false);
  const [selected, setSelected] = useState<Listing | null>(null);
  return (
    <div className="min-h-screen bg-background">
      <header className="border-b bg-surface">
        <div className="mx-auto max-w-3xl px-4 py-12 text-center">
          <div className="inline-flex items-center gap-1 rounded-full bg-primary-light px-3 py-1 text-xs font-bold text-primary-dark">
            <Sparkles className="h-3.5 w-3.5" /> AI matchmaking
          </div>
          <h1 className="mt-3 text-3xl md:text-4xl font-black tracking-tight">Find My Match</h1>
          <p className="mx-auto mt-3 max-w-xl text-sm md:text-base text-muted-foreground">
            Answer a few questions about budget, vibe, and timing. Get your top 3 sublease matches at your campus, ranked by fit.
          </p>
          <button
            onClick={() => setOpen(true)}
            className="mt-6 inline-flex items-center gap-2 rounded-md bg-primary px-5 py-3 text-sm font-bold text-primary-foreground hover:bg-primary-dark"
          >
            <Target className="h-4 w-4" /> Find my match
          </button>
        </div>
      </header>
      <main className="mx-auto max-w-3xl px-4 py-10 grid gap-4 md:grid-cols-3">
        <Feature icon={<Zap className="h-5 w-5 text-primary" />} title="60 seconds" body="Short prompt. Smart ranking. No endless scrolling." />
        <Feature icon={<Target className="h-5 w-5 text-primary" />} title="Top 3 only" body="We don't bury the lede. Just your best matches." />
        <Feature icon={<Sparkles className="h-5 w-5 text-primary" />} title="Why it fits" body="Every match comes with a clear reason it matched you." />
      </main>
      <FindMyMatchDialog
        open={open}
        onOpenChange={setOpen}
        onOpenListing={(l) => { setOpen(false); setSelected(l); }}
      />
      <ListingDetailSheet
        listing={selected}
        open={!!selected}
        onOpenChange={(o) => !o && setSelected(null)}
        onMessage={() => navigate({ to: "/auth", search: { mode: "in" } })}
        onViewProfile={() => {}}
      />
    </div>
  );
}

function Feature({ icon, title, body }: { icon: React.ReactNode; title: string; body: string }) {
  return (
    <div className="rounded-xl border bg-surface p-4">
      <div className="flex items-center gap-2 font-bold">{icon}{title}</div>
      <p className="mt-1 text-sm text-muted-foreground">{body}</p>
    </div>
  );
}
