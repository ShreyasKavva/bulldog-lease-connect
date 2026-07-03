import { createFileRoute, Link, useNavigate } from "@tanstack/react-router";
import { useMemo, useState } from "react";
import { useQuery, useQueryClient } from "@tanstack/react-query";
import { useSession, useMyProfile } from "@/lib/leaseup/use-session";
import {
  fetchMyRoommateProfile,
  fetchRoommateProfiles,
  fetchMyOutgoingInterests,
  sendRoommateInterest,
  setRoommateActive,
  computeCompatibility,
  compatColor,
  type RoommateProfile,
  type RoommateProfileWithUser,
} from "@/lib/leaseup/roommates";
import { Button } from "@/components/ui/button";
import { Textarea } from "@/components/ui/textarea";
import { Sheet, SheetContent, SheetHeader, SheetTitle } from "@/components/ui/sheet";
import { toast } from "sonner";
import { cn } from "@/lib/utils";
import { ArrowLeft, Users, Sparkles, Pencil, Eye, BadgeCheck, ShieldCheck, Filter, Check } from "lucide-react";

export const Route = createFileRoute("/roommates")({
  head: () => ({
    meta: [
      { title: "Find a roommate — LeaseUp" },
      { name: "description", content: "Browse compatible roommate profiles at your campus and connect with students who match your lifestyle." },
    ],
  }),
  component: RoommatesPage,
});

