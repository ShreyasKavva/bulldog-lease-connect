/**
 * Roommates — Dating-app style discover feed.
 *
 * Views:
 *   - Discover: full-screen card stack, swipe left = pass, swipe right =
 *     connect. Sorted by compatibility desc. Passed users hidden via
 *     localStorage (no schema churn).
 *   - Matches: list of mutual matches (roommate_interests where
 *     status = 'accepted' involving me).
 *
 * Mutual-match detection: the DB trigger `handle_roommate_interest` runs
 * BEFORE INSERT, so `sendRoommateInterest` returns a row whose `status`
 * is already `'accepted'` when the other user had previously connected.
 * When that happens we show a celebration overlay and surface the
 * auto-created conversation.
 *
 * Auth-gated: anonymous visitors see a "Sign in to start matching" CTA.
 * No card stack until logged in. If no roommate_profile exists, we point
 * the user to /roommates/create (the existing setup flow).
 */
import { createFileRoute, Link, useNavigate } from "@tanstack/react-router";
import { useEffect, useMemo, useRef, useState } from "react";
import { useQuery, useQueryClient } from "@tanstack/react-query";
import { useSession, useMyProfile } from "@/lib/leaseup/use-session";
import {
  fetchMyRoommateProfile,
  fetchRoommateProfiles,
  fetchMyOutgoingInterests,
  fetchMyIncomingInterests,
  sendRoommateInterest,
  computeCompatibility,
  type RoommateProfile,
  type RoommateProfileWithUser,
} from "@/lib/leaseup/roommates";
import { supabase } from "@/integrations/supabase/client";
import { toast } from "sonner";
import { cn } from "@/lib/utils";
import { X, Heart, BadgeCheck, MessageCircle, Users, Sparkles } from "lucide-react";

export const Route = createFileRoute("/roommates")({
  head: () => ({
    meta: [
      { title: "Find a roommate — LeaseUp" },
      { name: "description", content: "Swipe through compatible roommate profiles at your campus and match with students who share your vibe, budget, and schedule." },
    ],
  }),
  component: RoommatesPage,
});

const PASS_KEY = "lu_roommate_passed_v1";
function loadPassed(): Set<string> {
  try { return new Set(JSON.parse(localStorage.getItem(PASS_KEY) ?? "[]")); }
  catch { return new Set(); }
}
function savePassed(ids: Set<string>) {
  try { localStorage.setItem(PASS_KEY, JSON.stringify([...ids])); } catch {}
}

function RoommatesPage() {
  const { user, loading } = useSession();
  const { data: profile } = useMyProfile();

  const [view, setView] = useState<"discover" | "matches">("discover");

  if (loading) return <div className="min-h-[60vh]" />;

  // Signed-out gate
  if (!user) {
    return (
      <div className="mx-auto flex min-h-[70vh] max-w-md flex-col items-center justify-center px-6 text-center">
        <div className="text-5xl">👥</div>
        <h1 className="mt-4 text-2xl font-extrabold">Find your perfect roommate</h1>
        <p className="mt-2 text-sm text-muted-foreground">
          LeaseUp matches you with compatible students at your campus based on
          lifestyle, budget, and vibe.
        </p>
        <Link
          to="/auth"
          search={{ mode: "in", next: "/roommates" }}
          className="mt-6 inline-flex items-center gap-2 rounded-full bg-primary px-6 py-3 text-sm font-bold text-primary-foreground hover:bg-primary-dark"
        >
          Sign in to start matching →
        </Link>
      </div>
    );
  }

  return (
    <div className="mx-auto max-w-md px-4 pb-4 pt-4">
      {/* View toggle */}
      <div className="mb-4 flex gap-2">
        <PillTab active={view === "discover"} onClick={() => setView("discover")}>Discover</PillTab>
        <PillTab active={view === "matches"} onClick={() => setView("matches")}>Matches</PillTab>
      </div>

      {view === "discover"
        ? <DiscoverView userId={user.id} campusId={profile?.campus_id ?? null} />
        : <MatchesView userId={user.id} />}
    </div>
  );
}

