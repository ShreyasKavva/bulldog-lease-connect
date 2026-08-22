import { useQuery } from "@tanstack/react-query";
import { useEffect, useRef, useState } from "react";
import { ChevronDown, MapPin, Search } from "lucide-react";
import { fetchCampuses, campusMatchesQuery, type Campus } from "@/lib/leaseup/campuses";
import { cn } from "@/lib/utils";

export function MapCampusSelector({
  activeId,
  onSelect,
}: {
  activeId: string | null;
  onSelect: (c: Campus) => void;
}) {
  const { data: campuses = [] } = useQuery({
    queryKey: ["campuses"],
    queryFn: fetchCampuses,
    staleTime: Infinity,
  });
  const [open, setOpen] = useState(false);
  const [q, setQ] = useState("");
  const ref = useRef<HTMLDivElement>(null);

  useEffect(() => {
    function close(e: MouseEvent) {
      if (ref.current && !ref.current.contains(e.target as Node)) setOpen(false);
    }
    document.addEventListener("mousedown", close);
    return () => document.removeEventListener("mousedown", close);
  }, []);

  const active = campuses.find((c) => c.id === activeId);
  const label = active?.short_name ?? active?.name ?? "Pick a campus";
  const filtered = q ? campuses.filter((c) => campusMatchesQuery(c, q)) : campuses;

  return (
    <div className="relative pointer-events-auto" ref={ref}>
      <button
        onClick={() => setOpen((o) => !o)}
        className="flex items-center gap-1.5 rounded-full bg-surface px-3 py-1.5 text-xs font-bold shadow-card-md hover:bg-background"
      >
        <MapPin className="h-3.5 w-3.5 text-primary" />
        <span className="max-w-[140px] truncate">{label}</span>
        <ChevronDown className="h-3 w-3 opacity-60" />
      </button>
      {open && (
        <div className="absolute left-0 top-full mt-1.5 w-72 rounded-2xl border border-border bg-surface p-2 shadow-card-lg z-50">
          <div className="relative mb-1.5">
            <Search className="absolute left-2.5 top-1/2 h-3.5 w-3.5 -translate-y-1/2 text-muted-foreground" />
            <input
              autoFocus
              value={q}
              onChange={(e) => setQ(e.target.value)}
              placeholder="Search campuses…"
              className="w-full rounded-lg border border-border bg-background py-1.5 pl-7 pr-2 text-xs font-medium outline-none focus:border-primary"
            />
          </div>
          <div className="max-h-72 overflow-y-auto">
            {filtered.map((c) => (
              <button
                key={c.id}
                onClick={() => {
                  onSelect(c);
                  setOpen(false);
                  setQ("");
                }}
                className={cn(
                  "flex w-full items-center justify-between rounded-lg px-3 py-2 text-left text-sm hover:bg-background",
                  activeId === c.id && "bg-primary-light text-primary-dark",
                )}
              >
                <span className="font-semibold">{c.short_name ?? c.name}</span>
                <span className="text-[10px] text-muted-foreground">
                  {c.city}, {c.state}
                </span>
              </button>
            ))}
            {filtered.length === 0 && (
              <div className="px-3 py-6 text-center text-xs text-muted-foreground">
                No campuses match "{q}"
              </div>
            )}
          </div>
        </div>
      )}
    </div>
  );
}
