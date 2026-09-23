/**
 * Q452 — one place that turns a Supabase/PostgREST error into a sentence a
 * student can read.
 *
 * An earlier audit caught the literal text
 *   duplicate key value violates unique constraint "conversations_participants_context_key"
 * in a toast. Raw Postgres sentences are noise to a renter and leak schema
 * names, so every catch that feeds a toast should run through friendlyError().
 *
 * The original error is always console.error'd first, so debugging keeps the
 * real message.
 *
 * Deliberately NOT used for anti-enumeration copy (password reset / sign-in):
 * those messages are intentionally vague and must stay exactly as written.
 */

export const GENERIC_ERROR = "Something went wrong. Try again.";

/** Tokens that mark a message as raw database/PostgREST output. */
const RAW_DB_MARKERS = [
  "duplicate key value",
  "violates",
  "constraint",
  "relation ",
  "column ",
  "syntax error",
  "permission denied for",
  "row-level security",
  "jwt",
  "pgrst",
  "supabase",
  "sqlstate",
  "null value in",
  "invalid input syntax",
  "failed to fetch",
  "networkerror",
];

function codeOf(err: unknown): string {
  const c = (err as { code?: unknown } | null)?.code;
  return typeof c === "string" ? c.toUpperCase() : "";
}

function messageOf(err: unknown): string {
  if (typeof err === "string") return err;
  const m = (err as { message?: unknown } | null)?.message;
  return typeof m === "string" ? m : "";
}

function looksRaw(message: string): boolean {
  const m = message.toLowerCase();
  return RAW_DB_MARKERS.some((t) => m.includes(t));
}

/**
 * @param err      whatever was caught
 * @param fallback context-specific sentence, e.g. "Couldn't save your profile."
 */
export function friendlyError(err: unknown, fallback: string = GENERIC_ERROR): string {
  // Always keep the real thing in the console for debugging.
  console.error("[leaseup] error:", err);

  const code = codeOf(err);
  const message = messageOf(err);
  const lower = message.toLowerCase();

  // Offline / request never reached the server.
  if (
    lower.includes("failed to fetch") ||
    lower.includes("networkerror") ||
    lower.includes("network request failed") ||
    (typeof navigator !== "undefined" && navigator.onLine === false)
  ) {
    return "You look offline. Check your connection and try again.";
  }

  switch (code) {
    case "23505": // unique violation
      return "That's already there — no need to do it twice.";
    case "23503": // foreign key
      return "That item is no longer available.";
    case "23502": // not null
    case "23514": // check constraint
    case "22P02": // invalid input syntax
      return "Some details are missing or invalid. Check the form and try again.";
    case "42501": // insufficient privilege
    case "PGRST301": // JWT expired / no permission
      return "You're not signed in — sign in again to continue.";
    case "PGRST116": // no rows returned by .single()
      return "We couldn't find that. It may have been removed.";
    default:
      break;
  }

  if (lower.includes("row-level security") || lower.includes("permission denied")) {
    return "You're not signed in — sign in again to continue.";
  }
  if (lower.includes("expired") && lower.includes("token")) {
    return "Your session expired. Sign in again to continue.";
  }

  // A plain Error our own code threw with a human sentence: keep it.
  if (message && !code && !looksRaw(message)) return message;

  return fallback;
}
