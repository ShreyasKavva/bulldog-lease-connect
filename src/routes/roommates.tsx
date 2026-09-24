/**
 * Roommates — bulletin board.
 *
 * Two modes:
 *   - "Has a room": people with a room to fill
 *   - "Looking for a room": people searching for a place
 *
 * Both use the same card format. Message button opens a direct DM (no
 * listing attached) via getOrCreateConversation.
 *
 * Signed-out visitors see a CTA to sign in. Signed-in users without a
 * roommate profile see a "Create your profile" prompt but can still
 * browse the board.
 */
import { createFileRoute, Link, useNavigate } from "@tanstack/react-router";
import { friendlyError } from "@/lib/leaseup/friendly-error";
import { useEffect, useMemo, useState } from "react";
import { useQuery } from "@tanstack/react-query";
import { useSession, useMyProfile } from "@/lib/leaseup/use-session";
import {
  fetchMyRoommateProfile,
  fetchRoommateProfiles,
  type RoommateMode,
  type RoommateProfileWithUser,
} from "@/lib/leaseup/roommates";
import { getOrCreateConversation } from "@/lib/leaseup/queries";
import { toast } from "sonner";
import { cn } from "@/lib/utils";
import { BadgeCheck, MessageCircle, Users, Sparkles, Home, Search } from "lucide-react";
import { openSignIn } from "@/components/leaseup/SignInModal";
import { UserAvatar } from "@/components/leaseup/UserAvatar";

export const Route = createFileRoute("/roommates")({
  head: () => ({
    meta: [
      { title: "Roommate board — LeaseUp" },
      { name: "description", content: "Find a roommate at your campus. Browse students who have a room to fill or who are looking for a place." },
    ],
  }),
  component: RoommatesPage,
});

type BudgetFilter = "any" | "u500" | "500-650" | "650-800";
type MoveInFilter = "any" | "this_month" | "next_month" | "this_semester";

