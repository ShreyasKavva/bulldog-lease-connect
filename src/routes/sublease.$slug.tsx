import { createFileRoute, Link, useNavigate, notFound } from "@tanstack/react-router";
import { useQuery, useQueryClient } from "@tanstack/react-query";
import { useMemo, useState } from "react";
import { fetchCampusBySlug, fetchCampuses, type Campus } from "@/lib/leaseup/campuses";
import { fetchListings, fetchSavedIds, toggleSaved, getOrCreateConversation } from "@/lib/leaseup/queries";
import { useSession } from "@/lib/leaseup/use-session";
import { Nav } from "@/components/leaseup/Nav";
import { ListingCard } from "@/components/leaseup/ListingCard";
import { ListingDetailSheet } from "@/components/leaseup/ListingDetailSheet";
import { MessagesSheet } from "@/components/leaseup/MessagesSheet";
import { ProfileSheet } from "@/components/leaseup/ProfileSheet";
import { PostListingDialog } from "@/components/leaseup/PostListingDialog";
import type { Listing } from "@/lib/leaseup/types";
import { ShieldCheck, MapPin, Sparkles, Plus } from "lucide-react";
import { toast } from "sonner";

export const Route = createFileRoute("/sublease/$slug")({
  loader: async ({ params }) => {
    const campus = await fetchCampusBySlug(params.slug);
    if (!campus) throw notFound();
    return { campus };
  },
  head: ({ params, loaderData }) => {
    const c = loaderData?.campus;
    const name = c?.short_name ?? params.slug;
    const fullName = c?.name ?? name;
    const city = c?.city ? `${c.city}, ${c.state}` : "";
    const title = `${name} Subleases — Find a Sublease Near ${fullName} | LeaseUp`;
    const desc = `Verified student subleases at ${fullName}${city ? ` in ${city}` : ""}. Browse listings, post your sublease, and connect with other ${name} students.`;
    return {
      meta: [
        { title },
        { name: "description", content: desc },
        { property: "og:title", content: title },
        { property: "og:description", content: desc },
        { property: "og:url", content: `/sublease/${params.slug}` },
        { property: "og:type", content: "website" },
      ],
      links: [{ rel: "canonical", href: `/sublease/${params.slug}` }],
      scripts: [{
        type: "application/ld+json",
        children: JSON.stringify({
          "@context": "https://schema.org",
          "@type": "WebPage",
          name: title,
          description: desc,
          about: { "@type": "CollegeOrUniversity", name: fullName },
        }),
      }],
    };
  },
  notFoundComponent: () => (
    <div className="min-h-screen grid place-items-center bg-background p-4 text-center">
      <div>
        <h1 className="text-2xl font-black">Campus not found</h1>
        <p className="mt-2 text-sm text-muted-foreground">We're not live on this campus yet.</p>
        <Link to="/" className="mt-4 inline-block rounded-md bg-primary px-4 py-2 text-sm font-bold text-primary-foreground">
          Back home
        </Link>
      </div>
    </div>
  ),
  errorComponent: ({ error }) => (
    <div className="min-h-screen grid place-items-center bg-background p-4 text-center text-sm text-muted-foreground">
      Something went wrong. {error.message}
    </div>
  ),
  component: CampusPage,
});

