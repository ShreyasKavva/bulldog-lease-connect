import { useEffect } from "react";
import {
  useQuery,
  useQueryClient,
  useMutation,
  useInfiniteQuery,
} from "@tanstack/react-query";
import { supabase } from "@/integrations/supabase/client";
import { useSession } from "@/lib/leaseup/use-session";

export type Notification = {
  id: string;
  user_id: string;
  type: string;
  title: string;
  body: string | null;
  link: string | null;
  data: Record<string, unknown>;
  read: boolean;
  created_at: string;
};

const PAGE_SIZE = 20;

/** Recent (latest 30) notifications, used in the bell dropdown. */
export function useNotifications() {
  const { user } = useSession();
  const qc = useQueryClient();

  const q = useQuery({
    queryKey: ["notifications", user?.id],
    queryFn: async (): Promise<Notification[]> => {
      const { data, error } = await supabase
        .from("notifications")
        .select("*")
        .eq("user_id", user!.id)
        .order("created_at", { ascending: false })
        .limit(30);
      if (error) throw error;
      return (data ?? []) as Notification[];
    },
    enabled: !!user?.id,
  });

  useEffect(() => {
    if (!user?.id) return;
    const ch = supabase
      .channel(`notifications:${user.id}`)
      .on(
        "postgres_changes",
        { event: "*", schema: "public", table: "notifications", filter: `user_id=eq.${user.id}` },
        () => {
          qc.invalidateQueries({ queryKey: ["notifications", user.id] });
          qc.invalidateQueries({ queryKey: ["notifications-page", user.id] });
        },
      )
      .subscribe();
    return () => {
      supabase.removeChannel(ch);
    };
  }, [user?.id, qc]);

  return q;
}

/** Infinite scroll feed for /notifications full page. */
export function useNotificationsPage() {
  const { user } = useSession();
  return useInfiniteQuery({
    queryKey: ["notifications-page", user?.id],
    enabled: !!user?.id,
    initialPageParam: 0,
    queryFn: async ({ pageParam }) => {
      const from = (pageParam as number) * PAGE_SIZE;
      const to = from + PAGE_SIZE - 1;
      const { data, error } = await supabase
        .from("notifications")
        .select("*")
        .eq("user_id", user!.id)
        .order("created_at", { ascending: false })
        .range(from, to);
      if (error) throw error;
      return (data ?? []) as Notification[];
    },
    getNextPageParam: (last, pages) =>
      last.length < PAGE_SIZE ? undefined : pages.length,
  });
}

export function useMarkNotificationRead() {
  const { user } = useSession();
  const qc = useQueryClient();
  return useMutation({
    mutationFn: async (id: string) => {
      const { error } = await supabase
        .from("notifications")
        .update({ read: true })
        .eq("id", id)
        .eq("user_id", user!.id);
      if (error) throw error;
    },
    onSuccess: () => {
      qc.invalidateQueries({ queryKey: ["notifications", user?.id] });
      qc.invalidateQueries({ queryKey: ["notifications-page", user?.id] });
    },
  });
}

export function useMarkAllNotificationsRead() {
  const { user } = useSession();
  const qc = useQueryClient();
  return useMutation({
    mutationFn: async () => {
      const { error } = await supabase
        .from("notifications")
        .update({ read: true })
        .eq("user_id", user!.id)
        .eq("read", false);
      if (error) throw error;
    },
    onSuccess: () => {
      qc.invalidateQueries({ queryKey: ["notifications", user?.id] });
      qc.invalidateQueries({ queryKey: ["notifications-page", user?.id] });
    },
  });
}

export function useDeleteNotification() {
  const { user } = useSession();
  const qc = useQueryClient();
  return useMutation({
    mutationFn: async (id: string) => {
      const { error } = await supabase
        .from("notifications")
        .delete()
        .eq("id", id)
        .eq("user_id", user!.id);
      if (error) throw error;
    },
    onSuccess: () => {
      qc.invalidateQueries({ queryKey: ["notifications", user?.id] });
      qc.invalidateQueries({ queryKey: ["notifications-page", user?.id] });
    },
  });
}

type Prefs = {
  new_message: boolean;
  listing_match: boolean;
  price_drop: boolean;
  listing_saved: boolean;
  view_milestone: boolean;
  new_review?: boolean;
  looking_for_interest?: boolean;
  lease_expiring?: boolean;
};

const DEFAULT_PREFS: Prefs = {
  new_message: true,
  listing_match: true,
  price_drop: true,
  listing_saved: true,
  view_milestone: false,
  new_review: true,
  looking_for_interest: true,
  lease_expiring: true,
};

export function useNotificationPreferences() {
  const { user } = useSession();
  const qc = useQueryClient();

  const q = useQuery({
    queryKey: ["notification-prefs", user?.id],
    enabled: !!user?.id,
    queryFn: async (): Promise<Prefs> => {
      const { data, error } = await supabase
        .from("profiles")
        .select("notification_preferences")
        .eq("id", user!.id)
        .maybeSingle();
      if (error) throw error;
      return { ...DEFAULT_PREFS, ...((data?.notification_preferences as Partial<Prefs>) ?? {}) };
    },
  });

  const update = useMutation({
    mutationFn: async (patch: Partial<Prefs>) => {
      const current = q.data ?? DEFAULT_PREFS;
      const next = { ...current, ...patch };
      const { error } = await supabase
        .from("profiles")
        .update({ notification_preferences: next })
        .eq("id", user!.id);
      if (error) throw error;
      return next;
    },
    onSuccess: (next) => {
      qc.setQueryData(["notification-prefs", user?.id], next);
    },
  });

  return { ...q, update };
}
