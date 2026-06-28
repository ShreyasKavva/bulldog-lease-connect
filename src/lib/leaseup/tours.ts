import { supabase } from "@/integrations/supabase/client";

export type Availability = {
  id: string;
  listing_id: string;
  poster_id: string;
  available_date: string; // YYYY-MM-DD
  start_time: string;     // HH:MM:SS
  end_time: string;       // HH:MM:SS
  slot_duration_minutes: number;
  is_active: boolean;
};

export type Booking = {
  id: string;
  listing_id: string;
  availability_id: string | null;
  poster_id: string;
  subletter_id: string;
  scheduled_date: string;
  scheduled_time: string;
  status: "pending" | "confirmed" | "cancelled_poster" | "cancelled_subletter" | "completed" | "no_show";
  message: string | null;
  poster_survey: string | null;
  subletter_survey: string | null;
  created_at: string;
  confirmed_at: string | null;
  cancelled_at: string | null;
};

export async function fetchAvailabilityForListing(listingId: string): Promise<Availability[]> {
  const { data, error } = await supabase
    .from("tour_availability" as any)
    .select("*")
    .eq("listing_id", listingId)
    .eq("is_active", true)
    .gte("available_date", new Date().toISOString().slice(0, 10))
    .order("available_date", { ascending: true });
  if (error) throw error;
  return (data ?? []) as unknown as Availability[];
}

export async function fetchBookingsForListing(listingId: string): Promise<Booking[]> {
  const { data, error } = await supabase
    .from("tour_bookings" as any)
    .select("*")
    .eq("listing_id", listingId)
    .in("status", ["pending", "confirmed"]);
  if (error) throw error;
  return (data ?? []) as unknown as Booking[];
}

export async function saveAvailability(
  listingId: string,
  posterId: string,
  rows: Array<{ date: string; start: string; end: string; duration: number }>,
) {
  // Replace future availability for this listing
  await supabase
    .from("tour_availability" as any)
    .delete()
    .eq("listing_id", listingId)
    .gte("available_date", new Date().toISOString().slice(0, 10));
  if (rows.length === 0) return;
  const payload = rows.map(r => ({
    listing_id: listingId,
    poster_id: posterId,
    available_date: r.date,
    start_time: r.start,
    end_time: r.end,
    slot_duration_minutes: r.duration,
  }));
  const { error } = await supabase.from("tour_availability" as any).insert(payload as any);
  if (error) throw error;
}

export async function createBooking(args: {
  listing_id: string;
  availability_id: string;
  poster_id: string;
  subletter_id: string;
  scheduled_date: string;
  scheduled_time: string;
  message?: string;
}) {
  const { data, error } = await supabase
    .from("tour_bookings" as any)
    .insert({
      listing_id: args.listing_id,
      availability_id: args.availability_id,
      poster_id: args.poster_id,
      subletter_id: args.subletter_id,
      scheduled_date: args.scheduled_date,
      scheduled_time: args.scheduled_time,
      message: args.message ?? null,
    } as any)
    .select("id")
    .single();
  if (error) throw error;
  return data as unknown as { id: string };
}

export async function updateBookingStatus(id: string, status: Booking["status"]) {
  const patch: any = { status };
  if (status === "confirmed") patch.confirmed_at = new Date().toISOString();
  if (status.startsWith("cancelled")) patch.cancelled_at = new Date().toISOString();
  const { error } = await supabase.from("tour_bookings" as any).update(patch).eq("id", id);
  if (error) throw error;
}

export async function setBookingSurvey(id: string, field: "poster_survey" | "subletter_survey", value: string) {
  const { error } = await supabase.from("tour_bookings" as any).update({ [field]: value }).eq("id", id);
  if (error) throw error;
}

