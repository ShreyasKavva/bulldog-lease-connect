/**
 * /saved — saved collections grid (Q91).
 *
 * Hearts across the app drop listings into named collections; this page lists
 * those collections with a 2x2 photo collage cover. "Saved" is always first.
 */
import { createFileRoute, Link } from "@tanstack/react-router";
import { useQuery } from "@tanstack/react-query";
import { Heart } from "lucide-react";
import { useSession } from "@/lib/leaseup/use-session";
import { Nav } from "@/components/leaseup/Nav";
import { openSignIn } from "@/components/leaseup/SignInModal";
import { DEFAULT_COLLECTION, fetchCollections } from "@/lib/leaseup/collections";
import type { Listing } from "@/lib/leaseup/types";

export const Route = createFileRoute("/saved/")({
  head: () => ({
    meta: [
      { title: "Saved subleases — LeaseUp" },
      { name: "description", content: "Your saved sublease collections on LeaseUp." },
      { property: "og:title", content: "Saved subleases — LeaseUp" },
      { property: "og:description", content: "Your saved sublease collections on LeaseUp." },
    ],
  }),
  component: SavedPage,
});

function photoOf(l: Listing) {
  return (l.photo_urls?.length ? l.photo_urls : l.photos)?.[0] ?? null;
}

function Collage({ listings }: { listings: Listing[] }) {
  const photos = listings.map(photoOf).filter(Boolean).slice(0, 4) as string[];
  const cells = [0, 1, 2, 3];
  return (
    <div className="grid aspect-square grid-cols-2 grid-rows-2 gap-0.5 overflow-hidden rounded-2xl bg-muted">
      {cells.map((i) =>
        photos[i] ? (
          <img key={i} src={photos[i]} alt="" className="h-full w-full object-cover" loading="lazy" />
        ) : (
          <div key={i} className="h-full w-full bg-muted" />
        ),
      )}
    </div>
  );
}

function SavedPage() {
  const { user } = useSession();
  const { data: collections = [], isLoading } = useQuery({
    queryKey: ["collections", user?.id],
    queryFn: () => fetchCollections(user!.id),
    enabled: !!user?.id,
  });

  if (!user) {
    return (
      <div className="min-h-screen bg-background">
        <Nav onPost={() => {}} onOpenMessages={() => {}} onOpenProfile={() => {}} search="" onSearch={() => {}} />
        <div className="mx-auto max-w-md p-12 text-center">
          <Heart className="mx-auto h-12 w-12 text-muted-foreground" />
          <h2 className="mt-4 text-xl font-bold">Sign in to see saved subleases</h2>
          <button
            type="button"
            onClick={() => openSignIn("/saved")}
            className="mt-4 inline-block rounded-full bg-foreground px-5 py-2.5 text-sm font-semibold text-background"
          >
            Sign in
          </button>
        </div>
      </div>
    );
  }

  const list = collections.length
    ? collections
    : [{ name: DEFAULT_COLLECTION, listings: [] as Listing[] }];
  const total = list.reduce((n, c) => n + c.listings.length, 0);

  return (
    <div className="min-h-screen bg-background">
      <Nav onPost={() => {}} onOpenMessages={() => {}} onOpenProfile={() => {}} search="" onSearch={() => {}} />
      <main className="mx-auto max-w-7xl px-4 py-8 md:px-8">
        <h1 className="text-2xl font-bold">Saved subleases</h1>
        <p className="mt-1 text-sm text-muted-foreground">
          {list.length} collection{list.length === 1 ? "" : "s"}
        </p>

        {isLoading ? (
          <div className="mt-8 grid grid-cols-1 gap-6 sm:grid-cols-2 lg:grid-cols-3 xl:grid-cols-4">
            {[0, 1, 2, 3].map((i) => (
              <div key={i} className="animate-pulse">
                <div className="aspect-square rounded-2xl bg-muted" />
                <div className="mt-3 h-4 w-1/2 rounded bg-muted" />
              </div>
            ))}
          </div>
        ) : total === 0 ? (
          <div className="mx-auto max-w-md py-20 text-center">
            <div className="text-6xl">🏠</div>
            <h2 className="mt-4 text-xl font-bold">Start saving subleases</h2>
            <p className="mt-2 text-sm text-muted-foreground">Tap the heart on any listing.</p>
            <Link
              to="/browse"
              className="mt-5 inline-block rounded-full bg-foreground px-5 py-2.5 text-sm font-semibold text-background"
            >
              Browse subleases
            </Link>
          </div>
        ) : (
          <div className="mt-8 grid grid-cols-1 gap-6 sm:grid-cols-2 lg:grid-cols-3 xl:grid-cols-4">
            {list.map((c) => (
              <Link
                key={c.name}
                to="/saved/$collection"
                params={{ collection: c.name }}
                className="group block transition-transform hover:scale-[1.02]"
              >
                <Collage listings={c.listings} />
                <p className="mt-3 font-semibold">{c.name}</p>
                <p className="text-sm text-muted-foreground">
                  {c.listings.length} sublease{c.listings.length === 1 ? "" : "s"}
                </p>
              </Link>
            ))}
          </div>
        )}
      </main>
    </div>
  );
}
