import { createFileRoute, Link, useNavigate, useSearch } from "@tanstack/react-router";
import { useQuery, useQueryClient } from "@tanstack/react-query";
import { useSession } from "@/lib/leaseup/use-session";
import { fetchMyTours, updateBookingStatus, setBookingSurvey, buildIcs, downloadIcs, formatDateChip, formatTime12, type Booking } from "@/lib/leaseup/tours";
import { Nav } from "@/components/leaseup/Nav";
import { Button } from "@/components/ui/button";
import { toast } from "sonner";
import { Calendar, Check, X, MessageSquare, Download } from "lucide-react";
import { cn } from "@/lib/utils";
import { openSignIn } from "@/components/leaseup/SignInModal";

export const Route = createFileRoute("/tours")({
  head: () => ({ meta: [{ title: "My tours — LeaseUp" }] }),
  validateSearch: (s: Record<string, unknown>): { survey?: string } => ({
    survey: typeof s.survey === "string" ? s.survey : undefined,
  }),
  component: ToursPage,
});

function ToursPage() {
  const { user } = useSession();
  const navigate = useNavigate();
  const qc = useQueryClient();
  const search = useSearch({ from: "/tours" });

  const { data: tours = [], isLoading } = useQuery({
    queryKey: ["my-tours", user?.id],
    queryFn: () => fetchMyTours(user!.id),
    enabled: !!user,
  });

  if (!user) {
    return (
      <div className="min-h-screen bg-background">
        <Nav onPost={() => {}} onOpenMessages={() => {}} onOpenProfile={() => {}} search="" onSearch={() => {}} />
        <div className="mx-auto max-w-md p-12 text-center">
          <h2 className="text-xl font-bold">Sign in to see your tours</h2>
          <button type="button" onClick={() => openSignIn("/tours")} className="mt-4 inline-block rounded-md bg-primary px-4 py-2 text-sm font-bold text-primary-foreground">Sign in</button>
        </div>
      </div>
    );
  }

  async function act(b: Booking, status: Booking["status"]) {
    try {
      await updateBookingStatus(b.id, status);
      qc.invalidateQueries({ queryKey: ["my-tours", user!.id] });
      toast.success(
        status === "confirmed" ? "Tour confirmed ✓" :
        status.startsWith("cancelled") ? "Tour cancelled" : "Updated",
      );
    } catch (e: any) { toast.error(e.message); }
  }

  async function survey(b: any, field: "poster_survey" | "subletter_survey", value: string) {
    try {
      await setBookingSurvey(b.id, field, value);
      qc.invalidateQueries({ queryKey: ["my-tours", user!.id] });
      if (field === "subletter_survey" && value === "went_well") {
        toast.success("Great! Reach out about next steps →");
      } else if (field === "subletter_survey") {
        toast("We'll show you similar listings.");
        navigate({ to: "/find-my-match" as any });
      } else if (field === "poster_survey" && value === "no_show") {
        toast("Marked as no-show.");
      } else if (field === "poster_survey" && value === "filled") {
        toast.success("Mark it as filled in My listings →");
      } else {
        toast.success("Thanks for the update!");
      }
    } catch (e: any) { toast.error(e.message); }
  }

  function downloadCalendar(b: any) {
    const ics = buildIcs({
      title: `Tour: ${b.listing?.title ?? "Listing"} (LeaseUp)`,
      description: `Tour scheduled via LeaseUp.`,
      location: b.listing?.area ?? "",
      dateISO: b.scheduled_date,
      time: b.scheduled_time,
      durationMin: 30,
    });
    downloadIcs(`leaseup-tour-${b.id}.ics`, ics);
  }

  const upcoming = tours.filter(t => ["pending", "confirmed"].includes(t.status) && new Date(t.scheduled_date) >= new Date(new Date().toDateString()));
  const past = tours.filter(t => !upcoming.includes(t));
  const surveyHighlight = search.survey;

  return (
    <div className="min-h-screen bg-background pb-24">
      <Nav onPost={() => {}} onOpenMessages={() => navigate({ to: "/" })} onOpenProfile={() => navigate({ to: "/" })} search="" onSearch={() => {}} />
      <header className="border-b bg-surface">
        <div className="mx-auto max-w-3xl px-4 py-6">
          <h1 className="flex items-center gap-2 text-2xl font-black"><Calendar className="h-6 w-6 text-primary" />Your tours</h1>
          <p className="text-sm text-muted-foreground">{upcoming.length} upcoming · {past.length} past</p>
        </div>
      </header>

      <main className="mx-auto max-w-3xl space-y-6 px-4 py-5">
        {isLoading ? (
          <div className="space-y-3">{Array.from({ length: 3 }).map((_, i) => <div key={i} className="h-32 animate-pulse rounded-xl bg-muted" />)}</div>
        ) : (
          <>
            <section>
              <h2 className="mb-2 text-sm font-bold uppercase text-muted-foreground">Upcoming</h2>
              {upcoming.length === 0 ? (
                <div className="rounded-xl bg-surface p-8 text-center text-sm text-muted-foreground">No upcoming tours.</div>
              ) : (
                <div className="space-y-3">
                  {upcoming.map(t => (
                    <TourCard
                      key={t.id} booking={t} viewerId={user.id}
                      onAccept={() => act(t, "confirmed")}
                      onDecline={() => act(t, t.poster_id === user.id ? "cancelled_poster" : "cancelled_subletter")}
                      onIcs={() => downloadCalendar(t)}
                      highlight={surveyHighlight === t.id}
                    />
                  ))}
                </div>
              )}
            </section>

            {past.length > 0 && (
              <section>
                <h2 className="mb-2 text-sm font-bold uppercase text-muted-foreground">Past & surveys</h2>
                <div className="space-y-3">
                  {past.map(t => (
                    <TourCard
                      key={t.id} booking={t} viewerId={user.id}
                      past
                      onAccept={() => {}} onDecline={() => {}} onIcs={() => downloadCalendar(t)}
                      onSurvey={(field, value) => survey(t, field, value)}
                      highlight={surveyHighlight === t.id}
                    />
                  ))}
                </div>
              </section>
            )}
          </>
        )}
      </main>
    </div>
  );
}

