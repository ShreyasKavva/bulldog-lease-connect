import { useState } from "react";
import { Dialog, DialogContent, DialogHeader, DialogTitle } from "@/components/ui/dialog";
import { Button } from "@/components/ui/button";
import { Textarea } from "@/components/ui/textarea";
import { useServerFn } from "@tanstack/react-start";
import { analyzeLease, listLeaseAnalyses } from "@/lib/leaseup/ai.functions";
import { useQuery, useQueryClient } from "@tanstack/react-query";
import { useSession } from "@/lib/leaseup/use-session";
import { Upload, AlertTriangle, ShieldCheck, FileText, Loader2 } from "lucide-react";
import { toast } from "sonner";
import { cn } from "@/lib/utils";

export function LeaseAnalysisDialog({ open, onOpenChange }: { open: boolean; onOpenChange: (b: boolean) => void }) {
  const { user } = useSession();
  const analyze = useServerFn(analyzeLease);
  const listFn = useServerFn(listLeaseAnalyses);
  const qc = useQueryClient();
  const { data: history = [] } = useQuery({
    queryKey: ["lease-analyses", user?.id],
    queryFn: () => listFn(),
    enabled: !!user && open,
  });
  const [text, setText] = useState("");
  const [filename, setFilename] = useState("Pasted lease");
  const [busy, setBusy] = useState(false);
  const [active, setActive] = useState<any>(null);

  async function onFile(f: File) {
    if (f.type !== "text/plain") {
      toast.error("For now, upload a .txt copy of your lease (or paste text below). PDF support coming soon.");
      return;
    }
    const t = await f.text();
    setText(t);
    setFilename(f.name);
  }

  async function run() {
    if (text.trim().length < 50) return toast.error("Paste at least a paragraph of lease text");
    setBusy(true);
    try {
      const row = await analyze({ data: { filename, text } });
      setActive(row);
      qc.invalidateQueries({ queryKey: ["lease-analyses", user?.id] });
      toast.success("Analysis ready");
    } catch (e: any) {
      const msg = String(e?.message ?? "");
      if (msg.includes("429")) toast.error("AI rate limit — wait a moment and retry.");
      else if (msg.includes("402")) toast.error("AI credits exhausted. Add credits in Workspace settings.");
      else toast.error("Analysis failed: " + msg);
    } finally { setBusy(false); }
  }

  return (
    <Dialog open={open} onOpenChange={onOpenChange}>
      <DialogContent className="max-w-3xl max-h-[90vh] overflow-y-auto">
        <DialogHeader>
          <DialogTitle className="flex items-center gap-2"><ShieldCheck className="h-5 w-5 text-primary" />Lease Analysis Bot</DialogTitle>
        </DialogHeader>

        {!active ? (
          <div className="space-y-4">
            <p className="text-sm text-muted-foreground">Paste your lease (or upload a .txt). I'll flag risky clauses in plain English. Not legal advice.</p>
            <label className="flex h-24 cursor-pointer flex-col items-center justify-center gap-1 rounded-lg border-2 border-dashed bg-background hover:bg-muted">
              <Upload className="h-5 w-5 text-muted-foreground" />
              <span className="text-xs font-semibold">Upload .txt file</span>
              <input type="file" accept=".txt,text/plain" hidden onChange={(e) => e.target.files?.[0] && onFile(e.target.files[0])} />
            </label>
            <Textarea value={text} onChange={(e) => setText(e.target.value)} rows={10} placeholder="Paste lease text here…" />
            <div className="flex items-center justify-between">
              <span className="text-xs text-muted-foreground">{text.length.toLocaleString()} chars</span>
              <Button onClick={run} disabled={busy} className="bg-primary hover:bg-primary-dark text-primary-foreground font-bold gap-1">
                {busy ? <><Loader2 className="h-4 w-4 animate-spin" />Analyzing…</> : "Analyze lease"}
              </Button>
            </div>

            {history.length > 0 && (
              <div>
                <h4 className="text-xs font-bold uppercase text-muted-foreground">Past analyses</h4>
                <ul className="mt-2 space-y-1">
                  {history.map((h: any) => (
                    <li key={h.id}>
                      <button onClick={() => setActive(h)} className="flex w-full items-center gap-2 rounded-md p-2 text-left text-sm hover:bg-background">
                        <FileText className="h-4 w-4 text-muted-foreground" />
                        <span className="flex-1 truncate">{h.filename}</span>
                        <RiskPill score={h.risk_score} />
                      </button>
                    </li>
                  ))}
                </ul>
              </div>
            )}
          </div>
        ) : (
          <AnalysisView a={active} onBack={() => setActive(null)} />
        )}
      </DialogContent>
    </Dialog>
  );
}

function RiskPill({ score }: { score: number | null }) {
  if (score == null) return null;
  const tier = score >= 70 ? "bg-destructive text-white" : score >= 40 ? "bg-accent text-accent-foreground" : "bg-success-light text-success";
  return <span className={cn("rounded-full px-2 py-0.5 text-[10px] font-bold", tier)}>Risk {score}</span>;
}

function AnalysisView({ a, onBack }: { a: any; onBack: () => void }) {
  return (
    <div className="space-y-4">
      <div className="flex items-center justify-between">
        <div>
          <div className="text-xs text-muted-foreground">{a.filename}</div>
          <h3 className="font-bold">Analysis</h3>
        </div>
        <RiskPill score={a.risk_score} />
      </div>
      {a.summary && <p className="rounded-md bg-background p-3 text-sm">{a.summary}</p>}
      <div className="space-y-2">
        <h4 className="text-xs font-bold uppercase text-muted-foreground">Flagged clauses</h4>
        {(a.flags ?? []).length === 0 ? (
          <p className="text-sm text-muted-foreground">No major flags found.</p>
        ) : (
          (a.flags ?? []).map((f: any, i: number) => (
            <div key={i} className="flex gap-2 rounded-md border bg-surface p-3">
              <AlertTriangle className={cn(
                "h-4 w-4 shrink-0 mt-0.5",
                f.severity === "high" ? "text-destructive" : f.severity === "medium" ? "text-accent-foreground" : "text-muted-foreground"
              )} />
              <div>
                <div className="text-sm font-bold">{f.clause}</div>
                <div className="text-xs text-muted-foreground">{f.concern}</div>
              </div>
              <span className={cn(
                "ml-auto h-fit rounded-full px-2 py-0.5 text-[10px] font-bold uppercase",
                f.severity === "high" ? "bg-destructive text-white" : f.severity === "medium" ? "bg-accent text-accent-foreground" : "bg-muted text-muted-foreground"
              )}>{f.severity}</span>
            </div>
          ))
        )}
      </div>
      <Button variant="outline" onClick={onBack}>Back</Button>
    </div>
  );
}
