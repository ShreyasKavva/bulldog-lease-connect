/**
 * Q103 Part B — rich host card for the listing detail sidebar.
 *
 * Stats come from the get_host_stats RPC (reply rate, typical reply time,
 * active listings, review count) plus get_public_profile for the star rating.
 * Anything the RPC can't compute yet (a brand-new host) is simply omitted.
 */
import { useQuery } from "@tanstack/react-query";
import { Link } from "@tanstack/react-router";
import { BadgeCheck, MessageSquare, Star } from "lucide-react";
import { supabase } from "@/integrations/supabase/client";
import { posterName, posterFirstName, profileDisplayName } from "@/lib/leaseup/display-name";
import { cn } from "@/lib/utils";


type HostStats = {
  response_rate: number | null;
  conversation_count: number;
  avg_response_hours: number | null;
  active_listing_count: number;
  total_review_count: number;
};

export async function fetchHostStats(hostId: string): Promise<HostStats | null> {
  const { data, error } = await supabase.rpc("get_host_stats", { host_id: hostId });
  if (error) throw error;
  return (data as unknown as HostStats) ?? null;
}

async function fetchHostRating(hostId: string): Promise<{ avg: number | null; count: number }> {
  const { data } = await supabase.rpc("get_public_profile", { _uid: hostId });
  const p = (data ?? {}) as Record<string, unknown>;
  return {
    avg: p.avg_rating != null ? Number(p.avg_rating) : null,
    count: Number(p.review_count ?? 0),
  };
}

function replyTime(hours: number | null): string | null {
  if (hours == null) return null;
  if (hours < 1) return "within an hour";
  if (hours < 24) return `within ${hours} hour${hours === 1 ? "" : "s"}`;
  const days = Math.round(hours / 24);
  return `within ${days} day${days === 1 ? "" : "s"}`;
}

export function HostProfileCard({
  hostId, poster, memberSince,
}: {
  hostId: string;
  poster?: {
    name?: string | null;
    avatar_emoji?: string | null;
    banner_color?: string | null;
    verified_email?: boolean | null;
    created_at?: string | null;
  } | null;
  memberSince?: string | null;
}) {
  const { data: stats } = useQuery({
    queryKey: ["host-stats", hostId],
    queryFn: () => fetchHostStats(hostId),
    staleTime: 5 * 60_000,
  });
  const { data: rating } = useQuery({
    queryKey: ["host-rating", hostId],
    queryFn: () => fetchHostRating(hostId),
    staleTime: 5 * 60_000,
  });

  const since = memberSince ?? poster?.created_at ?? null;
  const sinceLabel = since
    ? new Date(since).toLocaleDateString(undefined, { month: "long", year: "numeric" })
    : null;
  const time = replyTime(stats?.avg_response_hours ?? null);

  return (
    <div className="mt-4 rounded-2xl border border-border bg-card p-5">
      <div className="flex items-center gap-3">
        <div
          className="grid h-14 w-14 shrink-0 place-items-center rounded-full text-2xl"
          style={{ background: poster?.banner_color ?? "#2563EB" }}
        >
          {poster?.avatar_emoji ?? "🙂"}
        </div>
        <div className="min-w-0">
          <p className="flex items-center gap-1.5 truncate text-base font-bold">
            {profileDisplayName(poster)}
            {poster?.verified_email && <BadgeCheck className="h-4 w-4 shrink-0 text-success" />}
          </p>
          {sinceLabel && <p className="text-sm text-muted-foreground">Member since {sinceLabel}</p>}
        </div>
      </div>

      <dl className="mt-4 grid grid-cols-3 gap-2 text-center">
        <Stat
          value={rating?.avg != null ? rating.avg.toFixed(1) : "—"}
          label={`${rating?.count ?? 0} review${(rating?.count ?? 0) === 1 ? "" : "s"}`}
          icon={rating?.avg != null ? <Star className="h-3 w-3 fill-current" /> : undefined}
        />
        <Stat
          value={stats?.response_rate != null ? `${stats.response_rate}%` : "—"}
          label="Reply rate"
        />
        <Stat
          value={String(stats?.active_listing_count ?? 0)}
          label={`Active listing${(stats?.active_listing_count ?? 0) === 1 ? "" : "s"}`}
        />
      </dl>

      {time && (
        <p className="mt-3 flex items-center gap-1.5 text-sm text-muted-foreground">
          <MessageSquare className="h-3.5 w-3.5" /> Typically replies {time}
        </p>
      )}

      <div className="mt-4 flex flex-wrap gap-2">
        <Link
          to="/profile/$userId"
          params={{ userId: hostId }}
          className="inline-flex h-9 items-center rounded-full border border-border px-4 text-sm font-semibold transition hover:bg-muted"
        >
          View profile
        </Link>
        {(stats?.active_listing_count ?? 0) > 1 && (
          <Link
            to="/browse"
            search={{ hostId } as never}
            className="inline-flex h-9 items-center rounded-full border border-border px-4 text-sm font-semibold transition hover:bg-muted"
          >
            All their listings
          </Link>
        )}
      </div>
    </div>
  );
}

function Stat({ value, label, icon }: { value: string; label: string; icon?: React.ReactNode }) {
  return (
    <div className="rounded-xl bg-muted/50 px-2 py-3">
      <dd className="flex items-center justify-center gap-1 text-base font-bold">
        {icon}
        {value}
      </dd>
      <dt className="mt-0.5 text-[11px] leading-tight text-muted-foreground">{label}</dt>
    </div>
  );
}