export async function fetchMyTours(userId: string) {
  const { data, error } = await supabase
    .from("tour_bookings" as any)
    .select("*, listing:listings(id,title,area,photo_urls,user_id), poster:profiles!tour_bookings_poster_id_fkey(id,name,email,avatar_emoji,banner_color), subletter:profiles!tour_bookings_subletter_id_fkey(id,name,email,avatar_emoji,banner_color)")
    .or(`poster_id.eq.${userId},subletter_id.eq.${userId}`)
    .order("scheduled_date", { ascending: true });
  if (error) throw error;
  return (data ?? []) as any[];
}

// Generate slot times from a range
export function generateSlots(start: string, end: string, durationMin: number): string[] {
  const out: string[] = [];
  const [sh, sm] = start.split(":").map(Number);
  const [eh, em] = end.split(":").map(Number);
  let cur = sh * 60 + sm;
  const last = eh * 60 + em;
  while (cur + durationMin <= last) {
    const h = Math.floor(cur / 60);
    const m = cur % 60;
    out.push(`${String(h).padStart(2, "0")}:${String(m).padStart(2, "0")}:00`);
    cur += durationMin;
  }
  return out;
}

export function formatTime12(t: string): string {
  const [h, m] = t.split(":").map(Number);
  const am = h < 12;
  const hh = h % 12 === 0 ? 12 : h % 12;
  return `${hh}:${String(m).padStart(2, "0")} ${am ? "AM" : "PM"}`;
}

export function formatDateChip(d: string | Date): { weekday: string; monthDay: string } {
  const dt = typeof d === "string" ? new Date(d + "T12:00:00") : d;
  return {
    weekday: dt.toLocaleDateString(undefined, { weekday: "short" }),
    monthDay: dt.toLocaleDateString(undefined, { month: "short", day: "numeric" }),
  };
}

export function buildIcs(args: {
  title: string;
  description: string;
  location: string;
  dateISO: string; // YYYY-MM-DD
  time: string;    // HH:MM:SS
  durationMin: number;
}) {
  const [y, mo, d] = args.dateISO.split("-").map(Number);
  const [h, mi] = args.time.split(":").map(Number);
  const start = new Date(Date.UTC(y, mo - 1, d, h, mi, 0));
  const end = new Date(start.getTime() + args.durationMin * 60_000);
  const fmt = (dt: Date) =>
    `${dt.getUTCFullYear()}${String(dt.getUTCMonth() + 1).padStart(2, "0")}${String(dt.getUTCDate()).padStart(2, "0")}T${String(dt.getUTCHours()).padStart(2, "0")}${String(dt.getUTCMinutes()).padStart(2, "0")}00Z`;
  return [
    "BEGIN:VCALENDAR",
    "VERSION:2.0",
    "PRODID:-//LeaseUp//Tour//EN",
    "BEGIN:VEVENT",
    `UID:${Date.now()}@leasup.co`,
    `DTSTAMP:${fmt(new Date())}`,
    `DTSTART:${fmt(start)}`,
    `DTEND:${fmt(end)}`,
    `SUMMARY:${args.title.replace(/[\r\n,;]/g, " ")}`,
    `DESCRIPTION:${args.description.replace(/[\r\n]/g, " ")}`,
    `LOCATION:${args.location.replace(/[\r\n,;]/g, " ")}`,
    "END:VEVENT",
    "END:VCALENDAR",
  ].join("\r\n");
}

export function downloadIcs(filename: string, ics: string) {
  const blob = new Blob([ics], { type: "text/calendar;charset=utf-8" });
  const url = URL.createObjectURL(blob);
  const a = document.createElement("a");
  a.href = url; a.download = filename;
  document.body.appendChild(a); a.click(); a.remove();
  setTimeout(() => URL.revokeObjectURL(url), 1000);
}

export function nextNDates(n: number): string[] {
  const out: string[] = [];
  const today = new Date();
  for (let i = 0; i < n; i++) {
    const d = new Date(today);
    d.setDate(today.getDate() + i);
    out.push(d.toISOString().slice(0, 10));
  }
  return out;
}