function RoommatesPage() {
  const navigate = useNavigate();
  const { user } = useSession();
  const { data: profile } = useMyProfile();
  const qc = useQueryClient();

  const { data: myRoommate } = useQuery({
    queryKey: ["my-roommate-profile", user?.id],
    queryFn: () => fetchMyRoommateProfile(user!.id),
    enabled: !!user?.id,
  });

  const { data: feed = [], isLoading } = useQuery({
    queryKey: ["roommate-profiles", profile?.campus_id, user?.id],
    queryFn: () => fetchRoommateProfiles({ campusId: profile?.campus_id ?? null, excludeUserId: user!.id }),
    enabled: !!user?.id,
  });

  const { data: outgoing = [] } = useQuery({
    queryKey: ["roommate-outgoing", user?.id],
    queryFn: () => fetchMyOutgoingInterests(user!.id),
    enabled: !!user?.id,
  });
  const sentIds = useMemo(() => new Set(outgoing.map(o => o.to_user_id)), [outgoing]);

  const [filtersOpen, setFiltersOpen] = useState(false);
  const [maxBudget, setMaxBudget] = useState(1500);
  const [bedsFilter, setBedsFilter] = useState<number | null>(null);
  const [vibeFilter, setVibeFilter] = useState<"any" | "night_owl" | "early_bird" | "social" | "studious">("any");
  const [petsFilter, setPetsFilter] = useState<"any" | "pet_friendly" | "no_pets">("any");

  const filtered = useMemo(() => {
    return feed.filter(p => {
      if (p.budget_min != null && p.budget_min > maxBudget) return false;
      if (bedsFilter != null && p.beds_wanted !== bedsFilter) return false;
      if (vibeFilter === "night_owl" && !p.lifestyle_night_owl) return false;
      if (vibeFilter === "early_bird" && !p.lifestyle_early_bird) return false;
      if (vibeFilter === "social" && !p.lifestyle_social) return false;
      if (vibeFilter === "studious" && !p.lifestyle_studious) return false;
      if (petsFilter === "pet_friendly" && !p.pet_friendly) return false;
      if (petsFilter === "no_pets" && p.has_pets) return false;
      return true;
    });
  }, [feed, maxBudget, bedsFilter, vibeFilter, petsFilter]);

  const [connecting, setConnecting] = useState<RoommateProfileWithUser | null>(null);

  function openPost() { navigate({ to: "/" }); }
  function openChat() { navigate({ to: "/browse" }); }

  async function togglePause() {
    if (!user) return;
    try {
      await setRoommateActive(user.id, !(myRoommate?.is_active ?? true));
      qc.invalidateQueries({ queryKey: ["my-roommate-profile"] });
      toast.success(myRoommate?.is_active ? "Hidden from browse" : "Visible again");
    } catch (e: any) {
      toast.error(e.message ?? "Failed");
    }
  }

  return (
    <div className="min-h-screen bg-background pb-24">
      <header className="sticky top-0 z-10 border-b border-border bg-surface/95 px-4 py-3 backdrop-blur-md">
        <div className="flex items-center gap-3">
          <Link to="/browse" className="grid h-9 w-9 place-items-center rounded-full hover:bg-background">
            <ArrowLeft className="h-5 w-5" />
          </Link>
          <div className="flex-1 min-w-0">
            <h1 className="text-lg font-extrabold leading-tight">👥 Roommates</h1>
            <p className="text-xs text-muted-foreground truncate">Find someone compatible to share a place with</p>
          </div>
          <button onClick={() => setFiltersOpen(true)}
            className="grid h-9 w-9 place-items-center rounded-full bg-background hover:bg-border"
            aria-label="Filters">
            <Filter className="h-4 w-4" />
          </button>
        </div>

        {/* Sub-tabs */}
        <div className="mt-3 flex gap-1 text-sm font-bold">
          <Link to="/browse" className="rounded-full bg-background px-3 py-1.5 text-muted-foreground hover:text-foreground">🏠 Available</Link>
          <Link to="/looking-for" className="rounded-full bg-background px-3 py-1.5 text-muted-foreground hover:text-foreground">🔍 Looking For</Link>
          <span className="rounded-full bg-primary px-3 py-1.5 text-primary-foreground">👥 Roommates</span>
        </div>
      </header>

      <main className="mx-auto max-w-2xl px-4 py-4 space-y-4">
        {/* My profile section */}
        {myRoommate ? (
          <MyRoommateCard p={myRoommate} onEdit={() => navigate({ to: "/roommates/create" })} onPause={togglePause} />
        ) : (
          <Link
            to="/roommates/create"
            className="block rounded-2xl bg-gradient-to-br from-primary to-primary-dark p-5 text-primary-foreground shadow-card-lg"
          >
            <div className="flex items-center gap-3">
              <span className="grid h-12 w-12 place-items-center rounded-full bg-white/20 text-2xl">👥</span>
              <div className="flex-1">
                <div className="text-base font-extrabold">Find a Roommate</div>
                <div className="text-xs opacity-90">Create your profile to start matching with compatible students.</div>
              </div>
              <Sparkles className="h-5 w-5" />
            </div>
          </Link>
        )}

        {/* Browse feed */}
        <div>
          <h2 className="mt-2 mb-3 text-sm font-extrabold uppercase tracking-wider text-muted-foreground">
            {filtered.length} {filtered.length === 1 ? "match" : "matches"} on your campus
          </h2>

          {isLoading ? (
            <div className="grid gap-3">
              {[0,1,2].map(i => <div key={i} className="h-40 rounded-2xl bg-surface lu-shimmer" />)}
            </div>
          ) : filtered.length === 0 ? (
            <div className="rounded-2xl border border-dashed border-border bg-surface p-8 text-center">
              <Users className="mx-auto h-8 w-8 text-muted-foreground" />
              <p className="mt-2 text-sm text-muted-foreground">No roommate profiles match these filters yet.</p>
              <p className="text-xs text-muted-foreground">Be one of the first — create your profile.</p>
            </div>
          ) : (
            <div className="grid gap-3">
              {filtered.map(p => (
                <RoommateCard
                  key={p.id}
                  p={p}
                  me={myRoommate ?? null}
                  alreadySent={sentIds.has(p.user_id)}
                  onConnect={() => setConnecting(p)}
                />
              ))}
            </div>
          )}
        </div>
      </main>

      

      {/* Filters sheet */}
      <Sheet open={filtersOpen} onOpenChange={setFiltersOpen}>
        <SheetContent side="bottom" className="max-h-[80vh] overflow-y-auto rounded-t-3xl">
          <SheetHeader><SheetTitle>Filter roommates</SheetTitle></SheetHeader>
          <div className="space-y-5 py-4">
            <div>
              <div className="flex items-center justify-between mb-1">
                <span className="text-sm font-bold">Max budget</span>
                <span className="text-sm font-bold text-primary">${maxBudget}</span>
              </div>
              <input type="range" min={300} max={1500} step={50} value={maxBudget}
                onChange={(e) => setMaxBudget(parseInt(e.target.value))} className="w-full" />
            </div>
            <div>
              <div className="text-sm font-bold mb-2">Beds</div>
              <div className="flex gap-2">
                <Pill active={bedsFilter === null} onClick={() => setBedsFilter(null)}>Any</Pill>
                {[1,2,3,4].map(b => (
                  <Pill key={b} active={bedsFilter === b} onClick={() => setBedsFilter(b)}>{b}{b===4?"+":""}</Pill>
                ))}
              </div>
            </div>
            <div>
              <div className="text-sm font-bold mb-2">Lifestyle</div>
              <div className="flex flex-wrap gap-2">
                <Pill active={vibeFilter==="any"} onClick={() => setVibeFilter("any")}>Any</Pill>
                <Pill active={vibeFilter==="early_bird"} onClick={() => setVibeFilter("early_bird")}>☀️ Early bird</Pill>
                <Pill active={vibeFilter==="night_owl"} onClick={() => setVibeFilter("night_owl")}>🌙 Night owl</Pill>
                <Pill active={vibeFilter==="social"} onClick={() => setVibeFilter("social")}>🎉 Social</Pill>
                <Pill active={vibeFilter==="studious"} onClick={() => setVibeFilter("studious")}>📚 Studious</Pill>
              </div>
            </div>
            <div>
              <div className="text-sm font-bold mb-2">Pets</div>
              <div className="flex flex-wrap gap-2">
                <Pill active={petsFilter==="any"} onClick={() => setPetsFilter("any")}>Any</Pill>
                <Pill active={petsFilter==="pet_friendly"} onClick={() => setPetsFilter("pet_friendly")}>🐾 Pet friendly</Pill>
                <Pill active={petsFilter==="no_pets"} onClick={() => setPetsFilter("no_pets")}>🚫 No pets</Pill>
              </div>
            </div>
            <Button onClick={() => setFiltersOpen(false)} className="w-full font-bold">Show {filtered.length} results</Button>
          </div>
        </SheetContent>
      </Sheet>

      {/* Connect sheet */}
      <ConnectSheet
        target={connecting}
        me={myRoommate ?? null}
        onClose={() => setConnecting(null)}
        onSent={() => {
          qc.invalidateQueries({ queryKey: ["roommate-outgoing"] });
          setConnecting(null);
        }}
      />
    </div>
  );
}