function RoommatesPage() {
  const { user, loading } = useSession();
  const { data: profile } = useMyProfile();
  const navigate = useNavigate();

  // Q78: Toast + strip the "?notice=" flag left by the /find-my-match 301.
  useEffect(() => {
    if (typeof window === "undefined") return;
    const url = new URL(window.location.href);
    if (url.searchParams.get("notice") === "find-my-match-gone") {
      toast.message("Find My Match isn't available yet — try the roommate board.");
      url.searchParams.delete("notice");
      window.history.replaceState({}, "", url.pathname + url.search);
    }
  }, []);

  const [mode, setMode] = useState<RoommateMode>("has_room");
  const [budgetFilter, setBudgetFilter] = useState<BudgetFilter>("any");
  const [moveInFilter, setMoveInFilter] = useState<MoveInFilter>("any");

  const { data: myRoommate } = useQuery({
    queryKey: ["my-roommate-profile", user?.id],
    queryFn: () => fetchMyRoommateProfile(user!.id),
    enabled: !!user?.id,
  });

  const { data: feed = [], isLoading } = useQuery({
    queryKey: ["roommate-profiles", profile?.campus_id ?? null, user?.id ?? null],
    queryFn: () => fetchRoommateProfiles({ campusId: profile?.campus_id ?? null, excludeUserId: user?.id }),
    enabled: !loading,
  });

  const visible = useMemo(() => {
    return feed.filter(p => {
      if ((p.mode ?? "looking") !== mode) return false;
      // budget filter (uses their budget_max)
      if (budgetFilter !== "any") {
        const bmax = p.budget_max ?? p.budget_min ?? 0;
        if (budgetFilter === "u500" && bmax >= 500) return false;
        if (budgetFilter === "500-650" && (bmax < 500 || bmax > 650)) return false;
        if (budgetFilter === "650-800" && (bmax < 650 || bmax > 800)) return false;
      }
      // move-in filter
      if (moveInFilter !== "any" && p.move_in_date) {
        const move = new Date(p.move_in_date);
        const now = new Date();
        const thisMonth = now.getMonth() === move.getMonth() && now.getFullYear() === move.getFullYear();
        const nextDate = new Date(now.getFullYear(), now.getMonth() + 1, 1);
        const nextMonth = nextDate.getMonth() === move.getMonth() && nextDate.getFullYear() === move.getFullYear();
        const withinSemester = (move.getTime() - now.getTime()) / 86400000 <= 120 && move.getTime() >= now.getTime() - 86400000;
        if (moveInFilter === "this_month" && !thisMonth) return false;
        if (moveInFilter === "next_month" && !nextMonth) return false;
        if (moveInFilter === "this_semester" && !withinSemester) return false;
      }
      return true;
    });
  }, [feed, mode, budgetFilter, moveInFilter]);

  const [openingChat, setOpeningChat] = useState(false);
  async function handleMessage(target: RoommateProfileWithUser) {
    if (!user) { openSignIn("/roommates"); return; }
    if (openingChat) return;
    setOpeningChat(true);
    try {
      const convId = await getOrCreateConversation(user.id, target.user_id, null);
      navigate({ to: "/messages/$conversationId", params: { conversationId: convId } });
    } catch (e: any) {
      toast.error(friendlyError(e, "Couldn't open chat"));
    } finally {
      setOpeningChat(false);
    }
  }

  if (loading) return <div className="min-h-[60vh]" />;

  return (
    <div className="mx-auto max-w-5xl px-4 pb-28 pt-4 md:pb-16 md:pt-6">
      <div className="mb-4 flex items-start justify-between gap-4">
        <div>
          <h1 className="text-2xl font-extrabold md:text-3xl">Roommates</h1>
          <p className="mt-1 text-sm text-muted-foreground">
            Browse students at your campus. Message anyone directly — always free.
          </p>
        </div>
        {user && (
          <Link
            to="/roommates/create"
            className="hidden shrink-0 rounded-full bg-primary px-4 py-2 text-sm font-bold text-primary-foreground hover:bg-primary-dark sm:inline-flex"
          >
            {myRoommate ? "Edit my profile" : "Create profile"}
          </Link>
        )}
      </div>

      {/* Mode tabs */}
      <div className="mb-4 grid w-full grid-cols-2 rounded-full bg-white p-1 shadow-sm ring-1 ring-black/5 sm:inline-flex sm:w-auto dark:bg-surface">
        <ModeTab active={mode === "has_room"} onClick={() => setMode("has_room")} icon={<Home className="h-4 w-4" />}>Has a room</ModeTab>
        <ModeTab active={mode === "looking"} onClick={() => setMode("looking")} icon={<Search className="h-4 w-4" />}>Looking for a room</ModeTab>
      </div>

      {/* Filters */}
      <div className="mb-4 -mx-4 flex items-center gap-2 overflow-x-auto px-4 pb-1 text-sm [scrollbar-width:none] sm:mx-0 sm:flex-wrap sm:overflow-visible sm:px-0 sm:pb-0 [&::-webkit-scrollbar]:hidden">

        <FilterSelect
          label="Budget"
          value={budgetFilter}
          onChange={v => setBudgetFilter(v as BudgetFilter)}
          options={[
            { v: "any", l: "Any budget" },
            { v: "u500", l: "Under $500" },
            { v: "500-650", l: "$500–$650" },
            { v: "650-800", l: "$650–$800" },
          ]}
        />
        <FilterSelect
          label="Move-in"
          value={moveInFilter}
          onChange={v => setMoveInFilter(v as MoveInFilter)}
          options={[
            { v: "any", l: "Any move-in" },
            { v: "this_month", l: "This month" },
            { v: "next_month", l: "Next month" },
            { v: "this_semester", l: "This semester" },
          ]}
        />
      </div>

      {/* Signed-out prompt (kept lightweight; board still visible below) */}
      {!user && (
        <div className="mb-4 flex items-center justify-between gap-3 rounded-2xl bg-primary/5 p-4 ring-1 ring-primary/20">
          <div className="text-sm">
            <div className="font-bold">Sign in to message roommates</div>
            <div className="text-muted-foreground">Free forever — no paywall on messaging.</div>
          </div>
          <button
            onClick={() => openSignIn("/roommates")}
            className="shrink-0 rounded-full bg-primary px-4 py-2 text-sm font-bold text-primary-foreground hover:bg-primary-dark"
          >Sign in →</button>
        </div>
      )}

      {user && !myRoommate && (
        <div className="mb-4 flex items-center justify-between gap-3 rounded-2xl border border-dashed bg-white p-4 dark:bg-surface">
          <div className="flex items-start gap-3">
            <Sparkles className="mt-0.5 h-5 w-5 shrink-0 text-primary" />
            <div className="text-sm">
              <div className="font-bold">Create your roommate profile</div>
              <div className="text-muted-foreground">Show up on the board so other students can reach out.</div>
            </div>
          </div>
          <Link
            to="/roommates/create"
            className="shrink-0 rounded-full bg-primary px-4 py-2 text-sm font-bold text-primary-foreground hover:bg-primary-dark"
          >Create →</Link>
        </div>
      )}

      {/* Grid */}
      <p className="mb-4 text-sm text-gray-500 dark:text-muted-foreground">
        Private rooms and shared spaces — perfect if you want the social experience of shared living near campus.
      </p>
      {isLoading ? (
        <div className="grid grid-cols-1 gap-4 md:grid-cols-2">
          {Array.from({ length: 4 }).map((_, i) => (
            <div key={i} className="h-52 animate-pulse rounded-2xl bg-white shadow-sm dark:bg-surface" />
          ))}
        </div>
      ) : visible.length === 0 ? (
        <div className="mx-auto max-w-md rounded-2xl bg-white p-10 text-center shadow-sm dark:bg-surface">
          <Users className="mx-auto h-8 w-8 text-muted-foreground" />
          <p className="mt-3 text-sm font-semibold">0 roommate profiles match your filters.</p>
          <p className="mt-1 text-xs text-muted-foreground">Try widening the filters, or check back soon.</p>
        </div>
      ) : (
        <>
          <div className="mb-2 text-xs font-bold uppercase tracking-wider text-muted-foreground">
            {visible.length} {visible.length === 1 ? "profile" : "profiles"}
          </div>
          <div className="grid grid-cols-1 gap-4 md:grid-cols-2">
            {visible.map(p => (
              <RoommateCard key={p.id} p={p} onMessage={() => handleMessage(p)} />
            ))}
          </div>
        </>
      )}
    </div>
  );
}

