import { createFileRoute, useNavigate, Link } from "@tanstack/react-router";
import { useEffect, useState } from "react";
import { useQuery, useQueryClient } from "@tanstack/react-query";
import { useSession, useMyProfile } from "@/lib/leaseup/use-session";
import {
  fetchMyRoommateProfile,
  upsertRoommateProfile,
  LIFESTYLE_TAG_GROUPS,
  type RoommateMode,
} from "@/lib/leaseup/roommates";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Textarea } from "@/components/ui/textarea";
import { Label } from "@/components/ui/label";
import { toast } from "sonner";
import { cn } from "@/lib/utils";
import { ArrowLeft, Home, Search, Sparkles } from "lucide-react";

export const Route = createFileRoute("/roommates/create")({
  head: () => ({
    meta: [
      { title: "Create your roommate profile — LeaseUp" },
      { name: "description", content: "Post your roommate profile so other students at your campus can reach out." },
      { name: "robots", content: "noindex" },
    ],
  }),
  component: CreateRoommatePage,
});

const DURATIONS: { id: "semester" | "academic_year" | "full_year" | "flexible"; label: string }[] = [
  { id: "semester", label: "Summer only (May–Aug)" },
  { id: "academic_year", label: "Fall semester" },
  { id: "full_year", label: "Full year" },
  { id: "flexible", label: "Flexible" },
];

