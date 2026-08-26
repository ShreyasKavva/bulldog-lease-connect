/**
 * Renter feedback prompt (Queue 76 Part C).
 *
 * After a renter has sent at least one message about a listing, we ask —
 * exactly once, non-blocking — whether they found a place. Shown as a
 * small banner on /browse; opens a follow-up modal on "I found a place".
 *
 * Dismissal is stored in localStorage keyed per user so it never repeats.
 * A successful submission also inserts into `renter_feedback` (one row per
 * user via a UNIQUE constraint), which double-guards against re-showing.
 */
import { useEffect, useState } from "react";
import { supabase } from "@/integrations/supabase/client";
import {
  Dialog, DialogContent, DialogHeader, DialogTitle, DialogDescription, DialogFooter,
} from "@/components/ui/dialog";
import { Button } from "@/components/ui/button";
import { X } from "lucide-react";
import { toast } from "sonner";

const DISMISS_KEY = (uid: string) => `leaseup:renter-feedback-dismissed:${uid}`;

const OPTIONS: Array<{ value: string; label: string }> = [
  { value: "messaged_on_leaseup",   label: "Through a listing I messaged on LeaseUp" },
  { value: "looking_for_board",     label: "Through the Roommate Search board" },
  { value: "shared_link",           label: "Someone shared a listing link with me" },
  { value: "still_looking",         label: "I'm still looking, haven't found one yet" },
];

export function RenterFeedbackPrompt({ userId }: { userId: string | undefined }) {
  const [visible, setVisible] = useState(false);
  const [modalOpen, setModalOpen] = useState(false);
  const [choice, setChoice] = useState<string | null>(null);
  const [saving, setSaving] = useState(false);

  useEffect(() => {
    if (!userId) return;
    let cancelled = false;
    (async () => {
      // Already dismissed on this device.
      try {
        if (localStorage.getItem(DISMISS_KEY(userId))) return;
      } catch { /* localStorage disabled */ }

      // Already submitted.
      const { count: submittedCount } = await supabase
        .from("renter_feedback" as any)
        .select("id", { count: "exact", head: true })
        .eq("user_id", userId);
      if (cancelled) return;
      if ((submittedCount ?? 0) > 0) return;

      // Must have sent at least one message.
      const { count: msgCount } = await supabase
        .from("messages")
        .select("id", { count: "exact", head: true })
        .eq("sender_id", userId);
      if (cancelled) return;
      if (!msgCount || msgCount < 1) return;

      setVisible(true);
    })();
    return () => { cancelled = true; };
  }, [userId]);

  function dismiss() {
    if (userId) {
      try { localStorage.setItem(DISMISS_KEY(userId), "1"); } catch { /* ignore */ }
    }
    setVisible(false);
  }

  async function submit() {
    if (!userId || !choice) {
      toast.error("Pick one so we know what worked.");
      return;
    }
    setSaving(true);
    const { error } = await supabase.from("renter_feedback" as any).insert({
      user_id: userId,
      how_found: choice,
    } as any);
    setSaving(false);
    if (error && !`${error.message}`.toLowerCase().includes("duplicate")) {
      toast.error(error.message ?? "Couldn't save feedback");
      return;
    }
    toast.success("Thanks! This helps us improve.");
    dismiss();
    setModalOpen(false);
  }

  if (!visible || !userId) return null;

  return (
    <>
      <div className="mb-3 flex items-center gap-3 rounded-xl border border-border bg-primary/5 px-4 py-3 text-sm">
        <span className="flex-1">
          Found what you're looking for? Let us know — it helps other students.
        </span>
        <Button size="sm" onClick={() => { setChoice("messaged_on_leaseup"); setModalOpen(true); }}>
          I found a place ✓
        </Button>
        <Button size="sm" variant="ghost" onClick={dismiss}>Still looking</Button>
        <button
          aria-label="Dismiss"
          onClick={dismiss}
          className="ml-1 rounded-full p-1 text-muted-foreground hover:bg-muted"
        >
          <X className="h-4 w-4" />
        </button>
      </div>

      <Dialog open={modalOpen} onOpenChange={(o) => !saving && setModalOpen(o)}>
        <DialogContent className="sm:max-w-md">
          <DialogHeader>
            <DialogTitle>Glad it worked out!</DialogTitle>
            <DialogDescription>How did you find your place?</DialogDescription>
          </DialogHeader>
          <div className="mt-2 space-y-2">
            {OPTIONS.map((o) => (
              <label
                key={o.value}
                className="flex cursor-pointer items-center gap-2 rounded-lg border border-border p-2.5 text-sm transition hover:border-primary hover:bg-primary/5"
              >
                <input
                  type="radio"
                  name="renter-how-found"
                  value={o.value}
                  checked={choice === o.value}
                  onChange={() => setChoice(o.value)}
                  className="h-4 w-4 accent-primary"
                />
                {o.label}
              </label>
            ))}
          </div>
          <DialogFooter className="gap-2 sm:gap-2">
            <Button variant="ghost" onClick={() => setModalOpen(false)} disabled={saving}>Skip</Button>
            <Button onClick={submit} disabled={saving}>
              {saving ? "Submitting…" : "Submit"}
            </Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>
    </>
  );
}
