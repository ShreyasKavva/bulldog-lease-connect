import { createFileRoute, useNavigate, Link } from "@tanstack/react-router";
import { useQuery } from "@tanstack/react-query";
import { useSession, useMyProfile } from "@/lib/leaseup/use-session";
import { fetchMyListings, fetchSavedListings } from "@/lib/leaseup/queries";
import { fetchCampuses } from "@/lib/leaseup/campuses";
import { TopBar } from "@/components/leaseup/TopBar";
import { BottomNav } from "@/components/leaseup/BottomNav";
import { ProfileSheet } from "@/components/leaseup/ProfileSheet";
import { PostListingDialog } from "@/components/leaseup/PostListingDialog";
import { MessagesSheet } from "@/components/leaseup/MessagesSheet";
import { ListingCard } from "@/components/leaseup/ListingCard";
import { useMemo, useState } from "react";
import { BadgeCheck, Pencil, Settings, LogOut, Heart, Home as HomeIcon, ShieldCheck } from "lucide-react";
import { supabase } from "@/integrations/supabase/client";
import { Button } from "@/components/ui/button";
import { cn } from "@/lib/utils";

export const Route = createFileRoute("/profile")({
  head: () => ({
    meta: [
      { title: "Your profile — LeaseUp" },
      { name: "description", content: "Manage your LeaseUp profile, listings, and saved subleases." },
    ],
  }),
  component: ProfilePage,
});

