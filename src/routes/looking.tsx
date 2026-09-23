import { createFileRoute, Link, useNavigate } from "@tanstack/react-router";
import { friendlyError } from "@/lib/leaseup/friendly-error";
import { useState, useEffect } from "react";
import { useQuery, useQueryClient } from "@tanstack/react-query";
import {
  fetchLookingFor,
  createLookingFor,
  updateLookingFor,
  deleteLookingFor,
  renewLookingFor,
  markLookingForFound,
  fetchMyLookingForInterests,
  toggleLookingForInterest,
  fetchMatchingListingsForPost,
  getOrCreateConversation,
} from "@/lib/leaseup/queries";
import { useSession, useMyProfile } from "@/lib/leaseup/use-session";
import { fetchCampuses } from "@/lib/leaseup/campuses";

import { Button } from "@/components/ui/button";
import {
  Dialog, DialogContent, DialogHeader, DialogTitle, DialogFooter, DialogDescription,
} from "@/components/ui/dialog";
import {
  Sheet, SheetContent, SheetHeader, SheetTitle,
} from "@/components/ui/sheet";
import { Input } from "@/components/ui/input";
import { Textarea } from "@/components/ui/textarea";
import { Label } from "@/components/ui/label";
import { ProfileSheet } from "@/components/leaseup/ProfileSheet";
import { CampusAutocomplete } from "@/components/leaseup/CampusAutocomplete";
import { openSignIn } from "@/components/leaseup/SignInModal";
import {
  Plus, Trash2, Pencil, Check, MessageSquare, BadgeCheck, Calendar, DollarSign,
  MapPin, Bell, BellOff, Users, Bed,
} from "lucide-react";
import { toast } from "sonner";
import { supabase } from "@/integrations/supabase/client";
import { NEIGHBORHOODS, timeAgo } from "@/lib/leaseup/constants";
import type { LookingForPost, Listing } from "@/lib/leaseup/types";
import { posterName, posterFirstName, profileDisplayName } from "@/lib/leaseup/display-name";
import { hasSchoolEmail, SCHOOL_EMAIL_BADGE } from "@/lib/leaseup/school-email";
import { UserAvatar } from "@/components/leaseup/UserAvatar";

// Q152 — local memory of which Roommate Search posts this device already upvoted.
const UPVOTED_KEY = "leasup_upvoted_posts";

export const Route = createFileRoute("/looking")({
  // Q150 — ?prefill= carries the homepage quick-post text into the form.
  validateSearch: (search: Record<string, unknown>): { prefill?: string } => ({
    prefill: typeof search.prefill === "string" && search.prefill.trim()
      ? search.prefill.slice(0, 300)
      : undefined,
  }),
  head: () => ({
    meta: [
      { title: "Roommate Search — Post What You Need — LeaseUp" },
      { name: "description", content: "Roommate Search: tell students what you need, get notified when a room or sublease near your campus is posted." },
      { property: "og:title", content: "Roommate Search — Post What You Need" },
      { property: "og:description", content: "Tell students what you need. Get notified when a new listing is posted." },
      { property: "og:url", content: "https://leasup.co/looking" },
      { property: "og:type", content: "website" },
    ],
    links: [{ rel: "canonical", href: "https://leasup.co/looking" }],
  }),
  component: LookingForPage,
});


function activeAgo(iso?: string | null) {
  if (!iso) return null;
  const s = Math.floor((Date.now() - new Date(iso).getTime()) / 1000);
  if (s < 120) return "Active now";
  if (s < 3600) return `Active ${Math.floor(s / 60)}m ago`;
  if (s < 86400) return `Active ${Math.floor(s / 3600)}h ago`;
  const days = Math.floor(s / 86400);
  // Q185/Q187 — beyond two weeks nobody is "active"; the card falls back to
  // the posted date. Precise day counts past 3 days make same-day seeded
  // posts obvious (every card reads "Active 11d ago"), so bucket them.
  if (days <= 3) return `Active ${days}d ago`;
  return days <= 14 ? "Active recently" : null;
}

function fmtDateRange(from: string | null, to: string | null) {
  if (!from && !to) return null;
  // Q184 — never render a bare "?": open-ended ends read as "onwards".
  const fmt = (d: string) =>
    new Date(d).toLocaleDateString(undefined, { month: "short", year: "numeric" });
  if (from && !to) return `${fmt(from)} onwards`;
  if (!from && to) return `Until ${fmt(to)}`;
  return `${fmt(from!)} – ${fmt(to!)}`;
}

