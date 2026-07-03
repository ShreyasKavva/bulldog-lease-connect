import { createFileRoute, useNavigate, Link } from "@tanstack/react-router";
import { useEffect, useMemo, useRef, useState } from "react";
import { supabase } from "@/integrations/supabase/client";
import { useSession, useMyProfile } from "@/lib/leaseup/use-session";
import { useQueryClient } from "@tanstack/react-query";
import { VIBE_TAGS, YEARS } from "@/lib/leaseup/constants";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { ShieldCheck, Home, Search as SearchIcon, Check, ArrowRight } from "lucide-react";
import { cn } from "@/lib/utils";
import { toast } from "sonner";

export const Route = createFileRoute("/onboarding")({
  head: () => ({ meta: [{ title: "Welcome to LeaseUp" }] }),
  component: Onboarding,
});

// Per spec — onboarding avatars are distinct from the broader app palette.
const ONBOARD_AVATARS = ["🐶", "🐱", "🦊", "🐻", "🐼", "🦁", "🐸", "🐧", "🦋", "🌊", "🔥", "⚡"];

// The 12 vibe options to render in a 4x3 grid.
type VibeOpt = { emoji: string; label: string; tag: string };
const VIBE_GRID: VibeOpt[] = VIBE_TAGS.map((t) => {
  const [emoji, ...rest] = t.split(" ");
  return { emoji, label: rest.join(" "), tag: t };
});

function firstName(profile: { name?: string | null; email?: string | null } | null | undefined) {
  if (!profile) return "there";
  const n = (profile.name ?? "").trim();
  if (n) return n.split(/\s+/)[0];
  return (profile.email ?? "").split("@")[0] || "there";
}

