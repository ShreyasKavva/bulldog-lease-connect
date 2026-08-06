import { createFileRoute, Link } from "@tanstack/react-router";
import { useState, useEffect } from "react";
import { useQuery, useQueryClient } from "@tanstack/react-query";
import {
  fetchLookingFor,
  createLookingFor,
  updateLookingFor,
  deleteLookingFor,
  renewLookingFor,
  markLookingForFound,
  fetchMyLookingForInterests,
  toggleLookingForInterest,
  fetchMatchingListingsForPost,
  getOrCreateConversation,
} from "@/lib/leaseup/queries";
import { useSession, useMyProfile } from "@/lib/leaseup/use-session";
import { fetchCampuses } from "@/lib/leaseup/campuses";

import { Button } from "@/components/ui/button";
import {
  Dialog, DialogContent, DialogHeader, DialogTitle, DialogFooter, DialogDescription,
} from "@/components/ui/dialog";
import {
  Sheet, SheetContent, SheetHeader, SheetTitle,
} from "@/components/ui/sheet";
import { Input } from "@/components/ui/input";
import { Textarea } from "@/components/ui/textarea";
import { Label } from "@/components/ui/label";
import { ProfileSheet } from "@/components/leaseup/ProfileSheet";
import { MessagesSheet } from "@/components/leaseup/MessagesSheet";
import {
  Plus, Trash2, Pencil, Check, MessageSquare, BadgeCheck, Calendar, DollarSign,
  MapPin, Bell, BellOff, Users, Bed,
} from "lucide-react";
import { toast } from "sonner";
import { NEIGHBORHOODS, timeAgo } from "@/lib/leaseup/constants";
import type { LookingForPost, Listing } from "@/lib/leaseup/types";

export const Route = createFileRoute("/looking")({
  head: () => ({
    meta: [
      { title: "Looking For a Sublease? Post Here. — LeaseUp" },
      { name: "description", content: "Tell students what you need. Get notified when a matching listing is posted." },
      { property: "og:title", content: "Looking For a Sublease? Post Here." },
      { property: "og:description", content: "Tell students what you need. Get notified when a matching listing is posted." },
      { property: "og:url", content: "https://leasup.co/looking" },
      { property: "og:type", content: "website" },
    ],
    links: [{ rel: "canonical", href: "https://leasup.co/looking" }],
  }),
  component: LookingForPage,
});

function activeAgo(iso?: string | null) {
  if (!iso) return null;
  const s = Math.floor((Date.now() - new Date(iso).getTime()) / 1000);
  if (s < 120) return "Active now";
  if (s < 3600) return `Active ${Math.floor(s / 60)}m ago`;
  if (s < 86400) return `Active ${Math.floor(s / 3600)}h ago`;
  return `Active ${Math.floor(s / 86400)}d ago`;
}

function fmtDateRange(from: string | null, to: string | null) {
  if (!from && !to) return null;
  const fmt = (d: string | null) =>
    d ? new Date(d).toLocaleDateString(undefined, { month: "short", year: "numeric" }) : "?";
  return `${fmt(from)} – ${fmt(to)}`;
}

