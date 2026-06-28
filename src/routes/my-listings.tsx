import { createFileRoute, Link, useNavigate } from "@tanstack/react-router";
import { useState } from "react";
import { useQuery, useQueryClient } from "@tanstack/react-query";
import { fetchMyListings, deleteListing, setListingActive, markListingFilled, reopenListing } from "@/lib/leaseup/queries";
import { useSession } from "@/lib/leaseup/use-session";
import { Nav } from "@/components/leaseup/Nav";
import { Button } from "@/components/ui/button";
import { ListingDetailSheet } from "@/components/leaseup/ListingDetailSheet";
import { PostListingDialog } from "@/components/leaseup/PostListingDialog";
import { SafeScoreBadge } from "@/components/leaseup/SafeScoreBadge";
import { LeaveReviewDialog } from "@/components/leaseup/LeaveReviewDialog";
import type { Listing } from "@/lib/leaseup/types";
import { Eye, EyeOff, Trash2, Plus, Home as HomeIcon, CheckCircle2, Star, RotateCcw } from "lucide-react";
import { toast } from "sonner";
import { cn } from "@/lib/utils";
import { supabase } from "@/integrations/supabase/client";

export const Route = createFileRoute("/my-listings")({
  head: () => ({ meta: [{ title: "My listings — LeaseUp" }] }),
  component: MyListingsPage,
});

function MyListingsPage() {
  const { user } = useSession();
  const navigate = useNavigate();
  const qc = useQueryClient();
  const { data: listings = [], isLoading } = useQuery({
    queryKey: ["my-listings", user?.id],
    queryFn: () => fetchMyListings(user!.id),
    enabled: !!user,
  });
  const [selected, setSelected] = useState<Listing | null>(null);
  const [posting, setPosting] = useState(false);

  if (!user) {
    return (
      <div className="min-h-screen bg-background">
        <Nav onPost={() => {}} onOpenMessages={() => {}} onOpenProfile={() => {}} search="" onSearch={() => {}} />
        <div className="mx-auto max-w-md p-12 text-center">
          <h2 className="text-xl font-bold">Sign in to manage your listings</h2>
          <Link to="/auth" search={{ mode: "in" }} className="mt-4 inline-block rounded-md bg-primary px-4 py-2 text-sm font-bold text-primary-foreground">Sign in</Link>
        </div>
      </div>
    );
  }

  async function toggleActive(l: Listing) {
    try {
      await setListingActive(l.id, !l.is_active);
      qc.invalidateQueries({ queryKey: ["my-listings", user!.id] });
      qc.invalidateQueries({ queryKey: ["listings"] });
      toast.success(l.is_active ? "Hidden from feed" : "Live on feed");
    } catch (e: any) { toast.error(e.message); }
  }

  async function remove(l: Listing) {
    if (!confirm(`Delete "${l.title}"? This can't be undone.`)) return;
    try {
      await deleteListing(l.id);
      qc.invalidateQueries({ queryKey: ["my-listings", user!.id] });
      qc.invalidateQueries({ queryKey: ["listings"] });
      toast.success("Deleted");
    } catch (e: any) { toast.error(e.message); }
  }

  return (
    <div className="min-h-screen bg-background pb-24">
      <Nav
        onPost={() => setPosting(true)}
        onOpenMessages={() => navigate({ to: "/" })}
        onOpenProfile={() => navigate({ to: "/" })}
        search="" onSearch={() => {}}
      />
      <header className="border-b bg-surface">
        <div className="mx-auto max-w-5xl px-4 py-6 flex items-center gap-3">
          <div>
            <h1 className="flex items-center gap-2 text-2xl font-black"><HomeIcon className="h-6 w-6 text-primary" />My listings</h1>
            <p className="text-sm text-muted-foreground">{listings.length} total · {listings.filter(l => l.is_active).length} active</p>
          </div>
          <Button onClick={() => setPosting(true)} className="ml-auto bg-primary hover:bg-primary-dark text-primary-foreground font-bold gap-1">
            <Plus className="h-4 w-4" />New listing
          </Button>
        </div>
      </header>
      <main className="mx-auto max-w-5xl px-4 py-5">
        {isLoading ? (
          <div className="space-y-3">{Array.from({ length: 3 }).map((_, i) => <div key={i} className="h-24 animate-pulse rounded-xl bg-muted" />)}</div>
        ) : listings.length === 0 ? (
          <div className="rounded-xl bg-surface p-12 text-center shadow-card">
            <div className="text-5xl">🏡</div>
            <h3 className="mt-3 text-lg font-bold">No listings yet</h3>
            <Button onClick={() => setPosting(true)} className="mt-4 bg-primary hover:bg-primary-dark text-primary-foreground gap-1"><Plus className="h-4 w-4" />Post your first</Button>
          </div>
        ) : (
          <div className="space-y-2">
            {listings.map(l => (
              <div key={l.id} className={cn("flex items-center gap-3 rounded-xl bg-surface p-3 shadow-card", !l.is_active && "opacity-60")}>
                <button onClick={() => setSelected(l)} className="h-16 w-20 shrink-0 overflow-hidden rounded-md bg-muted">
                  {l.photo_urls?.[0] ? <img src={l.photo_urls[0]} alt="" className="h-full w-full object-cover" /> : <div className="flex h-full w-full items-center justify-center text-2xl">🏠</div>}
                </button>
                <button onClick={() => setSelected(l)} className="min-w-0 flex-1 text-left">
                  <div className="flex items-center gap-2">
                    <span className="font-bold text-sm truncate">{l.title}</span>
                    {!l.is_active && <span className="rounded-full bg-muted px-2 py-0.5 text-[10px] font-bold">Hidden</span>}
                  </div>
                  <div className="text-xs text-muted-foreground">${l.price}/mo · {l.beds} bd · {l.area ?? "Near campus"}</div>
                  <div className="mt-1"><SafeScoreBadge score={l.safe_score} /></div>
                </button>
                <button onClick={() => toggleActive(l)} title={l.is_active ? "Hide" : "Show"} className="rounded-md p-2 hover:bg-background">
                  {l.is_active ? <Eye className="h-4 w-4" /> : <EyeOff className="h-4 w-4" />}
                </button>
                <button onClick={() => remove(l)} title="Delete" className="rounded-md p-2 text-destructive hover:bg-destructive/10">
                  <Trash2 className="h-4 w-4" />
                </button>
              </div>
            ))}
          </div>
        )}
      </main>
      <ListingDetailSheet
        listing={selected} open={!!selected}
        onOpenChange={(o) => !o && setSelected(null)}
        onMessage={() => {}} onViewProfile={() => {}}
      />
      <PostListingDialog open={posting} onOpenChange={(o) => { setPosting(o); if (!o) qc.invalidateQueries({ queryKey: ["my-listings", user.id] }); }} />
    </div>
  );
}
