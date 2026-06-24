import { useState } from "react";
import { Dialog, DialogContent, DialogHeader, DialogTitle } from "@/components/ui/dialog";
import { Button } from "@/components/ui/button";
import { Textarea } from "@/components/ui/textarea";
import { useServerFn } from "@tanstack/react-start";
import { findMyMatch } from "@/lib/leaseup/ai.functions";
import { useQuery } from "@tanstack/react-query";
import { fetchListings } from "@/lib/leaseup/queries";
import { Sparkles, Loader2 } from "lucide-react";
import { toast } from "sonner";
import { ListingCard } from "./ListingCard";
import type { Listing } from "@/lib/leaseup/types";

export function FindMyMatchDialog({
  open, onOpenChange, onOpenListing,
}: {
  open: boolean;
  onOpenChange: (b: boolean) => void;
  onOpenListing: (l: Listing) => void;
}) {
  const match = useServerFn(findMyMatch);
  const { data: listings = [] } = useQuery({ queryKey: ["listings"], queryFn: fetchListings });
  const [prefs, setPrefs] = useState("");
  const [busy, setBusy] = useState(false);
  const [results, setResults] = useState<Array<{ id: string; score: number; why: string }>>([]);

  async function run() {
    if (prefs.trim().length < 10) return toast.error("Describe what you want a little more");
    setBusy(true);
    try {
      const r = await match({ data: { preferences: prefs } });
      setResults(r.matches);
      if (r.matches.length === 0) toast("No strong matches yet — try broadening your preferences");
    } catch (e: any) {
      const msg = String(e?.message ?? "");
      if (msg.includes("429")) toast.error("AI rate limit — wait a moment.");
      else if (msg.includes("402")) toast.error("AI credits exhausted.");
      else toast.error("Match failed: " + msg);
    } finally { setBusy(false); }
  }

  const enriched = results
    .map(r => ({ ...r, listing: listings.find(l => l.id === r.id) }))
    .filter(r => r.listing) as Array<{ id: string; score: number; why: string; listing: Listing }>;

  return (
    <Dialog open={open} onOpenChange={onOpenChange}>
      <DialogContent className="max-w-3xl max-h-[90vh] overflow-y-auto">
        <DialogHeader>
          <DialogTitle className="flex items-center gap-2"><Sparkles className="h-5 w-5 text-primary" />Find My Match</DialogTitle>
        </DialogHeader>
        <p className="text-sm text-muted-foreground">Tell me about your ideal place: budget, vibe, dates, area, must-haves. I'll rank current listings by fit.</p>
        <Textarea
          value={prefs} onChange={(e) => setPrefs(e.target.value)} rows={5}
          placeholder="ex: Looking for spring sublease under $900, walking distance to North Campus, furnished, quiet roommates, pet-friendly preferred…"
        />
        <div className="flex justify-end">
          <Button onClick={run} disabled={busy} className="bg-primary hover:bg-primary-dark text-primary-foreground font-bold gap-1">
            {busy ? <><Loader2 className="h-4 w-4 animate-spin" />Matching…</> : <><Sparkles className="h-4 w-4" />Find matches</>}
          </Button>
        </div>

        {enriched.length > 0 && (
          <div className="space-y-3 pt-2">
            <h4 className="text-xs font-bold uppercase text-muted-foreground">Your top matches</h4>
            <div className="grid gap-3 sm:grid-cols-2">
              {enriched.map(r => (
                <div key={r.id} className="space-y-2">
                  <div className="relative">
                    <ListingCard listing={r.listing} saved={false} onSave={() => {}} onOpen={() => { onOpenListing(r.listing); onOpenChange(false); }} />
                    <span className="absolute right-3 top-3 z-10 rounded-full bg-primary px-2 py-0.5 text-[10px] font-bold text-white shadow">
                      {r.score}% match
                    </span>
                  </div>
                  <p className="text-xs text-muted-foreground italic px-1">"{r.why}"</p>
                </div>
              ))}
            </div>
          </div>
        )}
      </DialogContent>
    </Dialog>
  );
}