function ProfilePage() {
  const navigate = useNavigate();
  const { user, loading } = useSession();
  const { data: profile } = useMyProfile();

  const { data: myListings = [] } = useQuery({
    queryKey: ["my-listings", user?.id],
    queryFn: () => fetchMyListings(user!.id),
    enabled: !!user,
  });
  const { data: saved = [] } = useQuery({
    queryKey: ["saved", user?.id],
    queryFn: () => fetchSavedListings(user!.id),
    enabled: !!user,
  });
  const { data: campuses = [] } = useQuery({
    queryKey: ["campuses"],
    queryFn: fetchCampuses,
    staleTime: Infinity,
  });

  const myCampus = useMemo(
    () => campuses.find((c) => c.id === profile?.campus_id),
    [campuses, profile?.campus_id],
  );

  const [editing, setEditing] = useState(false);
  const [posting, setPosting] = useState(false);
  const [messagesOpen, setMessagesOpen] = useState(false);
  const [tab, setTab] = useState<"listings" | "saved">("listings");

  const completion = useMemo(() => {
    if (!profile) return 0;
    const fields = [
      !!profile.name,
      !!profile.year,
      !!profile.major,
      !!profile.bio,
      !!profile.avatar_emoji,
      !!profile.campus_id,
      (profile.vibe_tags?.length ?? 0) > 0,
      !!profile.verified_email,
      !!profile.currently_status,
    ];
    return Math.round((fields.filter(Boolean).length / fields.length) * 100);
  }, [profile]);

  if (loading) return <div className="min-h-screen bg-background" />;
  if (!user) { navigate({ to: "/auth", search: { mode: "in" } }); return null; }

  async function signOut() {
    await supabase.auth.signOut();
    navigate({ to: "/" });
  }

  return (
    <div className="min-h-screen bg-background pb-20">
      <TopBar onOpenMessages={() => setMessagesOpen(true)} />

      <main className="mx-auto max-w-2xl px-4 pt-16">
        {/* Header card */}
        <section className="overflow-hidden rounded-2xl bg-surface shadow-card-md">
          <div className="relative h-28" style={{ background: profile?.banner_color ?? "#2563EB" }}>
            <button
              onClick={() => setEditing(true)}
              className="absolute right-3 top-3 grid h-9 w-9 place-items-center rounded-full bg-white/95 text-foreground shadow"
              aria-label="Edit profile"
            >
              <Pencil className="h-4 w-4" />
            </button>
          </div>
          <div className="px-5 pb-5">
            <div
              className="-mt-10 mb-3 grid h-20 w-20 place-items-center rounded-full text-4xl ring-4 ring-surface"
              style={{ background: profile?.banner_color ?? "#2563EB" }}
            >
              {profile?.avatar_emoji ?? "🙂"}
            </div>
            <div className="flex flex-wrap items-center gap-2">
              <h1 className="text-2xl font-extrabold">{profile?.name || "Add your name"}</h1>
              {profile?.verified_email && (
                <span className="inline-flex items-center gap-1 rounded-full bg-success/10 px-2 py-0.5 text-[11px] font-bold text-success">
                  <BadgeCheck className="h-3 w-3" /> Verified student
                </span>
              )}
            </div>
            <p className="text-sm text-muted-foreground">
              {profile?.year ?? "Add your year"}
              {profile?.major ? ` · ${profile.major}` : ""}
              {myCampus ? ` · ${myCampus.name}` : ""}
            </p>
            {profile?.currently_status && (
              <div className="mt-3 inline-flex max-w-full items-center gap-2 rounded-full bg-primary-light px-3 py-1.5 text-sm font-semibold text-primary-dark">
                <span>{profile.currently_emoji ?? "🔎"}</span>
                <span className="truncate">{profile.currently_status}</span>
              </div>
            )}
            {profile?.bio && <p className="mt-3 text-sm">{profile.bio}</p>}
            {(profile?.vibe_tags?.length ?? 0) > 0 && (
              <div className="mt-3 flex flex-wrap gap-1.5">
                {profile!.vibe_tags!.map((v) => (
                  <span key={v} className="rounded-full bg-primary-light px-3 py-1 text-xs font-semibold text-primary-dark">{v}</span>
                ))}
              </div>
            )}
          </div>
        </section>

        {/* Completion nudge */}
        {completion < 100 && (
          <section className="mt-4 rounded-2xl bg-surface p-4 shadow-card-md">
            <div className="flex items-center justify-between">
              <div>
                <div className="text-sm font-bold">Complete your profile</div>
                <div className="text-xs text-muted-foreground">
                  A complete profile gets {completion < 60 ? "3x" : "2x"} more replies.
                </div>
              </div>
              <div className="text-right">
                <div className="text-2xl font-extrabold text-primary">{completion}%</div>
              </div>
            </div>
            <div className="mt-3 h-2 w-full overflow-hidden rounded-full bg-background">
              <div
                className="h-full rounded-full bg-primary transition-all"
                style={{ width: `${completion}%` }}
              />
            </div>
            <div className="mt-3 flex flex-wrap gap-2 text-[11px]">
              {!profile?.bio && <Chip>Add bio</Chip>}
              {!profile?.year && <Chip>Add year</Chip>}
              {!profile?.major && <Chip>Add major</Chip>}
              {(profile?.vibe_tags?.length ?? 0) === 0 && <Chip>Pick vibe tags</Chip>}
              {!profile?.verified_email && <Chip><ShieldCheck className="mr-1 inline h-3 w-3" />Verify .edu</Chip>}
            </div>
            <Button
              onClick={() => setEditing(true)}
              className="mt-4 w-full bg-primary hover:bg-primary-dark text-primary-foreground font-bold"
            >
              Finish profile
            </Button>
          </section>
        )}

        {/* Quick stats */}
        <section className="mt-4 grid grid-cols-3 gap-2">
          <Stat label="Listings" value={myListings.length} />
          <Stat label="Saved" value={saved.length} />
          <Stat label="SafeScore avg" value={avgScore(myListings)} />
        </section>

        {/* Tabs */}
        <section className="mt-6">
          <div className="flex gap-2 border-b border-border">
            <TabBtn active={tab === "listings"} onClick={() => setTab("listings")}>
              <HomeIcon className="mr-1 inline h-4 w-4" />My listings
            </TabBtn>
            <TabBtn active={tab === "saved"} onClick={() => setTab("saved")}>
              <Heart className="mr-1 inline h-4 w-4" />Saved
            </TabBtn>
          </div>
          <div className="mt-4 grid grid-cols-1 gap-3 sm:grid-cols-2">
            {(tab === "listings" ? myListings : saved).map((l) => (
              <ListingCard
                key={l.id}
                listing={l}
                saved={tab === "saved"}
                onSave={() => {}}
                onOpen={() => navigate({ to: "/", search: { listing: l.id } as any })}
              />
            ))}
            {(tab === "listings" ? myListings : saved).length === 0 && (
              <div className="col-span-full rounded-2xl bg-surface p-8 text-center text-sm text-muted-foreground shadow-card-md">
                {tab === "listings"
                  ? "You haven't posted a listing yet."
                  : "Nothing saved yet — tap the heart on any listing."}
              </div>
            )}
          </div>
        </section>

        {/* Settings row */}
        <section className="mt-6 mb-8 grid grid-cols-2 gap-2">
          <Link
            to="/my-listings"
            className="flex items-center justify-center gap-2 rounded-xl bg-surface px-4 py-3 text-sm font-bold text-foreground shadow-card-md hover:bg-background"
          >
            <Settings className="h-4 w-4" />Manage listings
          </Link>
          <button
            onClick={signOut}
            className="flex items-center justify-center gap-2 rounded-xl bg-surface px-4 py-3 text-sm font-bold text-foreground shadow-card-md hover:bg-background"
          >
            <LogOut className="h-4 w-4" />Sign out
          </button>
        </section>
      </main>

      <BottomNav
        onPost={() => setPosting(true)}
        onChat={() => setMessagesOpen(true)}
        onProfile={() => setEditing(true)}
      />

      <ProfileSheet
        userId={editing ? user.id : null}
        open={editing}
        onOpenChange={(o) => !o && setEditing(false)}
      />
      <PostListingDialog open={posting} onOpenChange={setPosting} />
      <MessagesSheet open={messagesOpen} onOpenChange={setMessagesOpen} initialConversationId={null} />
    </div>
  );
}

function Chip({ children }: { children: React.ReactNode }) {
  return (
    <span className="rounded-full bg-primary-light px-2.5 py-1 font-semibold text-primary-dark">
      {children}
    </span>
  );
}

function Stat({ label, value }: { label: string; value: number | string }) {
  return (
    <div className="rounded-2xl bg-surface p-3 text-center shadow-card-md">
      <div className="text-xl font-extrabold">{value}</div>
      <div className="text-[11px] font-semibold uppercase tracking-wide text-muted-foreground">{label}</div>
    </div>
  );
}

function TabBtn({ active, onClick, children }: { active: boolean; onClick: () => void; children: React.ReactNode }) {
  return (
    <button
      onClick={onClick}
      className={cn(
        "relative px-3 pb-2.5 pt-1.5 text-sm font-bold transition",
        active ? "text-primary" : "text-muted-foreground hover:text-foreground",
      )}
    >
      {children}
      {active && <span className="absolute inset-x-0 -bottom-px h-0.5 rounded-full bg-primary" />}
    </button>
  );
}

function avgScore(listings: { safe_score: number | null }[]) {
  const scored = listings.filter((l) => typeof l.safe_score === "number");
  if (scored.length === 0) return "—";
  return Math.round(scored.reduce((s, l) => s + (l.safe_score ?? 0), 0) / scored.length);
}
