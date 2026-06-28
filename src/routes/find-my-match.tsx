import { createFileRoute, useNavigate, Link } from "@tanstack/react-router";
import { useMemo, useState } from "react";
import { useServerFn } from "@tanstack/react-start";
import { findMyMatch } from "@/lib/leaseup/ai.functions";
import { useQuery } from "@tanstack/react-query";
import { fetchListings } from "@/lib/leaseup/queries";
import { useMyProfile, useSession } from "@/lib/leaseup/use-session";
import { supabase } from "@/integrations/supabase/client";
import { toast } from "sonner";
import {
  ChevronLeft, ChevronRight, ArrowLeft, Heart, MessageCircle,
  Sparkles, Bell, ClipboardList, Target,
} from "lucide-react";
import { cn } from "@/lib/utils";
import { ListingDetailSheet } from "@/components/leaseup/ListingDetailSheet";
import type { Listing } from "@/lib/leaseup/types";
import { VIBE_TAGS } from "@/lib/leaseup/constants";
import { findStat, computePriceLabel, LABEL_META } from "@/lib/leaseup/pricing";
import { usePriceStats } from "@/components/leaseup/PriceLabelBadge";

export const Route = createFileRoute("/find-my-match")({
  head: () => ({
    meta: [
      { title: "Find My Match — LeaseUp" },
      { name: "description", content: "Answer 5 quick questions. Get your top sublease matches at your campus." },
      { property: "og:title", content: "Find My Match — LeaseUp" },
      { property: "og:description", content: "Answer 5 quick questions. Get your top sublease matches at your campus." },
      { property: "og:url", content: "https://leasup.co/find-my-match" },
      { property: "og:type", content: "website" },
    ],
    links: [{ rel: "canonical", href: "https://leasup.co/find-my-match" }],
  }),
  component: FindMyMatchPage,
});

// ============================================================
// State / constants
// ============================================================

type Quiz = {
  budget: number;
  moveIn: string;   // "YYYY-MM"
  moveOut: string;  // "YYYY-MM"
  beds: number | null;
  musts: string[];
  vibes: string[];
};

const MUST_OPTIONS = [
  { id: "furnished",   label: "Furnished",      emoji: "🛋" },
  { id: "utilities",   label: "Utilities Incl", emoji: "💡" },
  { id: "pets",        label: "Pet Friendly",   emoji: "🐾" },
  { id: "parking",     label: "Parking",        emoji: "🚗" },
  { id: "near_campus", label: "Near campus",    emoji: "📍" },
  { id: "amenities",   label: "Pool/Gym",       emoji: "🏊" },
];

const BED_OPTIONS = [1, 2, 3, 4, 5];

function next18Months(): Array<{ value: string; label: string }> {
  const now = new Date();
  const out: Array<{ value: string; label: string }> = [];
  for (let i = 0; i < 18; i++) {
    const d = new Date(now.getFullYear(), now.getMonth() + i, 1);
    const value = `${d.getFullYear()}-${String(d.getMonth() + 1).padStart(2, "0")}`;
    const label = d.toLocaleString("en-US", { month: "long", year: "numeric" });
    out.push({ value, label });
  }
  return out;
}

const INITIAL_QUIZ: Quiz = {
  budget: 650,
  moveIn: "",
  moveOut: "",
  beds: null,
  musts: [],
  vibes: [],
};

function buildPreferences(q: Quiz): string {
  const must = q.musts.length
    ? `Must-haves: ${q.musts.map((id) => MUST_OPTIONS.find((m) => m.id === id)?.label ?? id).join(", ")}.`
    : "";
  const vibe = q.vibes.length ? `Lifestyle: ${q.vibes.join(", ")}.` : "";
  return [
    `Budget around $${q.budget}/month (flexible ±10%).`,
    q.beds ? `Looking for ${q.beds}+ bedrooms.` : "",
    q.moveIn ? `Move in: ${q.moveIn}.` : "",
    q.moveOut ? `Move out: ${q.moveOut}.` : "",
    must,
    vibe,
  ].filter(Boolean).join(" ");
}

// ============================================================
// Page
// ============================================================

