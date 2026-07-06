/**
 * /post/edit/$id — edit an existing listing.
 *
 * Same form as /post, but pre-filled and calls UPDATE. Ownership is
 * enforced by RLS + a client-side gate; unauthenticated users are sent
 * through the sign-in modal with `next` set back here.
 */
import { createFileRoute, Link, useNavigate } from "@tanstack/react-router";
import { useEffect, useState } from "react";
import { useQuery } from "@tanstack/react-query";
import { ArrowLeft, ArrowRight, ShieldAlert } from "lucide-react";
import { supabase } from "@/integrations/supabase/client";
import { useSession } from "@/lib/leaseup/use-session";
import { openSignIn } from "@/components/leaseup/SignInModal";
import { PostListingDialog } from "@/components/leaseup/PostListingDialog";

export const Route = createFileRoute("/post/edit/$id")({
  head: () => ({
    meta: [
      { title: "Edit your listing — LeaseUp" },
      { name: "robots", content: "noindex" },
    ],
  }),
  component: EditListingPage,
});

function EditListingPage() {
  const { id } = Route.useParams();
  const { user, loading } = useSession();
  const navigate = useNavigate();
  const [signInPrompted, setSignInPrompted] = useState(false);

  useEffect(() => {
    if (loading || user || signInPrompted) return;
    setSignInPrompted(true);
    openSignIn(`/post/edit/${id}`);
  }, [loading, user, id, signInPrompted]);

  const { data: owner, isLoading: ownerLoading } = useQuery({
    queryKey: ["listing-owner", id],
    queryFn: async () => {
      const { data, error } = await supabase
        .from("listings")
        .select("user_id")
        .eq("id", id)
        .maybeSingle();
      if (error) throw error;
      return (data?.user_id as string | undefined) ?? null;
    },
    enabled: !!user,
    staleTime: 60_000,
  });

  if (loading || (user && ownerLoading)) {
    return <div className="min-h-[60vh]" />;
  }

  if (!user) {
    return (
      <main className="mx-auto flex min-h-[70vh] max-w-md flex-col items-center justify-center px-6 text-center">
        <p className="text-sm text-muted-foreground">Sign in to edit your listing.</p>
      </main>
    );
  }

  if (owner && owner !== user.id) {
    return (
      <main className="mx-auto flex min-h-[70vh] max-w-md flex-col items-center justify-center gap-4 px-6 text-center">
        <ShieldAlert className="h-10 w-10 text-destructive" />
        <h1 className="text-2xl font-extrabold tracking-tight">You don't have permission to edit this listing.</h1>
        <p className="text-sm text-muted-foreground">Only the person who posted it can make changes.</p>
        <Link
          to="/listing/$id"
          params={{ id }}
          className="inline-flex items-center gap-2 rounded-full bg-primary px-5 py-2.5 text-sm font-bold text-primary-foreground shadow-sm"
        >
          View listing <ArrowRight className="h-4 w-4" />
        </Link>
      </main>
    );
  }

  if (owner === null) {
    return (
      <main className="mx-auto flex min-h-[70vh] max-w-md flex-col items-center justify-center gap-4 px-6 text-center">
        <h1 className="text-2xl font-extrabold tracking-tight">Listing not found</h1>
        <Link to="/my-listings" className="text-sm font-semibold text-primary hover:underline">
          Back to your listings →
        </Link>
      </main>
    );
  }

  return (
    <main className="mx-auto min-h-[60vh] max-w-2xl px-4 pb-28 pt-8 md:pb-8">
      <div className="mb-4 flex items-center justify-between gap-3">
        <h1 className="text-2xl font-extrabold tracking-tight text-foreground">Edit your listing</h1>
        <Link
          to="/listing/$id"
          params={{ id }}
          className="inline-flex items-center gap-1 text-sm font-semibold text-muted-foreground hover:text-foreground"
        >
          <ArrowLeft className="h-4 w-4" /> Back to listing
        </Link>
      </div>
      <p className="mb-6 text-sm text-muted-foreground">
        Update the details and save — the changes go live immediately.
      </p>
      <PostListingDialog
        open
        editListingId={id}
        onOpenChange={(o) => {
          if (!o) navigate({ to: "/listing/$id", params: { id } });
        }}
      />
    </main>
  );
}
