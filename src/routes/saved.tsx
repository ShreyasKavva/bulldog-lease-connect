import { createFileRoute, Link, useNavigate } from "@tanstack/react-router";
import { useState } from "react";
import { useQuery, useQueryClient } from "@tanstack/react-query";
import { fetchSavedListings, toggleSaved, fetchSavedIds, getOrCreateConversation } from "@/lib/leaseup/queries";
import { useSession } from "@/lib/leaseup/use-session";
import { Nav } from "@/components/leaseup/Nav";
import { ListingCard } from "@/components/leaseup/ListingCard";
import { ListingDetailSheet } from "@/components/leaseup/ListingDetailSheet";
import { ProfileSheet } from "@/components/leaseup/ProfileSheet";
import { MessagesSheet } from "@/components/leaseup/MessagesSheet";
import type { Listing } from "@/lib/leaseup/types";
import { Heart } from "lucide-react";
import { toast } from "sonner";
import { openSignIn } from "@/components/leaseup/SignInModal";

export const Route = createFileRoute("/saved")({
  head: () => ({ meta: [{ title: "Saved listings — LeaseUp" }] }),
  component: SavedPage,
});

function SavedPage() {
  const { user } = useSession();
  const navigate = useNavigate();
  const qc = useQueryClient();
  const { data: listings = [], isLoading } = useQuery({
    queryKey: ["saved-listings", user?.id],
    queryFn: () => fetchSavedListings(user!.id),
    enabled: !!user,
  });
  const { data: savedIds = new Set<string>() } = useQuery({
    queryKey: ["saved", user?.id],
    queryFn: () => fetchSavedIds(user!.id),
    enabled: !!user,
  });
  const [selected, setSelected] = useState<Listing | null>(null);
  const [profileId, setProfileId] = useState<string | null>(null);
  const [activeConv, setActiveConv] = useState<string | null>(null);
  const [messagesOpen, setMessagesOpen] = useState(false);

  if (!user) {
    return (
      <div className="min-h-screen bg-background">
        <Nav onPost={() => {}} onOpenMessages={() => {}} onOpenProfile={() => {}} search="" onSearch={() => {}} />
        <div className="mx-auto max-w-md p-12 text-center">
          <Heart className="mx-auto h-12 w-12 text-muted-foreground" />
          <h2 className="mt-4 text-xl font-bold">Sign in to see saved listings</h2>
          <Link to="/auth" search={{ mode: "in" }} className="mt-4 inline-block rounded-md bg-primary px-4 py-2 text-sm font-bold text-primary-foreground">Sign in</Link>
        </div>
      </div>
    );
  }

  async function unsave(l: Listing) {
    qc.setQueryData(["saved", user!.id], (prev: Set<string> | undefined) => {
      const s = new Set(prev ?? []); s.delete(l.id); return s;
    });
    try { await toggleSaved(user!.id, l.id, true); qc.invalidateQueries({ queryKey: ["saved-listings", user!.id] }); }
    catch { qc.invalidateQueries({ queryKey: ["saved", user!.id] }); }
  }

  async function handleMessage(l: Listing) {
    if (l.user_id === user!.id) return;
    const id = await getOrCreateConversation(user!.id, l.user_id, l.id);
    setActiveConv(id); setMessagesOpen(true); setSelected(null);
  }

  return (
    <div className="min-h-screen bg-background pb-24">
      <Nav
        onPost={() => navigate({ to: "/" })}
        onOpenMessages={() => (setActiveConv(null), setMessagesOpen(true))}
        onOpenProfile={() => setProfileId(user.id)}
        search="" onSearch={() => {}}
      />
      <header className="border-b bg-surface">
        <div className="mx-auto max-w-7xl px-4 py-6">
          <h1 className="flex items-center gap-2 text-2xl font-black"><Heart className="h-6 w-6 text-destructive" />Saved listings</h1>
          <p className="text-sm text-muted-foreground">{listings.length} saved</p>
        </div>
      </header>
      <main className="mx-auto max-w-7xl px-4 py-5">
        {isLoading ? (
          <div className="grid grid-cols-2 md:grid-cols-3 lg:grid-cols-4 gap-4">
            {Array.from({ length: 4 }).map((_, i) => <div key={i} className="aspect-[4/3] animate-pulse rounded-xl bg-muted" />)}
          </div>
        ) : listings.length === 0 ? (
          <div className="rounded-xl bg-surface p-12 text-center shadow-card">
            <div className="text-5xl">💔</div>
            <h3 className="mt-3 text-lg font-bold">No saved listings yet</h3>
            <p className="mt-1 text-sm text-muted-foreground">Tap the heart on a listing to save it for later.</p>
            <Link to="/" className="mt-4 inline-block rounded-md bg-primary px-4 py-2 text-sm font-bold text-primary-foreground">Browse listings</Link>
          </div>
        ) : (
          <div className="grid grid-cols-2 md:grid-cols-3 lg:grid-cols-4 gap-4">
            {listings.map(l => (
              <ListingCard key={l.id} listing={l} saved={savedIds.has(l.id)} onSave={() => unsave(l)} onOpen={() => setSelected(l)} />
            ))}
          </div>
        )}
      </main>
      <ListingDetailSheet
        listing={selected} open={!!selected}
        onOpenChange={(o) => !o && setSelected(null)}
        onMessage={handleMessage}
        onViewProfile={(id) => { setSelected(null); setProfileId(id); }}
      />
      <ProfileSheet userId={profileId} open={!!profileId} onOpenChange={(o) => !o && setProfileId(null)} onMessage={async (otherId) => {
        const id = await getOrCreateConversation(user.id, otherId, null);
        setActiveConv(id); setMessagesOpen(true); setProfileId(null);
      }} />
      <MessagesSheet open={messagesOpen} onOpenChange={setMessagesOpen} initialConversationId={activeConv} />
    </div>
  );
}
