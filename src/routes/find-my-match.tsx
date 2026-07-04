import { createFileRoute, Link } from "@tanstack/react-router";
import { useMemo, useState } from "react";
import { useQuery } from "@tanstack/react-query";
import { fetchListings } from "@/lib/leaseup/queries";
import { fetchCampuses, type Campus } from "@/lib/leaseup/campuses";
import { ChevronLeft, ChevronRight, ArrowLeft, Search, SlidersHorizontal } from "lucide-react";
import { cn } from "@/lib/utils";
import type { Listing } from "@/lib/leaseup/types";

export const Route = createFileRoute("/find-my-match")({
  head: () => ({
    meta: [
      { title: "Find My Match — LeaseUp" },
      { name: "description", content: "Answer four quick questions and get student sublease matches by campus, budget, move-in month, and bedrooms." },
      { property: "og:title", content: "Find My Match — LeaseUp" },
      { property: "og:description", content: "Answer four quick questions and get student sublease matches by campus, budget, move-in month, and bedrooms." },
      { property: "og:url", content: "https://leasup.co/find-my-match" },
      { property: "og:type", content: "website" },
    ],
    links: [{ rel: "canonical", href: "https://leasup.co/find-my-match" }],
  }),
  component: FindMyMatchPage,
});

type Quiz = {
  campusId: string;
  campusLabel: string;
  budget: BudgetOption | null;
  moveInMonth: string;
  customDate: string;
  beds: number | null;
};

type BudgetOption = { label: string; min: number; max: number };

const INITIAL_QUIZ: Quiz = {
  campusId: "",
  campusLabel: "",
  budget: null,
  moveInMonth: "",
  customDate: "",
  beds: null,
};

const FEATURED_CAMPUS_LABELS = ["UGA", "UF", "Alabama", "Auburn", "GT"];
const FEATURED_CAMPUS_ALIASES: Record<string, string[]> = {
  UGA: ["uga", "university of georgia"],
  UF: ["uf", "university of florida", "florida"],
  Alabama: ["alabama", "university of alabama"],
  Auburn: ["auburn", "auburn university"],
  GT: ["gt", "georgia tech", "georgia institute of technology"],
};
const BUDGET_OPTIONS: BudgetOption[] = [
  { label: "Under $500", min: 0, max: 499 },
  { label: "$500–$650", min: 500, max: 650 },
  { label: "$650–$800", min: 650, max: 800 },
  { label: "$800+", min: 800, max: 10000 },
];
const MOVE_IN_OPTIONS = ["May", "June", "July", "August", "December"];
const BED_OPTIONS = [
  { label: "Studio", value: 0 },
  { label: "1BR", value: 1 },
  { label: "2BR", value: 2 },
  { label: "3BR+", value: 3 },
  { label: "Any", value: null },
];

