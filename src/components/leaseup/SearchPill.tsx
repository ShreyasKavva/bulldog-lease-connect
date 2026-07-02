/**
 * Airbnb-style "Where / When / Who" search pill.
 * Fully controlled — parent owns state and filters the listing rails.
 */
import { useEffect, useRef, useState } from "react";
import { Search, X, Minus, Plus } from "lucide-react";
import { Popover, PopoverContent, PopoverTrigger } from "@/components/ui/popover";
import { Calendar } from "@/components/ui/calendar";
import { useQuery } from "@tanstack/react-query";
import { fetchCampuses, type Campus } from "@/lib/leaseup/campuses";
import { cn } from "@/lib/utils";

export type SearchState = {
  where: string;                  // free text or campus short_name
  campusId: string | null;
  from: Date | null;
  to: Date | null;
  guests: number;
};

export const EMPTY_SEARCH: SearchState = {
  where: "", campusId: null, from: null, to: null, guests: 1,
};

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
  const [openField, setOpenField] = useState<null | "where" | "when" | "who">(null);
  const { data: campuses = [] } = useQuery({
    queryKey: ["campuses"], queryFn: fetchCampuses, staleTime: Infinity,
  });
  const [q, setQ] = useState(value.where);
  useEffect(() => setQ(value.where), [value.where]);

  const matches = q.trim().length
    ? campuses.filter(
        (c) =>
          c.name.toLowerCase().includes(q.toLowerCase()) ||
          c.short_name?.toLowerCase().includes(q.toLowerCase()) ||
          c.city.toLowerCase().includes(q.toLowerCase()),
      ).slice(0, 6)
    : campuses.slice(0, 6);

  function pickCampus(c: Campus) {
    onChange({ ...value, where: c.short_name ?? c.name, campusId: c.id });
    setOpenField("when");
  }

  const whenLabel =
    value.from && value.to
      ? `${fmt(value.from)} – ${fmt(value.to)}`
      : value.from ? `${fmt(value.from)} – …` : "Add dates";
  const whoLabel = value.guests <= 1 ? "Add guests" : `${value.guests} guests`;

  return (
    <div className="mx-auto flex w-full max-w-3xl items-stretch rounded-full bg-surface shadow-card-md ring-1 ring-border">
      {/* WHERE */}
      <Popover open={openField === "where"} onOpenChange={(o) => setOpenField(o ? "where" : null)}>
        <PopoverTrigger asChild>
          <button className="flex flex-1 flex-col items-start rounded-full px-6 py-2.5 text-left hover:bg-background">
            <span className="text-[11px] font-bold uppercase text-foreground">Where</span>
            <span className={cn("text-sm", value.where ? "font-semibold text-foreground" : "text-muted-foreground")}>
              {value.where || "Search campuses"}
            </span>
          </button>
        </PopoverTrigger>
        <PopoverContent align="start" className="w-80 p-2">
          <div className="mb-2 flex items-center gap-2 rounded-full bg-background px-3 py-2">
            <Search className="h-4 w-4 text-muted-foreground" />
            <input
              autoFocus
              value={q}
              onChange={(e) => setQ(e.target.value)}
              placeholder="Search campus, city…"
              className="flex-1 bg-transparent text-sm outline-none"
            />
            {q && (
              <button onClick={() => { setQ(""); onChange({ ...value, where: "", campusId: null }); }}>
                <X className="h-4 w-4 text-muted-foreground" />
              </button>
            )}
          </div>
          <div className="max-h-64 overflow-y-auto">
            {matches.map((c) => (
              <button
                key={c.id}
                onClick={() => pickCampus(c)}
                className="flex w-full items-center gap-3 rounded-lg px-2 py-2 text-left hover:bg-background"
              >
                <div className="grid h-9 w-9 place-items-center rounded-md bg-primary-light text-lg">🎓</div>
                <div className="min-w-0">
                  <div className="truncate text-sm font-semibold">{c.name}</div>
                  <div className="truncate text-xs text-muted-foreground">{c.city}, {c.state}</div>
                </div>
              </button>
            ))}
            {matches.length === 0 && (
              <div className="p-4 text-center text-xs text-muted-foreground">No campuses match "{q}"</div>
            )}
          </div>
        </PopoverContent>
      </Popover>

      <span className="my-2 w-px bg-border" />

      {/* WHEN */}
      <Popover open={openField === "when"} onOpenChange={(o) => setOpenField(o ? "when" : null)}>
        <PopoverTrigger asChild>
          <button className="flex flex-1 flex-col items-start rounded-full px-6 py-2.5 text-left hover:bg-background">
            <span className="text-[11px] font-bold uppercase text-foreground">When</span>
            <span className={cn("text-sm", value.from ? "font-semibold text-foreground" : "text-muted-foreground")}>
              {whenLabel}
            </span>
          </button>
        </PopoverTrigger>
        <PopoverContent align="start" className="w-auto p-2">
          <Calendar
            mode="range"
            selected={{ from: value.from ?? undefined, to: value.to ?? undefined }}
            onSelect={(r: any) => onChange({ ...value, from: r?.from ?? null, to: r?.to ?? null })}
            numberOfMonths={2}
          />
          <div className="mt-2 flex justify-end">
            <button
              onClick={() => onChange({ ...value, from: null, to: null })}
              className="text-xs font-semibold text-muted-foreground hover:text-foreground"
            >Clear</button>
          </div>
        </PopoverContent>
      </Popover>

      <span className="my-2 w-px bg-border" />

      {/* WHO */}
      <Popover open={openField === "who"} onOpenChange={(o) => setOpenField(o ? "who" : null)}>
        <PopoverTrigger asChild>
          <button className="flex flex-1 flex-col items-start rounded-full px-6 py-2.5 text-left hover:bg-background">
            <span className="text-[11px] font-bold uppercase text-foreground">Who</span>
            <span className={cn("text-sm", value.guests > 1 ? "font-semibold text-foreground" : "text-muted-foreground")}>
              {whoLabel}
            </span>
          </button>
        </PopoverTrigger>
        <PopoverContent align="end" className="w-72 p-4">
          <div className="flex items-center justify-between">
            <div>
              <div className="text-sm font-bold">Guests / roommates</div>
              <div className="text-xs text-muted-foreground">How many people?</div>
            </div>
            <div className="flex items-center gap-3">
              <button
                onClick={() => onChange({ ...value, guests: Math.max(1, value.guests - 1) })}
                className="grid h-8 w-8 place-items-center rounded-full border hover:bg-background disabled:opacity-40"
                disabled={value.guests <= 1}
              ><Minus className="h-4 w-4" /></button>
              <span className="w-4 text-center text-sm font-bold tabular-nums">{value.guests}</span>
              <button
                onClick={() => onChange({ ...value, guests: Math.min(8, value.guests + 1) })}
                className="grid h-8 w-8 place-items-center rounded-full border hover:bg-background"
              ><Plus className="h-4 w-4" /></button>
            </div>
          </div>
        </PopoverContent>
      </Popover>

      {/* SEARCH */}
      <button
        onClick={() => { setOpenField(null); onSearch?.(); }}
        className="my-1.5 mr-1.5 flex items-center gap-2 rounded-full bg-primary px-4 text-primary-foreground hover:bg-primary-dark"
      >
        <Search className="h-4 w-4" />
        <span className="hidden text-sm font-bold sm:inline">Search</span>
      </button>
    </div>
  );
}
