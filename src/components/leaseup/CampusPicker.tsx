import { Link } from "@tanstack/react-router";
import { useQuery } from "@tanstack/react-query";
import { ChevronDown, MapPin } from "lucide-react";
import { useState, useRef, useEffect } from "react";
import { fetchCampuses } from "@/lib/leaseup/campuses";
import { cn } from "@/lib/utils";

export function CampusPicker({ activeSlug }: { activeSlug?: string }) {
  const { data: campuses = [] } = useQuery({ queryKey: ["campuses"], queryFn: fetchCampuses });
  const [open, setOpen] = useState(false);
  const ref = useRef<HTMLDivElement>(null);

  useEffect(() => {
    function close(e: MouseEvent) {
      if (ref.current && !ref.current.contains(e.target as Node)) setOpen(false);
    }
    document.addEventListener("mousedown", close);
    return () => document.removeEventListener("mousedown", close);
  }, []);

  const active = campuses.find(c => c.slug === activeSlug);
  const label = active?.short_name ?? "UGA";

  return (
    <div className="relative" ref={ref}>
      <button
        onClick={() => setOpen(o => !o)}
        className="flex items-center gap-1 rounded-full bg-background px-2.5 py-1.5 text-xs font-bold hover:bg-border"
      >
        <MapPin className="h-3.5 w-3.5 text-primary" />
        {label}
        <ChevronDown className="h-3 w-3 opacity-60" />
      </button>
      {open && (
        <div className="absolute left-0 top-full mt-1 w-64 rounded-xl border bg-surface p-1 shadow-card-md z-50 max-h-96 overflow-y-auto">
          <div className="px-3 py-2 text-[10px] uppercase tracking-wider text-muted-foreground font-bold">Campuses</div>
          {campuses.map(c => (
            <Link
              key={c.id}
              to="/sublease/$slug"
              params={{ slug: c.slug }}
              onClick={() => setOpen(false)}
              className={cn(
                "flex items-center justify-between rounded-lg px-3 py-2 text-sm hover:bg-background",
                activeSlug === c.slug && "bg-primary-light text-primary-dark",
              )}
            >
              <span className="font-semibold">{c.short_name}</span>
              <span className="text-[10px] text-muted-foreground">{c.city}, {c.state}</span>
            </Link>
          ))}
        </div>
      )}
    </div>
  );
}
