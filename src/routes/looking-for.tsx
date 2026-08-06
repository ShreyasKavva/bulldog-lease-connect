// Q103: the Looking For board moved to /looking. Old links and bookmarks are
// permanently redirected so there is only ever one board.
import { createFileRoute, redirect } from "@tanstack/react-router";

export const Route = createFileRoute("/looking-for")({
  beforeLoad: () => {
    throw redirect({ to: "/looking", statusCode: 301 });
  },
  component: () => null,
});
