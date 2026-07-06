/**
 * Three-pillar bottom tab bar — Listings · Roommates · Profile.
 *
 * The primary navigation on every screen size. Legacy props (onPost, onChat,
 * onProfile) are accepted-but-ignored so existing call sites keep compiling
 * during the nav rebuild; new call sites can just render <BottomNav />.
 */
import { Link, useNavigate, useRouterState } from "@tanstack/react-router";
import { Home, Search, Users, User, Bell } from "lucide-react";
import { cn } from "@/lib/utils";
import { useUnreadCount } from "@/hooks/use-unread";
import { useSession } from "@/lib/leaseup/use-session";
import type { LucideIcon } from "lucide-react";

// Legacy props kept for backward compatibility — they are ignored.
type LegacyProps = {
  onPost?: () => void;
  onChat?: () => void;
  onProfile?: () => void;
};

export function BottomNav(_legacy: LegacyProps = {}) {
  const path = useRouterState({ select: (s) => s.location.pathname });
  const { user } = useSession();
  const unread = useUnreadCount();
  const navigate = useNavigate();

  const isHome = path === "/";
  const isBrowse =
    path.startsWith("/browse") ||
    path.startsWith("/sublease") ||
    path.startsWith("/listing") ||
    path.startsWith("/looking-for") ||
    path.startsWith("/map");
  const isRoommates = path === "/roommates" || path.startsWith("/roommates/");
  const isNotifications = path === "/notifications";
  const isProfile =
    path === "/profile" ||
    path.startsWith("/profile/") ||
    path.startsWith("/my-listings") ||
    path.startsWith("/settings") ||
    path.startsWith("/messages") ||
    path === "/saved";

  function handleProfile(e: React.MouseEvent) {
    if (!user) {
      e.preventDefault();
      navigate({ to: "/auth", search: { mode: "in", next: "/profile" } });
    }
  }

  return (
    <nav
      className="fixed inset-x-0 bottom-0 z-50 grid h-16 grid-cols-5 border-t border-gray-200 bg-white md:hidden dark:border-border dark:bg-surface"
      style={{ paddingBottom: "env(safe-area-inset-bottom)" }}
    >
      <Tab to="/" active={isHome} label="Home" Icon={Home} />
      <Tab to="/browse" active={isBrowse} label="Browse" Icon={Search} />
      <Tab to="/roommates" active={isRoommates} label="Roommates" Icon={Users} />
      <Tab
        to="/notifications"
        active={isNotifications}
        label="Alerts"
        Icon={Bell}
        badge={!!user && unread > 0}
        onClick={(e) => { if (!user) { e.preventDefault(); navigate({ to: "/auth", search: { mode: "in", next: "/notifications" } }); } }}
      />
      <Tab
        to="/profile"
        active={isProfile}
        label="Profile"
        Icon={User}
        onClick={handleProfile}
      />
    </nav>
  );
}

function Tab({
  to, active, label, Icon, badge, onClick,
}: {
  to: string;
  active: boolean;
  label: string;
  Icon: LucideIcon;
  badge?: boolean;
  onClick?: (e: React.MouseEvent) => void;
}) {
  return (
    <Link
      to={to}
      onClick={onClick}
      aria-label={label}
      title={label}
      className={cn(
        "flex items-center justify-center transition",
        active ? "text-primary" : "text-gray-400 hover:text-foreground",
      )}
    >
      <span className="relative flex flex-col items-center">
        {active && <span className="absolute -top-2 h-1 w-1 rounded-full bg-primary" />}
        <Icon
          className={cn("transition-transform", active && "scale-105")}
          size={26}
          strokeWidth={active ? 2.5 : 2}
          fill={active ? "currentColor" : "none"}
        />
        {badge && (
          <span className="absolute -right-1.5 -top-1 h-2 w-2 rounded-full bg-red-500 ring-2 ring-white dark:ring-surface" />
        )}
      </span>
    </Link>
  );
}
