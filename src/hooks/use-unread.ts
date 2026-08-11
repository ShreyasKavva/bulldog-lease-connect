import { useEffect, useId, useRef } from "react";
import { useQuery, useQueryClient } from "@tanstack/react-query";
import { supabase } from "@/integrations/supabase/client";
import { useSession } from "@/lib/leaseup/use-session";

let chanSeq = 0;

export function useUnreadCount() {
  const { user } = useSession();
  const qc = useQueryClient();
  const prev = useRef(0);
  // Unique per hook instance: several components mount this hook at once and
  // Supabase throws if two subscribers share one channel name.
  const channelId = useId();

  const q = useQuery({
    queryKey: ["unread", user?.id],
    queryFn: async () => {
      const { count } = await supabase
        .from("messages")
        .select("id", { count: "exact", head: true })
        .eq("recipient_id", user!.id)
        .is("read_at", null);
      return count ?? 0;
    },
    enabled: !!user?.id,
  });

  // Tab title + pulse signal
  useEffect(() => {
    const count = q.data ?? 0;
    if (typeof document !== "undefined") {
      const base = document.title.replace(/^\(\d+\+?\)\s*/, "") || "LeaseUp";
      document.title = count > 0 ? `(${count > 99 ? "99+" : count}) ${base}` : base;
    }
    if (count > prev.current && typeof window !== "undefined") {
      window.dispatchEvent(new CustomEvent("leaseup:unread-pulse"));
    }
    prev.current = count;
  }, [q.data]);

  useEffect(() => {
    if (!user?.id) return;
    const ch = supabase
      .channel(`unread:${user.id}:${channelId}:${++chanSeq}`)
      .on(
        "postgres_changes",
        { event: "*", schema: "public", table: "messages", filter: `recipient_id=eq.${user.id}` },
        () => qc.invalidateQueries({ queryKey: ["unread", user.id] }),
      )
      .subscribe();
    return () => { supabase.removeChannel(ch); };
  }, [user?.id, qc, channelId]);

  return q.data ?? 0;
}

export async function markConversationRead(conversationId: string, userId: string) {
  await supabase
    .from("messages")
    .update({ read: true, read_at: new Date().toISOString() })
    .eq("conversation_id", conversationId)
    .eq("recipient_id", userId)
    .is("read_at", null);
}
