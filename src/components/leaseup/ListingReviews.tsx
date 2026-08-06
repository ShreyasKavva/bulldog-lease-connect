/**
 * Q99 — listing-scoped reviews.
 *
 * `useListingReviews` powers both the compact rating summary shown near the
 * top of a listing detail page and the full "Reviews" section at the bottom.
 * Reviews are always free to read and to leave.
 */
import { useMemo, useState } from "react";
import { useQuery } from "@tanstack/react-query";
import { Star } from "lucide-react";
import { fetchListingReviews, canLeaveReview, type Review } from "@/lib/leaseup/reviews.queries";
import { useSession } from "@/lib/leaseup/use-session";
import { LeaveReviewDialog } from "./LeaveReviewDialog";
import { cn } from "@/lib/utils";

const CORAL = "#FF5A5F";

function StarRow({ value, size = 14 }: { value: number; size?: number }) {
  return (
    <div className="flex items-center gap-0.5" aria-label={`${value} out of 5 stars`}>
      {[1, 2, 3, 4, 5].map((n) => (
        <Star
          key={n}
          style={{
            width: size,
            height: size,
            color: n <= Math.round(value) ? CORAL : undefined,
            fill: n <= Math.round(value) ? CORAL : "transparent",
          }}
          className={n <= Math.round(value) ? "" : "text-muted-foreground/30"}
          strokeWidth={1.5}
        />
      ))}
    </div>
  );
}

export function useListingReviews(listingId: string) {
  const q = useQuery({
    queryKey: ["listing-reviews", listingId],
    queryFn: () => fetchListingReviews(listingId),
    staleTime: 60 * 1000,
  });
  const list: Review[] = Array.isArray(q.data) ? q.data : [];
  const avg = list.length ? list.reduce((s, r) => s + r.stars, 0) / list.length : 0;
  return { list, avg, count: list.length, isLoading: q.isLoading };
}

/** Compact "★ 4.8 (12 reviews)" line. Renders nothing with no reviews. */
export function ListingRatingSummary({ listingId }: { listingId: string }) {
  const { avg, count } = useListingReviews(listingId);

  function jump(e: React.MouseEvent) {
    e.preventDefault();
    document.getElementById("reviews")?.scrollIntoView({ behavior: "smooth", block: "start" });
  }

  // Q111 — no reviews yet: nudge instead of an empty star row.
  if (count === 0) {
    return (
      <a
        href="#reviews"
        onClick={jump}
        className="mt-2 inline-block text-sm text-muted-foreground hover:text-foreground hover:underline"
      >
        Be the first to review →
      </a>
    );
  }

  return (
    <a
      href="#reviews"
      onClick={jump}
      className="mt-2 flex items-center gap-1.5 text-lg font-semibold hover:underline"
    >
      <Star style={{ color: CORAL, fill: CORAL }} className="h-4 w-4" strokeWidth={1.5} />
      <span>{avg.toFixed(1)}</span>
      <span className="text-sm font-medium text-muted-foreground">
        · {count} review{count === 1 ? "" : "s"}
      </span>
    </a>
  );
}

function initials(name: string | null | undefined) {
  const n = (name ?? "").trim();
  if (!n) return "S";
  return n
    .split(/\s+/)
    .slice(0, 2)
    .map((p) => p[0]?.toUpperCase() ?? "")
    .join("");
}

export function ListingReviewsSection({
  listingId,
  listingTitle,
  ownerId,
}: {
  listingId: string;
  listingTitle: string;
  ownerId: string;
}) {
  const { list, avg, count } = useListingReviews(listingId);
  const { user } = useSession();
  const [showAll, setShowAll] = useState(false);
  const [reviewOpen, setReviewOpen] = useState(false);

  const isOwner = !!user && user.id === ownerId;
  const alreadyReviewed = !!user && list.some((r) => r.reviewer_id === user.id);

  const { data: eligible = false } = useQuery({
    queryKey: ["can-review", user?.id, ownerId],
    queryFn: () => canLeaveReview(user!.id, ownerId),
    enabled: !!user?.id && !isOwner,
    staleTime: 60 * 1000,
  });

  const visible = useMemo(() => (showAll ? list : list.slice(0, 6)), [list, showAll]);
  const canReview = !!user && !isOwner && eligible && !alreadyReviewed;

  if (isLoading && count === 0) return null;

  return (
    <section id="reviews" className="mt-10 scroll-mt-24">
      <div className="flex flex-wrap items-center justify-between gap-2">
        <h2 className="text-xl font-semibold">Reviews</h2>
        {count > 0 && (
          <div className="flex items-center gap-1.5 text-sm font-semibold">
            <Star style={{ color: CORAL, fill: CORAL }} className="h-4 w-4" strokeWidth={1.5} />
            {avg.toFixed(1)} · {count} review{count === 1 ? "" : "s"}
          </div>
        )}
      </div>

      {canReview && (
        <button
          type="button"
          onClick={() => setReviewOpen(true)}
          className="mt-2 text-sm font-semibold hover:underline"
          style={{ color: CORAL }}
        >
          Leave a review
        </button>
      )}

      {count === 0 ? (
        <p className="mt-3 text-sm text-muted-foreground">
          No reviews yet — be the first to share your experience.
        </p>
      ) : (
        <div className="mt-4 grid gap-5 sm:grid-cols-2">
          {visible.map((r) => (
            <article key={r.id}>
              <div className="flex items-center gap-2">
                <div
                  className="grid h-8 w-8 shrink-0 place-items-center rounded-full text-xs font-bold text-white"
                  style={{ background: r.reviewer?.banner_color ?? "#111827" }}
                  aria-hidden
                >
                  {r.reviewer?.avatar_emoji ?? initials(r.reviewer?.name)}
                </div>
                <div className="min-w-0">
                  <div className="flex flex-wrap items-center gap-1.5">
                    <span className="truncate text-sm font-semibold">
                      {r.reviewer?.name ?? "Student"}
                    </span>
                    <span className="rounded-full bg-muted px-2 py-0.5 text-[10px] font-medium text-muted-foreground">
                      Verified renter
                    </span>
                  </div>
                  <div className="mt-0.5 flex items-center gap-2">
                    <StarRow value={r.stars} size={12} />
                    <span className="text-xs text-muted-foreground">
                      {new Date(r.created_at).toLocaleDateString("en-US", {
                        month: "long",
                        year: "numeric",
                      })}
                    </span>
                  </div>
                </div>
              </div>
              {r.content && (
                <p className={cn("mt-2 whitespace-pre-wrap text-sm text-muted-foreground")}>
                  {r.content}
                </p>
              )}
            </article>
          ))}
        </div>
      )}

      {!showAll && count > 6 && (
        <button
          type="button"
          onClick={() => setShowAll(true)}
          className="mt-4 rounded-full border border-border px-4 py-2 text-sm font-semibold hover:bg-muted"
        >
          Show all {count} reviews
        </button>
      )}

      {user && (
        <LeaveReviewDialog
          open={reviewOpen}
          onOpenChange={setReviewOpen}
          reviewedUserId={ownerId}
          reviewedName={listingTitle}
          listingId={listingId}
          reviewerRole="subletter"
        />
      )}
    </section>
  );
}