const MAX_TAGS = 5;
const MAX_BIO = 200;

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

  const [saving, setSaving] = useState(false);
  const [mode, setMode] = useState<RoommateMode>("looking");
  const [budgetMin, setBudgetMin] = useState<string>("500");
  const [budgetMax, setBudgetMax] = useState<string>("800");
  const [moveIn, setMoveIn] = useState<string>("");
  const [duration, setDuration] = useState<typeof DURATIONS[number]["id"]>("full_year");
  const [neighborhood, setNeighborhood] = useState("");
  const [aboutMe, setAboutMe] = useState("");
  const [tags, setTags] = useState<string[]>([]);

  useEffect(() => {
    if (!existing) return;
    if (existing.mode) setMode(existing.mode);
    if (existing.budget_min != null) setBudgetMin(String(existing.budget_min));
    if (existing.budget_max != null) setBudgetMax(String(existing.budget_max));
    if (existing.move_in_date) setMoveIn(existing.move_in_date);
    if (existing.lease_length) setDuration(existing.lease_length);
    if (existing.areas_preferred?.length) setNeighborhood(existing.areas_preferred.join(", "));
    if (existing.about_me) setAboutMe(existing.about_me);
    if (existing.vibe_tags?.length) setTags(existing.vibe_tags.slice(0, MAX_TAGS));
  }, [existing]);

  function toggleTag(t: string) {
    setTags(prev => {
      if (prev.includes(t)) return prev.filter(x => x !== t);
      if (prev.length >= MAX_TAGS) {
        toast(`Pick up to ${MAX_TAGS} tags`);
        return prev;
      }
      return [...prev, t];
    });
  }

  async function save() {
    if (!user || !profile) { toast.error("Sign in first"); return; }
    const min = parseInt(budgetMin, 10);
    const max = parseInt(budgetMax, 10);
    if (!Number.isFinite(min) || !Number.isFinite(max) || min < 0 || max < min) {
      toast.error("Enter a valid budget range");
      return;
    }
    setSaving(true);
    try {
      const areas = neighborhood.split(",").map(s => s.trim()).filter(Boolean);
      // Derive legacy lifestyle booleans from tag selections so existing filters still work.
      await upsertRoommateProfile({
        user_id: user.id,
        campus_id: profile.campus_id ?? null,
        mode,
        budget_min: min,
        budget_max: max,
        move_in_date: moveIn || null,
        lease_length: duration,
        beds_wanted: null,
        areas_preferred: areas,
        lifestyle_early_bird: tags.includes("Early riser"),
        lifestyle_night_owl: tags.includes("Night owl"),
        lifestyle_studious: tags.includes("Quiet / studious"),
        lifestyle_social: tags.includes("Social / lively"),
        lifestyle_clean: tags.includes("Very clean") ? 5 : tags.includes("Reasonably clean") ? 4 : tags.includes("Relaxed about mess") ? 2 : 3,
        lifestyle_quiet: 3,
        has_pets: tags.includes("Have a pet"),
        pet_friendly: tags.includes("Pet-friendly") || tags.includes("Have a pet"),
        smokes: tags.includes("Smoker-friendly"),
        smoker_ok: tags.includes("Smoker-friendly"),
        gender_preference: "no_preference",
        about_me: aboutMe.trim() || null,
        vibe_tags: tags,
        is_active: true,
      } as any);
      qc.invalidateQueries({ queryKey: ["my-roommate-profile"] });
      qc.invalidateQueries({ queryKey: ["roommate-profiles"] });
      toast.success("Roommate profile saved!");
      navigate({ to: "/roommates" });
    } catch (e: any) {
      toast.error(e?.message ?? "Couldn't save");
    } finally {
      setSaving(false);
    }
  }

  return (
    <div className="min-h-screen bg-background pb-24">
      <header className="sticky top-0 z-10 flex items-center gap-3 border-b border-border bg-surface/95 px-4 py-3 backdrop-blur-md">
        <Link to="/roommates" className="grid h-9 w-9 place-items-center rounded-full hover:bg-background">
          <ArrowLeft className="h-5 w-5" />
        </Link>
        <div className="flex-1">
          <h1 className="text-base font-extrabold leading-tight">
            {existing ? "Edit roommate profile" : "Create roommate profile"}
          </h1>
          <p className="text-xs text-muted-foreground">Free · always</p>
        </div>
      </header>

      <main className="mx-auto max-w-xl space-y-8 px-4 py-6">
        {/* Mode */}
        <section>
          <Label className="text-sm font-bold">I'm posting because…</Label>
          <div className="mt-2 grid grid-cols-1 gap-2 sm:grid-cols-2">
            <ModeCard active={mode === "has_room"} onClick={() => setMode("has_room")} icon={<Home className="h-5 w-5" />} title="I have a room to fill" desc="Post your open room and let roommates come to you." />
            <ModeCard active={mode === "looking"} onClick={() => setMode("looking")} icon={<Search className="h-5 w-5" />} title="I'm looking for a place" desc="Find a room and roommates that fit your budget." />
          </div>
        </section>

        {/* Budget */}
        <section>
          <Label className="text-sm font-bold">Budget (monthly)</Label>
          <div className="mt-2 flex items-center gap-3">
            <div className="flex-1">
              <div className="relative">
                <span className="pointer-events-none absolute left-3 top-1/2 -translate-y-1/2 text-sm text-muted-foreground">$</span>
                <Input type="number" inputMode="numeric" min={0} value={budgetMin} onChange={e => setBudgetMin(e.target.value)} className="pl-6" placeholder="Min" />
              </div>
            </div>
            <span className="text-muted-foreground">–</span>
            <div className="flex-1">
              <div className="relative">
                <span className="pointer-events-none absolute left-3 top-1/2 -translate-y-1/2 text-sm text-muted-foreground">$</span>
                <Input type="number" inputMode="numeric" min={0} value={budgetMax} onChange={e => setBudgetMax(e.target.value)} className="pl-6" placeholder="Max" />
              </div>
            </div>
          </div>
        </section>

        {/* Move-in date */}
        <section>
          <Label className="text-sm font-bold">Move-in date</Label>
          <Input
            type="date"
            value={moveIn}
            onChange={e => setMoveIn(e.target.value)}
            className="mt-2"
          />
        </section>

        {/* Duration */}
        <section>
          <Label className="text-sm font-bold">Duration</Label>
          <div className="mt-2 flex flex-wrap gap-2">
            {DURATIONS.map(d => (
              <Chip key={d.id} active={duration === d.id} onClick={() => setDuration(d.id)}>{d.label}</Chip>
            ))}
          </div>
        </section>

        {/* Neighborhood */}
        <section>
          <Label className="text-sm font-bold">Neighborhood preference</Label>
          <Input
            className="mt-2"
            value={neighborhood}
            onChange={e => setNeighborhood(e.target.value)}
            placeholder="Near North Campus, Five Points"
          />
        </section>

        {/* About me */}
        <section>
          <Label className="text-sm font-bold">About me</Label>
          <Textarea
            value={aboutMe}
            onChange={e => setAboutMe(e.target.value.slice(0, MAX_BIO))}
            rows={3}
            placeholder="Grad student, quiet, clean. Looking for similar."
            className="mt-2"
          />
          <div className="mt-1 text-right text-xs text-muted-foreground">{aboutMe.length}/{MAX_BIO}</div>
        </section>

        {/* Lifestyle tags */}
        <section>
          <div className="flex items-baseline justify-between">
            <Label className="text-sm font-bold">Lifestyle tags</Label>
            <span className="text-xs text-muted-foreground">{tags.length}/{MAX_TAGS} selected</span>
          </div>
          <p className="mt-1 text-xs text-muted-foreground">Pick up to {MAX_TAGS} — the most relevant ones show on your card.</p>
          <div className="mt-3 space-y-3">
            {LIFESTYLE_TAG_GROUPS.map(g => (
              <div key={g.group}>
                <div className="mb-1.5 text-[11px] font-bold uppercase tracking-wide text-muted-foreground">{g.group}</div>
                <div className="flex flex-wrap gap-2">
                  {g.tags.map(t => (
                    <Chip key={t} active={tags.includes(t)} onClick={() => toggleTag(t)}>{t}</Chip>
                  ))}
                </div>
              </div>
            ))}
          </div>
        </section>
      </main>

      <div
        className="fixed inset-x-0 bottom-0 z-20 border-t border-border bg-surface/95 px-4 py-3 backdrop-blur-md"
        style={{ paddingBottom: "calc(env(safe-area-inset-bottom) + 0.75rem)" }}
      >
        <div className="mx-auto max-w-xl">
          <Button onClick={save} disabled={saving} className="w-full font-bold">
            <Sparkles className="mr-1 h-4 w-4" />
            {saving ? "Saving…" : "Save my roommate profile →"}
          </Button>
        </div>
      </div>
    </div>
  );
}

function Chip({ active, onClick, children }: { active: boolean; onClick: () => void; children: React.ReactNode }) {
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
    >{children}</button>
  );
}

function ModeCard({ active, onClick, icon, title, desc }: {
  active: boolean; onClick: () => void; icon: React.ReactNode; title: string; desc: string;
}) {
  return (
    <button
      type="button"
      onClick={onClick}
      className={cn(
        "flex items-start gap-3 rounded-2xl border p-4 text-left transition",
        active ? "border-primary bg-primary/5 shadow-sm" : "border-border bg-surface hover:bg-background",
      )}
    >
      <div className={cn(
        "grid h-9 w-9 shrink-0 place-items-center rounded-full",
        active ? "bg-primary text-primary-foreground" : "bg-background text-muted-foreground",
      )}>{icon}</div>
      <div className="min-w-0">
        <div className="font-bold">{title}</div>
        <div className="mt-0.5 text-xs text-muted-foreground">{desc}</div>
      </div>
    </button>
  );
}
