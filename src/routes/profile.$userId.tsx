/**
 * /profile/$userId — public profile view for any user.
 */
import { createFileRoute } from "@tanstack/react-router";
import { HostProfile } from "@/components/leaseup/HostProfile";
import { supabase } from "@/integrations/supabase/client";


function maskName(name: string | null | undefined): string {
  if (!name) return "Student";
  const parts = name.trim().split(/\s+/);
  const first = parts[0] ?? "Student";
  const last = parts[1];
  return last ? `${first} ${last[0].toUpperCase()}.` : first;
}

const CAMPUS_ABBREV: Record<string, string> = {
  "University of Georgia": "UGA",
  "Auburn University": "Auburn",
  "University of Florida": "UF",
  "Georgia Tech": "GT",
  "Georgia Institute of Technology": "GT",
  "University of Virginia": "UVA",
  "Georgia Institute of Technology": "GT",
  "University of Alabama": "Alabama",
};

export const Route = createFileRoute("/profile/$userId")({
  loader: async ({ params }) => {
    try {
      const { data } = await supabase.rpc("get_public_profile", { _uid: params.userId });
      const p = (data as any) ?? null;
      const displayName = maskName(p?.name);
      const campusName: string | null = p?.campus_name ?? null;
      const campusAbbrev = campusName ? (CAMPUS_ABBREV[campusName] ?? campusName.split(/\s+/)[0]) : null;
      return { displayName, campusName, campusAbbrev };
    } catch {
      return { displayName: "Student", campusName: null, campusAbbrev: null };
    }
  },
  head: ({ loaderData }) => {
    const name = loaderData?.displayName ?? "Student";
    const campus = loaderData?.campusName ?? "campus";
    const campusAbbrev = loaderData?.campusAbbrev ?? "";
    const title = campusAbbrev
      ? `${name} — Verified ${campusAbbrev} Student | LeaseUp`
      : `${name} — Student on LeaseUp`;
    const description = `View ${name}'s subleases and roommate profile at ${campus} on LeaseUp.`;
    return {
      meta: [
        { title },
        { name: "description", content: description },
        { name: "robots", content: "noindex" },
        { property: "og:title", content: title },
        { property: "og:description", content: description },
        { property: "og:type", content: "profile" },
      ],
    };
  },
  component: PublicProfilePage,
});

function PublicProfilePage() {
  const { userId } = Route.useParams();
  return <HostProfile userId={userId} />;
}
