/**
 * Q97 — mobile bottom tab bar: Home · Browse · Post (center hero) · Saved · Account.
 *
 * Mobile only (md:hidden). Hidden entirely on full-screen flows (/post wizard,
 * a single message thread) and while the soft keyboard is open.
 * Legacy props (onPost, onChat, onProfile) are accepted-but-ignored so older
 * call sites keep compiling.
 */
import { Link, useNavigate, useRouterState } from "@tanstack/react-router";
import { Home, Search, Plus, Heart, User } from "lucide-react";
import { useEffect, useState } from "react";
import { useQuery } from "@tanstack/react-query";
import { cn } from "@/lib/utils";
import { useSession, useMyProfile } from "@/lib/leaseup/use-session";
import { supabase } from "@/integrations/supabase/client";
import { openSignIn } from "@/components/leaseup/SignInModal";
import type { LucideIcon } from "lucide-react";

type LegacyProps = { onPost?: () => void; onChat?: () => void; onProfile?: () => void };

export function BottomNav(_legacy: LegacyProps = {}) {
  const path = useRouterState({ select: (s) => s.location.pathname });
  const { user } = useSession();
  const { data: profile } = useMyProfile();
  const navigate = useNavigate();

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
  const hidden =
    path === "/post" ||
    path.startsWith("/post/") ||
    (path.startsWith("/messages/") && path !== "/messages");
  if (hidden) return null;

  const isHome = path === "/";
  const isBrowse =
    path.startsWith("/browse") ||
    path.startsWith("/sublease") ||
    path.startsWith("/listing") ||
    path.startsWith("/looking") ||
    path.startsWith("/map");
  const isSaved = path.startsWith("/saved");
  const isAccount =
    path === "/profile" ||
    path.startsWith("/profile/") ||
    path.startsWith("/my-listings") ||
    path.startsWith("/settings") ||
    path.startsWith("/messages");

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
      className="fixed inset-x-0 bottom-0 z-50 flex h-16 w-full items-center border-t border-gray-100 bg-white shadow-lg touch-manipulation md:hidden dark:border-border dark:bg-surface"
      style={{ paddingBottom: "env(safe-area-inset-bottom)" }}
    >
      <Tab to="/" active={isHome} label="Home" Icon={Home} />
      <Tab to="/browse" active={isBrowse} label="Browse" Icon={Search} />

      {/* Center hero: post a sublease */}
      <div className="flex flex-1 items-center justify-center">
        <Link
          to="/post"
          onClick={gate("/post")}
          aria-label="Post a sublease"
          className="-mt-5 grid h-[52px] w-[52px] place-items-center rounded-full bg-gray-900 text-white shadow-md transition-transform active:scale-90 dark:bg-foreground dark:text-background"
        >
          <Plus className="h-6 w-6" strokeWidth={2.5} />
        </Link>
      </div>

      <Tab
        to="/saved"
        active={isSaved}
        label="Saved"
        Icon={Heart}
        onClick={gate("/saved")}
        filled={hasSaves}
        accent={hasSaves}
      />

      {user ? (
        <Tab
          to="/profile"
          active={isAccount}
          label="Account"
          Icon={User}
          avatarUrl={(profile as { avatar_url?: string | null } | undefined)?.avatar_url ?? undefined}
        />
      ) : (
        <button
          type="button"
          onClick={() => openSignIn("/profile")}
          aria-label="Sign in"
          className="flex min-h-[44px] flex-1 flex-col items-center justify-center gap-0.5 text-gray-400 transition-transform active:scale-90"
        >
          <User size={22} strokeWidth={2} />
          <span className="text-xs">Sign in</span>
        </button>
      )}
    </nav>
  );
}

function Tab({
  to, active, label, Icon, onClick, filled, accent, avatarUrl,
}: {
  to: string;
  active: boolean;
  label: string;
  Icon: LucideIcon;
  onClick?: (e: React.MouseEvent) => void;
  filled?: boolean;
  accent?: boolean;
  avatarUrl?: string;
}) {
  return (
    <Link
      to={to}
      onClick={onClick}
      aria-label={label}
      title={label}
      className={cn(
        "flex min-h-[44px] flex-1 flex-col items-center justify-center gap-0.5 transition-transform active:scale-90",
        accent
          ? "text-[#FF385C]"
          : active
            ? "font-semibold text-gray-900 dark:text-foreground"
            : "text-gray-400",
      )}
    >
      {avatarUrl ? (
        <img src={avatarUrl} alt="" className="h-6 w-6 rounded-full object-cover" />
      ) : (
        <Icon
          size={22}
          strokeWidth={active ? 2.5 : 2}
          fill={filled ? "currentColor" : "none"}
        />
      )}
      <span className={cn("text-xs", active && "font-semibold")}>{label}</span>
    </Link>
  );
}
