import { createFileRoute, useNavigate, Link } from "@tanstack/react-router";
import { useToggleSave } from "@/lib/leaseup/use-toggle-save";
import { pushRecentSearch } from "@/lib/leaseup/recent-searches";
import { useEffect, useMemo, useRef, useState } from "react";
import { useQuery, useQueryClient } from "@tanstack/react-query";
import { fetchListings, fetchSavedIds, getOrCreateConversation } from "@/lib/leaseup/queries";
import { useSession } from "@/lib/leaseup/use-session";
import { RenterFeedbackPrompt } from "@/components/leaseup/RenterFeedbackPrompt";
import { ListingCard } from "@/components/leaseup/ListingCard";
import { ListingCardSkeletonGrid } from "@/components/leaseup/ListingCardSkeleton";
import { ListingDetailSheet } from "@/components/leaseup/ListingDetailSheet";
import { PostListingDialog } from "@/components/leaseup/PostListingDialog";
import { ProfileSheet } from "@/components/leaseup/ProfileSheet";
import { MessagesSheet } from "@/components/leaseup/MessagesSheet";
import { ScrollView } from "@/components/leaseup/ScrollView";
import { CompareBar } from "@/components/leaseup/CompareBar";
import { CompareSheet } from "@/components/leaseup/CompareSheet";
import { BrowseFilterBar, type BrowseFilterValues } from "@/components/leaseup/BrowseFilterBar";


import type { Listing } from "@/lib/leaseup/types";
import { LayoutGrid, Bell, Map as MapIcon, Home, Search, List } from "lucide-react";
import { BrowseMapView } from "@/components/leaseup/BrowseMapView";
import { ListingListRow } from "@/components/leaseup/ListingListRow";
import { toast } from "sonner";
import { cn } from "@/lib/utils";
import { SaveSearchDialog } from "@/components/leaseup/SaveSearchDialog";
import { SaveSearchAlertPopover } from "@/components/leaseup/SaveSearchAlertPopover";

import { openSignIn } from "@/components/leaseup/SignInModal";
import { TrendingCarousel } from "@/components/leaseup/TrendingCarousel";
import { fetchTrendingIds } from "@/lib/leaseup/referral.queries";
import { useMyProfile } from "@/lib/leaseup/use-session";
import { fetchCampuses, fetchCampusBySlugOrAlias, fetchCampusesByIds, type Campus } from "@/lib/leaseup/campuses";
import { matchesRoommateFilters } from "@/lib/leaseup/roommate-prefs";

type Sort = "newest" | "price_asc" | "price_desc" | "popular" | "ending_soon";

const SORT_VALUES: Sort[] = ["newest", "price_asc", "price_desc", "popular", "ending_soon"];
const BED_VALUES = ["0", "1", "2", "3+"] as const;
type BedKey = (typeof BED_VALUES)[number];

/** Q161 — move-in quick filter values. */
const MOVEIN_VALUES = ["now", "30d", "summer", "fall"] as const;
type MoveIn = (typeof MOVEIN_VALUES)[number];

/** Matches a listing's available_from against a move-in quick filter. */
function matchesMoveIn(availableFrom: string | null | undefined, key: MoveIn): boolean {
  const now = new Date();
  const today = new Date(now.getFullYear(), now.getMonth(), now.getDate()).getTime();
  const from = availableFrom ? new Date(availableFrom) : null;
  const t = from && !Number.isNaN(from.getTime()) ? from.getTime() : null;

  if (key === "now") return t === null || t <= today;
  if (t === null) return false;
  if (key === "30d") return t <= today + 30 * 86400000;

  const y = now.getFullYear();
  const inWindow = (startMonth: number, endMonth: number, endDay: number) => {
    for (const year of [y, y + 1]) {
      const start = new Date(year, startMonth, 1).getTime();
      const end = new Date(year, endMonth, endDay, 23, 59, 59).getTime();
      if (t >= start && t <= end) return true;
    }
    return false;
  };
  if (key === "summer") return inWindow(4, 7, 31); // May 1 – Aug 31
  return inWindow(7, 11, 31); // Fall: Aug 1 – Dec 31
}


type BrowseSearch = {
  q?: string;
  campus?: string;
  area?: string;
  min_price?: number;
  max_price?: number;
  bedrooms?: string; // csv "1,2"
  baths?: number;
  from?: string; // ISO date yyyy-mm-dd
  to?: string;
  furnished?: 1;
  utilities?: 1;
  parking?: 1;
  pets?: 1;
  wifi?: 1;
  laundry?: 1;
  verified?: 1;
  sort?: Sort;
  /** Q159 — only listings posted in the last 7 days. */
  new?: true;
  /** Q161 — move-in quick filter. */
  movein?: MoveIn;
  view?: "grid" | "list" | "map";

  // Q96 — params emitted by hero/nav search + homepage category pills
  tenants?: number;
  type?: string;
  maxDuration?: number;
  availableSoon?: 1;
  postedToday?: 1;
  nearCampus?: 1;
  openFilters?: 1;
  hostId?: string;
  page?: number;
  // Q147 — roommate preference filters (csv of option ids)
  rm_looking?: string;
  rm_study?: string;
  rm_pets?: string;
  rm_smoking?: string;
};


