import { Link, useRouterState } from "@tanstack/react-router";
import { Map as MapIcon, LayoutGrid, Plus, MessageSquare, User } from "lucide-react";
import { cn } from "@/lib/utils";
import { useUnreadCount } from "@/hooks/use-unread";
import { useMyProfile } from "@/lib/leaseup/use-session";
import { useEffect, useMemo, useState } from "react";

export function BottomNav({
  onPost, onChat, onProfile: _onProfile,
}: {
  onPost: () => void;
  onChat: () => void;
  onProfile?: () => void;
}) {
  const path = useRouterState({ select: (s) => s.location.pathname });
  const unread = useUnreadCount();
  const { data: profile } = useMyProfile();
  const [pulse, setPulse] = useState(0);
  useEffect(() => {
    const h = () => setPulse((p) => p + 1);
    window.addEventListener("leaseup:unread-pulse", h);
    return () => window.removeEventListener("leaseup:unread-pulse", h);
  }, []);

  const isMap = path === "/";
  const isBrowse = path === "/browse";
  const isProfile = path === "/profile";

  const profileIncomplete = useMemo(() => {
    if (!profile) return false;
    const filled = [profile.name, profile.year, profile.major, profile.bio, profile.avatar_emoji, profile.currently_status].filter(Boolean).length;
    return filled < 4;
  }, [profile]);

  return (
    <nav
      className="fixed bottom-0 inset-x-0 z-50 flex items-stretch justify-around border-t border-border bg-surface/95 backdrop-blur-md"
      style={{ paddingBottom: "env(safe-area-inset-bottom)" }}
    >
      <NavLink to="/" active={isMap} label="Map" icon={MapIcon} />
      <NavLink to="/browse" active={isBrowse} label="Browse" icon={LayoutGrid} />

      <button
        onClick={() => { import("@/lib/haptics").then((m) => m.haptic(10)); onPost(); }}
        aria-label="Post a listing"
        className="group flex min-h-11 flex-1 flex-col items-center justify-end gap-0.5 py-2 text-[11px] font-bold text-foreground"
      >
        <span className="relative -mt-5 grid h-12 w-12 place-items-center rounded-full bg-gradient-to-br from-primary to-primary-dark text-primary-foreground shadow-card-lg ring-4 ring-surface transition-transform duration-200 group-active:scale-90 group-hover:scale-105">
          <span className="lu-pulse-ring absolute inset-0 rounded-full" aria-hidden />
          <Plus className="relative h-6 w-6" strokeWidth={3} />
        </span>
        <span>Post</span>
      </button>

      <button
        onClick={onChat}
        className="group flex flex-1 flex-col items-center justify-center gap-0.5 py-2 text-[11px] font-semibold text-muted-foreground transition hover:text-foreground"
      >
        <span className="relative transition-transform group-active:scale-90">
          <MessageSquare className="h-5 w-5" />
          {unread > 0 && (
            <span className="absolute -right-2 -top-1.5 grid h-4 min-w-4 place-items-center rounded-full bg-red-500 px-1 text-[10px] font-bold text-white ring-2 ring-surface">
              {unread > 9 ? "9+" : unread}
            </span>
          )}
        </span>
        <span>Chat</span>
      </button>

      <Link
        to="/profile"
        className={cn(
          "group flex flex-1 flex-col items-center justify-center gap-0.5 py-2 text-[11px] font-semibold transition",
          isProfile ? "text-primary" : "text-muted-foreground hover:text-foreground",
        )}
      >
        <span className="relative transition-transform group-active:scale-90">
          <User className={cn("h-5 w-5", isProfile && "stroke-[2.5]")} />
          {profileIncomplete && !isProfile && (
            <span className="absolute -right-1 -top-0.5 h-2 w-2 rounded-full bg-primary ring-2 ring-surface" />
          )}
        </span>
        <span>Me</span>
      </Link>
    </nav>
  );
}

function NavLink({
  to, active, label, icon: Icon,
}: {
  to: string;
  active: boolean;
  label: string;
  icon: React.ComponentType<{ className?: string; strokeWidth?: number }>;
}) {
  return (
    <Link
      to={to}
      className={cn(
        "group relative flex flex-1 flex-col items-center justify-center gap-0.5 py-2 text-[11px] font-semibold transition",
        active ? "text-primary" : "text-muted-foreground hover:text-foreground",
      )}
    >
      {active && (
        <span className="absolute top-1 h-1 w-8 rounded-full bg-primary" aria-hidden />
      )}
      <Icon className={cn("h-5 w-5 transition-transform group-active:scale-90", active && "stroke-[2.5]")} />
      <span>{label}</span>
    </Link>
  );
}
