import { Flame, Home } from "lucide-react";
import type { Listing } from "@/lib/leaseup/types";


export function TrendingCarousel({
  listings,
  campusName,
  onOpen,
}: {
  listings: Listing[];
  campusName?: string | null;
  onOpen: (l: Listing) => void;
}) {
  // Q105 — only a real trend counts: need at least 2 listings with views.
  const viewed = listings.filter((l) => (l.view_count ?? 0) > 0);
  if (viewed.length < 2) return null;
  listings = viewed;
  return (
    <section className="mb-5">
      <h2 className="mb-2 inline-flex items-center gap-1.5 text-sm font-extrabold">
        🔥 Trending {campusName ? `at ${campusName}` : "this week"}
      </h2>
      <div className="-mx-4 flex snap-x snap-mandatory gap-3 overflow-x-auto px-4 pb-2 [scrollbar-width:none] [&::-webkit-scrollbar]:hidden">
        {listings.map((l) => (
          <button
            key={l.id}
            onClick={() => onOpen(l)}
            className="group w-[220px] flex-none snap-start overflow-hidden rounded-2xl bg-surface text-left shadow-card-md transition hover:-translate-y-0.5 hover:shadow-card-lg"
          >
            <div className="relative h-[200px] w-full overflow-hidden bg-muted">
              {l.photo_urls?.[0] ? (
                <img src={l.photo_urls[0]} alt={l.title} className="h-full w-full object-cover transition group-hover:scale-105" loading="lazy" />
              ) : (
                <div className="grid h-full w-full place-items-center bg-gradient-to-br from-gray-100 to-gray-200 dark:from-muted dark:to-background">
                  <Home className="h-7 w-7 text-gray-400" />
                </div>
              )}
              <div className="absolute left-2 top-2 inline-flex items-center gap-1 rounded-full bg-black/80 px-2 py-1 text-[10px] font-bold text-white">
                <Flame className="h-3 w-3 text-orange-400" /> Trending
              </div>
            </div>
            <div className="space-y-1 p-3">
              <div className="flex items-center justify-between">
                <div className="text-base font-extrabold">${l.price}<span className="text-xs font-semibold text-muted-foreground">/mo</span></div>
                
              </div>
              <div className="line-clamp-1 text-sm font-semibold">{l.title}</div>
              <div className="text-[11px] text-muted-foreground">{l.beds} bd · {l.baths} ba{l.area ? ` · ${l.area}` : ""}</div>
            </div>
          </button>
        ))}
      </div>
    </section>
  );
}
