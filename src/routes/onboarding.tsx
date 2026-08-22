/**
 * /onboarding — single-screen post-signup setup.
 *
 * Name is taken from Google metadata (or email prefix) — we don't ask again.
 * Only the campus is required. Year and major are optional.
 * On submit we mark onboarding_completed and send the user home.
 */
import { createFileRoute, useNavigate } from "@tanstack/react-router";
import { useEffect, useMemo, useState } from "react";
import { useQuery, useQueryClient } from "@tanstack/react-query";
import { supabase } from "@/integrations/supabase/client";
import { useSession, useMyProfile } from "@/lib/leaseup/use-session";
import { fetchCampuses, fetchCampusesByIds, fetchCampusIdByEmailDomain, type Campus } from "@/lib/leaseup/campuses";
import { CampusAutocomplete } from "@/components/leaseup/CampusAutocomplete";
import { YEARS } from "@/lib/leaseup/constants";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { ArrowRight, Check } from "lucide-react";
import { cn } from "@/lib/utils";
import { toast } from "sonner";

export const Route = createFileRoute("/onboarding")({
  head: () => ({
    meta: [
      { title: "Welcome to LeaseUp" },
      { name: "description", content: "Set up your LeaseUp profile in a few seconds." },
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

  const [campusId, setCampusId] = useState<string | null>(null);
  const [detectedCampusId, setDetectedCampusId] = useState<string | null>(null);
  const [overrideCampus, setOverrideCampus] = useState(false);
  const [year, setYear] = useState("");
  const [major, setMajor] = useState("");
  const [saving, setSaving] = useState(false);

  const { data: campusesWithListings = [] } = useQuery({
    queryKey: ["campuses"],
    queryFn: fetchCampuses,
    staleTime: Infinity,
  });
  // Q179 — the student's own school may have no listings yet, so resolve any
  // pre-selected / detected campus by id and merge it into the local list.
  const { data: resolved = [] } = useQuery({
    queryKey: ["campus-by-id", campusId],
    queryFn: () => fetchCampusesByIds([campusId!]),
    enabled: !!campusId,
    staleTime: Infinity,
  });
  const [pickedCampus, setPickedCampus] = useState<Campus | null>(null);
  const campuses = useMemo(() => {
    const seen = new Map<string, Campus>();
    for (const c of [...campusesWithListings, ...resolved, ...(pickedCampus ? [pickedCampus] : [])]) {
      seen.set(c.id, c);
    }
    return [...seen.values()];
  }, [campusesWithListings, resolved, pickedCampus]);

  useEffect(() => {
    if (!loading && !user) navigate({ to: "/auth", search: { mode: "up" } });
  }, [loading, user, navigate]);

  useEffect(() => {
    // Q67: allow re-entry when campus is missing (fallback from /profile banner).
    if (profile?.onboarding_completed && profile?.campus_id) navigate({ to: "/" });
  }, [profile?.onboarding_completed, profile?.campus_id, navigate]);

  useEffect(() => {
    if (!profile) return;
    if (profile.campus_id && !campusId) setCampusId(profile.campus_id);
    if (profile.year && !year) setYear(profile.year);
    if (profile.major && !major) setMajor(profile.major);
  }, [profile?.id]); // eslint-disable-line react-hooks/exhaustive-deps

  useEffect(() => {
    if (campusId || campuses.length === 0) return;
    let hint: string | null = null;
    try { hint = localStorage.getItem("leaseup_campus_hint"); } catch {}
    if (!hint) return;
    const match = campuses.find((c) => c.slug === hint);
    if (match) setCampusId(match.id);
  }, [campuses, campusId]);

  // Q67: auto-detect campus from the user's .edu email domain.
  useEffect(() => {
    if (!user?.email || detectedCampusId) return;
    fetchCampusIdByEmailDomain(user.email).then((id) => {
      if (!id) return;
      setDetectedCampusId(id);
      setCampusId((prev) => prev ?? id);
    }).catch(() => {});
  }, [user?.email, detectedCampusId]);

  const activeCampus = useMemo(
    () => campuses.find((c) => c.id === campusId) ?? null,
    [campuses, campusId],
  );

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

  async function finish() {
    if (!user) return;
    if (!campusId) { toast.error("Pick your campus"); return; }
    setSaving(true);
    try {
      const patch: {
        onboarding_completed: boolean;
        campus_id: string;
        year?: string;
        major?: string;
      } = { onboarding_completed: true, campus_id: campusId };
      if (year) patch.year = year;
      if (major.trim()) patch.major = major.trim();

      const { error } = await supabase.from("profiles").update(patch).eq("id", user.id);
      if (error) throw error;

      qc.invalidateQueries({ queryKey: ["profile", user.id] });

      // Fire welcome email once (idempotency key ensures single send per user).
      try {
        const { sendTransactionalEmail } = await import("@/lib/email/send");
        const chosen = campuses.find((c) => c.id === campusId);
        const firstName = ((profile?.name || user.email?.split("@")[0] || "") as string).split(" ")[0] || "";
        const origin = typeof window !== "undefined" ? window.location.origin : "https://leasup.co";
        void sendTransactionalEmail({
          templateName: "welcome",
          recipientEmail: user.email ?? "",
          idempotencyKey: `welcome-${user.id}`,
          templateData: {
            firstName,
            campusName: chosen?.name ?? "your campus",
            campusUrl: chosen?.slug ? `${origin}/sublease/${chosen.slug}` : origin,
            postUrl: `${origin}/post`,
            roommatesUrl: `${origin}/roommates`,
          },
        });
      } catch (e) {
        console.warn("[email] welcome send failed", e);
      }

      // Q67: stash a welcome payload for the toast on next page load.
      try {
        const chosen = campuses.find((c) => c.id === campusId);
        const firstName = ((profile?.name || user.email?.split("@")[0] || "") as string).split(" ")[0] || "";
        sessionStorage.setItem("lu_welcome", JSON.stringify({
          firstName,
          campusShort: chosen?.short_name ?? chosen?.name ?? null,
          campusUrl: chosen?.slug ? `/sublease/${chosen.slug}` : null,
        }));
      } catch {}

      let storedNext: string | null = null;
      try { storedNext = sessionStorage.getItem("lu_post_onboarding_next"); } catch {}
      try { sessionStorage.removeItem("lu_post_onboarding_next"); } catch {}
      const detectedChosen = detectedCampusId && campusId === detectedCampusId
        ? campuses.find((c) => c.id === campusId)
        : null;
      const defaultPath = detectedChosen?.slug ? `/sublease/${detectedChosen.slug}` : "/";
      const nextPath = storedNext && storedNext !== "/" && storedNext.startsWith("/") ? storedNext : defaultPath;
      window.location.assign(nextPath);
    } catch (e) {
      toast.error(e instanceof Error ? e.message : "Could not finish setup");
      setSaving(false);
    }
  }

  return (
    <div className="min-h-[100dvh] bg-background flex flex-col">
      <header className="px-5 pt-5 pb-3 flex items-center">
        <div className="text-lg font-black tracking-tight">
          <span className="text-primary">Lease</span>Up
        </div>
      </header>
      <main className="flex-1 px-5 pb-10 max-w-md mx-auto w-full">
        <h1 className="text-3xl font-black">Almost there.</h1>
        <p className="mt-1 text-sm text-muted-foreground">Tell us where you go to school.</p>

        {detectedCampusId && !overrideCampus && activeCampus?.id === detectedCampusId ? (
          <div className="mt-6 rounded-xl border border-primary/30 bg-primary-light/60 p-4">
            <div className="text-xs font-bold uppercase tracking-wide text-primary-dark">Campus</div>
            <div className="mt-1 flex items-center gap-2">
              <Check className="h-4 w-4 text-primary" />
              <div className="text-sm font-bold">{activeCampus.name}</div>
            </div>
            <p className="mt-1 text-xs text-muted-foreground">
              Detected from your <span className="font-semibold">@{user.email?.split("@")[1]}</span> email.
            </p>
            <button
              type="button"
              onClick={() => { setOverrideCampus(true); setCampusId(null); }}
              className="mt-2 text-xs font-semibold text-primary hover:underline"
            >
              (change)
            </button>
          </div>
        ) : (
          <div className="mt-6">
            <Label>Campus</Label>
            <div className="mt-1.5 rounded-xl border border-border bg-surface px-3 py-3">
              {/* Q179 — search every accredited US school. */}
              <CampusAutocomplete
                value={activeCampus ? activeCampus.name : ""}
                placeholder="Search your school…"
                onSelect={(c) => { setPickedCampus(c); setCampusId(c.id); }}
                onClear={() => setCampusId(null)}
              />
              {activeCampus && (
                <div className="mt-1 text-xs text-muted-foreground">
                  {activeCampus.city}, {activeCampus.state}
                </div>
              )}
            </div>
          </div>
        )}



        <div className="mt-5">
          <Label>Year <span className="text-xs font-normal text-muted-foreground">(optional)</span></Label>
          <div className="mt-2 flex flex-wrap gap-1.5">
            {YEARS.map((y) => (
              <button
                key={y}
                type="button"
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
          <Label>Major <span className="text-xs font-normal text-muted-foreground">(optional)</span></Label>
          <Input value={major} onChange={(e) => setMajor(e.target.value)} placeholder="e.g. Business, CS, Nursing" className="mt-1.5" />
        </div>

        <div className="mt-8">
          <Button
            onClick={finish}
            disabled={!campusId || saving}
            className="w-full bg-primary hover:bg-primary-dark text-primary-foreground font-bold h-12"
          >
            {saving ? "Saving…" : <>Let&apos;s go <ArrowRight className="ml-1 h-4 w-4" /></>}
          </Button>
        </div>
      </main>
    </div>
  );
}
