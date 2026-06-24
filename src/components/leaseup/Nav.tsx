import { Link, useNavigate } from "@tanstack/react-router";
import { useSession, useMyProfile } from "@/lib/leaseup/use-session";
import { Plus, MessageSquare, Search } from "lucide-react";
import { supabase } from "@/integrations/supabase/client";
import { Button } from "@/components/ui/button";

export function Nav({
  onPost, onOpenMessages, onOpenProfile, search, onSearch,
}: {
  onPost: () => void;
  onOpenMessages: () => void;
  onOpenProfile: () => void;
  search: string;
  onSearch: (s: string) => void;
}) {
  const { user } = useSession();
  const { data: profile } = useMyProfile();
  const navigate = useNavigate();

  async function signOut() {
    await supabase.auth.signOut();
    navigate({ to: "/" });
  }

  return (
    <nav className="sticky top-0 z-40 flex h-14 items-center gap-3 border-b bg-surface px-4 shadow-sm">
      <Link to="/" className="text-xl font-black tracking-tight">
        <span className="text-primary">Lease</span><span className="text-foreground">Up</span>
      </Link>
      <div className="hidden flex-1 max-w-lg items-center gap-2 rounded-full bg-background px-4 h-10 sm:flex">
        <Search className="h-4 w-4 text-muted-foreground" />
        <input
          value={search} onChange={(e) => onSearch(e.target.value)}
          placeholder="Search subleases, neighborhoods…"
          className="flex-1 bg-transparent text-sm outline-none"
        />
      </div>
      <div className="ml-auto flex items-center gap-2">
        {user ? (
          <>
            <Button onClick={onPost} className="hidden sm:inline-flex bg-primary hover:bg-primary-dark text-primary-foreground font-bold gap-1">
              <Plus className="h-4 w-4" />Post
            </Button>
            <button onClick={onOpenMessages} aria-label="Messages" className="rounded-full bg-background p-2 hover:bg-border">
              <MessageSquare className="h-5 w-5" />
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
