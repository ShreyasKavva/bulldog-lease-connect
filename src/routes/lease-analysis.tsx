import { createFileRoute, Link } from "@tanstack/react-router";
import { useEffect, useMemo, useRef, useState } from "react";
import { useServerFn } from "@tanstack/react-start";
import { analyzeLease } from "@/lib/leaseup/ai.functions";
import {
  FileText,
  Upload,
  ShieldCheck,
  Zap,
  Bot,
  CircleCheck,
  TriangleAlert,
  CircleX,
  Copy,
  Share2,
  Download,
  ChevronLeft,
  Loader2,
  RefreshCcw,
} from "lucide-react";
import { toast } from "sonner";
import { cn } from "@/lib/utils";

export const Route = createFileRoute("/lease-analysis")({
  head: () => ({
    meta: [
      { title: "Analyze My Lease — LeaseUp" },
      { name: "description", content: "Upload your lease PDF. Our AI flags every subletting risk in under 30 seconds. Free." },
      { property: "og:title", content: "Analyze My Lease — LeaseUp" },
      { property: "og:description", content: "Upload your lease PDF. Our AI flags every subletting risk in under 30 seconds. Free." },
      { property: "og:url", content: "https://leasup.co/lease-analysis" },
      { property: "og:type", content: "website" },
    ],
    links: [{ rel: "canonical", href: "https://leasup.co/lease-analysis" }],
  }),
  component: LeaseAnalysisPage,
});

// ============================================================
// Page
// ============================================================

type AnalysisRow = {
  id?: string;
  filename: string;
  risk_score: number | null;
  summary: string | null;
  flags: unknown;
};

type Flag = {
  clause?: string;
  concern?: string;
  suggestion?: string;
  severity?: "high" | "medium" | "low";
  category?: string;
};

const LOADING_STEPS = [
  "Reading lease text",
  "Checking subletting clauses",
  "Analyzing restriction language",
  "Scoring tenant risk",
  "Looking for hidden fees",
  "Writing plain-English summary",
];

