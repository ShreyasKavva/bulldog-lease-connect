import { createFileRoute, useNavigate, Link } from "@tanstack/react-router";
import { useEffect, useState } from "react";
import { useQuery } from "@tanstack/react-query";
import { useSession, useMyProfile } from "@/lib/leaseup/use-session";
import { fetchCampuses } from "@/lib/leaseup/campuses";
import { fetchCampusOverview, fetchCampusLeaderboard } from "@/lib/leaseup/referral.queries";
import { TopBar } from "@/components/leaseup/TopBar";
import { BottomNav } from "@/components/leaseup/BottomNav";
import { PostListingDialog } from "@/components/leaseup/PostListingDialog";
import { MessagesSheet } from "@/components/leaseup/MessagesSheet";
import { ProfileSheet } from "@/components/leaseup/ProfileSheet";
import { Sparkles, Copy, Check, Trophy } from "lucide-react";

export const Route = createFileRoute("/ambassador")({
  head: () => ({
    meta: [
      { title: "Ambassador dashboard — LeaseUp" },
      { name: "robots", content: "noindex" },
    ],
  }),
  component: AmbassadorPage,
});

function AmbassadorPage() {
  const navigate = useNavigate();
  const { user, loading } = useSession();
  const { data: profile, isLoading: profileLoading } = useMyProfile();
  const [posting, setPosting] = useState(false);
  const [messagesOpen, setMessagesOpen] = useState(false);
  const [editing, setEditing] = useState(false);

  useEffect(() => {
    if (loading || profileLoading) return;
    if (!user) { navigate({ to: "/auth", search: { mode: "in" } }); return; }
    if (profile && !(profile as any).is_ambassador) { navigate({ to: "/" }); return; }
  }, [loading, profileLoading, user, profile, navigate]);

  const campusId = profile?.campus_id ?? null;

  const { data: campuses = [] } = useQuery({ queryKey: ["campuses"], queryFn: fetchCampuses, staleTime: Infinity });
  const campus = campuses.find((c) => c.id === campusId);

  const { data: overview } = useQuery({
    queryKey: ["ambassador-overview", user?.id, campusId],
    queryFn: () => fetchCampusOverview(user!.id, campusId!),
    enabled: !!user?.id && !!campusId,
  });

  const { data: leaderboard = [] } = useQuery({
    queryKey: ["ambassador-leaderboard", campusId, user?.id],
    queryFn: () => fetchCampusLeaderboard(campusId!, user!.id),
    enabled: !!campusId && !!user?.id,
  });

  if (loading || profileLoading || !user || !profile || !(profile as any).is_ambassador) {
    return <div className="min-h-screen bg-background" />;
  }

  return (
    <div className="min-h-screen bg-background pb-24">
      <TopBar onOpenMessages={() => setMessagesOpen(true)} />
      <main className="mx-auto max-w-3xl px-4 pt-16">
        <header className="flex items-center gap-2">
          <Sparkles className="h-5 w-5 text-primary" />
          <h1 className="text-2xl font-black">Ambassador</h1>
          <span className="ml-2 rounded-full bg-primary-light px-2 py-0.5 text-[11px] font-bold text-primary-dark">
            {campus?.name ?? "Your campus"}
          </span>
        </header>
        <p className="mt-1 text-sm text-muted-foreground">
          Track how LeaseUp is performing at your school and grow your community.
        </p>

        {/* Overview */}
        <section className="mt-5 grid grid-cols-2 gap-2 sm:grid-cols-4">
          <Stat label="Active listings" value={overview?.activeListings ?? 0} />
          <Stat label="New this week" value={overview?.newThisWeek ?? 0} />
          <Stat label="Students" value={overview?.studentCount ?? 0} />
          <Stat label="Your referrals" value={overview?.myReferrals ?? 0} highlight />
        </section>

        {/* Quick post */}
        <button
          onClick={() => setPosting(true)}
          className="mt-5 block w-full rounded-2xl bg-primary px-5 py-4 text-center text-base font-extrabold text-primary-foreground shadow-card-md hover:bg-primary-dark"
        >
          Post a Listing for Your Campus →
        </button>

        {/* Leaderboard */}
        <section className="mt-6 rounded-2xl bg-surface p-4 shadow-card-md">
          <h2 className="inline-flex items-center gap-2 text-sm font-bold">
            <Trophy className="h-4 w-4 text-primary" />
            Top referrers at {campus?.name ?? "your campus"}
          </h2>
          <ol className="mt-3 space-y-2">
            {leaderboard.length === 0 && (
              <li className="text-sm text-muted-foreground">No referrals yet — be the first.</li>
            )}
            {leaderboard.map((e, i) => (
              <li key={e.user_id} className="flex items-center gap-3 rounded-xl bg-background px-3 py-2">
                <span className="w-6 text-sm font-extrabold text-muted-foreground">#{i + 1}</span>
                <div className="grid h-8 w-8 place-items-center rounded-full text-base" style={{ background: e.banner_color ?? "#2563EB" }}>
                  {e.avatar_emoji ?? "🙂"}
                </div>
                <div className="flex-1 truncate text-sm font-semibold">
                  {e.is_me ? "You" : (e.name ?? "A student")}
                </div>
                <div className="rounded-full bg-primary-light px-2.5 py-0.5 text-xs font-bold text-primary-dark">
                  {e.referral_count} {e.referral_count === 1 ? "ref" : "refs"}
                </div>
              </li>
            ))}
          </ol>
        </section>

        {/* Captions */}
        <section className="mt-6 space-y-3">
          <h2 className="text-sm font-bold">Pre-written captions</h2>
          {CAPTIONS.map((c, i) => (
            <CaptionCard key={i} {...c} />
          ))}
        </section>

        <div className="mt-6 text-center">
          <Link to="/profile" className="text-xs text-muted-foreground hover:text-foreground">← Back to profile</Link>
        </div>
      </main>

      <BottomNav
        onPost={() => setPosting(true)}
        onChat={() => setMessagesOpen(true)}
        onProfile={() => setEditing(true)}
      />
      <PostListingDialog open={posting} onOpenChange={setPosting} />
      <MessagesSheet open={messagesOpen} onOpenChange={setMessagesOpen} initialConversationId={null} />
      <ProfileSheet userId={editing ? user.id : null} open={editing} onOpenChange={(o) => !o && setEditing(false)} />
    </div>
  );
}

