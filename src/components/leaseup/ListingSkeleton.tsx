export function ListingSkeleton() {
  return (
    <div className="overflow-hidden rounded-xl bg-surface shadow-card">
      <div className="lu-shimmer aspect-[4/3] w-full" />
      <div className="space-y-2 p-3">
        <div className="lu-shimmer h-5 w-24 rounded" />
        <div className="lu-shimmer h-4 w-3/4 rounded" />
        <div className="lu-shimmer h-3 w-1/2 rounded" />
        <div className="flex gap-1.5 pt-1">
          <div className="lu-shimmer h-5 w-14 rounded-full" />
          <div className="lu-shimmer h-5 w-16 rounded-full" />
        </div>
      </div>
    </div>
  );
}

export function ListingSkeletonGrid({ count = 6 }: { count?: number }) {
  return (
    <div className="grid grid-cols-1 gap-4 sm:grid-cols-2 lg:grid-cols-3">
      {Array.from({ length: count }).map((_, i) => <ListingSkeleton key={i} />)}
    </div>
  );
}
