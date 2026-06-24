import { useEffect } from "react";
import { useQuery, useQueryClient } from "@tanstack/react-query";
import { supabase } from "@/integrations/supabase/client";
import { useSession } from "@/lib/leaseup/use-session";

export function useUnreadCount() {
  const { user } = useSession();
  const qc = useQueryClient();

  const q = useQuery({
    queryKey: ["unread", user?.id],
    queryFn: async () => {
      const { count } = await supabase
        .from("messages")
        .select("id", { count: "exact", head: true })
        .eq("recipient_id", user!.id)
        .eq("read", false);
      return count ?? 0;
    },
    enabled: !!user?.id,
  });

  useEffect(() => {
    if (!user?.id) return;
    const ch = supabase
      .channel(`unread:${user.id}`)
      .on(
        "postgres_changes",
        { event: "*", schema: "public", table: "messages", filter: `recipient_id=eq.${user.id}` },
        () => qc.invalidateQueries({ queryKey: ["unread", user.id] }),
      )
      .subscribe();
    return () => { supabase.removeChannel(ch); };
  }, [user?.id, qc]);

  return q.data ?? 0;
}

export async function markConversationRead(conversationId: string, userId: string) {
  await supabase
    .from("messages")
    .update({ read: true })
    .eq("conversation_id", conversationId)
    .eq("recipient_id", userId)
    .eq("read", false);
}
