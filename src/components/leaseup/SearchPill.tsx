/**
 * Airbnb-style "Where / When / Who" search bar.
 *
 * Behavior matches Airbnb closely:
 *  - Three segments on a soft track. The active segment lifts to a white
 *    pill with an elevated shadow; the rest dim to a subtle gray.
 *  - Hovering an inactive segment tints it and hides the dividers touching it.
 *  - The right-side Search button is a circle by default; when any segment is
 *    active it expands to show the "Search" label.
 *  - Popovers open below the pressed segment (aligned to that segment).
 */
import { useEffect, useRef, useState } from "react";
import { Search, X, Minus, Plus } from "lucide-react";
import { useNavigate } from "@tanstack/react-router";
import { Popover, PopoverContent, PopoverTrigger } from "@/components/ui/popover";
import { Calendar } from "@/components/ui/calendar";
import { type Campus } from "@/lib/leaseup/campuses";
import { CampusAutocomplete } from "./CampusAutocomplete";
import { useIsMobile } from "@/hooks/use-mobile";
import { cn } from "@/lib/utils";


const QUICK_PICKS = [
  { emoji: "🐾", name: "University of Georgia", slug: "university-of-georgia" },
  { emoji: "🌰", name: "Ohio State University", slug: "ohio-state" },
  { emoji: "🤘", name: "University of Texas at Austin", slug: "ut-austin" },
  { emoji: "🐝", name: "Georgia Tech", slug: "georgia-tech" },
  { emoji: "🏛️", name: "UVA", slug: "university-of-virginia" },
];

export type SearchState = {
  where: string;
  campusId: string | null;
  from: Date | null;
  to: Date | null;
  guests: number;
};

export const EMPTY_SEARCH: SearchState = {
  where: "", campusId: null, from: null, to: null, guests: 1,
};

type Field = "where" | "when" | "who";

function fmt(d: Date | null) {
  if (!d) return null;
  return d.toLocaleDateString(undefined, { month: "short", day: "numeric" });
}

