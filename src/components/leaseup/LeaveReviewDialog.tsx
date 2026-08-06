/**
 * Q112 — review submission modal.
 *
 * Star picker (required) + optional 300-char note. Submitting upserts the
 * caller's review for this listing and optimistically refreshes the section.
 */
import { Dialog, DialogContent } from "@/components/ui/dialog";
import { Star } from "lucide-react";
import { useEffect, useState } from "react";
import { toast } from "sonner";
import { useQueryClient } from "@tanstack/react-query";
import { useSession } from "@/lib/leaseup/use-session";
import { submitReview } from "@/lib/leaseup/reviews.queries";
import { cn } from "@/lib/utils";

const CORAL = "#FF5A5F";

export function LeaveReviewDialog({
  open,
  onOpenChange,
  reviewedUserId,
  reviewedName,
  listingId = null,
  reviewerRole,
  onSubmitted,
  initialStars = 0,
  initialContent = "",
}: {
  open: boolean;
  onOpenChange: (o: boolean) => void;
  reviewedUserId: string;
  reviewedName: string;
  listingId?: string | null;
  reviewerRole: "subletter" | "poster";
  onSubmitted?: () => void;
  initialStars?: number;
  initialContent?: string;
}) {
  const { user } = useSession();
  const qc = useQueryClient();
  const [stars, setStars] = useState(initialStars);
  const [hover, setHover] = useState(0);
  const [content, setContent] = useState(initialContent);
  const [submitting, setSubmitting] = useState(false);

  useEffect(() => {
    if (open) {
      setStars(initialStars);
      setContent(initialContent);
      setHover(0);
    }
  }, [open, initialStars, initialContent]);

  async function submit() {
    if (!user || stars < 1) return;
    setSubmitting(true);
    try {
      await submitReview({
        reviewerId: user.id,
        reviewedUserId,
        listingId,
        stars,
        content,
        reviewerRole,
      });
      toast.success("Review submitted! ⭐");
      qc.invalidateQueries({ queryKey: ["listing-reviews", listingId] });
      qc.invalidateQueries({ queryKey: ["listing-ratings"] });
      qc.invalidateQueries({ queryKey: ["reviews", reviewedUserId] });
      qc.invalidateQueries({ queryKey: ["review-stats", reviewedUserId] });
      onOpenChange(false);
      onSubmitted?.();
    } catch (e: any) {
      const msg = String(e?.message ?? "");
      if (msg.includes("duplicate") || msg.toLowerCase().includes("unique")) {
        toast.error("You've already reviewed this listing.");
      } else if (msg.includes("row-level security") || msg.includes("violates")) {
        toast.error("You can't review your own listing.");
      } else {
        toast.error(msg || "Could not submit review");
      }
    } finally {
      setSubmitting(false);
    }
  }

  return (
    <Dialog open={open} onOpenChange={onOpenChange}>
      <DialogContent className="max-w-md rounded-2xl p-6 shadow-xl" showCloseButton={false}>
        <h2 className="text-xl font-semibold">How was it?</h2>
        <p className="truncate text-sm text-muted-foreground">{reviewedName}</p>

        <div className="flex justify-center gap-1 py-4">
          {[1, 2, 3, 4, 5].map((n) => {
            const filled = n <= (hover || stars);
            return (
              <button
                key={n}
                type="button"
                onMouseEnter={() => setHover(n)}
                onMouseLeave={() => setHover(0)}
                onClick={() => setStars(n)}
                aria-label={`${n} star${n > 1 ? "s" : ""}`}
                className="p-1 transition-transform active:scale-90"
              >
                <Star
                  className="h-10 w-10 transition-colors"
                  style={{
                    color: filled ? CORAL : undefined,
                    fill: filled ? CORAL : "transparent",
                  }}
                  strokeWidth={1.5}
                />
              </button>
            );
          })}
        </div>

        <div>
          <label className="mb-1 block text-sm text-muted-foreground">
            Share your experience (optional)
          </label>
          <textarea
            value={content}
            onChange={(e) => setContent(e.target.value.slice(0, 300))}
            rows={4}
            className="w-full resize-none rounded-xl border border-border bg-background p-3 text-sm outline-none focus:ring-2 focus:ring-foreground"
            placeholder="What stood out about the place or the host?"
          />
          <div className="mt-1 text-right text-xs text-muted-foreground">{content.length}/300</div>
        </div>

        <button
          type="button"
          onClick={submit}
          disabled={submitting || stars < 1}
          className={cn(
            "mt-2 w-full rounded-full bg-gray-900 py-3 font-medium text-white dark:bg-white dark:text-gray-900",
            (submitting || stars < 1) && "cursor-not-allowed opacity-50",
          )}
        >
          {submitting ? "Submitting…" : "Submit review →"}
        </button>
        <button
          type="button"
          onClick={() => onOpenChange(false)}
          className="mt-2 block w-full text-center text-sm text-muted-foreground hover:text-foreground"
        >
          Cancel
        </button>
      </DialogContent>
    </Dialog>
  );
}
