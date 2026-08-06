/**
 * Q103 Part A — availability calendar for a listing detail page.
 *
 * SSR-safe: pure native Date math, no locale-dependent parsing of the ISO
 * strings we store (YYYY-MM-DD). Renders two months starting at the sublease
 * start month (or the current month when the sublease already started).
 * Days outside the sublease window or in the past are dimmed and struck out;
 * the first and last available day get a filled rounded highlight.
 */
import { useMemo, useState } from "react";
import { ChevronLeft, ChevronRight } from "lucide-react";
import { cn } from "@/lib/utils";

const DOW = ["S", "M", "T", "W", "T", "F", "S"];
const MONTHS = [
  "January", "February", "March", "April", "May", "June",
  "July", "August", "September", "October", "November", "December",
];

/** Parses YYYY-MM-DD as a local date (avoids the UTC shift of new Date(str)). */
function parseDay(iso?: string | null): Date | null {
  if (!iso) return null;
  const [y, m, d] = iso.slice(0, 10).split("-").map(Number);
  if (!y || !m || !d) return null;
  return new Date(y, m - 1, d);
}
function startOfDay(d: Date) {
  return new Date(d.getFullYear(), d.getMonth(), d.getDate());
}
function sameDay(a: Date, b: Date) {
  return a.getFullYear() === b.getFullYear() && a.getMonth() === b.getMonth() && a.getDate() === b.getDate();
}

export function AvailabilityCalendar({
  from, to,
}: {
  from?: string | null;
  to?: string | null;
}) {
  const start = parseDay(from);
  const end = parseDay(to);
  const today = startOfDay(new Date());

  const firstMonth = useMemo(() => {
    const base = start && start > today ? start : today;
    return new Date(base.getFullYear(), base.getMonth(), 1);
  }, [from, to]); // eslint-disable-line react-hooks/exhaustive-deps

  const [offset, setOffset] = useState(0);

  if (!start && !end) return null;

  const months = [0, 1].map((i) => new Date(firstMonth.getFullYear(), firstMonth.getMonth() + offset + i, 1));

  const lastAllowedOffset = (() => {
    if (!end) return 6;
    const diff =
      (end.getFullYear() - firstMonth.getFullYear()) * 12 + (end.getMonth() - firstMonth.getMonth());
    return Math.max(0, diff);
  })();

  return (
    <section className="mt-8">
      <div className="flex items-center justify-between gap-4">
        <div>
          <h2 className="text-lg font-bold">Availability</h2>
          <p className="mt-0.5 text-sm text-muted-foreground">
            {start && end
              ? `Open ${start.toLocaleDateString(undefined, { month: "short", day: "numeric" })} – ${end.toLocaleDateString(undefined, { month: "short", day: "numeric", year: "numeric" })}`
              : start
                ? `Open from ${start.toLocaleDateString(undefined, { month: "short", day: "numeric", year: "numeric" })}`
                : `Open until ${end!.toLocaleDateString(undefined, { month: "short", day: "numeric", year: "numeric" })}`}
          </p>
        </div>
        <div className="flex shrink-0 gap-1">
          <button
            type="button"
            aria-label="Previous month"
            disabled={offset === 0}
            onClick={() => setOffset((o) => Math.max(0, o - 1))}
            className="grid h-9 w-9 place-items-center rounded-full border border-border transition disabled:opacity-30"
          >
            <ChevronLeft className="h-4 w-4" />
          </button>
          <button
            type="button"
            aria-label="Next month"
            disabled={offset >= lastAllowedOffset}
            onClick={() => setOffset((o) => Math.min(lastAllowedOffset, o + 1))}
            className="grid h-9 w-9 place-items-center rounded-full border border-border transition disabled:opacity-30"
          >
            <ChevronRight className="h-4 w-4" />
          </button>
        </div>
      </div>

      <div className="mt-4 grid gap-6 rounded-2xl border border-border bg-card p-5 sm:grid-cols-2">
        {months.map((m) => (
          <MonthGrid key={`${m.getFullYear()}-${m.getMonth()}`} month={m} start={start} end={end} today={today} />
        ))}
      </div>
    </section>
  );
}

function MonthGrid({
  month, start, end, today,
}: {
  month: Date;
  start: Date | null;
  end: Date | null;
  today: Date;
}) {
  const year = month.getFullYear();
  const mIdx = month.getMonth();
  const daysInMonth = new Date(year, mIdx + 1, 0).getDate();
  const leading = new Date(year, mIdx, 1).getDay();

  const cells: Array<Date | null> = [
    ...Array.from({ length: leading }, () => null),
    ...Array.from({ length: daysInMonth }, (_, i) => new Date(year, mIdx, i + 1)),
  ];

  return (
    <div>
      <p className="mb-2 text-center text-sm font-semibold">
        {MONTHS[mIdx]} {year}
      </p>
      <div className="grid grid-cols-7 gap-y-1 text-center text-[11px] text-muted-foreground">
        {DOW.map((d, i) => (
          <span key={i} className="py-1">{d}</span>
        ))}
      </div>
      <div className="grid grid-cols-7 gap-y-1 text-center text-sm">
        {cells.map((d, i) => {
          if (!d) return <span key={i} />;
          const past = d < today;
          const beforeStart = start ? d < start : false;
          const afterEnd = end ? d > end : false;
          const unavailable = past || beforeStart || afterEnd;
          const isEdge = (start && sameDay(d, start)) || (end && sameDay(d, end));
          return (
            <span key={i} className="py-0.5">
              <span
                className={cn(
                  "mx-auto grid h-8 w-8 place-items-center rounded-full",
                  unavailable && "text-muted-foreground/50 line-through",
                  !unavailable && !isEdge && "text-foreground",
                  isEdge && !unavailable && "bg-foreground font-bold text-background",
                )}
              >
                {d.getDate()}
              </span>
            </span>
          );
        })}
      </div>
    </div>
  );
}
