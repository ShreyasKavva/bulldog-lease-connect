import { createFileRoute } from "@tanstack/react-router";
import { useSession } from "@/lib/leaseup/use-session";
import { BottomNav } from "@/components/leaseup/BottomNav";
import { Inbox } from "@/components/leaseup/Inbox";
import { SignInGate } from "@/components/leaseup/SignInGate";

export const Route = createFileRoute("/messages/")({
  head: () => ({
    meta: [
      { title: "Messages — LeaseUp" },
      { name: "description", content: "Your LeaseUp inbox — chat with verified students about subleases." },
      { name: "robots", content: "noindex" },
    ],
  }),
  component: MessagesInboxPage,
});

function MessagesInboxPage() {
  const { user, loading } = useSession();

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
    <div className="min-h-screen bg-background pb-16 md:pb-0">
      <Inbox conversationId={null} />
      <BottomNav />
    </div>
  );
}