function FindMyMatchPage() {
  const navigate = useNavigate();
  const { user } = useSession();
  const { data: profile } = useMyProfile();
  const match = useServerFn(findMyMatch);
  const { data: listings = [] } = useQuery({ queryKey: ["listings"], queryFn: fetchListings });

  const monthOptions = useMemo(() => next18Months(), []);
  const hasProfileVibes = (profile?.vibe_tags?.length ?? 0) > 0;
  const totalSteps = hasProfileVibes ? 4 : 5;

  const [step, setStep] = useState(1);
  const [quiz, setQuiz] = useState<Quiz>(INITIAL_QUIZ);
  const [busy, setBusy] = useState(false);
  const [showResults, setShowResults] = useState(false);
  const [results, setResults] = useState<Array<{ id: string; score: number; why: string }>>([]);
  const [selected, setSelected] = useState<Listing | null>(null);

  const canNext = useMemo(() => {
    if (step === 1) return quiz.budget > 0;
    if (step === 2) return !!quiz.moveIn && !!quiz.moveOut;
    if (step === 3) return quiz.beds !== null;
    return true;
  }, [step, quiz]);

  async function submit() {
    setBusy(true);
    setShowResults(true);
    try {
      const prefs = buildPreferences({
        ...quiz,
        vibes: hasProfileVibes ? (profile?.vibe_tags ?? []) : quiz.vibes,
      });
      // Show the "finding your matches" animation for at least 1.5s
      const [r] = await Promise.all([
        match({ data: { preferences: prefs } }),
        new Promise((res) => setTimeout(res, 1500)),
      ]);
      setResults(r.matches);
    } catch (e: unknown) {
      const msg = e instanceof Error ? e.message : String(e);
      if (msg.includes("429")) toast.error("AI rate limit — wait a moment.");
      else if (msg.includes("402")) toast.error("AI credits exhausted.");
      else toast.error("Match failed: " + msg);
      setShowResults(false);
    } finally {
      setBusy(false);
    }
  }

  function retake() {
    // Preserve answers so the user can tweak.
    setShowResults(false);
    setResults([]);
    setStep(1);
  }

  async function notifyMe() {
    if (!user) {
      navigate({ to: "/auth", search: { mode: "up" } });
      return;
    }
    try {
      const moveInDate = quiz.moveIn ? `${quiz.moveIn}-01` : null;
      const moveOutDate = quiz.moveOut ? `${quiz.moveOut}-01` : null;
      const title = `${quiz.beds ?? ""}BR sublease around $${quiz.budget}/mo`.trim();
      const description = buildPreferences({
        ...quiz,
        vibes: hasProfileVibes ? (profile?.vibe_tags ?? []) : quiz.vibes,
      });
      const insertRow = {
        user_id: user.id,
        campus_id: profile?.campus_id ?? null,
        title,
        description,
        max_price: quiz.budget,
        beds_min: quiz.beds,
        furnished: quiz.musts.includes("furnished") ? true : null,
        pet_friendly: quiz.musts.includes("pets") ? true : null,
        date_start: moveInDate,
        date_end: moveOutDate,
        is_active: true,
      };
      const { error } = await supabase
        .from("looking_for_posts")
        .insert(insertRow as never);
      if (error) throw error;
      toast.success("We'll email you when a match is posted ✨");
      navigate({ to: "/looking-for" });
    } catch (e: unknown) {
      const msg = e instanceof Error ? e.message : String(e);
      toast.error("Couldn't save: " + msg);
    }
  }

  // -----------------------------------------------------------
  // Results
  // -----------------------------------------------------------
  if (showResults) {
    return (
      <ResultsScreen
        busy={busy}
        results={results}
        listings={listings}
        quiz={quiz}
        onRetake={retake}
        onNotifyMe={notifyMe}
        onPickListing={setSelected}
        onPost={() => navigate({ to: "/looking-for" })}
        selected={selected}
        clearSelected={() => setSelected(null)}
      />
    );
  }

  // -----------------------------------------------------------
  // Quiz
  // -----------------------------------------------------------
  const progress = (step / totalSteps) * 100;

  return (
    <div className="min-h-[100dvh] bg-background flex flex-col">
      <header className="px-5 pt-5 pb-3">
        <div className="flex items-center justify-between">
          <Link
            to="/"
            className="inline-flex items-center gap-1 text-xs font-semibold text-muted-foreground hover:text-foreground"
          >
            <ChevronLeft className="h-3.5 w-3.5" /> Exit
          </Link>
          <div className="text-[11px] font-bold tabular-nums text-muted-foreground">
            Step {step} of {totalSteps}
          </div>
        </div>
        <div className="mt-3 h-1.5 w-full overflow-hidden rounded-full bg-muted">
          <div
            className="h-full rounded-full bg-primary transition-[width] duration-500 ease-out"
            style={{ width: `${progress}%` }}
          />
        </div>
      </header>

      <main className="flex-1 px-5 py-6 flex items-start sm:items-center justify-center">
        <div key={step} className="w-full max-w-md animate-fade-in">
          {step === 1 && (
            <BudgetStep value={quiz.budget} onChange={(v) => setQuiz({ ...quiz, budget: v })} />
          )}
          {step === 2 && (
            <DatesStep
              moveIn={quiz.moveIn}
              moveOut={quiz.moveOut}
              months={monthOptions}
              onChange={(p) => setQuiz({ ...quiz, ...p })}
            />
          )}
          {step === 3 && (
            <BedsStep value={quiz.beds} onChange={(v) => setQuiz({ ...quiz, beds: v })} />
          )}
          {step === 4 && (
            <MustsStep values={quiz.musts} onChange={(v) => setQuiz({ ...quiz, musts: v })} />
          )}
          {step === 5 && !hasProfileVibes && (
            <VibesStep values={quiz.vibes} onChange={(v) => setQuiz({ ...quiz, vibes: v })} />
          )}
        </div>
      </main>

      <footer className="px-5 pb-8 pt-2 lu-safe-bottom">
        <div className="mx-auto flex max-w-md items-center justify-between gap-3">
          <button
            onClick={() => setStep((s) => Math.max(1, s - 1))}
            disabled={step === 1}
            className="inline-flex h-11 items-center gap-1 rounded-xl px-3 text-sm font-bold text-muted-foreground disabled:opacity-30 hover:text-foreground"
          >
            <ArrowLeft className="h-4 w-4" /> Back
          </button>
          {step < totalSteps ? (
            <button
              onClick={() => setStep((s) => s + 1)}
              disabled={!canNext}
              className="inline-flex h-12 items-center gap-1 rounded-xl bg-primary px-6 text-sm font-extrabold text-primary-foreground shadow-card-md transition-transform hover:bg-primary-dark active:scale-[0.99] disabled:opacity-50"
            >
              Next <ChevronRight className="h-4 w-4" />
            </button>
          ) : (
            <button
              onClick={submit}
              disabled={!canNext}
              className="inline-flex h-12 items-center gap-2 rounded-xl bg-primary px-6 text-sm font-extrabold text-primary-foreground shadow-card-md transition-transform hover:bg-primary-dark active:scale-[0.99]"
            >
              <Target className="h-4 w-4" /> Find my matches
            </button>
          )}
        </div>
      </footer>
    </div>
  );
}

