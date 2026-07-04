import { createFileRoute, Link } from "@tanstack/react-router";
import { useState } from "react";
import { useServerFn } from "@tanstack/react-start";
import { analyzeLeaseText, type LeaseReviewResult, type LeaseReviewItem } from "@/lib/leaseup/ai.functions";
import { Bot, ChevronLeft, Copy, RefreshCcw, Sparkles } from "lucide-react";
import { toast } from "sonner";
import { cn } from "@/lib/utils";

export const Route = createFileRoute("/lease-analysis")({
  head: () => ({
    meta: [
      { title: "Analyze My Lease — LeaseUp" },
      { name: "description", content: "Paste your lease text and get a plain-English AI review of sublease clauses, fees, deposits, utilities, guests, notices, and auto-renewals." },
      { property: "og:title", content: "Analyze My Lease — LeaseUp" },
      { property: "og:description", content: "Paste your lease text and get a plain-English AI review of student housing risks." },
      { property: "og:url", content: "https://leasup.co/lease-analysis" },
      { property: "og:type", content: "website" },
    ],
    links: [{ rel: "canonical", href: "https://leasup.co/lease-analysis" }],
  }),
  component: LeaseAnalysisPage,
});

const SAMPLE_PLACEHOLDER = `Paste lease text here — especially the sections about subletting, assignment, rent, deposits, utilities, guests, notice, renewal, and termination.`;

function LeaseAnalysisPage() {
  const analyze = useServerFn(analyzeLeaseText);
  const [leaseText, setLeaseText] = useState("");
  const [busy, setBusy] = useState(false);
  const [result, setResult] = useState<LeaseReviewResult | null>(null);

  async function run() {
    if (leaseText.trim().length < 80) {
      toast.error("Paste at least a few paragraphs of lease text.");
      return;
    }
    setBusy(true);
    try {
      const review = await analyze({ data: { leaseText } });
      setResult(review);
    } catch (e: unknown) {
      const msg = e instanceof Error ? e.message : String(e);
      if (msg.includes("429")) toast.error("AI rate limit — wait a moment.");
      else if (msg.includes("402")) toast.error("AI credits exhausted.");
      else toast.error("Analysis failed: " + msg);
    } finally {
      setBusy(false);
    }
  }

  function reset() {
    setResult(null);
  }

  if (busy) {
    return (
      <div className="fixed inset-0 z-50 grid place-items-center bg-background/95 backdrop-blur-sm p-6">
        <div className="w-full max-w-md text-center">
          <div className="mx-auto mb-6 grid h-20 w-20 place-items-center rounded-3xl bg-primary text-primary-foreground shadow-card-md animate-bounce">
            <Bot className="h-10 w-10" />
          </div>
          <h2 className="text-2xl font-black">Reading your lease...</h2>
          <div className="mx-auto mt-6 flex w-32 justify-center gap-2" aria-hidden>
            <span className="h-2.5 w-2.5 animate-pulse rounded-full bg-primary" />
            <span className="h-2.5 w-2.5 animate-pulse rounded-full bg-primary [animation-delay:150ms]" />
            <span className="h-2.5 w-2.5 animate-pulse rounded-full bg-primary [animation-delay:300ms]" />
          </div>
          <p className="mt-5 text-sm text-muted-foreground">Checking sublease terms, deposits, utilities, guests, notices, and renewal language.</p>
        </div>
      </div>
    );
  }

  if (result) {
    return <ReportCard result={result} onReset={reset} />;
  }

  return (
    <div className="min-h-[100dvh] bg-background">
      <div className="mx-auto max-w-[640px] px-5 pt-10 pb-20">
        <Link
          to="/"
          className="inline-flex items-center gap-1 text-xs font-semibold text-muted-foreground hover:text-foreground"
        >
          <ChevronLeft className="h-3.5 w-3.5" /> Back
        </Link>

        <div className="mt-6 text-center">
          <div className="text-5xl leading-none" aria-hidden>🤖</div>
          <h1 className="mt-4 text-3xl md:text-4xl font-black tracking-tight">Analyze My Lease</h1>
          <p className="mx-auto mt-3 max-w-md text-[15px] leading-relaxed text-muted-foreground">
            Paste your lease text and get a student-friendly review of the clauses that affect subleasing, deposits, utilities, guests, notices, and renewals.
          </p>
          <p className="mx-auto mt-2 max-w-md text-[11px] leading-relaxed text-muted-foreground/80">
            Not legal advice. For informational purposes only. Always consult a licensed attorney for anything legally binding.
          </p>
        </div>

        <label className="mt-8 block rounded-2xl border border-gray-200 bg-white p-3 shadow-sm">
          <textarea
            value={leaseText}
            onChange={(e) => setLeaseText(e.target.value)}
            placeholder={SAMPLE_PLACEHOLDER}
            className="min-h-[320px] w-full resize-none bg-transparent p-2 text-sm leading-relaxed outline-none placeholder:text-gray-400"
            maxLength={60000}
          />
          <span className="block px-2 pb-1 text-right text-[11px] font-semibold text-gray-400">{leaseText.length.toLocaleString()}/60,000</span>
        </label>

        <button onClick={run} disabled={leaseText.trim().length < 80} className="mt-5 flex h-[52px] w-full items-center justify-center gap-2 rounded-xl bg-primary text-base font-extrabold text-primary-foreground shadow-card-md transition-transform hover:bg-primary-dark active:scale-[0.99] disabled:opacity-50">
          🤖 Analyze My Lease →
        </button>

        <div className="mt-6 grid grid-cols-2 gap-2 text-[11px] text-muted-foreground sm:grid-cols-4">
          {["Sublease", "Deposit", "Utilities", "Auto-renewal"].map((label) => <span key={label} className="rounded-full bg-gray-100 px-3 py-2 text-center font-bold">{label}</span>)}
        </div>
      </div>
    </div>
  );
}

