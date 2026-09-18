/**
 * Q269 — campus display names.
 *
 * The `campuses.short_name` column is an IPEDS-style hard 28-character cut, so
 * it frequently ends mid-word ("A T Still University of Heal"). IPEDS also
 * strips the periods out of initialisms ("A.T. Still" -> "A T Still").
 *
 * `campusShortName()` is the single display helper: it keeps a genuine
 * abbreviation (UGA, ATSU, NCAT) when the database has one, otherwise it
 * restores the periods and truncates on a word boundary.
 */

type CampusLike = {
  name?: string | null;
  short_name?: string | null;
} | null | undefined;

const MAX_LEN = 34;
const TRAILING_STOPWORDS = /\s+(of|the|and|at|in|for|&)$/i;

/** "A T Still University" -> "A.T. Still University"; single trailing initials keep one period. */
export function restoreInitials(name: string): string {
  return name.replace(/(?:\b[A-Z]\b[ ]?){2,}/g, (run) => {
    const letters = run.trim().split(/\s+/);
    return `${letters.map((l) => `${l}.`).join("")} `;
  }).replace(/\s+/g, " ").trim();
}

/** Truncate to `max` characters without ever cutting inside a word. */
export function truncateWords(text: string, max = MAX_LEN): string {
  if (text.length <= max) return text;
  const cut = text.slice(0, max + 1);
  const lastSpace = cut.lastIndexOf(" ");
  const out = (lastSpace > 0 ? cut.slice(0, lastSpace) : text.slice(0, max)).trim();
  return out.replace(/[-–—,&]$/, "").replace(TRAILING_STOPWORDS, "").trim();
}

/** True when short_name is just a mid-word slice of the full name. */
function isMidWordCut(name: string, short: string): boolean {
  if (!name.startsWith(short) || name.length <= short.length) return false;
  return name[short.length] !== " ";
}

export function campusShortName(campus: CampusLike): string {
  const name = campus?.name?.trim() ?? "";
  const short = campus?.short_name?.trim() ?? "";
  if (short && !isMidWordCut(name, short)) return restoreInitials(short);
  if (!name) return restoreInitials(short);
  return truncateWords(restoreInitials(name));
}

/** Full campus name with initialism periods restored; never truncated. */
export function campusFullName(campus: CampusLike): string {
  const name = campus?.name?.trim() || campus?.short_name?.trim() || "";
  return restoreInitials(name);
}
