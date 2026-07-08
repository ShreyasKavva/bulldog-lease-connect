import { useEffect, useRef } from "react";
import { toast } from "sonner";
import { useNavigate } from "@tanstack/react-router";
import { supabase } from "@/integrations/supabase/client";
import { useSession } from "@/lib/leaseup/use-session";
import { notificationMeta } from "@/lib/leaseup/notification-meta";
import type { Notification } from "@/hooks/use-notifications";

/**
 * Mounted once globally. Subscribes to inserts on `notifications` for the
 * current user and surfaces a top-of-screen toast for high-priority types.
 */
export function NotificationToastListener() {
  const { user } = useSession();
  const navigate = useNavigate();
  const navigateRef = useRef(navigate);
  navigateRef.current = navigate;
  const seen = useRef<Set<string>>(new Set());

  useEffect(() => {
    if (!user?.id) return;
    const ch = supabase.channel(`notif-toasts:${user.id}`);
    ch.on(
      "postgres_changes" as never,
      {
        event: "INSERT",
        schema: "public",
        table: "notifications",
        filter: `user_id=eq.${user.id}`,
      },
      (payload: { new: Notification }) => {
        const n = payload.new;
        if (!n?.id || seen.current.has(n.id)) return;
        seen.current.add(n.id);
        const meta = notificationMeta(n.type);
        if (meta.priority !== "high") return;

        toast(`${meta.emoji}  ${n.title}`, {
          description: n.body ?? undefined,
          duration: 4000,
          action: n.link
            ? {
                label: "Open",
                onClick: () => {
                  const [path, search] = n.link!.split("?");
                  void supabase.from("notifications").update({ read: true }).eq("id", n.id);
                  navigateRef.current({
                    to: path || "/",
                    search: search
                      ? Object.fromEntries(new URLSearchParams(search))
                      : {},
                  });
                },
              }
            : undefined,
        });
      },
    );
    ch.subscribe();
    return () => {
      void supabase.removeChannel(ch);
    };
  }, [user?.id]);

  return null;
}
