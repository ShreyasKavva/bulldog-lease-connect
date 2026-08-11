/**
 * Q165 — availability urgency chip for the listing slide-out.
 * Renders nothing unless the listing has an end date and a real price.
 */
export function ExpiryChip({
  availableTo,
  price,
}: {
  availableTo: string | null | undefined;
  price: number | null | undefined;
}) {
  if (!availableTo || !price || price <= 0) return null;

  const end = new Date(availableTo);
  if (Number.isNaN(end.getTime())) return null;

  const daysLeft = Math.ceil((end.getTime() - Date.now()) / (1000 * 60 * 60 * 24));
  const base = "rounded-lg px-3 py-2 text-sm mt-2 inline-flex items-center gap-1.5 w-full";

  if (daysLeft <= 0) {
    return (
      <div className={`${base} text-gray-400 text-xs`}>
        ⚠️ Listed dates may have passed — confirm with host
      </div>
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
