import { createFileRoute, useNavigate, Link } from "@tanstack/react-router";
import { useEffect, useState } from "react";
import { supabase } from "@/integrations/supabase/client";
import { useSession } from "@/lib/leaseup/use-session";
import { getOrCreateConversation } from "@/lib/leaseup/queries";
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
  const [notFound, setNotFound] = useState(false);

  // The param is normally a conversation id. Legacy links (and the old
  // /messages/[listingId] shape) pass a listing id — resolve those into a
  // conversation with the host and swap the URL.
  useEffect(() => {
    if (loading || !user) return;
    let cancelled = false;
    setNotFound(false);
    (async () => {
      const { data: conv } = await supabase
        .from("conversations")
        .select("id,participant_1_id,participant_2_id")
        .eq("id", conversationId)
        .maybeSingle();
      if (cancelled) return;
      if (conv) {
        // Only participants may open a thread.
        if (conv.participant_1_id !== user.id && conv.participant_2_id !== user.id) {
          setNotFound(true);
          return;
        }
        setResolved(conv.id);
        return;
      }

      const { data: listing } = await supabase
        .from("listings")
        .select("id,user_id")
        .eq("id", conversationId)
        .maybeSingle();
      if (cancelled) return;
      if (!listing) { setNotFound(true); return; }
      if (listing.user_id === user.id) { navigate({ to: "/messages" }); return; }
      try {
        const id = await getOrCreateConversation(user.id, listing.user_id, listing.id);
        if (!cancelled) navigate({ to: "/messages/$conversationId", params: { conversationId: id }, replace: true });
      } catch {
        toast.error("Couldn't open conversation");
        if (!cancelled) setNotFound(true);
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

  if (notFound) {
    return (
      <div className="min-h-screen bg-background">
        <div className="mx-auto max-w-md px-6 py-24 text-center">
          <h1 className="text-lg font-semibold text-gray-900 dark:text-foreground">Conversation not found</h1>
          <p className="mt-1 text-sm text-gray-500">
            This conversation doesn't exist, or you're not part of it.
          </p>
          <Link to="/messages" className="mt-4 inline-block text-sm text-[#FF5A5F] hover:underline">
            ← Back to inbox
          </Link>
        </div>
      </div>
    );
  }

  return (
    <div className="min-h-screen bg-background">
      <Inbox conversationId={resolved} />
    </div>
  );
}
