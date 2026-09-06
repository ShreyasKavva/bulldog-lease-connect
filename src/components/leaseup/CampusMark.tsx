/**
 * Q185 — one consistent campus mark for all ~3,900 campuses.
 *
 * No mascot emoji, no graduation-cap fallback: initials in a filled circle,
 * with the colour picked deterministically from a hash of the campus id
 * (falling back to the slug) so a campus always renders the same mark.
 */
import { cn } from "@/lib/utils";

const PALETTE = [
  { bg: "#1E3A8A", fg: "#FFFFFF" },
  { bg: "#2563EB", fg: "#FFFFFF" },
  { bg: "#0F766E", fg: "#FFFFFF" },
  { bg: "#047857", fg: "#FFFFFF" },
  { bg: "#B45309", fg: "#FFFFFF" },
  { bg: "#B91C1C", fg: "#FFFFFF" },
  { bg: "#9D174D", fg: "#FFFFFF" },
  { bg: "#6D28D9", fg: "#FFFFFF" },
  { bg: "#334155", fg: "#FFFFFF" },
  { bg: "#0E7490", fg: "#FFFFFF" },
];

function hash(s: string): number {
  let h = 0;
  for (let i = 0; i < s.length; i++) h = (h * 31 + s.charCodeAt(i)) >>> 0;
  return h;
}

/** "UGA" from a short name, "GT" / "ASU" from a full name. Max 3 characters. */
export function campusInitials(input: { name?: string | null; short_name?: string | null }): string {
  const short = (input.short_name ?? "").trim();
  if (short && short.length <= 4 && /^[A-Za-z&.\s]+$/.test(short) && short === short.toUpperCase()) {
    return short.replace(/[^A-Za-z]/g, "").slice(0, 3).toUpperCase();
  }
  const source = short || (input.name ?? "");
  const skip = new Set(["of", "the", "at", "and", "for", "in"]);
  const words = source
    .replace(/[^A-Za-z\s-]/g, " ")
    .split(/[\s-]+/)
    .filter((w) => w && !skip.has(w.toLowerCase()));
  if (words.length === 0) return "U";
  if (words.length === 1) return words[0].slice(0, 2).toUpperCase();
  return words.slice(0, 3).map((w) => w[0]).join("").toUpperCase();
}

export function CampusMark({
  campus,
  className,
  textClassName,
}: {
  campus: { id?: string | null; slug?: string | null; name?: string | null; short_name?: string | null };
  className?: string;
  textClassName?: string;
}) {
  const key = campus.id || campus.slug || campus.name || "campus";
  const { bg, fg } = PALETTE[hash(key) % PALETTE.length];
  const initials = campusInitials(campus);
  return (
    <span
      aria-hidden
      className={cn(
        "grid shrink-0 place-items-center rounded-full font-black leading-none tracking-tight",
        className ?? "h-11 w-11 text-sm",
      )}
      style={{ background: bg, color: fg }}
    >
      <span className={textClassName}>{initials}</span>
    </span>
  );
}
