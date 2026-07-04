import { createFileRoute, useNavigate, Link } from "@tanstack/react-router";
import { useEffect, useState } from "react";
import { useQuery, useQueryClient } from "@tanstack/react-query";
import { useSession, useMyProfile } from "@/lib/leaseup/use-session";
import { fetchMyRoommateProfile, upsertRoommateProfile } from "@/lib/leaseup/roommates";
import { NEIGHBORHOODS, VIBE_TAGS } from "@/lib/leaseup/constants";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Textarea } from "@/components/ui/textarea";
import { Slider } from "@/components/ui/slider";
import { Label } from "@/components/ui/label";
import { toast } from "sonner";
import { cn } from "@/lib/utils";
import { ArrowLeft, ArrowRight, Sparkles } from "lucide-react";

export const Route = createFileRoute("/roommates/create")({
  head: () => ({
    meta: [
      { title: "Create your roommate profile — LeaseUp" },
      { name: "description", content: "Tell potential roommates about yourself and find compatible roommates at your campus." },
    ],
  }),
  component: CreateRoommatePage,
});

const LEASE_LENGTHS: { id: "semester" | "academic_year" | "full_year" | "flexible"; label: string }[] = [
  { id: "semester", label: "Semester" },
  { id: "academic_year", label: "Academic Year" },
  { id: "full_year", label: "Full Year" },
  { id: "flexible", label: "Flexible" },
];

