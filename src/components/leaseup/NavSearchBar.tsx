/**
 * Q96 — compact, functional Where | When | Who search bar for the nav.
 *
 * Desktop: three popover segments (campus list, date range, tenant stepper)
 * that submit to /browse. Mobile: a single pill that jumps to /browse and
 * opens the Q87 filter sheet.
 */
import { useState } from "react";
import { useNavigate } from "@tanstack/react-router";
import { MapPin, Calendar as CalendarIcon, Users, Search, Minus, Plus } from "lucide-react";
import { useQuery } from "@tanstack/react-query";
import { Popover, PopoverContent, PopoverTrigger } from "@/components/ui/popover";
import { searchCampuses } from "@/lib/leaseup/campuses";
import { EMPTY_SEARCH, type SearchState } from "./SearchPill";
import { buildBrowseSearch } from "@/lib/leaseup/search-params";
import { CampusAutocomplete } from "./CampusAutocomplete";
import { cn } from "@/lib/utils";

function short(d: Date | null) {
  return d ? d.toLocaleDateString(undefined, { month: "short", day: "numeric" }) : null;
}
function toInput(d: Date | null) {
  return d ? d.toISOString().slice(0, 10) : "";
}
function fromInput(v: string) {
  return v ? new Date(`${v}T00:00:00`) : null;
}

export function NavSearchBar() {
  const navigate = useNavigate();
  const [value, setValue] = useState<SearchState>(EMPTY_SEARCH);
  const [open, setOpen] = useState<null | "where" | "when" | "who">(null);
  const [q, setQ] = useState("");

  // Q179 — ranked server-side search across every accredited US campus.
  // Lazy: only runs once a field is opened.
  const [debouncedQ, setDebouncedQ] = useState("");
  useEffect(() => {
    const t = window.setTimeout(() => setDebouncedQ(q), 200);
    return () => window.clearTimeout(t);
  }, [q]);
  const { data: matches = [] } = useQuery({
    queryKey: ["campus-search", debouncedQ.trim().toLowerCase()],
    queryFn: () => searchCampuses(debouncedQ, 8),
    staleTime: 60_000,
    enabled: open !== null,
    placeholderData: (prev) => prev,
  });

  function submit() {
    setOpen(null);
    navigate({ to: "/browse", search: buildBrowseSearch(value) as any });
  }

  const dateLabel = value.from
    ? `${short(value.from)}${value.to ? ` – ${short(value.to)}` : ""}`
    : "When";
  const whoLabel = value.guests > 1 ? `${value.guests} tenants` : "Who";
  const seg = "truncate max-w-[110px] text-left hover:text-gray-900 dark:hover:text-foreground";

  return (
    <>
      {/* Desktop */}
      <div className="hidden min-w-0 flex-1 max-w-md items-center gap-2 rounded-full border border-gray-200 bg-white px-4 py-2 text-sm text-gray-600 shadow-sm hover:shadow lg:flex dark:border-border dark:bg-background">
        <Popover open={open === "where"} onOpenChange={(o) => setOpen(o ? "where" : null)}>
          <PopoverTrigger asChild>
            <button className={cn("flex min-w-0 items-center gap-1.5", seg)}>
              <MapPin className="h-3.5 w-3.5 shrink-0" />
              <span className="truncate">{value.where || "Where"}</span>
            </button>
          </PopoverTrigger>
          <PopoverContent align="start" sideOffset={10} className="w-80 rounded-2xl p-3">
            <CampusAutocomplete
              autoFocus
              value={value.where}
              placeholder="Search campuses…"
              onSelect={(c) => {
                setValue((v) => ({ ...v, where: c.short_name ?? c.name, campusId: c.id }));
                setOpen("when");
              }}
              onClear={() => setValue((v) => ({ ...v, where: "", campusId: null }))}
            />
          </PopoverContent>

        </Popover>

        <span className="text-gray-300">|</span>

        <Popover open={open === "when"} onOpenChange={(o) => setOpen(o ? "when" : null)}>
          <PopoverTrigger asChild>
            <button className={cn("flex min-w-0 items-center gap-1.5", seg)}>
              <CalendarIcon className="h-3.5 w-3.5 shrink-0" />
              <span className="truncate">{dateLabel}</span>
            </button>
          </PopoverTrigger>
          <PopoverContent align="center" sideOffset={10} className="w-72 rounded-2xl p-4">
            <label className="mb-1 block text-xs font-semibold">Move in</label>
            <input
              type="date"
              value={toInput(value.from)}
              onChange={(e) => setValue((v) => ({ ...v, from: fromInput(e.target.value) }))}
              className="mb-3 w-full rounded-xl border border-border px-3 py-2 text-sm outline-none"
            />
            <label className="mb-1 block text-xs font-semibold">Move out</label>
            <input
              type="date"
              value={toInput(value.to)}
              onChange={(e) => setValue((v) => ({ ...v, to: fromInput(e.target.value) }))}
              className="w-full rounded-xl border border-border px-3 py-2 text-sm outline-none"
            />
          </PopoverContent>
        </Popover>

        <span className="text-gray-300">|</span>

        <Popover open={open === "who"} onOpenChange={(o) => setOpen(o ? "who" : null)}>
          <PopoverTrigger asChild>
            <button className={cn("flex min-w-0 items-center gap-1.5", seg)}>
              <Users className="h-3.5 w-3.5 shrink-0" />
              <span className="truncate">{whoLabel}</span>
            </button>
          </PopoverTrigger>
          <PopoverContent align="end" sideOffset={10} className="w-64 rounded-2xl p-4">
            <div className="flex items-center justify-between">
              <span className="text-sm font-semibold">Tenants</span>
              <div className="flex items-center gap-3">
                <button
                  disabled={value.guests <= 1}
                  onClick={() => setValue((v) => ({ ...v, guests: Math.max(1, v.guests - 1) }))}
                  className="grid h-8 w-8 place-items-center rounded-full border disabled:opacity-40"
                ><Minus className="h-4 w-4" /></button>
                <span className="w-4 text-center text-sm font-bold tabular-nums">{value.guests}</span>
                <button
                  disabled={value.guests >= 10}
                  onClick={() => setValue((v) => ({ ...v, guests: Math.min(10, v.guests + 1) }))}
                  className="grid h-8 w-8 place-items-center rounded-full border disabled:opacity-40"
                ><Plus className="h-4 w-4" /></button>
              </div>
            </div>
          </PopoverContent>
        </Popover>

        <button
          onClick={submit}
          aria-label="Search subleases"
          className="ml-auto grid h-7 w-7 shrink-0 place-items-center rounded-full bg-gray-900 text-white dark:bg-white dark:text-gray-900"
        >
          <Search className="h-3.5 w-3.5" />
        </button>
      </div>

      {/* Mobile: jump to /browse and open the filter sheet */}
      <button
        onClick={() => navigate({ to: "/browse", search: { openFilters: 1 } as any })}
        className="flex min-w-0 flex-1 items-center gap-2 rounded-full border border-gray-200 bg-white px-4 py-2 text-sm text-gray-600 shadow-sm lg:hidden dark:border-border dark:bg-background"
      >
        <Search className="h-3.5 w-3.5 shrink-0" />
        <span className="truncate">Where to?</span>
      </button>
    </>
  );
}
