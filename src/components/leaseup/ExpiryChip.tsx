/**
 * Q165 — availability urgency chip for the listing slide-out.
 * Renders nothing unless the listing has an end date and a real price.
 */
export function ExpiryChip({
  availableFrom,
  availableTo,
  price,
}: {
  availableFrom: string | null | undefined;
  availableTo: string | null | undefined;
  price: number | null | undefined;
}) {
  if (!availableTo || !price || price <= 0) return null;

  const end = new Date(availableTo);
  if (Number.isNaN(end.getTime())) return null;

  // Q257 — count from the later of today and the sublease start, so the gap
  // before move-in is never counted as extra time.
  const from = availableFrom ? new Date(availableFrom) : null;
  const notStarted = !!from && !Number.isNaN(from.getTime()) && from.getTime() > Date.now();
  const start = notStarted ? from! : new Date();
  const daysLeft = Math.ceil((end.getTime() - start.getTime()) / (1000 * 60 * 60 * 24));
  const base = "rounded-lg px-3 py-2 text-sm mt-2 inline-flex items-center gap-1.5 w-full";

  if (daysLeft <= 0) return null;
  if (notStarted) {
    return (
      <div className={`${base} bg-green-50 text-green-700`}>📅 Available for {daysLeft} days</div>
    );
  }
  if (daysLeft < 7) {
    return (
      <div className={`${base} bg-red-50 text-red-700 font-semibold`}>
        🔥 Only {daysLeft} day{daysLeft === 1 ? "" : "s"} left!
      </div>
    );
  }
  if (daysLeft < 30) {
    return <div className={`${base} bg-amber-50 text-amber-700`}>⏰ {daysLeft} days remaining</div>;
  }
  return (
    <div className={`${base} bg-green-50 text-green-700`}>📅 Available for {daysLeft} more days</div>
  );
}
