import { useEffect, useMemo, useRef, useState } from "react";
import { Dialog, DialogContent, DialogHeader, DialogTitle } from "@/components/ui/dialog";
import { Button } from "@/components/ui/button";
import { Textarea } from "@/components/ui/textarea";
import { useServerFn } from "@tanstack/react-start";
import { analyzeLease, listLeaseAnalyses, deleteLeaseAnalysis } from "@/lib/leaseup/ai.functions";
import { useQuery, useQueryClient } from "@tanstack/react-query";
import { useSession } from "@/lib/leaseup/use-session";
import {
  Upload, AlertTriangle, ShieldCheck, FileText, Loader2, Copy, Trash2,
  DollarSign, Wrench, LogOut, Users, Eye, RefreshCw, Home, PawPrint, Zap, FileWarning, Lightbulb, ArrowLeft, X,
} from "lucide-react";
import { toast } from "sonner";
import { cn } from "@/lib/utils";

const CATEGORY_META: Record<string, { icon: any; label: string }> = {
  fees: { icon: DollarSign, label: "Fees" },
  deposit: { icon: DollarSign, label: "Deposit" },
  termination: { icon: LogOut, label: "Termination" },
  liability: { icon: Users, label: "Liability" },
  maintenance: { icon: Wrench, label: "Maintenance" },
  privacy: { icon: Eye, label: "Privacy / entry" },
  renewal: { icon: RefreshCw, label: "Renewal" },
  subletting: { icon: Home, label: "Subletting" },
  pets: { icon: PawPrint, label: "Pets" },
  utilities: { icon: Zap, label: "Utilities" },
  other: { icon: FileWarning, label: "Other" },
};

const PROGRESS_STEPS = [
  "Reading your lease…",
  "Looking for risky clauses…",
  "Scoring tenant risk…",
  "Writing plain-English summary…",
];