function LeaseAnalysisPage() {
  const analyze = useServerFn(analyzeLease);

  const [file, setFile] = useState<File | null>(null);
  const [pdfBase64, setPdfBase64] = useState<string | null>(null);
  const [dragOver, setDragOver] = useState(false);
  const [busy, setBusy] = useState(false);
  const [progress, setProgress] = useState(0);
  const [stepIdx, setStepIdx] = useState(0);
  const [result, setResult] = useState<AnalysisRow | null>(null);
  const fileRef = useRef<HTMLInputElement>(null);

  // Progress theater — climbs to 95% over ~25s while AI runs
  useEffect(() => {
    if (!busy) {
      setProgress(0);
      setStepIdx(0);
      return;
    }
    const start = Date.now();
    const timer = setInterval(() => {
      const elapsed = (Date.now() - start) / 1000;
      // Asymptotic curve toward 95
      const next = Math.min(95, Math.round(95 * (1 - Math.exp(-elapsed / 12))));
      setProgress(next);
      setStepIdx(Math.min(LOADING_STEPS.length - 1, Math.floor(elapsed / 3.2)));
    }, 200);
    return () => clearInterval(timer);
  }, [busy]);

  async function handleFile(f: File | null | undefined) {
    if (!f) return;
    if (!(f.type === "application/pdf" || f.name.toLowerCase().endsWith(".pdf"))) {
      toast.error("PDF only please");
      return;
    }
    if (f.size > 10 * 1024 * 1024) {
      toast.error("File too large — max 10MB");
      return;
    }
    const buf = await f.arrayBuffer();
    const bytes = new Uint8Array(buf);
    let bin = "";
    for (let i = 0; i < bytes.length; i++) bin += String.fromCharCode(bytes[i]);
    setFile(f);
    setPdfBase64(btoa(bin));
  }

  async function run() {
    if (!pdfBase64 || !file) return;
    setBusy(true);
    try {
      const row = await analyze({ data: { filename: file.name, pdf_base64: pdfBase64 } });
      setProgress(100);
      // Let the bar visibly hit 100 before swapping
      await new Promise((r) => setTimeout(r, 350));
      setResult(row as AnalysisRow);
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
    setFile(null);
    setPdfBase64(null);
    setResult(null);
    setProgress(0);
  }

  // -----------------------------------------------------------
  // Loading overlay
  // -----------------------------------------------------------
  if (busy) {
    return (
      <div className="fixed inset-0 z-50 grid place-items-center bg-background/95 backdrop-blur-sm p-6">
        <div className="w-full max-w-md text-center">
          <div className="mx-auto mb-6 grid h-20 w-20 place-items-center rounded-3xl bg-primary text-primary-foreground shadow-card-md animate-pulse">
            <Bot className="h-10 w-10" />
          </div>
          <h2 className="text-2xl font-black">Analyzing your lease…</h2>
          <p className="mt-1 text-sm text-muted-foreground truncate">{file?.name}</p>

          <div className="mt-7">
            <div className="h-2.5 w-full overflow-hidden rounded-full bg-muted">
              <div
                className="h-full rounded-full bg-primary transition-[width] duration-500 ease-out"
                style={{ width: `${progress}%` }}
              />
            </div>
            <div className="mt-1.5 text-right text-xs font-bold tabular-nums text-primary">{progress}%</div>
          </div>

          <ul className="mt-6 space-y-2 text-left">
            {LOADING_STEPS.slice(0, stepIdx + 1).map((s, i) => (
              <li
                key={s}
                className={cn(
                  "flex items-center gap-2 text-sm transition-opacity",
                  i < stepIdx ? "text-foreground" : "text-primary font-semibold animate-fade-in",
                )}
              >
                {i < stepIdx ? (
                  <CircleCheck className="h-4 w-4 text-success" />
                ) : (
                  <span className="inline-block h-2 w-2 rounded-full bg-primary animate-pulse" />
                )}
                <span>
                  {i < stepIdx ? s : `${s}…`}
                </span>
              </li>
            ))}
          </ul>
        </div>
      </div>
    );
  }

  // -----------------------------------------------------------
  // Result page
  // -----------------------------------------------------------
  if (result) {
    return <ReportCard a={result} onReset={reset} />;
  }

  // -----------------------------------------------------------
  // Upload page
  // -----------------------------------------------------------
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
            Upload your lease PDF. Our AI flags every subletting risk, restriction, and opportunity in under 30 seconds. Free.
          </p>
          <p className="mx-auto mt-2 max-w-md text-[11px] leading-relaxed text-muted-foreground/80">
            Not legal advice. For informational purposes only. Always consult a licensed attorney for anything legally binding.
          </p>
        </div>

        <div
          onClick={() => fileRef.current?.click()}
          onDragOver={(e) => { e.preventDefault(); setDragOver(true); }}
          onDragLeave={() => setDragOver(false)}
          onDrop={(e) => {
            e.preventDefault();
            setDragOver(false);
            handleFile(e.dataTransfer.files?.[0]);
          }}
          className={cn(
            "group relative mt-8 grid min-h-[200px] cursor-pointer place-items-center rounded-2xl border-2 border-dashed bg-primary-light px-4 py-8 text-center transition-all",
            dragOver
              ? "border-solid border-primary bg-primary-light shadow-[0_0_0_6px_rgba(37,99,235,0.18)] scale-[1.01]"
              : "border-primary/70 hover:border-solid hover:bg-primary-light/80",
            file && "border-solid border-success bg-success-light/40",
          )}
        >
          <input
            ref={fileRef}
            type="file"
            accept="application/pdf,.pdf"
            hidden
            onChange={(e) => handleFile(e.target.files?.[0])}
          />
          {file ? (
            <div className="flex flex-col items-center gap-2">
              <div className="grid h-14 w-14 place-items-center rounded-2xl bg-success text-white">
                <FileText className="h-7 w-7" />
              </div>
              <div className="text-base font-bold">{file.name}</div>
              <div className="text-xs text-muted-foreground">
                {(file.size / 1024 / 1024).toFixed(2)} MB
              </div>
              <div className="mt-1 inline-flex items-center gap-1 rounded-full bg-success px-2.5 py-0.5 text-[11px] font-bold text-white">
                <CircleCheck className="h-3 w-3" /> Ready to analyze
              </div>
              <button
                onClick={(e) => { e.stopPropagation(); reset(); }}
                className="mt-1 text-[11px] font-semibold text-muted-foreground underline-offset-2 hover:underline"
              >
                Replace file
              </button>
            </div>
          ) : (
            <div className="flex flex-col items-center gap-2">
              <div className="text-[40px] leading-none" aria-hidden>📄</div>
              <div className="text-[18px] font-bold">Drop your lease PDF here</div>
              <div className="text-[13px] text-muted-foreground">or click to browse</div>
              <div className="mt-1 text-[11px] text-muted-foreground/80">PDF only · max 10MB</div>
            </div>
          )}
        </div>

        {file && (
          <button
            onClick={run}
            className="mt-5 h-[52px] w-full rounded-xl bg-primary text-base font-extrabold text-primary-foreground shadow-card-md transition-transform hover:bg-primary-dark active:scale-[0.99]"
          >
            🔍 Analyze My Lease
          </button>
        )}

        <div className="mt-6 flex flex-wrap items-center justify-center gap-x-3 gap-y-1.5 text-[11px] text-muted-foreground">
          <span className="inline-flex items-center gap-1"><ShieldCheck className="h-3 w-3" /> Your lease is never stored</span>
          <span aria-hidden>·</span>
          <span className="inline-flex items-center gap-1"><Zap className="h-3 w-3" /> Results in ~20 seconds</span>
          <span aria-hidden>·</span>
          <span className="inline-flex items-center gap-1"><FileText className="h-3 w-3" /> Checks 20+ clauses</span>
        </div>
      </div>
    </div>
  );
}

