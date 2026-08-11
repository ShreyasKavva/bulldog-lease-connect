/**
 * Q87 — Airbnb-style browse filter UI.
 *
 * Purely presentational: it renders the sticky pill search bar, the sort
 * dropdown, the bottom-sheet filter modal, the active filter pills and the
 * desktop bedroom quick-filter row. All state lives in the URL — this
 * component only calls `onPatch` / `onClearAll`.
 */
import { useEffect, useRef, useState } from "react";
import { Search, SlidersHorizontal, X as XIcon, ChevronDown, Minus, Plus } from "lucide-react";
import { Sheet, SheetContent, SheetTitle } from "@/components/ui/sheet";
import { Slider } from "@/components/ui/slider";
import { cn } from "@/lib/utils";

export type Sort = "newest" | "price_asc" | "price_desc" | "popular" | "ending_soon";

export type BrowseFilterValues = {
  q?: string;
  area?: string;
  min_price?: number;
  max_price?: number;
  bedrooms?: string;
  baths?: number;
  from?: string;
  to?: string;
  furnished?: 1;
  utilities?: 1;
  parking?: 1;
  pets?: 1;
  wifi?: 1;
  laundry?: 1;
  verified?: 1;
  sort?: Sort;
  /** Q147 — roommate preference filters (csv of option ids). */
  rm_looking?: string;
  rm_study?: string;
  rm_pets?: string;
  rm_smoking?: string;
};

type RoommateGroupKey = "rm_looking" | "rm_study" | "rm_pets" | "rm_smoking";

const ROOMMATE_GROUPS: Array<{
  key: RoommateGroupKey;
  label: string;
  options: ReadonlyArray<{ id: string; label: string }>;
}> = [
  {
    key: "rm_looking",
    label: "Looking for",
    options: [
      { id: "undergrad", label: "🎓 Undergrad" },
      { id: "grad_student", label: "🎓 Grad student" },
      { id: "young_professional", label: "💼 Young professional" },
      { id: "any", label: "🙌 Any" },
    ],
  },
  {
    key: "rm_study",
    label: "Study style",
    options: [
      { id: "early_bird", label: "🌅 Early bird" },
      { id: "night_owl", label: "🌙 Night owl" },
      { id: "flexible", label: "🔀 Flexible" },
    ],
  },
  {
    key: "rm_pets",
    label: "Pets",
    options: [
      { id: "ok", label: "🐾 Pets OK" },
      { id: "no", label: "🚫 No pets" },
    ],
  },
  {
    key: "rm_smoking",
    label: "Smoking",
    options: [
      { id: "no", label: "✅ Non-smoking" },
      { id: "ok", label: "🚬 Smoking OK" },
    ],
  },
];


const SORT_LABELS: Record<Sort, string> = {
  newest: "Newest",
  price_asc: "Lowest price",
  price_desc: "Highest price",
  popular: "Most popular",
  ending_soon: "Ending soon",
};

const AMENITIES: Array<{ key: keyof BrowseFilterValues; icon: string; label: string }> = [
  { key: "furnished", icon: "🛋", label: "Furnished" },
  { key: "utilities", icon: "⚡", label: "Utilities" },
  { key: "parking", icon: "🅿️", label: "Parking" },
  { key: "pets", icon: "🐾", label: "Pets OK" },
  { key: "wifi", icon: "🌐", label: "WiFi" },
  { key: "laundry", icon: "🏢", label: "Laundry" },
];

const BEDS = ["0", "1", "2", "3+"] as const;
const PRICE_MAX = 3000;

/** Q123 — browse price presets. `max: undefined` means "no upper bound". */
const PRICE_PRESETS: Array<{ label: string; min?: number; max?: number }> = [
  { label: "Under $700/mo", max: 700 },
  { label: "$700–$1,000/mo", min: 700, max: 1000 },
  { label: "$1,000–$1,500/mo", min: 1000, max: 1500 },
  { label: "$1,500+/mo", min: 1500 },
];