function ReportCard({ result, onReset }: { result: LeaseReviewResult; onReset: () => void }) {
  function copySummary() {
    const text = [
      "LeaseUp Lease Analysis",
      "",
      result.summary,
      "",
      ...result.items.map((item) => `${item.status.toUpperCase()} — ${item.category}: ${item.finding}\nAdvice: ${item.advice}`),
    ].join("\n");
    navigator.clipboard.writeText(text);
    toast.success("Report copied");
  }

  return (
    <div className="min-h-[100dvh] bg-background">
      <div className="mx-auto max-w-[680px] px-5 pt-8 pb-24">
        <button
          onClick={onReset}
          className="inline-flex items-center gap-1 text-xs font-semibold text-muted-foreground hover:text-foreground"
        >
          <ChevronLeft className="h-3.5 w-3.5" /> Analyze another lease
        </button>

        <div className="mt-5 rounded-2xl border bg-surface p-5 shadow-card-sm">
          <div className="flex items-center gap-2 text-[11px] font-bold uppercase tracking-wide text-muted-foreground"><Sparkles className="h-3.5 w-3.5" /> Plain English Summary</div>
          <p className="mt-3 text-sm leading-relaxed text-foreground">{result.summary}</p>
        </div>

        <div className="mt-5 space-y-3">
          {result.items.map((item, index) => <ClauseCard key={`${item.category}-${index}`} item={item} />)}
        </div>

        <div className="mt-6 grid grid-cols-1 gap-2 sm:grid-cols-2">
          <button
            onClick={onReset}
            className="flex h-11 items-center justify-center gap-1.5 rounded-xl bg-primary text-sm font-bold text-primary-foreground hover:bg-primary-dark transition-colors"
          >
            <RefreshCcw className="h-4 w-4" /> 🔄 Analyze another
          </button>
          <button
            onClick={copySummary}
            className="flex h-11 items-center justify-center gap-1.5 rounded-xl border-2 border-border bg-surface text-sm font-bold text-foreground hover:border-primary/40 transition-colors"
          >
            <Copy className="h-4 w-4" /> 📋 Copy report
          </button>
        </div>

        <p className="mt-6 text-center text-[10px] leading-relaxed text-muted-foreground">
          AI-generated guidance, not legal advice. Always consult a licensed attorney for anything legally binding.
        </p>
      </div>
    </div>
  );
}

function ClauseCard({ item }: { item: LeaseReviewItem }) {
  const meta = {
    red: { emoji: "🔴", border: "border-l-destructive", bg: "bg-destructive/5", label: "Risk" },
    yellow: { emoji: "🟡", border: "border-l-amber-500", bg: "bg-amber-50", label: "Check" },
    green: { emoji: "🟢", border: "border-l-success", bg: "bg-success-light/40", label: "Clear" },
  }[item.status];

  return (
    <div className={cn("rounded-2xl border-l-4 border-y border-r bg-surface", meta.border)}>
      <div className={cn("flex items-center gap-2 px-4 py-3", meta.bg)}>
        <span className="text-base leading-none" aria-hidden>{meta.emoji}</span>
        <h3 className="text-sm font-extrabold capitalize">{item.category}</h3>
        <span className="ml-auto rounded-full bg-white/80 px-2 py-0.5 text-[10px] font-bold text-foreground">{meta.label}</span>
      </div>
      <div className="space-y-2 px-4 py-3 text-sm">
        <p className="font-semibold leading-snug">{item.finding}</p>
        <p className="text-xs leading-relaxed text-primary-dark"><span className="font-bold">Advice:</span> {item.advice}</p>
      </div>
    </div>
  );
}
