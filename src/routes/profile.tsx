/**
 * /profile — the current user's first-class profile page.
 * Public view lives at /profile/$userId. Both routes render ProfileView.
 */
import { createFileRoute } from "@tanstack/react-router";
import { useSession } from "@/lib/leaseup/use-session";
import { ProfileView } from "@/components/leaseup/ProfileView";
import { Button } from "@/components/ui/button";
import { openSignIn } from "@/components/leaseup/SignInModal";

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
  const navigate = useNavigate();
  const { user, loading } = useSession();

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

  return <ProfileView userId={user.id} />;
}
