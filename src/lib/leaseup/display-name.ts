/**
 * Q177-FIX — single source of truth for a listing's poster byline.
 *
 * Every surface that shows "posted by X" must call posterName() so the demo
 * placeholder account ("LeaseUp Demo") can never leak into user-facing output
 * again. Seeded listings carry a realistic display_name (Q175); real listings
 * fall back to the profile name, then the email handle, then "Student".
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
    clean(listing?.profile?.email?.split("@")[0]) ??
    fallback
  );
}

/** First name only ("Marcus T." -> "Marcus"). */
export function posterFirstName(listing?: PosterLike | null, fallback = "Student"): string {
  return posterName(listing, fallback).split(" ")[0];
}

/** For raw profile records (no listing wrapper). */
export function profileDisplayName(
  profile?: { name?: string | null; email?: string | null; display_name?: string | null } | null,
  fallback = "Student",
): string {
  return (
    clean(profile?.display_name) ??
    clean(profile?.name) ??
    clean(profile?.email?.split("@")[0]) ??
    fallback
  );
}
