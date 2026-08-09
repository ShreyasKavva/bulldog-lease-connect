/**
 * Q99 — /campus/$slug : public campus landing page (SEO surface).
 *
 * Slug resolves against campuses.slug first, then common aliases derived
 * from short_name / name ("uga", "osu"). Fully public — no auth required.
 */
import { createFileRoute, Link, useNavigate, notFound } from "@tanstack/react-router";
import { useMemo, useState } from "react";
import { useQuery } from "@tanstack/react-query";
import { supabase } from "@/integrations/supabase/client";
import { fetchCampusBySlugOrAlias, type Campus } from "@/lib/leaseup/campuses";
import { ListingCard } from "@/components/leaseup/ListingCard";
import { useSession } from "@/lib/leaseup/use-session";
import { fetchSavedIds, toggleSaved } from "@/lib/leaseup/queries";
import { useQueryClient } from "@tanstack/react-query";
import type { Listing } from "@/lib/leaseup/types";
import { Search } from "lucide-react";
import { CampusAutocomplete } from "@/components/leaseup/CampusAutocomplete";

async function fetchCampusListings(campusId: string): Promise<Listing[]> {
  const { data, error } = await supabase
    .from("listings")
    .select("*")
    .eq("campus_id", campusId)
    .eq("is_active", true)
    .eq("status", "active")
    .order("created_at", { ascending: false });
  if (error) throw error;
  return (data ?? []) as unknown as Listing[];
}

export const Route = createFileRoute("/campus/$slug")({
  loader: async ({ params }) => {
    const campus = await fetchCampusBySlugOrAlias(params.slug);
    if (!campus) throw notFound();
    return { campus };
  },
  head: ({ loaderData, params }) => {
    const name = loaderData?.campus?.name ?? "your campus";
    const title = `${name} Subleases | LeaseUp`;
    const description = `Browse verified student subleases near ${name}. Semester-ready dates, real photos, message hosts directly.`;
    const url = `https://leasup.co/campus/${params.slug}`;
    return {
      meta: [
        { title },
        { name: "description", content: description },
        { property: "og:title", content: title },
        { property: "og:description", content: description },
        { property: "og:url", content: url },
        { property: "og:type", content: "website" },
      ],
      links: [{ rel: "canonical", href: url }],
    };
  },
  notFoundComponent: () => (
    <div className="mx-auto max-w-md px-6 py-24 text-center">
      <h1 className="text-2xl font-bold text-gray-900 dark:text-foreground">Campus not found</h1>
      <p className="mt-2 text-sm text-muted-foreground">
        We don't have a page for that school yet.
      </p>
      <Link to="/browse" className="mt-6 inline-block font-semibold text-primary hover:underline">
        Browse all subleases →
      </Link>
    </div>
  ),
  component: CampusLandingPage,
});

