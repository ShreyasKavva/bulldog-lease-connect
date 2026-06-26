import { Link } from "@tanstack/react-router";
import { NotificationsBell } from "@/components/leaseup/NotificationsBell";
import { useMyProfile } from "@/lib/leaseup/use-session";
import { useQuery } from "@tanstack/react-query";
import { fetchCampuses } from "@/lib/leaseup/campuses";
import { useMemo } from "react";

export function TopBar({ onOpenMessages, transparent }: { onOpenMessages: () => void; transparent?: boolean }) {
  const { data: profile } = useMyProfile();
  const { data: campuses = [] } = useQuery({ queryKey: ["campuses"], queryFn: fetchCampuses, staleTime: Infinity });
  const myCampus = useMemo(
    () => campuses.find((c) => c.id === profile?.campus_id),
    [campuses, profile?.campus_id],
  );

  return (
    <header
      className={
        "pointer-events-auto absolute inset-x-0 top-0 z-30 flex h-14 items-center justify-between px-3 " +
        (transparent
          ? "bg-gradient-to-b from-white/95 to-white/0"
          : "border-b border-border bg-surface")
      }
    >
      <Link to="/" className="flex items-center gap-2">
        <span className="text-xl font-black tracking-tight">
          <span className="text-primary">Lease</span>
          <span className="text-foreground">Up</span>
        </span>
        {myCampus && (
          <span className="hidden rounded-full bg-white/80 px-2 py-0.5 text-[11px] font-bold text-foreground shadow-sm backdrop-blur sm:inline">
            {myCampus.short_name ?? myCampus.name}
          </span>
        )}
      </Link>
      <div className="flex items-center gap-1.5">
        <NotificationsBell onOpenMessages={onOpenMessages} />
      </div>
    </header>
  );
}