function Stat({ label, value, highlight }: { label: string; value: number; highlight?: boolean }) {
  return (
    <div className={`rounded-2xl p-3 text-center shadow-card-md ${highlight ? "bg-primary text-primary-foreground" : "bg-surface"}`}>
      <div className="text-2xl font-extrabold">{value}</div>
      <div className={`text-[11px] font-semibold uppercase tracking-wide ${highlight ? "text-primary-foreground/80" : "text-muted-foreground"}`}>{label}</div>
    </div>
  );
}

const CAPTIONS: { label: string; text: string }[] = [
  {
    label: "📣 GroupMe",
    text: "Anyone subleasing this semester? Post it on LeaseUp — free, verified students only. leasup.co",
  },
  {
    label: "📣 Instagram Story",
    text: "This app for student subleases is actually good. leasup.co 👇",
  },
  {
    label: "📣 Reddit",
    text: "Built a legit sublease marketplace — leasup.co. Verified students, AI lease analysis, free to post.",
  },
];

function CaptionCard({ label, text }: { label: string; text: string }) {
  const [copied, setCopied] = useState(false);
  function copy() {
    navigator.clipboard.writeText(text).then(() => {
      setCopied(true);
      setTimeout(() => setCopied(false), 2000);
    }).catch(() => {});
  }
  return (
    <div className="rounded-2xl bg-surface p-4 shadow-card-md">
      <div className="flex items-center justify-between">
        <div className="text-xs font-bold uppercase tracking-wide text-muted-foreground">{label}</div>
        <button
          onClick={copy}
          className="inline-flex items-center gap-1.5 rounded-full bg-primary-light px-3 py-1 text-xs font-bold text-primary-dark hover:bg-primary/20"
        >
          {copied ? <><Check className="h-3 w-3" />Copied!</> : <><Copy className="h-3 w-3" />Copy</>}
        </button>
      </div>
      <p className="mt-2 text-sm">{text}</p>
    </div>
  );
}
