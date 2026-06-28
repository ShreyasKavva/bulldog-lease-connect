import { BadgeCheck, Sparkles, Clock } from "lucide-react";
import { cn } from "@/lib/utils";

export type Tier = "unverified" | "basic" | "verified" | "premium";

export function VerificationBadge({
  tier,
  pending,
  size = "sm",
  className,
}: {
  tier?: Tier;
  pending?: boolean;
  size?: "sm" | "md";
  className?: string;
}) {
  if (pending) {
    return (
      <span
        title="Under review by our trust team"
        className={cn(
          "inline-flex items-center gap-1 rounded-full bg-amber-100 dark:bg-amber-500/15 px-2 py-0.5 text-[10px] font-bold text-amber-700 dark:text-amber-200",
          className,
        )}
      >
        <Clock className="h-3 w-3" /> Under review
      </span>
    );
  }
  if (!tier || tier === "unverified") return null;
  if (tier === "basic") {
    return (
      <BadgeCheck
        className={cn(size === "md" ? "h-4 w-4" : "h-3.5 w-3.5", "text-primary", className)}
        aria-label="Basic verification"
      />
    );
  }
  if (tier === "verified") {
    return (
      <span
        title="Verified — poster identity, photos, dates, and details checked"
        className={cn(
          "inline-flex items-center gap-1 rounded-full bg-primary/10 px-2 py-0.5 text-[10px] font-bold text-primary",
          className,
        )}
      >
        <BadgeCheck className="h-3 w-3" /> Verified
      </span>
    );
  }
  return (
    <span
      title="Trusted — verified, highly rated, and SafeScore 80+"
      className={cn(
        "inline-flex items-center gap-1 rounded-full bg-amber-400/20 px-2 py-0.5 text-[10px] font-bold text-amber-700 dark:text-amber-300",
        className,
      )}
    >
      <Sparkles className="h-3 w-3" /> Trusted
    </span>
  );
}