function TourCard({
  booking: b, viewerId, onAccept, onDecline, onIcs, onSurvey, past, highlight,
}: {
  booking: any; viewerId: string;
  onAccept: () => void; onDecline: () => void; onIcs: () => void;
  onSurvey?: (field: "poster_survey" | "subletter_survey", value: string) => void;
  past?: boolean; highlight?: boolean;
}) {
  const isPoster = b.poster_id === viewerId;
  const other = isPoster ? b.subletter : b.poster;
  const chip = formatDateChip(b.scheduled_date);
  const statusPill = (() => {
    switch (b.status) {
      case "pending": return <span className="rounded-full bg-amber-100 px-2 py-0.5 text-[10px] font-bold uppercase text-amber-700 dark:bg-amber-500/20 dark:text-amber-300">Pending</span>;
      case "confirmed": return <span className="rounded-full bg-success/15 px-2 py-0.5 text-[10px] font-bold uppercase text-success">✓ Confirmed</span>;
      case "cancelled_poster":
      case "cancelled_subletter": return <span className="rounded-full bg-muted px-2 py-0.5 text-[10px] font-bold uppercase text-muted-foreground">Cancelled</span>;
      case "completed": return <span className="rounded-full bg-primary/15 px-2 py-0.5 text-[10px] font-bold uppercase text-primary">Completed</span>;
      case "no_show": return <span className="rounded-full bg-destructive/15 px-2 py-0.5 text-[10px] font-bold uppercase text-destructive">No-show</span>;
    }
  })();
  return (
    <div className={cn("rounded-xl bg-surface p-4 shadow-card", highlight && "ring-2 ring-primary")}>
      <div className="flex items-start gap-3">
        <div className="grid h-12 w-12 shrink-0 place-items-center rounded-full text-xl" style={{ background: other?.banner_color ?? "#2563EB" }}>
          {other?.avatar_emoji ?? "🙂"}
        </div>
        <div className="min-w-0 flex-1">
          <div className="flex items-center gap-2 text-sm">
            <span className="font-bold">{other?.name ?? other?.email?.split("@")[0] ?? "Student"}</span>
            {statusPill}
          </div>
          <div className="truncate text-xs text-muted-foreground">{b.listing?.title}</div>
          <div className="mt-1 text-sm font-semibold">{chip.weekday}, {chip.monthDay} at {formatTime12(b.scheduled_time)}</div>
          {b.message && <div className="mt-1 rounded-md bg-background px-2 py-1 text-xs italic text-muted-foreground">"{b.message}"</div>}
        </div>
      </div>

      {!past && b.status === "pending" && isPoster && (
        <div className="mt-3 flex gap-2">
          <Button variant="outline" className="flex-1 gap-1" onClick={onDecline}><X className="h-4 w-4" />Decline</Button>
          <Button className="flex-1 gap-1 bg-success text-white hover:bg-success/90" onClick={onAccept}><Check className="h-4 w-4" />Confirm Tour</Button>
        </div>
      )}
      {!past && b.status === "confirmed" && (
        <div className="mt-3 grid grid-cols-3 gap-2">
          <Button variant="outline" className="gap-1" onClick={onIcs}><Download className="h-4 w-4" />Calendar</Button>
          <Button variant="outline" className="gap-1" onClick={() => location.href = `/?conversation=${b.listing?.id ?? ""}`}><MessageSquare className="h-4 w-4" />Message</Button>
          <Button variant="outline" className="text-destructive" onClick={onDecline}>Cancel</Button>
        </div>
      )}
      {!past && b.status === "pending" && !isPoster && (
        <div className="mt-3 flex gap-2">
          <Button variant="outline" className="flex-1" onClick={onDecline}>Cancel request</Button>
        </div>
      )}

      {past && onSurvey && (
        <div className="mt-3 space-y-2 rounded-lg border bg-background p-3">
          {!isPoster && !b.subletter_survey && (
            <>
              <div className="text-xs font-bold">How was your tour?</div>
              <div className="flex gap-2">
                <Button size="sm" variant="outline" className="flex-1" onClick={() => onSurvey("subletter_survey", "went_well")}>👍 Went well</Button>
                <Button size="sm" variant="outline" className="flex-1" onClick={() => onSurvey("subletter_survey", "didnt_work")}>👎 Didn't work out</Button>
              </div>
            </>
          )}
          {isPoster && !b.poster_survey && (
            <>
              <div className="text-xs font-bold">Did they tour your place?</div>
              <div className="flex flex-wrap gap-2">
                <Button size="sm" variant="outline" onClick={() => onSurvey("poster_survey", "yes")}>✓ Yes</Button>
                <Button size="sm" variant="outline" onClick={() => onSurvey("poster_survey", "no_show")}>✗ No-show</Button>
                <Button size="sm" variant="outline" onClick={() => onSurvey("poster_survey", "filled")}>🎉 Took it!</Button>
              </div>
            </>
          )}
          {(b.subletter_survey || b.poster_survey) && (
            <div className="text-[11px] text-muted-foreground">Thanks for the update.</div>
          )}
        </div>
      )}
    </div>
  );
}