function Pill({ active, onClick, children }: { active: boolean; onClick: () => void; children: React.ReactNode }) {
  return (
    <button onClick={onClick}
      className={cn("rounded-full border px-3.5 py-1.5 text-sm font-semibold transition active:scale-95",
        active ? "border-primary bg-primary text-primary-foreground" : "border-border bg-surface hover:bg-background")}>
      {children}
    </button>
  );
}

function MyRoommateCard({ p, onEdit, onPause }: { p: RoommateProfile; onEdit: () => void; onPause: () => void }) {
  return (
    <section className="rounded-2xl border border-border bg-surface p-4 shadow-card-md">
      <div className="flex items-center justify-between gap-2">
        <div className="text-xs font-extrabold uppercase tracking-wider text-muted-foreground">Your roommate profile</div>
        <span className={cn("rounded-full px-2 py-0.5 text-[10px] font-bold uppercase",
          p.is_active ? "bg-emerald-100 text-emerald-700 dark:bg-emerald-500/15 dark:text-emerald-300" : "bg-muted text-muted-foreground")}>
          {p.is_active ? "Active" : "Paused"}
        </span>
      </div>
      <div className="mt-2 text-sm">
        💰 ${p.budget_min ?? "?"}–${p.budget_max ?? "?"} · 🛏 {p.beds_wanted ?? "?"}BR
        {p.move_in_date ? ` · 📅 ${new Date(p.move_in_date).toLocaleDateString(undefined, { month: "short", year: "numeric" })}` : ""}
      </div>
      {p.about_me && <p className="mt-2 text-sm text-foreground/80 line-clamp-2">"{p.about_me}"</p>}
      <div className="mt-3 flex items-center gap-3 text-xs text-muted-foreground">
        <Eye className="h-3.5 w-3.5" />
        <span>{p.view_count} {p.view_count === 1 ? "view" : "views"} so far</span>
      </div>
      <div className="mt-3 grid grid-cols-2 gap-2">
        <Button variant="outline" size="sm" onClick={onEdit} className="font-bold">
          <Pencil className="h-3.5 w-3.5 mr-1" /> Edit
        </Button>
        <Button variant="outline" size="sm" onClick={onPause} className="font-bold">
          {p.is_active ? "Pause" : "Make active"}
        </Button>
      </div>
    </section>
  );
}

