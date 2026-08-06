import { createFileRoute, useNavigate } from "@tanstack/react-router";
import { useEffect, useState } from "react";
import { supabase } from "@/integrations/supabase/client";
import { useSession } from "@/lib/leaseup/use-session";
import { getOrCreateConversation } from "@/lib/leaseup/queries";
import { TopBar } from "@/components/leaseup/TopBar";
import { Inbox } from "@/components/leaseup/Inbox";
import { SignInGate } from "@/components/leaseup/SignInGate";
import { toast } from "sonner";

export const Route = createFileRoute("/messages/$conversationId")({
  head: () => ({
    meta: [
      { title: "Message — LeaseUp" },
      { name: "description", content: "Chat with verified students about a LeaseUp sublease." },
      { name: "robots", content: "noindex" },
    ],
  }),
  component: ThreadPage,
});

function ThreadPage() {
  const { conversationId } = Route.useParams();
  const { user, loading } = useSession();
  const navigate = useNavigate();
  const [resolved, setResolved] = useState<string | null>(null);

  // The param is normally a conversation id. Legacy links (and the old
  // /messages/[listingId] shape) pass a listing id — resolve those into a
  // conversation with the host and swap the URL.
  useEffect(() => {
    if (loading || !user) return;
    let cancelled = false;
    (async () => {
      const { data: conv } = await supabase
        .from("conversations")
        .select("id")
        .eq("id", conversationId)
        .maybeSingle();
      if (cancelled) return;
      if (conv) { setResolved(conv.id); return; }

      const { data: listing } = await supabase
        .from("listings")
        .select("id,user_id")
        .eq("id", conversationId)
        .maybeSingle();
      if (cancelled) return;
      if (!listing) { toast.error("Conversation not found"); navigate({ to: "/messages" }); return; }
      if (listing.user_id === user.id) { navigate({ to: "/messages" }); return; }
      try {
        const id = await getOrCreateConversation(user.id, listing.user_id, listing.id);
        if (!cancelled) navigate({ to: "/messages/$conversationId", params: { conversationId: id }, replace: true });
      } catch {
        toast.error("Couldn't open conversation");
        navigate({ to: "/messages" });
      }
    })();
    return () => { cancelled = true; };
  }, [conversationId, user, loading, navigate]);

  if (loading) return <div className="min-h-[60vh]" />;
  if (!user) {
    return (
      <SignInGate
        title="Sign in to see your messages"
        body="You need to sign in to open this conversation."
        next={`/messages/${conversationId}`}
      />
    );
  }

  return (
    <div className="min-h-screen bg-background">
      <TopBar />
      <Inbox conversationId={resolved} />
    </div>
  );
}
