import { useEffect } from "react";
import { useQuery, useQueryClient } from "@tanstack/react-query";
import { supabase } from "@/integrations/supabase/client";
import { useSession } from "@/lib/leaseup/use-session";

export type UnreadMessagePreview = {
  id: string;
  sender_id: string;
  created_at: string;
  senderName: string;
};

/**
 * Q153 — the 8 most recent unread messages for the notification bell popover.
 * Shares the same realtime channel shape as useUnreadCount so both stay live.
 */
export function useUnreadMessages() {
  const { user } = useSession();
  const qc = useQueryClient();

  const q = useQuery({
    queryKey: ["unread-messages", user?.id],
    enabled: !!user?.id,
    queryFn: async (): Promise<UnreadMessagePreview[]> => {
      const { data: msgs } = await supabase
        .from("messages")
        .select("id, sender_id, created_at")
        .eq("recipient_id", user!.id)
        .is("read_at", null)
        .order("created_at", { ascending: false })
        .limit(8);
      const rows = msgs ?? [];
      if (!rows.length) return [];
      const ids = Array.from(new Set(rows.map((m) => m.sender_id)));
      const { data: profs } = await supabase
        .from("profiles_public")
        .select("id, name")
        .in("id", ids);
      const nameById = new Map((profs ?? []).map((p: any) => [p.id, p.name as string]));
      return rows.map((m) => ({
        id: m.id,
        sender_id: m.sender_id,
        created_at: m.created_at,
        senderName: nameById.get(m.sender_id) || "A student",
      }));
    },
  });

  useEffect(() => {
    if (!user?.id) return;
    const ch = supabase
      .channel(`unread-msgs:${user.id}`)
      .on(
        "postgres_changes",
        { event: "*", schema: "public", table: "messages", filter: `recipient_id=eq.${user.id}` },
        () => qc.invalidateQueries({ queryKey: ["unread-messages", user.id] }),
      )
      .subscribe();
    return () => {
      supabase.removeChannel(ch);
    };
  }, [user?.id, qc]);

  return q.data ?? [];
}

/** Marks the given message rows read so the red badge clears. */
export async function markMessagesRead(ids: string[], userId: string) {
  if (!ids.length) return;
  await supabase
    .from("messages")
    .update({ read: true, read_at: new Date().toISOString() })
    .in("id", ids)
    .eq("recipient_id", userId)
    .is("read_at", null);
}