// ============================================================
// Report Card
// ============================================================

type Verdict = "friendly" | "restricted" | "prohibited";
type Transferable = "yes" | "unclear" | "no";

function classifyAnalysis(items: Flag[], riskScore: number | null): { verdict: Verdict; transferable: Transferable } {
  const subletFlags = items.filter((f) => (f.category ?? "").toLowerCase() === "subletting");
  const highSublet = subletFlags.some((f) => f.severity === "high");
  const medSublet = subletFlags.some((f) => f.severity === "medium");

  let transferable: Transferable;
  if (highSublet) transferable = "no";
  else if (medSublet) transferable = "unclear";
  else transferable = "yes";

  let verdict: Verdict;
  if (highSublet || (riskScore ?? 0) >= 70) verdict = "prohibited";
  else if (medSublet || (riskScore ?? 0) >= 40) verdict = "restricted";
  else verdict = "friendly";

  return { verdict, transferable };
}

const VERDICT_META: Record<Verdict, { label: string; emoji: string; classes: string }> = {
  friendly: {
    label: "Sublease Friendly",
    emoji: "✅",
    classes: "bg-success-light text-success border-success/40",
  },
  restricted: {
    label: "Some Restrictions",
    emoji: "⚠️",
    classes: "bg-amber-50 text-amber-900 border-amber-300 dark:bg-amber-950/40 dark:text-amber-100",
  },
  prohibited: {
    label: "Subletting Likely Prohibited",
    emoji: "🚫",
    classes: "bg-destructive/10 text-destructive border-destructive/40",
  },
};

const TRANSFERABLE_META: Record<Transferable, { label: string; icon: React.ReactNode; classes: string }> = {
  yes: {
    label: "YES",
    icon: <CircleCheck className="h-5 w-5" />,
    classes: "text-success",
  },
  unclear: {
    label: "UNCLEAR",
    icon: <TriangleAlert className="h-5 w-5" />,
    classes: "text-amber-600 dark:text-amber-400",
  },
  no: {
    label: "NO",
    icon: <CircleX className="h-5 w-5" />,
    classes: "text-destructive",
  },
};

function plainEnglish(f: Flag): string {
  // Prefer the suggestion if present; otherwise fall back to concern/clause.
  if (f.clause && f.concern) return `${f.clause} — ${f.concern}`;
  return f.clause ?? f.concern ?? "Clause noted";
}

