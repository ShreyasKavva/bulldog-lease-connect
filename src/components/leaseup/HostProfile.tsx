/**
 * HostProfile — Airbnb-style public host page (Q92).
 * Public: anyone can view. Owner sees an "Edit profile" button.
 */
import { useQuery } from "@tanstack/react-query";
import { Link, useNavigate } from "@tanstack/react-router";
import { BadgeCheck } from "lucide-react";
import { supabase } from "@/integrations/supabase/client";
import { useSession } from "@/lib/leaseup/use-session";
import { getOrCreateConversation } from "@/lib/leaseup/queries";
import { ListingCard } from "@/components/leaseup/ListingCard";
import { openSignIn } from "@/components/leaseup/SignInModal";
import type { Listing } from "@/lib/leaseup/types";
import { posterName, posterFirstName, profileDisplayName } from "@/lib/leaseup/display-name";
import { UserAvatar } from "@/components/leaseup/UserAvatar";

const CAMPUS_ABBREV: Record<string, string> = {
  "University of Georgia": "UGA",
  "Auburn University": "Auburn",
  "University of Florida": "UF",
  "Georgia Tech": "GT",
  "Georgia Institute of Technology": "GT",
  "University of Virginia": "UVA",
  "University of Alabama": "Alabama",
};

export function abbrevCampus(name: string | null | undefined): string | null {
  if (!name) return null;
  return CAMPUS_ABBREV[name] ?? name.split(/\s+/)[0] ?? null;
}

export type HostProfileData = {
  id: string;
  name: string | null;
  year: string | null;
  major: string | null;
  bio: string | null;
  avatar_url: string | null;
  avatar_emoji: string | null;
  banner_color: string | null;
  verified_email: boolean;
  campus_name: string | null;
  response_rate: number | null;
  created_at: string | null;
};

export async function fetchHostProfile(userId: string): Promise<HostProfileData | null> {
  const { data, error } = await supabase.rpc("get_public_profile", { _uid: userId });
  if (error) throw error;
  return (data as unknown as HostProfileData) ?? null;
}

async function fetchHostAvatar(path: string | null | undefined) {
  if (!path) return null;
  if (path.startsWith("http")) return path;
  const { data } = await supabase.storage.from("avatars").createSignedUrl(path, 60 * 60 * 24 * 7);
  return data?.signedUrl ?? null;
}

async function fetchActiveListings(userId: string): Promise<Listing[]> {
  const today = new Date().toISOString().slice(0, 10);
  const { data, error } = await supabase
    .from("listings")
    .select("*")
    .eq("user_id", userId)
    .eq("is_active", true)
    .eq("status", "active")
    .or(`available_to.is.null,available_to.gte.${today}`)
    .order("created_at", { ascending: false });
  if (error) throw error;
  const rows = (data ?? []) as any[];
  const paths = rows.flatMap((l) => l.photos ?? []);
  const urlMap = new Map<string, string>();
  if (paths.length) {
    const { data: signed } = await supabase.storage
      .from("listing-photos")
      .createSignedUrls(paths, 60 * 60 * 24 * 7);
    signed?.forEach((s) => { if (s.path && s.signedUrl) urlMap.set(s.path, s.signedUrl); });
  }
  return rows.map((l) => ({
    ...l,
    photo_urls: (l.photos ?? []).map((p: string) => urlMap.get(p) ?? "").filter(Boolean),
  })) as Listing[];
}

function firstName(name: string | null | undefined) {
  return (name ?? "Student").trim().split(/\s+/)[0] || "Student";
}

function initials(name: string | null | undefined) {
  const parts = (name ?? "").trim().split(/\s+/).filter(Boolean);
  if (!parts.length) return "?";
  return (parts[0]![0]! + (parts[1]?.[0] ?? "")).toUpperCase();
}

function responseLabel(rate: number | null | undefined) {
  if (rate == null) return null;
  if (rate >= 90) return "Responds within a few hours";
  if (rate >= 60) return "Responds within a day";
  return null;
}

