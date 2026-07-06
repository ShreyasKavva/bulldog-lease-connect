// Q78: Dead route cleanup. The "Find my match" quiz is retired; keep the URL
// alive with a 301 to /roommates so shared/bookmarked links land somewhere
// useful, plus a toast surfaced by the destination page.
import { createFileRoute, redirect } from "@tanstack/react-router";

export const Route = createFileRoute("/find-my-match")({
  beforeLoad: () => {
    throw redirect({
      to: "/roommates",
      search: { notice: "find-my-match-gone" },
      statusCode: 301,
    });
  },
  component: () => null,
});
