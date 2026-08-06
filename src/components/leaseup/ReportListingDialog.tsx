/**
 * Q101 Part B — report a listing.
 *
 * Works signed-in OR anonymous (reporter_id stays null for guests, and RLS
 * allows an anon insert with a null reporter). Reporter identity is never
 * surfaced anywhere in the UI.
 */
import { Dialog, DialogContent } from "@/components/ui/dialog";
import { useEffect, useState } from "react";
import { useSession } from "@/lib/leaseup/use-session";
import { fileReport } from "@/lib/leaseup/admin.queries";
import { toast } from "sonner";
import { cn } from "@/lib/utils";

const REASONS = [
  "Inaccurate listing details",
  "Suspected scam or fraud",
  "Offensive or inappropriate content",
  "Listing is no longer available",
  "Other",
];

export function ReportListingDialog({
  open,
  onOpenChange,
  listingId,
}: {
  open: boolean;
  onOpenChange: (o: boolean) => void;
  listingId: string | null;
}) {
  const { user } = useSession();
  const [reason, setReason] = useState<string | null>(null);
  const [details, setDetails] = useState("");
  const [busy, setBusy] = useState(false);

  useEffect(() => {
    if (!open) {
      setReason(null);
      setDetails("");
    }
  }, [open]);

  async function submit() {
    if (!reason || !listingId) return;
    setBusy(true);
    try {
      await fileReport(listingId, user?.id ?? null, reason, details.trim() || undefined);
      onOpenChange(false);
      toast.success("Report submitted — thank you for keeping LeaseUp safe.");
    } catch (e: unknown) {
      toast.error(e instanceof Error ? e.message : "Could not submit report");
    } finally {
      setBusy(false);
    }
  }

  return (
    <Dialog open={open} onOpenChange={onOpenChange}>
      <DialogContent className="max-w-sm rounded-2xl bg-surface p-6 shadow-xl">
        <div>
          <h2 className="text-lg font-semibold text-foreground">Report this listing</h2>
          <p className="mt-1 text-sm text-muted-foreground">
            Help us keep LeaseUp safe. We review all reports.
          </p>
        </div>

        <fieldset className="mt-3">
          <legend className="sr-only">Reason</legend>
          {REASONS.map((r) => (
            <label
              key={r}
              className="flex cursor-pointer items-center gap-3 py-2 text-sm text-foreground"
            >
              <input
                type="radio"
                name="report-reason"
                value={r}
                checked={reason === r}
                onChange={() => setReason(r)}
                className="h-4 w-4 accent-foreground"
              />
              {r}
            </label>
          ))}
        </fieldset>

        {reason === "Other" && (
          <textarea
            value={details}
            onChange={(e) => setDetails(e.target.value)}
            rows={3}
            placeholder="Tell us more..."
            className="w-full rounded-xl border border-border bg-background p-3 text-sm outline-none focus:ring-2 focus:ring-ring"
          />
        )}

        <button
          type="button"
          onClick={submit}
          disabled={!reason || busy}
          className={cn(
            "mt-2 w-full rounded-full bg-gray-900 py-3 text-sm font-semibold text-white transition",
            "disabled:cursor-not-allowed disabled:opacity-40 dark:bg-white dark:text-gray-900",
          )}
        >
          {busy ? "Submitting…" : "Submit report"}
        </button>
        <button
          type="button"
          onClick={() => onOpenChange(false)}
          className="mx-auto text-sm text-muted-foreground hover:text-foreground"
        >
          Cancel
        </button>
      </DialogContent>
    </Dialog>
  );
}
