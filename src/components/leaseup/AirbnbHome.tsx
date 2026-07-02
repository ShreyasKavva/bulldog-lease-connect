/**
 * Airbnb-style homepage — public browsing for everyone (guest & logged-in).
 * Auth is only required when the user tries to POST or MESSAGE — those
 * actions call the `requireAuth` callback which navigates to /auth?next=...
 */
import { useMemo, useState } from "react";
import { Link, useNavigate } from "@tanstack/react-router";
import { Globe, Menu, Map as MapIcon, LayoutGrid } from "lucide-react";
import type { Listing } from "@/lib/leaseup/types";
import type { Campus } from "@/lib/leaseup/campuses";
import { useSession, useMyProfile } from "@/lib/leaseup/use-session";
import { supabase } from "@/integrations/supabase/client";
import { NotificationsBell } from "./NotificationsBell";
import { SearchPill, EMPTY_SEARCH, type SearchState } from "./SearchPill";
import { ListingRail } from "./ListingRail";
import { MapHome } from "./MapHome";
import { UGA_CENTER } from "@/lib/leaseup/constants";

type Cat = "all" | "sublease" | "transfer";

export function AirbnbHome({
  listings, campuses, savedIds, onSave, onOpen, onMessage, onPost,
}: {
  listings: Listing[];
  campuses: Campus[];
  savedIds: Set<string>;
  onSave: (l: Listing) => void;
  onOpen: (l: Listing) => void;
  onMessage: (l: Listing) => void;
  onPost: () => void;
}) {
  const navigate = useNavigate();
  const { user } = useSession();
  const { data: profile } = useMyProfile();

  const [search, setSearch] = useState<SearchState>(EMPTY_SEARCH);
  const [cat, setCat] = useState<Cat>("all");
  const [view, setView] = useState<"grid" | "map">("grid");

  // Apply search + category filter
  const filtered = useMemo(() => {
    return listings.filter((l) => {
      if (cat !== "all" && l.type !== cat) return false;
      if (search.campusId && l.campus_id !== search.campusId) return false;
      if (!search.campusId && search.where.trim()) {
        const q = search.where.toLowerCase();
        if (!(`${l.title} ${l.area ?? ""}`.toLowerCase().includes(q))) return false;
      }
      if (search.guests > 1 && l.beds < Math.ceil(search.guests / 2)) return false;
      // Loose date overlap
      if (search.from && l.available_to && new Date(l.available_to) < search.from) return false;
      if (search.to && l.available_from && new Date(l.available_from) > search.to) return false;
      return true;
    });
  }, [listings, cat, search]);

  const activeCampus = search.campusId
    ? campuses.find((c) => c.id === search.campusId) ?? null
    : user
      ? campuses.find((c) => c.id === profile?.campus_id) ?? null
      : null;

  // Rails
  const basedOnSearch = filtered.slice(0, 12);
  const nearCampus = useMemo(() => {
    if (!activeCampus) return [];
    return listings.filter((l) => l.campus_id === activeCampus.id && l.type !== "transfer").slice(0, 12);
  }, [listings, activeCampus]);
  const trending = useMemo(() => {
    return [...listings]
      .sort((a, b) => (b.view_count ?? 0) - (a.view_count ?? 0))
      .slice(0, 12);
  }, [listings]);
  const otherCampuses = useMemo(() => {
    return campuses
      .filter((c) => c.id !== activeCampus?.id)
      .map((c) => ({
        campus: c,
        items: listings.filter((l) => l.campus_id === c.id).slice(0, 12),
      }))
      .filter((g) => g.items.length >= 3)
      .slice(0, 3);
  }, [campuses, listings, activeCampus]);

  const mapCenter: [number, number] = activeCampus
    ? [activeCampus.lat, activeCampus.lng]
    : UGA_CENTER;

  async function signOut() {
    await supabase.auth.signOut();
    navigate({ to: "/" });
  }

  return (
    <div className="min-h-screen bg-background pb-24">
      {/* Top bar */}
      <header className="sticky top-0 z-40 border-b bg-surface/95 backdrop-blur">
        <div className="mx-auto flex max-w-7xl items-center justify-between gap-4 px-4 py-3 sm:px-6">
          <Link to="/" className="text-2xl font-black tracking-tight">
            <span className="text-primary">Lease</span><span className="text-foreground">Up</span>
          </Link>

          {/* Category tabs */}
          <div className="hidden items-center gap-6 md:flex">
            {([
              { k: "all", label: "All" },
              { k: "sublease", label: "Sublets" },
              { k: "transfer", label: "Transfers" },
            ] as { k: Cat; label: string }[]).map((c) => (
              <button
                key={c.k}
                onClick={() => setCat(c.k)}
                className={`relative pb-1 text-sm font-semibold transition ${
                  cat === c.k ? "text-foreground" : "text-muted-foreground hover:text-foreground"
                }`}
              >
                {c.label}
                {cat === c.k && (
                  <span className="absolute inset-x-0 -bottom-0.5 h-0.5 rounded-full bg-foreground" />
                )}
              </button>
            ))}
          </div>

          <div className="flex items-center gap-2">
            <button
              onClick={onPost}
              className="hidden rounded-full px-4 py-2 text-sm font-semibold text-foreground hover:bg-background sm:inline-flex"
            >
              Become a host
            </button>
            <button className="hidden h-9 w-9 items-center justify-center rounded-full text-muted-foreground hover:bg-background sm:inline-flex" aria-label="Language">
              <Globe className="h-4 w-4" />
            </button>
            {user ? (
              <div className="flex items-center gap-2 rounded-full border bg-surface px-1.5 py-1 shadow-sm hover:shadow">
                <Menu className="ml-1 h-4 w-4 text-muted-foreground" />
                <NotificationsBell onOpenMessages={() => navigate({ to: "/" })} />
                <Link
                  to="/profile"
                  className="grid h-8 w-8 place-items-center rounded-full text-base"
                  style={{ background: profile?.banner_color ?? "#2563EB" }}
                  title={profile?.name ?? "Me"}
                >
                  {profile?.avatar_emoji ?? "🙂"}
                </Link>
              </div>
            ) : (
              <div className="flex items-center gap-1 rounded-full border bg-surface px-2 py-1 shadow-sm">
                <Menu className="h-4 w-4 text-muted-foreground" />
                <Link
                  to="/auth"
                  search={{ mode: "in" }}
                  className="rounded-full px-3 py-1 text-sm font-semibold hover:bg-background"
                >
                  Sign in
                </Link>
              </div>
            )}
            {user && (
              <button
                onClick={signOut}
                className="hidden text-xs text-muted-foreground hover:text-foreground md:inline"
              >Sign out</button>
            )}
          </div>
        </div>

        {/* Search pill */}
        <div className="mx-auto max-w-7xl px-4 pb-4 pt-1 sm:px-6">
          <SearchPill value={search} onChange={setSearch} />
        </div>
      </header>

      {/* View toggle */}
      <div className="mx-auto flex max-w-7xl items-center justify-between px-4 pt-4 sm:px-6">
        <div className="text-xs font-semibold text-muted-foreground">
          {filtered.length} {filtered.length === 1 ? "stay" : "stays"}
          {activeCampus ? ` near ${activeCampus.short_name ?? activeCampus.name}` : ""}
        </div>
        <div className="flex items-center gap-1 rounded-full border bg-surface p-1 shadow-sm">
          <button
            onClick={() => setView("grid")}
            className={`flex items-center gap-1 rounded-full px-3 py-1 text-xs font-bold ${view === "grid" ? "bg-foreground text-background" : "text-muted-foreground"}`}
          ><LayoutGrid className="h-3.5 w-3.5" />Grid</button>
          <button
            onClick={() => setView("map")}
            className={`flex items-center gap-1 rounded-full px-3 py-1 text-xs font-bold ${view === "map" ? "bg-foreground text-background" : "text-muted-foreground"}`}
          ><MapIcon className="h-3.5 w-3.5" />Map</button>
        </div>
      </div>

      {view === "map" ? (
        <div className="relative mx-auto mt-3 h-[70vh] max-w-7xl overflow-hidden rounded-2xl border">
          <MapHome
            listings={filtered}
            center={mapCenter}
            onSelectListing={onOpen}
            onMessageListing={onMessage}
          />
        </div>
      ) : (
        <>
          {(search.where || search.from || search.guests > 1) && basedOnSearch.length > 0 && (
            <ListingRail
              title={<>Based on your search</>}
              listings={basedOnSearch}
              savedIds={savedIds}
              onSave={onSave}
              onOpen={onOpen}
            />
          )}

          {activeCampus && nearCampus.length > 0 && (
            <ListingRail
              title={<>Stay near {activeCampus.short_name ?? activeCampus.name}</>}
              listings={nearCampus}
              savedIds={savedIds}
              onSave={onSave}
              onOpen={onOpen}
            />
          )}

          {trending.length > 0 && (
            <ListingRail
              title={<>Trending on LeaseUp</>}
              listings={trending}
              savedIds={savedIds}
              onSave={onSave}
              onOpen={onOpen}
            />
          )}

          {otherCampuses.map(({ campus, items }) => (
            <ListingRail
              key={campus.id}
              title={<>Popular in {campus.short_name ?? campus.name}</>}
              listings={items}
              savedIds={savedIds}
              onSave={onSave}
              onOpen={onOpen}
            />
          ))}

          {filtered.length === 0 && (
            <div className="mx-auto max-w-md px-6 py-16 text-center">
              <div className="text-6xl">🏠</div>
              <h2 className="mt-4 text-xl font-bold">No stays match your search</h2>
              <p className="mt-1 text-sm text-muted-foreground">Try clearing filters or exploring a different campus.</p>
              <button
                onClick={() => { setSearch(EMPTY_SEARCH); setCat("all"); }}
                className="mt-4 rounded-full bg-foreground px-5 py-2 text-sm font-bold text-background hover:opacity-90"
              >Clear filters</button>
            </div>
          )}
        </>
      )}

      {/* Footer */}
      <footer className="mx-auto mt-10 max-w-7xl border-t px-4 py-8 text-xs text-muted-foreground sm:px-6">
        <div className="flex flex-wrap items-center justify-between gap-4">
          <div>© {new Date().getFullYear()} LeaseUp — student subleases</div>
          <div className="flex flex-wrap gap-4">
            <Link to="/looking-for" className="hover:text-foreground">Looking For board</Link>
            <Link to="/market" className="hover:text-foreground">Market data</Link>
            <Link to="/lease-analysis" className="hover:text-foreground">Lease bot</Link>
            <Link to="/ambassador" className="hover:text-foreground">Ambassadors</Link>
          </div>
        </div>
      </footer>
    </div>
  );
}
