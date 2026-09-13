// Dead route cleanup. /campus/$slug was a near-duplicate of the canonical
// campus landing page at /sublease/$slug and showed different stats for the
// same school. Same pattern as /lease-analysis and /find-my-match: 301 to the
// canonical URL with a notice the destination page toasts.
import { createFileRoute, redirect } from "@tanstack/react-router";

export const Route = createFileRoute("/campus/$slug")({
  beforeLoad: ({ params }) => {
    throw redirect({
      to: "/sublease/$slug",
      params: { slug: params.slug },
      search: { notice: "campus-url-moved" } as any,
      statusCode: 301,
    });
  },
  component: () => null,
});