function parseInt2(v: unknown): number | undefined {
  const n = Number(v);
  return Number.isFinite(n) && n > 0 ? Math.floor(n) : undefined;
}
function parseStr(v: unknown): string | undefined {
  return typeof v === "string" && v.trim() ? v.trim() : undefined;
}
function parseFlag(v: unknown): 1 | undefined {
  return v === 1 || v === "1" || v === true || v === "true" ? 1 : undefined;
}
function parseBeds(v: unknown): string | undefined {
  if (typeof v !== "string") return undefined;
  const parts = v.split(",").map((s) => s.trim()).filter((s) => (BED_VALUES as readonly string[]).includes(s));
  return parts.length ? parts.join(",") : undefined;
}
/** Q124 — shareable alias: ?bed=studio|1br|2br|3plus */
const BED_ALIASES: Record<string, string> = {
  studio: "0",
  "1br": "1",
  "2br": "2",
  "3plus": "3+",
};
function parseBedAlias(v: unknown): string | undefined {
  const t = parseStr(v)?.toLowerCase();
  return t ? BED_ALIASES[t] : undefined;
}
/** Q124 — shareable alias: ?price=under700|700-1000|1000-1500|1500plus */
const PRICE_ALIASES: Record<string, { min?: number; max?: number }> = {
  under700: { max: 700 },
  "700-1000": { min: 700, max: 1000 },
  "1000-1500": { min: 1000, max: 1500 },
  "1500plus": { min: 1500 },
};
function parsePriceAlias(v: unknown): { min?: number; max?: number } {
  const t = parseStr(v)?.toLowerCase();
  return (t && PRICE_ALIASES[t]) || {};
}
/** Accepts internal values plus the friendly aliases used by search links. */
function parseSort(v: unknown): Sort | undefined {
  if (typeof v !== "string") return undefined;
  if (v === "lowest" || v === "price-asc") return "price_asc";
  if (v === "highest" || v === "price-desc") return "price_desc";
  if (v === "trending") return "popular";
  if (v === "ending") return "ending_soon";
  return (SORT_VALUES as string[]).includes(v) ? (v as Sort) : undefined;
}
function parseType(v: unknown): string | undefined {
  const t = parseStr(v);
  return t && ["studio", "private_room", "entire", "shared"].includes(t) ? t : undefined;
}

export const Route = createFileRoute("/browse")({
  validateSearch: (raw: Record<string, unknown>): BrowseSearch => ({
    q: parseStr(raw.q),
    campus: parseStr(raw.campus),
    area: parseStr(raw.area),
    min_price: parseInt2(raw.min_price ?? raw.minPrice) ?? parsePriceAlias(raw.price).min,
    max_price: parseInt2(raw.max_price ?? raw.maxPrice) ?? parsePriceAlias(raw.price).max,
    bedrooms: parseBeds(raw.bedrooms) ?? parseBedAlias(raw.bed),
    baths: parseInt2(raw.baths),
    from: parseStr(raw.from ?? raw.availableFrom),
    to: parseStr(raw.to ?? raw.availableTo),
    furnished: parseFlag(raw.furnished),
    utilities: parseFlag(raw.utilities),
    parking: parseFlag(raw.parking),
    pets: parseFlag(raw.pets),
    wifi: parseFlag(raw.wifi),
    laundry: parseFlag(raw.laundry),
    verified: parseFlag(raw.verified),
    sort: parseSort(raw.sort),
    new: parseFlag(raw.new) ? true : undefined,
    movein: (MOVEIN_VALUES as readonly string[]).includes(String(raw.movein))
      ? (raw.movein as MoveIn)
      : undefined,

    view: raw.view === "map" ? "map" : raw.view === "list" ? "list" : undefined,
    tenants: parseInt2(raw.tenants ?? raw.people),
    type: parseType(raw.type),
    maxDuration: parseInt2(raw.maxDuration),
    availableSoon: parseFlag(raw.availableSoon),
    postedToday: parseFlag(raw.postedToday),
    nearCampus: parseFlag(raw.nearCampus),
    openFilters: parseFlag(raw.openFilters),
    hostId: parseStr(raw.hostId),
    page: parseInt2(raw.page),
    rm_looking: parseStr(raw.rm_looking),
    rm_study: parseStr(raw.rm_study),
    rm_pets: parseStr(raw.rm_pets),
    rm_smoking: parseStr(raw.rm_smoking),
  }),
  head: () => {
    const title = "Browse Subleases Near Campus | LeaseUp";
    const description =
      "Filter by campus, price, size, and dates. Find your next sublease in seconds.";
    return {
      meta: [
        { title },
        { name: "description", content: description },
        { property: "og:title", content: title },
        { property: "og:description", content: description },
        { property: "og:type", content: "website" },
        { property: "og:url", content: "https://leasup.co/browse" },
        { name: "twitter:card", content: "summary_large_image" },
        { name: "twitter:title", content: title },
        { name: "twitter:description", content: description },
      ],
      links: [{ rel: "canonical", href: "https://leasup.co/browse" }],
    };
  },

  component: Browse,
});