function Onboarding() {
  const navigate = useNavigate();
  const { user, loading } = useSession();
  const profileQuery = useMyProfile();
  const { data: profile, error: profileError, isError: profileFailed, isFetching: profileFetching } = profileQuery;
  const qc = useQueryClient();

  // Returning users (created > 1 hour ago) with onboarding_completed=false get the
  // simplified flow (vibes + profile setup only — screens 3 & 4).
  const isReturning = useMemo(() => {
    if (!profile?.created_at) return false;
    return Date.now() - new Date(profile.created_at).getTime() > 60 * 60 * 1000;
  }, [profile?.created_at]);

  // Step model: full flow uses 1..5; simplified starts at 3 and skips 5.
  const [step, setStep] = useState<number>(1);
  useEffect(() => {
    if (profile) setStep(isReturning ? 3 : 1);
  }, [isReturning, profile?.id]); // eslint-disable-line react-hooks/exhaustive-deps

  // Screen 2 — intent
  const [intent, setIntent] = useState<"listing" | "looking" | null>(null);
  // Screen 3 — vibes
  const [vibes, setVibes] = useState<string[]>([]);
  const [shake, setShake] = useState(false);
  // Screen 4 — profile fields
  const [avatar, setAvatar] = useState(ONBOARD_AVATARS[0]);
  const [year, setYear] = useState<string>("");
  const [bio, setBio] = useState("");
  const [saving, setSaving] = useState(false);

  // Pre-fill from existing profile when re-entering
  useEffect(() => {
    if (!profile) return;
    if (profile.vibe_tags?.length) setVibes(profile.vibe_tags.slice(0, 3));
    if (profile.avatar_emoji && ONBOARD_AVATARS.includes(profile.avatar_emoji)) {
      setAvatar(profile.avatar_emoji);
    }
    if (profile.year) setYear(profile.year);
    if (profile.bio) setBio(profile.bio.slice(0, 120));
    if (profile.intent) setIntent(profile.intent);
  }, [profile?.id]); // eslint-disable-line react-hooks/exhaustive-deps

  // Auto-advance from welcome (screen 1) after 2.5s
  const advancedRef = useRef(false);
  useEffect(() => {
    if (step !== 1 || advancedRef.current) return;
    advancedRef.current = true;
    const t = setTimeout(() => setStep(2), 2500);
    return () => clearTimeout(t);
  }, [step]);

  useEffect(() => {
    if (!loading && !user) navigate({ to: "/auth", search: { mode: "up" } });
  }, [loading, user, navigate]);

  // If onboarding is already done, bounce home.
  useEffect(() => {
    if (profile?.onboarding_completed) navigate({ to: "/" });
  }, [profile?.onboarding_completed, navigate]);

  if (!loading && user && profileFailed) {
    return (
      <div className="min-h-screen grid place-items-center bg-background px-5 text-center">
        <div className="max-w-sm">
          <h1 className="text-2xl font-black">LeaseUp</h1>
          <p className="mt-3 text-sm text-muted-foreground">
            We couldn&apos;t load your profile. Please try again.
          </p>
          <Button onClick={() => profileQuery.refetch()} className="mt-6 bg-primary text-primary-foreground hover:bg-primary-dark">
            Try again
          </Button>
          {profileError instanceof Error && (
            <p className="mt-3 text-xs text-muted-foreground">{profileError.message}</p>
          )}
        </div>
      </div>
    );
  }

  if (!loading && user && !profile && !profileFetching) {
    return (
      <div className="min-h-screen grid place-items-center bg-background px-5 text-center">
        <div className="max-w-sm">
          <h1 className="text-2xl font-black">LeaseUp</h1>
          <p className="mt-3 text-sm text-muted-foreground">
            Your account is signed in, but the profile setup record is missing.
          </p>
          <Button onClick={() => profileQuery.refetch()} className="mt-6 bg-primary text-primary-foreground hover:bg-primary-dark">
            Refresh
          </Button>
        </div>
      </div>
    );
  }

  if (loading || !user || !profile) {
    return (
      <div className="min-h-screen grid place-items-center bg-background text-sm text-muted-foreground">
        Loading…
      </div>
    );
  }

  function toggleVibe(tag: string) {
    setVibes((cur) => {
      if (cur.includes(tag)) return cur.filter((t) => t !== tag);
      if (cur.length >= 3) {
        setShake(true);
        setTimeout(() => setShake(false), 400);
        toast("Pick up to 3 ✨", { duration: 1500 });
        return cur;
      }
      return [...cur, tag];
    });
  }

  async function saveIntent() {
    if (!intent) return;
    await supabase.from("profiles").update({ intent }).eq("id", user!.id);
    qc.invalidateQueries({ queryKey: ["profile", user!.id] });
    setStep(3);
  }

  async function saveVibesAndAdvance() {
    await supabase.from("profiles").update({ vibe_tags: vibes }).eq("id", user!.id);
    qc.invalidateQueries({ queryKey: ["profile", user!.id] });
    setStep(4);
  }

  async function finishSetup(skip = false) {
    if (!user) return;
    setSaving(true);
    try {
      const patch: {
        onboarding_completed: boolean;
        vibe_tags: string[];
        avatar_emoji?: string;
        year?: string;
        bio?: string;
      } = {
        onboarding_completed: true,
        vibe_tags: vibes,
      };
      if (!skip) {
        patch.avatar_emoji = avatar;
        if (year) patch.year = year;
        if (bio.trim()) patch.bio = bio.trim().slice(0, 120);
      }
      const { error } = await supabase.from("profiles").update(patch).eq("id", user.id);
      if (error) throw error;
      qc.invalidateQueries({ queryKey: ["profile", user.id] });
      if (isReturning) {
        // Simplified flow: straight back home
        navigate({ to: "/" });
      } else {
        setStep(5);
      }
    } catch (e: unknown) {
      const msg = e instanceof Error ? e.message : "Could not save";
      toast.error(msg);
    } finally {
      setSaving(false);
    }
  }

  const name = firstName(profile);
  const verified = !!profile.verified_email;

  // ============ Screen 1 — Welcome ============
  if (step === 1) {
    return (
      <div className="min-h-[100dvh] bg-gradient-to-b from-[#2563EB] to-[#1D4ED8] text-white flex flex-col items-center justify-center p-6">
        <div className="text-[32px] font-black tracking-tight">LeaseUp</div>
        <div className="mt-8 lu-spring-in text-8xl" aria-hidden>🏠</div>
        <h1 className="mt-10 text-center text-3xl font-extrabold">
          Welcome to LeaseUp, {name} 👋
        </h1>
        <p className="mt-3 text-center text-white/85">
          The student sublease marketplace built for UGA.
        </p>
        {verified && (
          <div className="mt-6 inline-flex items-center gap-1.5 rounded-full bg-success px-3 py-1.5 text-xs font-bold text-white lu-pop-in">
            <ShieldCheck className="h-3.5 w-3.5" /> UGA Verified
          </div>
        )}
      </div>
    );
  }

  // ============ Screen 2 — What brings you here? ============
  if (step === 2) {
    return (
      <Shell stepIndex={2} total={5}>
        <h1 className="text-2xl font-black">What brings you here?</h1>
        <p className="mt-1 text-sm text-muted-foreground">
          We'll tailor your home screen to match.
        </p>

        <div className="mt-6 space-y-3">
          <IntentCard
            icon="🏠"
            title="I have a place to sublease"
            sub="Post your listing in 2 minutes"
            selected={intent === "listing"}
            onClick={() => setIntent("listing")}
          />
          <IntentCard
            icon="🔍"
            title="I'm looking for a place"
            sub="Browse listings or post what you need"
            selected={intent === "looking"}
            onClick={() => setIntent("looking")}
          />
        </div>

        <div className="mt-8">
          <Button
            disabled={!intent}
            onClick={saveIntent}
            className="w-full bg-primary hover:bg-primary-dark text-primary-foreground font-bold h-12"
          >
            Next <ArrowRight className="ml-1 h-4 w-4" />
          </Button>
        </div>
      </Shell>
    );
  }

  // ============ Screen 3 — Vibe Check ============
  if (step === 3) {
    return (
      <Shell stepIndex={3} total={isReturning ? 2 : 5} simplifiedStart={isReturning ? 1 : undefined}>
        <h1 className="text-2xl font-black">What's your vibe? 👀</h1>
        <p className="mt-1 text-sm text-muted-foreground">
          Helps us show you the right listings and people.
        </p>

        <div className={cn("mt-5 grid grid-cols-4 gap-2", shake && "lu-shake")}>
          {VIBE_GRID.map((v) => {
            const on = vibes.includes(v.tag);
            return (
              <button
                key={v.tag}
                onClick={() => toggleVibe(v.tag)}
                className={cn(
                  "aspect-square rounded-2xl border flex flex-col items-center justify-center gap-1 transition-all",
                  on
                    ? "bg-primary border-primary text-primary-foreground scale-[1.04] shadow-card-md"
                    : "bg-surface border-border hover:border-primary/40 active:scale-95",
                )}
                style={{ transitionTimingFunction: "cubic-bezier(0.34, 1.56, 0.64, 1)" }}
              >
                <span className="text-[28px] leading-none">{v.emoji}</span>
                <span className={cn("text-[11px] font-semibold", on ? "text-primary-foreground" : "text-foreground")}>
                  {v.label}
                </span>
              </button>
            );
          })}
        </div>

        <div className="mt-3 text-center text-[11px] text-muted-foreground">
          {vibes.length}/3 selected
        </div>

        <div className="mt-6">
          {vibes.length > 0 ? (
            <Button
              onClick={saveVibesAndAdvance}
              className="w-full bg-primary hover:bg-primary-dark text-primary-foreground font-bold h-12"
            >
              Next <ArrowRight className="ml-1 h-4 w-4" />
            </Button>
          ) : (
            <button
              onClick={() => setStep(4)}
              className="block w-full text-center text-sm font-semibold text-muted-foreground hover:text-foreground py-3"
            >
              Skip →
            </button>
          )}
        </div>
      </Shell>
    );
  }

  // ============ Screen 4 — Quick Profile Setup ============
  if (step === 4) {
    return (
      <Shell stepIndex={4} total={isReturning ? 2 : 5} simplifiedStart={isReturning ? 2 : undefined}>
        <h1 className="text-2xl font-black">Set up your profile</h1>
        <p className="mt-1 text-sm text-muted-foreground">
          Students with complete profiles get <span className="font-bold text-foreground">3× more replies</span>.
        </p>

        <div className="mt-6">
          <Label>Pick an avatar</Label>
          <div className="mt-2 grid grid-cols-6 gap-2">
            {ONBOARD_AVATARS.map((e) => (
              <button
                key={e}
                onClick={() => setAvatar(e)}
                className={cn(
                  "aspect-square rounded-full grid place-items-center text-2xl bg-background transition-all",
                  avatar === e ? "ring-2 ring-primary ring-offset-2 ring-offset-surface scale-105" : "hover:bg-muted",
                )}
              >
                {e}
              </button>
            ))}
          </div>
        </div>

        <div className="mt-5">
          <Label>Year in school</Label>
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
              >
                {y}
              </button>
            ))}
          </div>
        </div>

        <div className="mt-5">
          <Label>Bio</Label>
          <div className="mt-1 relative">
            <Input
              value={bio}
              onChange={(e) => setBio(e.target.value.slice(0, 120))}
              placeholder="Tell people a little about yourself (optional)"
              maxLength={120}
              className="pr-14"
            />
            <span className="absolute right-2 bottom-1.5 text-[10px] tabular-nums text-muted-foreground">
              {bio.length}/120
            </span>
          </div>
        </div>

        <div className="mt-7 space-y-2">
          <Button
            onClick={() => finishSetup(false)}
            disabled={saving}
            className="w-full bg-primary hover:bg-primary-dark text-primary-foreground font-bold h-12"
          >
            {saving ? "Saving…" : <>Finish setup <ArrowRight className="ml-1 h-4 w-4" /></>}
          </Button>
          <button
            onClick={() => finishSetup(true)}
            disabled={saving}
            className="block w-full text-center text-xs font-semibold text-muted-foreground hover:text-foreground"
          >
            Skip for now →
          </button>
          <p className="text-center text-[10px] text-muted-foreground">
            You can always update this in your profile later.
          </p>
        </div>
      </Shell>
    );
  }

  // ============ Screen 5 — You're In! ============
  // (Only shown for the full flow; simplified flow lands back at "/".)
  const goPost = intent === "listing";
  return (
    <div className="min-h-[100dvh] bg-gradient-to-b from-[#2563EB] to-[#1D4ED8] text-white flex flex-col items-center justify-center p-6">
      <div className="lu-spring-in text-7xl" aria-hidden>🎉</div>
      <h1 className="mt-8 text-center text-3xl font-extrabold">
        You're all set, {name}!
      </h1>
      <p className="mt-3 text-center text-white/85">
        {goPost
          ? "Let's get your listing live. It takes 2 minutes."
          : "Let's find your next place."}
      </p>

      <button
        onClick={() => navigate({ to: "/", search: goPost ? ({ post: 1 } as never) : undefined })}
        className="mt-8 inline-flex items-center justify-center rounded-full bg-white px-6 py-3.5 text-sm font-extrabold text-primary shadow-card-md transition-transform hover:scale-[1.02] active:scale-95"
      >
        {goPost ? "Post My Sublease →" : "Browse Listings →"}
      </button>

      <Link
        to="/"
        className="mt-5 text-sm text-white/80 underline-offset-4 hover:underline"
      >
        Explore the app first →
      </Link>
    </div>
  );
}

