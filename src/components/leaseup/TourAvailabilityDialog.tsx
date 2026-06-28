import { Dialog, DialogContent, DialogHeader, DialogTitle } from "@/components/ui/dialog";
import { Button } from "@/components/ui/button";
import { useEffect, useMemo, useState } from "react";
import { useQuery, useQueryClient } from "@tanstack/react-query";
import { fetchAvailabilityForListing, saveAvailability, nextNDates, formatDateChip, formatTime12 } from "@/lib/leaseup/tours";
import { cn } from "@/lib/utils";
import { toast } from "sonner";

const TIME_OPTIONS: string[] = (() => {
  const out: string[] = [];
  for (let h = 8; h <= 22; h++) {
    out.push(`${String(h).padStart(2, "0")}:00:00`);
    if (h < 22) out.push(`${String(h).padStart(2, "0")}:30:00`);
  }
  return out;
})();

type RowState = { start: string; end: string; duration: number };

export function TourAvailabilityDialog({
  listingId, posterId, open, onOpenChange,
}: { listingId: string; posterId: string; open: boolean; onOpenChange: (o: boolean) => void }) {
  const qc = useQueryClient();
  const dates = useMemo(() => nextNDates(14), []);
  const [selected, setSelected] = useState<Record<string, RowState>>({});
  const [saving, setSaving] = useState(false);

  const { data: existing = [] } = useQuery({
    queryKey: ["tour-availability", listingId],
    queryFn: () => fetchAvailabilityForListing(listingId),
    enabled: open,
  });

  useEffect(() => {
    if (!open) return;
    const next: Record<string, RowState> = {};
    for (const a of existing) {
      next[a.available_date] = {
        start: a.start_time, end: a.end_time, duration: a.slot_duration_minutes,
      };
    }
    setSelected(next);
  }, [open, existing]);

  function toggle(date: string) {
    setSelected(prev => {
      const copy = { ...prev };
      if (copy[date]) delete copy[date];
      else copy[date] = { start: "14:00:00", end: "18:00:00", duration: 30 };
      return copy;
    });
  }

  async function save() {
    setSaving(true);
    try {
      const rows = Object.entries(selected).map(([date, r]) => ({
        date, start: r.start, end: r.end, duration: r.duration,
      }));
      await saveAvailability(listingId, posterId, rows);
      qc.invalidateQueries({ queryKey: ["tour-availability", listingId] });
      toast.success(rows.length ? `✅ Availability saved (${rows.length} day${rows.length === 1 ? "" : "s"})` : "Availability cleared");
      onOpenChange(false);
    } catch (e: any) {
      toast.error(e.message ?? "Could not save");
    } finally { setSaving(false); }
  }

  return (
    <Dialog open={open} onOpenChange={onOpenChange}>
      <DialogContent className="max-h-[90vh] max-w-lg overflow-y-auto">
        <DialogHeader>
          <DialogTitle>📅 When can people tour your place?</DialogTitle>
        </DialogHeader>

        <p className="text-sm text-muted-foreground">Tap dates you're free. Then set a window — subletters can book any slot inside it.</p>

        <div className="-mx-1 flex gap-2 overflow-x-auto py-2">
          {dates.map(d => {
            const chip = formatDateChip(d);
            const on = !!selected[d];
            return (
              <button
                key={d}
                onClick={() => toggle(d)}
                className={cn(
                  "min-w-[68px] shrink-0 rounded-xl border-2 px-3 py-2 text-center transition",
                  on ? "border-primary bg-primary text-primary-foreground" : "border-border bg-background hover:border-primary/40",
                )}
              >
                <div className="text-[10px] font-bold uppercase opacity-80">{chip.weekday}</div>
                <div className="text-sm font-extrabold">{chip.monthDay}</div>
              </button>
            );
          })}
        </div>

        <div className="space-y-3">
          {Object.keys(selected).length === 0 && (
            <div className="rounded-lg bg-background p-4 text-center text-sm text-muted-foreground">
              Pick at least one date above.
            </div>
          )}
          {Object.entries(selected)
            .sort(([a], [b]) => a.localeCompare(b))
            .map(([date, r]) => {
              const chip = formatDateChip(date);
              return (
                <div key={date} className="rounded-xl border bg-background p-3">
                  <div className="mb-2 text-sm font-bold">{chip.weekday}, {chip.monthDay}</div>
                  <div className="flex flex-wrap items-center gap-2 text-xs">
                    <label className="text-muted-foreground">From</label>
                    <select
                      value={r.start}
                      onChange={(e) => setSelected(s => ({ ...s, [date]: { ...r, start: e.target.value } }))}
                      className="rounded-md border bg-surface px-2 py-1 font-semibold"
                    >
                      {TIME_OPTIONS.map(t => <option key={t} value={t}>{formatTime12(t)}</option>)}
                    </select>
                    <label className="text-muted-foreground">To</label>
                    <select
                      value={r.end}
                      onChange={(e) => setSelected(s => ({ ...s, [date]: { ...r, end: e.target.value } }))}
                      className="rounded-md border bg-surface px-2 py-1 font-semibold"
                    >
                      {TIME_OPTIONS.map(t => <option key={t} value={t}>{formatTime12(t)}</option>)}
                    </select>
                  </div>
                  <div className="mt-2 flex gap-1.5">
                    {[30, 45, 60].map(d => (
                      <button
                        key={d}
                        onClick={() => setSelected(s => ({ ...s, [date]: { ...r, duration: d } }))}
                        className={cn(
                          "rounded-full px-3 py-1 text-xs font-bold",
                          r.duration === d ? "bg-primary text-primary-foreground" : "bg-muted text-foreground",
                        )}
                      >{d} min</button>
                    ))}
                  </div>
                </div>
              );
            })}
        </div>

        <Button onClick={save} disabled={saving} className="mt-3 h-11 w-full bg-primary font-bold text-primary-foreground hover:bg-primary-dark">
          {saving ? "Saving…" : "Save Availability →"}
        </Button>
      </DialogContent>
    </Dialog>
  );
}