export function LeaseAnalysisDialog({ open, onOpenChange }: { open: boolean; onOpenChange: (b: boolean) => void }) {
  const { user } = useSession();
  const analyze = useServerFn(analyzeLease);
  const listFn = useServerFn(listLeaseAnalyses);
  const delFn = useServerFn(deleteLeaseAnalysis);
  const qc = useQueryClient();
  const { data: history = [] } = useQuery({
    queryKey: ["lease-analyses", user?.id],
    queryFn: () => listFn(),
    enabled: !!user && open,
  });

  const [text, setText] = useState("");
  const [pdfBase64, setPdfBase64] = useState<string | null>(null);
  const [filename, setFilename] = useState("Pasted lease");
  const [busy, setBusy] = useState(false);
  const [stepIdx, setStepIdx] = useState(0);
  const [dragOver, setDragOver] = useState(false);
  const [active, setActive] = useState<any>(null);

  // animate progress steps while analyzing
  useEffect(() => {
    if (!busy) { setStepIdx(0); return; }
    const t = setInterval(() => setStepIdx((i) => Math.min(i + 1, PROGRESS_STEPS.length - 1)), 2200);
    return () => clearInterval(t);
  }, [busy]);

  function resetInput() {
    setText(""); setPdfBase64(null); setFilename("Pasted lease");
  }

  async function onFile(f: File) {
    setFilename(f.name);
    if (f.type === "application/pdf" || f.name.toLowerCase().endsWith(".pdf")) {
      if (f.size > 6 * 1024 * 1024) return toast.error("PDF too large (max 6MB)");
      const buf = await f.arrayBuffer();
      let bin = ""; const bytes = new Uint8Array(buf);
      for (let i = 0; i < bytes.length; i++) bin += String.fromCharCode(bytes[i]);
      setPdfBase64(btoa(bin));
      setText("");
      toast.success("PDF loaded — click Analyze");
    } else if (f.type === "text/plain" || f.name.toLowerCase().endsWith(".txt")) {
      const t = await f.text();
      setText(t);
      setPdfBase64(null);
    } else {
      toast.error("Unsupported file. Upload a PDF or .txt");
    }
  }

  async function run() {
    if (!pdfBase64 && text.trim().length < 50) return toast.error("Paste at least a paragraph of lease text or upload a PDF");
    setBusy(true);
    try {
      const row = await analyze({ data: { filename, text: text || undefined, pdf_base64: pdfBase64 || undefined } });
      setActive(row);
      resetInput();
      qc.invalidateQueries({ queryKey: ["lease-analyses", user?.id] });
      toast.success("Analysis ready");
    } catch (e: any) {
      const msg = String(e?.message ?? "");
      if (msg.includes("429")) toast.error("AI rate limit — wait a moment and retry.");
      else if (msg.includes("402")) toast.error("AI credits exhausted. Add credits in Workspace settings.");
      else toast.error("Analysis failed: " + msg);
    } finally { setBusy(false); }
  }

  async function onDelete(id: string) {
    try {
      await delFn({ data: { id } });
      if (active?.id === id) setActive(null);
      qc.invalidateQueries({ queryKey: ["lease-analyses", user?.id] });
      toast.success("Deleted");
    } catch (e: any) {
      toast.error("Couldn't delete: " + (e?.message ?? ""));
    }
  }

  return (
    <Dialog open={open} onOpenChange={onOpenChange}>
      <DialogContent className="max-w-3xl max-h-[92vh] overflow-y-auto p-0">
        <DialogHeader className="sticky top-0 z-10 border-b bg-background/95 px-5 py-4 backdrop-blur">
          <DialogTitle className="flex items-center gap-2 text-base">
            <ShieldCheck className="h-5 w-5 text-primary" />
            Lease Analysis Bot
            <span className="ml-auto text-[10px] font-medium text-muted-foreground">Not legal advice</span>
          </DialogTitle>
        </DialogHeader>

        <div className="px-5 py-4">
          {busy ? (
            <AnalyzingState step={stepIdx} filename={filename} />
          ) : !active ? (
            <UploadView
              text={text} setText={setText}
              pdfBase64={pdfBase64} filename={filename}
              dragOver={dragOver} setDragOver={setDragOver}
              onFile={onFile} resetInput={resetInput}
              history={history}
              onPick={setActive}
              onDelete={onDelete}
              onRun={run}
            />
          ) : (
            <AnalysisView a={active} onBack={() => setActive(null)} />
          )}
        </div>
      </DialogContent>
    </Dialog>
  );
}