function LookingForPage() {
  const { user } = useSession();
  const { data: myProfile } = useMyProfile();
  const qc = useQueryClient();
  const navigate = useNavigate();
  const { data: campuses = [] } = useQuery({
    queryKey: ["campuses"],
    queryFn: fetchCampuses,
    staleTime: Infinity,
  });

  // Filters — campus scope. Q136: "All" is the default so the pill strip matches.
  const [campusFilter, setCampusFilter] = useState<string>("all");
  // Display name of a specifically-picked campus (the full campus list covers
  // ~3,900 schools, so the filter is a search box, not a fixed dropdown).
  const [campusName, setCampusName] = useState<string>("");

  // Q138 — campus pills, fixed order: UGA, GT, Ohio State, UT Austin, Auburn, Clemson, Duke, FSU.
  const PILL_SLUGS = [
    "university-of-georgia",
    "georgia-tech",
    "ohio-state-university",
    "university-of-texas-at-austin",
    "ut-austin",
    "auburn-university",
    "clemson-university",
    "duke-university",
    "florida-state-university",
    // Q141 — remaining four campuses from Q139
    "university-of-florida",
    "university-of-michigan",
    "penn-state-university",
    "vanderbilt-university",
    // Q167
    "texas-a-m-university",
    "arizona-state-university",
    // Q168
    "university-of-southern-california",
    "new-york-university",
    // Q169
    "boston-university",
    "university-of-washington",
    // Q178
    "university-of-virginia",
  ];
  const pillCampuses = PILL_SLUGS.map((slug) => campuses.find((c) => c.slug === slug)).filter(
    (c, i, arr): c is NonNullable<typeof c> => !!c && arr.findIndex((x) => x?.id === c.id) === i,
  );


  const [budgetFilter, setBudgetFilter] = useState<string>("");
  const [moveInBy, setMoveInBy] = useState<string>("");

  // Q168 — budget band chips (parsed from post text, falls back to budget_max)
  const [budgetBand, setBudgetBand] = useState<string>("any");

  const campusId =
    campusFilter === "all" ? null : campusFilter === "mine" ? myProfile?.campus_id ?? null : campusFilter;

  const { data: allPosts = [], isLoading } = useQuery({
    queryKey: ["looking-for", campusId],
    queryFn: () => fetchLookingFor(campusId),
  });

  // Q152 — sort toggle + local upvote memory
  const [sort, setSort] = useState<"recent" | "upvoted">("recent");
  const [upvoted, setUpvoted] = useState<string[]>([]);
  const [bumped, setBumped] = useState<Record<string, number>>({});
  useEffect(() => {
    try {
      const raw = localStorage.getItem(UPVOTED_KEY);
      if (raw) setUpvoted(JSON.parse(raw) as string[]);
    } catch { /* ignore */ }
  }, []);

  async function onUpvote(p: LookingForPost) {
    if (upvoted.includes(p.id)) return;
    const next = [...upvoted, p.id];
    setUpvoted(next);
    setBumped((b) => ({ ...b, [p.id]: (b[p.id] ?? p.upvotes ?? 0) + 1 }));
    try { localStorage.setItem(UPVOTED_KEY, JSON.stringify(next)); } catch { /* ignore */ }
    const { error } = await supabase.rpc("upvote_looking_for_post", { _post_id: p.id });
    if (error) toast.error("Couldn't upvote — try again");
  }

  // Q157 — owner "Bump" moves a post back to the top of Recent, once per 24h.
  const [bumpedAt, setBumpedAt] = useState<Record<string, number>>({});
  useEffect(() => {
    const next: Record<string, number> = {};
    try {
      for (let i = 0; i < localStorage.length; i++) {
        const k = localStorage.key(i);
        if (!k?.startsWith("leasup_bump_")) continue;
        const ts = Number(localStorage.getItem(k));
        if (ts) next[k.slice("leasup_bump_".length)] = ts;
      }
    } catch { /* ignore */ }
    setBumpedAt(next);
  }, []);

  async function onBump(p: LookingForPost) {
    const last = bumpedAt[p.id] ?? 0;
    if (Date.now() - last < 24 * 60 * 60 * 1000) return;
    const now = Date.now();
    setBumpedAt((b) => ({ ...b, [p.id]: now }));
    try { localStorage.setItem(`leasup_bump_${p.id}`, String(now)); } catch { /* ignore */ }
    const { error } = await supabase
      .from("looking_for_posts")
      .update({ created_at: new Date().toISOString() })
      .eq("id", p.id);
    if (error) {
      toast.error("Couldn't bump — try again");
      return;
    }
    toast.success("Bumped to the top!");
    qc.invalidateQueries({ queryKey: ["looking-for"] });
  }


  const posts = allPosts
    .filter((p) => {
      if (budgetFilter && (p.budget_max == null || p.budget_max > Number(budgetFilter))) return false;
      if (moveInBy && (!p.move_in_date || p.move_in_date > moveInBy)) return false;
      if (budgetBand !== "any") {
        const m = /\$\s?(\d[\d,]*)/.exec(`${p.title ?? ""} ${p.description ?? ""}`);
        const n = m ? Number(m[1]!.replace(/,/g, "")) : p.budget_max ?? null;
        if (n != null) {
          if (budgetBand === "under800" && !(n < 800)) return false;
          if (budgetBand === "1000" && !(n >= 800 && n <= 1100)) return false;
          if (budgetBand === "1200" && !(n >= 1100 && n <= 1350)) return false;
          if (budgetBand === "1500plus" && !(n >= 1350)) return false;
        }
      }
      return true;
    })
    .sort((a, b) =>
      sort === "upvoted"
        ? (bumped[b.id] ?? b.upvotes ?? 0) - (bumped[a.id] ?? a.upvotes ?? 0)
        : 0,
    );
  const { data: myInterests = [] } = useQuery({
    queryKey: ["looking-for-interests", user?.id],
    queryFn: () => (user ? fetchMyLookingForInterests(user.id) : Promise.resolve([])),
    enabled: !!user,
  });
  const interestSet = new Set(myInterests);


  const [formOpen, setFormOpen] = useState(false);
  const [editing, setEditing] = useState<LookingForPost | null>(null);
  const [profileId, setProfileId] = useState<string | null>(null);
  const [matchesFor, setMatchesFor] = useState<LookingForPost | null>(null);
  const [foundFor, setFoundFor] = useState<LookingForPost | null>(null);
  const [confirmDelete, setConfirmDelete] = useState<LookingForPost | null>(null);

  // Q150 — arriving from the homepage quick-post widget opens the form pre-filled.
  const { prefill } = Route.useSearch();
  useEffect(() => {
    if (!prefill) return;
    if (!user) { openSignIn(`/looking?prefill=${encodeURIComponent(prefill)}`); return; }
    setEditing(null);
    setFormOpen(true);
  }, [prefill, user]);

  // Q183 — messaging a Roommate Search post opens a real thread tied to that
  // post (conversations dedupe on participants + listing_id + looking_post_id,
  // so re-clicking Message always returns to the same conversation).
  async function startConv(otherId: string, lookingPostId: string | null = null) {
    if (!user) return openSignIn("/looking");
    if (otherId === user.id) return;
    try {
      const id = await getOrCreateConversation(user.id, otherId, null, lookingPostId);
      navigate({ to: "/messages/$conversationId", params: { conversationId: id } });
    } catch (e: any) {
      toast.error(friendlyError(e, "Couldn't open the chat"));
    }
  }

  function openPost() {
    if (!user) return openSignIn("/looking");
    setEditing(null);
    setFormOpen(true);
  }

  function openEdit(p: LookingForPost) {
    setEditing(p);
    setFormOpen(true);
  }



  async function onToggleInterest(p: LookingForPost) {
    if (!user) return openSignIn("/looking");
    const interested = !interestSet.has(p.id);
    try {
      await toggleLookingForInterest(user.id, p.id, interested);
      qc.invalidateQueries({ queryKey: ["looking-for-interests", user.id] });
      toast.success(interested ? "We'll ping you when you post a match" : "Notifications off for this post");
    } catch (e: any) { toast.error(friendlyError(e)); }
  }

  async function onRenew(p: LookingForPost) {
    try {
      await renewLookingFor(p.id);
      qc.invalidateQueries({ queryKey: ["looking-for"] });
      toast.success("Renewed for 60 more days");
    } catch (e: any) { toast.error(friendlyError(e)); }
  }

  return (
    <div className="min-h-screen bg-background pb-24">


      <header className="border-b bg-surface">
        <div className="mx-auto flex max-w-5xl flex-wrap items-center gap-4 px-4 py-6">
          <div>
            <h1 className="text-2xl font-bold">Roommate Search</h1>
            <p className="max-w-xl text-sm text-muted-foreground">
              The reverse of browsing: students post what they need, and anyone with a
              room or sublease to fill messages them directly.
            </p>
          </div>

          <div className="ml-auto flex gap-2">
            <Link to="/browse" className="rounded-full border px-4 py-2.5 text-sm font-medium hover:bg-background">Browse subleases</Link>
            <button
              type="button"
              onClick={openPost}
              className="rounded-full bg-gray-900 px-5 py-2.5 text-sm font-medium text-white dark:bg-white dark:text-gray-900"
            >
              Post your search →
            </button>
          </div>
        </div>
      </header>

      <main className="mx-auto max-w-5xl px-4 py-6">
        {/* One filter row: campus · budget · move-in · sort. No duplicate chip rows. */}
        {/* Q436 — hide the whole row when nothing is posted to filter (same shape as the campus route's guard). */}
        {allPosts.length > 0 && (
        <div className="mb-5 flex flex-wrap items-end gap-3 rounded-2xl border border-border bg-surface p-3">
          <label className="text-xs font-semibold text-muted-foreground">
            Campus
            <div className="mt-1 flex h-10 w-64 items-center rounded-lg border border-border bg-surface px-3">
              <CampusAutocomplete
                className="flex-1"
                value={campusFilter === "all" ? "" : campusFilter === "mine" ? "My campus" : campusName}
                placeholder="All campuses"
                onSelect={(c) => { setCampusFilter(c.id); setCampusName(c.name); }}
                onClear={() => { setCampusFilter("all"); setCampusName(""); }}
              />
            </div>
          </label>
          {myProfile?.campus_id && campusFilter !== "mine" && (
            <button
              type="button"
              onClick={() => { setCampusFilter("mine"); setCampusName(""); }}
              className="h-10 rounded-full border border-border px-4 text-sm font-semibold hover:bg-background"
            >
              My campus
            </button>
          )}
          <label className="text-xs font-semibold text-muted-foreground">
            Budget up to
            <select
              value={budgetFilter}
              onChange={(e) => setBudgetFilter(e.target.value)}
              className="mt-1 block h-10 w-36 rounded-lg border border-border bg-surface px-3 text-sm font-medium text-foreground"
            >
              <option value="">Any budget</option>
              <option value={600}>$600/mo</option>
              <option value={800}>$800/mo</option>
              <option value={1000}>$1,000/mo</option>
              <option value={1200}>$1,200/mo</option>
              <option value={1500}>$1,500/mo</option>
              <option value={2000}>$2,000/mo</option>
            </select>
          </label>
          <label className="text-xs font-semibold text-muted-foreground">
            Moving in by
            <input
              type="date"
              value={moveInBy}
              onChange={(e) => setMoveInBy(e.target.value)}
              className="mt-1 block h-10 w-44 rounded-lg border border-border bg-surface px-3 text-sm font-medium text-foreground"
            />
          </label>
          {(budgetFilter || moveInBy || campusFilter !== "all") && (
            <button
              type="button"
              onClick={() => { setBudgetFilter(""); setMoveInBy(""); setCampusFilter("all"); setCampusName(""); }}
              className="h-10 rounded-lg px-3 text-sm font-semibold text-primary hover:underline"
            >
              Clear filters
            </button>
          )}
          <div className="ml-auto flex items-center gap-3">
            <div className="inline-flex rounded-full border border-border p-0.5">
              {([["recent", "Recent"], ["upvoted", "Most upvoted"]] as const).map(([key, label]) => (
                <button
                  key={key}
                  type="button"
                  onClick={() => setSort(key)}
                  className={`rounded-full px-3 py-1 text-xs font-semibold transition ${
                    sort === key ? "bg-foreground text-background" : "text-muted-foreground hover:text-foreground"
                  }`}
                >
                  {label}
                </button>
              ))}
            </div>
            <span className="text-xs text-muted-foreground">
              {!isLoading && posts.length > 0 ? `${posts.length} student${posts.length === 1 ? "" : "s"} looking` : ""}
            </span>
          </div>
        </div>
        )}






        {isLoading ? (
          <div className="grid gap-3 sm:grid-cols-2">
            {Array.from({ length: 4 }).map((_, i) => <div key={i} className="h-44 animate-pulse rounded-xl bg-muted" />)}
          </div>
        ) : posts.length === 0 ? (
          <div className="rounded-2xl bg-surface p-12 text-center shadow-card">
            <div className="text-5xl">🔎</div>
            <h3 className="mt-3 text-lg font-semibold">
              No searches posted here yet — be the first to let hosts know you're looking!
            </h3>
            <button
              type="button"
              onClick={openPost}
              className="mt-4 inline-block rounded-full bg-gray-900 px-5 py-2.5 text-sm font-medium text-white dark:bg-white dark:text-gray-900"
            >
              Post your search →
            </button>
          </div>

        ) : (
          <div className="grid gap-3 sm:grid-cols-2">
            {posts.map(p => (
              <LookingForCard
                key={p.id}
                p={p}
                campusName={campuses.find((c) => c.id === p.campus_id)?.name ?? null}
                isMine={user?.id === p.user_id}
                interested={interestSet.has(p.id)}
                onOpenProfile={() => setProfileId(p.user_id)}
                onReply={() => startConv(p.user_id, p.id)}
                onEdit={() => openEdit(p)}
                onDelete={() => setConfirmDelete(p)}
                onFound={() => setFoundFor(p)}
                onSeeMatches={() => setMatchesFor(p)}
                onNotifyMe={() => onToggleInterest(p)}
                onRenew={() => onRenew(p)}
                upvotes={bumped[p.id] ?? p.upvotes ?? 0}
                upvoted={upvoted.includes(p.id)}
                onUpvote={() => onUpvote(p)}
                browseCampusSlug={
                  campuses.find((c) => c.id === (campusId ?? p.campus_id))?.slug ?? null
                }
                canBump={Date.now() - (bumpedAt[p.id] ?? 0) >= 24 * 60 * 60 * 1000}
                onBump={() => onBump(p)}
              />
            ))}
          </div>
        )}
      </main>

      <LookingForFormDialog
        open={formOpen}
        onOpenChange={(o) => { setFormOpen(o); if (!o) setEditing(null); }}
        editing={editing}
        prefill={prefill}
        onSaved={() => qc.invalidateQueries({ queryKey: ["looking-for"] })}
      />


      <FoundDialog
        post={foundFor}
        userId={user?.id ?? null}
        onClose={() => setFoundFor(null)}
        onDone={() => qc.invalidateQueries({ queryKey: ["looking-for"] })}
      />

      <ConfirmDeleteDialog
        post={confirmDelete}
        onCancel={() => setConfirmDelete(null)}
        onConfirm={async () => {
          if (!confirmDelete) return;
          try {
            await deleteLookingFor(confirmDelete.id);
            toast.success("Post removed");
            qc.invalidateQueries({ queryKey: ["looking-for"] });
          } catch (e: any) { toast.error(friendlyError(e)); }
          finally { setConfirmDelete(null); }
        }}
      />

      <MatchesSheet
        post={matchesFor}
        onClose={() => setMatchesFor(null)}
      />

      <ProfileSheet userId={profileId} open={!!profileId} onOpenChange={(o) => !o && setProfileId(null)} onMessage={startConv} />
    </div>
  );
}

