import { REACTION_META, REACTION_ORDER, useListingReactions, useToggleReaction, type ReactionType } from "@/lib/leaseup/reactions";
import { useSession } from "@/lib/leaseup/use-session";
import { cn } from "@/lib/utils";
import { toast } from "sonner";

export function ReactionBar({ listingId }: { listingId: string }) {
  const { user } = useSession();
  const { data } = useListingReactions(listingId);
  const toggle = useToggleReaction(listingId);
  const mine = data?.mine ?? null;
  const counts = data?.counts;

  function onClick(r: ReactionType) {
    if (!user) { toast.error("Sign in to react"); return; }
    toggle.mutate(r);
  }

  return (
    <div>
      <div className="-mx-1 flex flex-wrap gap-1.5 px-1">
        {REACTION_ORDER.map((r) => {
          const meta = REACTION_META[r];
          const active = mine === r;
          const count = counts?.[r] ?? 0;
          return (
            <button
              key={r}
              type="button"
              onClick={() => onClick(r)}
              title={meta.label}
              aria-pressed={active}
              className={cn(
                "group inline-flex items-center gap-1.5 rounded-full border px-3 py-1.5 text-sm font-semibold transition active:scale-95",
                active
                  ? "border-primary bg-[#EFF6FF] text-primary-dark"
                  : "border-border bg-surface text-foreground hover:border-primary/40 hover:bg-background",
              )}
            >
              <span className="text-base leading-none transition-transform group-hover:scale-110">{meta.emoji}</span>
              <span className="tabular-nums">{count}</span>
            </button>
          );
        })}
      </div>
      <div className="mt-1.5 px-1 text-[10px] text-muted-foreground sm:hidden">
        🔥 Great deal · 😍 Want this · 😮 Wow · 💸 Too pricey · 🤔 Something's off
      </div>
    </div>
  );
}