function PillTab({ active, onClick, children }: { active: boolean; onClick: () => void; children: React.ReactNode }) {
  return (
    <button
      onClick={onClick}
      className={cn(
        "flex-1 rounded-full px-4 py-2 text-sm font-bold transition",
        active
          ? "bg-foreground text-background shadow-sm"
          : "bg-white text-muted-foreground hover:text-foreground dark:bg-surface",
      )}
    >{children}</button>
  );
}

// -------- DISCOVER --------
function DiscoverView({ userId, campusId }: { userId: string; campusId: string | null }) {
  const qc = useQueryClient();

  const { data: myRoommate, isLoading: loadingMe } = useQuery({
    queryKey: ["my-roommate-profile", userId],
    queryFn: () => fetchMyRoommateProfile(userId),
  });

  const { data: feed = [], isLoading: loadingFeed } = useQuery({
    queryKey: ["roommate-profiles", campusId, userId],
    queryFn: () => fetchRoommateProfiles({ campusId, excludeUserId: userId }),
  });

  const { data: outgoing = [] } = useQuery({
    queryKey: ["roommate-outgoing", userId],
    queryFn: () => fetchMyOutgoingInterests(userId),
  });

  const [passed, setPassed] = useState<Set<string>>(() =>
    typeof window === "undefined" ? new Set<string>() : loadPassed());
  const sentIds = useMemo(() => new Set(outgoing.map(o => o.to_user_id)), [outgoing]);

  const queue = useMemo(() => {
    const list = feed
      .filter(p => !passed.has(p.user_id) && !sentIds.has(p.user_id))
      .map(p => ({ p, score: computeCompatibility(myRoommate ?? null, p).score }))
      .sort((a, b) => b.score - a.score);
    return list;
  }, [feed, myRoommate, passed, sentIds]);

  const [match, setMatch] = useState<{ them: RoommateProfileWithUser; conversationId: string | null } | null>(null);
  const [sending, setSending] = useState(false);

  async function handlePass(target: RoommateProfileWithUser) {
    const next = new Set(passed); next.add(target.user_id); setPassed(next); savePassed(next);
  }

  async function handleConnect(target: RoommateProfileWithUser) {
    if (sending) return;
    setSending(true);
    try {
      const row = await sendRoommateInterest(userId, target.user_id);
      qc.invalidateQueries({ queryKey: ["roommate-outgoing", userId] });
      if (row.status === "accepted") {
        // Look up the auto-created conversation
        const [a, b] = [userId, target.user_id].sort();
        const { data: conv } = await supabase
          .from("conversations")
          .select("id")
          .eq("participant_1_id", a)
          .eq("participant_2_id", b)
          .is("listing_id", null)
          .maybeSingle();
        setMatch({ them: target, conversationId: conv?.id ?? null });
      } else {
        toast.success("Connect request sent!", { description: "You'll know when they swipe back." });
      }
    } catch (e: any) {
      if (String(e?.message ?? "").toLowerCase().includes("duplicate")) {
        toast("Already sent");
      } else {
        toast.error(e?.message ?? "Failed to send");
      }
    } finally {
      setSending(false);
    }
  }

  if (loadingMe || loadingFeed) {
    return <div className="mx-auto mt-8 h-[520px] max-w-sm animate-pulse rounded-3xl bg-white shadow-lg dark:bg-surface" />;
  }

  if (!myRoommate) {
    return (
      <div className="mx-auto mt-6 max-w-sm rounded-3xl border border-dashed bg-white p-8 text-center shadow-sm dark:bg-surface">
        <Sparkles className="mx-auto h-8 w-8 text-primary" />
        <h2 className="mt-3 text-lg font-extrabold">Set up your profile first</h2>
        <p className="mt-1 text-sm text-muted-foreground">
          Tell us your budget and vibe so we can find compatible roommates.
        </p>
        <Link
          to="/roommates/create"
          className="mt-4 inline-flex items-center gap-2 rounded-full bg-primary px-5 py-2.5 text-sm font-bold text-primary-foreground hover:bg-primary-dark"
        >Create your roommate profile →</Link>
      </div>
    );
  }

  if (queue.length === 0) {
    return (
      <div className="mx-auto mt-8 max-w-sm rounded-3xl bg-white p-8 text-center shadow-sm dark:bg-surface">
        <div className="text-4xl">✨</div>
        <h2 className="mt-3 text-lg font-extrabold">You've seen everyone nearby!</h2>
        <p className="mt-1 text-sm text-muted-foreground">
          Check back when more students join.
        </p>
        <button
          onClick={() => { setPassed(new Set()); savePassed(new Set()); }}
          className="mt-4 text-xs font-semibold text-primary hover:underline"
        >Reset passed profiles</button>
      </div>
    );
  }

  const top = queue[0];
  const next = queue[1];

  return (
    <div className="relative">
      <div className="relative mx-auto h-[560px] max-w-sm">
        {next && (
          <div className="absolute inset-0 translate-y-2 scale-[0.97] opacity-70">
            <StaticCardShell target={next.p} score={next.score} />
          </div>
        )}
        <SwipeCard
          key={top.p.id}
          target={top.p}
          score={top.score}
          onPass={handlePass}
          onConnect={handleConnect}
        />
      </div>

      {match && (
        <MatchOverlay
          them={match.them}
          conversationId={match.conversationId}
          onClose={() => setMatch(null)}
        />
      )}
    </div>
  );
}