// ============================================================
// Step components
// ============================================================

function StepTitle({ children, sub }: { children: React.ReactNode; sub?: string }) {
  return (
    <div className="text-center mb-7">
      <h1 className="text-[26px] sm:text-[30px] font-black tracking-tight leading-tight">{children}</h1>
      {sub && <p className="mt-2 text-sm text-muted-foreground">{sub}</p>}
    </div>
  );
}

function BudgetStep({ value, onChange }: { value: number; onChange: (n: number) => void }) {
  return (
    <div>
      <StepTitle>What's your monthly budget?</StepTitle>
      <div className="rounded-3xl border bg-surface p-6 text-center shadow-card-sm">
        <div className="text-5xl font-black text-primary tabular-nums">
          ${value}
          <span className="text-base font-bold text-muted-foreground">/mo</span>
        </div>
        <input
          type="range"
          min={300}
          max={1500}
          step={25}
          value={value}
          onChange={(e) => onChange(Number(e.target.value))}
          className="mt-6 w-full accent-primary"
        />
        <div className="mt-1 flex justify-between text-[11px] font-semibold text-muted-foreground">
          <span>$300</span>
          <span>$1,500</span>
        </div>
      </div>
    </div>
  );
}

function DatesStep({
  moveIn, moveOut, months, onChange,
}: {
  moveIn: string; moveOut: string;
  months: Array<{ value: string; label: string }>;
  onChange: (p: Partial<Quiz>) => void;
}) {
  return (
    <div>
      <StepTitle>When do you need a place?</StepTitle>
      <div className="space-y-3">
        <MonthPicker label="Move in" value={moveIn} months={months} onChange={(v) => onChange({ moveIn: v })} />
        <MonthPicker label="Move out" value={moveOut} months={months} onChange={(v) => onChange({ moveOut: v })} />
      </div>
    </div>
  );
}

