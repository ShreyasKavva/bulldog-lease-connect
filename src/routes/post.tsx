/**
 * /post — dedicated route for posting a sublease.
 *
 * Logged out: SSR-safe CTA that links to /auth?mode=in&next=/post so users
 * come back here after signing in.
 *
 * Logged in: renders the existing PostListingDialog (the canonical
 * create-listing flow, wired to campus + moderation + storage). Closing
 * the dialog navigates back home so /post never sits in an empty state.
 */
import { createFileRoute, useNavigate } from "@tanstack/react-router";
import { ArrowRight } from "lucide-react";
import { useSession } from "@/lib/leaseup/use-session";
import { PostListingDialog } from "@/components/leaseup/PostListingDialog";
import { PostWizard } from "@/components/leaseup/PostWizard";
import { openSignIn } from "@/components/leaseup/SignInModal";

export const Route = createFileRoute("/post")({
  validateSearch: (search: Record<string, unknown>): { relist?: string } => ({
    relist: typeof search?.relist === "string" ? search.relist : undefined,
  }),
  head: () => ({
    meta: [
      { title: "Post your sublease — LeaseUp" },
      { name: "description", content: "Post your student sublease on LeaseUp in under 2 minutes. Free — always." },
      { property: "og:title", content: "Post your sublease — LeaseUp" },
      { property: "og:description", content: "Free to post. Reach students at your campus." },
    ],
  }),
  component: PostPage,
});

function PostPage() {
  const { user, loading } = useSession();
  const navigate = useNavigate();
  const { relist } = Route.useSearch();

  if (loading) {
    // Q464 — a bare empty div read as a broken page on slow phones. Show the
    // page's own heading while the session resolves, so nothing ever blanks.
    return (
      <main className="mx-auto flex min-h-[70vh] max-w-md flex-col items-center justify-center px-6 pb-20 text-center md:pb-0">
        <div className="text-6xl">🏡</div>
        <h1 className="mt-4 text-3xl font-extrabold tracking-tight text-gray-900">
          Post Your Sublease
        </h1>
        <p className="mt-2 text-base text-gray-500">Loading…</p>
      </main>
    );
  }

  if (!user) {
    return (
      <main className="mx-auto flex min-h-[70vh] max-w-md flex-col items-center justify-center px-6 pb-20 text-center md:pb-0">
        <div className="text-6xl">🏡</div>
        <h1 className="mt-4 text-3xl font-extrabold tracking-tight text-gray-900">
          Post Your Sublease
        </h1>
        <p className="mt-2 text-base text-gray-500">
          Sign in to post your listing for free.
        </p>
        <button
          type="button"
          onClick={() => openSignIn("/post")}
          className="mt-6 inline-flex items-center gap-2 rounded-full bg-gray-900 px-6 py-3 text-sm font-semibold text-white shadow-md transition hover:bg-black"
        >
          Sign in to post
          <ArrowRight className="h-4 w-4" />
        </button>
        <p className="mt-4 text-xs text-gray-400">
          Free — always. Takes about 2 minutes.
        </p>
      </main>
    );
  }

  // Relist keeps the legacy pre-filled dialog (it hydrates from an old listing).
  if (relist) {
    return (
      <main className="mx-auto min-h-[60vh] max-w-2xl px-4 pb-28 pt-8 md:pb-8">
        <h1 className="mb-4 text-2xl font-extrabold tracking-tight text-gray-900">
          Relist your sublease
        </h1>
        <PostListingDialog
          open
          relistFrom={relist}
          onOpenChange={(o) => {
            if (!o) navigate({ to: "/" });
          }}
        />
      </main>
    );
  }

  return <PostWizard userId={user.id} />;
}
