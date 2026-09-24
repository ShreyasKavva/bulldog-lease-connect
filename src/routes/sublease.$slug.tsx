import { createFileRoute, Link, useNavigate, notFound, redirect } from "@tanstack/react-router";
import { useToggleSave } from "@/lib/leaseup/use-toggle-save";
import { useQuery, useQueryClient } from "@tanstack/react-query";
import { useEffect, useMemo, useState, type CSSProperties } from "react";

import { fetchCampusBySlug, fetchCampuses, fetchActiveListingCountsByCampus, fetchCampusStats, CAMPUS_ALIASES, type Campus } from "@/lib/leaseup/campuses";
import { fetchListings, fetchSavedIds, getOrCreateConversation, fetchLookingFor } from "@/lib/leaseup/queries";
import { useSession } from "@/lib/leaseup/use-session";
import { ListingCard } from "@/components/leaseup/ListingCard";
import { ListingCardSkeletonGrid } from "@/components/leaseup/ListingCardSkeleton";
import { ListingDetailSheet } from "@/components/leaseup/ListingDetailSheet";
import { MessagesSheet } from "@/components/leaseup/MessagesSheet";
import { ProfileSheet } from "@/components/leaseup/ProfileSheet";
import { PostListingDialog } from "@/components/leaseup/PostListingDialog";
import type { Listing } from "@/lib/leaseup/types";
import { CampusMark } from "@/components/leaseup/CampusMark";
import { campusShortName, campusFullName } from "@/lib/leaseup/campus-name";
import { MapPin, Sparkles, Plus, MessageCircle, Search, Handshake, CheckCircle2 } from "lucide-react";
import { cn } from "@/lib/utils";
import { toast } from "sonner";
import { friendlyError } from "@/lib/leaseup/friendly-error";
import { copyToClipboard, shareToGroupMe, withUtm } from "@/lib/leaseup/share";
import { posterName, posterFirstName, profileDisplayName } from "@/lib/leaseup/display-name";
import { UserAvatar } from "@/components/leaseup/UserAvatar";


