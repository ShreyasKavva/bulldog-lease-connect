/**
 * Full-page "Sign in to continue" prompt for auth-required routes.
 * Preserves the current path so the user lands back after Google sign-in.
 */
import { Link } from "@tanstack/react-router";
import { openSignIn } from "@/components/leaseup/SignInModal";
import { Lock } from "lucide-react";

export function SignInGate({
  title = "Sign in to continue",
  body = "You need to sign in to view this page.",
  next,
}: {
  title?: string;
  body?: string;
  next?: string;
}) {
  const nextPath =
    next ?? (typeof window !== "undefined" ? window.location.pathname + window.location.search : "/");
  return (
    <div className="flex min-h-[70vh] items-center justify-center bg-background px-4">
      <div className="w-full max-w-md rounded-2xl border border-border bg-card p-8 text-center shadow-card">
        <div className="mx-auto mb-4 grid h-12 w-12 place-items-center rounded-full bg-primary-light">
          <Lock className="h-5 w-5 text-primary-dark" />
        </div>
        <h1 className="text-xl font-black">{title}</h1>
        <p className="mt-2 text-sm text-muted-foreground">{body}</p>
        <button
          type="button"
          onClick={() => openSignIn(nextPath)}
          className="mt-6 inline-flex w-full items-center justify-center rounded-full bg-primary px-5 py-3 text-sm font-bold text-primary-foreground shadow-sm transition hover:bg-primary-dark"
        >
          Sign in with Google →
        </button>
        <Link
          to="/"
          className="mt-3 inline-block text-xs font-semibold text-muted-foreground underline underline-offset-2 hover:text-foreground"
        >
          Go home
        </Link>
      </div>
    </div>
  );
}
