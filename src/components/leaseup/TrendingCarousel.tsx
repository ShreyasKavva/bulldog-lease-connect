import { useState } from "react";
import { Flame, Heart } from "lucide-react";
import { Link } from "@tanstack/react-router";
import { ListingPhoto } from "./ListingPhoto";
import type { Listing } from "@/lib/leaseup/types";
import { cn } from "@/lib/utils";
import { useSession } from "@/lib/leaseup/use-session";
import { openSignIn } from "./SignInModal";
import { useToggleSave } from "@/lib/leaseup/use-toggle-save";
import { openQuickInquiry } from "./QuickInquiryModal";


export function TrendingCarousel({
  listings,
  campusName,
  onOpen,
  savedIds,
  heading,
}: {
  listings: Listing[];
  campusName?: string | null;
  onOpen: (l: Listing) => void;
  savedIds?: Set<string>;
  /** Q375 — alternate heading when the results are empty because of filters. */
  heading?: string;
}) {
  const { user } = useSession();
  const toggleSave = useToggleSave(user?.id);
  // Q267 — once this user hearts, we own the number: +1 on save, -1 on
  // unsave, computed from the last displayed count so a background refetch
  // (which already includes their save) can't double-count.
  const [savesOverrides, setSavesOverrides] = useState<Record<string, number>>({});
  // Q105 — only a real trend counts: need at least 2 listings with views.
  const viewed = listings.filter((l) => (l.view_count ?? 0) > 0);
  if (viewed.length < 2) return null;

  async function handleSave(e: React.MouseEvent, l: Listing) {
    e.preventDefault();
    e.stopPropagation();
    import("@/lib/haptics").then((m) => m.haptic(10));
    if (!user) {
      openSignIn(typeof window !== "undefined" ? window.location.pathname : undefined);
      return;
    }
    const result = await toggleSave(l.id);
    if (!result) return;
    setSavesOverrides((m) => ({
      ...m,
      [l.id]: Math.max(0, (m[l.id] ?? l.saves_count ?? 0) + (result === "unsaved" ? -1 : 1)),
    }));
  }

  function handleMessage(e: React.MouseEvent, l: Listing) {
    e.preventDefault();
    e.stopPropagation();
    openQuickInquiry(l);
  }

  return (
    <section className="mb-5">
      <h2 className="mb-2 inline-flex items-center gap-1.5 text-sm font-extrabold">
        {heading ?? `🔥 Trending ${campusName ? `at ${campusName}` : "this week"}`}
      </h2>
      <div className="-mx-4 flex snap-x snap-mandatory gap-3 overflow-x-auto px-4 pb-2 [scrollbar-width:none] [&::-webkit-scrollbar]:hidden">
        {viewed.map((l) => {
          const saved = savedIds?.has(l.id) ?? false;
          const savesCount = savesOverrides[l.id] ?? Math.max(0, l.saves_count ?? 0);
          return (
            <div
              key={l.id}
              className="group relative w-[220px] flex-none cursor-pointer snap-start overflow-hidden rounded-2xl bg-surface text-left shadow-card-md transition focus-within:ring-2 focus-within:ring-indigo-600 hover:-translate-y-0.5 hover:shadow-card-lg"
            >
              {/* Q510 — stretched real link; plain left click still opens the
                  slide-out, modified clicks fall through to the browser. */}
              <Link
                to="/listing/$id"
                params={{ id: l.id }}
                aria-label={`${l.title?.trim() || "Sublease"}, $${Number(l.price).toLocaleString("en-US")} per month`}
                onClick={(e) => {
                  if (e.metaKey || e.ctrlKey || e.shiftKey || e.altKey || e.button !== 0) return;
                  e.preventDefault();
                  onOpen(l);
                }}
                className="absolute inset-0 z-10 rounded-2xl focus:outline-none"
              />
              <div className="relative h-[200px] w-full overflow-hidden bg-muted">
                {/* Q482 — same honest placeholder everywhere; no stand-in photos. */}
                <ListingPhoto src={l.photo_urls?.[0]} alt={l.title} size="md" className="h-full w-full object-cover transition group-hover:scale-105" loading="lazy" />
                <div className="absolute left-2 top-2 inline-flex items-center gap-1 rounded-full bg-black/80 px-2 py-1 text-[10px] font-bold text-white">
                  <Flame className="h-3 w-3 text-orange-400" /> Trending
                </div>
                <button
                  type="button"
                  onClick={(e) => handleSave(e, l)}
                  aria-label={saved ? "Unsave" : "Save"}
                  title={saved ? "Remove from Saved" : "Save to see it in Saved"}
                  className="absolute right-2 top-2 z-20 flex items-center gap-1 transition-transform hover:scale-110 active:scale-95 touch-manipulation"
                >
                  <span className="grid h-8 w-8 place-items-center rounded-full border border-white/30 bg-black/25 shadow-sm backdrop-blur-sm">
                    <Heart
                      className={cn(
                        "h-4 w-4 transition-transform",
                        saved ? "scale-110 fill-[#FF5A5F] text-[#FF5A5F]" : "text-white",
                      )}
                    />
                  </span>
                  {savesCount > 0 && (
                    <span className="rounded-full border border-white/30 bg-black/25 px-1.5 py-0.5 text-xs font-medium leading-none text-white backdrop-blur-sm shadow-sm">
                      {savesCount}
                    </span>
                  )}
                </button>
                <div className="absolute bottom-0 left-0 right-0 z-20 flex gap-2 bg-gradient-to-t from-black/60 to-transparent p-2 opacity-100 transition-opacity duration-200 md:opacity-0 md:group-hover:opacity-100">
                  <button
                    type="button"
                    onClick={(e) => handleMessage(e, l)}
                    aria-label="Message the host"
                    className="rounded-full border border-white/70 bg-white/90 px-2 py-1 text-xs font-semibold text-gray-900 shadow-sm hover:bg-white"
                  >
                    💬 Message
                  </button>
                </div>
              </div>
              <div className="space-y-1 p-3">
                <div className="flex items-center justify-between">
                  <div className="text-base font-extrabold">${Number(l.price).toLocaleString("en-US")}<span className="text-xs font-semibold text-muted-foreground">/mo</span></div>

                </div>
                <div className="line-clamp-1 text-sm font-semibold">{l.title}</div>
                <div className="text-[11px] text-muted-foreground">{l.beds} bd · {l.baths} ba{l.area ? ` · ${l.area}` : ""}</div>
              </div>
            </div>
          );
        })}
      </div>
    </section>
  );
}
