import { useQuery } from "@tanstack/react-query";
import { Link } from "@tanstack/react-router";
import { supabase } from "@/integrations/supabase/client";
import { useSession, useMyProfile } from "@/lib/leaseup/use-session";
import { computeProfileCompletion } from "@/lib/leaseup/profile-completion";
import { ArrowRight } from "lucide-react";

/** Slim nudge banner shown on the home feed for users with < 80% profile completion. */
export function ProfileCompletionBanner({ className }: { className?: string }) {
  const { user } = useSession();
  const { data: profile } = useMyProfile();

  const { data: counts } = useQuery({
    queryKey: ["profile-activity", user?.id],
    enabled: !!user?.id,
    staleTime: 60_000,
    queryFn: async () => {
      const [{ count: listings }, { count: lookings }] = await Promise.all([
        supabase.from("listings").select("id", { count: "exact", head: true }).eq("user_id", user!.id),
        supabase.from("looking_for_posts").select("id", { count: "exact", head: true }).eq("user_id", user!.id),
      ]);
      return { hasAny: (listings ?? 0) + (lookings ?? 0) > 0 };
    },
  });

  if (!user || !profile) return null;
  const pct = computeProfileCompletion({ profile, hasListingOrLooking: !!counts?.hasAny });
  if (pct >= 80) return null;

  return (
    <Link
      to="/profile"
      className={
        "flex items-center gap-3 rounded-xl border-l-4 border-primary bg-primary-light px-3 py-2.5 text-xs text-foreground shadow-card-sm transition-transform hover:scale-[1.01] " +
        (className ?? "")
      }
    >
      <div className="min-w-0 flex-1">
        <div className="font-bold text-primary-dark">
          Your profile is {pct}% complete
        </div>
        <div className="text-[11px] text-muted-foreground">
          Students with full profiles get more replies
        </div>
        <div className="mt-1.5 h-1 w-full overflow-hidden rounded-full bg-white/70">
          <div
            className="h-full rounded-full bg-primary transition-all"
            style={{ width: `${pct}%` }}
          />
        </div>
      </div>
      <span className="shrink-0 inline-flex items-center gap-1 rounded-full bg-primary px-2.5 py-1 text-[11px] font-bold text-primary-foreground">
        Finish <ArrowRight className="h-3 w-3" />
      </span>
    </Link>
  );
}