function UploadView(props: {
  text: string; setText: (s: string) => void;
  pdfBase64: string | null; filename: string;
  dragOver: boolean; setDragOver: (b: boolean) => void;
  onFile: (f: File) => void; resetInput: () => void;
  history: any[]; onPick: (a: any) => void; onDelete: (id: string) => void;
  onRun: () => void;
}) {
  const { text, setText, pdfBase64, filename, dragOver, setDragOver, onFile, resetInput, history, onPick, onDelete, onRun } = props;
  const fileRef = useRef<HTMLInputElement>(null);

  return (
    <div className="space-y-5">
      <p className="text-sm text-muted-foreground">
        Drop your lease PDF below — I'll flag risky clauses in plain English and tell you what to ask your landlord.
      </p>

      <div
        onDragOver={(e) => { e.preventDefault(); setDragOver(true); }}
        onDragLeave={() => setDragOver(false)}
        onDrop={(e) => {
          e.preventDefault(); setDragOver(false);
          const f = e.dataTransfer.files?.[0]; if (f) onFile(f);
        }}
        onClick={() => fileRef.current?.click()}
        className={cn(
          "relative flex h-32 cursor-pointer flex-col items-center justify-center gap-1.5 rounded-xl border-2 border-dashed bg-background/50 transition-all",
          dragOver ? "border-primary bg-primary/5 scale-[1.01]" : "border-muted-foreground/25 hover:border-primary/50 hover:bg-muted/40",
          pdfBase64 && "border-success/50 bg-success-light/30",
        )}
      >
        {pdfBase64 ? (
          <>
            <FileText className="h-7 w-7 text-success" />
            <span className="text-sm font-semibold">{filename}</span>
            <span className="text-[10px] text-muted-foreground">Click to replace</span>
            <button
              onClick={(e) => { e.stopPropagation(); resetInput(); }}
              className="absolute right-2 top-2 rounded-full p-1 hover:bg-muted"
              aria-label="Remove file"
            >
              <X className="h-3.5 w-3.5" />
            </button>
          </>
        ) : (
          <>
            <Upload className={cn("h-6 w-6", dragOver ? "text-primary" : "text-muted-foreground")} />
            <span className="text-sm font-semibold">
              {dragOver ? "Drop it!" : "Drop PDF here or click to upload"}
            </span>
            <span className="text-[10px] text-muted-foreground">PDF or .txt, up to 6MB</span>
          </>
        )}
        <input
          ref={fileRef}
          type="file"
          accept=".pdf,application/pdf,.txt,text/plain"
          hidden
          onChange={(e) => e.target.files?.[0] && onFile(e.target.files[0])}
        />
      </div>

      {!pdfBase64 && (
        <details className="group">
          <summary className="cursor-pointer text-xs font-semibold text-muted-foreground hover:text-foreground">
            …or paste lease text instead
          </summary>
          <Textarea
            value={text}
            onChange={(e) => setText(e.target.value)}
            rows={8}
            placeholder="Paste lease text here"
            className="mt-2"
          />
          <div className="mt-1 text-right text-[10px] text-muted-foreground">{text.length.toLocaleString()} chars</div>
        </details>
      )}

      <Button
        onClick={onRun}
        disabled={!pdfBase64 && text.trim().length < 50}
        className="w-full bg-primary hover:bg-primary-dark text-primary-foreground font-bold"
      >
        <ShieldCheck className="mr-1 h-4 w-4" /> Analyze lease
      </Button>

      {history.length > 0 && (
        <div className="border-t pt-4">
          <h4 className="mb-2 text-[11px] font-bold uppercase tracking-wide text-muted-foreground">Past analyses</h4>
          <ul className="space-y-1">
            {history.map((h: any) => (
              <li
                key={h.id}
                className="group flex items-center gap-2 rounded-lg p-2 hover:bg-muted"
              >
                <button onClick={() => onPick(h)} className="flex flex-1 items-center gap-2 text-left">
                  <FileText className="h-4 w-4 shrink-0 text-muted-foreground" />
                  <div className="min-w-0 flex-1">
                    <div className="truncate text-sm font-medium">{h.filename}</div>
                    <div className="text-[10px] text-muted-foreground">
                      {new Date(h.created_at).toLocaleDateString()}
                    </div>
                  </div>
                  <RiskPill score={h.risk_score} />
                </button>
                <button
                  onClick={() => onDelete(h.id)}
                  className="rounded p-1 text-muted-foreground opacity-0 transition hover:bg-destructive/10 hover:text-destructive group-hover:opacity-100"
                  aria-label="Delete analysis"
                >
                  <Trash2 className="h-3.5 w-3.5" />
                </button>
              </li>
            ))}
          </ul>
        </div>
      )}
    </div>
  );
}

function AnalyzingState({ step, filename }: { step: number; filename: string }) {
  return (
    <div className="flex flex-col items-center justify-center py-10 text-center">
      <div className="relative mb-4">
        <Loader2 className="h-12 w-12 animate-spin text-primary" />
        <ShieldCheck className="absolute inset-0 m-auto h-5 w-5 text-primary" />
      </div>
      <p className="text-sm font-semibold">{filename}</p>
      <p className="mt-2 text-sm text-muted-foreground transition-opacity duration-300">
        {PROGRESS_STEPS[step]}
      </p>
      <div className="mt-4 flex gap-1.5">
        {PROGRESS_STEPS.map((_, i) => (
          <span
            key={i}
            className={cn(
              "h-1.5 w-8 rounded-full transition-colors",
              i <= step ? "bg-primary" : "bg-muted",
            )}
          />
        ))}
      </div>
    </div>
  );
}

