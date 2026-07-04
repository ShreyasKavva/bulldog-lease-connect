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
import { openSignIn } from "@/components/leaseup/SignInModal";

export const Route = createFileRoute("/post")({
  head: () => ({
    meta: [
      { title: "Post your sublease — LeaseUp" },
      { name: "description", content: "Post your student sublease on LeaseUp in under 2 minutes. Free — always." },
      { property: "og:title", content: "Post your sublease — LeaseUp" },
      { property: "og:description", content: "Free to post. Reach verified students at your campus." },
    ],
  }),
  component: PostPage,
});

function PostPage() {
  const { user, loading } = useSession();
  const navigate = useNavigate();

  if (loading) {
    return <div className="min-h-[60vh]" />;
  }

  if (!user) {
    return (
      <main className="mx-auto flex min-h-[70vh] max-w-md flex-col items-center justify-center px-6 text-center">
        <div className="text-6xl">🏡</div>
        <h1 className="mt-4 text-3xl font-extrabold tracking-tight text-gray-900">
          Post Your Sublease
        </h1>
        <p className="mt-2 text-base text-gray-500">
          Sign in with your .edu email to post your listing for free.
        </p>
        <button
          type="button"
          onClick={() => openSignIn("/post")}
          className="mt-6 inline-flex items-center gap-2 rounded-full bg-blue-600 px-6 py-3 text-sm font-semibold text-white shadow-md transition hover:bg-blue-700"
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

  return (
    <main className="mx-auto min-h-[60vh] max-w-2xl px-4 py-8">
      <h1 className="mb-4 text-2xl font-extrabold tracking-tight text-gray-900">
        Post your sublease
      </h1>
      <p className="mb-6 text-sm text-gray-500">
        Fill out the details — students at your campus will see it right away.
      </p>
      <PostListingDialog
        open
        onOpenChange={(o) => {
          if (!o) navigate({ to: "/" });
        }}
      />
    </main>
  );
}
