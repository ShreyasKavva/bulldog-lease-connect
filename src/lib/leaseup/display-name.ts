/**
 * Q177-FIX — single source of truth for a listing's poster byline.
 *
 * Every surface that shows "posted by X" must call posterName() so the demo
 * placeholder account ("LeaseUp Demo") can never leak into user-facing output
 * again. Seeded listings carry a realistic display_name (Q175); real listings
 * fall back to the profile name, then "Student" — never the email handle,
 * which would leak the local part of a real address.
 */
const BANNED = ["leaseup demo", "leasup demo", "demo account", "leaseup"];

function clean(value?: string | null): string | null {
  const v = value?.trim();
  if (!v) return null;
  return BANNED.includes(v.toLowerCase()) ? null : v;
}

export type PosterLike = {
  display_name?: string | null;
  profile?: { name?: string | null; email?: string | null } | null;
  host?: { display_name?: string | null; name?: string | null } | null;
};

/** Safe display name for a listing's poster. */
export function posterName(listing?: PosterLike | null, fallback = "Student"): string {
  return (
    clean(listing?.display_name) ??
    clean(listing?.host?.display_name) ??
    clean(listing?.profile?.name) ??
    clean(listing?.host?.name) ??
    fallback
  );
}

/** First name only ("Marcus T." -> "Marcus"). */
export function posterFirstName(listing?: PosterLike | null, fallback = "Student"): string {
  return posterName(listing, fallback).split(" ")[0];
}

/**
 * Q182-FIX — counterparty name for a conversation row/thread.
 *
 * Seeded listings are owned by the demo placeholder account, whose profile name
 * is banned above. Rather than showing a wall of identical "Student" rows we
 * fall back to the listing's poster display name ("Priya N."), which is the
 * same varied generator used for listing bylines. "Student" is now only used
 * when there is genuinely no name anywhere.
 */
export function conversationName(
  profile?: { name?: string | null; email?: string | null; display_name?: string | null } | null,
  listingDisplayName?: string | null,
  fallback = "Student",
): string {
  const fromProfile = profileDisplayName(profile, "");
  if (fromProfile) return fromProfile;
  return clean(listingDisplayName) ?? fallback;
}

/** For raw profile records (no listing wrapper). */
export function profileDisplayName(
  profile?: { name?: string | null; email?: string | null; display_name?: string | null } | null,
  fallback = "Student",
): string {
  return (
    clean(profile?.display_name) ??
    clean(profile?.name) ??
    fallback
  );
}