function MonthPicker({
  label, value, months, onChange,
}: {
  label: string; value: string;
  months: Array<{ value: string; label: string }>;
  onChange: (v: string) => void;
}) {
  return (
    <label className="block rounded-2xl border bg-surface px-4 py-3">
      <div className="text-[11px] font-bold uppercase tracking-wide text-muted-foreground">{label}</div>
      <select
        value={value}
        onChange={(e) => onChange(e.target.value)}
        className="mt-1 w-full bg-transparent text-lg font-bold focus:outline-none"
      >
        <option value="">Select month…</option>
        {months.map((m) => (
          <option key={m.value} value={m.value}>{m.label}</option>
        ))}
      </select>
    </label>
  );
}

function BedsStep({ value, onChange }: { value: number | null; onChange: (n: number) => void }) {
  return (
    <div>
      <StepTitle sub="Tap to select one">How many bedrooms?</StepTitle>
      <div className="grid grid-cols-5 gap-2.5">
        {BED_OPTIONS.map((n) => {
          const on = value === n;
          return (
            <button
              key={n}
              onClick={() => onChange(n)}
              className={cn(
                "h-16 rounded-2xl border-2 text-base font-extrabold transition-all active:scale-95",
                on
                  ? "border-primary bg-primary text-primary-foreground shadow-card-md scale-105"
                  : "border-border bg-surface text-foreground hover:border-primary/50",
              )}
              style={{ transitionTimingFunction: "cubic-bezier(0.34, 1.56, 0.64, 1)" }}
            >
              {n}{n === 5 ? "+" : ""}BR
            </button>
          );
        })}
      </div>
    </div>
  );
}

function MustsStep({ values, onChange }: { values: string[]; onChange: (v: string[]) => void }) {
  function toggle(id: string) {
    onChange(values.includes(id) ? values.filter((v) => v !== id) : [...values, id]);
  }
  return (
    <div>
      <StepTitle sub="Pick all that apply — or none.">Any must-haves?</StepTitle>
      <div className="grid grid-cols-2 gap-2.5">
        {MUST_OPTIONS.map((m) => {
          const on = values.includes(m.id);
          return (
            <button
              key={m.id}
              onClick={() => toggle(m.id)}
              className={cn(
                "h-14 rounded-2xl border-2 px-3 text-sm font-bold transition-all flex items-center gap-2 justify-center active:scale-95",
                on
                  ? "border-primary bg-primary text-primary-foreground"
                  : "border-border bg-surface text-foreground hover:border-primary/50",
              )}
            >
              <span className="text-lg" aria-hidden>{m.emoji}</span>
              <span>{m.label}</span>
            </button>
          );
        })}
      </div>
    </div>
  );
}

function VibesStep({ values, onChange }: { values: string[]; onChange: (v: string[]) => void }) {
  function toggle(tag: string) {
    if (values.includes(tag)) onChange(values.filter((v) => v !== tag));
    else if (values.length >= 2) toast("Pick up to 2 ✨", { duration: 1200 });
    else onChange([...values, tag]);
  }
  return (
    <div>
      <StepTitle sub="Pick up to 2">What's your living vibe?</StepTitle>
      <div className="grid grid-cols-2 gap-2.5">
        {VIBE_TAGS.slice(0, 6).map((t) => {
          const on = values.includes(t);
          return (
            <button
              key={t}
              onClick={() => toggle(t)}
              className={cn(
                "h-14 rounded-2xl border-2 px-3 text-sm font-bold transition-all flex items-center justify-center active:scale-95",
                on
                  ? "border-primary bg-primary text-primary-foreground"
                  : "border-border bg-surface text-foreground hover:border-primary/50",
              )}
            >
              {t}
            </button>
          );
        })}
      </div>
    </div>
  );
}

// ============================================================
// Results
// ============================================================

