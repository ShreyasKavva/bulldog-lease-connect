/**
 * Q160 — signed-in smart banner under the homepage hero.
 * No listings → nudge to post. Has listings → total views + dashboard link.
 */
import { Link } from "@tanstack/react-router";
import { useQuery } from "@tanstack/react-query";
import { supabase } from "@/integrations/supabase/client";
import { useSession } from "@/lib/leaseup/use-session";

async function fetchMyActiveListings(userId: string) {
  const { data, error } = await supabase
    .from("listings")
    .select("id, view_count")
    .eq("user_id", userId)
    .eq("status", "active");
  if (error) return [];
  return data ?? [];
}

export function HomeSmartBanner({ onPost }: { onPost?: () => void }) {
  const { user } = useSession();
  const { data, isLoading } = useQuery({
    queryKey: ["home-smart-banner", user?.id],
    queryFn: () => fetchMyActiveListings(user!.id),
    enabled: !!user?.id,
    staleTime: 60_000,
  });

  if (!user || isLoading || !data) return null;

  if (data.length === 0) {
    return (
      <div className="mx-4 my-3 flex items-center justify-between gap-3 rounded-xl border border-amber-200 bg-amber-50 p-3 dark:border-amber-500/30 dark:bg-amber-500/10 sm:mx-auto sm:max-w-3xl">
        <p className="text-sm text-amber-900 dark:text-amber-200">
          🏠 Got a sublease? List it free — reach students at your campus →
        </p>
        <button
          onClick={() => onPost?.()}
          className="shrink-0 rounded-full bg-primary px-4 py-2 text-xs font-bold text-primary-foreground transition hover:bg-primary-dark"
        >
          Post a sublease
        </button>
      </div>
    );
  }

  const views = data.reduce((sum, l) => sum + ((l as { view_count?: number | null })?.view_count ?? 0), 0);

  return (
    <div className="mx-4 my-3 flex items-center justify-between gap-3 rounded-xl border border-green-200 bg-green-50 p-3 dark:border-green-500/30 dark:bg-green-500/10 sm:mx-auto sm:max-w-3xl">
      <p className="text-sm text-green-900 dark:text-green-200">
        📊 Your listings have {views.toLocaleString()} view{views === 1 ? "" : "s"} total
      </p>
      <Link
        to="/my-listings"
        className="shrink-0 rounded-full border border-green-300 bg-surface px-4 py-2 text-xs font-bold text-green-800 transition hover:bg-green-100 dark:border-green-500/40 dark:text-green-200 dark:hover:bg-green-500/20"
      >
        View My Listings →
      </Link>
    </div>
  );
}
