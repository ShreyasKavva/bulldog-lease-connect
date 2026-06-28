import { Dialog, DialogContent, DialogHeader, DialogTitle } from "@/components/ui/dialog";
import { Button } from "@/components/ui/button";
import { Textarea } from "@/components/ui/textarea";
import { Star } from "lucide-react";
import { useState } from "react";
import { toast } from "sonner";
import { useQueryClient } from "@tanstack/react-query";
import { useSession } from "@/lib/leaseup/use-session";
import { submitReview } from "@/lib/leaseup/reviews.queries";
import { cn } from "@/lib/utils";

export function LeaveReviewDialog({
  open,
  onOpenChange,
  reviewedUserId,
  reviewedName,
  listingId = null,
  reviewerRole,
  onSubmitted,
}: {
  open: boolean;
  onOpenChange: (o: boolean) => void;
  reviewedUserId: string;
  reviewedName: string;
  listingId?: string | null;
  reviewerRole: "subletter" | "poster";
  onSubmitted?: () => void;
}) {
  const { user } = useSession();
  const qc = useQueryClient();
  const [stars, setStars] = useState(0);
  const [hover, setHover] = useState(0);
  const [content, setContent] = useState("");
  const [submitting, setSubmitting] = useState(false);

  function reset() {
    setStars(0);
    setHover(0);
    setContent("");
  }

  async function submit() {
    if (!user) return;
    if (stars < 1) {
      toast.error("Tap a star to rate");
      return;
    }
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
      toast.success("Review posted ✓ — it'll show on their profile");
      qc.invalidateQueries({ queryKey: ["reviews", reviewedUserId] });
      qc.invalidateQueries({ queryKey: ["review-stats", reviewedUserId] });
      reset();
      onOpenChange(false);
      onSubmitted?.();
    } catch (e: any) {
      const msg = String(e?.message ?? "");
      if (msg.includes("duplicate") || msg.toLowerCase().includes("unique")) {
        toast.error("You've already reviewed this person for this sublease.");
      } else if (msg.includes("row-level security") || msg.includes("violates")) {
        toast.error("You can only review someone you've messaged with.");
      } else {
        toast.error(msg || "Could not submit review");
      }
    } finally {
      setSubmitting(false);
    }
  }

  return (
    <Dialog open={open} onOpenChange={(o) => { if (!o) reset(); onOpenChange(o); }}>
      <DialogContent className="max-w-md">
        <DialogHeader>
          <DialogTitle className="text-lg font-black">
            How was your experience with {reviewedName}?
          </DialogTitle>
        </DialogHeader>

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
                  className={cn(
                    "h-11 w-11 transition-colors",
                    filled ? "fill-amber-400 text-amber-400" : "fill-transparent text-muted-foreground/40",
                  )}
                  strokeWidth={1.5}
                />
              </button>
            );
          })}
        </div>

        <div>
          <Textarea
            value={content}
            onChange={(e) => setContent(e.target.value.slice(0, 200))}
            placeholder="Write something (optional)…"
            rows={3}
            className="resize-none"
          />
          <div className="mt-1 text-right text-[11px] text-muted-foreground">
            {content.length}/200
          </div>
        </div>

        <div className="mt-2 flex gap-2">
          <Button variant="outline" className="flex-1" onClick={() => onOpenChange(false)} disabled={submitting}>
            Skip
          </Button>
          <Button
            onClick={submit}
            disabled={submitting || stars < 1}
            className="flex-1 bg-primary hover:bg-primary-dark text-primary-foreground font-bold"
          >
            {submitting ? "Posting…" : "Submit Review"}
          </Button>
        </div>
      </DialogContent>
    </Dialog>
  );
}