function FindMyMatchPage() {
  const { data: listings = [] } = useQuery({ queryKey: ["listings"], queryFn: fetchListings });
  const { data: campuses = [], isLoading: campusesLoading } = useQuery({ queryKey: ["campuses"], queryFn: fetchCampuses });

  const totalSteps = 4;
  const [step, setStep] = useState(1);
  const [quiz, setQuiz] = useState<Quiz>(INITIAL_QUIZ);
  const [showResults, setShowResults] = useState(false);

  const canNext = useMemo(() => {
    if (step === 1) return !!quiz.campusId;
    if (step === 2) return !!quiz.budget;
    if (step === 3) return !!quiz.moveInMonth || !!quiz.customDate;
    if (step === 4) return true;
    return true;
  }, [step, quiz]);

  function changeAnswers() {
    setShowResults(false);
    setStep(1);
  }

  if (showResults) {
    return (
      <ResultsScreen
        listings={listings}
        quiz={quiz}
        onChangeAnswers={changeAnswers}
      />
    );
  }

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
          <div className="text-[11px] font-bold tabular-nums text-gray-500">
            Step {step} of {totalSteps}
          </div>
        </div>
        <div className="mt-3 h-1.5 w-full overflow-hidden rounded-full bg-gray-100">
          <div
            className="h-full rounded-full bg-primary transition-[width] duration-500 ease-out"
            style={{ width: `${progress}%` }}
          />
        </div>
      </header>

      <main className="flex-1 px-5 py-6 flex items-start sm:items-center justify-center">
        <div key={step} className="w-full max-w-md animate-fade-in">
          {step === 1 && <CampusStep campuses={campuses} loading={campusesLoading} value={quiz.campusId} onPick={(campus) => setQuiz({ ...quiz, campusId: campus.id, campusLabel: campus.short_name || campus.name })} />}
          {step === 2 && <BudgetStep value={quiz.budget} onChange={(budget) => setQuiz({ ...quiz, budget })} />}
          {step === 3 && <MoveInStep month={quiz.moveInMonth} customDate={quiz.customDate} onChange={(patch) => setQuiz({ ...quiz, ...patch })} />}
          {step === 4 && <BedsStep value={quiz.beds} onChange={(beds) => setQuiz({ ...quiz, beds })} />}
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
              onClick={() => setShowResults(true)}
              disabled={!canNext}
              className="inline-flex h-12 items-center gap-2 rounded-xl bg-primary px-6 text-sm font-extrabold text-primary-foreground shadow-card-md transition-transform hover:bg-primary-dark active:scale-[0.99]"
            >
              <SlidersHorizontal className="h-4 w-4" /> Show matches
            </button>
          )}
        </div>
      </footer>
    </div>
  );
}

function StepTitle({ children, sub }: { children: React.ReactNode; sub?: string }) {
  return (
    <div className="text-center mb-7">
      <h1 className="text-[26px] sm:text-[30px] font-black tracking-tight leading-tight">{children}</h1>
      {sub && <p className="mt-2 text-sm text-muted-foreground">{sub}</p>}
    </div>
  );
}

function CampusStep({ campuses, loading, value, onPick }: { campuses: Campus[]; loading: boolean; value: string; onPick: (campus: Campus) => void }) {
  const [search, setSearch] = useState("");
  const featured = useMemo(() => {
    return FEATURED_CAMPUS_LABELS.map((label) => {
      const aliases = FEATURED_CAMPUS_ALIASES[label].map((alias) => alias.toLowerCase());
      const campus = campuses.find((candidate) => {
        const haystack = [candidate.short_name, candidate.name, candidate.slug].filter(Boolean).join(" ").toLowerCase();
        return aliases.some((alias) => haystack.includes(alias));
      });
      return campus ? { ...campus, short_name: label } : null;
    }).filter(Boolean) as Campus[];
  }, [campuses]);
  const filtered = useMemo(() => {
    const query = search.trim().toLowerCase();
    if (!query) return campuses.slice(0, 12);
    return campuses.filter((campus) => [campus.name, campus.short_name, campus.city, campus.state].join(" ").toLowerCase().includes(query)).slice(0, 16);
  }, [campuses, search]);

  return (
    <div>
      <StepTitle sub="Pick your campus to filter real listings.">Where are you looking?</StepTitle>
      <div className="grid grid-cols-2 gap-2.5 sm:grid-cols-5">
        {(featured.length ? featured : campuses.slice(0, 5)).map((campus) => <CampusChip key={campus.id} campus={campus} active={value === campus.id} onPick={onPick} />)}
      </div>
      <label className="mt-5 flex h-12 items-center gap-2 rounded-xl border border-gray-200 bg-white px-3 shadow-sm">
        <Search className="h-4 w-4 text-gray-400" />
        <input value={search} onChange={(e) => setSearch(e.target.value)} placeholder="Search any campus" className="min-w-0 flex-1 bg-transparent text-sm font-semibold outline-none placeholder:text-gray-400" />
      </label>
      <div className="mt-3 max-h-[260px] overflow-y-auto rounded-2xl border border-gray-100 bg-white p-2 shadow-sm">
        {loading && <div className="px-3 py-6 text-center text-sm text-gray-500">Loading campuses…</div>}
        {!loading && filtered.length === 0 && <div className="px-3 py-6 text-center text-sm text-gray-500">No campus found.</div>}
        {filtered.map((campus) => <CampusRow key={campus.id} campus={campus} active={value === campus.id} onPick={onPick} />)}
      </div>
    </div>
  );
}