function ReportCard({ a, onReset }: { a: AnalysisRow; onReset: () => void }) {
  const flagsBlob = a.flags as { items?: Flag[] } | Flag[] | null;
  const items: Flag[] = Array.isArray(flagsBlob) ? flagsBlob : (flagsBlob?.items ?? []);

  const { verdict, transferable } = useMemo(
    () => classifyAnalysis(items, a.risk_score),
    [items, a.risk_score],
  );

  const favorable = items.filter((f) => f.severity === "low");
  const watch = items.filter((f) => f.severity === "medium");
  const risks = items.filter((f) => f.severity === "high");

  const summary = a.summary ?? "We finished reviewing your lease. See the verdict, key clauses, and recommendations above.";
  const vmeta = VERDICT_META[verdict];
  const tmeta = TRANSFERABLE_META[transferable];

  function copySummary() {
    const text = [
      `Lease Analysis — ${a.filename}`,
      `Verdict: ${vmeta.label}`,
      `Transferable: ${tmeta.label}`,
      "",
      summary,
    ].join("\n");
    navigator.clipboard.writeText(text);
    toast.success("Summary copied");
  }

  async function shareReport() {
    const text = `LeaseUp Analysis — ${a.filename}\nVerdict: ${vmeta.label}\nTransferable: ${tmeta.label}\n\n${summary}`;
    const nav = navigator as Navigator & { share?: (d: ShareData) => Promise<void> };
    if (nav.share) {
      try { await nav.share({ title: "Lease Analysis", text }); return; }
      catch { /* user cancelled */ }
    }
    navigator.clipboard.writeText(text);
    toast.success("Copied — paste to your landlord");
  }

  function downloadReport() {
    const lines = [
      `LeaseUp — Lease Analysis Report`,
      `File: ${a.filename}`,
      `Verdict: ${vmeta.label}`,
      `Transferable: ${tmeta.label}`,
      ``,
      `SUMMARY`,
      summary,
      ``,
      `WHAT'S WORKING IN YOUR FAVOR`,
      ...favorable.map((f) => `  ✓ ${plainEnglish(f)}`),
      ``,
      `WATCH OUT FOR THESE`,
      ...watch.map((f) => `  ⚠ ${plainEnglish(f)}`),
      ``,
      `RISKS FOUND`,
      ...risks.map((f) => `  ✗ ${plainEnglish(f)}`),
      ``,
      `Generated by LeaseUp · Not legal advice.`,
    ];
    const blob = new Blob([lines.join("\n")], { type: "text/plain;charset=utf-8" });
    const url = URL.createObjectURL(blob);
    const link = document.createElement("a");
    link.href = url;
    link.download = `lease-report-${a.filename.replace(/\.[^.]+$/, "")}.txt`;
    link.click();
    URL.revokeObjectURL(url);
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

        <div className="mt-2 mb-1 text-[11px] font-bold uppercase tracking-wide text-muted-foreground">
          {a.filename}
        </div>

        {/* Verdict banner */}
        <div className={cn("rounded-2xl border-2 px-5 py-5 text-center animate-fade-in", vmeta.classes)}>
          <div className="text-3xl leading-none" aria-hidden>{vmeta.emoji}</div>
          <div className="mt-2 text-xl font-extrabold tracking-tight">{vmeta.label}</div>
        </div>

        {/* Transferable answer */}
        <div className="mt-5 rounded-2xl border bg-surface p-5">
          <div className="text-[11px] font-bold uppercase tracking-wide text-muted-foreground">
            Is this lease transferable?
          </div>
          <div className={cn("mt-1 flex items-center gap-2 text-3xl font-black", tmeta.classes)}>
            {tmeta.icon}
            <span>{tmeta.label}</span>
          </div>
        </div>

        {/* Traffic light clause breakdown */}
        <div className="mt-5 space-y-3">
          <TrafficSection
            tone="favor"
            title="What's working in your favor"
            emptyText="No clearly favorable clauses found."
            items={favorable}
          />
          <TrafficSection
            tone="watch"
            title="Watch out for these"
            emptyText="No yellow-flag clauses found."
            items={watch}
          />
          <TrafficSection
            tone="risk"
            title="Risks found"
            emptyText="No major risks found."
            items={risks}
          />
        </div>

        {/* Plain English summary */}
        <div className="mt-5 rounded-2xl border bg-surface p-5">
          <div className="text-[11px] font-bold uppercase tracking-wide text-muted-foreground">In plain English</div>
          <p className="mt-2 text-sm leading-relaxed text-foreground">{summary}</p>
        </div>

        {/* Actions */}
        <div className="mt-6 grid grid-cols-1 gap-2 sm:grid-cols-3">
          <button
            onClick={downloadReport}
            className="flex h-11 items-center justify-center gap-1.5 rounded-xl bg-primary text-sm font-bold text-primary-foreground hover:bg-primary-dark transition-colors"
          >
            <Download className="h-4 w-4" /> Download Report
          </button>
          <button
            onClick={copySummary}
            className="flex h-11 items-center justify-center gap-1.5 rounded-xl border-2 border-border bg-surface text-sm font-bold text-foreground hover:border-primary/40 transition-colors"
          >
            <Copy className="h-4 w-4" /> Copy Summary
          </button>
          <button
            onClick={shareReport}
            className="flex h-11 items-center justify-center gap-1.5 rounded-xl border-2 border-border bg-surface text-sm font-bold text-foreground hover:border-primary/40 transition-colors"
          >
            <Share2 className="h-4 w-4" /> Share with Landlord
          </button>
        </div>

        <button
          onClick={onReset}
          className="mt-5 inline-flex w-full items-center justify-center gap-1 text-xs font-semibold text-muted-foreground hover:text-foreground"
        >
          <RefreshCcw className="h-3 w-3" /> Analyze another lease
        </button>

        <p className="mt-6 text-center text-[10px] leading-relaxed text-muted-foreground">
          AI-generated guidance, not legal advice. Always consult a licensed attorney for anything legally binding.
        </p>
      </div>
    </div>
  );
}

