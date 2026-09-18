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

/**
 * Q267 — real school colours for the campuses students actually recognise.
 * Keys are lowercase fragments of the official campus name; the longest
 * matching key wins so "georgia tech" never loses to "georgia". Anything not
 * listed keeps the deterministic palette below.
 */
const BRAND_COLORS: Record<string, { bg: string; fg: string }> = {
  "university of georgia": { bg: "#BA0C2F", fg: "#FFFFFF" },
  "georgia institute of technology": { bg: "#003057", fg: "#B3A369" },
  "georgia tech": { bg: "#003057", fg: "#B3A369" },
  "georgia state": { bg: "#0039A6", fg: "#FFFFFF" },
  "georgia southern": { bg: "#041E42", fg: "#FFFFFF" },
  "university of florida": { bg: "#0021A5", fg: "#FA4616" },
  "florida state": { bg: "#782F40", fg: "#CEB888" },
  "university of central florida": { bg: "#000000", fg: "#BA9B37" },
  "university of south florida": { bg: "#006747", fg: "#FFFFFF" },
  "university of miami": { bg: "#005030", fg: "#F47321" },
  "university of alabama": { bg: "#9E1B32", fg: "#FFFFFF" },
  "auburn university": { bg: "#0C2340", fg: "#DD550C" },
  "university of tennessee": { bg: "#FF8200", fg: "#58595B" },
  "university of kentucky": { bg: "#0033A0", fg: "#FFFFFF" },
  "louisiana state": { bg: "#461D7C", fg: "#FDD023" },
  "university of arkansas": { bg: "#9D2235", fg: "#FFFFFF" },
  "university of mississippi": { bg: "#CE1126", fg: "#FFFFFF" },
  "mississippi state": { bg: "#660000", fg: "#FFFFFF" },
  "university of missouri": { bg: "#F1B82D", fg: "#000000" },
  "vanderbilt": { bg: "#866D4B", fg: "#000000" },
  "university of south carolina": { bg: "#73000A", fg: "#FFFFFF" },
  "clemson": { bg: "#F66733", fg: "#522D80" },
  "university of north carolina": { bg: "#4B9CD3", fg: "#FFFFFF" },
  "north carolina state": { bg: "#CC0000", fg: "#FFFFFF" },
  "duke university": { bg: "#00539B", fg: "#FFFFFF" },
  "university of virginia": { bg: "#232D4B", fg: "#F84C1E" },
  "virginia tech": { bg: "#630031", fg: "#CF4420" },
  "university of maryland": { bg: "#E03A3E", fg: "#FFD520" },
  "west virginia": { bg: "#002855", fg: "#EAAA00" },
  "university of texas at austin": { bg: "#BF5700", fg: "#FFFFFF" },
  "texas a&m": { bg: "#500000", fg: "#FFFFFF" },
  "texas christian": { bg: "#4D1979", fg: "#FFFFFF" },
  "baylor university": { bg: "#154734", fg: "#FFB81C" },
  "university of houston": { bg: "#C8102E", fg: "#FFFFFF" },
  "southern methodist": { bg: "#0033A0", fg: "#C8102E" },
  "university of oklahoma": { bg: "#841617", fg: "#FFFFFF" },
  "oklahoma state": { bg: "#FF7300", fg: "#000000" },
  "university of kansas": { bg: "#0051BA", fg: "#E8000D" },
  "kansas state": { bg: "#512888", fg: "#FFFFFF" },
  "iowa state": { bg: "#C8102E", fg: "#F1BE48" },
  "university of iowa": { bg: "#FFCD00", fg: "#000000" },
  "ohio state": { bg: "#BB0000", fg: "#FFFFFF" },
  "university of michigan": { bg: "#00274C", fg: "#FFCB05" },
  "michigan state": { bg: "#18453B", fg: "#FFFFFF" },
  "pennsylvania state": { bg: "#041E42", fg: "#FFFFFF" },
  "penn state": { bg: "#041E42", fg: "#FFFFFF" },
  "university of wisconsin": { bg: "#C5050C", fg: "#FFFFFF" },
  "university of illinois": { bg: "#13294B", fg: "#FF5F05" },
  "indiana university": { bg: "#990000", fg: "#FFFFFF" },
  "purdue": { bg: "#000000", fg: "#CEB888" },
  "university of nebraska": { bg: "#E41C38", fg: "#FFFFFF" },
  "university of minnesota": { bg: "#7A0019", fg: "#FFCC33" },
  "northwestern university": { bg: "#4E2A84", fg: "#FFFFFF" },
  "university of notre dame": { bg: "#0C2340", fg: "#C99700" },
  "rutgers": { bg: "#CC0033", fg: "#FFFFFF" },
  "university of southern california": { bg: "#990000", fg: "#FFCC00" },
  "university of california, los angeles": { bg: "#2774AE", fg: "#FFD100" },
  "university of california, berkeley": { bg: "#003262", fg: "#FDB515" },
  "stanford university": { bg: "#8C1515", fg: "#FFFFFF" },
  "university of oregon": { bg: "#154733", fg: "#FEE123" },
  "oregon state": { bg: "#DC4405", fg: "#FFFFFF" },
  "university of washington": { bg: "#4B2E83", fg: "#B7A57A" },
  "washington state": { bg: "#981E32", fg: "#FFFFFF" },
  "university of arizona": { bg: "#AB0520", fg: "#0C234B" },
  "arizona state": { bg: "#8C1D40", fg: "#FFC627" },
  "university of colorado": { bg: "#000000", fg: "#CFB87C" },
  "university of utah": { bg: "#CC0000", fg: "#FFFFFF" },
  "brigham young": { bg: "#002E5D", fg: "#FFFFFF" },
  "boston college": { bg: "#98002E", fg: "#BC9B6A" },
  "boston university": { bg: "#CC0000", fg: "#FFFFFF" },
  "northeastern university": { bg: "#C8102E", fg: "#FFFFFF" },
  "harvard": { bg: "#A51C30", fg: "#FFFFFF" },
  "yale": { bg: "#00356B", fg: "#FFFFFF" },
  "princeton": { bg: "#E77500", fg: "#000000" },
  "columbia university": { bg: "#003A70", fg: "#B9D9EB" },
  "cornell": { bg: "#B31B1B", fg: "#FFFFFF" },
  "university of pennsylvania": { bg: "#011F5B", fg: "#990000" },
  "brown university": { bg: "#4E3629", fg: "#FFFFFF" },
  "dartmouth": { bg: "#00693E", fg: "#FFFFFF" },
  "massachusetts institute of technology": { bg: "#A31F34", fg: "#FFFFFF" },
  "new york university": { bg: "#57068C", fg: "#FFFFFF" },
  "georgetown": { bg: "#041E42", fg: "#8D817B" },
  "syracuse": { bg: "#F76900", fg: "#000E54" },
  "temple university": { bg: "#9D2235", fg: "#FFFFFF" },
  "drexel": { bg: "#07294D", fg: "#FFC600" },
  "villanova": { bg: "#00205B", fg: "#FFFFFF" },
  "university of connecticut": { bg: "#000E2F", fg: "#FFFFFF" },
  "university of massachusetts": { bg: "#881C1C", fg: "#FFFFFF" },
  "university of pittsburgh": { bg: "#003594", fg: "#FFB81C" },
  "university of memphis": { bg: "#003087", fg: "#898D8D" },
  "tulane": { bg: "#006747", fg: "#FFFFFF" },
  "university of chicago": { bg: "#800000", fg: "#FFFFFF" },
  "johns hopkins": { bg: "#002D72", fg: "#FFFFFF" },
};

function brandColor(name: string | null | undefined) {
  const n = (name ?? "").toLowerCase();
  if (!n) return null;
  let best: { bg: string; fg: string } | null = null;
  let bestLen = 0;
  for (const key in BRAND_COLORS) {
    if (key.length > bestLen && n.includes(key)) {
      best = BRAND_COLORS[key];
      bestLen = key.length;
    }
  }
  return best;
}

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
  const { bg, fg } =
    brandColor(campus.name) ?? brandColor(campus.short_name) ?? PALETTE[hash(key) % PALETTE.length];
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