export const Route = createFileRoute("/sublease/$slug")({
  loader: async ({ params, context }) => {
    const [campus, allCampuses, listingCounts] = await Promise.all([
      fetchCampusBySlug(params.slug),
      fetchCampuses(),
      fetchActiveListingCountsByCampus(),
      // Same seed the homepage (/ Q384) and /browse loaders use: the listing
      // grid below runs useQuery(["listings"], fetchListings), so seeding that
      // exact key here makes the campus grid server-render instead of starting
      // empty on the client.
      context.queryClient.ensureQueryData({ queryKey: ["listings"], queryFn: fetchListings }),
    ]);
    if (!campus) {
      // Short campus slugs ("uga", "gt", "osu") 301 to the canonical slug
      // instead of dead-ending on the not-found state.
      const key = params.slug.toLowerCase();
      const canonical = Object.entries(CAMPUS_ALIASES).find(
        ([, aliases]) => aliases.includes(key) || aliases.includes(key.replace(/-/g, " ")),
      )?.[0];
      if (canonical && canonical !== params.slug && (await fetchCampusBySlug(canonical))) {
        throw redirect({ to: "/sublease/$slug", params: { slug: canonical }, statusCode: 301 });
      }
      throw notFound();
    }
    const stats = await fetchCampusStats(campus.id);
    return { campus, allCampuses, listingCounts, stats };
  },
  head: ({ params, loaderData }) => {
    const c = loaderData?.campus;
    // The loader throws notFound() for an unknown slug, so an absent campus
    // means this page renders "Campus not found" — never build a title out of
    // the raw URL slug in that case.
    if (!c) {
      return {
        meta: [
          { title: "Campus not found — LeaseUp" },
          { name: "description", content: "We're not live on this campus yet. Browse student subleases near other campuses on LeaseUp." },
          { name: "robots", content: "noindex" },
          { property: "og:title", content: "Campus not found — LeaseUp" },
          { property: "og:description", content: "We're not live on this campus yet. Browse student subleases on LeaseUp." },
          { property: "og:type", content: "website" },
        ],
      };
    }
    const name = campusShortName(c);
    const fullName = campusFullName(c);
    const n = loaderData?.stats?.active ?? 0;
    const cityStr = c?.city ? `${c.city}, ${c.state}` : "";
    const title = name.endsWith("…") ? `${fullName} Subleases | LeaseUp` : `${name} Subleases — Find Sublets Near ${fullName} | LeaseUp`;
    const desc = n > 0
      ? `Browse ${n} sublease${n === 1 ? "" : "s"} posted by ${fullName} students who signed up with a campus email${cityStr ? `, in ${cityStr}` : ""}. Find furnished rooms, apartments, and houses near ${fullName} campus.`
      : `Student subleases at ${fullName}${cityStr ? ` in ${cityStr}` : ""}. Post your sublease and connect with other ${fullName} students.`;
    return {
      meta: [
        { title },
        { name: "description", content: desc },
        // Q269: zero-listing campus pages are thin content — keep them out of
        // the index until they gain a listing (derived live from the count).
        ...(n > 0 ? [] : [{ name: "robots", content: "noindex,follow" }]),
        { property: "og:title", content: title },
        { property: "og:description", content: desc },
        { property: "og:url", content: `https://leasup.co/sublease/${params.slug}` },
        { property: "og:type", content: "website" },
      ],
      links: [{ rel: "canonical", href: `https://leasup.co/sublease/${params.slug}` }],
      scripts: [{
        type: "application/ld+json",
        children: JSON.stringify({
          "@context": "https://schema.org",
          "@type": "WebPage",
          name: title,
          description: desc,
          about: { "@type": "CollegeOrUniversity", name: fullName },
        }),
      }],
    };
  },
  notFoundComponent: () => (
    <div className="min-h-screen grid place-items-center bg-background p-4 text-center">
      <div>
        <h1 className="text-2xl font-black">Campus not found</h1>
        <p className="mt-2 text-sm text-muted-foreground">We're not live on this campus yet.</p>
        <Link to="/" className="mt-4 inline-block rounded-md bg-primary px-4 py-2 text-sm font-bold text-primary-foreground">
          Back home
        </Link>
      </div>
    </div>
  ),
  errorComponent: ({ error }) => (
    <div className="min-h-screen grid place-items-center bg-background p-4 text-center text-sm text-muted-foreground">
      Something went wrong. {error.message}
    </div>
  ),
  component: CampusPage,
});

type BedFilter = "any" | "0" | "1" | "2" | "3+";
type PriceFilter = "any" | "under700" | "under1000";

// Q369 — per-campus accent colour ONLY. Colour values, never a logo, crest,
// wordmark or mascot. `fg` is picked per accent for >= 4.5:1 contrast:
// #B3A369 (gold) needs near-black; #8C1D40 (maroon) takes white.
const CAMPUS_ACCENTS: Record<string, { accent: string; fg: string; dark: string }> = {
  "georgia-tech": { accent: "#B3A369", fg: "#111827", dark: "#8E8150" },
  "arizona-state-university": { accent: "#8C1D40", fg: "#FFFFFF", dark: "#6B1531" },
};
const DEFAULT_ACCENT = { accent: "#4F46E5", fg: "#FFFFFF", dark: "#4338CA" };


