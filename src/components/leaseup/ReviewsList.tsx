import { useQuery } from "@tanstack/react-query";
import { Star } from "lucide-react";
import { computeReviewStats, fetchUserReviews } from "@/lib/leaseup/reviews.queries";
import { timeAgo } from "@/lib/leaseup/constants";
import { cn } from "@/lib/utils";
import { UserAvatar } from "@/components/leaseup/UserAvatar";

function Stars({ value, size = 14 }: { value: number; size?: number }) {
  return (
    <div className="flex items-center gap-0.5">
      {[1, 2, 3, 4, 5].map((n) => (
        <Star
          key={n}
          style={{ width: size, height: size }}
          className={cn(
            n <= Math.round(value) ? "fill-amber-400 text-amber-400" : "fill-transparent text-muted-foreground/30",
          )}
          strokeWidth={1.5}
        />
      ))}
    </div>
  );
}

export function ReviewsList({ userId }: { userId: string }) {
  const { data: reviews, isLoading } = useQuery({
    queryKey: ["reviews", userId],
    queryFn: () => fetchUserReviews(userId),
  });

  if (isLoading) {
    return <div className="p-6 text-center text-sm text-muted-foreground">Loading reviews…</div>;
  }

  const list = reviews ?? [];
  const stats = computeReviewStats(list);

  if (list.length === 0) {
    return (
      <div className="rounded-xl bg-background p-8 text-center text-sm text-muted-foreground">
        <div className="text-3xl mb-2">⭐</div>
        No reviews yet. Reviews appear after a sublease is completed.
      </div>
    );
  }

  const max = Math.max(...Object.values(stats.distribution), 1);

  return (
    <div className="space-y-4">
      <div className="rounded-xl bg-background p-4">
        <div className="flex items-center gap-4">
          <div>
            <div className="flex items-center gap-1.5">
              <Star className="h-5 w-5 fill-amber-400 text-amber-400" strokeWidth={1.5} />
              <span className="text-2xl font-black">{stats.avg.toFixed(1)}</span>
            </div>
            <div className="text-xs text-muted-foreground mt-0.5">
              {stats.count} review{stats.count === 1 ? "" : "s"}
            </div>
          </div>
          <div className="flex-1 space-y-1">
            {[5, 4, 3, 2, 1].map((n) => {
              const c = stats.distribution[n as 1 | 2 | 3 | 4 | 5];
              const pct = (c / max) * 100;
              return (
                <div key={n} className="flex items-center gap-2 text-[11px]">
                  <span className="w-3 text-right font-bold text-muted-foreground">{n}</span>
                  <Star className="h-3 w-3 fill-amber-400 text-amber-400" strokeWidth={1.5} />
                  <div className="flex-1 h-1.5 rounded-full bg-muted overflow-hidden">
                    <div className="h-full bg-amber-400" style={{ width: `${pct}%` }} />
                  </div>
                  <span className="w-5 text-right tabular-nums text-muted-foreground">{c}</span>
                </div>
              );
            })}
          </div>
        </div>
      </div>

      <div className="space-y-2">
        {list.map((r) => (
          <div key={r.id} className="rounded-xl bg-background p-3">
            <div className="flex items-center gap-2">
              <UserAvatar
                name={r.reviewer?.name ?? null}
                avatarUrl={r.reviewer?.avatar_url}
                color={r.reviewer?.banner_color ?? null}
                className="h-9 w-9"
                textClassName="text-sm"
              />
              <div className="min-w-0 flex-1">
                <div className="flex flex-wrap items-center gap-1.5">
                  <span className="font-bold text-sm truncate">{r.reviewer?.name ?? "Student"}</span>
                  <span className="text-[10px] text-muted-foreground">·</span>
                  <span className="rounded-full bg-primary-light px-1.5 py-0.5 text-[10px] font-bold uppercase text-primary-dark">
                    {r.reviewer_role === "poster" ? "Poster" : "Subletter"}
                  </span>
                </div>
                <div className="flex items-center gap-2 mt-0.5">
                  <Stars value={r.stars} />
                  <span className="text-[10px] text-muted-foreground">{timeAgo(r.created_at)}</span>
                </div>
              </div>
            </div>
            {r.content && <p className="mt-2 text-sm whitespace-pre-wrap">{r.content}</p>}
          </div>
        ))}
      </div>
    </div>
  );
}
