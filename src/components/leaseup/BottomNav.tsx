/**
 * Q97 — mobile bottom tab bar: Home · Browse · Post (center hero) · Saved · Account.
 *
 * Mobile only (md:hidden). Hidden entirely on full-screen flows (a single
 * message thread) and while the soft keyboard is open.
 * Legacy props (onPost, onChat, onProfile) are accepted-but-ignored so older
 * call sites keep compiling.
 */
import { Link, useRouterState } from "@tanstack/react-router";
import { Home, Search, Bookmark, Pencil, MessageSquare } from "lucide-react";
import { useEffect, useState } from "react";
import { useQuery } from "@tanstack/react-query";
import { cn } from "@/lib/utils";
import { useSession } from "@/lib/leaseup/use-session";
import { useUnreadCount } from "@/hooks/use-unread";
import { supabase } from "@/integrations/supabase/client";
import { openSignIn } from "@/components/leaseup/SignInModal";
import type { LucideIcon } from "lucide-react";

type LegacyProps = { onPost?: () => void; onChat?: () => void; onProfile?: () => void };

/** Full-screen flows own the viewport on mobile — no tab bar, and no space reserved for it. */
export function isBottomNavHidden(path: string) {
  return (
    path.startsWith("/post/") ||
    path.includes("message") ||
    path.includes("conversation")
  );
}

export function BottomNav(_legacy: LegacyProps = {}) {
  const path = useRouterState({ select: (s) => s.location.pathname });
  const { user } = useSession();
  const unread = useUnreadCount();

  // Hide when the soft keyboard is open so it doesn't cover inputs.
  const [kbdOpen, setKbdOpen] = useState(false);
  useEffect(() => {
    if (typeof window === "undefined" || !window.visualViewport) return;
    const vv = window.visualViewport;
    const baseline = window.innerHeight;
    const onResize = () => setKbdOpen(baseline - vv.height > 150);
    vv.addEventListener("resize", onResize);
    return () => vv.removeEventListener("resize", onResize);
  }, []);

  const { data: savedCount = 0 } = useQuery({
    queryKey: ["saved-count", user?.id],
    enabled: !!user,
    queryFn: async () => {
      const { count } = await supabase
        .from("saved_listings")
        .select("id", { count: "exact", head: true })
        .eq("user_id", user!.id);
      return count ?? 0;
    },
  });

  // Full-screen routes own the whole viewport on mobile.
  // Q142 — also hidden on any chat surface so it never covers the keyboard.
  if (isBottomNavHidden(path)) return null;


  const isHome = path === "/";
  const isBrowse =
    path.startsWith("/browse") ||
    path.startsWith("/sublease") ||
    path.startsWith("/listing") ||
    path.startsWith("/looking") ||
    path.startsWith("/map");
  const isMessages = path.startsWith("/messages");
  const isSaved = path.startsWith("/saved");
  const isPost = path.startsWith("/post");

  function gate(next: string) {
    return (e: React.MouseEvent) => {
      if (!user) {
        e.preventDefault();
        openSignIn(next);
      }
    };
  }

  const hasSaves = !!user && savedCount > 0;

  return (
    <nav
      data-kbd={kbdOpen ? "1" : undefined}
      className="fixed inset-x-0 bottom-0 z-40 flex h-16 w-full items-center border-t border-gray-200 bg-white shadow-lg touch-manipulation md:hidden dark:border-border dark:bg-surface"
      style={{ paddingBottom: "env(safe-area-inset-bottom, 16px)" }}
    >
      <Tab to="/" active={isHome} label="Home" Icon={Home} />
      <Tab to="/browse" active={isBrowse} label="Browse" Icon={Search} />
      <Tab
        to="/messages"
        active={isMessages}
        label="Messages"
        Icon={MessageSquare}
        onClick={gate("/messages")}
        badge={user ? unread : 0}
      />
      <Tab
        to="/saved"
        active={isSaved}
        label="Saved"
        Icon={Bookmark}
        onClick={gate("/saved")}
        filled={hasSaves}
      />
      <Tab to="/post" active={isPost} label="Post" Icon={Pencil} onClick={gate("/post")} />
    </nav>
  );

}

function Tab({
  to, active, label, Icon, onClick, filled, accent, avatarUrl, badge,
}: {
  to: string;
  active: boolean;
  label: string;
  Icon: LucideIcon;
  onClick?: (e: React.MouseEvent) => void;
  filled?: boolean;
  accent?: boolean;
  avatarUrl?: string;
  badge?: number;
}) {
  return (
    <Link
      to={to}
      onClick={onClick}
      aria-label={label}
      title={label}
      className={cn(
        "flex min-h-[44px] flex-1 flex-col items-center justify-center gap-0.5 transition-transform active:scale-90",
        accent || active
          ? "text-[#FF5A5F]"
          : "text-gray-400",
        active && "font-semibold",
      )}
    >
      <span className="relative">
        {avatarUrl ? (
          <img src={avatarUrl} alt="" className="h-6 w-6 rounded-full object-cover" />
        ) : (
          <Icon
            size={22}
            strokeWidth={active ? 2.5 : 2}
            fill={filled ? "currentColor" : "none"}
          />
        )}
        {!!badge && badge > 0 && (
          <span className="absolute -top-1 -right-1 flex h-4 min-w-[16px] items-center justify-center rounded-full bg-red-500 px-1 text-[10px] font-bold text-white">
            {badge > 9 ? "9+" : badge}
          </span>
        )}
      </span>
      <span className={cn("text-xs", active && "font-semibold")}>{label}</span>
    </Link>
  );
}
