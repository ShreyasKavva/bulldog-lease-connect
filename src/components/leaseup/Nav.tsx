import { Link, useNavigate } from "@tanstack/react-router";
import { useSession, useMyProfile } from "@/lib/leaseup/use-session";
import { Plus, MessageSquare, Search, Sparkles, ShieldCheck, Users, Heart, Home, Shield } from "lucide-react";
import { supabase } from "@/integrations/supabase/client";
import { Button } from "@/components/ui/button";
import { CampusPicker } from "@/components/leaseup/CampusPicker";
import { useUnreadCount } from "@/hooks/use-unread";

export function Nav({
  onPost, onOpenMessages, onOpenProfile, search, onSearch,
  onOpenMatch, onOpenLease, activeCampusSlug,
}: {
  onPost: () => void;
  onOpenMessages: () => void;
  onOpenProfile: () => void;
  search: string;
  onSearch: (s: string) => void;
  onOpenMatch?: () => void;
  onOpenLease?: () => void;
  activeCampusSlug?: string;
}) {
  const { user } = useSession();
  const { data: profile } = useMyProfile();
  const navigate = useNavigate();
  const unread = useUnreadCount();

  async function signOut() {
    await supabase.auth.signOut();
    navigate({ to: "/" });
  }

  return (
    <nav className="sticky top-0 z-40 flex h-14 items-center gap-2 border-b bg-surface px-4 shadow-sm">
      <Link to="/" className="text-xl font-black tracking-tight">
        <span className="text-primary">Lease</span><span className="text-foreground">Up</span>
      </Link>
      <CampusPicker activeSlug={activeCampusSlug} />
      <div className="hidden flex-1 max-w-lg items-center gap-2 rounded-full bg-background px-4 h-10 sm:flex">
        <Search className="h-4 w-4 text-muted-foreground" />
        <input
          value={search} onChange={(e) => onSearch(e.target.value)}
          placeholder="Search subleases, neighborhoods…"
          className="flex-1 bg-transparent text-sm outline-none"
        />
      </div>
      <div className="ml-auto flex items-center gap-1.5">
        <Link to="/looking-for" className="hidden md:inline-flex items-center gap-1 rounded-full bg-background px-3 py-1.5 text-xs font-semibold hover:bg-border">
          <Users className="h-3.5 w-3.5" />Looking For
        </Link>
        {user && (
          <>
            <Link to="/saved" className="hidden md:inline-flex items-center gap-1 rounded-full bg-background px-3 py-1.5 text-xs font-semibold hover:bg-border" title="Saved">
              <Heart className="h-3.5 w-3.5" />Saved
            </Link>
            <Link to="/my-listings" className="hidden md:inline-flex items-center gap-1 rounded-full bg-background px-3 py-1.5 text-xs font-semibold hover:bg-border" title="My listings">
              <Home className="h-3.5 w-3.5" />Mine
            </Link>
            {profile?.is_admin && (
              <Link to="/admin" className="hidden md:inline-flex items-center gap-1 rounded-full bg-foreground text-background px-3 py-1.5 text-xs font-bold hover:bg-foreground/90" title="Admin">
                <Shield className="h-3.5 w-3.5" />Admin
              </Link>
            )}
          </>
        )}
        {onOpenMatch && (
          <button onClick={onOpenMatch} className="hidden md:inline-flex items-center gap-1 rounded-full bg-primary-light px-3 py-1.5 text-xs font-bold text-primary-dark hover:bg-primary/20">
            <Sparkles className="h-3.5 w-3.5" />Find My Match
          </button>
        )}
        {onOpenLease && (
          <button onClick={onOpenLease} className="hidden md:inline-flex items-center gap-1 rounded-full bg-primary-light px-3 py-1.5 text-xs font-bold text-primary-dark hover:bg-primary/20">
            <ShieldCheck className="h-3.5 w-3.5" />Lease Bot
          </button>
        )}
        {user ? (
          <>
            <Button onClick={onPost} className="hidden sm:inline-flex bg-primary hover:bg-primary-dark text-primary-foreground font-bold gap-1">
              <Plus className="h-4 w-4" />Post
            </Button>
            <button onClick={onOpenMessages} aria-label="Messages" className="relative rounded-full bg-background p-2 hover:bg-border">
              <MessageSquare className="h-5 w-5" />
              {unread > 0 && (
                <span className="absolute -top-0.5 -right-0.5 grid h-4 min-w-4 place-items-center rounded-full bg-red-500 px-1 text-[10px] font-bold text-white">
                  {unread > 9 ? "9+" : unread}
                </span>
              )}
            </button>
            <button onClick={onOpenProfile} className="flex items-center gap-2 rounded-full bg-background py-1 pr-3 pl-1 hover:bg-border">
              <div
                className="flex h-8 w-8 items-center justify-center rounded-full text-base"
                style={{ background: profile?.banner_color ?? "#2563EB" }}
              >{profile?.avatar_emoji ?? "🙂"}</div>
              <span className="hidden sm:inline text-sm font-bold">{profile?.name?.split(" ")[0] ?? "Me"}</span>
            </button>
            <button onClick={signOut} className="hidden md:inline text-xs text-muted-foreground hover:text-foreground">
              Sign out
            </button>
          </>
        ) : (
          <>
            <Link to="/auth" search={{ mode: "in" }} className="rounded-md border px-3 py-1.5 text-sm font-semibold text-muted-foreground hover:text-foreground">Sign in</Link>
            <Link to="/auth" search={{ mode: "up" }} className="rounded-md bg-primary px-3 py-1.5 text-sm font-bold text-primary-foreground hover:bg-primary-dark">Sign up</Link>
          </>
        )}
      </div>
    </nav>
  );
}
