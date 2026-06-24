import { createFileRoute, Link } from "@tanstack/react-router";
import { useState } from "react";
import { useQuery, useQueryClient } from "@tanstack/react-query";
import { fetchLookingFor, createLookingFor, deleteLookingFor, getOrCreateConversation } from "@/lib/leaseup/queries";
import { useSession } from "@/lib/leaseup/use-session";
import { Nav } from "@/components/leaseup/Nav";
import { Button } from "@/components/ui/button";
import { Dialog, DialogContent, DialogHeader, DialogTitle, DialogFooter } from "@/components/ui/dialog";
import { Input } from "@/components/ui/input";
import { Textarea } from "@/components/ui/textarea";
import { Label } from "@/components/ui/label";
import { ProfileSheet } from "@/components/leaseup/ProfileSheet";
import { MessagesSheet } from "@/components/leaseup/MessagesSheet";
import { Plus, Trash2, MessageSquare, BadgeCheck, Calendar, DollarSign, MapPin } from "lucide-react";
import { toast } from "sonner";
import { NEIGHBORHOODS, timeAgo } from "@/lib/leaseup/constants";

export const Route = createFileRoute("/looking-for")({
  head: () => ({
    meta: [
      { title: "Looking For — LeaseUp" },
      { name: "description", content: "Post what you're looking for. Let other UGA students bring listings to you." },
    ],
  }),
  component: LookingForPage,
});

function LookingForPage() {
  const { user } = useSession();
  const qc = useQueryClient();
  const { data: posts = [], isLoading } = useQuery({ queryKey: ["looking-for"], queryFn: fetchLookingFor });
  const [open, setOpen] = useState(false);
  const [profileId, setProfileId] = useState<string | null>(null);
  const [activeConv, setActiveConv] = useState<string | null>(null);
  const [messagesOpen, setMessagesOpen] = useState(false);

  async function startConv(otherId: string) {
    if (!user) return toast.error("Sign in to message");
    if (otherId === user.id) return;
    const id = await getOrCreateConversation(user.id, otherId, null);
    setActiveConv(id); setMessagesOpen(true);
  }

  return (
    <div className="min-h-screen bg-background pb-24">
      <Nav
        onPost={() => user ? setOpen(true) : toast.error("Sign in first")}
        onOpenMessages={() => user && (setActiveConv(null), setMessagesOpen(true))}
        onOpenProfile={() => user && setProfileId(user.id)}
        search="" onSearch={() => {}}
      />

      <header className="border-b bg-surface">
        <div className="mx-auto max-w-5xl px-4 py-6 flex items-center gap-4">
          <div>
            <h1 className="text-2xl font-black">Looking For</h1>
            <p className="text-sm text-muted-foreground">Post what you need — let other students bring listings to you.</p>
          </div>
          <div className="ml-auto flex gap-2">
            <Link to="/" className="rounded-md border px-3 py-2 text-sm font-semibold hover:bg-background">Browse listings</Link>
            <Button onClick={() => user ? setOpen(true) : toast.error("Sign in first")} className="bg-primary hover:bg-primary-dark text-primary-foreground font-bold gap-1">
              <Plus className="h-4 w-4" />New post
            </Button>
          </div>
        </div>
      </header>

      <main className="mx-auto max-w-5xl px-4 py-6">
        {isLoading ? (
          <div className="space-y-3">{Array.from({ length: 4 }).map((_, i) => <div key={i} className="h-32 animate-pulse rounded-xl bg-muted" />)}</div>
        ) : posts.length === 0 ? (
          <div className="rounded-xl bg-surface p-12 text-center shadow-card">
            <div className="text-5xl">🔎</div>
            <h3 className="mt-3 text-lg font-bold">No posts yet</h3>
            <p className="mt-1 text-sm text-muted-foreground">Be the first to tell the community what you're looking for.</p>
          </div>
        ) : (
          <div className="grid gap-3 sm:grid-cols-2">
            {posts.map(p => (
              <article key={p.id} className="rounded-xl bg-surface p-4 shadow-card">
                <div className="flex items-start gap-3">
                  <button
                    onClick={() => setProfileId(p.user_id)}
                    className="grid h-10 w-10 place-items-center rounded-full text-base shrink-0"
                    style={{ background: p.profile?.banner_color ?? "#2563EB" }}
                  >{p.profile?.avatar_emoji ?? "🙂"}</button>
                  <div className="min-w-0 flex-1">
                    <div className="flex items-center gap-1">
                      <span className="text-sm font-bold">{p.profile?.name ?? "Student"}</span>
                      {p.profile?.verified_email && <BadgeCheck className="h-3.5 w-3.5 text-success" />}
                      <span className="ml-auto text-[10px] text-muted-foreground">{timeAgo(p.created_at)}</span>
                    </div>
                    <h3 className="mt-1 font-bold leading-tight">{p.title}</h3>
                    <p className="mt-1 text-sm text-muted-foreground line-clamp-3">{p.description}</p>
                    <div className="mt-2 flex flex-wrap gap-1.5 text-[11px]">
                      {p.budget_max && <span className="inline-flex items-center gap-1 rounded-full bg-primary-light px-2 py-0.5 font-semibold text-primary-dark"><DollarSign className="h-3 w-3" />≤${p.budget_max}</span>}
                      {p.beds_min && <span className="rounded-full bg-background px-2 py-0.5 font-semibold">{p.beds_min}+ bd</span>}
                      {p.area && <span className="inline-flex items-center gap-1 rounded-full bg-background px-2 py-0.5 font-semibold"><MapPin className="h-3 w-3" />{p.area}</span>}
                      {(p.move_in_date || p.move_out_date) && (
                        <span className="inline-flex items-center gap-1 rounded-full bg-background px-2 py-0.5 font-semibold">
                          <Calendar className="h-3 w-3" />{p.move_in_date ?? "?"} → {p.move_out_date ?? "?"}
                        </span>
                      )}
                      {p.furnished && <span className="rounded-full bg-accent px-2 py-0.5 font-semibold">Furnished</span>}
                      {p.pets_ok && <span className="rounded-full bg-accent px-2 py-0.5 font-semibold">Pets OK</span>}
                    </div>
                    <div className="mt-3 flex items-center gap-2">
                      {user && user.id !== p.user_id && (
                        <Button size="sm" onClick={() => startConv(p.user_id)} className="h-8 gap-1 bg-primary hover:bg-primary-dark text-primary-foreground">
                          <MessageSquare className="h-3.5 w-3.5" />Reply
                        </Button>
                      )}
                      {user?.id === p.user_id && (
                        <button
                          onClick={async () => { await deleteLookingFor(p.id); qc.invalidateQueries({ queryKey: ["looking-for"] }); }}
                          className="ml-auto inline-flex items-center gap-1 text-xs text-muted-foreground hover:text-destructive"
                        >
                          <Trash2 className="h-3.5 w-3.5" />Delete
                        </button>
                      )}
                    </div>
                  </div>
                </div>
              </article>
            ))}
          </div>
        )}
      </main>

      <NewLookingForDialog open={open} onOpenChange={setOpen} onCreated={() => qc.invalidateQueries({ queryKey: ["looking-for"] })} />
      <ProfileSheet userId={profileId} open={!!profileId} onOpenChange={(o) => !o && setProfileId(null)} onMessage={startConv} />
      <MessagesSheet open={messagesOpen} onOpenChange={setMessagesOpen} initialConversationId={activeConv} />
    </div>
  );
}