function RoommateCard({ p, me, alreadySent, onConnect }: {
  p: RoommateProfileWithUser;
  me: RoommateProfile | null;
  alreadySent: boolean;
  onConnect: () => void;
}) {
  const { score } = computeCompatibility(me, p);
  const tags: string[] = [];
  if (p.lifestyle_night_owl) tags.push("🌙 Night owl");
  if (p.lifestyle_early_bird) tags.push("☀️ Early bird");
  if (p.lifestyle_studious) tags.push("📚 Studious");
  if (p.lifestyle_social) tags.push("🎉 Social");
  if (p.has_pets) tags.push("🐾 Has pets");
  else if (!p.pet_friendly) tags.push("🚫 No pets");

  const u = p.profile;
  const move = p.move_in_date ? new Date(p.move_in_date).toLocaleDateString(undefined, { month: "short", year: "numeric" }) : "Flexible";

  return (
    <article className="rounded-2xl border border-border bg-surface p-4 shadow-card-md transition hover:shadow-card-lg">
      <div className="flex items-start gap-3">
        <div className="grid h-14 w-14 shrink-0 place-items-center rounded-full text-2xl"
          style={{ background: u?.banner_color ?? "#2563EB", color: "white" }}>
          {u?.avatar_emoji ?? "🙂"}
        </div>
        <div className="flex-1 min-w-0">
          <div className="flex items-center gap-1.5">
            <h3 className="font-extrabold leading-tight truncate">{u?.name ?? "A student"}</h3>
            {u?.verified_email && <BadgeCheck className="h-3.5 w-3.5 text-primary shrink-0" />}
          </div>
          <div className="text-xs text-muted-foreground truncate">
            {[u?.year, u?.major].filter(Boolean).join(" · ") || "Student"}
          </div>
        </div>
        {me && (
          <div className={cn("rounded-full px-2.5 py-1 text-xs font-extrabold", compatColor(score))}>
            🤝 {score}%
          </div>
        )}
      </div>

      <div className="mt-2.5 text-sm text-foreground/90">
        📅 {move} · 🛏 {p.beds_wanted ?? "?"}BR · 💰 ${p.budget_min ?? "?"}–${p.budget_max ?? "?"}/mo
      </div>

      {tags.length > 0 && (
        <div className="mt-2 flex flex-wrap gap-1.5">
          {tags.map(t => (
            <span key={t} className="rounded-full bg-background px-2 py-0.5 text-[11px] font-semibold text-foreground/80">{t}</span>
          ))}
        </div>
      )}

      {p.about_me && (
        <p className="mt-2 text-sm text-foreground/80 line-clamp-2">"{p.about_me}"</p>
      )}

      <div className="mt-3 flex gap-2">
        <Button size="sm" className="flex-1 font-bold" disabled={alreadySent} onClick={onConnect}>
          {alreadySent ? <><Check className="h-3.5 w-3.5 mr-1" /> Request sent</> : "Connect →"}
        </Button>
      </div>
    </article>
  );
}

