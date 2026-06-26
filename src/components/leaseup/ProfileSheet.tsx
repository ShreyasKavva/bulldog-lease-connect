import { Sheet, SheetContent, SheetHeader, SheetTitle } from "@/components/ui/sheet";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Textarea } from "@/components/ui/textarea";
import { Button } from "@/components/ui/button";
import { useQuery, useQueryClient } from "@tanstack/react-query";
import { fetchProfile } from "@/lib/leaseup/queries";
import { useSession } from "@/lib/leaseup/use-session";
import { AVATAR_EMOJIS, BANNER_COLORS, VIBE_TAGS, YEARS } from "@/lib/leaseup/constants";
import { useEffect, useState } from "react";
import { supabase } from "@/integrations/supabase/client";
import { BadgeCheck, Pencil } from "lucide-react";
import { toast } from "sonner";
import { cn } from "@/lib/utils";

export function ProfileSheet({
  userId, open, onOpenChange, onMessage,
}: {
  userId: string | null;
  open: boolean;
  onOpenChange: (o: boolean) => void;
  onMessage?: (otherId: string) => void;
}) {
  const { user } = useSession();
  const isMe = !!user && user.id === userId;
  const qc = useQueryClient();
  const { data: profile } = useQuery({
    queryKey: ["profile", userId],
    queryFn: () => fetchProfile(userId!),
    enabled: !!userId && open,
  });
  const [editing, setEditing] = useState(false);
  const [form, setForm] = useState({
    name: "", year: "", major: "", bio: "", phone: "",
    avatar_emoji: "🙂", banner_color: "#2563EB", vibe_tags: [] as string[],
    currently_status: "", currently_emoji: "🔎",
  });

  useEffect(() => {
    if (profile) setForm({
      name: profile.name ?? "", year: profile.year ?? "", major: profile.major ?? "",
      bio: profile.bio ?? "", phone: profile.phone ?? "",
      avatar_emoji: profile.avatar_emoji ?? "🙂", banner_color: profile.banner_color ?? "#2563EB",
      vibe_tags: profile.vibe_tags ?? [],
      currently_status: profile.currently_status ?? "",
      currently_emoji: profile.currently_emoji ?? "🔎",
    });
  }, [profile]);

  async function save() {
    if (!user) return;
    const payload: any = {
      ...form, vibe_tags: form.vibe_tags.slice(0, 3),
      currently_status: form.currently_status.trim() || null,
      currently_emoji: form.currently_status.trim() ? form.currently_emoji : null,
      currently_updated_at: form.currently_status.trim() ? new Date().toISOString() : null,
    };
    const { error } = await supabase.from("profiles").update(payload).eq("id", user.id);
    if (error) { toast.error(error.message); return; }
    toast.success("Profile updated");
    qc.invalidateQueries({ queryKey: ["profile"] });
    setEditing(false);
  }

  function toggleVibe(v: string) {
    setForm(f => ({ ...f, vibe_tags: f.vibe_tags.includes(v) ? f.vibe_tags.filter(x => x !== v) : (f.vibe_tags.length < 3 ? [...f.vibe_tags, v] : f.vibe_tags) }));
  }

  return (
    <Sheet open={open} onOpenChange={onOpenChange}>
      <SheetContent side="bottom" className="h-[90vh] overflow-y-auto p-0">
        <SheetHeader className="sr-only"><SheetTitle>Profile</SheetTitle></SheetHeader>
        {profile ? (
          <>
            <div className="relative h-28" style={{ background: editing ? form.banner_color : (profile.banner_color ?? "#2563EB") }}>
              {isMe && !editing && (
                <button onClick={() => setEditing(true)} className="absolute right-3 top-3 grid h-9 w-9 place-items-center rounded-full bg-white/95 text-foreground shadow">
                  <Pencil className="h-4 w-4" />
                </button>
              )}
            </div>
            <div className="relative px-5 pb-8">
              <div className="-mt-10 mb-4 grid h-20 w-20 place-items-center rounded-full text-4xl ring-4 ring-surface" style={{ background: editing ? form.banner_color : (profile.banner_color ?? "#2563EB") }}>
                {editing ? form.avatar_emoji : profile.avatar_emoji}
              </div>

              {!editing ? (
                <>
                  <div className="flex items-center gap-2">
                    <h2 className="text-2xl font-extrabold">{profile.name || "Unnamed"}</h2>
                    {profile.verified_email && <BadgeCheck className="h-5 w-5 text-success" />}
                  </div>
                  <p className="text-sm text-muted-foreground">
                    {profile.year ?? "Student"}{profile.major ? ` · ${profile.major}` : ""}
                  </p>
                  {profile.currently_status && (
                    <div className="mt-3 inline-flex max-w-full items-center gap-2 rounded-full bg-primary-light px-3 py-1.5 text-sm font-semibold text-primary-dark">
                      <span>{profile.currently_emoji ?? "🔎"}</span>
                      <span className="truncate">{profile.currently_status}</span>
                    </div>
                  )}
                  {profile.bio && <p className="mt-3 text-sm">{profile.bio}</p>}
                  {(profile.vibe_tags?.length ?? 0) > 0 && (
                    <div className="mt-3 flex flex-wrap gap-1.5">
                      {profile.vibe_tags!.map(v => (
                        <span key={v} className="rounded-full bg-primary-light px-3 py-1 text-xs font-semibold text-primary-dark">{v}</span>
                      ))}
                    </div>
                  )}
                  {!isMe && onMessage && (
                    <Button onClick={() => onMessage(profile.id)} className="mt-4 w-full bg-primary hover:bg-primary-dark text-primary-foreground font-bold">
                      💬 Message {profile.name?.split(" ")[0]}
                    </Button>
                  )}
                </>
              ) : (
                <div className="space-y-3">
                  <div><Label>Name</Label><Input value={form.name} onChange={(e) => setForm(f => ({ ...f, name: e.target.value }))} /></div>
                  <div className="grid grid-cols-2 gap-2">
                    <div><Label>Year</Label>
                      <select value={form.year} onChange={(e) => setForm(f => ({ ...f, year: e.target.value }))} className="h-10 w-full rounded-md border bg-surface px-3 text-sm">
                        <option value="">—</option>
                        {YEARS.map(y => <option key={y}>{y}</option>)}
                      </select>
                    </div>
                    <div><Label>Major</Label><Input value={form.major} onChange={(e) => setForm(f => ({ ...f, major: e.target.value }))} /></div>
                  </div>
                  <div>
                    <Label>Currently (max 60)</Label>
                    <div className="mt-1 flex gap-2">
                      <select
                        value={form.currently_emoji}
                        onChange={(e) => setForm(f => ({ ...f, currently_emoji: e.target.value }))}
                        className="h-10 rounded-md border bg-surface px-2 text-lg"
                      >
                        {["🔎","🏠","📦","🎓","✈️","🔥","🤝","☕️"].map(e => <option key={e}>{e}</option>)}
                      </select>
                      <Input
                        maxLength={60}
                        placeholder="e.g. Looking near North Campus, Aug–Dec"
                        value={form.currently_status}
                        onChange={(e) => setForm(f => ({ ...f, currently_status: e.target.value }))}
                      />
                    </div>
                  </div>
                  <div><Label>Bio (max 120)</Label><Textarea maxLength={120} value={form.bio} onChange={(e) => setForm(f => ({ ...f, bio: e.target.value }))} /></div>
                  <div><Label>Phone (optional)</Label><Input value={form.phone} onChange={(e) => setForm(f => ({ ...f, phone: e.target.value }))} /></div>
                  <div><Label>Avatar</Label>
                    <div className="flex flex-wrap gap-2 mt-1">
                      {AVATAR_EMOJIS.map(e => (
                        <button key={e} onClick={() => setForm(f => ({ ...f, avatar_emoji: e }))}
                          className={cn("grid h-10 w-10 place-items-center rounded-full text-xl border-2", form.avatar_emoji === e ? "border-primary" : "border-transparent bg-background")}>{e}</button>
                      ))}
                    </div>
                  </div>
                  <div><Label>Banner color</Label>
                    <div className="flex gap-2 mt-1">
                      {BANNER_COLORS.map(c => (
                        <button key={c} onClick={() => setForm(f => ({ ...f, banner_color: c }))}
                          style={{ background: c }}
                          className={cn("h-8 w-8 rounded-full border-2", form.banner_color === c ? "border-foreground" : "border-transparent")} />
                      ))}
                    </div>
                  </div>
                  <div><Label>Vibe tags ({form.vibe_tags.length}/3)</Label>
                    <div className="flex flex-wrap gap-1.5 mt-1">
                      {VIBE_TAGS.map(v => (
                        <button key={v} onClick={() => toggleVibe(v)}
                          className={cn("rounded-full border px-3 py-1 text-xs font-semibold", form.vibe_tags.includes(v) ? "border-primary bg-primary-light text-primary-dark" : "border-border text-muted-foreground")}>{v}</button>
                      ))}
                    </div>
                  </div>
                  <div className="flex gap-2 pt-2">
                    <Button onClick={save} className="flex-1 bg-primary hover:bg-primary-dark text-primary-foreground font-bold">Save</Button>
                    <Button variant="outline" onClick={() => setEditing(false)}>Cancel</Button>
                  </div>
                </div>
              )}
            </div>
          </>
        ) : (
          <div className="p-8 text-center text-sm text-muted-foreground">Loading…</div>
        )}
      </SheetContent>
    </Sheet>
  );
}
