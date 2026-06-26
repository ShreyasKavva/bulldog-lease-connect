import { useQuery, useMutation, useQueryClient } from "@tanstack/react-query";
import { supabase } from "@/integrations/supabase/client";
import { useSession } from "./use-session";

export type ReactionType = "fire" | "love" | "wow" | "pricey" | "suspicious";

export const REACTION_META: Record<ReactionType, { emoji: string; label: string }> = {
  fire:       { emoji: "🔥", label: "Great deal" },
  love:       { emoji: "😍", label: "Want this" },
  wow:        { emoji: "😮", label: "Wow" },
  pricey:     { emoji: "💸", label: "Too pricey" },
  suspicious: { emoji: "🤔", label: "Something's off" },
};

export const REACTION_ORDER: ReactionType[] = ["fire", "love", "wow", "pricey", "suspicious"];

export type ReactionSummary = {
  counts: Record<ReactionType, number>;
  mine: ReactionType | null;
};

export function useListingReactions(listingId: string | null | undefined) {
  const { user } = useSession();
  return useQuery({
    queryKey: ["listing-reactions", listingId],
    enabled: !!listingId,
    queryFn: async (): Promise<ReactionSummary> => {
      const { data, error } = await supabase
        .from("listing_reactions" as any)
        .select("reaction_type, user_id")
        .eq("listing_id", listingId!);
      if (error) throw error;
      const counts: Record<ReactionType, number> = {
        fire: 0, love: 0, wow: 0, pricey: 0, suspicious: 0,
      };
      let mine: ReactionType | null = null;
      for (const row of (data ?? []) as Array<{ reaction_type: ReactionType; user_id: string }>) {
        counts[row.reaction_type] = (counts[row.reaction_type] ?? 0) + 1;
        if (user && row.user_id === user.id) mine = row.reaction_type;
      }
      return { counts, mine };
    },
  });
}

export function useToggleReaction(listingId: string) {
  const qc = useQueryClient();
  const { user } = useSession();
  return useMutation({
    mutationFn: async (reaction: ReactionType) => {
      if (!user) throw new Error("Sign in to react");
      // Read current
      const { data: existing } = await supabase
        .from("listing_reactions" as any)
        .select("reaction_type")
        .eq("listing_id", listingId)
        .eq("user_id", user.id)
        .maybeSingle();
      const current = (existing as any)?.reaction_type as ReactionType | undefined;
      if (current === reaction) {
        await supabase
          .from("listing_reactions" as any)
          .delete()
          .eq("listing_id", listingId)
          .eq("user_id", user.id);
        return null;
      }
      const { error } = await supabase
        .from("listing_reactions" as any)
        .upsert(
          { listing_id: listingId, user_id: user.id, reaction_type: reaction },
          { onConflict: "listing_id,user_id" },
        );
      if (error) throw error;
      return reaction;
    },
    onSuccess: () => {
      qc.invalidateQueries({ queryKey: ["listing-reactions", listingId] });
    },
  });
}