type View = "grid" | "scroll";

function Browse() {
  const navigate = useNavigate();
  const { user, loading: sessionLoading } = useSession();
  const qc = useQueryClient();

  // Q78: Toast + strip the "?notice=" flag left by the /lease-analysis 301.
  useEffect(() => {
    if (typeof window === "undefined") return;
    const url = new URL(window.location.href);
    if (url.searchParams.get("notice") === "lease-analysis-gone") {
      toast.message("Lease analysis isn't available yet — browse listings instead.");
      url.searchParams.delete("notice");
      window.history.replaceState({}, "", url.pathname + url.search);
    }
  }, []);

  /**
   * Q180 — dates must never be remembered across sessions: they go stale as soon
   * as the calendar moves past them. Strip from/to out of any saved filter blob
   * so returning users aren't stuck with a range they set weeks ago.
   */
  useEffect(() => {
    if (typeof window === "undefined") return;
    try {
      const raw = window.localStorage.getItem("leasup_browse_filters");
      if (!raw) return;
      const saved = JSON.parse(raw);
      if (saved && typeof saved === "object" && ("from" in saved || "to" in saved)) {
        delete saved.from; delete saved.to;
        window.localStorage.setItem("leasup_browse_filters", JSON.stringify(saved));
      }
    } catch { /* ignore */ }
  }, []);


  const { data: listings = [], isLoading, isError } = useQuery({
    queryKey: ["listings"],
    queryFn: fetchListings,
  });
  const { data: savedIds = new Set<string>() } = useQuery({
    queryKey: ["saved", user?.id],
    queryFn: () => fetchSavedIds(user!.id),
    enabled: !!user?.id,
  });
  const { data: profile } = useMyProfile();
  const { data: campusesWithListings = [] } = useQuery({ queryKey: ["campuses"], queryFn: fetchCampuses, staleTime: Infinity });
  // Q179 — a searched campus (or the visitor's own school) may have no live
  // listings yet, so it won't be in the inventory list. Resolve it separately
  // and merge, otherwise the filter silently falls back to "all campuses".
  const slugParam = (Route.useSearch() as BrowseSearch).campus ?? null;
  const { data: slugCampus = null } = useQuery({
    queryKey: ["campus-resolve", slugParam],
    queryFn: () => fetchCampusBySlugOrAlias(slugParam!),
    enabled: !!slugParam && !campusesWithListings.some((c) => c.slug === slugParam || c.id === slugParam),
    staleTime: Infinity,
  });
  const { data: myCampusRows = [] } = useQuery({
    queryKey: ["campus-by-id", profile?.campus_id],
    queryFn: () => fetchCampusesByIds([profile!.campus_id!]),
    enabled: !!profile?.campus_id && !campusesWithListings.some((c) => c.id === profile?.campus_id),
    staleTime: Infinity,
  });
  const campuses = useMemo(() => {
    const seen = new Map<string, Campus>();
    for (const c of [...campusesWithListings, ...myCampusRows, ...(slugCampus ? [slugCampus] : [])]) seen.set(c.id, c);
    return [...seen.values()];
  }, [campusesWithListings, myCampusRows, slugCampus]);
  const myCampus = campuses.find(c => c.id === profile?.campus_id);

  // URL-driven filters — shareable, back/forward safe, refresh-safe.
  const s = Route.useSearch();
  const sort: Sort = s.sort ?? "newest";
  const maxPrice = s.max_price ?? undefined;
  const minPrice = s.min_price ?? undefined;
  const area = s.area ?? "";
  const furnishedOnly = s.furnished === 1;
  const bedSet = useMemo(
    () => new Set<BedKey>(((s.bedrooms ?? "").split(",").filter(Boolean) as BedKey[])),
    [s.bedrooms],
  );
  const fromDate = s.from ? new Date(s.from) : null;
  const toDate = s.to ? new Date(s.to) : null;
  const campusSlug = s.campus ?? null;
  // Accepts either a campus slug (shareable links) or a raw campus id (search bar).
  const campusId = campusSlug
    ? campuses.find((c) => c.slug === campusSlug)?.id ?? (campuses.some((c) => c.id === campusSlug) ? campusSlug : null)
    : null;

  // Debounced text search — local state, flushes to URL after 300ms.
  const [searchInput, setSearchInput] = useState(s.q ?? "");
  useEffect(() => { setSearchInput(s.q ?? ""); }, [s.q]);
  useEffect(() => {
    const t = setTimeout(() => {
      if ((searchInput || "") === (s.q ?? "")) return;
      navigate({
        to: "/browse",
        search: (prev: BrowseSearch) => ({ ...prev, q: searchInput.trim() || undefined, page: undefined }),
        replace: true,
      });
    }, 300);
    return () => clearTimeout(t);
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [searchInput]);

  function patchSearch(patch: Partial<BrowseSearch>) {
    navigate({
      to: "/browse",
      search: (prev: BrowseSearch) => ({ ...prev, ...patch, page: "page" in patch ? patch.page : undefined }),
    });
  }

  /** Q164 — remember the last few searches so the search bar can re-run them. */
  useEffect(() => {
    const campusName = campusId ? campuses.find((c) => c.id === campusId)?.short_name
      ?? campuses.find((c) => c.id === campusId)?.name ?? null : null;
    const bedsLabel = (s.bedrooms ?? "")
      .split(",")
      .filter(Boolean)
      .map((b: string) => (b === "0" ? "Studio" : `${b} bed`))
      .join(", ");
    const parts = [
      bedsLabel || null,
      s.q ? `"${s.q}"` : null,
      campusName ? `in ${campusName}` : null,
      s.max_price ? `$${s.max_price}/mo` : null,
    ].filter(Boolean) as string[];
    if (parts.length === 0) return;
    pushRecentSearch({
      campus: s.campus,
      bedrooms: s.bedrooms,
      maxPrice: s.max_price,
      query: s.q,
      movein: s.movein,
      label: parts.join(" · ").slice(0, 80),
    });
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [s.q, s.campus, s.bedrooms, s.max_price, s.movein, campusId, campuses.length]);


  const [view] = useState<View>("grid");
  const mapView = s.view === "map";

  /** Q177 — the campus the visitor actually searched for (not their profile). */
  const searchedCampus = campusId ? campuses.find((c) => c.id === campusId) ?? null : null;

  /**
   * Q183 — Trending follows the campus being VIEWED, never the viewer's own
   * profile campus. Both the ids and the heading derive from `campusId`.
   */
  const { data: trendingIds = [] } = useQuery({
    queryKey: ["trending-ids", campusId ?? "all"],
    queryFn: () => fetchTrendingIds(campusId ?? null, 5),
    staleTime: 5 * 60 * 1000,
  });
  const trendingListings = useMemo(
    () =>
      trendingIds
        .map((id) => listings.find((l) => l.id === id))
        .filter((l): l is Listing => !!l && (!campusId || l.campus_id === campusId)),
    [trendingIds, listings, campusId],
  );

  /** Q177 — pins fall back to their own campus, not one hardcoded city. */
  const campusCoords = useMemo(() => {
    const out: Record<string, [number, number]> = {};
    for (const c of campuses) {
      if (c.lat != null && c.lng != null) out[c.id] = [c.lat, c.lng];
    }
    return out;
  }, [campuses]);
  const listView = s.view === "list";

  /** Q160 — remember the last chosen browse layout. */
  useEffect(() => {
    if (typeof window === "undefined") return;
    if (s.view) {
      try { window.localStorage.setItem("leasup_browse_view", s.view); } catch { /* ignore */ }
      return;
    }
    let stored: string | null = null;
    try { stored = window.localStorage.getItem("leasup_browse_view"); } catch { /* ignore */ }
    if (stored === "list" || stored === "map") patchSearch({ view: stored });
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [s.view]);

  const [selected, setSelected] = useState<Listing | null>(null);
  const [posting, setPosting] = useState(false);
  const [profileViewId, setProfileViewId] = useState<string | null>(null);
  const [messagesOpen, setMessagesOpen] = useState(false);
  const [activeConv, setActiveConv] = useState<string | null>(null);
  const [msgDraft, setMsgDraft] = useState<string | null>(null);
  const [pinned, setPinned] = useState<string[]>([]);
  const [compareOpen, setCompareOpen] = useState(false);
  const [saveSearchOpen, setSaveSearchOpen] = useState(false);

  const pinnedSet = useMemo(() => new Set(pinned), [pinned]);
  const pinnedListings = useMemo(
    () => pinned.map(id => listings.find(l => l.id === id)).filter(Boolean) as Listing[],
    [pinned, listings],
  );

  function togglePin(l: Listing) {
    setPinned((prev) => {
      if (prev.includes(l.id)) return prev.filter((id) => id !== l.id);
      if (prev.length >= 3) { toast("Compare up to 3 listings at a time"); return prev; }
      return [...prev, l.id];
    });
  }

  // Hot-deal computation: 15%+ below campus average for same bed count
  const hotIds = useMemo(() => {
    const groups = new Map<string, number[]>();
    for (const l of listings) {
      const key = `${l.campus_id ?? ""}|${l.beds}`;
      const arr = groups.get(key) ?? [];
      arr.push(l.price); groups.set(key, arr);
    }
    const avg = new Map<string, number>();
    for (const [k, v] of groups) avg.set(k, v.reduce((a, b) => a + b, 0) / v.length);
    const ids = new Set<string>();
    for (const l of listings) {
      const a = avg.get(`${l.campus_id ?? ""}|${l.beds}`);
      if (a && l.price <= a * 0.85) ids.add(l.id);
    }
    return ids;
  }, [listings]);

  function matchesBeds(l: Listing): boolean {
    if (bedSet.size === 0) return true;
    const b = l.beds ?? 0;
    if (bedSet.has("3+") && b >= 3) return true;
    return bedSet.has(String(b) as BedKey);
  }

  const rmFilters = useMemo(() => {
    const csv = (v?: string) => {
      const parts = (v ?? "").split(",").map((x) => x.trim()).filter(Boolean);
      return parts.length ? parts : undefined;
    };
    return {
      looking_for: csv(s.rm_looking),
      study_style: csv(s.rm_study),
      pets: csv(s.rm_pets),
      smoking: csv(s.rm_smoking),
    };
  }, [s.rm_looking, s.rm_study, s.rm_pets, s.rm_smoking]);

  const filtered = useMemo(() => {
    const qLower = (s.q ?? "").toLowerCase();
    let r = listings.filter((l) => {
      if (qLower && !(
        l.title.toLowerCase().includes(qLower) ||
        (l.area ?? "").toLowerCase().includes(qLower) ||
        (l.description ?? "").toLowerCase().includes(qLower)
      )) return false;
      if (s.hostId && l.user_id !== s.hostId) return false;
      if (campusId && l.campus_id !== campusId) return false;
      if (area && l.area !== area) return false;
      if (furnishedOnly && !l.furnished) return false;
      if (s.utilities === 1 && !l.utilities_included) return false;
      if (s.parking === 1 && !l.parking) return false;
      if (s.pets === 1 && !l.pet_friendly) return false;
      if (s.wifi === 1 && !(l as any).wifi_included) return false;
      if (s.laundry === 1 && !(l as any).laundry) return false;
      if (s.verified === 1 && !l.profile?.verified_email) return false;
      if (s.baths != null && (l.baths ?? 0) < s.baths) return false;
      if (minPrice != null && (l.price ?? 0) < minPrice) return false;
      if (maxPrice != null && (l.price ?? 0) > maxPrice) return false;
      if (!matchesBeds(l)) return false;
      // Q180 — OVERLAP, not containment: a listing matches when its availability
      // overlaps the requested window at all.
      if (toDate && l.available_from && new Date(l.available_from) > toDate) return false;
      if (fromDate && l.available_to && new Date(l.available_to) < fromDate) return false;

      // Q96 — search-bar / category-pill params
      if (s.tenants != null && (l.beds ?? 0) < Math.ceil(s.tenants / 2)) return false;
      if (s.type === "studio" && (l.beds ?? 0) !== 0) return false;
      if (s.type === "private_room" && (l.beds ?? 0) !== 1) return false;
      if (s.type === "entire" && (l.beds ?? 0) < 1) return false;
      if (s.maxDuration != null) {
        if (!l.available_from || !l.available_to) return false;
        const days = (new Date(l.available_to).getTime() - new Date(l.available_from).getTime()) / 86400000;
        if (!(days > 0 && days <= s.maxDuration)) return false;
      }
      if (s.availableSoon === 1) {
        if (!l.available_from) return false;
        if (new Date(l.available_from).getTime() > Date.now() + 31 * 86400000) return false;
      }
      if (s.new === true && Date.now() - new Date(l.created_at).getTime() > 7 * 86400000) return false;
      if (s.movein && !matchesMoveIn(l.available_from, s.movein)) return false;

      if (s.postedToday === 1 && Date.now() - new Date(l.created_at).getTime() > 86400000) return false;
      if (s.nearCampus === 1 && !/campus|near|walk/i.test(l.area ?? "")) return false;
      if (!matchesRoommateFilters((l as any).roommate_prefs, rmFilters)) return false;

      return true;
    });
    if (sort === "price_asc") r = [...r].sort((a, b) => a.price - b.price);
    else if (sort === "price_desc") r = [...r].sort((a, b) => b.price - a.price);
    else if (sort === "popular") r = [...r].sort((a, b) => (b.view_count ?? 0) - (a.view_count ?? 0));
    // Q155 — soonest-expiring first; listings without an end date sink to the bottom.
    else if (sort === "ending_soon")
      r = [...r].sort((a, b) => {
        const ta = a.available_to ? new Date(a.available_to).getTime() : Infinity;
        const tb = b.available_to ? new Date(b.available_to).getTime() : Infinity;
        if (ta === tb) return 0;
        return ta - tb;
      });
    else r = [...r].sort((a, b) => new Date((b as any).bumped_at ?? b.created_at).getTime() - new Date((a as any).bumped_at ?? a.created_at).getTime());
    return r;
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [listings, s.q, campusId, area, furnishedOnly, minPrice, maxPrice, bedSet, s.from, s.to, sort,
      s.utilities, s.parking, s.pets, s.wifi, s.laundry, s.baths, s.verified,
      s.tenants, s.type, s.maxDuration, s.availableSoon, s.postedToday, s.nearCampus, s.new, s.movein, rmFilters]);

  /** Q180 — how many live listings the selected campus has before any filters. */
  const campusTotal = useMemo(
    () => (campusId ? listings.filter((l) => l.campus_id === campusId).length : listings.length),
    [listings, campusId],
  );
  const campusLabel = searchedCampus?.name ?? searchedCampus?.short_name ?? "this campus";

  const activeFilterCount =
    (s.q ? 1 : 0) +
    (campusSlug ? 1 : 0) +
    (area ? 1 : 0) +
    (minPrice != null ? 1 : 0) +

    (maxPrice != null ? 1 : 0) +
    (bedSet.size > 0 ? 1 : 0) +
    (s.from ? 1 : 0) +
    (s.to ? 1 : 0) +
    (furnishedOnly ? 1 : 0) +
    (s.verified === 1 ? 1 : 0);

  /**
   * Q150 — normalized snapshot of the filters that matter for an email alert
   * (campus, price, keyword, beds and roommate prefs). Used for dedupe + storage.
   */
  const alertFilters = useMemo(() => {
    const f: Record<string, string | number | boolean> = {};
    if (s.q) f.q = s.q;
    if (campusId) f.campus = campusId;
    if (area) f.area = area;
    if (minPrice != null) f.min_price = minPrice;
    if (maxPrice != null) f.max_price = maxPrice;
    if (bedSet.size) f.bedrooms = [...bedSet].sort().join(",");
    if (furnishedOnly) f.furnished = true;
    if (s.verified === 1) f.verified = true;
    for (const k of ["rm_looking", "rm_study", "rm_pets", "rm_smoking"] as const) {
      const v = s[k];
      if (v) f[k] = v;
    }
    return f;
  }, [s.q, campusId, area, minPrice, maxPrice, bedSet, furnishedOnly, s.verified,
      s.rm_looking, s.rm_study, s.rm_pets, s.rm_smoking]);

  const canSaveAlert = Object.keys(alertFilters).length > 0;
  const alertLabel = [
    campusId ? campuses.find((c) => c.id === campusId)?.short_name ?? "This campus" : null,
    maxPrice != null ? `under $${maxPrice}/mo` : null,
    s.q ? `"${s.q}"` : null,
  ].filter(Boolean).join(" · ") || undefined;


  function clearFilters() {
    navigate({ to: "/browse", search: {} });
    setSearchInput("");
  }

  // Q106 Part A — pagination (12 per page), URL-synced via ?page=
  const PAGE_SIZE = 12;
  const gridTopRef = useRef<HTMLDivElement>(null);
  const totalPages = Math.max(1, Math.ceil(filtered.length / PAGE_SIZE));
  const page = Math.min(Math.max(s.page ?? 1, 1), totalPages);
  const paged = useMemo(
    () => filtered.slice((page - 1) * PAGE_SIZE, page * PAGE_SIZE),
    [filtered, page],
  );
  function goToPage(next: number) {
    const target = Math.min(Math.max(next, 1), totalPages);
    if (target === page) return;
    navigate({
      to: "/browse",
      search: (prev: BrowseSearch) => ({ ...prev, page: target === 1 ? undefined : target }),
    });
    requestAnimationFrame(() => {
      gridTopRef.current?.scrollIntoView({ behavior: "smooth", block: "start" });
    });
  }


  const toggleSave = useToggleSave(user?.id);

  function handleSave(listing: Listing) {
    if (!user) { openSignIn("/browse"); return; }
    void toggleSave(listing.id);
  }

  async function handleMessage(listing: Listing) {
    if (!user) {
      navigate({ to: "/auth", search: { mode: "in", next: `/?listing=${listing.id}&message=1` } });
      return;
    }
    if (listing.user_id === user.id) { toast("That's your own listing"); return; }
    const id = await getOrCreateConversation(user.id, listing.user_id, listing.id);
    setMsgDraft(`Hi! I'm interested in ${listing.title}. Is it still available?`);
    setActiveConv(id);
    setMessagesOpen(true);
    setSelected(null);
  }

  async function startConvWith(otherId: string) {
    if (!user) return;
    const id = await getOrCreateConversation(user.id, otherId, null);
    setActiveConv(id);
    setMessagesOpen(true);
    setProfileViewId(null);
  }

  function handlePost() {
    if (!user) { navigate({ to: "/auth", search: { mode: "up", next: "/?post=1" } }); return; }
    setPosting(true);
  }

  if (sessionLoading) {
    return <div className="min-h-screen bg-background" />;
  }

  return (
    <div className="min-h-[100dvh] bg-background pb-24">
      <div>
        {/* Q108 — page heading reflects the active campus filter */}
        <div className="mx-auto flex max-w-7xl flex-wrap items-center gap-3 px-4 pt-5">
          <h1 className="text-2xl font-bold tracking-tight text-foreground">
            {campusId
              ? `Subleases near ${campuses.find((c) => c.id === campusId)?.name ?? "your campus"}`
              : "Browse subleases"}
          </h1>
          <Link
            to="/looking"
            className="ml-auto text-sm font-semibold text-primary hover:underline"
          >
            Looking for a place instead? →
          </Link>
        </div>

        {/* One search + filter bar. Campus, dates, price and extras all live here. */}
        <BrowseFilterBar
          values={s as BrowseFilterValues}
          onPatch={(patch) => patchSearch(patch as Partial<BrowseSearch>)}
          onClearAll={clearFilters}
          searchInput={searchInput}
          onSearchInput={setSearchInput}
          resultCount={filtered.length}
          placeLabel={myCampus ? `${myCampus.city}, ${myCampus.state}` : "Search subleases"}
          initialFiltersOpen={s.openFilters === 1}
          selectedCampus={searchedCampus}
          onCampusSelect={(campus) => {
            if ((campus.listing_count ?? 0) === 0) {
              navigate({ to: "/campus/$slug", params: { slug: campus.slug } });
              return;
            }
            // Q180 — a new school is a new search: never carry stale dates over.
            patchSearch({ campus: campus.slug, from: undefined, to: undefined, page: undefined });
          }}
          onCampusClear={() => patchSearch({ campus: undefined, from: undefined, to: undefined, page: undefined })}
        />




        <div className="mx-auto flex max-w-7xl items-center gap-2 px-4 pt-3">

          {/* Q90/Q160 — grid / list / map toggle */}
          <div className="ml-auto flex items-center gap-1">
            <button
              onClick={() => patchSearch({ view: "grid" })}
              className={cn(
                "inline-flex items-center gap-1 rounded-full px-3 py-1.5 text-xs font-semibold transition",
                mapView || listView ? "border border-border bg-surface text-muted-foreground" : "bg-foreground text-background",
              )}
            >
              <LayoutGrid className="h-3.5 w-3.5" />Grid
            </button>
            <button
              onClick={() => patchSearch({ view: "list" })}
              className={cn(
                "inline-flex items-center gap-1 rounded-full px-3 py-1.5 text-xs font-semibold transition",
                listView ? "bg-foreground text-background" : "border border-border bg-surface text-muted-foreground",
              )}
            >
              <List className="h-3.5 w-3.5" />List
            </button>
            <button
              onClick={() => patchSearch({ view: "map" })}
              className={cn(
                "inline-flex items-center gap-1 rounded-full px-3 py-1.5 text-xs font-semibold transition",
                mapView ? "bg-foreground text-background" : "border border-border bg-surface text-muted-foreground",
              )}
            >
              <MapIcon className="h-3.5 w-3.5" />Map
            </button>
          </div>
          {/* Q150 — email alert for the current filter set */}
          {canSaveAlert ? (
            <SaveSearchAlertPopover filters={alertFilters} campusId={campusId} label={alertLabel} />
          ) : (
            <button
              onClick={() => setSaveSearchOpen(true)}
              className="inline-flex items-center gap-1 rounded-full bg-primary px-3 py-1.5 text-xs font-bold text-primary-foreground hover:bg-primary-dark"
            >
              <Bell className="h-3.5 w-3.5" />Save search
            </button>
          )}

        </div>

        {mapView ? (
          <div className="mt-3">
            <BrowseMapView
              listings={filtered}
              center={searchedCampus ? campusCoords[searchedCampus.id] ?? null : null}
              centerLabel={searchedCampus ? (searchedCampus.short_name ?? searchedCampus.name) : undefined}
              campusCoords={campusCoords}
            />
          </div>
        ) : (

        <main className="mx-auto max-w-7xl px-4 py-5">

          {user && <RenterFeedbackPrompt userId={user.id} />}
          {view === "grid" && (
            <TrendingCarousel
              listings={trendingListings}
              campusName={searchedCampus ? (searchedCampus.short_name ?? searchedCampus.name) : null}
              onOpen={setSelected}
            />
          )}
          {view === "scroll" ? (
            <ScrollView
              listings={filtered}
              savedIds={savedIds}
              onSave={handleSave}
              onMessage={handleMessage}
              onOpen={setSelected}
              pinnedIds={pinnedSet}
              onPin={togglePin}
            />
          ) : isError ? (
            <p className="py-16 text-center text-sm text-gray-500 dark:text-muted-foreground">
              Something went wrong loading listings. Try refreshing.
            </p>
          ) : isLoading ? (
            <ListingCardSkeletonGrid count={12} />
          ) : filtered.length === 0 ? (
            <div className="flex flex-col items-center justify-center px-6 py-20 text-center">
              <div className="relative rounded-full bg-muted p-5">
                <Home className="h-9 w-9 text-muted-foreground" />
                <span className="absolute -bottom-1 -right-1 rounded-full bg-surface p-1.5 shadow-sm">
                  <Search className="h-4 w-4 text-muted-foreground" />
                </span>
              </div>
              {campusTotal > 0 ? (
                <>
                  {/* Q180 — hidden-by-filters recovery, never a dead end. */}
                  <h3 className="mt-5 max-w-lg text-xl font-semibold">
                    {campusTotal} sublease{campusTotal === 1 ? "" : "s"} at {campusLabel} {campusTotal === 1 ? "is" : "are"} hidden by your filters
                  </h3>
                  <ul className="mt-2 space-y-0.5 text-sm text-muted-foreground">
                    {(s.from || s.to) && (
                      <li>Dates: {[s.from, s.to].filter(Boolean).join(" – ")}</li>
                    )}
                    {(minPrice != null || maxPrice != null) && (
                      <li>Price: {minPrice != null ? `$${minPrice}` : "$0"}–{maxPrice != null ? `$${maxPrice}` : "any"}/mo</li>
                    )}
                    {bedSet.size > 0 && <li>Beds: {[...bedSet].join(", ")}</li>}
                    {s.q && <li>Keyword: “{s.q}”</li>}
                  </ul>
                  {(s.from || s.to) && (
                    <button
                      onClick={() => patchSearch({ from: undefined, to: undefined })}
                      className="mt-6 rounded-full bg-primary px-6 py-2.5 text-sm font-bold text-primary-foreground transition hover:bg-primary-dark"
                    >
                      Clear dates and show all {campusTotal}
                    </button>
                  )}
                  <button
                    onClick={clearFilters}
                    className="mt-3 text-sm font-semibold text-muted-foreground underline underline-offset-2 hover:text-foreground"
                  >
                    Clear all filters
                  </button>
                </>
              ) : (
                <>
                  <h3 className="mt-5 text-xl font-semibold">No subleases match your filters</h3>
                  <p className="mt-2 text-sm text-muted-foreground">
                    Try adjusting your dates, size, or price range
                  </p>
                  <button
                    onClick={clearFilters}
                    className="mt-6 rounded-full bg-gray-900 px-6 py-2.5 text-sm font-semibold text-white transition hover:opacity-90 dark:bg-white dark:text-gray-900"
                  >
                    Clear all filters
                  </button>
                </>
              )}
            </div>


          ) : (
            <>
            {listView ? (
              <div ref={gridTopRef} className="scroll-mt-32">
                {paged.map((l) => (
                  <ListingListRow
                    key={l.id}
                    listing={l}
                    campusName={campuses.find((c) => c.id === l.campus_id)?.short_name}
                    saved={savedIds.has(l.id)}
                    onSave={() => handleSave(l)}
                    onOpen={() => setSelected(l)}
                  />
                ))}
              </div>
            ) : (
            <div ref={gridTopRef} className="grid scroll-mt-32 grid-cols-1 gap-5 sm:grid-cols-2 md:grid-cols-3 md:gap-5 lg:grid-cols-4 lg:gap-6">
              {paged.map((l) => (
                <ListingCard
                  key={l.id}
                  listing={l}
                  saved={savedIds.has(l.id)}
                  onSave={() => handleSave(l)}
                  onOpen={() => setSelected(l)}
                  onMessage={() => handleMessage(l)}
                  pinned={pinnedSet.has(l.id)}

                  onPin={() => togglePin(l)}
                  isHotDeal={hotIds.has(l.id)}
                />
              ))}
            </div>
            )}
            {totalPages > 1 && (
              <nav className="mt-10 flex items-center justify-center" aria-label="Pagination">
                <button
                  onClick={() => goToPage(page - 1)}
                  disabled={page <= 1}
                  className="rounded-lg border border-gray-200 px-4 py-2 text-sm font-medium transition hover:bg-gray-50 disabled:cursor-not-allowed disabled:text-gray-300 disabled:hover:bg-transparent dark:border-border dark:hover:bg-white/5"
                >
                  ← Previous
                </button>
                <span className="mx-4 text-sm text-gray-500">Page {page} of {totalPages}</span>
                <button
                  onClick={() => goToPage(page + 1)}
                  disabled={page >= totalPages}
                  className="rounded-lg border border-gray-200 px-4 py-2 text-sm font-medium transition hover:bg-gray-50 disabled:cursor-not-allowed disabled:text-gray-300 disabled:hover:bg-transparent dark:border-border dark:hover:bg-white/5"
                >
                  Next →
                </button>
              </nav>
            )}
            </>
          )}
        </main>
        )}

      </div>


      <ListingDetailSheet
        listing={selected}
        open={!!selected}
        onOpenChange={(o) => !o && setSelected(null)}
        onMessage={handleMessage}
        onViewProfile={(id) => { setSelected(null); setProfileViewId(id); }}
        onSave={handleSave}
        isSaved={selected ? savedIds.has(selected.id) : false}
      />
      <PostListingDialog open={posting} onOpenChange={setPosting} />
      <ProfileSheet
        userId={profileViewId}
        open={!!profileViewId}
        onOpenChange={(o) => !o && setProfileViewId(null)}
        onMessage={startConvWith}
      />
      <MessagesSheet
        open={messagesOpen}
        onOpenChange={(o) => { setMessagesOpen(o); if (!o) setMsgDraft(null); }}
        initialConversationId={activeConv}
        initialDraft={msgDraft}
      />

      <SaveSearchDialog
        open={saveSearchOpen}
        onOpenChange={setSaveSearchOpen}
        filters={{ area, maxPrice: maxPrice ?? 2500, furnishedOnly, keyword: s.q ?? "" }}
      />

      <CompareBar
        listings={pinnedListings}
        onOpen={() => setCompareOpen(true)}
        onClear={() => setPinned([])}
        onRemove={(id) => setPinned((prev) => prev.filter((p) => p !== id))}
      />
      <CompareSheet
        listings={pinnedListings}
        open={compareOpen}
        onOpenChange={setCompareOpen}
        onOpenListing={setSelected}
        onMessage={handleMessage}
        onRemove={(id) => setPinned((prev) => prev.filter((p) => p !== id))}
      />
    </div>
  );
}