function LookingForPage() {
  const { user } = useSession();
  const { data: myProfile } = useMyProfile();
  const qc = useQueryClient();
  const { data: campuses = [] } = useQuery({
    queryKey: ["campuses"],
    queryFn: fetchCampuses,
    staleTime: Infinity,
  });

  // Filters — campus scope defaults to the student's own campus.
  const [campusFilter, setCampusFilter] = useState<string>("mine");
  const [budgetFilter, setBudgetFilter] = useState<string>("");
  const [moveInBy, setMoveInBy] = useState<string>("");

  const campusId =
    campusFilter === "all" ? null : campusFilter === "mine" ? myProfile?.campus_id ?? null : campusFilter;

  const { data: allPosts = [], isLoading } = useQuery({
    queryKey: ["looking-for", campusId],
    queryFn: () => fetchLookingFor(campusId),
  });

  const posts = allPosts.filter((p) => {
    if (budgetFilter && (p.budget_max == null || p.budget_max > Number(budgetFilter))) return false;
    if (moveInBy && (!p.move_in_date || p.move_in_date > moveInBy)) return false;
    return true;
  });
  const { data: myInterests = [] } = useQuery({
    queryKey: ["looking-for-interests", user?.id],
    queryFn: () => (user ? fetchMyLookingForInterests(user.id) : Promise.resolve([])),
    enabled: !!user,
  });
  const interestSet = new Set(myInterests);


  const [formOpen, setFormOpen] = useState(false);
  const [editing, setEditing] = useState<LookingForPost | null>(null);
  const [profileId, setProfileId] = useState<string | null>(null);
  const [activeConv, setActiveConv] = useState<string | null>(null);
  const [messagesOpen, setMessagesOpen] = useState(false);
  const [matchesFor, setMatchesFor] = useState<LookingForPost | null>(null);
  const [foundFor, setFoundFor] = useState<LookingForPost | null>(null);
  const [confirmDelete, setConfirmDelete] = useState<LookingForPost | null>(null);

  async function startConv(otherId: string) {
    if (!user) return toast.error("Sign in to message");
    if (otherId === user.id) return;
    const id = await getOrCreateConversation(user.id, otherId, null);
    setActiveConv(id);
    setMessagesOpen(true);
  }

  function openPost() {
    if (!user) return toast.error("Sign in first");
    setEditing(null);
    setFormOpen(true);
  }

  function openEdit(p: LookingForPost) {
    setEditing(p);
    setFormOpen(true);
  }

  async function onToggleInterest(p: LookingForPost) {
    if (!user) return toast.error("Sign in first");
    const interested = !interestSet.has(p.id);
    try {
      await toggleLookingForInterest(user.id, p.id, interested);
      qc.invalidateQueries({ queryKey: ["looking-for-interests", user.id] });
      toast.success(interested ? "We'll ping you when you post a match" : "Notifications off for this post");
    } catch (e: any) { toast.error(e.message); }
  }

  async function onRenew(p: LookingForPost) {
    try {
      await renewLookingFor(p.id);
      qc.invalidateQueries({ queryKey: ["looking-for"] });
      toast.success("Renewed for 60 more days");
    } catch (e: any) { toast.error(e.message); }
  }

  return (
    <div className="min-h-screen bg-background pb-24">


      <header className="border-b bg-surface">
        <div className="mx-auto max-w-5xl px-4 py-6 flex items-center gap-4">
          <div>
            <h1 className="text-2xl font-black">Looking For</h1>
            <p className="text-sm text-muted-foreground">Post what you need — let other students bring listings to you.</p>
          </div>
          <div className="ml-auto flex gap-2">
            <Link to="/" className="rounded-md border px-3 py-2 text-sm font-semibold hover:bg-background">Browse listings</Link>
            <Button onClick={openPost} className="bg-primary hover:bg-primary-dark text-primary-foreground font-bold gap-1">
              <Plus className="h-4 w-4" />New post
            </Button>
          </div>
        </div>
      </header>

      <main className="mx-auto max-w-5xl px-4 py-6">
        <div className="mb-4 flex flex-wrap items-center justify-between gap-3 rounded-xl border border-primary/20 bg-primary-light/50 px-4 py-3 text-sm">
          <p className="font-medium text-primary-dark">
            Have a sublease to fill? Browse the board and message students directly.
          </p>
          <Link to="/browse" className="inline-flex items-center gap-1 rounded-md bg-primary px-3 py-1.5 text-xs font-bold text-primary-foreground hover:bg-primary-dark">
            Browse listings →
          </Link>
        </div>

        {/* Filters */}
        <div className="mb-5 flex flex-wrap items-end gap-3">
          <label className="text-xs font-semibold text-muted-foreground">
            Campus
            <select
              value={campusFilter}
              onChange={(e) => setCampusFilter(e.target.value)}
              className="mt-1 block h-10 w-56 rounded-md border bg-surface px-3 text-sm font-medium text-foreground"
            >
              <option value="mine">My campus</option>
              <option value="all">All campuses</option>
              {campuses.map((c) => (
                <option key={c.id} value={c.id}>{c.name}</option>
              ))}
            </select>
          </label>
          <label className="text-xs font-semibold text-muted-foreground">
            Budget up to
            <select
              value={budgetFilter}
              onChange={(e) => setBudgetFilter(e.target.value)}
              className="mt-1 block h-10 w-36 rounded-md border bg-surface px-3 text-sm font-medium text-foreground"
            >
              <option value="">Any</option>
              {[600, 800, 1000, 1200, 1500, 2000].map((v) => (
                <option key={v} value={v}>${v}/mo</option>
              ))}
            </select>
          </label>
          <label className="text-xs font-semibold text-muted-foreground">
            Moving in by
            <input
              type="date"
              value={moveInBy}
              onChange={(e) => setMoveInBy(e.target.value)}
              className="mt-1 block h-10 w-44 rounded-md border bg-surface px-3 text-sm font-medium text-foreground"
            />
          </label>
          {(budgetFilter || moveInBy || campusFilter !== "mine") && (
            <button
              type="button"
              onClick={() => { setBudgetFilter(""); setMoveInBy(""); setCampusFilter("mine"); }}
              className="h-10 rounded-md px-3 text-sm font-semibold text-primary hover:underline"
            >
              Clear filters
            </button>
          )}
          <span className="ml-auto text-xs text-muted-foreground">
            {isLoading ? "" : `${posts.length} student${posts.length === 1 ? "" : "s"} looking`}
          </span>
        </div>



        {isLoading ? (
          <div className="grid gap-3 sm:grid-cols-2">
            {Array.from({ length: 4 }).map((_, i) => <div key={i} className="h-44 animate-pulse rounded-xl bg-muted" />)}
          </div>
        ) : posts.length === 0 ? (
          <div className="rounded-xl bg-surface p-12 text-center shadow-card">
            <div className="text-5xl">🔎</div>
            <h3 className="mt-3 text-lg font-bold">No posts yet</h3>
            <p className="mt-1 text-sm text-muted-foreground">Be the first to tell the community what you're looking for.</p>
            <Button onClick={openPost} className="mt-4 bg-primary hover:bg-primary-dark text-primary-foreground font-bold gap-1">
              <Plus className="h-4 w-4" />Post a request
            </Button>
          </div>
        ) : (
          <div className="grid gap-3 sm:grid-cols-2">
            {posts.map(p => (
              <LookingForCard
                key={p.id}
                p={p}
                isMine={user?.id === p.user_id}
                interested={interestSet.has(p.id)}
                onOpenProfile={() => setProfileId(p.user_id)}
                onReply={() => startConv(p.user_id)}
                onEdit={() => openEdit(p)}
                onDelete={() => setConfirmDelete(p)}
                onFound={() => setFoundFor(p)}
                onSeeMatches={() => setMatchesFor(p)}
                onNotifyMe={() => onToggleInterest(p)}
                onRenew={() => onRenew(p)}
              />
            ))}
          </div>
        )}
      </main>

      <LookingForFormDialog
        open={formOpen}
        onOpenChange={(o) => { setFormOpen(o); if (!o) setEditing(null); }}
        editing={editing}
        onSaved={() => qc.invalidateQueries({ queryKey: ["looking-for"] })}
      />

      <FoundDialog
        post={foundFor}
        userId={user?.id ?? null}
        onClose={() => setFoundFor(null)}
        onDone={() => qc.invalidateQueries({ queryKey: ["looking-for"] })}
      />

      <ConfirmDeleteDialog
        post={confirmDelete}
        onCancel={() => setConfirmDelete(null)}
        onConfirm={async () => {
          if (!confirmDelete) return;
          try {
            await deleteLookingFor(confirmDelete.id);
            toast.success("Post removed");
            qc.invalidateQueries({ queryKey: ["looking-for"] });
          } catch (e: any) { toast.error(e.message); }
          finally { setConfirmDelete(null); }
        }}
      />

      <MatchesSheet
        post={matchesFor}
        onClose={() => setMatchesFor(null)}
      />

      <ProfileSheet userId={profileId} open={!!profileId} onOpenChange={(o) => !o && setProfileId(null)} onMessage={startConv} />
      <MessagesSheet open={messagesOpen} onOpenChange={setMessagesOpen} initialConversationId={activeConv} />
    </div>
  );
}