function ResultsScreen({
  busy, results, listings, quiz, onRetake, onNotifyMe, onPickListing, selected, clearSelected, onPost,
}: {
  busy: boolean;
  results: Array<{ id: string; score: number; why: string }>;
  listings: Listing[];
  quiz: Quiz;
  onRetake: () => void;
  onNotifyMe: () => void;
  onPickListing: (l: Listing) => void;
  selected: Listing | null;
  clearSelected: () => void;
  onPost: () => void;
}) {
  const navigate = useNavigate();
  const enriched = useMemo(
    () => results
      .map((r) => ({ ...r, listing: listings.find((l) => l.id === r.id) }))
      .filter((r): r is { id: string; score: number; why: string; listing: Listing } => !!r.listing),
    [results, listings],
  );

  if (busy) {
    return (
      <div className="min-h-[100dvh] grid place-items-center bg-background px-6 text-center">
        <div>
          <div className="relative mx-auto h-28 w-28">
            {["🏠", "🏡", "🏘️"].map((e, i) => (
              <div
                key={i}
                className="absolute inset-0 grid place-items-center text-5xl"
                style={{
                  animation: `lu-float 1.6s ease-in-out ${i * 0.3}s infinite`,
                }}
                aria-hidden
              >
                {e}
              </div>
            ))}
          </div>
          <div className="mt-6 text-lg font-extrabold">Finding your matches…</div>
          <div className="mt-1 text-sm text-muted-foreground">Scoring listings by fit</div>
        </div>
        <style>{`@keyframes lu-float { 0%,100% { transform: translateY(0); opacity: 0; } 40% { opacity: 1; } 50% { transform: translateY(-40px); opacity: 1; } 90% { opacity: 0; } }`}</style>
      </div>
    );
  }

  const summaryBits = [
    `$${quiz.budget - 50}–${quiz.budget + 100}/mo`,
    quiz.beds ? `${quiz.beds}BR` : null,
    quiz.moveIn && quiz.moveOut ? `${quiz.moveIn.slice(5)}–${quiz.moveOut.slice(5)}` : null,
    ...quiz.musts.map((id) => MUST_OPTIONS.find((m) => m.id === id)?.label).filter(Boolean),
  ].filter(Boolean) as string[];

  return (
    <div className="min-h-[100dvh] bg-background">
      <div className="mx-auto max-w-2xl px-5 pt-8 pb-24">
        <button
          onClick={onRetake}
          className="inline-flex items-center gap-1 text-xs font-semibold text-muted-foreground hover:text-foreground"
        >
          <ChevronLeft className="h-3.5 w-3.5" /> Adjust preferences
        </button>

        <div className="mt-3">
          <h1 className="text-2xl sm:text-3xl font-black tracking-tight">
            🎯 Your Top Matches
          </h1>
          <p className="mt-2 text-sm text-muted-foreground">
            Based on: <span className="font-semibold text-foreground">{summaryBits.join(" · ")}</span>
          </p>
        </div>

        {enriched.length === 0 ? (
          <EmptyMatches onNotifyMe={onNotifyMe} onPost={onPost} />
        ) : (
          <div className="mt-6 space-y-3">
            {enriched.map((r) => (
              <MatchCard
                key={r.id}
                match={r}
                quiz={quiz}
                onOpen={() => onPickListing(r.listing)}
              />
            ))}
            <button
              onClick={onRetake}
              className="mt-4 block w-full text-center text-xs font-semibold text-muted-foreground hover:text-foreground"
            >
              Adjust preferences →
            </button>
          </div>
        )}
      </div>

      <ListingDetailSheet
        listing={selected}
        open={!!selected}
        onOpenChange={(o) => !o && clearSelected()}
        onMessage={() => navigate({ to: "/auth", search: { mode: "in" } })}
        onViewProfile={() => {}}
      />
    </div>
  );
}