function LookingForCard({
  p, campusName, isMine, interested,
  onOpenProfile, onReply, onEdit, onDelete, onFound, onSeeMatches, onNotifyMe, onRenew,
  upvotes, upvoted, onUpvote, canBump, onBump, browseCampusSlug,
}: {
  p: LookingForPost;
  campusName?: string | null;
  isMine: boolean;
  interested: boolean;
  onOpenProfile: () => void;
  onReply: () => void;
  onEdit: () => void;
  onDelete: () => void;
  onFound: () => void;
  onSeeMatches: () => void;
  onNotifyMe: () => void;
  onRenew: () => void;
  upvotes: number;
  canBump: boolean;
  onBump: () => void;
  upvoted: boolean;
  onUpvote: () => void;
  /** Q159 — campus slug used by the "browse matching subleases" link. */
  browseCampusSlug?: string | null;
}) {
  const profile = p.profile;
  const displayName = posterName({ display_name: p.display_name, profile: profile as any });
  const dateRange = fmtDateRange(p.move_in_date, p.move_out_date);
  const ageDays = Math.floor((Date.now() - new Date(p.created_at).getTime()) / (1000 * 60 * 60 * 24));
  const expiringSoon = ageDays >= 55 && ageDays < 60;
  const last = activeAgo(profile?.last_seen ?? profile?.updated_at ?? null);
  const avatarUrl = (profile as { avatar_url?: string | null } | undefined)?.avatar_url ?? null;
  /** Q159 — pull a budget out of the post body ("$850", "under $1,200") for ?maxPrice. */
  const budgetMatch = /\$\s?(\d[\d,]{1,6})/.exec(`${p.title ?? ""} ${p.description ?? ""}`);
  const budgetFromBody = budgetMatch ? Number(budgetMatch[1].replace(/,/g, "")) : null;
  const matchSearch: Record<string, string | number> = {};
  if (browseCampusSlug) matchSearch.campus = browseCampusSlug;
  if (budgetFromBody && Number.isFinite(budgetFromBody)) matchSearch.maxPrice = budgetFromBody;

  return (
    <article className="relative rounded-xl bg-surface p-4 shadow-card transition hover:shadow-md">
      {/* Owner controls */}
      {isMine && (
        <div className="absolute right-3 top-3 flex items-center gap-1">
          <button
            onClick={onEdit}
            title="Edit"
            className="grid h-8 w-8 place-items-center rounded-full text-muted-foreground hover:bg-background hover:text-foreground"
          >
            <Pencil className="h-4 w-4" />
          </button>
          <button
            onClick={onDelete}
            title="Remove"
            className="grid h-8 w-8 place-items-center rounded-full text-muted-foreground hover:bg-destructive/10 hover:text-destructive"
          >
            <Trash2 className="h-4 w-4" />
          </button>
        </div>
      )}

      <div className="flex items-start gap-3">
        <button onClick={onOpenProfile} className="shrink-0" aria-label="View profile">
          <UserAvatar
            name={displayName}
            avatarUrl={avatarUrl}
            color={profile?.banner_color ?? null}
            className="h-12 w-12 ring-2 ring-white"
            textClassName="text-base"
          />
        </button>

        <div className="min-w-0 flex-1 pr-14">
          <div className="flex flex-wrap items-center gap-1.5">
            <button onClick={onOpenProfile} className="truncate text-sm font-bold hover:underline">
              {displayName}
            </button>
            {hasSchoolEmail(profile) && (
              <span title={SCHOOL_EMAIL_BADGE} className="inline-flex">
                <BadgeCheck className="h-3.5 w-3.5 text-success" />
              </span>
            )}
            {last && <span className="text-[11px] text-muted-foreground">· {last}</span>}
            <span className="ml-auto text-[10px] text-muted-foreground">Posted {timeAgo(p.created_at)}</span>
          </div>
          {campusName && <p className="text-xs text-muted-foreground">{campusName}</p>}


          <h3 className="mt-1 font-bold leading-tight">{p.title}</h3>
          {p.description?.trim() ? (
            <p className="mt-1 text-sm text-muted-foreground line-clamp-3">{p.description}</p>
          ) : (
            <p className="mt-1 text-sm italic text-gray-400">[No message provided]</p>
          )}

          <div className="mt-2 flex flex-wrap gap-1.5 text-[11px]">
            {p.budget_max != null && (
              <span className="inline-flex items-center gap-1 rounded-full bg-emerald-100 px-2 py-0.5 font-semibold text-emerald-800">
                <DollarSign className="h-3 w-3" />≤ ${Number(p.budget_max).toLocaleString("en-US")}/mo
              </span>
            )}
            {dateRange && (
              <span className="inline-flex items-center gap-1 rounded-full bg-primary-light px-2 py-0.5 font-semibold text-primary-dark">
                <Calendar className="h-3 w-3" />{dateRange}
              </span>
            )}
            {(p.num_people ?? 1) > 1 && (
              <span className="inline-flex items-center gap-1 rounded-full bg-background px-2 py-0.5 font-semibold">
                <Users className="h-3 w-3" />{p.num_people} people
              </span>
            )}
            {p.beds_min != null && (
              <span className="inline-flex items-center gap-1 rounded-full bg-background px-2 py-0.5 font-semibold">
                <Bed className="h-3 w-3" />{p.beds_min > 0 ? `${p.beds_min}+ bd` : "Any size"}
              </span>
            )}
            {p.area && (
              <span className="inline-flex items-center gap-1 rounded-full bg-background px-2 py-0.5 font-semibold">
                <MapPin className="h-3 w-3" />{p.area}
              </span>
            )}
            {p.furnished && <span className="rounded-full bg-accent px-2 py-0.5 font-semibold">Furnished</span>}
            {p.pets_ok && <span className="rounded-full bg-accent px-2 py-0.5 font-semibold">Pets OK</span>}
          </div>

          {profile?.vibe_tags && profile.vibe_tags.length > 0 && (
            <div className="mt-2 flex flex-wrap gap-1 text-[11px]">
              {profile.vibe_tags.slice(0, 4).map((t: string) => (
                <span key={t} className="rounded-full bg-background px-2 py-0.5 text-muted-foreground">{t}</span>
              ))}
            </div>
          )}

          {/* Q159 — jump straight to matching subleases */}
          <Link
            to="/browse"
            search={matchSearch}
            onClick={(e: React.MouseEvent) => e.stopPropagation()}
            className="mt-1 inline-block cursor-pointer text-xs text-indigo-600 hover:underline"
          >
            🔍 Browse subleases like this →
          </Link>

          <div className="mt-3 flex flex-wrap items-center gap-2">
            {!isMine && (
              <>
                <button
                  type="button"
                  onClick={onReply}
                  className="inline-flex items-center gap-1 rounded-lg border border-gray-300 px-3 py-1.5 text-sm text-gray-700 transition hover:bg-gray-50 dark:border-border dark:text-foreground dark:hover:bg-surface"
                >
                  <MessageSquare className="h-3.5 w-3.5" />
                  Message {displayName.split(" ")[0]} →
                </button>

                <button
                  onClick={onNotifyMe}
                  className={`inline-flex items-center gap-1 rounded-full border px-2.5 py-1 text-xs font-semibold transition ${
                    interested
                      ? "border-primary bg-primary-light text-primary-dark"
                      : "border-border text-muted-foreground hover:border-primary hover:text-primary"
                  }`}
                  title={interested ? "We'll notify you" : "Notify when I post"}
                >
                  {interested ? <Bell className="h-3.5 w-3.5" /> : <BellOff className="h-3.5 w-3.5" />}
                  {interested ? "Notifying you" : "Notify when I post"}
                </button>
              </>
            )}

            {isMine && (
              <>
                <Button size="sm" onClick={onSeeMatches} className="h-8 gap-1 bg-primary hover:bg-primary-dark text-primary-foreground">
                  See matches →
                </Button>
                <Button
                  size="sm"
                  variant="outline"
                  onClick={onFound}
                  className="h-8 gap-1 border-emerald-500 text-emerald-700 hover:bg-emerald-50"
                >
                  <Check className="h-3.5 w-3.5" />Found a place!
                </Button>
                {expiringSoon && (
                  <button
                    onClick={onRenew}
                    className="inline-flex items-center gap-1 rounded-full bg-amber-100 px-2.5 py-1 text-xs font-semibold text-amber-800 hover:bg-amber-200"
                    title="Renew for 90 more days"
                  >
                    ⏳ Expires soon · Renew
                  </button>
                )}
              </>
            )}

            {(p.interest_count ?? 0) > 0 && (
              <span className="inline-flex items-center gap-1 text-[11px] text-muted-foreground" title="People watching for your matches">
                <Users className="h-3 w-3" />{p.interest_count} watching
              </span>
            )}

            {/* Q152 — upvote / bump */}
            <button
              type="button"
              onClick={onUpvote}
              disabled={upvoted}
              aria-label={upvotes > 0 ? `Upvote this post, ${upvotes} upvotes` : "Upvote this post"}
              title={upvotes > 0 ? `Upvote this post, ${upvotes} upvotes` : "Upvote this post"}
              className={`ml-auto inline-flex items-center gap-1 rounded-full border px-2.5 py-1 text-xs font-semibold transition ${
                upvoted
                  ? "cursor-default border-border bg-background text-muted-foreground"
                  : "border-border text-foreground hover:border-primary hover:text-primary"
              }`}
            >
              Upvote{upvotes > 0 ? ` ${upvotes}` : ""}
            </button>
            {/* Q157 — owner bump (once per 24h) */}
            {isMine && (
              <button
                type="button"
                onClick={onBump}
                disabled={!canBump}
                title={canBump ? "Move this post to the top of Recent" : "Already bumped in the last 24 hours"}
                className={
                  canBump
                    ? "rounded border border-indigo-200 px-2 py-0.5 text-xs text-indigo-600 hover:bg-indigo-50 dark:border-indigo-500/40 dark:text-indigo-400 dark:hover:bg-indigo-500/10"
                    : "cursor-not-allowed px-2 py-0.5 text-xs text-gray-400"
                }
              >
                {canBump ? "⬆️ Bump" : "Bumped"}
              </button>
            )}
          </div>

        </div>
      </div>
    </article>
  );
}

