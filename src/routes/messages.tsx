import { createFileRoute, useNavigate } from "@tanstack/react-router";
import { useState } from "react";
import { useSession } from "@/lib/leaseup/use-session";
import { MessagesSheet } from "@/components/leaseup/MessagesSheet";
import { SignInGate } from "@/components/leaseup/SignInGate";

export const Route = createFileRoute("/messages")({
  head: () => ({
    meta: [
      { title: "Messages — LeaseUp" },
      { name: "description", content: "Your LeaseUp inbox — chat with verified students about subleases." },
      { name: "robots", content: "noindex" },
    ],
  }),
  validateSearch: (s: Record<string, unknown>) => ({
    conversation: typeof s.conversation === "string" ? s.conversation : undefined,
  }),
  component: MessagesInboxPage,
});

function MessagesInboxPage() {
  const { user, loading } = useSession();
  const navigate = useNavigate();
  const search = Route.useSearch();
  const [open, setOpen] = useState(true);

  if (loading) return <div className="min-h-[60vh]" />;
  if (!user) {
    return (
      <SignInGate
        title="Sign in to see your messages"
        body="You need to sign in to view your LeaseUp inbox."
        next="/messages"
      />
    );
  }

  return (
    <div className="min-h-[60vh]">
      <MessagesSheet
        open={open}
        onOpenChange={(o) => {
          setOpen(o);
          if (!o) navigate({ to: "/" });
        }}
        initialConversationId={search.conversation ?? null}
      />
    </div>
  );
}