function CampusLandingPage() {
  const { campus } = Route.useLoaderData() as { campus: Campus };
  const navigate = useNavigate();
  const qc = useQueryClient();
  const { user } = useSession();
  const [where, setWhere] = useState<{ name: string; slug: string }>({ name: campus.name, slug: campus.slug });
  const [when, setWhen] = useState("");
  const [who, setWho] = useState("");

  const { data: listings = [], isLoading } = useQuery({
    queryKey: ["campus-listings", campus.id],
    queryFn: () => fetchCampusListings(campus.id),
  });
  // Q119 — how many students are actively looking near this campus.
  const { data: lookingCount = 0 } = useQuery({
    queryKey: ["campus-looking-count", campus.id],
    queryFn: async () => {
      const { count, error } = await supabase
        .from("looking_for_posts")
        .select("id", { count: "exact", head: true })
        .eq("campus_id", campus.id)
        .eq("is_active", true);
      if (error) throw error;
      return count ?? 0;
    },
  });
  const { data: savedIds = new Set<string>() } = useQuery({
    queryKey: ["saved", user?.id],
    queryFn: () => fetchSavedIds(user!.id),
    enabled: !!user?.id,
  });

  const stats = useMemo(() => {
    const prices = listings.map((l) => l.price).filter((p) => typeof p === "number");
    const monthAgo = Date.now() - 30 * 86400000;
    return {
      count: listings.length,
      avg: prices.length ? Math.round(prices.reduce((a, b) => a + b, 0) / prices.length) : 0,
      thisMonth: listings.filter((l) => new Date(l.created_at).getTime() >= monthAgo).length,
    };
  }, [listings]);

  const visible = listings.slice(0, 6);

  async function handleSave(l: Listing) {
    if (!user) {
      navigate({ to: "/auth", search: { mode: "up", next: `/campus/${campus.slug}` } as any });
      return;
    }
    const saved = savedIds.has(l.id);
    try {
      await toggleSaved(user.id, l.id, !saved);
      qc.invalidateQueries({ queryKey: ["saved", user.id] });
    } catch {
      /* non-fatal */
    }
  }

  function submitSearch(e: React.FormEvent) {
    e.preventDefault();
    navigate({
      to: "/browse",
      search: {
        campus: where.slug || campus.slug,
        ...(when ? { from: when } : {}),
        ...(who ? { tenants: Number(who) || undefined } : {}),
      } as any,
    });
  }

  const short = campus.short_name || campus.name;

  return (
    <div className="min-h-screen bg-background">
      {/* Hero */}
      <section className="w-full bg-gray-50 px-6 py-16 dark:bg-surface">
        <div className="mx-auto max-w-5xl">
          <h1 className="text-3xl font-bold text-gray-900 dark:text-foreground sm:text-4xl">
            {campus.name} Subleases
          </h1>
          <p className="mt-2 text-lg text-gray-500">
            Find verified student subleases near {campus.city}.
          </p>
          <Link
            to="/browse"
            search={{ campus: campus.slug } as any}
            className="mt-5 inline-flex items-center rounded-full bg-gray-900 px-6 py-3 text-sm font-semibold text-white dark:bg-white dark:text-gray-900"
          >
            Browse {stats.count} active listing{stats.count === 1 ? "" : "s"} →
          </Link>

          <form
            onSubmit={submitSearch}
            className="mt-6 flex w-full max-w-3xl flex-col gap-2 rounded-2xl border border-border bg-white p-2 shadow-sm dark:bg-background sm:flex-row sm:items-center"
          >
            <div className="relative flex-1 px-3 py-2">
              <label className="block text-[11px] font-bold uppercase tracking-wide text-muted-foreground">
                Where
              </label>
              <CampusAutocomplete
                value={where.name}
                placeholder="Search campuses…"
                onSelect={(c) => setWhere({ name: c.name, slug: c.slug })}
                onClear={() => setWhere({ name: "", slug: campus.slug })}
              />
            </div>

            <div className="flex-1 border-border px-3 py-2 sm:border-l">
              <label className="block text-[11px] font-bold uppercase tracking-wide text-muted-foreground">
                When
              </label>
              <input
                type="date"
                value={when}
                onChange={(e) => setWhen(e.target.value)}
                className="w-full bg-transparent text-sm outline-none"
              />
            </div>
            <div className="flex-1 border-border px-3 py-2 sm:border-l">
              <label className="block text-[11px] font-bold uppercase tracking-wide text-muted-foreground">
                Who
              </label>
              <input
                type="number"
                min={1}
                max={8}
                placeholder="Add tenants"
                value={who}
                onChange={(e) => setWho(e.target.value)}
                className="w-full bg-transparent text-sm outline-none"
              />
            </div>
            <button
              type="submit"
              className="inline-flex h-12 items-center justify-center gap-2 rounded-full bg-gray-900 px-6 text-sm font-semibold text-white dark:bg-foreground dark:text-background"
            >
              <Search className="h-4 w-4" /> Search
            </button>
          </form>
        </div>
      </section>

      {/* Stats bar */}
      <div className="border-y border-gray-100 bg-white py-4 dark:border-border dark:bg-surface">
        <div className="mx-auto grid max-w-5xl grid-cols-3 gap-4 px-6">
          <div className="text-center">
            <div className="text-lg font-bold">{stats.count}</div>
            <div className="text-xs text-muted-foreground">active subleases</div>
          </div>
          <div className="text-center">
            <div className="text-lg font-bold">{stats.avg ? `$${stats.avg.toLocaleString()}/mo` : "—"}</div>
            <div className="text-xs text-muted-foreground">average price</div>
          </div>
          <div className="text-center">
            <div className="text-lg font-bold">{stats.thisMonth}</div>
            <div className="text-xs text-muted-foreground">added this month</div>
          </div>
        </div>
      </div>

      {/* Listings */}
      <section className="mx-auto max-w-7xl px-6 py-10">
        <h2 className="mb-4 text-xl font-semibold">Recent subleases near {short}</h2>
        {isLoading ? (
          <div className="grid grid-cols-1 gap-6 sm:grid-cols-2 lg:grid-cols-3 xl:grid-cols-4">
            {Array.from({ length: 8 }).map((_, i) => (
              <div key={i} className="h-72 animate-pulse rounded-2xl bg-muted" />
            ))}
          </div>
        ) : listings.length === 0 ? (
          <div className="rounded-2xl border border-border bg-surface p-12 text-center">
            <p className="text-sm text-muted-foreground">
              No subleases posted near {campus.name} yet.
            </p>
            <Link to="/post" className="mt-3 inline-block font-semibold text-primary hover:underline">
              Be the first! → Post a sublease
            </Link>
          </div>
        ) : (
          <>
            <div className="grid grid-cols-1 gap-6 sm:grid-cols-2 lg:grid-cols-3 xl:grid-cols-4">
              {visible.map((l) => (
                <ListingCard
                  key={l.id}
                  listing={l}
                  saved={savedIds.has(l.id)}
                  onSave={() => handleSave(l)}
                  onOpen={() => navigate({ to: "/listing/$id", params: { id: l.id } })}
                />
              ))}
            </div>
            <div className="mt-8 text-center">
              <Link
                to="/browse"
                search={{ campus: campus.slug } as any}
                className="inline-block text-sm font-semibold text-primary hover:underline"
              >
                View all {listings.length} sublease{listings.length === 1 ? "" : "s"} at {campus.name} →
              </Link>
            </div>
          </>
        )}
      </section>
    </div>
  );
}
