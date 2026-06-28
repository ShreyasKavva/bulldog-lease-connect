import type { Profile } from "./types";

export type CompletionInput = {
  profile: Profile | null | undefined;
  hasListingOrLooking: boolean;
};

/** Profile completion score 0-100, per spec breakdown. */
export function computeProfileCompletion({ profile, hasListingOrLooking }: CompletionInput): number {
  if (!profile) return 0;
  let pct = 0;
  if (profile.name && profile.name.trim().length > 0) pct += 20;
  if (profile.avatar_emoji && profile.avatar_emoji !== "🙂") pct += 10;
  if (profile.year) pct += 15;
  if (profile.bio && profile.bio.trim().length > 0) pct += 20;
  if ((profile.vibe_tags?.length ?? 0) >= 1) pct += 15;
  if (hasListingOrLooking) pct += 20;
  return Math.min(pct, 100);
}
