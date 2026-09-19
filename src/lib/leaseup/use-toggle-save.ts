/**
 * Q181 — one shared optimistic save toggle.
 *
 * Every heart in the app routes through this so behaviour can't drift:
 *  - the ["saved", userId] cache flips immediately (feels instant)
 *  - the DB write happens in the background
 *  - failures roll the cache back and toast
 *  - rapid double-clicks on the same listing are guarded, so two conflicting
 *    writes can never race
 *  - the browse/listing queries are NEVER invalidated, so nothing refetches
 */
import { useCallback } from "react";
import { useQueryClient } from "@tanstack/react-query";
import { toast } from "sonner";
import { toggleSaved } from "./queries";

const savesInFlight = new Set<string>();

export function useToggleSave(userId: string | undefined) {
  const qc = useQueryClient();

  return useCallback(
    async (listingId: string) => {
      if (!userId) return null;
      const requestKey = `${userId}:${listingId}`;
      if (savesInFlight.has(requestKey)) return null;

      const key = ["saved", userId];
      const prev = qc.getQueryData<Set<string>>(key);
      const wasSaved = !!prev?.has(listingId);

      // Optimistic flip — before any network work.
      const next = new Set(prev ?? []);
      if (wasSaved) next.delete(listingId);
      else next.add(listingId);
      qc.setQueryData(key, next);

      savesInFlight.add(requestKey);
      try {
        await toggleSaved(userId, listingId, wasSaved);
        return wasSaved ? "unsaved" as const : "saved" as const;
      } catch {
        qc.setQueryData(key, prev ?? new Set<string>());
        toast.error("Couldn't save — try again");
        return null;
      } finally {
        savesInFlight.delete(requestKey);
      }
    },
    [qc, userId],
  );
}