function CreateRoommatePage() {
  const navigate = useNavigate();
  const { user } = useSession();
  const { data: profile } = useMyProfile();
  const qc = useQueryClient();

  const { data: existing } = useQuery({
    queryKey: ["my-roommate-profile", user?.id],
    queryFn: () => fetchMyRoommateProfile(user!.id),
    enabled: !!user?.id,
  });

  const [step, setStep] = useState(1);
  const [saving, setSaving] = useState(false);

  // Form state
  const [moveIn, setMoveIn] = useState<string>("");
  const [leaseLen, setLeaseLen] = useState<typeof LEASE_LENGTHS[number]["id"]>("academic_year");
  const [budget, setBudget] = useState<[number, number]>([500, 900]);
  const [bedsWanted, setBedsWanted] = useState<number>(2);

  const [earlyBird, setEarlyBird] = useState(3); // 1=night owl, 5=early bird
  const [social, setSocial] = useState(3);       // 1=studious, 5=social
  const [clean, setClean] = useState(4);          // cleanliness 1-5
  const [hasPets, setHasPets] = useState(false);
  const [petFriendly, setPetFriendly] = useState(true);
  const [smokes, setSmokes] = useState(false);
  const [smokerOk, setSmokerOk] = useState(false);
  const [genderPref, setGenderPref] = useState<"no_preference" | "same_gender">("no_preference");

  const [aboutMe, setAboutMe] = useState("");
  const [vibes, setVibes] = useState<string[]>([]);
  const [areas, setAreas] = useState<string[]>([]);

  // Hydrate from existing profile
  useEffect(() => {
    if (!existing) return;
    if (existing.move_in_date) setMoveIn(existing.move_in_date);
    if (existing.lease_length) setLeaseLen(existing.lease_length);
    if (existing.budget_min != null && existing.budget_max != null) setBudget([existing.budget_min, existing.budget_max]);
    if (existing.beds_wanted) setBedsWanted(existing.beds_wanted);
    setEarlyBird(existing.lifestyle_early_bird ? 5 : existing.lifestyle_night_owl ? 1 : 3);
    setSocial(existing.lifestyle_social ? 5 : existing.lifestyle_studious ? 1 : 3);
    if (existing.lifestyle_clean) setClean(existing.lifestyle_clean);
    setHasPets(existing.has_pets);
    setPetFriendly(existing.pet_friendly);
    setSmokes(existing.smokes);
    setSmokerOk(existing.smoker_ok);
    setGenderPref(existing.gender_preference === "same_gender" ? "same_gender" : "no_preference");
    setAboutMe(existing.about_me ?? "");
    setVibes(existing.vibe_tags ?? []);
    setAreas(existing.areas_preferred ?? []);
  }, [existing]);

  // Pre-populate vibes from main profile on first mount
  useEffect(() => {
    if (existing) return;
    if (profile?.vibe_tags && vibes.length === 0) setVibes(profile.vibe_tags);
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [profile, existing]);

  async function save() {
    if (!user || !profile) { toast.error("Sign in first"); return; }
    setSaving(true);
    try {
      await upsertRoommateProfile({
        user_id: user.id,
        campus_id: profile.campus_id ?? null,
        budget_min: budget[0],
        budget_max: budget[1],
        move_in_date: moveIn || null,
        lease_length: leaseLen,
        beds_wanted: bedsWanted,
        areas_preferred: areas,
        lifestyle_early_bird: earlyBird >= 4,
        lifestyle_night_owl: earlyBird <= 2,
        lifestyle_studious: social <= 2,
        lifestyle_social: social >= 4,
        lifestyle_clean: clean,
        lifestyle_quiet: 3,
        has_pets: hasPets,
        pet_friendly: petFriendly,
        smokes: smokes,
        smoker_ok: smokerOk,
        gender_preference: genderPref,
        about_me: aboutMe || null,
        vibe_tags: vibes,
        is_active: true,
      });
      qc.invalidateQueries({ queryKey: ["my-roommate-profile"] });
      qc.invalidateQueries({ queryKey: ["roommate-profiles"] });
      toast.success("🎉 Roommate profile saved!");
      navigate({ to: "/roommates" });
    } catch (e: any) {
      toast.error(e.message ?? "Couldn't save");
    } finally {
      setSaving(false);
    }
  }

  function toggleArea(a: string) {
    setAreas(prev => prev.includes(a) ? prev.filter(x => x !== a) : [...prev, a]);
  }
  function toggleVibe(v: string) {
    setVibes(prev => prev.includes(v) ? prev.filter(x => x !== v) : [...prev, v]);
  }

  return (
    <div className="min-h-screen bg-background pb-24">
      <header className="sticky top-0 z-10 flex items-center gap-3 border-b border-border bg-surface/95 px-4 py-3 backdrop-blur-md">
        <Link to="/roommates" className="grid h-9 w-9 place-items-center rounded-full hover:bg-background">
          <ArrowLeft className="h-5 w-5" />
        </Link>
        <div className="flex-1">
          <h1 className="text-base font-extrabold leading-tight">
            {existing ? "Edit roommate profile" : "Find a roommate"}
          </h1>
          <p className="text-xs text-muted-foreground">Step {step} of 4</p>
        </div>
      </header>

      {/* Progress bar */}
      <div className="h-1 w-full bg-border">
        <div className="h-full bg-primary transition-all" style={{ width: `${(step / 4) * 100}%` }} />
      </div>

      <main className="mx-auto max-w-xl px-4 py-6 space-y-6">
        {step === 1 && (
          <section className="space-y-5 lu-spring">
            <h2 className="text-xl font-extrabold">The basics</h2>

            <div>
              <Label className="text-sm font-bold">Move-in date</Label>
              <Input type="month" value={moveIn ? moveIn.slice(0, 7) : ""}
                onChange={(e) => setMoveIn(e.target.value ? `${e.target.value}-01` : "")}
                className="mt-1.5" />
            </div>

            <div>
              <Label className="text-sm font-bold">Lease length</Label>
              <div className="mt-1.5 flex flex-wrap gap-2">
                {LEASE_LENGTHS.map(l => (
                  <PillButton key={l.id} active={leaseLen === l.id} onClick={() => setLeaseLen(l.id)}>{l.label}</PillButton>
                ))}
              </div>
            </div>

            <div>
              <div className="flex items-center justify-between">
                <Label className="text-sm font-bold">Budget per month</Label>
                <span className="text-sm font-bold text-primary">${budget[0]}–${budget[1]}</span>
              </div>
              <div className="mt-3 grid grid-cols-2 gap-3">
                <div>
                  <Label className="text-xs text-muted-foreground">Min</Label>
                  <Slider value={[budget[0]]} min={300} max={1500} step={50}
                    onValueChange={([v]) => setBudget([Math.min(v, budget[1] - 50), budget[1]])} className="mt-2" />
                </div>
                <div>
                  <Label className="text-xs text-muted-foreground">Max</Label>
                  <Slider value={[budget[1]]} min={300} max={1500} step={50}
                    onValueChange={([v]) => setBudget([budget[0], Math.max(v, budget[0] + 50)])} className="mt-2" />
                </div>
              </div>
            </div>

            <div>
              <Label className="text-sm font-bold">Beds wanted</Label>
              <div className="mt-1.5 flex flex-wrap gap-2">
                {[1, 2, 3, 4].map(b => (
                  <PillButton key={b} active={bedsWanted === b} onClick={() => setBedsWanted(b)}>
                    {b}{b === 4 ? "+" : ""}
                  </PillButton>
                ))}
              </div>
            </div>
          </section>
        )}

        {step === 2 && (
          <section className="space-y-6 lu-spring">
            <div>
              <h2 className="text-xl font-extrabold">What kind of roommate are you?</h2>
              <p className="text-sm text-muted-foreground">Be honest — it helps you find compatible roommates.</p>
            </div>

            <SliderRow label="Sleep schedule" left="🌙 Night Owl" right="☀️ Early Bird" value={earlyBird} onChange={setEarlyBird} />
            <SliderRow label="Energy" left="📚 Studious" right="🎉 Social" value={social} onChange={setSocial} />
            <SliderRow label="Tidiness" left="🌿 Relaxed" right="🧹 Very Clean" value={clean} onChange={setClean} />

            <div>
              <Label className="text-sm font-bold">Pets</Label>
              <div className="mt-1.5 flex flex-wrap gap-2">
                <PillButton active={hasPets} onClick={() => setHasPets(v => !v)}>🐾 I have pets</PillButton>
                <PillButton active={petFriendly} onClick={() => setPetFriendly(v => !v)}>🐾 Pet friendly</PillButton>
              </div>
            </div>

            <div>
              <Label className="text-sm font-bold">Smoking</Label>
              <div className="mt-1.5 flex flex-wrap gap-2">
                <PillButton active={smokes} onClick={() => setSmokes(v => !v)}>🚬 I smoke</PillButton>
                <PillButton active={smokerOk} onClick={() => setSmokerOk(v => !v)}>🚬 Smoker OK</PillButton>
              </div>
            </div>

            <div>
              <Label className="text-sm font-bold">Gender preference</Label>
              <div className="mt-1.5 flex flex-wrap gap-2">
                <PillButton active={genderPref === "no_preference"} onClick={() => setGenderPref("no_preference")}>No preference</PillButton>
                <PillButton active={genderPref === "same_gender"} onClick={() => setGenderPref("same_gender")}>Same gender preferred</PillButton>
              </div>
            </div>
          </section>
        )}

        {step === 3 && (
          <section className="space-y-5 lu-spring">
            <h2 className="text-xl font-extrabold">Tell potential roommates about yourself</h2>

            <div>
              <Textarea
                value={aboutMe}
                onChange={(e) => setAboutMe(e.target.value.slice(0, 280))}
                rows={5}
                placeholder="Junior studying Finance. I'm usually studying during the week and social on weekends. Looking for someone chill who keeps common areas clean."
              />
              <div className="mt-1 text-right text-xs text-muted-foreground">{aboutMe.length}/280</div>
            </div>

            <div>
              <Label className="text-sm font-bold">Your vibe</Label>
              <p className="text-xs text-muted-foreground mb-2">Tap to add or remove tags.</p>
              <div className="flex flex-wrap gap-2">
                {VIBE_TAGS.map(t => (
                  <PillButton key={t} active={vibes.includes(t)} onClick={() => toggleVibe(t)}>{t}</PillButton>
                ))}
              </div>
            </div>
          </section>
        )}

        {step === 4 && (
          <section className="space-y-5 lu-spring">
            <h2 className="text-xl font-extrabold">Neighborhood & confirm</h2>

            <div>
              <Label className="text-sm font-bold">Preferred areas</Label>
              <p className="text-xs text-muted-foreground mb-2">Pick any that work for you.</p>
              <div className="flex flex-wrap gap-2">
                {NEIGHBORHOODS.map(n => (
                  <PillButton key={n.name} active={areas.includes(n.name)} onClick={() => toggleArea(n.name)}>{n.name}</PillButton>
                ))}
              </div>
            </div>

            {/* Preview card */}
            <div className="rounded-2xl border border-border bg-surface p-4 shadow-card-md">
              <div className="text-xs font-bold uppercase tracking-wider text-muted-foreground mb-2">Preview</div>
              <div className="flex items-start gap-3">
                <div className="grid h-14 w-14 place-items-center rounded-full text-2xl"
                  style={{ background: profile?.banner_color ?? "#2563EB", color: "white" }}>
                  {profile?.avatar_emoji ?? "🙂"}
                </div>
                <div className="flex-1 min-w-0">
                  <div className="font-extrabold leading-tight">{profile?.name ?? "You"}</div>
                  <div className="text-xs text-muted-foreground">
                    {[profile?.year, profile?.major].filter(Boolean).join(" · ") || "Set up your profile"}
                  </div>
                  <div className="mt-1.5 text-xs text-foreground/80">
                    📅 {moveIn ? new Date(moveIn).toLocaleDateString(undefined, { month: "short", year: "numeric" }) : "Flexible"}
                    {" · "}🛏 {bedsWanted}BR
                    {" · "}💰 ${budget[0]}–${budget[1]}/mo
                  </div>
                  {aboutMe && <p className="mt-2 text-sm text-foreground/80 line-clamp-2">"{aboutMe}"</p>}
                </div>
              </div>
            </div>
          </section>
        )}
      </main>

      {/* Sticky footer nav */}
      <div className="fixed bottom-0 inset-x-0 z-20 border-t border-border bg-surface/95 px-4 py-3 backdrop-blur-md"
        style={{ paddingBottom: "calc(env(safe-area-inset-bottom) + 0.75rem)" }}>
        <div className="mx-auto flex max-w-xl items-center justify-between gap-3">
          <Button variant="ghost" disabled={step === 1} onClick={() => setStep(s => Math.max(1, s - 1))}>
            <ArrowLeft className="h-4 w-4 mr-1" /> Back
          </Button>
          {step < 4 ? (
            <Button onClick={() => setStep(s => Math.min(4, s + 1))} className="font-bold">
              Next <ArrowRight className="h-4 w-4 ml-1" />
            </Button>
          ) : (
            <Button onClick={save} disabled={saving} className="font-bold">
              <Sparkles className="h-4 w-4 mr-1" />
              {saving ? "Saving…" : existing ? "Save changes" : "Create Roommate Profile"}
            </Button>
          )}
        </div>
      </div>
    </div>
  );
}

function PillButton({ active, onClick, children }: { active: boolean; onClick: () => void; children: React.ReactNode }) {
  return (
    <button
      type="button"
      onClick={onClick}
      className={cn(
        "rounded-full border px-3.5 py-1.5 text-sm font-semibold transition active:scale-95",
        active
          ? "border-primary bg-primary text-primary-foreground shadow-sm"
          : "border-border bg-surface text-foreground hover:bg-background",
      )}
    >
      {children}
    </button>
  );
}

function SliderRow({ label, left, right, value, onChange }: {
  label: string; left: string; right: string; value: number; onChange: (v: number) => void;
}) {
  return (
    <div>
      <Label className="text-sm font-bold">{label}</Label>
      <div className="mt-2 flex items-center justify-between text-xs text-muted-foreground">
        <span>{left}</span><span>{right}</span>
      </div>
      <Slider value={[value]} min={1} max={5} step={1} onValueChange={([v]) => onChange(v)} className="mt-2" />
    </div>
  );
}
