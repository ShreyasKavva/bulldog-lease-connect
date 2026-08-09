// Q78: Dead route cleanup. The lease-analysis experience is no longer surfaced
// in the product; anyone hitting a bookmarked / shared URL is 301'd to /browse
// with a notice that the destination page picks up and toasts.
import { createFileRoute, redirect } from "@tanstack/react-router";

export const Route = createFileRoute("/lease-analysis")({
  beforeLoad: () => {
    throw redirect({
      to: "/browse",
      search: { notice: "lease-analysis-gone" } as any,
      statusCode: 301,
    });
  },
  component: () => null,
});
