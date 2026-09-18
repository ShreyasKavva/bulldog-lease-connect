/**
 * /profile — the current user's first-class profile page.
 * Public view lives at /profile/$userId. Both routes render ProfileView.
 */
import { createFileRoute, Link } from "@tanstack/react-router";
import { useSession, useMyProfile } from "@/lib/leaseup/use-session";
import { ProfileView } from "@/components/leaseup/ProfileView";
import { Button } from "@/components/ui/button";
import { SignInGate } from "@/components/leaseup/SignInGate";
import { GraduationCap } from "lucide-react";

export const Route = createFileRoute("/profile/")({
  head: () => ({
    meta: [
      { title: "Your profile — LeaseUp" },
      { name: "description", content: "Manage your LeaseUp profile, listings, and vibe." },
      { name: "robots", content: "noindex" },
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
      <SignInGate
        title="Sign in to view your profile"
        body="Sign in to manage your listings, track your saved subleases, and build your LeaseUp profile."
        next="/profile"
      />
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