function LookingForFormDialog({
  open, onOpenChange, editing, onSaved, prefill,
}: {
  open: boolean;
  onOpenChange: (b: boolean) => void;
  editing: LookingForPost | null;
  onSaved: () => void;
  /** Q150 — text typed in the homepage quick-post widget. */
  prefill?: string;
}) {
  const { user } = useSession();
  const { data: profile } = useMyProfile();
  const [title, setTitle] = useState("");
  const [description, setDescription] = useState("");
  const [budget, setBudget] = useState("");
  const [beds, setBeds] = useState("");
  const [people, setPeople] = useState("1");
  const [area, setArea] = useState("");
  const [from, setFrom] = useState("");
  const [to, setTo] = useState("");
  const [furnished, setFurnished] = useState(false);
  const [pets, setPets] = useState(false);
  const [busy, setBusy] = useState(false);

  useEffect(() => {
    if (!open) return;
    if (editing) {
      setTitle(editing.title ?? "");
      setDescription(editing.description ?? "");
      setBudget(editing.budget_max?.toString() ?? "");
      setBeds(editing.beds_min?.toString() ?? "");
      setPeople((editing.num_people ?? 1).toString());
      setArea(editing.area ?? "");
      setFrom(editing.move_in_date ?? "");
      setTo(editing.move_out_date ?? "");
      setFurnished(!!editing.furnished);
      setPets(!!editing.pets_ok);
    } else {
      const seed = prefill?.trim().slice(0, 300) ?? "";
      setTitle(seed ? seed.slice(0, 60) : "");
      setDescription(seed);
      setBudget(""); setBeds(""); setPeople("1");
      setArea(""); setFrom(""); setTo(""); setFurnished(false); setPets(false);
    }
  }, [open, editing, prefill]);


  async function submit() {
    if (!user) return;
    if (!title.trim() || !description.trim()) return toast.error("Title and description required");
    setBusy(true);
    try {
      const payload: Partial<LookingForPost> = {
        title, description,
        budget_max: budget ? parseInt(budget) : null,
        beds_min: beds ? parseInt(beds) : null,
        num_people: people ? Math.max(1, parseInt(people)) : 1,
        area: area || null,
        move_in_date: from || null,
        move_out_date: to || null,
        furnished, pets_ok: pets,
      };
      if (editing) {
        await updateLookingFor(editing.id, payload);
        toast.success("Updated");
      } else {
        await createLookingFor(user.id, payload, profile?.campus_id ?? null);
        toast.success("Posted");
      }
      onSaved();
      onOpenChange(false);
    } catch (e: any) { toast.error(friendlyError(e)); }
    finally { setBusy(false); }
  }

  return (
    <Dialog open={open} onOpenChange={onOpenChange}>
      <DialogContent className="max-w-lg">
        <DialogHeader>
          <DialogTitle>{editing ? "Edit your post" : "What are you looking for?"}</DialogTitle>
        </DialogHeader>
        <div className="space-y-3">
          <div><Label>Title</Label><Input value={title} onChange={(e) => setTitle(e.target.value)} placeholder="2BR near campus for spring" /></div>
          <div>
            <Label>Description</Label>
            <Textarea
              value={description}
              onChange={(e) => setDescription(e.target.value.slice(0, 300))}
              placeholder="e.g. Quiet grad student looking for a furnished 1BR or private room near North Campus for fall semester. Flexible on exact location."
              rows={4}
              maxLength={300}
            />
            <div className="mt-1 text-right text-[11px] text-muted-foreground">{description.length}/300</div>
          </div>
          <div className="grid grid-cols-2 gap-3">
            <div><Label>Max budget</Label><Input type="number" value={budget} onChange={(e) => setBudget(e.target.value)} placeholder="900" /></div>
            <div><Label>Min beds</Label><Input type="number" value={beds} onChange={(e) => setBeds(e.target.value)} placeholder="2" /></div>
            <div><Label>How many people</Label><Input type="number" min={1} value={people} onChange={(e) => setPeople(e.target.value)} placeholder="1" /></div>
            <div><Label>Move-in</Label><Input type="date" value={from} onChange={(e) => setFrom(e.target.value)} /></div>
            <div><Label>Move-out</Label><Input type="date" value={to} onChange={(e) => setTo(e.target.value)} /></div>
          </div>
          <div><Label>Area</Label>
            <select value={area} onChange={(e) => setArea(e.target.value)} className="mt-1 h-10 w-full rounded-md border bg-surface px-3 text-sm">
              <option value="">Any</option>
              {NEIGHBORHOODS.map(n => <option key={n.name}>{n.name}</option>)}
            </select>
          </div>
          <div className="flex gap-4 text-sm">
            <label className="flex items-center gap-2"><input type="checkbox" checked={furnished} onChange={(e) => setFurnished(e.target.checked)} />Furnished</label>
            <label className="flex items-center gap-2"><input type="checkbox" checked={pets} onChange={(e) => setPets(e.target.checked)} />Pets OK</label>
          </div>
        </div>
        <DialogFooter>
          <Button onClick={submit} disabled={busy} className="bg-primary hover:bg-primary-dark text-primary-foreground font-bold">
            {busy ? "Saving…" : editing ? "Save changes" : "Post"}
          </Button>
        </DialogFooter>
      </DialogContent>
    </Dialog>
  );
}

