/**
 * Shared profile page UI used by /profile (own) and /profile/$userId (public).
 * Reads via public.get_public_profile RPC so it works for any viewer.
 */
import { useQuery, useQueryClient } from "@tanstack/react-query";
import { Link, useNavigate } from "@tanstack/react-router";
import { useMemo, useState, useRef } from "react";
import { supabase } from "@/integrations/supabase/client";
import { useSession } from "@/lib/leaseup/use-session";
import { fetchUserReviews, computeReviewStats } from "@/lib/leaseup/reviews.queries";
import { getOrCreateConversation } from "@/lib/leaseup/queries";
import { fetchMyRoommateProfile } from "@/lib/leaseup/roommates";
import { ListingCard } from "@/components/leaseup/ListingCard";
import { ProfileSheet } from "@/components/leaseup/ProfileSheet";
import { Button } from "@/components/ui/button";
import { toast } from "sonner";
import { BadgeCheck, Instagram, Pencil, Star, Plus, MessageCircle, Users, Camera, Home } from "lucide-react";
import { cn } from "@/lib/utils";

function maskLastName(name: string | null | undefined): string {
  if (!name) return "Student";
  const parts = name.trim().split(/\s+/);
  const first = parts[0] ?? "Student";
  const last = parts[1];
  return last ? `${first} ${last[0].toUpperCase()}.` : first;
}

type PublicProfile = {
  id: string;
  name: string | null;
  year: string | null;
  major: string | null;
  bio: string | null;
  avatar_url: string | null;
  avatar_emoji: string | null;
  banner_color: string | null;
  vibe_tags: string[] | null;
  instagram_handle: string | null;
  verified_email: boolean;
  campus_id: string | null;
  campus_name: string | null;
  response_rate: number | null;
  avg_rating: number | null;
  review_count: number;
  listing_count: number;
  active_listing_count: number;
  completed_count: number;
  created_at: string | null;
};


const CAMPUS_ABBREV: Record<string, string> = {
  "University of Georgia": "UGA",
  "Auburn University": "Auburn",
  "University of Florida": "UF",
  "Georgia Tech": "GT",
  "Georgia Institute of Technology": "GT",
  "University of Alabama": "Alabama",
};

function abbrevCampus(name: string | null | undefined): string | null {
  if (!name) return null;
  if (CAMPUS_ABBREV[name]) return CAMPUS_ABBREV[name];
  return name.split(/\s+/)[0];
}

async function fetchCampusSlug(campusId: string | null | undefined) {
  if (!campusId) return null;
  const { data } = await supabase.from("campuses").select("slug, short_name, name").eq("id", campusId).maybeSingle();
  return data ?? null;
}


async function fetchPublicProfile(userId: string): Promise<PublicProfile | null> {
  const { data, error } = await supabase.rpc("get_public_profile", { _uid: userId });
  if (error) throw error;
  return (data as any) ?? null;
}

