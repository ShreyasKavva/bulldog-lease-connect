import { Sheet, SheetContent, SheetHeader, SheetTitle } from "@/components/ui/sheet";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Textarea } from "@/components/ui/textarea";
import { Button } from "@/components/ui/button";
import { useQuery, useQueryClient } from "@tanstack/react-query";
import { fetchProfile } from "@/lib/leaseup/queries";
import { useSession } from "@/lib/leaseup/use-session";
import { BANNER_COLORS, VIBE_TAGS, YEARS } from "@/lib/leaseup/constants";
import { useEffect, useRef, useState } from "react";
import { UserAvatar } from "@/components/leaseup/UserAvatar";
import { supabase } from "@/integrations/supabase/client";
import { BadgeCheck, Camera, Pencil, Star, ShieldCheck } from "lucide-react";
import { toast } from "sonner";
import { cn } from "@/lib/utils";
import { ReviewsList } from "./ReviewsList";
import { LeaveReviewDialog } from "./LeaveReviewDialog";
import { canLeaveReview, fetchVerifiedSubleaseCount, computeReviewStats, fetchUserReviews } from "@/lib/leaseup/reviews.queries";
import { CampusAutocomplete } from "@/components/leaseup/CampusAutocomplete";
import { fetchCampusesByIds, type Campus } from "@/lib/leaseup/campuses";

