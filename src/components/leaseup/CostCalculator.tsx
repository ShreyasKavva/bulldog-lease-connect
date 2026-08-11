/**
 * Q164 — sublease cost estimator. Pick a date range and see the rough total
 * at the listing's monthly price. Estimate only — never a quote.
 */
import { useState } from "react";

function toInput(v?: string | null) {
  if (!v) return "";
  const d = new Date(v);
  return Number.isNaN(d.getTime()) ? "" : d.toISOString().slice(0, 10);
}

export function CostCalculator({
  price,
  availableFrom,
  availableTo,
}: {
  price: number;
  availableFrom?: string | null;
  availableTo?: string | null;
}) {
  const [from, setFrom] = useState(() => toInput(availableFrom));
  const [to, setTo] = useState(() => toInput(availableTo));

  if (!price || price <= 0) return null;

  const start = from ? new Date(`${from}T00:00:00`) : null;
  const end = to ? new Date(`${to}T00:00:00`) : null;
  const valid =
    start && end && !Number.isNaN(start.getTime()) && !Number.isNaN(end.getTime()) && end > start;
  const days = valid ? (end!.getTime() - start!.getTime()) / 86_400_000 : 0;
  const months = valid ? Math.min(24, Math.max(1, Math.ceil(days / 30.44))) : null;
  const total = months ? months * price : null;

  return (
    <div className="mt-3 rounded-xl border border-indigo-100 bg-indigo-50 p-3 text-sm dark:border-indigo-500/30 dark:bg-indigo-500/10">
      <div className="font-bold text-foreground">💰 Estimate your cost</div>
      <div className="mt-2 grid grid-cols-2 gap-2">
        <label className="text-[11px] font-semibold text-muted-foreground">
          From
          <input
            type="date"
            value={from}
            onChange={(e) => setFrom(e.target.value)}
            className="mt-1 w-full rounded-lg border border-border bg-background px-2 py-1.5 text-xs text-foreground outline-none focus:border-primary"
          />
        </label>
        <label className="text-[11px] font-semibold text-muted-foreground">
          To
          <input
            type="date"
            value={to}
            onChange={(e) => setTo(e.target.value)}
            className="mt-1 w-full rounded-lg border border-border bg-background px-2 py-1.5 text-xs text-foreground outline-none focus:border-primary"
          />
        </label>
      </div>
      <div className="mt-2">
        {months && total ? (
          <span>
            ~{months} month{months !== 1 ? "s" : ""} × ${price.toLocaleString()}/mo ={" "}
            <span className="text-base font-bold text-indigo-700 dark:text-indigo-300">
              ${total.toLocaleString()}
            </span>{" "}
            estimated total
          </span>
        ) : (
          <span className="text-muted-foreground">Pick a start and end date to see an estimate.</span>
        )}
      </div>
      <p className="mt-1 text-[10px] text-gray-400">Estimate only. Confirm exact terms with host.</p>
    </div>
  );
}