function ConfirmDeleteDialog({
  post, onCancel, onConfirm,
}: { post: LookingForPost | null; onCancel: () => void; onConfirm: () => void }) {
  return (
    <Dialog open={!!post} onOpenChange={(o) => !o && onCancel()}>
      <DialogContent className="max-w-sm">
        <DialogHeader>
          <DialogTitle>Remove your Roommate Search post?</DialogTitle>
          <DialogDescription>You won't be notified of new matches.</DialogDescription>
        </DialogHeader>
        <DialogFooter className="gap-2">
          <Button variant="outline" onClick={onCancel}>Cancel</Button>
          <Button onClick={onConfirm} className="bg-destructive text-destructive-foreground hover:bg-destructive/90">Remove</Button>
        </DialogFooter>
      </DialogContent>
    </Dialog>
  );
}

function FoundDialog({
  post, userId, onClose, onDone,
}: {
  post: LookingForPost | null;
  userId: string | null;
  onClose: () => void;
  onDone: () => void;
}) {
  const [busy, setBusy] = useState(false);
  async function go(via: boolean) {
    if (!post || !userId) return;
    setBusy(true);
    try {
      await markLookingForFound(post, { foundViaLeaseUp: via, userId });
      toast.success(via ? "🎉 Love to hear it!" : "Glad you found a place!");
      onDone();
      onClose();
    } catch (e: any) { toast.error(friendlyError(e)); }
    finally { setBusy(false); }
  }
  return (
    <Dialog open={!!post} onOpenChange={(o) => !o && onClose()}>
      <DialogContent className="max-w-sm text-center">
        <DialogHeader>
          <DialogTitle className="text-center text-2xl">🎉 Congrats!</DialogTitle>
          <DialogDescription className="text-center">Did you find it on LeaseUp?</DialogDescription>
        </DialogHeader>
        <DialogFooter className="flex-col gap-2 sm:flex-col">
          <Button onClick={() => go(true)} disabled={busy} className="w-full bg-primary hover:bg-primary-dark text-primary-foreground font-bold">
            Yes, through LeaseUp
          </Button>
          <Button onClick={() => go(false)} disabled={busy} variant="outline" className="w-full">
            Found it elsewhere
          </Button>
        </DialogFooter>
      </DialogContent>
    </Dialog>
  );
}

