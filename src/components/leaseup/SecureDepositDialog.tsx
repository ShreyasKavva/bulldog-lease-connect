import { Dialog, DialogContent, DialogHeader, DialogTitle } from "@/components/ui/dialog";
import { Button } from "@/components/ui/button";
import { useEffect, useState } from "react";
import { Elements, PaymentElement, useElements, useStripe } from "@stripe/react-stripe-js";
import { getStripe, isStripeConfigured } from "@/lib/leaseup/stripe-client";
import { useServerFn } from "@tanstack/react-start";
import { createDepositIntent } from "@/lib/leaseup/stripe.functions";
import type { Listing } from "@/lib/leaseup/types";
import { Lock, ShieldCheck } from "lucide-react";
import { toast } from "sonner";

type Step = "review" | "pay" | "done";

export function SecureDepositDialog({
  listing,
  open,
  onOpenChange,
}: {
  listing: Listing | null;
  open: boolean;
  onOpenChange: (o: boolean) => void;
}) {
  const [step, setStep] = useState<Step>("review");
  const [clientSecret, setClientSecret] = useState<string | null>(null);
  const [breakdown, setBreakdown] = useState<{ depositCents: number; feeCents: number; totalCents: number } | null>(null);
  const [loading, setLoading] = useState(false);
  const createIntent = useServerFn(createDepositIntent);

  useEffect(() => {
    if (!open) {
      setStep("review");
      setClientSecret(null);
      setBreakdown(null);
    }
  }, [open]);

  if (!listing) return null;

  const depositDollars = listing.deposit_amount ?? 0;
  const feeDollars = +(depositDollars * 0.025).toFixed(2);
  const totalDollars = +(depositDollars + feeDollars).toFixed(2);

  async function goToPay() {
    if (!isStripeConfigured()) {
      toast.error("Secure deposits aren't enabled yet. We'll launch this soon.");
      return;
    }
    setLoading(true);
    try {
      const res = await createIntent({ data: { listingId: listing!.id, moveInDate: listing!.available_from } });
      setClientSecret(res.clientSecret);
      setBreakdown({ depositCents: res.depositCents, feeCents: res.feeCents, totalCents: res.totalCents });
      setStep("pay");
    } catch (e: any) {
      toast.error(e?.message ?? "Could not start deposit");
    } finally {
      setLoading(false);
    }
  }

  return (
    <Dialog open={open} onOpenChange={onOpenChange}>
      <DialogContent className="max-h-[90vh] max-w-md overflow-y-auto">
        <DialogHeader>
          <DialogTitle className="flex items-center gap-2 text-xl">
            <Lock className="h-5 w-5 text-success" /> Secure Deposit
          </DialogTitle>
        </DialogHeader>

        {step === "review" && (
          <div className="space-y-4">
            <div className="rounded-xl border bg-background p-4">
              <div className="text-xs font-bold uppercase text-muted-foreground">Deposit for</div>
              <div className="mt-0.5 text-base font-bold">{listing.title}</div>
              {listing.available_from && (
                <div className="text-xs text-muted-foreground">
                  Move-in: {new Date(listing.available_from).toLocaleDateString(undefined, { month: "long", day: "numeric", year: "numeric" })}
                </div>
              )}
            </div>

            <dl className="space-y-1.5 rounded-xl border bg-surface p-4 text-sm">
              <Row label="Deposit amount" value={`$${depositDollars.toLocaleString(undefined, { minimumFractionDigits: 2 })}`} />
              <Row label="LeaseUp fee (2.5%)" value={`$${feeDollars.toFixed(2)}`} />
              <div className="my-2 border-t" />
              <Row label="Total charged today" value={`$${totalDollars.toFixed(2)}`} bold />
            </dl>

            <ul className="space-y-1.5 text-xs text-muted-foreground">
              <li>🔒 Funds are held securely until your move-in date.</li>
              <li>✓ Released to {listing.profile?.name ?? "the poster"} 48 hours after move-in with no disputes.</li>
              <li>⚖ Disputed? LeaseUp mediates within 48 hours.</li>
            </ul>

            <Button onClick={goToPay} disabled={loading} className="h-11 w-full bg-primary font-bold text-primary-foreground hover:bg-primary-dark">
              {loading ? "Preparing…" : "Continue to Payment →"}
            </Button>
          </div>
        )}

        {step === "pay" && clientSecret && breakdown && (
          <Elements stripe={getStripe()} options={{ clientSecret, appearance: { theme: "stripe" } }}>
            <PayForm
              totalCents={breakdown.totalCents}
              onSuccess={() => setStep("done")}
            />
          </Elements>
        )}

        {step === "done" && (
          <div className="space-y-4 text-center">
            <div className="mx-auto grid h-16 w-16 place-items-center rounded-full bg-success-light text-3xl">🔒</div>
            <h3 className="text-lg font-black">Deposit held securely</h3>
            <p className="text-sm text-muted-foreground">
              {listing.profile?.name ?? "The poster"} has been notified. Funds will release after your move-in date.
            </p>
            <Button onClick={() => onOpenChange(false)} className="w-full">Done</Button>
          </div>
        )}
      </DialogContent>
    </Dialog>
  );
}

function PayForm({ totalCents, onSuccess }: { totalCents: number; onSuccess: () => void }) {
  const stripe = useStripe();
  const elements = useElements();
  const [submitting, setSubmitting] = useState(false);

  async function submit(e: React.FormEvent) {
    e.preventDefault();
    if (!stripe || !elements) return;
    setSubmitting(true);
    const { error } = await stripe.confirmPayment({
      elements,
      confirmParams: { return_url: `${window.location.origin}/my-listings?deposit=ok` },
      redirect: "if_required",
    });
    if (error) {
      toast.error(error.message ?? "Payment failed");
      setSubmitting(false);
      return;
    }
    onSuccess();
  }

  return (
    <form onSubmit={submit} className="space-y-4">
      <PaymentElement />
      <Button
        type="submit"
        disabled={!stripe || submitting}
        className="h-11 w-full bg-primary font-bold text-primary-foreground hover:bg-primary-dark"
      >
        <ShieldCheck className="mr-1.5 h-4 w-4" />
        {submitting ? "Holding funds…" : `Pay & hold $${(totalCents / 100).toFixed(2)}`}
      </Button>
      <p className="text-center text-[11px] text-muted-foreground">
        Funds are authorized today and held until move-in. Powered by Stripe.
      </p>
    </form>
  );
}

function Row({ label, value, bold }: { label: string; value: string; bold?: boolean }) {
  return (
    <div className="flex items-center justify-between">
      <span className={bold ? "font-bold" : "text-muted-foreground"}>{label}</span>
      <span className={bold ? "text-base font-black" : "font-semibold"}>{value}</span>
    </div>
  );
}
