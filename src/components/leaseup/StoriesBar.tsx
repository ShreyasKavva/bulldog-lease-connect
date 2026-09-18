import { useQuery } from "@tanstack/react-query";
import { supabase } from "@/integrations/supabase/client";
import type { Profile } from "@/lib/leaseup/types";
import { Plus, BadgeCheck } from "lucide-react";
import { cn } from "@/lib/utils";
import { posterName, posterFirstName, profileDisplayName } from "@/lib/leaseup/display-name";
import { UserAvatar } from "@/components/leaseup/UserAvatar";

type Story = {
  userId: string;
  lastActivity: string;
  hasListing: boolean;
  hasLookingFor: boolean;
  profile: Profile;
};

async function fetchStories(campusId: string | null, meId: string | undefined): Promise<Story[]> {
  const since = new Date(Date.now() - 7 * 86400 * 1000).toISOString();
  let lq = supabase.from("listings").select("user_id, created_at").eq("is_active", true).gte("created_at", since);
  let fq = supabase.from("looking_for_posts").select("user_id, created_at").gte("created_at", since);
  if (campusId) { lq = lq.eq("campus_id", campusId); fq = fq.eq("campus_id", campusId); }
  const [{ data: l }, { data: f }] = await Promise.all([lq, fq]);
  const map = new Map<string, { lastActivity: string; hasListing: boolean; hasLookingFor: boolean }>();
  (l ?? []).forEach((r: any) => {
    const e = map.get(r.user_id);
    map.set(r.user_id, {
      lastActivity: !e || r.created_at > e.lastActivity ? r.created_at : e.lastActivity,
      hasListing: true,
      hasLookingFor: e?.hasLookingFor ?? false,
    });
  });
  (f ?? []).forEach((r: any) => {
    const e = map.get(r.user_id);
    map.set(r.user_id, {
      lastActivity: !e || r.created_at > e.lastActivity ? r.created_at : e.lastActivity,
      hasListing: e?.hasListing ?? false,
      hasLookingFor: true,
    });
  });
  if (meId) map.delete(meId);
  const ids = Array.from(map.keys());
  if (!ids.length) return [];
  const { data: profs } = await supabase.from("profiles_public").select("*").in("id", ids);
  const pMap = new Map<string, Profile>((profs ?? []).map((p: any) => [p.id, p]));
  return Array.from(map.entries())
    .map(([userId, s]) => ({ userId, ...s, profile: pMap.get(userId)! }))
    .filter((s) => s.profile)
    .sort((a, b) => b.lastActivity.localeCompare(a.lastActivity))
    .slice(0, 20);
}

function isActive(iso: string) {
  return Date.now() - new Date(iso).getTime() < 48 * 3600 * 1000;
}

export function StoriesBar({
  campusId, meId, onAddYourStory, onSelectStudent,
}: {
  campusId: string | null;
  meId?: string;
  onAddYourStory: () => void;
  onSelectStudent: (userId: string) => void;
}) {
  const { data: stories = [] } = useQuery({
    queryKey: ["stories", campusId, meId],
    queryFn: () => fetchStories(campusId, meId),
    staleTime: 60_000,
  });

  if (stories.length < 3) {
    // Per spec: hide entirely until there's real activity beyond your own.
    return (
      <div className="pointer-events-auto inline-flex items-center gap-2 rounded-full bg-white/85 px-3 py-2 shadow-card-md backdrop-blur">
        <button onClick={onAddYourStory} className="flex shrink-0 flex-col items-center gap-1">
          <span className="grid h-[54px] w-[54px] place-items-center rounded-full bg-primary text-primary-foreground ring-2 ring-white">
            <Plus className="h-6 w-6" strokeWidth={3} />
          </span>
          <span className="text-[10px] font-bold text-foreground">Your Story</span>
        </button>
      </div>
    );
  }

  return (
    <div
      className="pointer-events-auto flex max-w-[calc(100vw-1rem)] items-center gap-3 overflow-x-auto rounded-full bg-white/85 px-3 py-2 shadow-card-md backdrop-blur"
      style={{ scrollbarWidth: "none" }}
    >
      <button onClick={onAddYourStory} className="flex shrink-0 flex-col items-center gap-1">
        <span className="grid h-[54px] w-[54px] place-items-center rounded-full bg-primary text-primary-foreground ring-2 ring-white">
          <Plus className="h-6 w-6" strokeWidth={3} />
        </span>
        <span className="text-[10px] font-bold text-foreground">Your Story</span>
      </button>
      {stories.map((s) => {
        const active = isActive(s.lastActivity);
        return (
          <button
            key={s.userId}
            onClick={() => onSelectStudent(s.userId)}
            className="group flex shrink-0 flex-col items-center gap-1"
          >
            <span
              className={cn(
                "relative grid h-[58px] w-[58px] place-items-center rounded-full p-[2.5px] transition-transform group-active:scale-95",
                active
                  ? "bg-gradient-to-tr from-orange-500 via-pink-500 to-primary"
                  : "bg-gradient-to-tr from-muted-foreground/40 to-muted-foreground/20",
              )}
            >
              <UserAvatar
                name={s.profile.name}
                avatarUrl={s.profile.avatar_url}
                color={s.profile.banner_color ?? null}
                className="h-full w-full ring-2 ring-white"
                textClassName="text-xl"
              />
              {s.profile.verified_email && (
                <BadgeCheck className="absolute -bottom-0.5 -right-0.5 h-4 w-4 rounded-full bg-white text-success" />
              )}
              {s.hasListing && (
                <span className="absolute -top-1 right-0 grid h-5 w-5 place-items-center rounded-full bg-success text-[10px] ring-2 ring-white">
                  🏠
                </span>
              )}
              {!s.hasListing && s.hasLookingFor && (
                <span className="absolute -top-1 right-0 grid h-5 w-5 place-items-center rounded-full bg-primary text-[10px] ring-2 ring-white">
                  🔍
                </span>
              )}
            </span>
            <span className="max-w-[64px] truncate text-[10px] font-bold text-foreground">
              {profileDisplayName(s.profile).split(" ")[0]}
            </span>
          </button>
        );
      })}
    </div>
  );
}