function CampusChip({ campus, active, onPick }: { campus: Campus; active: boolean; onPick: (campus: Campus) => void }) {
  return (
    <button onClick={() => onPick(campus)} className={cn("h-14 rounded-2xl border-2 px-3 text-sm font-extrabold transition-all active:scale-95", active ? "border-gray-900 bg-gray-900 text-white shadow-card-md" : "border-gray-200 bg-white text-gray-800 hover:border-primary/50")}>
      {campus.short_name || campus.name}
    </button>
  );
}

function CampusRow({ campus, active, onPick }: { campus: Campus; active: boolean; onPick: (campus: Campus) => void }) {
  return (
    <button onClick={() => onPick(campus)} className={cn("flex w-full items-center justify-between rounded-xl px-3 py-2.5 text-left transition", active ? "bg-primary-light text-primary-dark" : "hover:bg-gray-50")}>
      <span><span className="font-bold">{campus.name}</span><span className="block text-xs text-gray-500">{campus.city}, {campus.state}</span></span>
      <span className="text-xs font-extrabold text-gray-500">{campus.short_name}</span>
    </button>
  );
}

function BudgetStep({ value, onChange }: { value: BudgetOption | null; onChange: (budget: BudgetOption) => void }) {
  return (
    <div>
      <StepTitle>What's your monthly budget?</StepTitle>
      <div className="grid grid-cols-2 gap-2.5">
        {BUDGET_OPTIONS.map((option) => <OptionButton key={option.label} active={value?.label === option.label} onClick={() => onChange(option)}>{option.label}</OptionButton>)}
      </div>
    </div>
  );
}

function MoveInStep({ month, customDate, onChange }: { month: string; customDate: string; onChange: (patch: Partial<Quiz>) => void }) {
  return (
    <div>
      <StepTitle sub="Use a quick month chip or pick an exact date.">When do you want to move in?</StepTitle>
      <div className="grid grid-cols-2 gap-2.5 sm:grid-cols-3">
        {MOVE_IN_OPTIONS.map((option) => <OptionButton key={option} active={month === option} onClick={() => onChange({ moveInMonth: option, customDate: "" })}>{option}</OptionButton>)}
      </div>
      <label className="mt-5 block rounded-2xl border bg-white px-4 py-3 shadow-sm">
        <span className="text-[11px] font-bold uppercase text-gray-500">Custom date</span>
        <input type="date" value={customDate} onChange={(e) => onChange({ customDate: e.target.value, moveInMonth: "" })} className="mt-1 w-full bg-transparent text-lg font-bold outline-none" />
      </label>
    </div>
  );
}

function BedsStep({ value, onChange }: { value: number | null; onChange: (beds: number | null) => void }) {
  return (
    <div>
      <StepTitle sub="Studio means beds = 0.">How many bedrooms?</StepTitle>
      <div className="grid grid-cols-2 gap-2.5 sm:grid-cols-5">
        {BED_OPTIONS.map((option) => <OptionButton key={option.label} active={value === option.value} onClick={() => onChange(option.value)}>{option.label}</OptionButton>)}
      </div>
    </div>
  );
}

function OptionButton({ active, onClick, children }: { active: boolean; onClick: () => void; children: React.ReactNode }) {
  return (
    <button onClick={onClick} className={cn("h-16 rounded-2xl border-2 px-3 text-base font-extrabold transition-all active:scale-95", active ? "border-primary bg-primary text-primary-foreground shadow-card-md scale-[1.02]" : "border-gray-200 bg-white text-gray-800 hover:border-primary/50")}>
      {children}
    </button>
  );
}

function monthMatches(dateValue: string | null, quiz: Quiz) {
  if (!dateValue) return false;
  const date = new Date(`${dateValue}T00:00:00`);
  if (Number.isNaN(date.getTime())) return false;
  if (quiz.customDate) {
    const custom = new Date(`${quiz.customDate}T00:00:00`);
    return Math.abs(date.getTime() - custom.getTime()) <= 1000 * 60 * 60 * 24 * 21;
  }
  return date.toLocaleString("en-US", { month: "long" }) === quiz.moveInMonth;
}