function LookingForCard({
  p, isMine, interested,
  onOpenProfile, onReply, onEdit, onDelete, onFound, onSeeMatches, onNotifyMe, onRenew,
}: {
  p: LookingForPost;
  isMine: boolean;
  interested: boolean;
  onOpenProfile: () => void;
  onReply: () => void;
  onEdit: () => void;
  onDelete: () => void;
  onFound: () => void;
  onSeeMatches: () => void;
  onNotifyMe: () => void;
  onRenew: () => void;
}) {
  const profile = p.profile;
  const dateRange = fmtDateRange(p.move_in_date, p.move_out_date);
  const ageDays = Math.floor((Date.now() - new Date(p.created_at).getTime()) / (1000 * 60 * 60 * 24));
  const expiringSoon = ageDays >= 55 && ageDays < 60;
  const last = activeAgo(profile?.last_seen ?? profile?.updated_at ?? null);

  return (
    <article className="relative rounded-xl bg-surface p-4 shadow-card transition hover:shadow-md">
      {/* Owner controls */}
      {isMine && (
        <div className="absolute right-3 top-3 flex items-center gap-1">
          <button
            onClick={onEdit}
            title="Edit"
            className="grid h-8 w-8 place-items-center rounded-full text-muted-foreground hover:bg-background hover:text-foreground"
          >
            <Pencil className="h-4 w-4" />
          </button>
          <button
            onClick={onDelete}
            title="Remove"
            className="grid h-8 w-8 place-items-center rounded-full text-muted-foreground hover:bg-destructive/10 hover:text-destructive"
          >
            <Trash2 className="h-4 w-4" />
          </button>
        </div>
      )}

      <div className="flex items-start gap-3">
        <button
          onClick={onOpenProfile}
          className="grid h-12 w-12 shrink-0 place-items-center rounded-full text-xl ring-2 ring-white"
          style={{ background: profile?.banner_color ?? "#2563EB" }}
          aria-label="View profile"
        >
          {profile?.avatar_emoji ?? "🙂"}
        </button>

        <div className="min-w-0 flex-1 pr-14">
          <div className="flex flex-wrap items-center gap-1.5">
            <button onClick={onOpenProfile} className="truncate text-sm font-bold hover:underline">
              {profile?.name ?? "Student"}
            </button>
            {profile?.verified_email && (
              <span title="Verified .edu" className="inline-flex">
                <BadgeCheck className="h-3.5 w-3.5 text-success" />
              </span>
            )}
            {last && <span className="text-[11px] text-muted-foreground">· {last}</span>}
            <span className="ml-auto text-[10px] text-muted-foreground">{timeAgo(p.created_at)}</span>
          </div>

          <h3 className="mt-1 font-bold leading-tight">{p.title}</h3>
          <p className="mt-1 text-sm text-muted-foreground line-clamp-3">{p.description}</p>

          <div className="mt-2 flex flex-wrap gap-1.5 text-[11px]">
            {p.budget_max != null && (
              <span className="inline-flex items-center gap-1 rounded-full bg-emerald-100 px-2 py-0.5 font-semibold text-emerald-800">
                <DollarSign className="h-3 w-3" />≤ ${p.budget_max}/mo
              </span>
            )}
            {dateRange && (
              <span className="inline-flex items-center gap-1 rounded-full bg-primary-light px-2 py-0.5 font-semibold text-primary-dark">
                <Calendar className="h-3 w-3" />{dateRange}
              </span>
            )}
            {(p.num_people ?? 1) > 1 && (
              <span className="inline-flex items-center gap-1 rounded-full bg-background px-2 py-0.5 font-semibold">
                <Users className="h-3 w-3" />{p.num_people} people
              </span>
            )}
            {p.beds_min != null && (
              <span className="inline-flex items-center gap-1 rounded-full bg-background px-2 py-0.5 font-semibold">
                <Bed className="h-3 w-3" />{p.beds_min}+ bd
              </span>
            )}
            {p.area && (
              <span className="inline-flex items-center gap-1 rounded-full bg-background px-2 py-0.5 font-semibold">
                <MapPin className="h-3 w-3" />{p.area}
              </span>
            )}
            {p.furnished && <span className="rounded-full bg-accent px-2 py-0.5 font-semibold">Furnished</span>}
            {p.pets_ok && <span className="rounded-full bg-accent px-2 py-0.5 font-semibold">Pets OK</span>}
          </div>

          {profile?.vibe_tags && profile.vibe_tags.length > 0 && (
            <div className="mt-2 flex flex-wrap gap-1 text-[11px]">
              {profile.vibe_tags.slice(0, 4).map((t: string) => (
                <span key={t} className="rounded-full bg-background px-2 py-0.5 text-muted-foreground">{t}</span>
              ))}
            </div>
          )}

          <div className="mt-3 flex flex-wrap items-center gap-2">
            {!isMine && (
              <>
                <Button size="sm" onClick={onReply} className="h-8 gap-1 bg-primary hover:bg-primary-dark text-primary-foreground">
                  <MessageSquare className="h-3.5 w-3.5" />Reply
                </Button>
                <button
                  onClick={onNotifyMe}
                  className={`inline-flex items-center gap-1 rounded-full border px-2.5 py-1 text-xs font-semibold transition ${
                    interested
                      ? "border-primary bg-primary-light text-primary-dark"
                      : "border-border text-muted-foreground hover:border-primary hover:text-primary"
                  }`}
                  title={interested ? "We'll notify you" : "Notify when I post"}
                >
                  {interested ? <Bell className="h-3.5 w-3.5" /> : <BellOff className="h-3.5 w-3.5" />}
                  {interested ? "Notifying you" : "Notify when I post"}
                </button>
              </>
            )}

            {isMine && (
              <>
                <Button size="sm" onClick={onSeeMatches} className="h-8 gap-1 bg-primary hover:bg-primary-dark text-primary-foreground">
                  See matches →
                </Button>
                <Button
                  size="sm"
                  variant="outline"
                  onClick={onFound}
                  className="h-8 gap-1 border-emerald-500 text-emerald-700 hover:bg-emerald-50"
                >
                  <Check className="h-3.5 w-3.5" />Found a place!
                </Button>
                {expiringSoon && (
                  <button
                    onClick={onRenew}
                    className="inline-flex items-center gap-1 rounded-full bg-amber-100 px-2.5 py-1 text-xs font-semibold text-amber-800 hover:bg-amber-200"
                    title="Renew for 90 more days"
                  >
                    ⏳ Expires soon · Renew
                  </button>
                )}
              </>
            )}

            {(p.interest_count ?? 0) > 0 && (
              <span className="ml-auto inline-flex items-center gap-1 text-[11px] text-muted-foreground" title="People watching for your matches">
                <Users className="h-3 w-3" />{p.interest_count} watching
              </span>
            )}
          </div>
        </div>
      </div>
    </article>
  );
}

