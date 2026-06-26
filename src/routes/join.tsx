import { createFileRoute, useNavigate } from "@tanstack/react-router";
import { useEffect } from "react";
import { z } from "zod";

const search = z.object({ ref: z.string().optional().catch(undefined) });

export const Route = createFileRoute("/join")({
  validateSearch: (s) => search.parse(s),
  head: () => ({
    meta: [
      { title: "Join LeaseUp — verified student subleases" },
      { name: "description", content: "Sign up to browse and post verified student subleases on LeaseUp." },
    ],
  }),
  component: JoinPage,
});

function JoinPage() {
  const { ref } = Route.useSearch();
  const navigate = useNavigate();

  useEffect(() => {
    if (ref) {
      try { localStorage.setItem("lu_ref", ref.toUpperCase()); } catch {}
    }
    navigate({ to: "/auth", search: { mode: "up" }, replace: true });
  }, [ref, navigate]);

  return (
    <div className="min-h-screen grid place-items-center bg-background">
      <div className="text-sm text-muted-foreground">Sending you in…</div>
    </div>
  );
}
