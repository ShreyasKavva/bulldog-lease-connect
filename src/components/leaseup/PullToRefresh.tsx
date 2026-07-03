/**
 * Pull-to-refresh wrapper. Renders a small blue spinner that follows the
 * user's pull gesture and spins while refreshing. Wrap any page body with it.
 */
import type { ReactNode } from "react";
import { Loader2 } from "lucide-react";
import { usePullToRefresh } from "@/hooks/use-pull-to-refresh";
import { cn } from "@/lib/utils";

export function PullToRefresh({
  onRefresh,
  children,
}: {
  onRefresh: () => Promise<void> | void;
  children: ReactNode;
}) {
  const { pull, refreshing } = usePullToRefresh(onRefresh);
  const visible = pull > 0.05 || refreshing;
  const rotate = Math.min(360, pull * 360);
  const scale = Math.min(1, 0.6 + pull * 0.6);

  return (
    <>
      <div
        aria-hidden={!visible}
        className={cn(
          "pointer-events-none fixed inset-x-0 z-40 flex justify-center transition-opacity",
          visible ? "opacity-100" : "opacity-0",
        )}
        style={{
          top: `calc(env(safe-area-inset-top) + 3.5rem)`,
        }}
      >
        <div
          className="flex h-10 w-10 items-center justify-center rounded-full bg-white shadow-card"
          style={{
            transform: `translateY(${Math.min(48, pull * 48)}px) scale(${scale})`,
          }}
        >
          <Loader2
            className={cn("h-5 w-5 text-primary", refreshing && "animate-spin")}
            style={refreshing ? undefined : { transform: `rotate(${rotate}deg)` }}
          />
        </div>
      </div>
      {children}
    </>
  );
}
