import { createFileRoute, useNavigate } from "@tanstack/react-router";
import { useEffect, useState } from "react";
import { supabase } from "@/integrations/supabase/client";
import { useSession } from "@/lib/leaseup/use-session";
import { MessagesSheet } from "@/components/leaseup/MessagesSheet";
import { getOrCreateConversation } from "@/lib/leaseup/queries";
import { openSignIn } from "@/components/leaseup/SignInModal";
import { toast } from "sonner";

export const Route = createFileRoute("/messages/$listingId")({
  head: () => ({
    meta: [
      { title: "Message — LeaseUp" },
      { name: "robots", content: "noindex" },
    ],
  }),
  component: MessageThreadPage,
});

function MessageThreadPage() {
  const { listingId } = Route.useParams();
  const { user, loading } = useSession();
  const navigate = useNavigate();
  const [convId, setConvId] = useState<string | null>(null);
  const [open, setOpen] = useState(true);

  useEffect(() => {
    if (loading) return;
    if (!user) {
      openSignIn(`/messages/${listingId}`);
      navigate({ to: "/" });
      return;
    }
    let cancelled = false;
    (async () => {
      const { data: listing, error } = await supabase
        .from("listings")
        .select("id, user_id, title")
        .eq("id", listingId)
        .maybeSingle();
      if (cancelled) return;
      if (error || !listing) {
        toast.error("Listing not found");
        navigate({ to: "/" });
        return;
      }
      if (listing.user_id === user.id) {
        // Can't message yourself — open inbox instead.
        navigate({ to: "/messages" });
        return;
      }
      try {
        const id = await getOrCreateConversation(user.id, listing.user_id, listing.id);
        if (!cancelled) setConvId(id);
      } catch {
        toast.error("Couldn't open conversation");
        navigate({ to: "/" });
      }
    })();
    return () => { cancelled = true; };
  }, [loading, user, listingId, navigate]);

  if (!user || !convId) return <div className="min-h-[60vh]" />;

  return (
    <div className="min-h-[60vh]">
      <MessagesSheet
        open={open}
        onOpenChange={(o) => {
          setOpen(o);
          if (!o) navigate({ to: "/" });
        }}
        initialConversationId={convId}
      />
    </div>
  );
}