function MatchesSheet({ post, onClose }: { post: LookingForPost | null; onClose: () => void }) {
  const { data: matches = [], isLoading } = useQuery({
    queryKey: ["lf-matches", post?.id],
    queryFn: () => (post ? fetchMatchingListingsForPost(post) : Promise.resolve([])),
    enabled: !!post,
  });

  return (
    <Sheet open={!!post} onOpenChange={(o) => !o && onClose()}>
      <SheetContent side="bottom" className="h-[88vh] overflow-y-auto">
        <SheetHeader>
          <SheetTitle className="text-left">
            Listings that match your post
            <span className="ml-2 text-sm font-medium text-muted-foreground">
              {isLoading ? "" : `${matches.length} match${matches.length === 1 ? "" : "es"}`}
            </span>
          </SheetTitle>
        </SheetHeader>

        {isLoading ? (
          <div className="mt-4 space-y-3">
            {Array.from({ length: 3 }).map((_, i) => <div key={i} className="h-24 animate-pulse rounded-xl bg-muted" />)}
          </div>
        ) : matches.length === 0 ? (
          <div className="mt-12 rounded-xl bg-background p-8 text-center">
            <div className="text-4xl">🌱</div>
            <p className="mt-3 font-semibold">No listings match yet</p>
            <p className="mt-1 text-sm text-muted-foreground">
              We'll email you when one is posted.
            </p>
          </div>
        ) : (
          <div className="mt-4 grid gap-3 sm:grid-cols-2">
            {matches.map(l => <MatchListingRow key={l.id} l={l} />)}
          </div>
        )}
      </SheetContent>
    </Sheet>
  );
}

function MatchListingRow({ l }: { l: Listing }) {
  const photo = l.photo_urls?.[0];
  function open() {
    window.dispatchEvent(new CustomEvent("lu:open-listing", { detail: { id: l.id } }));
  }
  return (
    <button
      onClick={open}
      className="flex gap-3 rounded-xl bg-surface p-3 text-left shadow-card transition hover:shadow-md"
    >
      <div className="h-20 w-24 shrink-0 overflow-hidden rounded-lg bg-muted">
        {photo ? <img src={photo} alt="" className="h-full w-full object-cover" /> : null}
      </div>
      <div className="min-w-0 flex-1">
        <div className="flex items-center gap-2">
          <span className="font-bold">${l.price}</span>
          <span className="text-xs text-muted-foreground">/mo</span>
        </div>
        <p className="truncate text-sm font-semibold">{l.title}</p>
        <p className="truncate text-xs text-muted-foreground">
          {l.beds}bd · {l.baths}ba{l.area ? ` · ${l.area}` : ""}
        </p>
      </div>
    </button>
  );
}
