/**
 * /profile/$userId — public profile view for any user.
 */
import { createFileRoute } from "@tanstack/react-router";
import { ProfileView } from "@/components/leaseup/ProfileView";

export const Route = createFileRoute("/profile/$userId")({
  head: () => ({
    meta: [
      { title: "Profile — LeaseUp" },
      { name: "description", content: "Student profile on LeaseUp." },
    ],
  }),
  component: PublicProfilePage,
});

function PublicProfilePage() {
  const { userId } = Route.useParams();
  return <ProfileView userId={userId} />;
}