function scoreListing(listing: Listing, quiz: Quiz, relaxedBudget = false) {
  let score = 40;
  const reasons: string[] = [];
  if (listing.campus_id === quiz.campusId) { score += 25; reasons.push(quiz.campusLabel); }
  if (quiz.budget) {
    const within = listing.price >= quiz.budget.min && listing.price <= quiz.budget.max;
    const close = listing.price >= quiz.budget.min - 100 && listing.price <= quiz.budget.max + 100;
    if (within) { score += 25; reasons.push("in budget"); }
    else if (relaxedBudget && close) { score += 12; reasons.push("near your budget"); }
  }
  if (quiz.beds === null) { score += 8; reasons.push("bed-flexible"); }
  else if (quiz.beds === 3 ? listing.beds >= 3 : listing.beds === quiz.beds) { score += 15; reasons.push(quiz.beds === 0 ? "studio" : `${listing.beds}BR`); }
  if (monthMatches(listing.available_from, quiz)) { score += 15; reasons.push("move-in fits"); }
  return { score: Math.min(99, score), why: reasons.length ? reasons.join(" · ") : "Closest available fit" };
}

function getMatches(listings: Listing[], quiz: Quiz) {
  const exact = listings.filter((listing) => {
    if (listing.campus_id !== quiz.campusId) return false;
    if (quiz.budget && (listing.price < quiz.budget.min || listing.price > quiz.budget.max)) return false;
    if (quiz.beds !== null && (quiz.beds === 3 ? listing.beds < 3 : listing.beds !== quiz.beds)) return false;
    if (!monthMatches(listing.available_from, quiz)) return false;
    return true;
  }).map((listing) => ({ listing, ...scoreListing(listing, quiz) })).sort((a, b) => b.score - a.score);

  if (exact.length > 0) return { matches: exact, relaxed: false };

  const relaxed = listings.filter((listing) => {
    if (listing.campus_id !== quiz.campusId) return false;
    if (quiz.budget && (listing.price < quiz.budget.min - 100 || listing.price > quiz.budget.max + 100)) return false;
    if (quiz.beds !== null && (quiz.beds === 3 ? listing.beds < 3 : listing.beds !== quiz.beds)) return false;
    return true;
  }).map((listing) => ({ listing, ...scoreListing(listing, quiz, true) })).sort((a, b) => b.score - a.score);

  return { matches: relaxed, relaxed: true };
}

function ResultsScreen({ listings, quiz, onChangeAnswers }: {
  listings: Listing[];
  quiz: Quiz;
  onChangeAnswers: () => void;
}) {
  const { matches, relaxed } = useMemo(() => getMatches(listings, quiz), [listings, quiz]);

  const summaryBits = [
    quiz.campusLabel,
    quiz.budget?.label,
    quiz.customDate || quiz.moveInMonth,
    quiz.beds === null ? "Any beds" : quiz.beds === 0 ? "Studio" : quiz.beds === 3 ? "3BR+" : `${quiz.beds}BR`,
  ].filter(Boolean) as string[];

  return (
    <div className="min-h-[100dvh] bg-background">
      <div className="mx-auto max-w-2xl px-5 pt-8 pb-24">
        <button
          onClick={onChangeAnswers}
          className="inline-flex items-center gap-1 text-xs font-semibold text-muted-foreground hover:text-foreground"
        >
          <ChevronLeft className="h-3.5 w-3.5" /> Change answers
        </button>

        <div className="mt-3">
          <h1 className="text-2xl sm:text-3xl font-black tracking-tight">
            🎯 Your Top Matches
          </h1>
          <p className="mt-2 text-sm text-muted-foreground">
            Based on: <span className="font-semibold text-foreground">{summaryBits.join(" · ")}</span>
          </p>
          {relaxed && <p className="mt-2 rounded-xl bg-amber-50 px-3 py-2 text-xs font-semibold text-amber-800">No exact matches yet, so these are the closest listings within about $100 of your budget.</p>}
        </div>

        {matches.length === 0 ? (
          <EmptyMatches onChangeAnswers={onChangeAnswers} />
        ) : (
          <div className="mt-6 space-y-3">
            {matches.slice(0, 12).map((match) => <MatchCard key={match.listing.id} match={match} />)}
            <ActionRow onChangeAnswers={onChangeAnswers} />
          </div>
        )}
      </div>
    </div>
  );
}

