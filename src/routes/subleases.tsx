import { createFileRoute, redirect } from "@tanstack/react-router";

// /subleases is a legacy URL advertised in the sitemap and old external links.
// Permanent redirect to /browse, preserving the query string
// (e.g. /subleases?campus=georgia-tech -> /browse?campus=georgia-tech).
// Thrown in the loader, so it resolves as a server-side redirect during SSR —
// no 404 flash.
export const Route = createFileRoute("/subleases")({
  loader: () => {
    throw redirect({ to: "/browse", search: true });
  },
});