function ConnectSheet({ target, me, onClose, onSent }: {
  target: RoommateProfileWithUser | null;
  me: RoommateProfile | null;
  onClose: () => void;
  onSent: () => void;
}) {
  const { user } = useSession();
  const [note, setNote] = useState("");
  const [sending, setSending] = useState(false);
  const compat = target ? computeCompatibility(me, target) : { score: 0, reasons: [] };

  async function send() {
    if (!user || !target) return;
    setSending(true);
    try {
      await sendRoommateInterest(user.id, target.user_id, note || undefined);
      toast.success("Connection request sent ✨");
      setNote("");
      onSent();
    } catch (e: any) {
      toast.error(e.message?.includes("duplicate") ? "Already requested" : (e.message ?? "Failed"));
    } finally {
      setSending(false);
    }
  }

  return (
    <Sheet open={!!target} onOpenChange={(o) => { if (!o) onClose(); }}>
      <SheetContent side="bottom" className="max-h-[85vh] overflow-y-auto rounded-t-3xl">
        {target && (
          <>
            <SheetHeader>
              <SheetTitle>Connect with {target.profile?.name ?? "this student"}</SheetTitle>
            </SheetHeader>
            <div className="space-y-4 py-4">
              <div className="flex items-center gap-3">
                <div className="grid h-14 w-14 place-items-center rounded-full text-2xl"
                  style={{ background: target.profile?.banner_color ?? "#2563EB", color: "white" }}>
                  {target.profile?.avatar_emoji ?? "🙂"}
                </div>
                <div className="flex-1">
                  <div className="font-extrabold flex items-center gap-1.5">
                    {target.profile?.name ?? "A student"}
                    {target.profile?.verified_email && <BadgeCheck className="h-4 w-4 text-primary" />}
                  </div>
                  <div className="text-xs text-muted-foreground">
                    {[target.profile?.year, target.profile?.major].filter(Boolean).join(" · ")}
                  </div>
                </div>
                {me && (
                  <div className={cn("rounded-full px-3 py-1 text-sm font-extrabold", compatColor(compat.score))}>
                    🤝 {compat.score}%
                  </div>
                )}
              </div>

              {me && compat.reasons.length > 0 && (
                <ul className="space-y-1 rounded-xl bg-background p-3 text-sm">
                  {compat.reasons.slice(0, 5).map((r, i) => (
                    <li key={i} className={cn("flex items-start gap-2", r.good ? "text-foreground" : "text-amber-700 dark:text-amber-300")}>
                      <span>{r.good ? "✓" : "⚠"}</span><span>{r.text}</span>
                    </li>
                  ))}
                </ul>
              )}

              {!me && (
                <div className="rounded-xl bg-primary-light p-3 text-sm text-primary-dark">
                  💡 Create your roommate profile to see compatibility scores.
                </div>
              )}

              <div>
                <label className="text-sm font-bold">Optional note</label>
                <Textarea
                  value={note}
                  onChange={(e) => setNote(e.target.value.slice(0, 120))}
                  placeholder="Hi! I'm also looking for a 2BR. Would love to chat!"
                  rows={3}
                  className="mt-1.5"
                />
                <div className="mt-1 text-right text-xs text-muted-foreground">{note.length}/120</div>
              </div>

              <div className="flex items-start gap-2 rounded-xl bg-background p-3 text-xs text-muted-foreground">
                <ShieldCheck className="h-4 w-4 text-primary mt-0.5 shrink-0" />
                They'll get a notification. A chat opens automatically only if you both connect.
              </div>

              <Button onClick={send} disabled={sending} className="w-full font-bold">
                {sending ? "Sending…" : "Send Connection Request →"}
              </Button>
            </div>
          </>
        )}
      </SheetContent>
    </Sheet>
  );
}
