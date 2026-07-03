/**
 * Global minimal top bar — LeaseUp wordmark · Post · (Sign in | Bell + Avatar).
 *
 * On mobile only the wordmark and Post button show; bell/avatar are reached
 * via the Profile tab in the bottom nav. Legacy props (onOpenMessages,
 * transparent) are accepted-but-ignored for backward compatibility.
 */
import { Link, useNavigate } from "@tanstack/react-router";
import { ArrowRight } from "lucide-react";
import { useSession, useMyProfile } from "@/lib/leaseup/use-session";
import { NotificationsBell } from "@/components/leaseup/NotificationsBell";

type LegacyProps = {
  onOpenMessages?: () => void;
  transparent?: boolean;
};

export function TopBar(_legacy: LegacyProps = {}) {
  const { user } = useSession();
  const { data: profile } = useMyProfile();
  const navigate = useNavigate();

  function handlePost(e: React.MouseEvent) {
    e.preventDefault();
    if (user) navigate({ to: "/", search: { post: "1" } as any });
    else navigate({ to: "/auth", search: { mode: "up", next: "/?post=1" } });
  }

  return (
    <header className="sticky top-0 z-40 flex h-14 items-center justify-between border-b border-gray-100 bg-white px-4 dark:border-border dark:bg-surface">
      <Link to="/" className="text-xl font-bold text-primary">
        LeaseUp
      </Link>

      <div className="flex items-center gap-2">
        <button
          onClick={handlePost}
          className="inline-flex items-center gap-1 rounded-full bg-primary px-4 py-2 text-sm font-semibold text-primary-foreground transition hover:bg-primary-dark"
        >
          Post
          <ArrowRight className="h-3.5 w-3.5" />
        </button>

        {user ? (
          <div className="hidden items-center gap-1.5 sm:flex">
            <NotificationsBell onOpenMessages={() => navigate({ to: "/messages" as any }).catch(() => {})} />
            <Link
              to="/profile"
              className="grid h-9 w-9 place-items-center rounded-full text-base"
              style={{ background: profile?.banner_color ?? "#2563EB" }}
              title={profile?.name ?? "Me"}
            >
              {profile?.avatar_emoji ?? "🙂"}
            </Link>
          </div>
        ) : (
          <Link
            to="/auth"
            search={{ mode: "in" }}
            className="hidden rounded-full border px-4 py-2 text-sm font-semibold hover:bg-background sm:inline-flex"
          >Sign In</Link>
        )}
      </div>
    </header>
  );
}