// -------- CARD --------
function CardBody({ target, score }: { target: RoommateProfileWithUser; score: number }) {
  const u = target.profile;
  const move = target.move_in_date
    ? new Date(target.move_in_date).toLocaleDateString(undefined, { month: "long", year: "numeric" })
    : "Flexible";
  const budget = target.budget_min != null && target.budget_max != null
    ? `$${target.budget_min}–$${target.budget_max}/mo`
    : target.budget_max != null ? `Up to $${target.budget_max}/mo` : "Flexible";
  const sleep = target.lifestyle_night_owl ? "Night owl 🌙"
    : target.lifestyle_early_bird ? "Early bird ☀️" : "Flexible";
  const clean = target.lifestyle_clean != null
    ? (target.lifestyle_clean >= 4 ? "Very clean" : target.lifestyle_clean >= 3 ? "Pretty clean" : "Relaxed")
    : "—";
  const social = target.lifestyle_social ? "Social 🎉" : target.lifestyle_studious ? "Studious 📚" : "—";

  return (
    <div className="flex h-full w-full flex-col overflow-y-auto rounded-3xl bg-white p-6 shadow-lg ring-1 ring-black/5 dark:bg-surface">
      <div className="flex items-start gap-4">
        <div
          className="grid h-[88px] w-[88px] shrink-0 place-items-center rounded-full border-4 border-white text-4xl shadow-md ring-1 ring-black/5"
          style={{ background: u?.banner_color ?? "#2563EB", color: "white" }}
        >
          {u?.avatar_emoji ?? "🙂"}
        </div>
        <div className="min-w-0 flex-1">
          <div className="flex items-center gap-1.5">
            <h2 className="truncate text-xl font-extrabold">{u?.name ?? "A student"}</h2>
            {u?.verified_email && <BadgeCheck className="h-4 w-4 shrink-0 text-primary" />}
          </div>
          {u?.major && <div className="mt-0.5 text-sm text-muted-foreground">{u.major}</div>}
          <div className="mt-0.5 text-xs font-semibold text-muted-foreground">
            {[u?.year].filter(Boolean).join(" · ") || "Student"}
          </div>
        </div>
      </div>

      <hr className="my-4 border-gray-100 dark:border-border" />

      <ul className="space-y-2 text-sm">
        <li className="flex justify-between gap-3"><span className="text-muted-foreground">💰 Budget</span><span className="font-semibold">{budget}</span></li>
        <li className="flex justify-between gap-3"><span className="text-muted-foreground">📅 Move-in</span><span className="font-semibold">{move}</span></li>
        <li className="flex justify-between gap-3"><span className="text-muted-foreground">🌙 Schedule</span><span className="font-semibold">{sleep}</span></li>
        <li className="flex justify-between gap-3"><span className="text-muted-foreground">🧹 Cleanliness</span><span className="font-semibold">{clean}</span></li>
        <li className="flex justify-between gap-3"><span className="text-muted-foreground">🎉 Vibe</span><span className="font-semibold">{social}</span></li>
      </ul>

      {target.vibe_tags.length > 0 && (
        <>
          <hr className="my-4 border-gray-100 dark:border-border" />
          <div className="flex flex-wrap gap-1.5">
            {target.vibe_tags.slice(0, 8).map(t => (
              <span key={t} className="rounded-full bg-gray-100 px-2.5 py-1 text-xs font-semibold text-foreground/80 dark:bg-background">
                {t}
              </span>
            ))}
          </div>
        </>
      )}

      {target.about_me && (
        <>
          <hr className="my-4 border-gray-100 dark:border-border" />
          <p className="text-sm italic text-foreground/80">"{target.about_me}"</p>
        </>
      )}

      <div className="mt-auto pt-4">
        <div className="mb-1 flex items-center justify-between">
          <span className="text-xs font-semibold text-muted-foreground">Compatibility</span>
          <span className="text-sm font-bold text-orange-500">{score}% match</span>
        </div>
        <div className="h-1.5 overflow-hidden rounded-full bg-gray-100 dark:bg-background">
          <div className="h-full rounded-full bg-orange-500 transition-all" style={{ width: `${score}%` }} />
        </div>
      </div>
    </div>
  );
}