function ModeTab({ active, onClick, icon, children }: { active: boolean; onClick: () => void; icon: React.ReactNode; children: React.ReactNode }) {
  return (
    <button
      onClick={onClick}
      className={cn(
        "inline-flex min-h-12 items-center justify-center gap-1.5 rounded-full px-4 py-2 text-sm font-bold transition",
        active ? "bg-primary text-primary-foreground shadow-sm" : "text-muted-foreground hover:text-foreground",
      )}

    >{icon}{children}</button>
  );
}

function FilterSelect({ label, value, onChange, options }: {
  label: string; value: string; onChange: (v: string) => void;
  options: { v: string; l: string }[];
}) {
  return (
    <label className="inline-flex items-center gap-2 rounded-full bg-white px-3 py-1.5 text-xs font-semibold shadow-sm ring-1 ring-black/5 dark:bg-surface">
      <span className="text-muted-foreground">{label}</span>
      <select
        value={value}
        onChange={e => onChange(e.target.value)}
        className="bg-transparent text-foreground outline-none"
      >
        {options.map(o => <option key={o.v} value={o.v}>{o.l}</option>)}
      </select>
    </label>
  );
}

function RoommateCard({ p, onMessage }: { p: RoommateProfileWithUser; onMessage: () => void }) {
  const u = p.profile;
  const mode = (p.mode ?? "looking") as RoommateMode;
  const budget = p.budget_min != null && p.budget_max != null
    ? `$${p.budget_min}–$${p.budget_max}/mo`
    : p.budget_max != null ? `Up to $${p.budget_max}/mo`
    : p.budget_min != null ? `From $${p.budget_min}/mo` : "Flexible";
  const move = p.move_in_date
    ? new Date(p.move_in_date).toLocaleDateString(undefined, { month: "short", year: "numeric" })
    : "Flexible";
  const neighborhood = p.areas_preferred?.[0] ?? null;
  const chips = (p.vibe_tags ?? []).slice(0, 3);

  return (
    <article className="flex flex-col rounded-2xl bg-white p-4 shadow-sm ring-1 ring-black/5 transition hover:shadow-md dark:bg-surface">
      <div className="flex items-start gap-3">
        <Avatar name={u?.name ?? null} avatarUrl={u?.avatar_url ?? null} color={u?.banner_color ?? null} />
        <div className="min-w-0 flex-1">
          <div className="flex items-center gap-1.5">
            <div className="truncate text-base font-semibold">{u?.name ?? "A student"}</div>
            {u?.verified_email && (
              <span className="inline-flex items-center gap-0.5 rounded-full bg-emerald-100 px-1.5 py-0.5 text-[10px] font-bold text-emerald-700 dark:bg-emerald-500/15 dark:text-emerald-300">
                <BadgeCheck className="h-3 w-3" />.edu
              </span>
            )}
          </div>
          <div className="mt-0.5 truncate text-xs text-muted-foreground">
            {[u?.year, u?.major].filter(Boolean).join(" · ") || "Student"}
          </div>
          <div className="mt-1.5">
            <span className={cn(
              "inline-flex rounded-full px-2 py-0.5 text-[11px] font-bold",
              mode === "has_room"
                ? "bg-primary/10 text-primary"
                : "bg-orange-100 text-orange-700 dark:bg-orange-500/15 dark:text-orange-300",
            )}>
              {mode === "has_room" ? "Has a room" : "Looking"}
            </span>
          </div>
        </div>
      </div>

      <div className="mt-3 grid grid-cols-2 gap-2 text-sm">
        <div>
          <div className="text-[11px] font-semibold uppercase tracking-wide text-muted-foreground">Budget</div>
          <div className="font-semibold">{budget}</div>
        </div>
        <div>
          <div className="text-[11px] font-semibold uppercase tracking-wide text-muted-foreground">
            {mode === "has_room" ? "Move-in" : "Available from"}
          </div>
          <div className="font-semibold">{move}</div>
        </div>
      </div>

      {neighborhood && (
        <div className="mt-2 text-sm">
          <span className="text-muted-foreground">Neighborhood: </span>
          <span className="font-medium">{neighborhood}</span>
        </div>
      )}

      <div className="mt-3 flex items-end justify-between gap-3">
        <div className="flex min-w-0 flex-wrap gap-1.5">
          {chips.map(t => (
            <span key={t} className="rounded-full bg-gray-100 px-2 py-0.5 text-[11px] font-medium text-foreground/80 dark:bg-background">
              {t}
            </span>
          ))}
        </div>
        <button
          onClick={onMessage}
          className="inline-flex shrink-0 items-center gap-1 rounded-full bg-primary px-3.5 py-2 text-xs font-bold text-primary-foreground shadow-sm hover:bg-primary-dark"
        >
          <MessageCircle className="h-3.5 w-3.5" />
          Message →
        </button>
      </div>
    </article>
  );
}

function Avatar({ name, avatarUrl, color }: { name: string | null; avatarUrl: string | null; color: string | null }) {
  return (
    <UserAvatar
      name={name}
      avatarUrl={avatarUrl}
      color={color}
      className="h-12 w-12 ring-2 ring-white"
      textClassName="text-sm"
    />
  );
}
