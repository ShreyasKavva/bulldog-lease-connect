/**
 * /onboarding — 3-screen new-user setup.
 *
 *   1. Pick your campus (required — writes profiles.campus_id)
 *   2. What are you here for? (required — writes profiles.intent)
 *          find     → /sublease/[campus-slug]
 *          post     → /post (opens home with ?post=1)
 *          roommate → /roommates
 *   3. Quick profile (name/year/major/avatar — all skippable)
 *
 * Completion sets profiles.onboarding_completed=true, inserts a welcome
 * notification, then routes the user based on their chosen intent.
 * Users whose profile is already onboarded bounce straight to home.
 */
import { createFileRoute, useNavigate } from "@tanstack/react-router";
import { useEffect, useMemo, useState } from "react";
import { useQuery, useQueryClient } from "@tanstack/react-query";
import { supabase } from "@/integrations/supabase/client";
import { useSession, useMyProfile } from "@/lib/leaseup/use-session";
import { fetchCampuses, type Campus } from "@/lib/leaseup/campuses";
import { YEARS } from "@/lib/leaseup/constants";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Search as SearchIcon, ArrowRight, Check } from "lucide-react";
import { cn } from "@/lib/utils";
import { toast } from "sonner";

type Intent = "find" | "post" | "roommate";

const POPULAR_SLUGS = [
  { slug: "university-of-georgia", emoji: "🐾", short: "UGA" },
  { slug: "university-of-florida", emoji: "🐊", short: "UF" },
  { slug: "university-of-alabama", emoji: "🐘", short: "Alabama" },
  { slug: "auburn-university", emoji: "🐯", short: "Auburn" },
  { slug: "georgia-tech", emoji: "🐝", short: "GT" },
];

const AVATARS = ["🐶", "🐱", "🦊", "🐻", "🐼", "🦁", "🐸", "🐧", "🦋", "🌊", "🔥", "⚡"];

export const Route = createFileRoute("/onboarding")({
  head: () => ({
    meta: [
      { title: "Welcome to LeaseUp" },
      { name: "description", content: "Set up your LeaseUp profile in 30 seconds." },
      { name: "robots", content: "noindex" },
    ],
  }),
  component: Onboarding,
});

