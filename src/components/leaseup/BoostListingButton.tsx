import { useState } from "react";
import { Button } from "@/components/ui/button";
import { Zap } from "lucide-react";
import { toast } from "sonner";
import { useServerFn } from "@tanstack/react-start";
import { createBoostCheckout } from "@/lib/leaseup/stripe.functions";
import { cn } from "@/lib/utils";

export function BoostCard({
  listingId,
  isFeatured,
  featuredUntil,
}: {
  listingId: string;
  isFeatured?: boolean;
  featuredUntil?: string | null;
}) {
  const [loading, setLoading] = useState(false);
  const checkout = useServerFn(createBoostCheckout);

  if (isFeatured && featuredUntil && new Date(featuredUntil) > new Date()) {
    const daysLeft = Math.max(0, Math.ceil((new Date(featuredUntil).getTime() - Date.now()) / 86400000));
    return (
      <div className="rounded-xl border-2 border-orange-300 bg-gradient-to-r from-orange-50 to-amber-50 p-3 dark:from-orange-950/30 dark:to-amber-950/30">
        <div className="flex items-center gap-2">
          <span className="text-lg">⭐</span>
          <div className="text-sm font-bold">Featured — {daysLeft} day{daysLeft === 1 ? "" : "s"} left</div>
        </div>
        <div className="mt-0.5 text-xs text-muted-foreground">Pinned to the top of the feed.</div>
      </div>
    );
  }

  async function onBoost() {
    setLoading(true);
    try {
      const { url } = await checkout({ data: { listingId } });
      if (!url) throw new Error("No checkout URL returned");
      window.location.href = url;
    } catch (e: any) {
      toast.error(e?.message ?? "Could not start checkout");
      setLoading(false);
    }
  }

  return (
    <div className="rounded-xl border bg-gradient-to-br from-orange-50 to-amber-50 p-4 dark:from-orange-950/30 dark:to-amber-950/30">
      <div className="flex items-start gap-3">
        <div className="grid h-10 w-10 shrink-0 place-items-center rounded-lg bg-orange-500 text-white shadow">
          <Zap className="h-5 w-5" />
        </div>
        <div className="min-w-0 flex-1">
          <div className="text-sm font-black">Boost this listing — $9.99 for 7 days</div>
          <div className="mt-0.5 text-xs text-muted-foreground">Pin to top of feed · ~3× more views · ⭐ Featured badge</div>
        </div>
      </div>
      <Button
        onClick={onBoost}
        disabled={loading}
        className={cn("mt-3 w-full bg-orange-500 font-bold text-white hover:bg-orange-600")}
      >
        {loading ? "Opening checkout…" : "Boost Now →"}
      </Button>
    </div>
  );
}