function StaticCardShell({ target, score }: { target: RoommateProfileWithUser; score: number }) {
  return <div className="h-full w-full"><CardBody target={target} score={score} /></div>;
}

function SwipeCard({
  target, score, onPass, onConnect,
}: {
  target: RoommateProfileWithUser;
  score: number;
  onPass: (t: RoommateProfileWithUser) => void;
  onConnect: (t: RoommateProfileWithUser) => void;
}) {
  const [drag, setDrag] = useState({ x: 0, y: 0 });
  const [flying, setFlying] = useState<null | "left" | "right">(null);
  const startRef = useRef<{ x: number; y: number } | null>(null);

  function onPointerDown(e: React.PointerEvent) {
    (e.target as HTMLElement).setPointerCapture(e.pointerId);
    startRef.current = { x: e.clientX, y: e.clientY };
  }
  function onPointerMove(e: React.PointerEvent) {
    if (!startRef.current) return;
    setDrag({ x: e.clientX - startRef.current.x, y: e.clientY - startRef.current.y });
  }
  function onPointerUp() {
    startRef.current = null;
    const { x } = drag;
    if (x > 120) fly("right");
    else if (x < -120) fly("left");
    else setDrag({ x: 0, y: 0 });
  }

  function fly(dir: "left" | "right") {
    setFlying(dir);
    setTimeout(() => {
      if (dir === "left") onPass(target); else onConnect(target);
    }, 220);
  }

  const rotate = Math.max(-15, Math.min(15, drag.x / 12));
  const style: React.CSSProperties = flying
    ? { transform: `translate(${flying === "left" ? -600 : 600}px, ${drag.y}px) rotate(${flying === "left" ? -25 : 25}deg)`, transition: "transform 220ms ease-out", opacity: 0 }
    : { transform: `translate(${drag.x}px, ${drag.y}px) rotate(${rotate}deg)`, transition: startRef.current ? "none" : "transform 200ms ease-out" };
  const passOpacity = Math.max(0, Math.min(1, -drag.x / 120));
  const connectOpacity = Math.max(0, Math.min(1, drag.x / 120));

  return (
    <>
      <div
        className="relative h-full w-full touch-none select-none"
        style={style}
        onPointerDown={onPointerDown}
        onPointerMove={onPointerMove}
        onPointerUp={onPointerUp}
        onPointerCancel={onPointerUp}
      >
        <CardBody target={target} score={score} />
        {/* PASS overlay */}
        <div
          className="pointer-events-none absolute inset-0 rounded-3xl bg-red-500/20 transition-opacity"
          style={{ opacity: passOpacity }}
        >
          <div className="absolute left-6 top-6 rounded-lg border-4 border-red-500 px-3 py-1 text-xl font-black uppercase text-red-500" style={{ transform: "rotate(-12deg)" }}>Pass</div>
        </div>
        {/* CONNECT overlay */}
        <div
          className="pointer-events-none absolute inset-0 rounded-3xl bg-green-500/20 transition-opacity"
          style={{ opacity: connectOpacity }}
        >
          <div className="absolute right-6 top-6 rounded-lg border-4 border-green-500 px-3 py-1 text-xl font-black uppercase text-green-500" style={{ transform: "rotate(12deg)" }}>Connect</div>
        </div>
      </div>

      {/* Action buttons under the card */}
      <div className="pointer-events-none absolute inset-x-0 -bottom-4 z-10 flex justify-center gap-6">
        <button
          onClick={() => fly("left")}
          aria-label="Pass"
          className="pointer-events-auto grid h-16 w-16 place-items-center rounded-full border-2 border-gray-200 bg-white text-gray-400 shadow-md transition hover:scale-105 hover:text-gray-600 dark:bg-surface"
        >
          <X className="h-7 w-7" />
        </button>
        <button
          onClick={() => fly("right")}
          aria-label="Connect"
          className="pointer-events-auto grid h-16 w-16 place-items-center rounded-full bg-green-500 text-white shadow-md transition hover:scale-105 hover:bg-green-600"
        >
          <Heart className="h-7 w-7" fill="currentColor" />
        </button>
      </div>
    </>
  );
}