function Onboarding() {
  const navigate = useNavigate();
  const { user, loading } = useSession();
  const profileQuery = useMyProfile();
  const { data: profile, isError: profileFailed, isFetching: profileFetching } = profileQuery;
  const qc = useQueryClient();

  const [step, setStep] = useState<1 | 2 | 3>(1);
  const [campusId, setCampusId] = useState<string | null>(null);
  const [intent, setIntent] = useState<Intent | null>(null);
  const [name, setName] = useState("");
  const [year, setYear] = useState("");
  const [major, setMajor] = useState("");
  const [avatar, setAvatar] = useState<string>(AVATARS[0]);
  const [search, setSearch] = useState("");
  const [saving, setSaving] = useState(false);

  const { data: campuses = [] } = useQuery({
    queryKey: ["campuses"],
    queryFn: fetchCampuses,
    staleTime: Infinity,
  });

  // Redirect if signed out or already onboarded.
  useEffect(() => {
    if (!loading && !user) navigate({ to: "/auth", search: { mode: "up" } });
  }, [loading, user, navigate]);
  useEffect(() => {
    if (profile?.onboarding_completed) navigate({ to: "/" });
  }, [profile?.onboarding_completed, navigate]);

  // Pre-fill from existing profile / user metadata.
  useEffect(() => {
    if (!profile) return;
    if (profile.campus_id) setCampusId(profile.campus_id);
    if (profile.name) setName(profile.name);
    if (profile.year) setYear(profile.year);
    if (profile.major) setMajor(profile.major);
    if (profile.avatar_emoji && AVATARS.includes(profile.avatar_emoji)) setAvatar(profile.avatar_emoji);
    // Map legacy values to new set.
    const legacy = profile.intent as string | null | undefined;
    if (legacy === "listing") setIntent("post");
    else if (legacy === "looking") setIntent("find");
    else if (legacy === "find" || legacy === "post" || legacy === "roommate") setIntent(legacy);
  }, [profile?.id]); // eslint-disable-line react-hooks/exhaustive-deps

  // Pre-select campus from a /sublease/:slug visit hint (viral GroupMe link → auto-campus).
  useEffect(() => {
    if (campusId || campuses.length === 0) return;
    let hint: string | null = null;
    try { hint = localStorage.getItem("leaseup_campus_hint"); } catch {}
    if (!hint) return;
    const match = campuses.find((c: any) => c.slug === hint);
    if (match) setCampusId(match.id);
  }, [campuses, campusId]);


  // Google users get a name in user_metadata; fall back to that.
  useEffect(() => {
    if (name || !user) return;
    const meta = (user.user_metadata ?? {}) as Record<string, unknown>;
    const guess = (meta.full_name as string) || (meta.name as string) || "";
    if (guess) setName(guess);
  }, [user, name]);

  const popularCampuses = useMemo(() => {
    const bySlug = new Map(campuses.map((c) => [c.slug, c]));
    return POPULAR_SLUGS
      .map((p) => ({ ...p, campus: bySlug.get(p.slug) }))
      .filter((p): p is typeof p & { campus: Campus } => Boolean(p.campus));
  }, [campuses]);

  const filteredCampuses = useMemo(() => {
    const q = search.trim().toLowerCase();
    if (!q) return [];
    return campuses
      .filter((c) => c.name.toLowerCase().includes(q) || c.short_name.toLowerCase().includes(q) || c.city.toLowerCase().includes(q))
      .slice(0, 8);
  }, [campuses, search]);

  if (loading || profileFetching || !user) {
    return <div className="min-h-screen grid place-items-center text-sm text-muted-foreground">Loading…</div>;
  }
  if (profileFailed || !profile) {
    return (
      <div className="min-h-screen grid place-items-center bg-background px-5 text-center">
        <div className="max-w-sm">
          <h1 className="text-2xl font-black">LeaseUp</h1>
          <p className="mt-3 text-sm text-muted-foreground">We couldn&apos;t load your profile. Please try again.</p>
          <Button onClick={() => profileQuery.refetch()} className="mt-6 bg-primary text-primary-foreground">Try again</Button>
        </div>
      </div>
    );
  }

  async function saveCampus() {
    if (!campusId || !user) return;
    setSaving(true);
    try {
      const { error } = await supabase.from("profiles").update({ campus_id: campusId }).eq("id", user.id);
      if (error) throw error;
      qc.invalidateQueries({ queryKey: ["profile", user.id] });
      setStep(2);
    } catch (e) {
      toast.error(e instanceof Error ? e.message : "Could not save campus");
    } finally { setSaving(false); }
  }

  async function saveIntent() {
    if (!intent || !user) return;
    setSaving(true);
    try {
      const { error } = await supabase.from("profiles").update({ intent }).eq("id", user.id);
      if (error) throw error;
      qc.invalidateQueries({ queryKey: ["profile", user.id] });
      setStep(3);
    } catch (e) {
      toast.error(e instanceof Error ? e.message : "Could not save");
    } finally { setSaving(false); }
  }

  async function finish(skip: boolean) {
    if (!user || !intent) return;
    setSaving(true);
    try {
      const patch: {
        onboarding_completed: boolean;
        name?: string;
        year?: string;
        major?: string;
        avatar_emoji?: string;
      } = { onboarding_completed: true };
      if (!skip) {
        if (name.trim()) patch.name = name.trim();
        if (year) patch.year = year;
        if (major.trim()) patch.major = major.trim();
        patch.avatar_emoji = avatar;
      }
      const { error } = await supabase.from("profiles").update(patch).eq("id", user.id);
      if (error) throw error;

      // Welcome notification — best effort, don't block finish on failure.
      try {
        await supabase.from("notifications").insert({
          user_id: user.id,
          type: "welcome",
          title: "Welcome to LeaseUp! 🎉",
          body: "You're all set. Browse listings, post your sublease, or find a roommate — all for free.",
        });
      } catch { /* ignore */ }

      qc.invalidateQueries({ queryKey: ["profile", user.id] });

      // Where to send them based on intent.
      const campus = campuses.find((c) => c.id === campusId);
      let nextPath = "/";
      if (intent === "find" && campus) nextPath = `/sublease/${campus.slug}`;
      else if (intent === "post") nextPath = "/?post=1";
      else if (intent === "roommate") nextPath = "/roommates";

      // Honor a stored post-onboarding redirect if the user meant to reach a specific page.
      let storedNext: string | null = null;
      try { storedNext = sessionStorage.getItem("lu_post_onboarding_next"); } catch {}
      try { sessionStorage.removeItem("lu_post_onboarding_next"); } catch {}
      if (storedNext && storedNext !== "/" && storedNext.startsWith("/")) nextPath = storedNext;

      window.location.assign(nextPath);
    } catch (e) {
      toast.error(e instanceof Error ? e.message : "Could not finish setup");
      setSaving(false);
    }
  }

  // -------------- Screen 1 · Campus --------------
  if (step === 1) {
    return (
      <Shell step={1}>
        <h1 className="text-2xl font-black">Welcome to LeaseUp 🎉</h1>
        <p className="mt-1 text-sm text-muted-foreground">First, which campus are you at?</p>

        <div className="mt-5 relative">
          <SearchIcon className="absolute left-3 top-1/2 -translate-y-1/2 h-4 w-4 text-muted-foreground" />
          <Input
            value={search}
            onChange={(e) => setSearch(e.target.value)}
            placeholder="Search campuses…"
            className="pl-9"
          />
        </div>

        {filteredCampuses.length > 0 && (
          <div className="mt-3 rounded-xl border border-border bg-surface divide-y divide-border overflow-hidden">
            {filteredCampuses.map((c) => (
              <button
                key={c.id}
                onClick={() => { setCampusId(c.id); setSearch(""); }}
                className={cn(
                  "w-full text-left px-3 py-2.5 text-sm flex items-center justify-between hover:bg-background",
                  campusId === c.id && "bg-primary-light",
                )}
              >
                <div>
                  <div className="font-semibold text-foreground">{c.name}</div>
                  <div className="text-xs text-muted-foreground">{c.city}, {c.state}</div>
                </div>
                {campusId === c.id && <Check className="h-4 w-4 text-primary" />}
              </button>
            ))}
          </div>
        )}

        <div className="mt-6">
          <div className="text-[11px] font-bold uppercase tracking-wide text-muted-foreground mb-2">Popular</div>
          <div className="flex flex-wrap gap-2">
            {popularCampuses.map((p) => (
              <button
                key={p.campus.id}
                onClick={() => setCampusId(p.campus.id)}
                className={cn(
                  "inline-flex items-center gap-1.5 rounded-full border px-3 py-1.5 text-sm font-semibold transition-colors",
                  campusId === p.campus.id
                    ? "bg-primary border-primary text-primary-foreground"
                    : "bg-surface border-border text-foreground hover:border-primary/40",
                )}
              >
                <span>{p.emoji}</span>{p.short}
              </button>
            ))}
          </div>
          {campusId && !popularCampuses.some((p) => p.campus.id === campusId) && (
            <div className="mt-3 text-xs text-muted-foreground">
              Selected: <span className="font-semibold text-foreground">
                {campuses.find((c) => c.id === campusId)?.name}
              </span>
            </div>
          )}
        </div>

        <div className="mt-8">
          <Button
            onClick={saveCampus}
            disabled={!campusId || saving}
            className="w-full bg-primary hover:bg-primary-dark text-primary-foreground font-bold h-12"
          >
            Continue <ArrowRight className="ml-1 h-4 w-4" />
          </Button>
        </div>
      </Shell>
    );
  }

  // -------------- Screen 2 · Intent --------------
  if (step === 2) {
    return (
      <Shell step={2}>
        <h1 className="text-2xl font-black">What brings you to LeaseUp?</h1>

        <div className="mt-5 space-y-3">
          <IntentCard
            icon="🏠"
            title="I need to find a sublease"
            sub="Browse listings at my campus"
            selected={intent === "find"}
            onClick={() => setIntent("find")}
          />
          <IntentCard
            icon="📋"
            title="I have a sublease to post"
            sub="List my place for free"
            selected={intent === "post"}
            onClick={() => setIntent("post")}
          />
          <IntentCard
            icon="👥"
            title="I'm looking for a roommate"
            sub="Match with compatible students"
            selected={intent === "roommate"}
            onClick={() => setIntent("roommate")}
          />
        </div>

        <div className="mt-8">
          <Button
            onClick={saveIntent}
            disabled={!intent || saving}
            className="w-full bg-primary hover:bg-primary-dark text-primary-foreground font-bold h-12"
          >
            Continue <ArrowRight className="ml-1 h-4 w-4" />
          </Button>
        </div>
      </Shell>
    );
  }

  // -------------- Screen 3 · Quick profile --------------
  return (
    <Shell step={3}>
      <h1 className="text-2xl font-black">Almost done — set up your profile</h1>
      <p className="mt-1 text-sm text-muted-foreground">Takes about 30 seconds.</p>

      <div className="mt-5">
        <Label>Photo (optional)</Label>
        <div className="mt-2 grid grid-cols-6 gap-2">
          {AVATARS.map((e) => (
            <button
              key={e}
              onClick={() => setAvatar(e)}
              className={cn(
                "aspect-square rounded-full grid place-items-center text-2xl bg-background transition-all",
                avatar === e ? "ring-2 ring-primary ring-offset-2 ring-offset-surface scale-105" : "hover:bg-muted",
              )}
            >{e}</button>
          ))}
        </div>
      </div>

      <div className="mt-5">
        <Label>Name</Label>
        <Input value={name} onChange={(e) => setName(e.target.value)} placeholder="Your name" />
      </div>

      <div className="mt-5">
        <Label>Year</Label>
        <div className="mt-2 flex flex-wrap gap-1.5">
          {YEARS.map((y) => (
            <button
              key={y}
              onClick={() => setYear(year === y ? "" : y)}
              className={cn(
                "rounded-full border px-3 py-1.5 text-xs font-bold transition-colors",
                year === y
                  ? "bg-primary border-primary text-primary-foreground"
                  : "bg-surface border-border text-foreground hover:border-primary/40",
              )}
            >{y}</button>
          ))}
        </div>
      </div>

      <div className="mt-5">
        <Label>Major</Label>
        <Input value={major} onChange={(e) => setMajor(e.target.value)} placeholder="e.g. Business, CS, Nursing" />
      </div>

      <div className="mt-7 space-y-2">
        <Button
          onClick={() => finish(false)}
          disabled={saving}
          className="w-full bg-primary hover:bg-primary-dark text-primary-foreground font-bold h-12"
        >
          {saving ? "Saving…" : <>Let&apos;s go <ArrowRight className="ml-1 h-4 w-4" /></>}
        </Button>
        <button
          onClick={() => finish(true)}
          disabled={saving}
          className="block w-full text-center text-xs font-semibold text-muted-foreground hover:text-foreground py-2"
        >
          Skip for now →
        </button>
      </div>
    </Shell>
  );
}