function LookingForFormDialog({
  open, onOpenChange, editing, onSaved,
}: {
  open: boolean;
  onOpenChange: (b: boolean) => void;
  editing: LookingForPost | null;
  onSaved: () => void;
}) {
  const { user } = useSession();
  const { data: profile } = useMyProfile();
  const [title, setTitle] = useState("");
  const [description, setDescription] = useState("");
  const [budget, setBudget] = useState("");
  const [beds, setBeds] = useState("");
  const [people, setPeople] = useState("1");
  const [area, setArea] = useState("");
  const [from, setFrom] = useState("");
  const [to, setTo] = useState("");
  const [furnished, setFurnished] = useState(false);
  const [pets, setPets] = useState(false);
  const [busy, setBusy] = useState(false);

  useEffect(() => {
    if (!open) return;
    if (editing) {
      setTitle(editing.title ?? "");
      setDescription(editing.description ?? "");
      setBudget(editing.budget_max?.toString() ?? "");
      setBeds(editing.beds_min?.toString() ?? "");
      setPeople((editing.num_people ?? 1).toString());
      setArea(editing.area ?? "");
      setFrom(editing.move_in_date ?? "");
      setTo(editing.move_out_date ?? "");
      setFurnished(!!editing.furnished);
      setPets(!!editing.pets_ok);
    } else {
      setTitle(""); setDescription(""); setBudget(""); setBeds(""); setPeople("1");
      setArea(""); setFrom(""); setTo(""); setFurnished(false); setPets(false);
    }
  }, [open, editing]);

  async function submit() {
    if (!user) return;
    if (!title.trim() || !description.trim()) return toast.error("Title and description required");
    setBusy(true);
    try {
      const payload: Partial<LookingForPost> = {
        title, description,
        budget_max: budget ? parseInt(budget) : null,
        beds_min: beds ? parseInt(beds) : null,
        num_people: people ? Math.max(1, parseInt(people)) : 1,
        area: area || null,
        move_in_date: from || null,
        move_out_date: to || null,
        furnished, pets_ok: pets,
      };
      if (editing) {
        await updateLookingFor(editing.id, payload);
        toast.success("Updated");
      } else {
        await createLookingFor(user.id, payload, profile?.campus_id ?? null);
        toast.success("Posted");
      }
      onSaved();
      onOpenChange(false);
    } catch (e: any) { toast.error(e.message); }
    finally { setBusy(false); }
  }

  return (
    <Dialog open={open} onOpenChange={onOpenChange}>
      <DialogContent className="max-w-lg">
        <DialogHeader>
          <DialogTitle>{editing ? "Edit your post" : "What are you looking for?"}</DialogTitle>
        </DialogHeader>
        <div className="space-y-3">
          <div><Label>Title</Label><Input value={title} onChange={(e) => setTitle(e.target.value)} placeholder="2BR near campus for spring" /></div>
          <div>
            <Label>Description</Label>
            <Textarea
              value={description}
              onChange={(e) => setDescription(e.target.value.slice(0, 300))}
              placeholder="e.g. Quiet grad student looking for a furnished 1BR or private room near North Campus for fall semester. Flexible on exact location."
              rows={4}
              maxLength={300}
            />
            <div className="mt-1 text-right text-[11px] text-muted-foreground">{description.length}/300</div>
          </div>
          <div className="grid grid-cols-2 gap-3">
            <div><Label>Max budget</Label><Input type="number" value={budget} onChange={(e) => setBudget(e.target.value)} placeholder="900" /></div>
            <div><Label>Min beds</Label><Input type="number" value={beds} onChange={(e) => setBeds(e.target.value)} placeholder="2" /></div>
            <div><Label>How many people</Label><Input type="number" min={1} value={people} onChange={(e) => setPeople(e.target.value)} placeholder="1" /></div>
            <div><Label>Move-in</Label><Input type="date" value={from} onChange={(e) => setFrom(e.target.value)} /></div>
            <div><Label>Move-out</Label><Input type="date" value={to} onChange={(e) => setTo(e.target.value)} /></div>
          </div>
          <div><Label>Area</Label>
            <select value={area} onChange={(e) => setArea(e.target.value)} className="mt-1 h-10 w-full rounded-md border bg-surface px-3 text-sm">
              <option value="">Any</option>
              {NEIGHBORHOODS.map(n => <option key={n.name}>{n.name}</option>)}
            </select>
          </div>
          <div className="flex gap-4 text-sm">
            <label className="flex items-center gap-2"><input type="checkbox" checked={furnished} onChange={(e) => setFurnished(e.target.checked)} />Furnished</label>
            <label className="flex items-center gap-2"><input type="checkbox" checked={pets} onChange={(e) => setPets(e.target.checked)} />Pets OK</label>
          </div>
        </div>
        <DialogFooter>
          <Button onClick={submit} disabled={busy} className="bg-primary hover:bg-primary-dark text-primary-foreground font-bold">
            {busy ? "Saving…" : editing ? "Save changes" : "Post"}
          </Button>
        </DialogFooter>
      </DialogContent>
    </Dialog>
  );
}

