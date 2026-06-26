import { Link, useRouterState } from "@tanstack/react-router";
import { Map as MapIcon, LayoutGrid, Plus, MessageSquare, User } from "lucide-react";
import { cn } from "@/lib/utils";
import { useUnreadCount } from "@/hooks/use-unread";

export function BottomNav({
  onPost, onChat, onProfile: _onProfile,
}: {
  onPost: () => void;
  onChat: () => void;
  onProfile?: () => void;
}) {
  const path = useRouterState({ select: (s) => s.location.pathname });
  const unread = useUnreadCount();
  const isMap = path === "/";
  const isBrowse = path === "/browse";

  return (
    <nav
      className="fixed bottom-0 inset-x-0 z-50 flex items-stretch justify-around border-t border-border bg-surface"
      style={{ paddingBottom: "env(safe-area-inset-bottom)" }}
    >
      <Link
        to="/"
        className={cn(
          "flex flex-1 flex-col items-center justify-center gap-0.5 py-2 text-[11px] font-semibold transition",
          isMap ? "text-primary" : "text-muted-foreground hover:text-foreground",
        )}
      >
        <MapIcon className={cn("h-5 w-5", isMap && "stroke-[2.5]")} />
        <span>Map</span>
      </Link>
      <Link
        to="/browse"
        className={cn(
          "flex flex-1 flex-col items-center justify-center gap-0.5 py-2 text-[11px] font-semibold transition",
          isBrowse ? "text-primary" : "text-muted-foreground hover:text-foreground",
        )}
      >
        <LayoutGrid className={cn("h-5 w-5", isBrowse && "stroke-[2.5]")} />
        <span>Browse</span>
      </Link>
      <button
        onClick={onPost}
        aria-label="Post a listing"
        className="flex flex-1 flex-col items-center justify-end gap-0.5 py-2 text-[11px] font-bold text-foreground"
      >
        <span className="-mt-5 grid h-12 w-12 place-items-center rounded-full bg-primary text-primary-foreground shadow-card-md ring-4 ring-surface transition active:scale-95">
          <Plus className="h-6 w-6" strokeWidth={3} />
        </span>
        <span>Post</span>
      </button>
      <button
        onClick={onChat}
        className="flex flex-1 flex-col items-center justify-center gap-0.5 py-2 text-[11px] font-semibold text-muted-foreground hover:text-foreground"
      >
        <span className="relative">
          <MessageSquare className="h-5 w-5" />
          {unread > 0 && (
            <span className="absolute -right-2 -top-1.5 grid h-4 min-w-4 place-items-center rounded-full bg-red-500 px-1 text-[10px] font-bold text-white">
              {unread > 9 ? "9+" : unread}
            </span>
          )}
        </span>
        <span>Chat</span>
      </button>
      <Link
        to="/profile"
        className={cn(
          "flex flex-1 flex-col items-center justify-center gap-0.5 py-2 text-[11px] font-semibold transition",
          path === "/profile" ? "text-primary" : "text-muted-foreground hover:text-foreground",
        )}
      >
        <User className={cn("h-5 w-5", path === "/profile" && "stroke-[2.5]")} />
        <span>Me</span>
      </Link>
    </nav>
  );
}
