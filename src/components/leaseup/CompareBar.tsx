import type { Listing } from "@/lib/leaseup/types";
import { Scale, X } from "lucide-react";
import { cn } from "@/lib/utils";

export function CompareBar({
  listings,
  onOpen,
  onClear,
  onRemove,
}: {
  listings: Listing[];
  onOpen: () => void;
  onClear: () => void;
  onRemove: (id: string) => void;
}) {
  if (listings.length === 0) return null;
  return (
    <div className="pointer-events-none fixed inset-x-0 bottom-4 z-40 flex justify-center px-4">
      <div className="pointer-events-auto flex w-full max-w-3xl items-center gap-3 rounded-2xl border bg-foreground/95 px-3 py-2 text-background shadow-card-lg backdrop-blur">
        <div className="flex -space-x-2 pl-1">
          {listings.map(l => {
            const photo = l.photo_urls?.[0];
            return (
              <div
                key={l.id}
                className="relative h-10 w-10 overflow-hidden rounded-full border-2 border-foreground bg-muted"
                title={l.title}
              >
                {photo ? (
                  <img src={photo} alt="" className="h-full w-full object-cover" />
                ) : (
                  <div className="grid h-full w-full place-items-center text-base">🏠</div>
                )}
                <button
                  onClick={() => onRemove(l.id)}
                  aria-label="Remove"
                  className="absolute -right-0.5 -top-0.5 grid h-4 w-4 place-items-center rounded-full bg-destructive text-white"
                >
                  <X className="h-2.5 w-2.5" />
                </button>
              </div>
            );
          })}
        </div>
        <div className="flex-1 text-xs font-semibold">
          {listings.length} pinned <span className="text-background/60">· {listings.length < 2 ? "pin one more to compare" : "ready to stack"}</span>
        </div>
        <button
          onClick={onClear}
          className="rounded-md px-2 py-1.5 text-[11px] font-bold text-background/70 hover:bg-background/10"
        >
          Clear
        </button>
        <button
          onClick={onOpen}
          disabled={listings.length < 2}
          className={cn(
            "inline-flex items-center gap-1.5 rounded-md bg-primary px-3 py-1.5 text-xs font-bold text-primary-foreground",
            listings.length < 2 ? "opacity-50" : "hover:bg-primary-dark",
          )}
        >
          <Scale className="h-3.5 w-3.5" />
          Compare
        </button>
      </div>
    </div>
  );
}