function ConfirmDeleteDialog({
  post, onCancel, onConfirm,
}: { post: LookingForPost | null; onCancel: () => void; onConfirm: () => void }) {
  return (
    <Dialog open={!!post} onOpenChange={(o) => !o && onCancel()}>
      <DialogContent className="max-w-sm">
        <DialogHeader>
          <DialogTitle>Remove your Looking For post?</DialogTitle>
          <DialogDescription>You won't be notified of new matches.</DialogDescription>
        </DialogHeader>
        <DialogFooter className="gap-2">
          <Button variant="outline" onClick={onCancel}>Cancel</Button>
          <Button onClick={onConfirm} className="bg-destructive text-destructive-foreground hover:bg-destructive/90">Remove</Button>
        </DialogFooter>
      </DialogContent>
    </Dialog>
  );
}

function FoundDialog({
  post, userId, onClose, onDone,
}: {
  post: LookingForPost | null;
  userId: string | null;
  onClose: () => void;
  onDone: () => void;
}) {
  const [busy, setBusy] = useState(false);
  async function go(via: boolean) {
    if (!post || !userId) return;
    setBusy(true);
    try {
      await markLookingForFound(post, { foundViaLeaseUp: via, userId });
      toast.success(via ? "🎉 Love to hear it!" : "Glad you found a place!");
      onDone();
      onClose();
    } catch (e: any) { toast.error(e.message); }
    finally { setBusy(false); }
  }
  return (
    <Dialog open={!!post} onOpenChange={(o) => !o && onClose()}>
      <DialogContent className="max-w-sm text-center">
        <DialogHeader>
          <DialogTitle className="text-center text-2xl">🎉 Congrats!</DialogTitle>
          <DialogDescription className="text-center">Did you find it on LeaseUp?</DialogDescription>
        </DialogHeader>
        <DialogFooter className="flex-col gap-2 sm:flex-col">
          <Button onClick={() => go(true)} disabled={busy} className="w-full bg-primary hover:bg-primary-dark text-primary-foreground font-bold">
            Yes, through LeaseUp
          </Button>
          <Button onClick={() => go(false)} disabled={busy} variant="outline" className="w-full">
            Found it elsewhere
          </Button>
        </DialogFooter>
      </DialogContent>
    </Dialog>
  );
}

