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

function daysAgo(iso: string) {
  const d = Math.floor((Date.now() - new Date(iso).getTime()) / 86400000);
  if (d <= 0) return "today";
  if (d === 1) return "1 day ago";
  if (d < 30) return `${d} days ago`;
  const m = Math.floor(d / 30);
  return `${m} month${m === 1 ? "" : "s"} ago`;
}

function ReviewCard({ review }: { review: Review }) {
  return (
    <article className="mb-3 rounded-xl border border-border bg-card p-4">
      <div className="flex items-center gap-2">
        <div
          className="grid h-7 w-7 shrink-0 place-items-center rounded-full bg-muted text-[11px] font-bold"
          style={review.reviewer?.banner_color ? { background: review.reviewer.banner_color, color: "#fff" } : undefined}
          aria-hidden
        >
          {review.reviewer?.avatar_emoji ?? initials(review.reviewer?.name)}
        </div>
        <span className="truncate text-sm font-medium">{review.reviewer?.name ?? "Student"}</span>
        <span className="text-xs text-muted-foreground">· {daysAgo(review.created_at)}</span>
      </div>
      <div className="mt-2">
        <StarRow value={review.stars} size={16} />
      </div>
      {review.content && (
        <p className={cn("mt-2 whitespace-pre-wrap text-sm text-foreground/80")}>{review.content}</p>
      )}
    </article>
  );
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
  const mine = user ? list.find((r) => r.reviewer_id === user.id) ?? null : null;

  const others = useMemo(() => list.filter((r) => r.id !== mine?.id), [list, mine]);
  const visible = useMemo(() => (showAll ? others : others.slice(0, 6)), [others, showAll]);

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

      {!isOwner && !mine && (
        <button
          type="button"
          onClick={() => (user ? setReviewOpen(true) : openSignIn(`/listing/${listingId}`))}
          className="mt-3 rounded-full bg-gray-900 px-4 py-2 text-sm text-white dark:bg-white dark:text-gray-900"
        >
          Write a review
        </button>
      )}

      {mine && (
        <div className="mt-4">
          <div className="mb-1 flex items-center gap-2 text-xs font-semibold uppercase tracking-wide text-muted-foreground">
            Your review
            <button
              type="button"
              onClick={() => setReviewOpen(true)}
              className="text-xs font-semibold normal-case text-primary hover:underline"
            >
              Edit
            </button>
          </div>
          <ReviewCard review={mine} />
        </div>
      )}

      {count === 0 ? (
        <p className="mt-3 text-sm italic text-muted-foreground">No reviews yet — be the first!</p>
      ) : (
        <div className="mt-4">
          {visible.map((r) => (
            <ReviewCard key={r.id} review={r} />
          ))}
        </div>
      )}

      {!showAll && others.length > 6 && (
        <button
          type="button"
          onClick={() => setShowAll(true)}
          className="mt-1 rounded-full border border-border px-4 py-2 text-sm font-semibold hover:bg-muted"
        >
          Show all {others.length} reviews
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
          initialStars={mine?.stars ?? 0}
          initialContent={mine?.content ?? ""}
        />
      )}
    </section>
  );
}