function RiskMeter({ score }: { score: number }) {
  // Half-circle gauge
  const pct = Math.max(0, Math.min(100, score));
  const angle = -90 + (pct / 100) * 180;
  const tier =
    pct >= 70 ? { label: "High risk", color: "text-destructive", bg: "stroke-destructive" } :
    pct >= 40 ? { label: "Moderate risk", color: "text-accent-foreground", bg: "stroke-accent" } :
                { label: "Low risk", color: "text-success", bg: "stroke-success" };

  return (
    <div className="flex flex-col items-center">
      <svg viewBox="0 0 120 70" className="w-40">
        <path d="M10,60 A50,50 0 0,1 110,60" className="fill-none stroke-muted" strokeWidth="10" strokeLinecap="round" />
        <path
          d="M10,60 A50,50 0 0,1 110,60"
          className={cn("fill-none transition-all duration-1000", tier.bg)}
          strokeWidth="10"
          strokeLinecap="round"
          strokeDasharray={`${(pct / 100) * 157} 157`}
        />
        <line
          x1="60" y1="60"
          x2={60 + 40 * Math.cos((angle * Math.PI) / 180)}
          y2={60 + 40 * Math.sin((angle * Math.PI) / 180)}
          className="stroke-foreground transition-all duration-1000"
          strokeWidth="2"
          strokeLinecap="round"
        />
        <circle cx="60" cy="60" r="4" className="fill-foreground" />
      </svg>
      <div className={cn("-mt-2 text-2xl font-extrabold", tier.color)}>{pct}<span className="text-sm font-bold text-muted-foreground">/100</span></div>
      <div className={cn("text-xs font-bold uppercase tracking-wide", tier.color)}>{tier.label}</div>
    </div>
  );
}

function RiskPill({ score }: { score: number | null }) {
  if (score == null) return null;
  const tier = score >= 70 ? "bg-destructive text-white" : score >= 40 ? "bg-accent text-accent-foreground" : "bg-success-light text-success";
  return <span className={cn("rounded-full px-2 py-0.5 text-[10px] font-bold", tier)}>{score}</span>;
}