function MatchesSheet({ post, onClose }: { post: LookingForPost | null; onClose: () => void }) {
  const { data: matches = [], isLoading } = useQuery({
    queryKey: ["lf-matches", post?.id],
    queryFn: () => (post ? fetchMatchingListingsForPost(post) : Promise.resolve([])),
    enabled: !!post,
  });

  return (
    <Sheet open={!!post} onOpenChange={(o) => !o && onClose()}>
      <SheetContent side="bottom" className="h-[88vh] overflow-y-auto">
        <SheetHeader>
          <SheetTitle className="text-left">
            Listings that match your post
            <span className="ml-2 text-sm font-medium text-muted-foreground">
              {isLoading ? "" : `${matches.length} match${matches.length === 1 ? "" : "es"}`}
            </span>
          </SheetTitle>
        </SheetHeader>

        {isLoading ? (
          <div className="mt-4 space-y-3">
            {Array.from({ length: 3 }).map((_, i) => <div key={i} className="h-24 animate-pulse rounded-xl bg-muted" />)}
          </div>
        ) : matches.length === 0 ? (
          <div className="mt-12 rounded-xl bg-background p-8 text-center">
            <div className="text-4xl">🌱</div>
            <p className="mt-3 font-semibold">No listings match yet</p>
            <p className="mt-1 text-sm text-muted-foreground">
              We'll email you when one is posted.
            </p>
          </div>
        ) : (
          <div className="mt-4 grid gap-3 sm:grid-cols-2">
            {matches.map(l => <MatchListingRow key={l.id} l={l} />)}
          </div>
        )}
      </SheetContent>
    </Sheet>
  );
}

function MatchListingRow({ l }: { l: Listing }) {
  const photo = l.photo_urls?.[0];
  function open() {
    window.dispatchEvent(new CustomEvent("lu:open-listing", { detail: { id: l.id } }));
  }
  return (
    <button
      onClick={open}
      className="flex gap-3 rounded-xl bg-surface p-3 text-left shadow-card transition hover:shadow-md"
    >
      <div className="h-20 w-24 shrink-0 overflow-hidden rounded-lg bg-muted">
        {photo ? <img src={photo} alt="" className="h-full w-full object-cover" /> : null}
      </div>
      <div className="min-w-0 flex-1">
        <div className="flex items-center gap-2">
          <span className="font-bold">${l.price}</span>
          <span className="text-xs text-muted-foreground">/mo</span>
        </div>
        <p className="truncate text-sm font-semibold">{l.title}</p>
        <p className="truncate text-xs text-muted-foreground">
          {l.beds}bd · {l.baths}ba{l.area ? ` · ${l.area}` : ""}
        </p>
      </div>
    </button>
  );
}