function CampusPage() {
  const { campus } = Route.useLoaderData();
  const navigate = useNavigate();
  const { user } = useSession();
  const qc = useQueryClient();

  const { data: allListings = [] } = useQuery({ queryKey: ["listings"], queryFn: fetchListings });
  const { data: campuses = [] } = useQuery({ queryKey: ["campuses"], queryFn: fetchCampuses });
  const { data: savedIds = new Set<string>() } = useQuery({
    queryKey: ["saved", user?.id],
    queryFn: () => fetchSavedIds(user!.id),
    enabled: !!user?.id,
  });

  const listings = useMemo(
    () => allListings.filter(l => l.campus_id === campus.id),
    [allListings, campus.id],
  );

  const [search, setSearch] = useState("");
  const [selected, setSelected] = useState<Listing | null>(null);
  const [posting, setPosting] = useState(false);
  const [messagesOpen, setMessagesOpen] = useState(false);
  const [activeConv, setActiveConv] = useState<string | null>(null);
  const [profileId, setProfileId] = useState<string | null>(null);

  async function handleSave(l: Listing) {
    if (!user) { navigate({ to: "/auth", search: { mode: "in" } }); return; }
    const saved = savedIds.has(l.id);
    qc.setQueryData(["saved", user.id], (prev: Set<string> | undefined) => {
      const s = new Set(prev ?? []);
      if (saved) s.delete(l.id); else s.add(l.id);
      return s;
    });
    try { await toggleSaved(user.id, l.id, saved); }
    catch { qc.invalidateQueries({ queryKey: ["saved", user.id] }); }
  }

  async function handleMessage(l: Listing) {
    if (!user) { navigate({ to: "/auth", search: { mode: "in" } }); return; }
    if (l.user_id === user.id) { toast("That's your own listing"); return; }
    const id = await getOrCreateConversation(user.id, l.user_id, l.id);
    setActiveConv(id);
    setMessagesOpen(true);
    setSelected(null);
  }

  const filtered = search
    ? listings.filter(l => l.title.toLowerCase().includes(search.toLowerCase()) || (l.area ?? "").toLowerCase().includes(search.toLowerCase()))
    : listings;

  const handlePost = () => user ? setPosting(true) : navigate({ to: "/auth", search: { mode: "up" } });

  return (
    <div className="min-h-screen bg-background pb-24 md:pb-0">
      <Nav
        onPost={handlePost}
        onOpenMessages={() => user ? (setActiveConv(null), setMessagesOpen(true)) : navigate({ to: "/auth", search: { mode: "in" } })}
        onOpenProfile={() => user ? setProfileId(user.id) : navigate({ to: "/auth", search: { mode: "in" } })}
        search={search}
        onSearch={setSearch}
        activeCampusSlug={campus.slug}
      />

      {/* Hero */}
      <header className="border-b bg-surface">
        <div className="mx-auto max-w-7xl px-4 py-10 md:py-14">
          <div className="flex items-center gap-2 text-xs font-bold text-primary uppercase tracking-wider">
            <MapPin className="h-3.5 w-3.5" /> {campus.city}, {campus.state}
          </div>
          <h1 className="mt-2 text-3xl md:text-4xl font-black tracking-tight">
            {campus.short_name} Subleases
          </h1>
          <p className="mt-2 max-w-2xl text-sm md:text-base text-muted-foreground">
            Verified student subleases at <span className="font-semibold text-foreground">{campus.name}</span>. Browse listings, post your sublease, and chat directly with other students. No scams. No agents.
          </p>
          <div className="mt-5 flex flex-wrap gap-2">
            <button onClick={handlePost} className="inline-flex items-center gap-1 rounded-md bg-primary px-4 py-2 text-sm font-bold text-primary-foreground hover:bg-primary-dark">
              <Plus className="h-4 w-4" /> Post a sublease
            </button>
            <Link to="/looking-for" className="inline-flex items-center gap-1 rounded-md border bg-surface px-4 py-2 text-sm font-bold hover:bg-background">
              <Sparkles className="h-4 w-4" /> I'm looking
            </Link>
          </div>
          <div className="mt-5 flex flex-wrap gap-2 text-[11px] font-semibold text-muted-foreground">
            <span className="inline-flex items-center gap-1 rounded-full bg-background px-2.5 py-1"><ShieldCheck className="h-3 w-3 text-primary" />Verified .edu students</span>
            <span className="rounded-full bg-background px-2.5 py-1">SafeScore on every listing</span>
            <span className="rounded-full bg-background px-2.5 py-1">In-app messaging</span>
            <span className="rounded-full bg-background px-2.5 py-1">AI lease analysis</span>
          </div>
        </div>
      </header>

      <main className="mx-auto max-w-7xl px-4 py-6">
        <div className="flex items-center justify-between mb-4">
          <h2 className="font-black">{filtered.length} listing{filtered.length === 1 ? "" : "s"} at {campus.short_name}</h2>
        </div>

        {filtered.length === 0 ? (
          <div className="rounded-xl bg-surface p-12 text-center shadow-card">
            <div className="text-5xl">🏠</div>
            <h3 className="mt-3 text-lg font-bold">No listings at {campus.short_name} yet</h3>
            <p className="mt-1 text-sm text-muted-foreground max-w-md mx-auto">
              Be the first. Post your sublease and we'll spread the word to other {campus.short_name} students.
            </p>
            <button onClick={handlePost} className="mt-4 inline-flex items-center gap-1 rounded-md bg-primary px-4 py-2 text-sm font-bold text-primary-foreground hover:bg-primary-dark">
              <Plus className="h-4 w-4" /> Post the first listing
            </button>
          </div>
        ) : (
          <div className="grid grid-cols-2 md:grid-cols-3 lg:grid-cols-4 gap-4">
            {filtered.map(l => (
              <ListingCard key={l.id} listing={l} saved={savedIds.has(l.id)}
                onSave={() => handleSave(l)} onOpen={() => setSelected(l)} />
            ))}
          </div>
        )}

        {/* Other campuses */}
        <section className="mt-12 border-t pt-8">
          <h2 className="font-black mb-3">Browse other campuses</h2>
          <div className="flex flex-wrap gap-2">
            {campuses.filter(c => c.slug !== campus.slug).map(c => (
              <Link key={c.id} to="/sublease/$slug" params={{ slug: c.slug }}
                className="rounded-full bg-surface border px-3 py-1.5 text-xs font-semibold hover:border-primary">
                {c.short_name}
              </Link>
            ))}
          </div>
        </section>
      </main>

      <ListingDetailSheet listing={selected} open={!!selected}
        onOpenChange={(o) => !o && setSelected(null)}
        onMessage={handleMessage}
        onViewProfile={(id) => { setSelected(null); setProfileId(id); }} />
      <MessagesSheet open={messagesOpen} onOpenChange={setMessagesOpen} initialConversationId={activeConv} />
      <ProfileSheet userId={profileId} open={!!profileId} onOpenChange={(o) => !o && setProfileId(null)}
        onMessage={async (otherId) => {
          if (!user) return;
          const id = await getOrCreateConversation(user.id, otherId, null);
          setActiveConv(id); setMessagesOpen(true); setProfileId(null);
        }} />
      <PostListingDialog open={posting} onOpenChange={setPosting} />
    </div>
  );
}