export function ProfileSheet({
  userId, open, onOpenChange, onMessage, startEditing,
}: {
  userId: string | null;
  open: boolean;
  onOpenChange: (o: boolean) => void;
  onMessage?: (otherId: string) => void;
  startEditing?: boolean;
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
    name: "", year: "", major: "", bio: "", phone: "", instagram_handle: "",
    avatar_emoji: "🙂", banner_color: "#2563EB", vibe_tags: [] as string[],
    currently_status: "", currently_emoji: "🔎",
  });
  const [tab, setTab] = useState<"about" | "reviews">("about");
  const fileRef = useRef<HTMLInputElement>(null);
  const [uploading, setUploading] = useState(false);
  const [showReview, setShowReview] = useState(false);
  const [campus, setCampus] = useState<Campus | null>(null);
  const [campusTouched, setCampusTouched] = useState(false);
  const { data: profileCampus = [] } = useQuery({
    queryKey: ["campus-by-id", profile?.campus_id],
    queryFn: () => fetchCampusesByIds(profile?.campus_id ? [profile.campus_id] : []),
    enabled: !!profile?.campus_id,
  });
  useEffect(() => {
    if (!campusTouched && !campus && profileCampus[0]) setCampus(profileCampus[0]);
  }, [campus, campusTouched, profileCampus]);

  // Eligibility + verified count + review summary
  const { data: eligible } = useQuery({
    queryKey: ["review-eligible", user?.id, userId],
    queryFn: () => canLeaveReview(user!.id, userId!),
    enabled: !!user && !!userId && !isMe,
  });
  const { data: verifiedCount = 0 } = useQuery({
    queryKey: ["verified-subleases", userId],
    queryFn: () => fetchVerifiedSubleaseCount(userId!),
    enabled: !!userId && open,
  });
  const { data: reviews = [] } = useQuery({
    queryKey: ["reviews", userId],
    queryFn: () => fetchUserReviews(userId!),
    enabled: !!userId && open,
  });
  const stats = computeReviewStats(reviews);


  useEffect(() => {
    if (profile) setForm({
      name: profile.name ?? "", year: profile.year ?? "", major: profile.major ?? "",
      bio: profile.bio ?? "", phone: profile.phone ?? "",
      instagram_handle: (profile as any).instagram_handle ?? "",
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
      instagram_handle: form.instagram_handle.trim().replace(/^@/, "") || null,
      currently_status: form.currently_status.trim() || null,
      currently_emoji: form.currently_status.trim() ? form.currently_emoji : null,
      currently_updated_at: form.currently_status.trim() ? new Date().toISOString() : null,
    };
    if (campusTouched) payload.campus_id = campus?.id ?? null;
    const { error } = await supabase.from("profiles").update(payload).eq("id", user.id);
    if (error) { toast.error(error.message); return; }
    toast.success("Profile updated");
    qc.invalidateQueries({ queryKey: ["profile"] });
    qc.invalidateQueries({ queryKey: ["public-profile"] });
    setEditing(false);
  }

  // Q266 — upload a real profile photo. Stored in the private "avatars"
  // bucket; the path lands on profiles.avatar_url and UserAvatar signs it.
  async function uploadAvatar(file: File) {
    if (!user) return;
    if (!file.type.startsWith("image/")) { toast.error("Pick an image file"); return; }
    if (file.size > 5 * 1024 * 1024) { toast.error("Image must be under 5 MB"); return; }
    setUploading(true);
    try {
      const ext = (file.name.split(".").pop() || "jpg").toLowerCase();
      const path = `${user.id}/avatar-${Date.now()}.${ext}`;
      const { error } = await supabase.storage.from("avatars").upload(path, file, {
        contentType: file.type, upsert: true,
      });
      if (error) throw error;
      const { error: upErr } = await supabase.from("profiles").update({ avatar_url: path }).eq("id", user.id);
      if (upErr) throw upErr;
      toast.success("Photo updated");
      qc.invalidateQueries({ queryKey: ["profile"] });
      qc.invalidateQueries({ queryKey: ["public-profile"] });
    } catch (e: any) {
      toast.error(e?.message ?? "Upload failed");
    } finally {
      setUploading(false);
    }
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
              <div className="relative -mt-10 mb-4 h-20 w-20">
                <UserAvatar
                  name={profile.name}
                  avatarUrl={(profile as { avatar_url?: string | null }).avatar_url}
                  color={editing ? form.banner_color : (profile.banner_color ?? null)}
                  className="h-20 w-20 ring-4 ring-surface"
                  textClassName="text-3xl"
                />
                {isMe && (
                  <>
                    <button
                      type="button"
                      onClick={() => fileRef.current?.click()}
                      disabled={uploading}
                      aria-label="Upload profile photo"
                      className="absolute -bottom-1 -right-1 grid h-8 w-8 place-items-center rounded-full bg-primary text-primary-foreground shadow ring-2 ring-surface disabled:opacity-60"
                    >
                      <Camera className="h-4 w-4" />
                    </button>
                    <input
                      ref={fileRef}
                      type="file"
                      accept="image/*"
                      className="hidden"
                      onChange={(e) => {
                        const f = e.target.files?.[0];
                        e.target.value = "";
                        if (f) void uploadAvatar(f);
                      }}
                    />
                  </>
                )}
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
                  {/* Stats row: rating + verified subleases */}
                  <div className="mt-4 flex flex-wrap gap-2">
                    {stats.count > 0 && (
                      <div className="inline-flex items-center gap-1 rounded-full bg-amber-50 px-2.5 py-1 text-xs font-bold text-amber-900">
                        <Star className="h-3.5 w-3.5 fill-amber-400 text-amber-400" strokeWidth={1.5} />
                        {stats.avg.toFixed(1)} · {stats.count} review{stats.count === 1 ? "" : "s"}
                      </div>
                    )}
                    {verifiedCount > 0 && (
                      <div className="inline-flex items-center gap-1 rounded-full bg-success/10 px-2.5 py-1 text-xs font-bold text-success">
                        <ShieldCheck className="h-3.5 w-3.5" />
                        {verifiedCount} verified sublease{verifiedCount === 1 ? "" : "s"}
                      </div>
                    )}
                  </div>
                  {!isMe && onMessage && (
                    <div className="mt-4 flex gap-2">
                      <Button onClick={() => onMessage(profile.id)} className="flex-1 bg-primary hover:bg-primary-dark text-primary-foreground font-bold">
                        💬 Message {profile.name?.split(" ")[0]}
                      </Button>
                      {eligible && (
                        <Button variant="outline" onClick={() => setShowReview(true)} className="font-bold gap-1">
                          <Star className="h-4 w-4" /> Review
                        </Button>
                      )}
                    </div>
                  )}

                  {/* Tabs */}
                  <div className="mt-6 flex gap-1 border-b">
                    {(["about", "reviews"] as const).map((t) => (
                      <button
                        key={t}
                        onClick={() => setTab(t)}
                        className={cn(
                          "border-b-2 px-3 py-2 text-sm font-bold capitalize",
                          tab === t ? "border-primary text-primary" : "border-transparent text-muted-foreground",
                        )}
                      >
                        {t === "reviews" ? `Reviews${stats.count ? ` (${stats.count})` : ""}` : t}
                      </button>
                    ))}
                  </div>

                  {tab === "reviews" && (
                    <div className="mt-4">
                      <ReviewsList userId={profile.id} />
                    </div>
                  )}
                </>

              ) : (
                <div className="space-y-3">
                  <div><Label>Name</Label><Input value={form.name} onChange={(e) => setForm(f => ({ ...f, name: e.target.value }))} /></div>
                  <div>
                    <Label>University</Label>
                    <div className="mt-1 rounded-md border bg-surface px-3 py-2">
                      <CampusAutocomplete
                        value={campus?.name ?? ""}
                        placeholder="Search your school…"
                        onSelect={(c) => { setCampusTouched(true); setCampus(c); }}
                        onClear={() => { setCampusTouched(true); setCampus(null); }}
                      />
                    </div>
                  </div>
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
                  <div><Label>Instagram (optional)</Label><Input placeholder="@handle" value={form.instagram_handle} onChange={(e) => setForm(f => ({ ...f, instagram_handle: e.target.value }))} /></div>
                  <div><Label>Profile photo</Label>
                    <div className="mt-1">
                      <Button type="button" variant="outline" disabled={uploading} onClick={() => fileRef.current?.click()}>
                        <Camera className="mr-2 h-4 w-4" />
                        {uploading ? "Uploading…" : "Upload a photo"}
                      </Button>
                      <p className="mt-1 text-xs text-muted-foreground">
                        No photo? We show the first letter of your name.
                      </p>
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
      {profile && !isMe && (
        <LeaveReviewDialog
          open={showReview}
          onOpenChange={setShowReview}
          reviewedUserId={profile.id}
          reviewedName={profile.name || "this student"}
          reviewerRole="subletter"
        />
      )}
    </Sheet>
  );
}