// ---------- presentational helpers ----------
function Shell({ children, step }: { children: React.ReactNode; step: 1 | 2 | 3 }) {
  return (
    <div className="min-h-[100dvh] bg-background flex flex-col">
      <header className="px-5 pt-5 pb-3 flex items-center justify-between">
        <div className="text-lg font-black tracking-tight">
          <span className="text-primary">Lease</span>Up
        </div>
        <div className="flex items-center gap-1">
          {[1, 2, 3].map((i) => (
            <div key={i} className={cn("h-1.5 w-6 rounded-full transition-colors", i <= step ? "bg-primary" : "bg-border")} />
          ))}
        </div>
      </header>
      <main className="flex-1 px-5 pb-10 max-w-md mx-auto w-full">
        {children}
      </main>
    </div>
  );
}

function IntentCard({
  icon, title, sub, selected, onClick,
}: { icon: string; title: string; sub: string; selected: boolean; onClick: () => void }) {
  return (
    <button
      onClick={onClick}
      className={cn(
        "w-full text-left rounded-2xl border p-4 flex items-start gap-3 transition-all",
        selected
          ? "border-primary bg-primary-light shadow-card-md"
          : "border-border bg-surface hover:border-primary/40",
      )}
    >
      <div className="text-2xl leading-none">{icon}</div>
      <div className="flex-1">
        <div className="font-bold text-foreground">{title}</div>
        <div className="text-xs text-muted-foreground mt-0.5">{sub}</div>
      </div>
      {selected && <Check className="h-5 w-5 text-primary" />}
    </button>
  );
}
