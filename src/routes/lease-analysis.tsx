import { createFileRoute } from "@tanstack/react-router";
import { useState } from "react";
import { LeaseAnalysisDialog } from "@/components/leaseup/LeaseAnalysisDialog";
import { ShieldCheck, FileText, AlertTriangle, Sparkles } from "lucide-react";

export const Route = createFileRoute("/lease-analysis")({
  head: () => ({
    meta: [
      { title: "AI Lease Analysis — LeaseUp" },
      { name: "description", content: "Upload your lease and our AI flags every subletting risk. Free for students." },
      { property: "og:title", content: "AI Lease Analysis — LeaseUp" },
      { property: "og:description", content: "Upload your lease and our AI flags every subletting risk. Free for students." },
      { property: "og:url", content: "https://leasup.co/lease-analysis" },
      { property: "og:type", content: "website" },
    ],
    links: [{ rel: "canonical", href: "https://leasup.co/lease-analysis" }],
  }),
  component: LeaseAnalysisPage,
});

function LeaseAnalysisPage() {
  const [open, setOpen] = useState(false);
  return (
    <div className="min-h-screen bg-background">
      <header className="border-b bg-surface">
        <div className="mx-auto max-w-3xl px-4 py-12 text-center">
          <div className="inline-flex items-center gap-1 rounded-full bg-primary-light px-3 py-1 text-xs font-bold text-primary-dark">
            <Sparkles className="h-3.5 w-3.5" /> Powered by LeaseUp AI
          </div>
          <h1 className="mt-3 text-3xl md:text-4xl font-black tracking-tight">AI Lease Analysis</h1>
          <p className="mx-auto mt-3 max-w-xl text-sm md:text-base text-muted-foreground">
            Upload your lease PDF. Our AI flags every subletting risk, hidden fee, and break-clause gotcha in under a minute. Free for students.
          </p>
          <button
            onClick={() => setOpen(true)}
            className="mt-6 inline-flex items-center gap-2 rounded-md bg-primary px-5 py-3 text-sm font-bold text-primary-foreground hover:bg-primary-dark"
          >
            <FileText className="h-4 w-4" /> Analyze a lease
          </button>
        </div>
      </header>
      <main className="mx-auto max-w-3xl px-4 py-10 grid gap-4 md:grid-cols-3">
        <Feature icon={<AlertTriangle className="h-5 w-5 text-amber-500" />} title="Risk flags" body="Sublet bans, fees, and surprises pulled out automatically." />
        <Feature icon={<ShieldCheck className="h-5 w-5 text-primary" />} title="SafeScore" body="A clear 0–100 score so you know what you're signing." />
        <Feature icon={<Sparkles className="h-5 w-5 text-primary" />} title="Plain English" body="No legalese. Just what you need to know, in seconds." />
      </main>
      <LeaseAnalysisDialog open={open} onOpenChange={setOpen} />
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
