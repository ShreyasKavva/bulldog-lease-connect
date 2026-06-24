import { Dialog, DialogContent, DialogHeader, DialogTitle } from "@/components/ui/dialog";
import { useState } from "react";
import { Button } from "@/components/ui/button";
import { Label } from "@/components/ui/label";
import { useSession } from "@/lib/leaseup/use-session";
import { fileReport } from "@/lib/leaseup/admin.queries";
import { toast } from "sonner";
import { cn } from "@/lib/utils";

const REASONS = [
  "Scam / fake listing",
  "Misleading photos or price",
  "Not actually for sublease",
  "Inappropriate content",
  "Duplicate listing",
  "Other",
];

export function ReportListingDialog({
  open, onOpenChange, listingId,
}: {
  open: boolean;
  onOpenChange: (o: boolean) => void;
  listingId: string | null;
}) {
  const { user } = useSession();
  const [reason, setReason] = useState(REASONS[0]);
  const [details, setDetails] = useState("");
  const [busy, setBusy] = useState(false);

  async function submit() {
    if (!user || !listingId) return;
    setBusy(true);
    try {
      await fileReport(listingId, user.id, reason, details.trim() || undefined);
      toast.success("Report submitted. Our team will review it.");
      setDetails("");
      onOpenChange(false);
    } catch (e: any) {
      toast.error(e.message ?? "Could not submit report");
    } finally { setBusy(false); }
  }

  return (
    <Dialog open={open} onOpenChange={onOpenChange}>
      <DialogContent>
        <DialogHeader><DialogTitle>Report this listing</DialogTitle></DialogHeader>
        <p className="text-xs text-muted-foreground">
          Reports are reviewed by the LeaseUp team. False reports may affect your account.
        </p>
        <div className="space-y-2 mt-2">
          <Label>Reason</Label>
          <div className="flex flex-wrap gap-1.5">
            {REASONS.map(r => (
              <button key={r} onClick={() => setReason(r)}
                className={cn("rounded-full border px-3 py-1.5 text-xs font-semibold",
                  reason === r ? "border-primary bg-primary-light text-primary-dark" : "hover:bg-background")}>
                {r}
              </button>
            ))}
          </div>
        </div>
        <div className="space-y-1 mt-2">
          <Label>Details (optional)</Label>
          <textarea value={details} onChange={e => setDetails(e.target.value)}
            rows={3} placeholder="What should we know?"
            className="w-full rounded-md border bg-surface p-2 text-sm" />
        </div>
        <Button onClick={submit} disabled={busy}
          className="w-full bg-primary hover:bg-primary-dark text-primary-foreground font-bold mt-2">
          {busy ? "Submitting…" : "Submit report"}
        </Button>
      </DialogContent>
    </Dialog>
  );
}