export function HostProfile({ userId }: { userId: string }) {
  const { user } = useSession();
  const navigate = useNavigate();
  const isOwn = user?.id === userId;

  const { data: profile, isLoading } = useQuery({
    queryKey: ["public-profile", userId],
    queryFn: () => fetchHostProfile(userId),
  });
  const { data: avatarUrl } = useQuery({
    queryKey: ["avatar-url", profile?.avatar_url],
    queryFn: () => fetchHostAvatar(profile?.avatar_url),
    enabled: !!profile?.avatar_url,
    staleTime: 60 * 60 * 1000,
  });
  const { data: listings = [] } = useQuery({
    queryKey: ["host-active-listings", userId],
    queryFn: () => fetchActiveListings(userId),
  });

  if (isLoading) {
    return <div className="mx-auto max-w-5xl px-4 py-20 text-center text-sm text-muted-foreground">Loading…</div>;
  }
  if (!profile) {
    return (
      <div className="mx-auto max-w-md px-4 py-20 text-center">
        <h1 className="text-2xl font-bold">We couldn't find that student</h1>
        <p className="mt-2 text-sm text-muted-foreground">
          This profile may have been removed, or the link is broken.
        </p>
        <Link
          to="/browse"
          className="mt-6 inline-flex items-center justify-center rounded-full bg-primary px-5 py-2.5 text-sm font-bold text-primary-foreground hover:bg-primary-dark"
        >
          Browse subleases →
        </Link>
      </div>
    );
  }

  const name = profileDisplayName(profile);
  const first = firstName(name);
  const campus = abbrevCampus(profile.campus_name);
  const line2 = [campus, profile.year ? `Class of ${profile.year}` : null].filter(Boolean).join(" · ");
  const memberSince = profile.created_at
    ? new Date(profile.created_at).toLocaleDateString(undefined, { month: "long", year: "numeric" })
    : null;
  const responds = responseLabel(profile.response_rate);

  async function handleMessage() {
    if (!user) { openSignIn(`/profile/${userId}`); return; }
    try {
      const convId = await getOrCreateConversation(user.id, userId, null);
      navigate({ to: "/messages/$conversationId", params: { conversationId: convId } });
    } catch {
      navigate({ to: "/messages" });
    }
  }

  const contactCard = (
    <div className="rounded-2xl border border-gray-100 bg-surface p-6 shadow-md dark:border-border">
      <h2 className="text-lg font-semibold">Contact {first}</h2>
      <button
        type="button"
        onClick={handleMessage}
        className="mt-4 w-full rounded-full bg-[#FF5A5F] py-3 font-semibold text-white transition active:scale-[0.98]"
      >
        Message {first}
      </button>
      <p className="mt-3 text-xs text-gray-400">LeaseUp never charges for messaging</p>
    </div>
  );

  return (
    <div className="min-h-screen bg-background">
      <main className="mx-auto max-w-7xl px-4 py-8 md:px-8">
        {/* Header */}
        <header className="flex items-start gap-5">
          <UserAvatar
            name={name}
            avatarUrl={avatarUrl ?? profile.avatar_url}
            color={profile.banner_color ?? null}
            className="h-24 w-24 border-2 border-gray-100 shadow-sm dark:border-border"
            textClassName="text-2xl"
          />

          <div className="min-w-0 flex-1">
            <div className="flex items-start gap-3">
              <div className="min-w-0 flex-1">
                <h1 className="truncate text-2xl font-bold">{name}</h1>
                {line2 && <p className="text-gray-500">{line2}</p>}
              </div>
              {isOwn && (
                <Link
                  to="/profile/edit"
                  className="shrink-0 rounded-full border border-gray-200 bg-surface px-4 py-2 text-sm font-medium hover:bg-muted dark:border-border"
                >
                  Edit profile
                </Link>
              )}
            </div>

            {profile.verified_email && (
              <span className="mt-2 inline-flex items-center gap-1 rounded-full bg-gray-900 px-2.5 py-1 text-xs font-semibold text-white dark:bg-white dark:text-gray-900">
                <BadgeCheck className="h-3.5 w-3.5" /> Verified student
              </span>
            )}
            {memberSince && <p className="mt-2 text-sm text-gray-400">Member since {memberSince}</p>}
            {responds && <p className="text-sm text-gray-400">{responds}</p>}
          </div>
        </header>

        <div className="mt-10 grid gap-10 lg:grid-cols-[1fr_340px]">
          <div>
            {/* About */}
            <section>
              <h2 className="text-lg font-semibold">About {first}</h2>
              {profile.bio?.trim() ? (
                <p className="mt-2 whitespace-pre-line leading-relaxed text-foreground/80">{profile.bio}</p>
              ) : (
                <p className="mt-2 italic text-gray-400">No bio yet.</p>
              )}
            </section>

            {/* Listings */}
            <section className="mt-10">
              <h2 className="text-lg font-semibold">{first}'s subleases</h2>
              {listings.length === 0 ? (
                <p className="mt-2 text-gray-400">No active subleases right now.</p>
              ) : (
                <div className="mt-4 grid grid-cols-1 gap-6 sm:grid-cols-2 lg:grid-cols-3">
                  {listings.map((l) => (
                    <ListingCard
                      key={l.id}
                      listing={l}
                      saved={false}
                      onSave={() => {}}
                      onOpen={() => navigate({ to: "/listing/$id", params: { id: l.id } })}
                    />
                  ))}
                </div>
              )}
            </section>

            {/* Mobile contact card */}
            <div className="mt-10 lg:hidden">{contactCard}</div>
          </div>

          {/* Desktop sticky sidebar */}
          <aside className="hidden lg:block">
            <div className="sticky top-24">{contactCard}</div>
          </aside>
        </div>
      </main>
    </div>
  );
}