function NewLookingForDialog({ open, onOpenChange, onCreated }: { open: boolean; onOpenChange: (b: boolean) => void; onCreated: () => void }) {
  const { user } = useSession();
  const [title, setTitle] = useState("");
  const [description, setDescription] = useState("");
  const [budget, setBudget] = useState("");
  const [beds, setBeds] = useState("");
  const [area, setArea] = useState("");
  const [from, setFrom] = useState("");
  const [to, setTo] = useState("");
  const [furnished, setFurnished] = useState(false);
  const [pets, setPets] = useState(false);
  const [busy, setBusy] = useState(false);

  async function submit() {
    if (!user) return;
    if (!title.trim() || !description.trim()) return toast.error("Title and description required");
    setBusy(true);
    try {
      await createLookingFor(user.id, {
        title, description,
        budget_max: budget ? parseInt(budget) : null,
        beds_min: beds ? parseInt(beds) : null,
        area: area || null,
        move_in_date: from || null,
        move_out_date: to || null,
        furnished, pets_ok: pets,
      });
      toast.success("Posted");
      onCreated();
      onOpenChange(false);
      setTitle(""); setDescription(""); setBudget(""); setBeds(""); setArea(""); setFrom(""); setTo(""); setFurnished(false); setPets(false);
    } catch (e: any) { toast.error(e.message); } finally { setBusy(false); }
  }

  return (
    <Dialog open={open} onOpenChange={onOpenChange}>
      <DialogContent className="max-w-lg">
        <DialogHeader><DialogTitle>What are you looking for?</DialogTitle></DialogHeader>
        <div className="space-y-3">
          <div><Label>Title</Label><Input value={title} onChange={(e) => setTitle(e.target.value)} placeholder="2BR near campus for spring" /></div>
          <div><Label>Description</Label><Textarea value={description} onChange={(e) => setDescription(e.target.value)} placeholder="Tell us about you, your roommates, lifestyle, must-haves…" rows={4} /></div>
          <div className="grid grid-cols-2 gap-3">
            <div><Label>Max budget</Label><Input type="number" value={budget} onChange={(e) => setBudget(e.target.value)} placeholder="900" /></div>
            <div><Label>Min beds</Label><Input type="number" value={beds} onChange={(e) => setBeds(e.target.value)} placeholder="2" /></div>
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
            {busy ? "Posting…" : "Post"}
          </Button>
        </DialogFooter>
      </DialogContent>
    </Dialog>
  );
}
