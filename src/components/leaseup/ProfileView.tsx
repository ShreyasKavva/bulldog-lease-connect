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
import { ListingCard } from "@/components/leaseup/ListingCard";
import { ProfileSheet } from "@/components/leaseup/ProfileSheet";
import { Button } from "@/components/ui/button";
import { toast } from "sonner";
import { BadgeCheck, Instagram, Pencil, Star, Plus, MessageCircle, Users, Camera } from "lucide-react";
import { cn } from "@/lib/utils";

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
  const paths = rows.flatMap((l: any) => l.photos ?? []);
  let urlMap = new Map<string, string>();
  if (paths.length) {
    const { data: signed } = await supabase.storage.from("listing-photos").createSignedUrls(paths, 60 * 60 * 24 * 7);
    signed?.forEach((s) => { if (s.path && s.signedUrl) urlMap.set(s.path, s.signedUrl); });
  }
  return rows.map((l: any) => ({
    ...l,
    photo_urls: (l.photos ?? []).map((p: string) => urlMap.get(p) ?? "").filter(Boolean),
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
              <h1 className="text-2xl font-extrabold">{profile.name || "Unnamed"}</h1>
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
              {!profile.bio && <NudgeChip onClick={() => setEditOpen(true)}>+ Add your bio</NudgeChip>}
              {(profile.vibe_tags?.length ?? 0) === 0 && <NudgeChip onClick={() => setEditOpen(true)}>+ Set your vibe</NudgeChip>}
              {!profile.year && <NudgeChip onClick={() => setEditOpen(true)}>+ Add year</NudgeChip>}
              {!profile.major && <NudgeChip onClick={() => setEditOpen(true)}>+ Add major</NudgeChip>}
              {!profile.instagram_handle && <NudgeChip onClick={() => setEditOpen(true)}>+ Instagram</NudgeChip>}
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
        <section className="mt-4 grid grid-cols-2 gap-2 sm:grid-cols-4">
          <TrustCard icon="✓" label={isEdu ? ".edu Verified" : "Not verified"} sub={isEdu ? "Verified" : "—"} />
          <TrustCard icon="⭐" label={reviewCount > 0 ? `${rating.toFixed(1)} avg` : "No reviews"} sub="rating" />
          <TrustCard icon="💬" label={responsePct != null ? `${responsePct}%` : "—"} sub="response" />
          <TrustCard icon="🏠" label={`${profile.listing_count}`} sub={`listing${profile.listing_count === 1 ? "" : "s"} posted`} />
        </section>

        {/* Listings */}
        <section className="mt-6">
          <div className="mb-3 flex items-center justify-between">
            <h2 className="text-lg font-extrabold">
              {isOwn ? "My Listings" : `${(profile.name || "").split(" ")[0]}'s Listings`}
              {" "}<span className="text-sm font-semibold text-muted-foreground">({isOwn ? listings.length : profile.active_listing_count} active)</span>
            </h2>
          </div>
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
                {isOwn ? (
                  <Link to="/" search={{ post: 1 } as any} className="font-semibold text-primary hover:underline">+ Post your first listing →</Link>
                ) : (
                  "No active listings right now."
                )}
              </div>
            )}
          </div>
          {isOwn && listings.length > 0 && (
            <Link to="/" search={{ post: 1 } as any} className="mt-3 inline-flex items-center gap-1 text-sm font-bold text-primary hover:underline">
              <Plus className="h-4 w-4" /> Post a new listing →
            </Link>
          )}
        </section>

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
