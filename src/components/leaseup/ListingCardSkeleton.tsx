/**
 * Q114 — loading placeholder that matches a real listing card's footprint.
 * Uses Tailwind's built-in animate-pulse only.
 */
export function ListingCardSkeleton() {
  return (
    <div className="overflow-hidden rounded-2xl bg-white shadow-sm dark:bg-surface">
      <div className="aspect-video w-full animate-pulse rounded-t-2xl bg-gray-200 dark:bg-muted" />
      <div className="mx-3 mt-3 h-4 w-3/4 animate-pulse rounded bg-gray-200 dark:bg-muted" />
      <div className="mx-3 mb-3 mt-2 h-3 w-1/3 animate-pulse rounded bg-gray-200 dark:bg-muted" />
    </div>
  );
}

export function ListingCardSkeletonGrid({ count = 12 }: { count?: number }) {
  return (
    <div className="grid grid-cols-1 gap-5 sm:grid-cols-2 md:grid-cols-3 md:gap-5 lg:grid-cols-4 lg:gap-6">
      {Array.from({ length: count }).map((_, i) => (
        <ListingCardSkeleton key={i} />
      ))}
    </div>
  );
}

/** Horizontal skeleton row used by the homepage rails. */
export function ListingCardSkeletonRow({ count = 4 }: { count?: number }) {
  return (
    <div className="flex gap-4 overflow-hidden">
      {Array.from({ length: count }).map((_, i) => (
        <div key={i} className="w-[260px] shrink-0 sm:w-[280px]">
          <ListingCardSkeleton />
        </div>
      ))}
    </div>
  );
}
