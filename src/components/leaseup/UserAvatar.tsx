/**
 * Q266 — one avatar for every person in the app.
 *
 * Order of preference:
 *   1. the photo the student uploaded (stored as a path in the private
 *      "avatars" bucket, signed here and cached by react-query), or an
 *      absolute URL when the profile already holds one;
 *   2. a Gmail-style initial on a colour derived from their name.
 *
 * Emoji avatars are no longer rendered anywhere for people. Campus / school
 * marks are a separate component and are untouched.
 */
import { useQuery } from "@tanstack/react-query";
import { supabase } from "@/integrations/supabase/client";
import { cn } from "@/lib/utils";

const LETTER_COLORS = [
  "#2563EB", "#7C3AED", "#DB2777", "#DC2626", "#EA580C",
  "#CA8A04", "#16A34A", "#0891B2", "#4F46E5", "#9333EA",
];

/** Stable per-name colour so the same student always gets the same tile. */
export function avatarColorFor(name?: string | null): string {
  const s = (name ?? "").trim();
  if (!s) return LETTER_COLORS[0];
  let h = 0;
  for (let i = 0; i < s.length; i++) h = (h * 31 + s.charCodeAt(i)) >>> 0;
  return LETTER_COLORS[h % LETTER_COLORS.length];
}

/** First letter/number of a name, Gmail style. Empty when there's nothing usable. */
export function avatarInitial(name?: string | null): string {
  const ch = (name ?? "").trim().replace(/^[^\p{L}\p{N}]+/u, "")[0];
  return ch ? ch.toUpperCase() : "";
}

/** Signed URL for an avatar path (or the URL itself when it's already absolute). */
export function useAvatarUrl(path?: string | null) {
  return useQuery({
    queryKey: ["avatar-url", path],
    queryFn: async () => {
      if (!path) return null;
      if (path.startsWith("http")) return path;
      const { data } = await supabase.storage.from("avatars").createSignedUrl(path, 60 * 60 * 24 * 7);
      return data?.signedUrl ?? null;
    },
    enabled: !!path,
    staleTime: 60 * 60 * 1000,
  });
}

export type UserAvatarProps = {
  name?: string | null;
  /** Storage path or absolute URL from profiles.avatar_url. */
  avatarUrl?: string | null;
  /** Falls back to a stable colour derived from the name. */
  color?: string | null;
  /** Size + shape utilities, e.g. "h-12 w-12". */
  className?: string;
  /** Font-size utility for the initial, e.g. "text-lg". */
  textClassName?: string;
  style?: React.CSSProperties;
};

export function UserAvatar({
  name,
  avatarUrl,
  color,
  className,
  textClassName,
  style,
}: UserAvatarProps) {
  const { data: url } = useAvatarUrl(avatarUrl);
  const letter = avatarInitial(name);
  // "#2563EB" is the app-wide default banner colour — i.e. a colour the
  // student never actually picked — so fall back to the per-name colour and
  // avoid a wall of identical blue tiles.

  if (url) {
    return (
      <img
        src={url}
        alt={name ? `${name}'s profile photo` : "Profile photo"}
        className={cn("shrink-0 rounded-full object-cover", className)}
        style={style}
      />
    );
  }

  return (
    <span
      className={cn(
        "grid shrink-0 select-none place-items-center rounded-full font-bold uppercase leading-none text-white",
        textClassName,
        className,
      )}
      style={{
        background: color && color.toLowerCase() !== "#2563eb" ? color : avatarColorFor(name),
        ...style,
      }}
      aria-hidden
    >
      {letter || (
        <svg viewBox="0 0 24 24" fill="none" className="h-1/2 w-1/2" stroke="currentColor" strokeWidth={2}>
          <circle cx="12" cy="8" r="4" />
          <path d="M4 21c0-4 3.6-6 8-6s8 2 8 6" strokeLinecap="round" />
        </svg>
      )}
    </span>
  );
}
