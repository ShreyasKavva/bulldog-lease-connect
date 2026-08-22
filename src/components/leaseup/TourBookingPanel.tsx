import { useMemo, useState } from "react";
import { useQuery } from "@tanstack/react-query";
import { fetchAvailabilityForListing, fetchBookingsForListing, generateSlots, formatTime12, formatDateChip, createBooking } from "@/lib/leaseup/tours";
import type { Listing } from "@/lib/leaseup/types";
import { Button } from "@/components/ui/button";
import { cn } from "@/lib/utils";
import { toast } from "sonner";
import { useSession } from "@/lib/leaseup/use-session";
import { Calendar } from "lucide-react";
import { posterName, posterFirstName, profileDisplayName } from "@/lib/leaseup/display-name";

export function TourBookingPanel({ listing }: { listing: Listing }) {
  const { user } = useSession();
  const [activeDate, setActiveDate] = useState<string | null>(null);
  const [activeSlot, setActiveSlot] = useState<string | null>(null);
  const [note, setNote] = useState("");
  const [submitting, setSubmitting] = useState(false);
  const [bookedId, setBookedId] = useState<string | null>(null);

  const { data: availability = [], isLoading } = useQuery({
    queryKey: ["tour-availability", listing.id],
    queryFn: () => fetchAvailabilityForListing(listing.id),
  });

  const { data: bookings = [] } = useQuery({
    queryKey: ["tour-bookings-listing", listing.id],
    queryFn: () => fetchBookingsForListing(listing.id),
    enabled: availability.length > 0,
  });

  const byDate = useMemo(() => {
    const m = new Map<string, typeof availability[number]>();
    for (const a of availability) m.set(a.available_date, a);
    return m;
  }, [availability]);

  const dates = useMemo(() => Array.from(byDate.keys()).sort(), [byDate]);

  const slots = useMemo(() => {
    if (!activeDate) return [];
    const a = byDate.get(activeDate);
    if (!a) return [];
    return generateSlots(a.start_time, a.end_time, a.slot_duration_minutes);
  }, [activeDate, byDate]);

  const bookedSet = useMemo(() => {
    const s = new Set<string>();
    for (const b of bookings) if (b.scheduled_date === activeDate) s.add(b.scheduled_time);
    return s;
  }, [bookings, activeDate]);

  if (isLoading) return null;
  if (availability.length === 0) return null;
  if (user && user.id === listing.user_id) return null;

  async function book() {
    if (!user) { toast.error("Sign in to book a tour"); return; }
    if (!activeDate || !activeSlot) return;
    const a = byDate.get(activeDate);
    if (!a) return;
    setSubmitting(true);
    try {
      const out = await createBooking({
        listing_id: listing.id,
        availability_id: a.id,
        poster_id: listing.user_id,
        subletter_id: user.id,
        scheduled_date: activeDate,
        scheduled_time: activeSlot,
        message: note.trim() || undefined,
      });
      setBookedId(out.id);
      toast.success("Tour requested! The poster will confirm shortly.");
    } catch (e: any) {
      toast.error(e.message ?? "Could not book");
    } finally { setSubmitting(false); }
  }

  if (bookedId) {
    return (
      <div className="rounded-xl border-2 border-primary/40 bg-primary/5 p-4 text-center">
        <div className="text-2xl">📅</div>
        <div className="mt-1 text-sm font-bold">Tour requested!</div>
        <div className="text-xs text-muted-foreground">{posterName(listing, "The poster")} will confirm shortly. We'll notify you.</div>
      </div>
    );
  }

  return (
    <div className="rounded-xl border bg-background p-4">
      <h3 className="flex items-center gap-2 text-sm font-bold uppercase text-muted-foreground">
        <Calendar className="h-4 w-4 text-primary" /> Schedule a Tour
      </h3>

      <div className="-mx-1 mt-3 flex gap-2 overflow-x-auto pb-1">
        {dates.map(d => {
          const chip = formatDateChip(d);
          const on = d === activeDate;
          return (
            <button
              key={d}
              onClick={() => { setActiveDate(d); setActiveSlot(null); }}
              className={cn(
                "min-w-[68px] shrink-0 rounded-xl border-2 px-3 py-2 text-center transition",
                on ? "border-primary bg-primary text-primary-foreground" : "border-border bg-surface hover:border-primary/40",
              )}
            >
              <div className="text-[10px] font-bold uppercase opacity-80">{chip.weekday}</div>
              <div className="text-sm font-extrabold">{chip.monthDay}</div>
            </button>
          );
        })}
      </div>

      {activeDate && (
        <div className="mt-3 flex flex-wrap gap-1.5">
          {slots.map(s => {
            const taken = bookedSet.has(s);
            const on = s === activeSlot;
            return (
              <button
                key={s}
                disabled={taken}
                onClick={() => setActiveSlot(s)}
                className={cn(
                  "rounded-full px-3 py-1.5 text-xs font-bold transition",
                  taken ? "cursor-not-allowed bg-muted text-muted-foreground/50 line-through" :
                  on ? "bg-primary text-primary-foreground" : "bg-surface border border-border hover:border-primary/40",
                )}
              >{formatTime12(s)}</button>
            );
          })}
        </div>
      )}

      {activeDate && activeSlot && (
        <div className="mt-4 rounded-lg border bg-surface p-3">
          <div className="text-sm font-bold">Book this tour</div>
          <div className="mt-1 text-xs text-muted-foreground">
            📍 {listing.title}<br />
            📅 {formatDateChip(activeDate).weekday}, {formatDateChip(activeDate).monthDay} at {formatTime12(activeSlot)}<br />
            👤 With: {posterName(listing, "the poster")}
          </div>
          <textarea
            value={note} onChange={(e) => setNote(e.target.value)}
            rows={2}
            placeholder="Note to poster (optional)…"
            className="mt-2 w-full resize-none rounded-md border bg-background px-3 py-2 text-sm"
          />
          <div className="mt-2 flex gap-2">
            <Button variant="outline" className="flex-1" onClick={() => setActiveSlot(null)}>Cancel</Button>
            <Button onClick={book} disabled={submitting} className="flex-1 bg-primary text-primary-foreground hover:bg-primary-dark">
              {submitting ? "Booking…" : "Confirm Tour →"}
            </Button>
          </div>
        </div>
      )}
    </div>
  );
}