// -------- MATCH OVERLAY --------
function MatchOverlay({
  them, conversationId, onClose,
}: {
  them: RoommateProfileWithUser;
  conversationId: string | null;
  onClose: () => void;
}) {
  const { data: profile } = useMyProfile();
  const navigate = useNavigate();

  return (
    <div className="fixed inset-0 z-[60] grid place-items-center bg-black/60 px-6">
      <div className="w-full max-w-sm rounded-3xl bg-white p-8 text-center shadow-2xl dark:bg-surface">
        <div className="text-4xl">🎉</div>
        <h2 className="mt-2 text-2xl font-extrabold">It's a match!</h2>
        <div className="mt-6 flex items-center justify-center gap-4">
          <div
            className="grid h-16 w-16 place-items-center rounded-full text-2xl ring-4 ring-white"
            style={{ background: profile?.banner_color ?? "#2563EB", color: "white" }}
          >{profile?.avatar_emoji ?? "🙂"}</div>
          <Heart className="h-6 w-6 fill-green-500 text-green-500" />
          <div
            className="grid h-16 w-16 place-items-center rounded-full text-2xl ring-4 ring-white"
            style={{ background: them.profile?.banner_color ?? "#2563EB", color: "white" }}
          >{them.profile?.avatar_emoji ?? "🙂"}</div>
        </div>
        <p className="mt-5 text-sm text-muted-foreground">
          You and {them.profile?.name ?? "they"} both want to connect!
        </p>
        <div className="mt-6 grid gap-2">
          <button
            onClick={() => {
              if (conversationId) navigate({ to: "/", search: { conversation: conversationId } as any });
              else navigate({ to: "/" });
            }}
            className="inline-flex items-center justify-center gap-2 rounded-full bg-primary px-5 py-3 text-sm font-bold text-primary-foreground hover:bg-primary-dark"
          >
            <MessageCircle className="h-4 w-4" /> Send a message
          </button>
          <button
            onClick={onClose}
            className="rounded-full px-5 py-2 text-sm font-semibold text-muted-foreground hover:text-foreground"
          >Keep swiping</button>
        </div>
      </div>
    </div>
  );
}