async function fetchUserListings(userId: string, activeOnly: boolean) {
  let q = supabase.from("listings").select("*").eq("user_id", userId)
    .order("is_featured", { ascending: false }).order("created_at", { ascending: false });
  if (activeOnly) q = q.eq("is_active", true);
  const { data, error } = await q;
  if (error) throw error;
  const rows = data ?? [];
  const paths = rows.flatMap((l: any) => (l.photos ?? []).filter((p: string) => !/^https?:\/\//.test(p)));
  let urlMap = new Map<string, string>();
  if (paths.length) {
    const { data: signed } = await supabase.storage.from("listing-photos").createSignedUrls(paths, 60 * 60 * 24 * 7);
    signed?.forEach((s) => { if (s.path && s.signedUrl) urlMap.set(s.path, s.signedUrl); });
  }
  return rows.map((l: any) => ({
    ...l,
    photo_urls: (l.photos ?? [])
      .map((p: string) => (/^https?:\/\//.test(p) ? p : urlMap.get(p) ?? ""))
      .filter(Boolean),
  }));

}

function useAvatarSignedUrl(path: string | null | undefined) {
  return useQuery({
    queryKey: ["avatar-url", path],
    queryFn: async () => {
      if (!path) return null;
      if (path.startsWith("http")) return path;
      const { data } = await supabase.storage.from("avatars").createSignedUrl(path, 60 * 60 * 24 * 7);
      return data?.signedUrl ?? null;
    },
    enabled: !!path,
    staleTime: 60 * 60 * 1000,
  });
}

export function ProfileView({ userId }: { userId: string }) {
  const { user } = useSession();
  const navigate = useNavigate();
  const qc = useQueryClient();
  const isOwn = user?.id === userId;

  const { data: profile, isLoading } = useQuery({
    queryKey: ["public-profile", userId],
    queryFn: () => fetchPublicProfile(userId),
  });
  const { data: avatarUrl } = useAvatarSignedUrl(profile?.avatar_url);
  const { data: listings = [] } = useQuery({
    queryKey: ["user-listings", userId, isOwn],
    queryFn: () => fetchUserListings(userId, !isOwn),
    enabled: !!userId,
  });
  const { data: reviews = [] } = useQuery({
    queryKey: ["reviews", userId],
    queryFn: () => fetchUserReviews(userId),
  });
  const { data: roommateProfile } = useQuery({
    queryKey: ["roommate-profile-for-user", userId],
    queryFn: () => fetchMyRoommateProfile(userId),
    enabled: !!userId,
  });
  const stats = computeReviewStats(reviews);

  const [editOpen, setEditOpen] = useState(false);
  const fileRef = useRef<HTMLInputElement>(null);
  const [uploading, setUploading] = useState(false);

  const completion = useMemo(() => {
    if (!profile) return 0;
    const fields = [
      !!profile.avatar_url,
      !!(profile.bio && profile.bio.trim()),
      !!profile.year,
      !!profile.major,
    ];
    return Math.round((fields.filter(Boolean).length / fields.length) * 100);
  }, [profile]);

  const { data: campusRow } = useQuery({
    queryKey: ["campus-row", profile?.campus_id],
    queryFn: () => fetchCampusSlug(profile?.campus_id),
    enabled: !!profile?.campus_id,
    staleTime: 60 * 60 * 1000,
  });


  async function uploadAvatar(file: File) {
    if (!user) return;
    setUploading(true);
    try {
      const ext = file.name.split(".").pop() || "jpg";
      const path = `${user.id}/avatar-${Date.now()}.${ext}`;
      const { error } = await supabase.storage.from("avatars").upload(path, file, { contentType: file.type, upsert: true });
      if (error) throw error;
      const { error: upErr } = await supabase.from("profiles").update({ avatar_url: path }).eq("id", user.id);
      if (upErr) throw upErr;
      toast.success("Photo updated");
      qc.invalidateQueries({ queryKey: ["public-profile", userId] });
      qc.invalidateQueries({ queryKey: ["profile", userId] });
    } catch (e: any) {
      toast.error(e.message ?? "Upload failed");
    } finally {
      setUploading(false);
    }
  }

  async function handleMessage() {
    if (!user) { navigate({ to: "/auth", search: { mode: "in" } as any }); return; }
    const convId = await getOrCreateConversation(user.id, userId, null);
    navigate({ to: "/", search: { conversation: convId } as any });
  }

  async function handleConnect() {
    if (!user) { navigate({ to: "/auth", search: { mode: "in" } as any }); return; }
    const { error } = await supabase.from("roommate_interests").insert({ from_user_id: user.id, to_user_id: userId, status: "pending" });
    if (error && !error.message.includes("duplicate")) { toast.error(error.message); return; }
    toast.success("Connection request sent!");
  }

  if (isLoading) return <div className="mx-auto max-w-2xl px-4 pt-20 text-center text-sm text-muted-foreground">Loading…</div>;
  if (!profile) return <div className="mx-auto max-w-2xl px-4 pt-20 text-center text-sm text-muted-foreground">Profile not found.</div>;

  const isEdu = isOwn
    ? !!user?.email?.toLowerCase().endsWith(".edu")
    : profile.verified_email;
  const rating = profile.avg_rating ?? stats.avg;
  const reviewCount = profile.review_count ?? stats.count;
  const campusAbbrev = abbrevCampus(profile.campus_name);
  const subtitleParts = [campusAbbrev, profile.year].filter(Boolean);
  const joinedLabel = profile.created_at
    ? new Date(profile.created_at).toLocaleDateString(undefined, { month: "short", year: "numeric" })
    : "—";


  return (
    <div className="min-h-screen bg-background pb-24">
      <main className="mx-auto max-w-2xl px-4 pt-20">
        {/* Header */}
        <section className="rounded-2xl bg-surface p-5 shadow-card-md">
          <div className="flex items-start gap-4">
            <div className="relative">
              {avatarUrl ? (
                <img src={avatarUrl} alt={profile.name ?? ""} className="h-20 w-20 rounded-full object-cover ring-4 ring-surface" />
              ) : (
                <div className="grid h-20 w-20 place-items-center rounded-full text-4xl ring-4 ring-surface" style={{ background: profile.banner_color ?? "#2563EB" }}>
                  {profile.avatar_emoji ?? "🙂"}
                </div>
              )}
              {isOwn && (
                <button
                  onClick={() => fileRef.current?.click()}
                  disabled={uploading}
                  className="absolute -bottom-1 -right-1 grid h-7 w-7 place-items-center rounded-full bg-primary text-white shadow ring-2 ring-surface"
                  aria-label="Change photo"
                >
                  <Camera className="h-3.5 w-3.5" />
                </button>
              )}
              <input
                ref={fileRef} type="file" accept="image/*" className="hidden"
                onChange={(e) => { const f = e.target.files?.[0]; if (f) uploadAvatar(f); }}
              />
            </div>
            <div className="min-w-0 flex-1">
              <h1 className="text-2xl font-extrabold">{isOwn ? (profile.name || "Unnamed") : maskLastName(profile.name)}</h1>
              {subtitleParts.length > 0 && (
                <p className="text-sm text-muted-foreground">{subtitleParts.join(" · ")}</p>
              )}
              {profile.major && <p className="text-sm text-muted-foreground">{profile.major}</p>}
              <div className="mt-2 flex flex-wrap items-center gap-2">
                {campusRow?.slug && profile.campus_name && (
                  <Link
                    to="/sublease/$slug"
                    params={{ slug: campusRow.slug }}
                    className="inline-flex items-center gap-1 rounded-full bg-primary-light px-2.5 py-0.5 text-[11px] font-bold text-primary-dark hover:bg-primary/20"
                  >
                    🐾 {profile.campus_name}
                  </Link>
                )}
                {isEdu && (
                  <span className="inline-flex items-center gap-1 rounded-full bg-success/10 px-2 py-0.5 text-[11px] font-bold text-success">
                    <BadgeCheck className="h-3 w-3" /> .edu verified
                  </span>
                )}
              </div>
            </div>
          </div>


          <div className="mt-4">
            {isOwn ? (
              <Button onClick={() => setEditOpen(true)} className="w-full gap-2 bg-primary hover:bg-primary-dark text-primary-foreground font-bold">
                <Pencil className="h-4 w-4" /> Edit Profile
              </Button>
            ) : (
              <Button onClick={handleMessage} className="w-full gap-2 bg-primary hover:bg-primary-dark text-primary-foreground font-bold">
                <MessageCircle className="h-4 w-4" /> Message →
              </Button>
            )}
          </div>
        </section>

        {/* Completion nudge */}
        {isOwn && completion < 100 && (
          <section className="mt-4 rounded-2xl bg-surface p-4 shadow-card-md">
            <div className="mb-2 flex items-center justify-between">
              <div className="text-sm font-bold">Complete your profile to get more responses</div>
              <div className="text-xs font-bold text-primary">{completion}%</div>
            </div>
            <div className="h-2 w-full overflow-hidden rounded-full bg-background">
              <div className="h-full rounded-full bg-primary transition-all" style={{ width: `${completion}%` }} />
            </div>
            <div className="mt-3 flex flex-wrap gap-2 text-[11px]">
              {!profile.avatar_url && <NudgeChip onClick={() => fileRef.current?.click()}>+ Add a photo</NudgeChip>}
              {!(profile.bio && profile.bio.trim()) && <NudgeChip onClick={() => setEditOpen(true)}>+ Add your bio</NudgeChip>}
              {!profile.year && <NudgeChip onClick={() => setEditOpen(true)}>+ Add year</NudgeChip>}
              {!profile.major && <NudgeChip onClick={() => setEditOpen(true)}>+ Add major</NudgeChip>}
            </div>

          </section>
        )}

        {/* Bio & Vibe */}
        {(profile.bio || (profile.vibe_tags?.length ?? 0) > 0 || profile.instagram_handle) && (
          <section className="mt-4 rounded-2xl bg-surface p-5 shadow-card-md">
            <h2 className="mb-2 text-sm font-bold uppercase tracking-wide text-muted-foreground">About me</h2>
            {profile.bio && <p className="text-sm leading-relaxed text-gray-700 dark:text-gray-300">{profile.bio}</p>}
            {(profile.vibe_tags?.length ?? 0) > 0 && (
              <div className="mt-4">
                <div className="mb-1.5 text-xs font-semibold text-muted-foreground">My vibe:</div>
                <div className="flex flex-wrap gap-1.5">
                  {profile.vibe_tags!.map((v) => (
                    <span key={v} className="rounded-full bg-primary-light px-3 py-1 text-xs font-semibold text-primary-dark">{v}</span>
                  ))}
                </div>
              </div>
            )}
            {profile.instagram_handle && (
              <a
                href={`https://instagram.com/${profile.instagram_handle.replace(/^@/, "")}`}
                target="_blank" rel="noopener noreferrer"
                className="mt-4 inline-flex items-center gap-1.5 text-sm font-semibold text-primary hover:underline"
              >
                <Instagram className="h-4 w-4" /> @{profile.instagram_handle.replace(/^@/, "")}
              </a>
            )}
          </section>
        )}

        {/* Trust signals strip */}
        <section className="mt-4 grid grid-cols-4 gap-2">
          <TrustCard icon="🏠" label={`${profile.listing_count}`} sub={`Post${profile.listing_count === 1 ? "" : "s"}`} />
          <TrustCard icon="✓" label={profile.completed_count > 0 ? `${profile.completed_count}` : "—"} sub="Completed" />
          <TrustCard icon="✓" label={isEdu ? "✓" : "—"} sub="Verified" />
          <TrustCard icon="📅" label={joinedLabel} sub="Joined" />
        </section>



        {/* Listings */}
        <section className="mt-6">
          <div className="mb-3 flex items-center justify-between gap-2">
            <h2 className="text-lg font-semibold">
              {isOwn ? "Your subleases" : `${(profile.name || "").split(" ")[0]}'s Listings`}
              {" "}<span className="text-sm font-semibold text-muted-foreground">({isOwn ? listings.length : profile.active_listing_count} active)</span>
            </h2>
            {isOwn && listings.length > 0 && (
              <Link to="/my-listings" className="text-xs font-bold text-primary hover:underline">
                Manage all →
              </Link>
            )}
          </div>

          {isOwn ? (
            (() => {
              // Q108 — active listings first, rented ones in their own section.
              const rentedRows = listings.filter((l: any) => l.status === "filled");
              const activeRows = listings.filter((l: any) => l.status !== "filled");
              return (
                <>
                  <div className="space-y-2">
                    {activeRows.map((l: any) => (
                      <OwnListingRow key={l.id} listing={l} />
                    ))}
                    {activeRows.length === 0 && (
                      <div className="rounded-2xl bg-surface p-8 text-center shadow-card-md">
                        <p className="text-sm text-muted-foreground">You haven't posted a sublease yet.</p>
                        <Link
                          to="/post"
                          className="mt-4 inline-flex items-center gap-1 rounded-full bg-gray-900 px-5 py-2.5 text-sm font-semibold text-white dark:bg-white dark:text-gray-900"
                        >
                          Post a sublease →
                        </Link>
                      </div>
                    )}
                  </div>
                  {rentedRows.length > 0 && (
                    <div className="mt-6">
                      <h3 className="mb-2 text-sm font-bold uppercase tracking-wide text-muted-foreground">
                        Rented
                      </h3>
                      <div className="space-y-2 opacity-80">
                        {rentedRows.map((l: any) => (
                          <OwnListingRow key={l.id} listing={l} />
                        ))}
                      </div>
                    </div>
                  )}
                </>
              );
            })()
          ) : (

            <div className="grid grid-cols-1 gap-3 sm:grid-cols-2">
              {listings.map((l: any) => (
                <ListingCard
                  key={l.id}
                  listing={l}
                  saved={false}
                  onSave={() => {}}
                  onOpen={() => navigate({ to: "/", search: { listing: l.id } as any })}
                />
              ))}
              {listings.length === 0 && (
                <div className="col-span-full rounded-2xl bg-surface p-8 text-center text-sm text-muted-foreground shadow-card-md">
                  No active listings right now.
                </div>
              )}
            </div>
          )}

          {isOwn && listings.length > 0 && (
            <Link to="/post" className="mt-3 inline-flex items-center gap-1 text-sm font-bold text-primary hover:underline">
              <Plus className="h-4 w-4" /> Post a new sublease →
            </Link>
          )}
        </section>


        {/* Roommate profile (public only, if they have one) */}
        {!isOwn && roommateProfile && roommateProfile.is_active && (
          <section className="mt-6">
            <h2 className="mb-3 text-lg font-extrabold">
              {roommateProfile.mode === "has_room" ? "Has a room available" : "Looking for a roommate"}
            </h2>
            <div className="rounded-2xl bg-surface p-5 shadow-card-md">
              <div className="flex flex-wrap items-center gap-2">
                <span className={cn(
                  "inline-flex rounded-full px-2.5 py-0.5 text-[11px] font-bold",
                  roommateProfile.mode === "has_room"
                    ? "bg-primary/10 text-primary"
                    : "bg-orange-100 text-orange-700 dark:bg-orange-500/15 dark:text-orange-300",
                )}>
                  {roommateProfile.mode === "has_room" ? "Has a room" : "Looking"}
                </span>
                {(roommateProfile.vibe_tags ?? []).slice(0, 4).map((t) => (
                  <span key={t} className="rounded-full bg-gray-100 px-2.5 py-0.5 text-[11px] font-semibold text-foreground/80 dark:bg-background">
                    {t}
                  </span>
                ))}
              </div>
              <div className="mt-3 grid grid-cols-2 gap-3 text-sm">
                <div>
                  <div className="text-[11px] font-semibold uppercase tracking-wide text-muted-foreground">Budget</div>
                  <div className="font-semibold">
                    {roommateProfile.budget_min != null && roommateProfile.budget_max != null
                      ? `$${roommateProfile.budget_min}–$${roommateProfile.budget_max}/mo`
                      : roommateProfile.budget_max != null
                      ? `Up to $${roommateProfile.budget_max}/mo`
                      : roommateProfile.budget_min != null
                      ? `From $${roommateProfile.budget_min}/mo`
                      : "Flexible"}
                  </div>
                </div>
                <div>
                  <div className="text-[11px] font-semibold uppercase tracking-wide text-muted-foreground">
                    {roommateProfile.mode === "has_room" ? "Move-in" : "Available from"}
                  </div>
                  <div className="font-semibold">
                    {roommateProfile.move_in_date
                      ? new Date(roommateProfile.move_in_date).toLocaleDateString(undefined, { month: "short", year: "numeric" })
                      : "Flexible"}
                  </div>
                </div>
              </div>
              {roommateProfile.about_me && (
                <p className="mt-3 text-sm leading-relaxed text-gray-700 dark:text-gray-300">
                  {roommateProfile.about_me}
                </p>
              )}
            </div>
          </section>
        )}

        {/* Roommate connect (public only) */}
        {!isOwn && (
          <section className="mt-6">
            <Button variant="outline" onClick={handleConnect} className="w-full gap-2 font-bold">
              <Users className="h-4 w-4" /> Connect as roommate →
            </Button>
          </section>
        )}

        {/* Reviews */}
        <section className="mt-8">
          <div className="mb-3 flex items-center gap-2">
            <h2 className="text-lg font-extrabold">Reviews ({reviewCount})</h2>
            {reviewCount > 0 && (
              <span className="inline-flex items-center gap-1 text-sm font-bold text-amber-600">
                <Star className="h-4 w-4 fill-amber-400 text-amber-400" /> {rating.toFixed(1)}
              </span>
            )}
          </div>
          <div className="space-y-2">
            {reviews.slice(0, 3).map((r) => (
              <div key={r.id} className="rounded-2xl bg-surface p-4 shadow-card-md">
                <div className="mb-1 flex items-center gap-1 text-amber-500">
                  {Array.from({ length: r.stars }).map((_, i) => (
                    <Star key={i} className="h-3.5 w-3.5 fill-current" />
                  ))}
                </div>
                {r.content && <p className="text-sm">"{r.content}"</p>}
                <p className="mt-2 text-xs text-muted-foreground">
                  — {r.reviewer?.name || "Anon"}
                  {" · "}{new Date(r.created_at).toLocaleDateString(undefined, { month: "long", year: "numeric" })}
                </p>
              </div>
            ))}
            {reviews.length === 0 && (
              <div className="rounded-2xl bg-surface p-8 text-center text-sm text-muted-foreground shadow-card-md">
                No reviews yet.
              </div>
            )}
          </div>
        </section>
      </main>

      {isOwn && (
        <ProfileSheet userId={editOpen ? userId : null} open={editOpen} onOpenChange={setEditOpen} />
      )}
    </div>
  );
}

function TrustCard({ icon, label, sub }: { icon: string; label: string; sub: string }) {
  return (
    <div className="rounded-xl bg-gray-50 p-3 text-center dark:bg-gray-900">
      <div className="text-lg">{icon}</div>
      <div className="text-xs font-bold">{label}</div>
      <div className="text-[10px] uppercase tracking-wide text-muted-foreground">{sub}</div>
    </div>
  );
}

function NudgeChip({ children, onClick }: { children: React.ReactNode; onClick?: () => void }) {
  return (
    <button onClick={onClick} className={cn("rounded-full bg-primary-light px-2.5 py-1 font-semibold text-primary-dark hover:bg-primary/20")}>
      {children}
    </button>
  );
}

/** Q109 — relist a rented listing for the next semester. */
function RelistDialog({ listing, onClose }: { listing: any; onClose: () => void }) {
  const qc = useQueryClient();
  const [from, setFrom] = useState<string>(listing.available_from ?? "");
  const [to, setTo] = useState<string>(listing.available_to ?? "");
  const [busy, setBusy] = useState(false);

  async function submit(e: React.FormEvent) {
    e.preventDefault();
    if (!from || !to) { toast.error("Pick both dates"); return; }
    if (new Date(to) <= new Date(from)) { toast.error("Move-out must be after move-in"); return; }
    setBusy(true);
    try {
      const { error } = await supabase
        .from("listings")
        .update({
          status: "active",
          is_active: true,
          available_from: from,
          available_to: to,
          updated_at: new Date().toISOString(),
        })
        .eq("id", listing.id);
      if (error) throw error;
      toast.success("Relisted — it's back in browse 🎉");
      qc.invalidateQueries();
      onClose();
    } catch (err) {
      toast.error(err instanceof Error ? err.message : "Could not relist");
    } finally {
      setBusy(false);
    }
  }

  return (
    <div
      className="fixed inset-0 z-50 flex items-center justify-center bg-black/50 p-4"
      onClick={(e) => { if (e.target === e.currentTarget) onClose(); }}
    >
      <form
        onSubmit={submit}
        className="w-full max-w-sm rounded-2xl bg-surface p-6 shadow-card-lg"
      >
        <h3 className="text-lg font-semibold">Update your availability dates</h3>
        <p className="mt-1 text-xs text-muted-foreground">{listing.title}</p>
        <label className="mt-4 block text-xs font-bold uppercase tracking-wide text-muted-foreground">
          Move-in date
        </label>
        <input
          type="date" value={from} onChange={(e) => setFrom(e.target.value)}
          className="mt-1 w-full rounded-lg border border-border bg-background px-3 py-2 text-sm"
        />
        <label className="mt-3 block text-xs font-bold uppercase tracking-wide text-muted-foreground">
          Move-out date
        </label>
        <input
          type="date" value={to} onChange={(e) => setTo(e.target.value)}
          className="mt-1 w-full rounded-lg border border-border bg-background px-3 py-2 text-sm"
        />
        <div className="mt-5 flex items-center justify-end gap-2">
          <button
            type="button" onClick={onClose}
            className="rounded-full border border-border px-4 py-2 text-sm font-semibold text-muted-foreground hover:bg-muted"
          >
            Cancel
          </button>
          <button
            type="submit" disabled={busy}
            className="rounded-full bg-gray-900 px-5 py-2 text-sm font-semibold text-white disabled:opacity-60 dark:bg-white dark:text-gray-900"
          >
            {busy ? "Relisting…" : "Relist sublease →"}
          </button>
        </div>
      </form>
    </div>
  );
}

/** Q107 — compact horizontal row for the owner's own listings. */
function OwnListingRow({ listing }: { listing: any }) {
  const [relistOpen, setRelistOpen] = useState(false);
  const photo = (listing.photo_urls?.length ? listing.photo_urls : listing.photos)?.[0] ?? null;
  const rented = listing.status === "filled" || listing.is_active === false;
  return (
    <div className="flex items-center gap-3 rounded-2xl bg-surface p-3 shadow-card-md">
      {photo ? (
        <img src={photo} alt="" className="h-14 w-14 shrink-0 rounded-lg object-cover" loading="lazy" />
      ) : (
        <div className="grid h-14 w-14 shrink-0 place-items-center rounded-lg bg-muted">
          <Home className="h-5 w-5 text-muted-foreground" />
        </div>
      )}
      <Link
        to="/listing/$id"
        params={{ id: listing.id }}
        className="min-w-0 flex-1"
      >
        <div className="truncate text-sm font-semibold">{listing.title}</div>
        <div className="mt-0.5 flex items-center gap-2 text-xs text-muted-foreground">
          <span>${listing.price}/mo</span>
          <span
            className={cn(
              "rounded-full px-2 py-0.5 text-[10px] font-bold",
              rented ? "bg-muted text-muted-foreground" : "bg-emerald-100 text-emerald-700",
            )}
          >
            {rented ? "Rented" : "Active"}
          </span>
        </div>
      </Link>
      {rented && (
        <button
          type="button"
          onClick={() => setRelistOpen(true)}
          className="shrink-0 rounded-full border border-border px-4 py-2 text-sm text-muted-foreground hover:bg-muted"
        >
          Relist for next semester →
        </button>
      )}
      <Link
        to="/listing/$id/edit"
        params={{ id: listing.id }}
        className="shrink-0 text-xs font-bold text-primary hover:underline"
      >
        Edit
      </Link>
      {relistOpen && <RelistDialog listing={listing} onClose={() => setRelistOpen(false)} />}
    </div>
  );
}