// ---------- presentational helpers ----------

function Shell({
  children,
  stepIndex,
  total,
  simplifiedStart,
}: {
  children: React.ReactNode;
  stepIndex: number;
  total: number;
  /** For simplified (returning) flow, override which "displayed" step we're on. */
  simplifiedStart?: number;
}) {
  // For simplified flow, total=2 and stepIndex maps via simplifiedStart.
  const display = simplifiedStart ?? stepIndex;
  return (
    <div className="min-h-[100dvh] bg-background flex flex-col">
      <header className="px-5 pt-5 pb-3 flex items-center justify-between">
        <div className="text-lg font-black tracking-tight">
          <span className="text-primary">Lease</span>Up
        </div>
        <div className="flex items-center gap-1">
          {Array.from({ length: total }).map((_, i) => (
            <div
              key={i}
              className={cn(
                "h-1.5 w-6 rounded-full transition-colors",
                i < display ? "bg-primary" : "bg-border",
              )}
            />
          ))}
        </div>
      </header>
      <main className="flex-1 px-5 pb-8 max-w-lg mx-auto w-full">{children}</main>
    </div>
  );
}

function Label({ children }: { children: React.ReactNode }) {
  return <div className="text-xs font-bold uppercase tracking-wide text-muted-foreground">{children}</div>;
}