function TrafficSection({
  tone, title, items, emptyText,
}: {
  tone: "favor" | "watch" | "risk";
  title: string;
  items: Flag[];
  emptyText: string;
}) {
  const meta = {
    favor: { dot: "bg-success", border: "border-l-success", bg: "bg-success-light/40", iconChar: "✓", iconColor: "text-success", emoji: "🟢" },
    watch: { dot: "bg-amber-500", border: "border-l-amber-500", bg: "bg-amber-50 dark:bg-amber-950/30", iconChar: "⚠", iconColor: "text-amber-600 dark:text-amber-400", emoji: "🟡" },
    risk:  { dot: "bg-destructive", border: "border-l-destructive", bg: "bg-destructive/5", iconChar: "✗", iconColor: "text-destructive", emoji: "🔴" },
  }[tone];

  return (
    <div className={cn("rounded-2xl border-l-4 border-y border-r bg-surface", meta.border)}>
      <div className={cn("flex items-center gap-2 px-4 py-3", meta.bg)}>
        <span className="text-base leading-none" aria-hidden>{meta.emoji}</span>
        <h3 className="text-sm font-extrabold">{title}</h3>
        <span className="ml-auto rounded-full bg-white/70 px-2 py-0.5 text-[10px] font-bold text-foreground dark:bg-black/30">
          {items.length}
        </span>
      </div>
      <div className="px-4 py-3">
        {items.length === 0 ? (
          <div className="text-xs italic text-muted-foreground">{emptyText}</div>
        ) : (
          <ul className="space-y-2.5">
            {items.map((f, i) => (
              <li key={i} className="flex items-start gap-2.5 text-sm">
                <span className={cn("mt-0.5 font-black", meta.iconColor)}>{meta.iconChar}</span>
                <div className="min-w-0 flex-1">
                  <div className="font-semibold leading-snug">{f.clause ?? "Clause"}</div>
                  {f.concern && (
                    <div className="text-xs text-muted-foreground leading-snug mt-0.5">{f.concern}</div>
                  )}
                  {f.suggestion && tone !== "favor" && (
                    <div className="mt-1 text-xs text-primary-dark"><span className="font-bold">Tip:</span> {f.suggestion}</div>
                  )}
                </div>
              </li>
            ))}
          </ul>
        )}
      </div>
    </div>
  );
}

// Silence unused-import warnings for icons used only in conditional branches above.
void Loader2;
void Upload;