function AnalysisView({ a, onBack }: { a: any; onBack: () => void }) {
  const flagsBlob = a.flags ?? {};
  const items: any[] = Array.isArray(flagsBlob) ? flagsBlob : (flagsBlob.items ?? []);
  const keyTerms = Array.isArray(flagsBlob) ? null : (flagsBlob.key_terms ?? null);

  const grouped = useMemo(() => {
    const order = ["high", "medium", "low"] as const;
    const g: Record<string, any[]> = { high: [], medium: [], low: [] };
    items.forEach((f) => g[(f.severity ?? "low") as string]?.push(f));
    return order.map((s) => [s, g[s]] as const);
  }, [items]);

  function copySummary() {
    const lines = [
      `Lease Analysis — ${a.filename}`,
      `Risk score: ${a.risk_score}/100`,
      "",
      a.summary ?? "",
      "",
      "Flagged clauses:",
      ...items.map((f: any) => `• [${(f.severity ?? "").toUpperCase()}] ${f.clause} — ${f.concern}${f.suggestion ? ` → ${f.suggestion}` : ""}`),
    ];
    navigator.clipboard.writeText(lines.join("\n"));
    toast.success("Summary copied");
  }

  return (
    <div className="space-y-5">
      <div className="flex items-center gap-2">
        <Button variant="ghost" size="sm" onClick={onBack} className="gap-1 -ml-2">
          <ArrowLeft className="h-4 w-4" /> Back
        </Button>
        <div className="ml-auto flex gap-1">
          <Button variant="outline" size="sm" onClick={copySummary} className="gap-1">
            <Copy className="h-3.5 w-3.5" /> Copy
          </Button>
        </div>
      </div>

      <div className="rounded-xl border bg-surface p-4">
        <div className="flex flex-col items-center gap-3 sm:flex-row sm:items-start sm:gap-6">
          <RiskMeter score={a.risk_score ?? 0} />
          <div className="flex-1 space-y-2 text-center sm:text-left">
            <div className="text-[11px] font-bold uppercase tracking-wide text-muted-foreground">{a.filename}</div>
            {a.summary && <p className="text-sm leading-relaxed">{a.summary}</p>}
          </div>
        </div>
      </div>

      {keyTerms && (keyTerms.rent || keyTerms.term || keyTerms.deposit || keyTerms.late_fee) && (
        <div className="grid grid-cols-2 gap-2 sm:grid-cols-4">
          {[
            ["Rent", keyTerms.rent],
            ["Term", keyTerms.term],
            ["Deposit", keyTerms.deposit],
            ["Late fee", keyTerms.late_fee],
          ].filter(([, v]) => v).map(([k, v]) => (
            <div key={k as string} className="rounded-lg border bg-background p-2.5 text-center">
              <div className="text-[10px] font-bold uppercase text-muted-foreground">{k}</div>
              <div className="mt-0.5 text-sm font-semibold">{v as string}</div>
            </div>
          ))}
        </div>
      )}

      <div className="space-y-3">
        <div className="flex items-center gap-2">
          <h4 className="text-[11px] font-bold uppercase tracking-wide text-muted-foreground">
            Flagged clauses ({items.length})
          </h4>
        </div>
        {items.length === 0 ? (
          <div className="rounded-lg border bg-success-light/40 p-4 text-center text-sm text-success">
            <ShieldCheck className="mx-auto mb-1 h-5 w-5" />
            No major flags found.
          </div>
        ) : (
          grouped.map(([severity, list]) =>
            list.length === 0 ? null : (
              <div key={severity} className="space-y-2">
                <div className={cn(
                  "text-[10px] font-bold uppercase tracking-wide",
                  severity === "high" ? "text-destructive" : severity === "medium" ? "text-accent-foreground" : "text-muted-foreground",
                )}>
                  {severity} severity · {list.length}
                </div>
                {list.map((f: any, i: number) => <FlagCard key={i} f={f} />)}
              </div>
            )
          )
        )}
      </div>

      <p className="text-[10px] leading-relaxed text-muted-foreground">
        ⚠️ AI-generated guidance, not legal advice. For binding decisions consult a tenant attorney or your campus legal aid.
      </p>
    </div>
  );
}

function FlagCard({ f }: { f: any }) {
  const meta = CATEGORY_META[f.category as string] ?? CATEGORY_META.other;
  const Icon = meta.icon;
  const sev = f.severity ?? "low";
  return (
    <div className={cn(
      "rounded-lg border bg-background p-3",
      sev === "high" && "border-destructive/30",
      sev === "medium" && "border-accent/40",
    )}>
      <div className="flex items-start gap-3">
        <div className={cn(
          "flex h-8 w-8 shrink-0 items-center justify-center rounded-lg",
          sev === "high" ? "bg-destructive/10 text-destructive" :
          sev === "medium" ? "bg-accent/20 text-accent-foreground" :
                             "bg-muted text-muted-foreground",
        )}>
          <Icon className="h-4 w-4" />
        </div>
        <div className="min-w-0 flex-1">
          <div className="flex flex-wrap items-center gap-2">
            <div className="text-sm font-bold">{f.clause}</div>
            <span className="rounded-full bg-muted px-1.5 py-0.5 text-[9px] font-semibold uppercase text-muted-foreground">
              {meta.label}
            </span>
            {sev === "high" && <AlertTriangle className="h-3.5 w-3.5 text-destructive" />}
          </div>
          <p className="mt-1 text-xs leading-relaxed text-muted-foreground">{f.concern}</p>
          {f.suggestion && (
            <div className="mt-2 flex items-start gap-1.5 rounded-md bg-primary/5 p-2 text-xs">
              <Lightbulb className="mt-0.5 h-3.5 w-3.5 shrink-0 text-primary" />
              <span><span className="font-semibold text-primary">What to do:</span> {f.suggestion}</span>
            </div>
          )}
        </div>
      </div>
    </div>
  );
}