export function SearchPill({
  value, onChange, onSearch,
}: {
  value: SearchState;
  onChange: (v: SearchState) => void;
  onSearch?: () => void;
}) {
  const navigate = useNavigate();
  const isMobile = useIsMobile();

  const [openField, setOpenField] = useState<null | Field>(null);
  const firedRef = useRef(false);
  const [hoverField, setHoverField] = useState<null | Field>(null);
  function pickCampus(c: Campus) {
    onChange({ ...value, where: c.short_name ?? c.name, campusId: c.id });
    setOpenField("when");
  }

  const whenLabel =
    value.from && value.to
      ? `${fmt(value.from)} – ${fmt(value.to)}`
      : value.from ? `${fmt(value.from)} – Select end date` : "Move-in – Move-out";
  const whoLabel = value.guests <= 1 ? "How many students" : `${value.guests} students`;

  // Active/hover state drives the raised-pill look and divider hiding.
  const active = (f: Field) => openField === f;
  const focused = (f: Field) => openField === f || hoverField === f;
  const segmentClass = (f: Field) =>
    cn(
      "group relative flex w-full flex-col items-start rounded-2xl px-4 py-3 text-left transition-colors sm:w-auto sm:rounded-full sm:px-6 sm:py-3.5",
      active(f)
        ? "bg-surface shadow-[0_6px_20px_rgba(0,0,0,0.12)]"
        : "hover:bg-black/[0.04] dark:hover:bg-white/[0.06]",
    );

  // Left divider is hidden when this segment OR the one to its left is focused.
  const showDivider = (leftOf: Field) => {
    const rightOf: Field = leftOf === "when" ? "where" : "when";
    return !focused(leftOf) && !focused(rightOf);
  };

  const anyActive = openField !== null;

  const canSearch = value.where.trim().length > 0;

  return (
    <div
      onKeyDown={(e) => {
        if (e.key === "Enter" && canSearch) {
          e.preventDefault();
          setOpenField(null);
          onSearch?.();
        }
      }}
      className={cn(
        "mx-auto flex w-full max-w-3xl flex-col items-stretch rounded-3xl border p-2 transition-shadow sm:flex-row sm:items-stretch sm:rounded-full sm:p-0",
        anyActive
          ? "bg-black/[0.04] dark:bg-white/[0.04] border-transparent shadow-[0_4px_24px_rgba(0,0,0,0.08)]"
          : "bg-surface border-border shadow-[0_1px_2px_rgba(0,0,0,0.04),0_8px_24px_rgba(0,0,0,0.08)]",
      )}

    >
      {/* WHERE */}
      <Popover modal={false} open={openField === "where"} onOpenChange={(o) => setOpenField(o ? "where" : null)}>
        <PopoverTrigger asChild>
          <button
            onMouseEnter={() => setHoverField("where")}
            onMouseLeave={() => setHoverField(null)}
            className={cn(segmentClass("where"), "flex-[1.2]")}
          >
            <span className="text-[12px] font-semibold text-foreground">Where</span>
            <span className={cn("mt-0.5 text-sm truncate w-full", value.where ? "font-medium text-foreground" : "text-muted-foreground")}>
              {value.where || "Search campuses"}
            </span>
          </button>
        </PopoverTrigger>
        <PopoverContent align="start" sideOffset={12} className="w-[min(420px,calc(100vw-2rem))] rounded-3xl p-4 shadow-2xl border">
          <div className="rounded-full bg-background px-4 py-2.5 ring-1 ring-border">
            <CampusAutocomplete
              autoFocus
              value={value.where}
              placeholder="Search campus, city…"
              onSelect={pickCampus}
              onClear={() => onChange({ ...value, where: "", campusId: null })}
            />
          </div>
          {/* Q120 — quick-picks: jump straight to a campus landing page. */}
          <div className="mt-3 flex flex-wrap gap-2">
            {QUICK_PICKS.map((p) => (
              <button
                key={p.slug}
                type="button"
                onClick={() => {
                  onChange({ ...value, where: p.name, campusId: null });
                  setOpenField(null);
                  navigate({ to: "/campus/$slug", params: { slug: p.slug } });
                }}
                className="rounded-full border border-border bg-white px-3 py-1.5 text-sm shadow-sm hover:bg-background dark:bg-surface"
              >
                {p.emoji} {p.name}
              </button>
            ))}
          </div>
        </PopoverContent>

      </Popover>

      <span className={cn("my-2.5 hidden w-px bg-border transition-opacity sm:block", showDivider("where") ? "opacity-100" : "opacity-0")} />

      {/* WHEN */}
      <Popover modal={false} open={openField === "when"} onOpenChange={(o) => setOpenField(o ? "when" : null)}>
        <PopoverTrigger asChild>
          <button
            onMouseEnter={() => setHoverField("when")}
            onMouseLeave={() => setHoverField(null)}
            className={cn(segmentClass("when"), "flex-1")}
          >
            <span className="text-[12px] font-semibold text-foreground">When</span>
            <span className={cn("mt-0.5 text-sm truncate w-full", value.from ? "font-medium text-foreground" : "text-muted-foreground")}>
              {whenLabel}
            </span>
          </button>
        </PopoverTrigger>
        <PopoverContent align="center" sideOffset={12} className="w-auto max-w-[calc(100vw-2rem)] rounded-3xl p-4 shadow-2xl border">
          <Calendar
            mode="range"
            selected={{ from: value.from ?? undefined, to: value.to ?? undefined }}
            onSelect={(r: any) => {
              const from = r?.from ?? null;
              let to = r?.to ?? null;
              // A half-finished range (single click) must never submit from === to.
              if (from && to && new Date(from).toDateString() === new Date(to).toDateString()) to = null;
              onChange({ ...value, from, to });
            }}
            numberOfMonths={isMobile ? 1 : 2}
            className="pointer-events-auto"
          />

          <div className="mt-2 flex justify-between px-2">
            <button
              onClick={() => onChange({ ...value, from: null, to: null })}
              className="text-xs font-semibold underline underline-offset-2 text-foreground hover:text-primary"
            >Clear dates</button>
            <button
              onClick={() => setOpenField("who")}
              className="text-xs font-semibold text-primary hover:text-primary-dark"
            >Next →</button>
          </div>
        </PopoverContent>
      </Popover>

      <span className={cn("my-2.5 hidden w-px bg-border transition-opacity sm:block", showDivider("when") ? "opacity-100" : "opacity-0")} />

      {/* WHO */}
      <Popover modal={false} open={openField === "who"} onOpenChange={(o) => setOpenField(o ? "who" : null)}>
        <PopoverTrigger asChild>
          <button
            onMouseEnter={() => setHoverField("who")}
            onMouseLeave={() => setHoverField(null)}
            className={cn(segmentClass("who"), "flex-1")}
          >
            <span className="text-[12px] font-semibold text-foreground">Who</span>
            <span className={cn("mt-0.5 text-sm truncate w-full", value.guests > 1 ? "font-medium text-foreground" : "text-muted-foreground")}>
              {whoLabel}
            </span>
          </button>
        </PopoverTrigger>
        <PopoverContent align="end" sideOffset={12} className="w-80 rounded-3xl p-5 shadow-2xl border">
          <div className="flex items-center justify-between">
            <div>
              <div className="text-sm font-bold">Roommates</div>
              <div className="text-xs text-muted-foreground">How many people?</div>
            </div>
            <div className="flex items-center gap-3">
              <button
                onClick={() => onChange({ ...value, guests: Math.max(1, value.guests - 1) })}
                className="grid h-8 w-8 place-items-center rounded-full border hover:border-foreground disabled:opacity-40"
                disabled={value.guests <= 1}
              ><Minus className="h-4 w-4" /></button>
              <span className="w-4 text-center text-sm font-bold tabular-nums">{value.guests}</span>
              <button
                onClick={() => onChange({ ...value, guests: Math.min(8, value.guests + 1) })}
                className="grid h-8 w-8 place-items-center rounded-full border hover:border-foreground"
              ><Plus className="h-4 w-4" /></button>
            </div>
          </div>
        </PopoverContent>
      </Popover>

      {/* SEARCH — own layout space (no overlap with WHO) so the first click always lands,
          even while a popover is open. pointerdown fires before Radix's dismiss layer. */}
      <button
        onPointerDown={(e) => {
          if (!canSearch) return;
          e.preventDefault();
          firedRef.current = true;
          setOpenField(null);
          onSearch?.();
        }}
        onClick={() => {
          if (firedRef.current) { firedRef.current = false; return; }
          setOpenField(null);
          onSearch?.();
        }}
        disabled={!canSearch}
        className={cn(
          "relative z-[60] mt-2 flex h-12 w-full shrink-0 items-center justify-center gap-2 rounded-full bg-primary text-primary-foreground shadow-md transition-all hover:bg-primary-dark disabled:cursor-not-allowed disabled:opacity-50 disabled:hover:bg-primary sm:mt-0 sm:my-2 sm:mr-2 sm:ml-1 sm:self-center",
          anyActive ? "sm:w-auto sm:px-5" : "sm:w-12 sm:justify-center",
        )}
        aria-label="Search"
      >
        <Search className="h-4 w-4" />
        <span className={cn("text-sm font-semibold", anyActive ? "" : "sm:hidden")}>Search</span>
      </button>

    </div>
  );
}
