/**
 * Horizontal scroll rail for a group of listings (Airbnb-style).
 * Uses ListingCard so all trust/verification signals stay consistent.
 */
import { useRef } from "react";
import { ChevronLeft, ChevronRight, ArrowRight } from "lucide-react";
import type { Listing } from "@/lib/leaseup/types";
import { ListingCard } from "./ListingCard";

export function ListingRail({
  title, listings, savedIds, onSave, onOpen, onSeeAll,
}: {
  title: React.ReactNode;
  listings: Listing[];
  savedIds: Set<string>;
  onSave: (l: Listing) => void;
  onOpen: (l: Listing) => void;
  onSeeAll?: () => void;
}) {
  const scroller = useRef<HTMLDivElement>(null);
  if (listings.length === 0) return null;

  function scroll(dir: 1 | -1) {
    const el = scroller.current;
    if (!el) return;
    el.scrollBy({ left: dir * (el.clientWidth * 0.9), behavior: "smooth" });
  }

  return (
    <section className="mx-auto w-full max-w-7xl px-4 py-5 sm:px-6">
      <div className="mb-3 flex items-center justify-between">
        <h2 className="flex items-center gap-2 text-lg font-extrabold sm:text-xl">
          {title}
          {onSeeAll && (
            <button onClick={onSeeAll} className="text-muted-foreground hover:text-foreground">
              <ArrowRight className="h-4 w-4" />
            </button>
          )}
        </h2>
        <div className="hidden gap-1 sm:flex">
          <button onClick={() => scroll(-1)} className="grid h-8 w-8 place-items-center rounded-full border hover:bg-background" aria-label="Scroll left">
            <ChevronLeft className="h-4 w-4" />
          </button>
          <button onClick={() => scroll(1)} className="grid h-8 w-8 place-items-center rounded-full border hover:bg-background" aria-label="Scroll right">
            <ChevronRight className="h-4 w-4" />
          </button>
        </div>
      </div>
      <div
        ref={scroller}
        className="-mx-4 flex snap-x snap-mandatory gap-3 overflow-x-auto scroll-smooth px-4 pb-2 [scrollbar-width:none] [&::-webkit-scrollbar]:hidden sm:mx-0 sm:px-0"
      >
        {listings.map((l) => (
          <div key={l.id} className="w-64 flex-shrink-0 snap-start sm:w-72">
            <ListingCard
              listing={l}
              saved={savedIds.has(l.id)}
              onSave={() => onSave(l)}
              onOpen={() => onOpen(l)}
            />
          </div>
        ))}
      </div>
    </section>
  );
}
