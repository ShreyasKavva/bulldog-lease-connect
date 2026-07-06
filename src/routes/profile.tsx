/**
 * /profile — the current user's first-class profile page.
 * Public view lives at /profile/$userId. Both routes render ProfileView.
 */
import { createFileRoute, Link } from "@tanstack/react-router";
import { useSession, useMyProfile } from "@/lib/leaseup/use-session";
import { ProfileView } from "@/components/leaseup/ProfileView";
import { Button } from "@/components/ui/button";
import { openSignIn } from "@/components/leaseup/SignInModal";
import { GraduationCap } from "lucide-react";

export const Route = createFileRoute("/profile")({
  head: () => ({
    meta: [
      { title: "Your profile — LeaseUp" },
      { name: "description", content: "Manage your LeaseUp profile, listings, and vibe." },
    ],
  }),
  component: ProfilePage,
});

function ProfilePage() {
  const { user, loading } = useSession();
  const { data: profile } = useMyProfile();

  if (loading) return <div className="min-h-screen bg-background" />;

  if (!user) {
    return (
      <div className="min-h-screen bg-background">
        <main className="mx-auto max-w-md px-4 pt-24 text-center">
          <div className="text-5xl">👤</div>
          <h1 className="mt-4 text-2xl font-extrabold">Your Profile</h1>
          <p className="mt-2 text-sm text-muted-foreground">
            Sign in to manage your listings, see your matches, and build your LeaseUp profile.
          </p>
          <Button
            onClick={() => openSignIn("/profile")}
            className="mt-6 bg-primary hover:bg-primary-dark text-primary-foreground font-bold rounded-full px-6"
          >
            Sign in →
          </Button>
          <div className="mt-6 text-xs text-muted-foreground">
            New here? <button type="button" onClick={() => openSignIn("/profile")} className="font-semibold text-primary">Create account</button>
          </div>
        </main>
      </div>
    );
  }

  const needsCampus = !!profile && !profile.campus_id;

  return (
    <>
      {needsCampus && (
        <div className="mx-auto mt-3 max-w-3xl px-4">
          <div className="flex flex-wrap items-center justify-between gap-3 rounded-2xl border border-primary/30 bg-primary-light/60 px-4 py-3 text-sm">
            <div className="flex items-center gap-2">
              <GraduationCap className="h-4 w-4 text-primary-dark" />
              <span className="font-semibold text-primary-dark">
                You haven't set your campus yet.
              </span>
            </div>
            <Link
              to="/onboarding"
              className="rounded-full bg-primary px-3.5 py-1.5 text-xs font-bold text-primary-foreground hover:bg-primary-dark"
            >
              Set it now →
            </Link>
          </div>
        </div>
      )}
      <ProfileView userId={user.id} />
    </>
  );
}
