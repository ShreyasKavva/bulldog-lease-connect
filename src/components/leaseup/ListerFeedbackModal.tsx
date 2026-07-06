/**
 * Post-rent feedback modal (Queue 76 Part A).
 *
 * Shown immediately after a lister marks their listing as rented. One
 * multiple-choice question + optional comments. Skippable — never blocks
 * the mark-as-rented flow.
 */
import { useState } from "react";
import {
  Dialog, DialogContent, DialogHeader, DialogTitle, DialogDescription, DialogFooter,
} from "@/components/ui/dialog";
import { Button } from "@/components/ui/button";
import { Textarea } from "@/components/ui/textarea";
import { supabase } from "@/integrations/supabase/client";
import { toast } from "sonner";

const OPTIONS: Array<{ value: string; label: string }> = [
  { value: "messaged_on_leaseup",    label: "They messaged me through LeaseUp" },
  { value: "looking_for_board",      label: "I found them on the Looking For board" },
  { value: "shared_listing_link",    label: "They shared my listing link directly" },
  { value: "group_chat",             label: "Someone in a group chat saw my listing" },
  { value: "other",                  label: "Other" },
];

export function ListerFeedbackModal({
  open, onClose, listingId, listingTitle, userId,
}: {
  open: boolean;
  onClose: () => void;
  listingId: string;
  listingTitle: string;
  userId: string;
}) {
  const [howFound, setHowFound] = useState<string | null>(null);
  const [comments, setComments] = useState("");
  const [saving, setSaving] = useState(false);
  const [thanks, setThanks] = useState(false);

  async function submit() {
    if (!howFound) {
      toast.error("Pick one so we know what worked.");
      return;
    }
    setSaving(true);
    const { error } = await supabase.from("listing_feedback" as any).insert({
      listing_id: listingId,
      user_id: userId,
      how_found_renter: howFound,
      additional_comments: comments.trim() || null,
    } as any);
    setSaving(false);
    if (error) {
      toast.error(error.message ?? "Couldn't save feedback");
      return;
    }
    setThanks(true);
    setTimeout(() => onClose(), 1500);
  }

  return (
    <Dialog open={open} onOpenChange={(o) => !saving && !o && onClose()}>
      <DialogContent className="sm:max-w-md">
        {thanks ? (
          <div className="py-8 text-center">
            <div className="text-4xl">🙏</div>
            <p className="mt-2 text-lg font-bold">Thanks! This helps us improve.</p>
          </div>
        ) : (
          <>
            <DialogHeader>
              <DialogTitle>🎉 Nice work!</DialogTitle>
              <DialogDescription>
                Your sublease at <span className="font-semibold">{listingTitle}</span> is marked as rented.
              </DialogDescription>
            </DialogHeader>

            <div className="mt-2 space-y-3">
              <p className="text-sm font-semibold">How did you find your renter?</p>
              <div className="space-y-2">
                {OPTIONS.map((o) => (
                  <label
                    key={o.value}
                    className="flex cursor-pointer items-center gap-2 rounded-lg border border-border p-2.5 text-sm transition hover:border-primary hover:bg-primary/5"
                  >
                    <input
                      type="radio"
                      name="how-found-renter"
                      value={o.value}
                      checked={howFound === o.value}
                      onChange={() => setHowFound(o.value)}
                      className="h-4 w-4 accent-primary"
                    />
                    {o.label}
                  </label>
                ))}
              </div>

              <div>
                <label className="text-sm font-semibold" htmlFor="lf-comments">
                  Anything else you'd like to share? <span className="font-normal text-muted-foreground">(optional)</span>
                </label>
                <Textarea
                  id="lf-comments"
                  value={comments}
                  onChange={(e) => setComments(e.target.value)}
                  placeholder="e.g. Super smooth, had 3 interested renters in 2 days"
                  className="mt-1"
                  maxLength={500}
                />
              </div>
            </div>

            <DialogFooter className="gap-2 sm:gap-2">
              <Button variant="ghost" onClick={onClose} disabled={saving}>Skip →</Button>
              <Button onClick={submit} disabled={saving}>
                {saving ? "Submitting…" : "Submit feedback →"}
              </Button>
            </DialogFooter>
          </>
        )}
      </DialogContent>
    </Dialog>
  );
}