function CampusPage() {
  const { campus, allCampuses, listingCounts, stats } = Route.useLoaderData();
  const campusShort = campusShortName(campus);
  // Q505 — visible body copy uses the everyday name (short_name via the shared
  // campus-name helper), matching cards, homepage and footer. The legal name
  // stays in <title>/meta only. A hard-cut short name falls back to the full name.
  const campusDisplay = campusShort.endsWith("…") ? campusFullName(campus) : campusShort;
  const navigate = useNavigate();
  const { user } = useSession();
  const qc = useQueryClient();

  // Remember which campus the visitor arrived on — pre-selects it in onboarding after signup.
  useEffect(() => {
    try { localStorage.setItem("leaseup_campus_hint", campus.slug); } catch {}
  }, [campus.slug]);

  // Toast + strip the "?notice=" flag left by the /campus/$slug 301.
  useEffect(() => {
    if (typeof window === "undefined") return;
    const url = new URL(window.location.href);
    if (url.searchParams.get("notice") === "campus-url-moved") {
      toast.message("This campus page moved — you're on the latest version.");
      url.searchParams.delete("notice");
      window.history.replaceState({}, "", url.pathname + url.search);
    }
  }, []);


  const { data: allListings = [], isLoading: listingsLoading } = useQuery({ queryKey: ["listings"], queryFn: fetchListings });
  const { data: campuses = allCampuses } = useQuery<Campus[]>({
    queryKey: ["campuses"],
    queryFn: fetchCampuses,
    initialData: allCampuses,
  });
  const { data: savedIds = new Set<string>() } = useQuery({
    queryKey: ["saved", user?.id],
    queryFn: () => fetchSavedIds(user!.id),
    enabled: !!user?.id,
  });

  const listings = useMemo(
    () => allListings.filter(l => l.campus_id === campus.id),
    [allListings, campus.id],
  );

  const [bedFilter, setBedFilter] = useState<BedFilter>("any");
  const [furnishedOnly, setFurnishedOnly] = useState(false);
  const [priceFilter, setPriceFilter] = useState<PriceFilter>("any");
  const [search, setSearch] = useState("");
  const [sortBy, setSortBy] = useState<"recent" | "price">("recent");
  const [selected, setSelected] = useState<Listing | null>(null);
  const [posting, setPosting] = useState(false);
  const [messagesOpen, setMessagesOpen] = useState(false);
  const [activeConv, setActiveConv] = useState<string | null>(null);
  const [profileId, setProfileId] = useState<string | null>(null);

  const { data: lookingFor = [] } = useQuery({
    queryKey: ["looking-for", campus.id],
    queryFn: () => fetchLookingFor(campus.id),
  });

  const toggleSave = useToggleSave(user?.id);

  function handleSave(l: Listing) {
    if (!user) { navigate({ to: "/auth", search: { mode: "in" } }); return; }
    void toggleSave(l.id);
  }

  async function handleMessage(l: Listing) {
    if (!user) { navigate({ to: "/auth", search: { mode: "in" } }); return; }
    if (l.user_id === user.id) { toast("That's your own listing"); return; }
    try {
      const id = await getOrCreateConversation(user.id, l.user_id, l.id);
      setActiveConv(id);
      setMessagesOpen(true);
      setSelected(null);
    } catch (e) { toast.error(friendlyError(e, "Couldn't open that conversation. Try again.")); }
  }

  const filtered = useMemo(() => {
    const list = listings.filter((l) => {
      if (search) {
        const q = search.toLowerCase();
        if (!l.title.toLowerCase().includes(q) && !(l.area ?? "").toLowerCase().includes(q)) return false;
      }
      if (bedFilter !== "any") {
        if (bedFilter === "3+") { if ((l.beds ?? 0) < 3) return false; }
        else if ((l.beds ?? 0) !== parseInt(bedFilter)) return false;
      }
      if (furnishedOnly && !l.furnished) return false;
      if (priceFilter === "under700" && (l.price ?? 0) >= 700) return false;
      if (priceFilter === "under1000" && (l.price ?? 0) >= 1000) return false;
      return true;
    });
    if (sortBy === "price") {
      return [...list].sort((a, b) => (a.price ?? Infinity) - (b.price ?? Infinity));
    }
    return [...list].sort((a, b) => {
      const ad = a.created_at ? new Date(a.created_at).getTime() : 0;
      const bd = b.created_at ? new Date(b.created_at).getTime() : 0;
      return bd - ad;
    });
  }, [listings, search, bedFilter, furnishedOnly, priceFilter, sortBy]);

  const handlePost = () => user ? setPosting(true) : navigate({ to: "/auth", search: { mode: "up" } });

  async function handleMessageUser(userId: string) {
    if (!user) { navigate({ to: "/auth", search: { mode: "in" } }); return; }
    if (userId === user.id) { toast("That's your own post"); return; }
    try {
      const id = await getOrCreateConversation(user.id, userId, null);
      setActiveConv(id);
      setMessagesOpen(true);
    } catch (e) { toast.error(friendlyError(e, "Couldn't open that conversation. Try again.")); }
  }


  // Q266 — hero badge only when the campus record has a curated abbreviation
  // (UGA, GT, UVA). Never derive initials from the name: "University of
  // Kansas" would print "UK", which is Kentucky's abbreviation.
  const curatedAbbrev = (() => {
    const short = (campus.short_name ?? "").trim();
    return !!short && short.length <= 4 && /^[A-Za-z&.\s]+$/.test(short) && short === short.toUpperCase();
  })();

  // Q369 — scoped to this page wrapper only; nothing else in the app inherits it.
  const theme = CAMPUS_ACCENTS[campus.slug] ?? DEFAULT_ACCENT;
  const accentStyle = {
    "--primary": theme.accent,
    "--primary-foreground": theme.fg,
    "--primary-dark": theme.dark,
  } as CSSProperties;


  return (
    <div className="min-h-screen bg-background pb-24 md:pb-0" style={accentStyle}>

      {/* Hero */}
      <header className="border-b bg-surface">
        <div className="mx-auto max-w-7xl px-4 py-10 md:py-14">
          <div className="flex items-center gap-2 text-xs font-bold text-primary uppercase tracking-wider">
            <MapPin className="h-3.5 w-3.5" /> {campus.city}, {campus.state}
          </div>
          <h1 className="mt-2 flex items-center gap-3 text-3xl md:text-4xl font-black tracking-tight">
            {curatedAbbrev && <CampusMark campus={campus} className="h-12 w-12 text-base md:h-14 md:w-14 md:text-lg" />}
            {campusDisplay} Subleases
          </h1>
          <p className="mt-2 max-w-2xl text-sm md:text-base text-muted-foreground">
            Find subleases posted by {campusDisplay} students who signed up with a campus email.
          </p>

          {/* Live stats bar - suppress zero tiles; all-zero shows a prompt instead */}
          {(() => {
            const tiles = [
              // stats.active counts active rows with no expiry filter, while the grid
              // below only renders unexpired ones. On a campus whose listings have all
              // expired that printed a count directly above "No subleases posted yet",
              // so suppress the tile once we know there is nothing to show.
              { label: "Listed this semester", value: !listingsLoading && listings.length === 0 ? 0 : stats.active },
              { label: "Students helped", value: stats.completed },
              { label: "Students looking", value: stats.looking },
            ].filter((t) => typeof t.value === "number" && t.value > 0);
            if (tiles.length === 0) {
              return (
                <p className="mt-5 text-sm text-muted-foreground">
                  Be the first to list at {campusDisplay}.
                </p>
              );
            }
            return (
              <dl
                className={cn(
                  "mt-5 grid gap-3 max-w-2xl",
                  tiles.length === 1 ? "grid-cols-1" : tiles.length === 2 ? "grid-cols-2" : "grid-cols-3",
                )}
              >
                {tiles.map((t) => (
                  <div
                    key={t.label}
                    className="rounded-xl border border-border bg-background/50 px-3 py-3 text-center"
                  >
                    <dt className="text-[11px] font-semibold uppercase tracking-wide text-muted-foreground">
                      {t.label}
                    </dt>
                    <dd className="mt-0.5 text-xl md:text-2xl font-black text-primary">{t.value}</dd>
                  </div>
                ))}
              </dl>
            );
          })()}

          <div className="mt-5 flex flex-wrap gap-2">
            <button onClick={handlePost} className="inline-flex items-center gap-1 rounded-md bg-primary px-4 py-2 text-sm font-bold text-primary-foreground hover:bg-primary-dark">
              <Plus className="h-4 w-4" /> Post a sublease
            </button>
            <Link to="/looking" className="inline-flex items-center gap-1 rounded-md border bg-surface px-4 py-2 text-sm font-bold hover:bg-background">
              <Sparkles className="h-4 w-4" /> I'm looking
            </Link>
          </div>
        </div>
      </header>



      <main className="mx-auto max-w-7xl px-4 py-6">
        {/* Filter pills — only when the campus has listings; dead controls above
            an empty state read as broken on the ~3,880 zero-listing campuses. */}
        {listings.length > 0 && (
        <div className="mb-4 flex flex-wrap gap-2">
          {([
            ["any", "All"],
            ["0", "Studio"],
            ["1", "1 BR"],
            ["2", "2 BR"],
            ["3+", "3+ BR"],
          ] as [BedFilter, string][]).map(([val, label]) => (
            <button
              key={val}
              onClick={() => setBedFilter(val)}
              className={cn(
                "rounded-full border px-3 py-1 text-xs font-semibold transition",
                bedFilter === val
                  ? "border-primary bg-primary text-primary-foreground"
                  : "border-border bg-surface text-muted-foreground hover:border-primary",
              )}
            >
              {label}
            </button>
          ))}
          <button
            onClick={() => setFurnishedOnly((v) => !v)}
            className={cn(
              "rounded-full border px-3 py-1 text-xs font-semibold transition",
              furnishedOnly
                ? "border-primary bg-primary text-primary-foreground"
                : "border-border bg-surface text-muted-foreground hover:border-primary",
            )}
          >
            Furnished
          </button>
          {([
            ["under700", "< $700"],
            ["under1000", "< $1,000"],
          ] as [PriceFilter, string][]).map(([val, label]) => (
            <button
              key={val}
              onClick={() => setPriceFilter((p) => (p === val ? "any" : val))}
              className={cn(
                "rounded-full border px-3 py-1 text-xs font-semibold transition",
                priceFilter === val
                  ? "border-primary bg-primary text-primary-foreground"
                  : "border-border bg-surface text-muted-foreground hover:border-primary",
              )}
            >
              {label}
            </button>
          ))}
        </div>
        )}

        <div className="flex flex-wrap items-center justify-between gap-3 mb-4">
          <h2 className="font-black">
            {!listingsLoading && filtered.length > 0
              ? `${filtered.length} listing${filtered.length === 1 ? "" : "s"} at ${campusDisplay}`
              : `Subleases at ${campusDisplay}`}
          </h2>
          {/* Sort control — also dead with nothing to sort. */}
          {listings.length > 0 && (
          <div className="flex items-center gap-1 rounded-full border border-border bg-surface p-0.5 text-xs">
            <button
              onClick={() => setSortBy("recent")}
              className={cn(
                "rounded-full px-3 py-1 font-semibold transition",
                sortBy === "recent" ? "bg-primary text-primary-foreground" : "text-muted-foreground hover:text-foreground",
              )}
            >
              Most recent
            </button>
            <button
              onClick={() => setSortBy("price")}
              className={cn(
                "rounded-full px-3 py-1 font-semibold transition",
                sortBy === "price" ? "bg-primary text-primary-foreground" : "text-muted-foreground hover:text-foreground",
              )}
            >
              Lowest price
            </button>
          </div>
          )}
        </div>

        {listingsLoading ? (
          <ListingCardSkeletonGrid count={8} />
        ) : filtered.length === 0 ? (
          <div className="rounded-xl bg-surface p-12 text-center shadow-card">
            <div className="text-5xl">🏠</div>
            <h3 className="mt-3 text-lg font-bold">
              {listings.length > 0
                ? `No subleases match these filters at ${campusDisplay}.`
                : `No subleases posted yet at ${campusDisplay}.`}
            </h3>
            <p className="mt-1 text-sm text-muted-foreground max-w-md mx-auto">
              {listings.length > 0
                ? "Try removing a filter to see more subleases."
                : `Be the first — post your sublease and help a fellow ${campusDisplay} student.`}
            </p>
            <button onClick={handlePost} className="mt-4 inline-flex items-center gap-1 rounded-md bg-primary px-4 py-2 text-sm font-bold text-primary-foreground hover:bg-primary-dark">
              <Plus className="h-4 w-4" /> Post a sublease →
            </button>
          </div>
        ) : (
          <div className="grid grid-cols-1 gap-5 sm:grid-cols-2 md:grid-cols-3 md:gap-5 lg:grid-cols-4 lg:gap-6">
            {filtered.map(l => (
              <ListingCard key={l.id} listing={l} saved={savedIds.has(l.id)}
                onSave={() => handleSave(l)} onOpen={() => setSelected(l)} />
            ))}
          </div>
        )}

        {/* Students actively looking */}
        {lookingFor.length > 0 && (
          <section className="mt-12">
            <h2 className="mb-4 text-xl font-black">
              Students actively looking for a sublease at {campusDisplay}
            </h2>
            <div className="-mx-4 flex snap-x snap-mandatory gap-3 overflow-x-auto px-4 pb-2 md:mx-0 md:grid md:grid-cols-2 md:gap-3 md:overflow-visible md:px-0">
              {lookingFor.slice(0, 4).map((p) => {
                const budget = p.budget_max != null ? `Up to $${p.budget_max}/mo` : "Budget flexible";
                const move = p.move_in_date
                  ? new Date(p.move_in_date).toLocaleDateString(undefined, { month: "short", year: "numeric" })
                  : "Flexible";
                const first = posterFirstName(p);
                const snippet = (p.description ?? "").slice(0, 120);
                return (
                  <article
                    key={p.id}
                    className="min-w-[85%] snap-start rounded-2xl border border-border bg-surface p-4 shadow-sm md:min-w-0"
                  >
                    <div className="flex items-center gap-3">
                      <UserAvatar
                        name={first}
                        avatarUrl={p.profile?.avatar_url}
                        color={p.profile?.banner_color ?? null}
                        className="h-10 w-10"
                        textClassName="text-sm"
                      />
                      <div className="min-w-0">
                        <div className="truncate text-sm font-bold">{first}</div>
                        <div className="truncate text-[11px] text-muted-foreground">
                          {budget} · Move-in {move}
                        </div>
                      </div>
                    </div>
                    {snippet && (
                      <p className="mt-2 line-clamp-2 text-sm text-muted-foreground">{snippet}</p>
                    )}
                    <button
                      onClick={() => handleMessageUser(p.user_id)}
                      className="mt-3 inline-flex items-center gap-1 rounded-full bg-primary px-3 py-1.5 text-xs font-bold text-primary-foreground hover:bg-primary-dark"
                    >
                      <MessageCircle className="h-3.5 w-3.5" /> Message →
                    </button>
                  </article>
                );
              })}
            </div>
          </section>
        )}

        {/* How it works */}
        <section className="mt-12 border-t pt-8">
          <h2 className="mb-5 text-xl font-black">How LeaseUp works at {campusDisplay}</h2>
          <ol className="grid gap-4 md:grid-cols-3">
            {[
              { n: 1, icon: Search, title: "Browse campus listings", body: `Subleases posted by ${campusDisplay} students. Posters sign up with a school email.` },
              { n: 2, icon: Handshake, title: "Message directly", body: "No middleman. Message the lister directly and arrange the handoff." },
              { n: 3, icon: CheckCircle2, title: "Mark as rented", body: "Once a deal is made, the listing is marked complete. No ghost listings." },
            ].map(({ n, icon: Icon, title, body }) => (
              <li key={n} className="rounded-2xl border border-border bg-surface p-5">
                <div className="flex items-center gap-2 text-primary">
                  <span className="grid h-7 w-7 place-items-center rounded-full bg-primary/10 text-xs font-black">{n}</span>
                  <Icon className="h-4 w-4" />
                </div>
                <h3 className="mt-3 text-base font-bold">{title}</h3>
                <p className="mt-1 text-sm text-muted-foreground">{body}</p>
              </li>
            ))}
          </ol>
        </section>


        {/* Other campuses — cards with live listing counts */}
        <section className="mt-12 border-t pt-8">
          <div className="mb-4 flex items-baseline justify-between gap-3">
            <h2 className="text-xl font-black">Browse other campuses</h2>
            <Link to="/campuses" className="text-sm font-semibold text-primary hover:underline">
              See all campuses →
            </Link>
          </div>
          <div className="grid grid-cols-2 gap-3 sm:grid-cols-3 lg:grid-cols-4">
            {campuses
              .filter((c: Campus) => c.slug !== campus.slug)
              .sort((a: Campus, b: Campus) => (listingCounts[b.id] ?? 0) - (listingCounts[a.id] ?? 0))
              .map((c: Campus) => {
                const count = listingCounts[c.id] ?? 0;
                return (
                  <Link
                    key={c.id}
                    to="/sublease/$slug"
                    params={{ slug: c.slug }}
                    className="group flex flex-col rounded-xl border border-border bg-surface p-4 transition hover:border-primary hover:shadow-card"
                  >
                    <div className="text-sm font-bold text-foreground group-hover:text-primary">
                      {campusShortName(c)}
                    </div>
                    <div className="mt-0.5 text-[11px] text-muted-foreground">
                      {c.city}, {c.state}
                    </div>
                    <div className="mt-2 text-xs font-semibold text-primary">
                      {count > 0 ? `${count} live listing${count === 1 ? "" : "s"}` : "Be the first →"}
                    </div>
                  </Link>
                );
              })}
          </div>
        </section>

        {/* Ambassador share kit */}
        {(() => {
          const baseUrl = typeof window !== "undefined"
            ? `${window.location.origin}/sublease/${campus.slug}`
            : `https://leasup.co/sublease/${campus.slug}`;
          const short = campusShort;
          const gmUrl = withUtm(baseUrl, "groupme", "campus_share");
          const dcUrl = withUtm(baseUrl, "discord", "campus_share");
          const gmText = `If you're looking for a sublease at ${short}, check out LeaseUp.\nIt's a free marketplace just for ${short} students — verified .edu sign-in only.\nNo fees, just real listings from real students 👇\n${gmUrl}`;
          const dcText = `**LeaseUp — ${short} subleases**\nFree marketplace just for ${short} students · verified .edu sign-in only.\nReal listings from real students 👇\n\n${dcUrl}`;
          return (
            <section className="mt-12 rounded-2xl border border-border bg-surface p-6 md:p-8">
              <h2 className="text-lg md:text-xl font-black">
                Know students looking for housing? Share LeaseUp with your {campusDisplay} GroupMe.
              </h2>
              <p className="mt-2 text-sm text-muted-foreground">
                Pre-written and ready to paste — one tap and you're helping other {campusDisplay} students find housing.
              </p>
              <div className="mt-4 flex flex-wrap gap-2">
                <button
                  type="button"
                  onClick={() => shareToGroupMe(gmText)}
                  className="inline-flex items-center gap-2 rounded-full bg-primary px-5 py-2.5 text-sm font-bold text-primary-foreground shadow-sm transition active:scale-95"
                >
                  Copy campus message for GroupMe
                </button>
                <button
                  type="button"
                  onClick={async () => {
                    const ok = await copyToClipboard(dcText);
                    if (ok) toast.success("Copied — paste into Discord");
                  }}
                  className="inline-flex items-center gap-2 rounded-full border border-border bg-background px-4 py-2.5 text-sm font-semibold shadow-sm transition active:scale-95"
                >
                  Copy for Discord
                </button>
              </div>
            </section>
          );
        })()}

        {/* Bottom lister CTA */}
        <section className="mt-12 rounded-2xl bg-primary/5 border border-primary/20 p-6 md:p-8 text-center">
          <h2 className="text-xl md:text-2xl font-black">Have a sublease to fill at {campusDisplay}?</h2>
          <p className="mx-auto mt-2 max-w-xl text-sm text-muted-foreground">
            Post it free. Your listing goes live on the {campusDisplay} page and in browse the moment you submit it.
          </p>
          <button
            onClick={handlePost}
            className="mt-4 inline-flex items-center gap-1 rounded-md bg-primary px-5 py-2.5 text-sm font-bold text-primary-foreground hover:bg-primary-dark"
          >
            <Plus className="h-4 w-4" /> Post your sublease →
          </button>
        </section>
      </main>


      <ListingDetailSheet listing={selected} open={!!selected}
        onOpenChange={(o) => !o && setSelected(null)}
        onMessage={handleMessage}
        onViewProfile={(id) => { setSelected(null); setProfileId(id); }} />
      <MessagesSheet open={messagesOpen} onOpenChange={setMessagesOpen} initialConversationId={activeConv} />
      <ProfileSheet userId={profileId} open={!!profileId} onOpenChange={(o) => !o && setProfileId(null)}
        onMessage={async (otherId) => {
          if (!user) return;
          try {
            const id = await getOrCreateConversation(user.id, otherId, null);
            setActiveConv(id); setMessagesOpen(true); setProfileId(null);
          } catch (e) { toast.error(friendlyError(e, "Couldn't open that conversation. Try again.")); }
        }} />
      <PostListingDialog open={posting} onOpenChange={setPosting} />
    </div>
  );
}