function MatchCard({ match }: { match: { score: number; why: string; listing: Listing } }) {
  const l = match.listing;
  const photo = l.photo_urls?.[0];

  return (
    <Link to="/" search={{ listing: l.id } as any} className="group relative block w-full overflow-hidden rounded-2xl border bg-surface text-left shadow-card-sm transition-all hover:shadow-card-md hover:-translate-y-0.5">
      <div className="flex gap-3 p-3">
        <div className="relative h-24 w-24 sm:h-28 sm:w-28 shrink-0 overflow-hidden rounded-xl bg-muted">
          {photo ? (
            <img src={photo} alt={l.title} className="h-full w-full object-cover" />
          ) : (
            <div className="grid h-full w-full place-items-center text-3xl">🏠</div>
          )}
          <div className="absolute -right-1 -top-1 grid h-11 w-11 place-items-center rounded-full bg-primary text-[11px] font-black text-white shadow-card-md ring-2 ring-surface">
            {match.score}%
          </div>
        </div>

        <div className="min-w-0 flex-1">
          <div className="flex items-start justify-between gap-2">
            <div className="min-w-0">
              <div className="truncate text-sm font-extrabold">
                ${l.price}<span className="text-muted-foreground">/mo</span> · {l.title}
              </div>
              <div className="mt-0.5 truncate text-xs text-muted-foreground">
                {l.beds}BR · {l.area ?? "Athens"}
                {l.available_from ? ` · ${new Date(l.available_from).toLocaleString("en-US", { month: "short" })}` : ""}
                {l.available_to ? `–${new Date(l.available_to).toLocaleString("en-US", { month: "short" })}` : ""}
                {l.furnished ? " · Furnished" : ""}
                {l.utilities_included ? " · Utils incl" : ""}
              </div>
            </div>
          </div>

          <div className="mt-2 flex flex-wrap gap-1">
            <span className="inline-flex items-center gap-1 rounded-full bg-success-light px-2 py-0.5 text-[10px] font-bold text-success">✓ {match.why}</span>
          </div>

          <p className="mt-2 text-[11px] italic text-muted-foreground line-clamp-2">
            {l.description || "Tap to view photos, details, and message the poster."}
          </p>

          <div className="mt-2 flex justify-end">
            <span className="inline-flex items-center gap-1 rounded-full bg-primary-light px-2.5 py-1 text-[11px] font-bold text-primary-dark">
              Browse all details →
            </span>
          </div>
        </div>
      </div>
    </Link>
  );
}

function ActionRow({ onChangeAnswers }: { onChangeAnswers: () => void }) {
  return (
    <div className="mt-5 grid grid-cols-2 gap-2">
      <button onClick={onChangeAnswers} className="inline-flex h-12 items-center justify-center rounded-xl border-2 border-gray-200 bg-white text-sm font-extrabold text-gray-900 hover:border-primary/40">← Change answers</button>
      <Link to="/" className="inline-flex h-12 items-center justify-center rounded-xl bg-primary text-sm font-extrabold text-primary-foreground hover:bg-primary-dark">Browse all →</Link>
    </div>
  );
}

function EmptyMatches({ onChangeAnswers }: { onChangeAnswers: () => void }) {
  return (
    <div className="mt-8 rounded-3xl border bg-surface p-7 text-center shadow-card-sm">
      <div className="text-5xl" aria-hidden>😔</div>
      <h2 className="mt-3 text-lg font-extrabold">No matches yet</h2>
      <p className="mt-2 text-sm text-muted-foreground">
        Try a different campus, month, or bedroom count — students post new subleases daily.
      </p>
      <ActionRow onChangeAnswers={onChangeAnswers} />
    </div>
  );
}