function bedLabel(b: string) {
  return b === "0" ? "Studio" : b === "3+" ? "3+BR" : `${b}BR`;
}

function shortDate(iso?: string) {
  if (!iso) return null;
  const d = new Date(`${iso}T00:00:00`);
  if (Number.isNaN(d.getTime())) return iso;
  return d.toLocaleDateString(undefined, { month: "short" });
}

export function BrowseFilterBar({
  values,
  onPatch,
  onClearAll,
  searchInput,
  onSearchInput,
  resultCount,
  placeLabel,
  initialFiltersOpen,
}: {
  values: BrowseFilterValues;
  onPatch: (patch: Partial<BrowseFilterValues>) => void;
  onClearAll: () => void;
  searchInput: string;
  onSearchInput: (v: string) => void;
  resultCount: number;
  placeLabel: string;
  /** Q96 — nav search on mobile deep-links here with the sheet open. */
  initialFiltersOpen?: boolean;
}) {
  const [filtersOpen, setFiltersOpen] = useState(!!initialFiltersOpen);
  const [sortOpen, setSortOpen] = useState(false);
  const [searchOpen, setSearchOpen] = useState(false);
  const [priceOpen, setPriceOpen] = useState(false);

  const activePricePreset = PRICE_PRESETS.find(
    (p) => values.min_price === p.min && values.max_price === p.max,
  );
  const priceButtonLabel = activePricePreset
    ? `Price: ${activePricePreset.label.replace("/mo", "")}`
    : values.min_price != null || values.max_price != null
      ? `Price: $${values.min_price ?? 0}–$${values.max_price ?? PRICE_MAX}`
      : "Price";

  const sort: Sort = values.sort ?? "newest";
  const bedSet = new Set((values.bedrooms ?? "").split(",").filter(Boolean));

  /** Q124 — any quick filter (bedroom / price / verified) active. */
  const quickActive =
    bedSet.size > 0 ||
    values.min_price != null ||
    values.max_price != null ||
    values.verified === 1;


  const activeCount =
    (values.q ? 1 : 0) +
    (values.area ? 1 : 0) +
    (values.min_price != null || values.max_price != null ? 1 : 0) +
    (bedSet.size ? 1 : 0) +
    (values.baths != null ? 1 : 0) +
    (values.from || values.to ? 1 : 0) +
    AMENITIES.filter((a) => values[a.key] === 1).length;

  // Local price range while dragging, synced from URL.
  const [range, setRange] = useState<[number, number]>([
    values.min_price ?? 0,
    values.max_price ?? PRICE_MAX,
  ]);
  useEffect(() => {
    setRange([values.min_price ?? 0, values.max_price ?? PRICE_MAX]);
  }, [values.min_price, values.max_price]);

  const sizeLabel = bedSet.size
    ? Array.from(bedSet).map(bedLabel).join(", ")
    : "Any size";
  const dateLabel =
    values.from || values.to
      ? `${shortDate(values.from) ?? "…"}–${shortDate(values.to) ?? "…"}`
      : "Any dates";

  function toggleBed(b: string) {
    const next = new Set(bedSet);
    if (next.has(b)) next.delete(b);
    else next.add(b);
    onPatch({ bedrooms: next.size ? Array.from(next).join(",") : undefined });
  }

  const pills: Array<{ label: string; clear: Partial<BrowseFilterValues> }> = [];
  if (values.q) pills.push({ label: `"${values.q}"`, clear: { q: undefined } });
  if (values.min_price != null || values.max_price != null)
    pills.push({
      label: `$${values.min_price ?? 0}–${values.max_price ?? PRICE_MAX}`,
      clear: { min_price: undefined, max_price: undefined },
    });
  for (const b of bedSet) pills.push({ label: bedLabel(b), clear: {} as never });
  if (values.baths != null)
    pills.push({ label: `${values.baths}+ bath`, clear: { baths: undefined } });
  if (values.from || values.to)
    pills.push({ label: dateLabel, clear: { from: undefined, to: undefined } });
  for (const a of AMENITIES)
    if (values[a.key] === 1) pills.push({ label: a.label, clear: { [a.key]: undefined } });
  if (values.verified === 1)
    pills.push({ label: "✓ Verified", clear: { verified: undefined } });

  return (
    <>
    {/* Q155 — slim sticky bar that animates in once the filter row scrolls away */}
    <div
      className={cn(
        "fixed inset-x-0 top-14 z-40 h-14 border-b border-border bg-surface/95 shadow-sm backdrop-blur-sm transition-transform duration-300",
        stuck ? "translate-y-0" : "pointer-events-none -translate-y-[150%]",
      )}
      aria-hidden={!stuck}
    >
      <div className="mx-auto flex h-full max-w-7xl items-center gap-2 px-4">
        <div className="hidden h-9 min-w-0 flex-1 items-center rounded-full border border-border bg-surface pl-3 pr-2 sm:flex">
          <Search className="mr-2 h-4 w-4 shrink-0 text-muted-foreground" />
          <input
            value={searchInput}
            onChange={(e) => onSearchInput(e.target.value)}
            placeholder="Search..."
            aria-label="Search subleases"
            className="min-w-0 flex-1 bg-transparent text-sm outline-none"
          />
        </div>
        <div className="flex min-w-0 flex-1 items-center gap-1.5 overflow-x-auto sm:flex-none">
          <button
            onClick={() => onPatch({ bedrooms: undefined })}
            className={cn(
              "shrink-0 rounded-full border border-border px-2.5 py-1 text-xs font-semibold",
              bedSet.size === 0 ? "border-foreground bg-foreground text-background" : "hover:border-foreground",
            )}
          >
            Any
          </button>
          {BEDS.map((b) => (
            <button
              key={b}
              onClick={() => toggleBed(b)}
              className={cn(
                "shrink-0 rounded-full border border-border px-2.5 py-1 text-xs font-semibold",
                bedSet.has(b) ? "border-foreground bg-foreground text-background" : "hover:border-foreground",
              )}
            >
              {bedLabel(b)}
            </button>
          ))}
        </div>
        <div className="relative shrink-0">
          <button
            onClick={() => setStickySortOpen((o) => !o)}
            className="inline-flex items-center gap-1 rounded-full border border-border px-2.5 py-1 text-xs font-semibold"
          >
            {SORT_LABELS[sort]}
            <ChevronDown className="h-3.5 w-3.5" />
          </button>
          {stickySortOpen && (
            <>
              <button
                className="fixed inset-0 z-40 cursor-default"
                aria-label="Close sort menu"
                onClick={() => setStickySortOpen(false)}
              />
              <div className="absolute right-0 top-full z-50 mt-2 w-44 overflow-hidden rounded-2xl border border-border bg-surface p-1.5 shadow-card-lg">
                {(Object.keys(SORT_LABELS) as Sort[]).map((k) => (
                  <button
                    key={k}
                    onClick={() => {
                      onPatch({ sort: k === "newest" ? undefined : k });
                      setStickySortOpen(false);
                    }}
                    className={cn(
                      "block w-full rounded-lg px-3 py-2 text-left text-sm font-semibold hover:bg-background",
                      sort === k && "bg-primary-light text-primary-dark",
                    )}
                  >
                    {SORT_LABELS[k]}
                  </button>
                ))}
              </div>
            </>
          )}
        </div>
      </div>
    </div>

    <div ref={barRef} className="z-30 border-b border-border bg-surface py-3">
      <div className="mx-auto max-w-7xl px-4">
        {/* PART A — compact pill search bar */}
        <div className="flex items-center gap-2">
          <div className="flex h-12 min-w-0 flex-1 items-center rounded-full border border-border bg-surface pl-4 pr-1.5 shadow-sm">
            <Search className="mr-2 h-4 w-4 shrink-0 text-muted-foreground" />

            {/* Q149 — always-on keyword search with clear button */}
            <input
              value={searchInput}
              onChange={(e) => onSearchInput(e.target.value)}
              onFocus={() => setSearchOpen(true)}
              placeholder={placeLabel === "Search subleases" ? "Search by title or description…" : `Search ${placeLabel}…`}
              aria-label="Search subleases"
              className="min-w-0 flex-1 bg-transparent text-sm outline-none"
            />
            {searchInput && (
              <button
                type="button"
                onClick={() => onSearchInput("")}
                aria-label="Clear search"
                className="mr-1 grid h-6 w-6 shrink-0 place-items-center rounded-full text-muted-foreground hover:bg-muted hover:text-foreground"
              >
                <XIcon className="h-3.5 w-3.5" />
              </button>
            )}

            <span className="mx-2 hidden h-5 w-px shrink-0 bg-border sm:block" />
            <button
              onClick={() => setFiltersOpen(true)}
              className="hidden shrink-0 truncate px-1 text-sm text-muted-foreground hover:text-foreground sm:block"
            >
              {dateLabel}
            </button>
            <span className="mx-2 hidden h-5 w-px shrink-0 bg-border sm:block" />
            <button
              onClick={() => setFiltersOpen(true)}
              className="hidden shrink-0 truncate px-1 text-sm text-muted-foreground hover:text-foreground sm:block"
            >
              {sizeLabel}
            </button>

            {/* PART E — sort dropdown */}
            <span className="mx-2 hidden h-5 w-px shrink-0 bg-border sm:block" />
            <div className="relative shrink-0">
              <button
                onClick={() => setSortOpen((o) => !o)}
                className="flex items-center gap-1 px-1 text-sm text-muted-foreground hover:text-foreground"
              >
                <span className="hidden sm:inline">Sort:</span>{" "}
                <span className="max-w-[6rem] truncate font-semibold text-foreground sm:max-w-none">{SORT_LABELS[sort]}</span>
                <ChevronDown className="h-3.5 w-3.5 shrink-0" />
              </button>

              {sortOpen && (
                <>
                  <button
                    className="fixed inset-0 z-40 cursor-default"
                    aria-label="Close sort menu"
                    onClick={() => setSortOpen(false)}
                  />
                  <div className="absolute right-0 top-full z-50 mt-2 w-48 overflow-hidden rounded-2xl border border-border bg-surface p-1.5 shadow-card-lg">
                    {(Object.keys(SORT_LABELS) as Sort[]).map((k) => (
                      <button
                        key={k}
                        onClick={() => {
                          onPatch({ sort: k === "newest" ? undefined : k });
                          setSortOpen(false);
                        }}
                        className={cn(
                          "block w-full rounded-lg px-3 py-2 text-left text-sm font-semibold hover:bg-background",
                          sort === k && "bg-primary-light text-primary-dark",
                        )}
                      >
                        {SORT_LABELS[k]}
                      </button>
                    ))}
                  </div>
                </>
              )}
            </div>

            <button
              onClick={() => setFiltersOpen(true)}
              className="ml-2 inline-flex h-9 shrink-0 items-center gap-1.5 rounded-full border border-border px-3 text-sm font-bold transition-transform active:scale-95"
            >
              <SlidersHorizontal className="h-4 w-4" />
              <span className="hidden xs:inline sm:inline">Filters</span>
              {activeCount > 0 && <span className="text-primary">({activeCount})</span>}
            </button>
            {activeCount > 0 && (
              <button
                onClick={onClearAll}
                className="ml-2 inline shrink-0 whitespace-nowrap text-sm text-muted-foreground underline-offset-2 hover:text-foreground hover:underline"
              >
                Clear all
              </button>
            )}

          </div>
        </div>


        {/* PART C — active filter pills */}
        {pills.length > 0 && (
          <div className="mt-2 flex flex-wrap items-center gap-2">
            {pills.map((p, i) => (
              <button
                key={`${p.label}-${i}`}
                onClick={() => {
                  const bedMatch = Array.from(bedSet).find((b) => bedLabel(b) === p.label);
                  if (bedMatch) toggleBed(bedMatch);
                  else onPatch(p.clear);
                }}
                className="inline-flex items-center gap-1 rounded-full bg-background px-3 py-1 text-sm font-medium hover:bg-border"
              >
                <XIcon className="h-3 w-3" />
                {p.label}
              </button>
            ))}
            <button
              onClick={onClearAll}
              className="text-sm font-bold text-primary underline-offset-2 hover:underline"
            >
              Clear all
            </button>
          </div>
        )}

        {/* PART D — desktop bedroom quick filter */}
        <div className="mt-2 hidden items-center gap-2 sm:flex">
          <button
            onClick={() => onPatch({ bedrooms: undefined })}
            className={cn(
              "rounded-full border border-border px-3 py-1 text-sm font-semibold transition-colors",
              bedSet.size === 0
                ? "border-foreground bg-foreground text-background"
                : "hover:border-foreground",
            )}
          >
            Any
          </button>
          {BEDS.map((b) => (
            <button
              key={b}
              onClick={() => toggleBed(b)}
              className={cn(
                "rounded-full border border-border px-3 py-1 text-sm font-semibold transition-colors",
                bedSet.has(b)
                  ? "border-foreground bg-foreground text-background"
                  : "hover:border-foreground",
              )}
            >
              {b === "0" ? "Studio" : b === "3+" ? "3+BR" : `${b}BR`}
            </button>
          ))}
          {/* Q123 — price preset dropdown (combinable with beds/verified) */}
          <div className="relative">
            <button
              onClick={() => setPriceOpen((o) => !o)}
              aria-expanded={priceOpen}
              className={cn(
                "inline-flex items-center gap-1 rounded-full border border-border px-3 py-1 text-sm font-semibold transition-colors",
                activePricePreset || values.min_price != null || values.max_price != null
                  ? "border-foreground bg-foreground text-background"
                  : "hover:border-foreground",
              )}
            >
              {priceButtonLabel}
              {values.min_price != null || values.max_price != null ? (
                <XIcon
                  className="h-3 w-3"
                  role="button"
                  aria-label="Clear price filter"
                  onClick={(e) => {
                    e.stopPropagation();
                    setPriceOpen(false);
                    onPatch({ min_price: undefined, max_price: undefined });
                  }}
                />
              ) : (
                <ChevronDown className="h-3.5 w-3.5" />
              )}
            </button>
            {priceOpen && (
              <>
                <button
                  className="fixed inset-0 z-40 cursor-default"
                  aria-label="Close price menu"
                  onClick={() => setPriceOpen(false)}
                />
                <div className="absolute left-0 top-full z-50 mt-2 w-52 overflow-hidden rounded-2xl border border-border bg-surface p-1.5 shadow-card-lg">
                  {PRICE_PRESETS.map((p) => {
                    const active =
                      values.min_price === p.min && values.max_price === p.max;
                    return (
                      <button
                        key={p.label}
                        onClick={() => {
                          onPatch(
                            active
                              ? { min_price: undefined, max_price: undefined }
                              : { min_price: p.min, max_price: p.max },
                          );
                          setPriceOpen(false);
                        }}
                        className={cn(
                          "block w-full rounded-lg px-3 py-2 text-left text-sm font-semibold hover:bg-background",
                          active && "bg-background text-foreground",
                        )}
                      >
                        {p.label}
                      </button>
                    );
                  })}
                </div>
              </>
            )}
          </div>

          {/* Q109 — verified-host quick filter */}
          <button
            onClick={() => onPatch({ verified: values.verified === 1 ? undefined : 1 })}
            aria-pressed={values.verified === 1}
            className={cn(
              "rounded-full border px-3 py-1 text-sm font-semibold transition-colors",
              values.verified === 1
                ? "border-emerald-200 bg-emerald-50 text-emerald-700 dark:border-emerald-500/30 dark:bg-emerald-500/10 dark:text-emerald-300"
                : "border-border text-muted-foreground hover:border-foreground",
            )}
          >
            ✓ Verified
          </button>

          {/* Q124 — clear all (only when a quick filter is active) */}
          {quickActive && (
            <button
              onClick={onClearAll}
              className="ml-auto cursor-pointer text-sm text-[#FF5A5F] hover:underline"
            >
              Clear all
            </button>
          )}
        </div>

        {/* Q124 — result count line, only while filtering */}
        {quickActive && (
          <p className="mt-2 hidden text-sm text-muted-foreground sm:block">
            Showing {resultCount} {resultCount === 1 ? "sublease" : "subleases"}
          </p>
        )}
      </div>


      {/* PART B — bottom-sheet filter modal */}
      <Sheet open={filtersOpen} onOpenChange={setFiltersOpen}>
        <SheetContent
          side="bottom"
          className="flex max-h-[85vh] flex-col gap-0 rounded-t-2xl p-0"
        >
          <div className="border-b border-border px-6 py-4">
            <SheetTitle className="text-base font-bold">Filters</SheetTitle>
          </div>

          <div className="flex-1 space-y-8 overflow-y-auto px-6 py-6">
            {/* Price */}
            <section>
              <h3 className="text-sm font-bold">Price range</h3>
              <p className="mt-1 text-sm text-muted-foreground">
                Min ${range[0]} – Max ${range[1]}
                {range[1] >= PRICE_MAX ? "+" : ""}
              </p>
              <Slider
                className="mt-5"
                value={range}
                min={0}
                max={PRICE_MAX}
                step={50}
                onValueChange={(v) => setRange([v[0]!, v[1]!] as [number, number])}
                onValueCommit={(v) =>
                  onPatch({
                    min_price: v[0]! > 0 ? v[0]! : undefined,
                    max_price: v[1]! < PRICE_MAX ? v[1]! : undefined,
                  })
                }
              />
            </section>

            {/* Bedrooms + bathrooms */}
            <section className="space-y-4">
              <Stepper
                label="Bedrooms"
                value={bedSet.size === 1 ? Number(Array.from(bedSet)[0]!.replace("+", "")) : null}
                display={bedSet.size ? Array.from(bedSet).map(bedLabel).join(", ") : "Any"}
                onChange={(n) =>
                  onPatch({ bedrooms: n == null ? undefined : n >= 3 ? "3+" : String(n) })
                }
                max={3}
              />
              <Stepper
                label="Bathrooms"
                value={values.baths ?? null}
                display={values.baths ? `${values.baths}+` : "Any"}
                onChange={(n) => onPatch({ baths: n ?? undefined })}
                max={4}
              />
            </section>

            {/* Amenities */}
            <section>
              <h3 className="text-sm font-bold">Amenities</h3>
              <div className="mt-3 grid grid-cols-2 gap-3 sm:grid-cols-3">
                {AMENITIES.map((a) => {
                  const on = values[a.key] === 1;
                  return (
                    <button
                      key={a.key as string}
                      onClick={() => onPatch({ [a.key]: on ? undefined : 1 })}
                      className={cn(
                        "flex items-center gap-2 rounded-xl border p-4 text-left text-sm font-semibold transition-colors",
                        on ? "border-foreground bg-background" : "border-border hover:border-foreground",
                      )}
                    >
                      <span className="text-base">{a.icon}</span>
                      {a.label}
                    </button>
                  );
                })}
              </div>
            </section>

            {/* Availability */}
            <section>
              <h3 className="text-sm font-bold">Availability</h3>
              <div className="mt-3 grid grid-cols-2 gap-3">
                <label className="flex flex-col gap-1 text-xs font-semibold text-muted-foreground">
                  Move-in
                  <input
                    type="date"
                    value={values.from ?? ""}
                    onChange={(e) => onPatch({ from: e.target.value || undefined })}
                    className="h-11 rounded-xl border border-border bg-surface px-3 text-sm text-foreground"
                  />
                </label>
                <label className="flex flex-col gap-1 text-xs font-semibold text-muted-foreground">
                  Move-out
                  <input
                    type="date"
                    value={values.to ?? ""}
                    onChange={(e) => onPatch({ to: e.target.value || undefined })}
                    className="h-11 rounded-xl border border-border bg-surface px-3 text-sm text-foreground"
                  />
                </label>
              </div>
            </section>

            {/* Q147 — roommate preferences */}
            <section>
              <h3 className="text-sm font-bold">Roommate preferences</h3>
              <div className="mt-3 space-y-4">
                {ROOMMATE_GROUPS.map((g) => {
                  const selected = new Set((values[g.key] ?? "").split(",").filter(Boolean));
                  return (
                    <div key={g.key}>
                      <p className="text-xs font-semibold text-muted-foreground">{g.label}</p>
                      <div className="mt-2 flex flex-wrap gap-2">
                        {g.options.map((o) => {
                          const on = selected.has(o.id);
                          return (
                            <button
                              key={o.id}
                              type="button"
                              aria-pressed={on}
                              onClick={() => {
                                const next = new Set(selected);
                                if (on) next.delete(o.id);
                                else next.add(o.id);
                                onPatch({
                                  [g.key]: next.size ? Array.from(next).join(",") : undefined,
                                } as Partial<BrowseFilterValues>);
                              }}
                              className={cn(
                                "rounded-full border px-3 py-1.5 text-sm transition-colors",
                                on
                                  ? "border-[#FF5A5F] bg-[#FF5A5F]/10 font-medium text-[#FF5A5F]"
                                  : "border-border text-muted-foreground hover:border-foreground",
                              )}
                            >
                              {o.label}
                            </button>
                          );
                        })}
                      </div>
                    </div>
                  );
                })}
              </div>
            </section>
          </div>


          <div
            className="flex items-center justify-between gap-3 border-t border-border px-6 py-3"
            style={{ paddingBottom: "max(env(safe-area-inset-bottom), 0.75rem)" }}
          >
            <button
              onClick={onClearAll}
              className="text-sm font-bold underline underline-offset-2"
            >
              Clear all
            </button>
            <button
              onClick={() => setFiltersOpen(false)}
              className="min-h-[44px] rounded-full bg-foreground px-6 text-sm font-bold text-background transition-transform active:scale-95"
            >
              Show {resultCount} listing{resultCount === 1 ? "" : "s"} →
            </button>
          </div>
        </SheetContent>
      </Sheet>
    </div>
  );
}

function Stepper({
  label,
  value,
  display,
  onChange,
  max,
}: {
  label: string;
  value: number | null;
  display: string;
  onChange: (n: number | null) => void;
  max: number;
}) {
  return (
    <div className="flex items-center justify-between">
      <span className="text-sm font-bold">{label}</span>
      <div className="flex items-center gap-3">
        <button
          aria-label={`Decrease ${label}`}
          disabled={value == null}
          onClick={() => onChange(value == null || value <= 0 ? null : value - 1)}
          className="grid h-9 w-9 place-items-center rounded-full border border-border disabled:opacity-40"
        >
          <Minus className="h-4 w-4" />
        </button>
        <span className="min-w-[4.5rem] text-center text-sm font-semibold">{display}</span>
        <button
          aria-label={`Increase ${label}`}
          onClick={() => onChange(Math.min(max, (value ?? -1) + 1))}
          className="grid h-9 w-9 place-items-center rounded-full border border-border"
        >
          <Plus className="h-4 w-4" />
        </button>
      </div>
    </div>
  );
}