function IntentCard({
  icon,
  title,
  sub,
  selected,
  onClick,
}: {
  icon: string;
  title: string;
  sub: string;
  selected: boolean;
  onClick: () => void;
}) {
  return (
    <button
      onClick={onClick}
      className={cn(
        "w-full relative text-left rounded-2xl border min-h-[100px] p-4 transition-all active:scale-[0.98]",
        selected
          ? "border-[2px] border-primary bg-primary-light"
          : "border border-border bg-surface hover:border-primary/40",
      )}
    >
      <div className="flex items-center gap-3">
        <div className="grid h-14 w-14 shrink-0 place-items-center rounded-2xl bg-white text-3xl shadow-card-sm">
          {icon === "🔍" ? <SearchIcon className="h-7 w-7 text-primary" /> : icon === "🏠" ? <Home className="h-7 w-7 text-primary" /> : icon}
        </div>
        <div className="min-w-0">
          <div className="text-base font-bold">{title}</div>
          <div className="text-xs text-muted-foreground">{sub}</div>
        </div>
      </div>
      {selected && (
        <span className="absolute top-3 right-3 grid h-6 w-6 place-items-center rounded-full bg-primary text-primary-foreground lu-pop-in">
          <Check className="h-3.5 w-3.5" strokeWidth={3} />
        </span>
      )}
    </button>
  );
}