// -------- MATCHES --------
function MatchesView({ userId }: { userId: string }) {
  const { data: myRoommate } = useQuery({
    queryKey: ["my-roommate-profile", userId],
    queryFn: () => fetchMyRoommateProfile(userId),
  });

  const { data: outgoing = [] } = useQuery({
    queryKey: ["roommate-outgoing", userId],
    queryFn: () => fetchMyOutgoingInterests(userId),
  });
  const { data: incoming = [] } = useQuery({
    queryKey: ["roommate-incoming", userId],
    queryFn: () => fetchMyIncomingInterests(userId),
  });

  const matchedIds = useMemo(() => {
    const set = new Set<string>();
    for (const o of outgoing) if (o.status === "accepted") set.add(o.to_user_id);
    for (const i of incoming) if (i.status === "accepted") set.add(i.from_user_id);
    return [...set];
  }, [outgoing, incoming]);

  const { data: matches = [], isLoading } = useQuery({
    queryKey: ["roommate-matches-details", userId, matchedIds.join(",")],
    enabled: matchedIds.length > 0,
    queryFn: async () => {
      const { data, error } = await supabase
        .from("roommate_profiles" as any)
        .select("*, profile:profiles!roommate_profiles_user_id_fkey(id,name,avatar_emoji,banner_color,year,major,verified_email)")
        .in("user_id", matchedIds);
      if (error) throw error;
      return (data ?? []) as unknown as RoommateProfileWithUser[];
    },
  });

  const [convIds, setConvIds] = useState<Record<string, string>>({});
  useEffect(() => {
    if (matchedIds.length === 0) return;
    (async () => {
      const pairs = matchedIds.map(otherId => {
        const [a, b] = [userId, otherId].sort();
        return { otherId, a, b };
      });
      const out: Record<string, string> = {};
      for (const { otherId, a, b } of pairs) {
        const { data } = await supabase
          .from("conversations")
          .select("id")
          .eq("participant_1_id", a)
          .eq("participant_2_id", b)
          .is("listing_id", null)
          .maybeSingle();
        if (data?.id) out[otherId] = data.id;
      }
      setConvIds(out);
    })();
  }, [matchedIds.join(","), userId]); // eslint-disable-line react-hooks/exhaustive-deps

  if (isLoading) {
    return <div className="h-40 animate-pulse rounded-2xl bg-white shadow-sm dark:bg-surface" />;
  }
  if (matches.length === 0) {
    return (
      <div className="mx-auto mt-8 max-w-sm rounded-3xl bg-white p-8 text-center shadow-sm dark:bg-surface">
        <Users className="mx-auto h-8 w-8 text-muted-foreground" />
        <p className="mt-3 text-sm font-semibold">No matches yet — keep swiping!</p>
        <p className="mt-1 text-xs text-muted-foreground">
          Your matches will appear here when it's mutual.
        </p>
      </div>
    );
  }

  return (
    <div className="space-y-3">
      <div className="text-xs font-bold uppercase tracking-wider text-muted-foreground">
        {matches.length} {matches.length === 1 ? "match" : "matches"}
      </div>
      {matches.map(m => (
        <MatchRow
          key={m.id}
          m={m}
          me={myRoommate ?? null}
          conversationId={convIds[m.user_id] ?? null}
        />
      ))}
    </div>
  );
}

function MatchRow({
  m, me, conversationId,
}: {
  m: RoommateProfileWithUser;
  me: RoommateProfile | null;
  conversationId: string | null;
}) {
  const navigate = useNavigate();
  const { score } = computeCompatibility(me, m);
  return (
    <article className="rounded-2xl bg-white p-4 shadow-sm dark:bg-surface">
      <div className="flex items-start gap-3">
        <div
          className="grid h-12 w-12 shrink-0 place-items-center rounded-full text-xl"
          style={{ background: m.profile?.banner_color ?? "#2563EB", color: "white" }}
        >{m.profile?.avatar_emoji ?? "🙂"}</div>
        <div className="min-w-0 flex-1">
          <div className="flex items-center gap-1.5">
            <div className="truncate font-extrabold">{m.profile?.name ?? "A student"}</div>
            {m.profile?.verified_email && <BadgeCheck className="h-3.5 w-3.5 shrink-0 text-primary" />}
          </div>
          <div className="truncate text-xs text-muted-foreground">
            {[m.profile?.year, m.profile?.major].filter(Boolean).join(" · ") || "Student"}
          </div>
          {m.about_me && (
            <p className="mt-1 line-clamp-1 text-sm italic text-foreground/80">"{m.about_me}"</p>
          )}
          <div className="mt-2 flex items-center gap-2 text-xs">
            <span className="font-bold text-orange-500">{score}% match</span>
          </div>
        </div>
        <button
          onClick={() => {
            if (conversationId) navigate({ to: "/", search: { conversation: conversationId } as any });
            else navigate({ to: "/" });
          }}
          className="inline-flex shrink-0 items-center gap-1 rounded-full bg-primary px-3 py-2 text-xs font-bold text-primary-foreground hover:bg-primary-dark"
        >
          <MessageCircle className="h-3.5 w-3.5" /> Chat
        </button>
      </div>
    </article>
  );
}