function MatchCard({
  match, quiz, onOpen,
}: {
  match: { id: string; score: number; why: string; listing: Listing };
  quiz: Quiz;
  onOpen: () => void;
}) {
  const l = match.listing;
  const photo = l.photos?.[0];

  // Build matched-criteria chips by comparing quiz answers vs listing facts.
  const chips: string[] = [];
  if (l.price <= quiz.budget * 1.1) chips.push("In budget");
  if (quiz.beds != null && l.beds >= quiz.beds) chips.push(`${l.beds}BR`);
  if (quiz.musts.includes("furnished") && l.furnished) chips.push("Furnished");
  if (quiz.musts.includes("utilities") && l.utilities_included) chips.push("Utilities incl");
  if (quiz.musts.includes("pets") && l.pet_friendly) chips.push("Pet friendly");
  if (quiz.musts.includes("parking") && l.parking) chips.push("Parking");
  if (quiz.moveIn && l.available_from) {
    const sameMonth = l.available_from.slice(0, 7) === quiz.moveIn;
    if (sameMonth) chips.push("Your dates");
  }

  const scoreTier =
    match.score >= 90 ? "bg-success text-white"
    : match.score >= 70 ? "bg-primary text-white"
    : "bg-muted text-muted-foreground";

  // Deal score: pull median for this campus+beds and compute label
  const { data: stats } = usePriceStats();
  const stat = findStat(stats, l.campus_id ?? undefined, l.beds);
  const dealLabel = computePriceLabel(l.price, stat);
  const dealDiff = stat ? Math.round(((l.price - Number(stat.median_price)) / Number(stat.median_price)) * 100) : null;

  return (
    <button
      onClick={onOpen}
      className="group relative block w-full overflow-hidden rounded-2xl border bg-surface text-left shadow-card-sm transition-all hover:shadow-card-md hover:-translate-y-0.5"
    >
      <div className="flex gap-3 p-3">
        <div className="relative h-24 w-24 sm:h-28 sm:w-28 shrink-0 overflow-hidden rounded-xl bg-muted">
          {photo ? (
            <img src={photo} alt={l.title} className="h-full w-full object-cover" />
          ) : (
            <div className="grid h-full w-full place-items-center text-3xl">🏠</div>
          )}
          <div className={cn(
            "absolute -right-1 -top-1 grid h-11 w-11 place-items-center rounded-full text-[11px] font-black shadow-card-md ring-2 ring-surface",
            scoreTier,
          )}>
            {match.score}%
          </div>
        </div>

        <div className="min-w-0 flex-1">
          <div className="flex items-start justify-between gap-2">
            <div className="min-w-0">
              <div className="truncate text-sm font-extrabold">
                ${l.price}<span className="text-muted-foreground">/mo</span> · {l.title}
              </div>
              {dealLabel !== "no_data" && (
                <div className="mt-0.5">
                  <span className={cn("inline-flex items-center gap-1 rounded-full px-2 py-0.5 text-[10px] font-bold", LABEL_META[dealLabel].tone)}>
                    {LABEL_META[dealLabel].icon} {LABEL_META[dealLabel].text}
                    {dealDiff != null && dealDiff !== 0 && (
                      <span className="opacity-80">· {dealDiff > 0 ? `+${dealDiff}%` : `${dealDiff}%`} vs median</span>
                    )}
                  </span>
                </div>
              )}
              <div className="mt-0.5 truncate text-xs text-muted-foreground">
                {l.beds}BR · {l.area ?? "Athens"}
                {l.available_from ? ` · ${new Date(l.available_from).toLocaleString("en-US", { month: "short" })}` : ""}
                {l.available_to ? `–${new Date(l.available_to).toLocaleString("en-US", { month: "short" })}` : ""}
                {l.furnished ? " · Furnished" : ""}
                {l.utilities_included ? " · Utils incl" : ""}
              </div>
            </div>
            <Heart className="h-4 w-4 text-muted-foreground/60 group-hover:text-destructive" />
          </div>

          {chips.length > 0 && (
            <div className="mt-2 flex flex-wrap gap-1">
              {chips.map((c) => (
                <span
                  key={c}
                  className="inline-flex items-center gap-1 rounded-full bg-success-light px-2 py-0.5 text-[10px] font-bold text-success"
                >
                  ✓ {c}
                </span>
              ))}
            </div>
          )}

          <p className="mt-2 text-[11px] italic text-muted-foreground line-clamp-2">
            "{match.why}"
          </p>

          <div className="mt-2 flex justify-end">
            <span className="inline-flex items-center gap-1 rounded-full bg-primary-light px-2.5 py-1 text-[11px] font-bold text-primary-dark">
              <MessageCircle className="h-3 w-3" /> View & message
            </span>
          </div>
        </div>
      </div>
    </button>
  );
}

function EmptyMatches({ onNotifyMe, onPost }: { onNotifyMe: () => void; onPost: () => void }) {
  return (
    <div className="mt-8 rounded-3xl border bg-surface p-7 text-center shadow-card-sm">
      <div className="text-5xl" aria-hidden>😔</div>
      <h2 className="mt-3 text-lg font-extrabold">No perfect matches yet</h2>
      <p className="mt-2 text-sm text-muted-foreground">
        But students are actively posting — a match could appear any day.
      </p>
      <div className="mt-5 space-y-2">
        <button
          onClick={onNotifyMe}
          className="inline-flex h-11 w-full items-center justify-center gap-1.5 rounded-xl bg-primary text-sm font-extrabold text-primary-foreground hover:bg-primary-dark"
        >
          <Bell className="h-4 w-4" /> Notify me when a match is posted
        </button>
        <button
          onClick={onPost}
          className="inline-flex h-11 w-full items-center justify-center gap-1.5 rounded-xl border-2 border-border bg-surface text-sm font-bold text-foreground hover:border-primary/40"
        >
          <ClipboardList className="h-4 w-4" /> Post what you're looking for instead
        </button>
      </div>
    </div>
  );
}

void Sparkles;
