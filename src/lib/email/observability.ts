/**
 * Q444 — shared, server-only structured logging for email FAILURES.
 *
 * Every email failure in this app used to produce a differently-shaped
 * console.error, so nobody could answer the only question that matters:
 * did the provider reject us, is the sending domain unconfigured, or was the
 * send never attempted at all?
 *
 * Each failure now emits ONE single-line JSON entry tagged "email-failure"
 * with a `cause` drawn from a fixed vocabulary. Grep `email-failure` in the
 * deployment logs; group by `cause`.
 *
 * No behaviour changes: these helpers only log. Recipients are always
 * redacted; message bodies are never logged.
 */

export type EmailFailureCause =
  /** We never got as far as calling the provider (missing secret/config). */
  | "never_attempted"
  /** Provider refused the sender domain / it is not verified. */
  | "domain_unconfigured"
  /** Provider authenticated us but refused this message (401/403). */
  | "provider_forbidden"
  /** Provider accepted the request but rejected the content/recipient (4xx). */
  | "provider_rejected"
  /** Provider throttled us (429). */
  | "rate_limited"
  /** Provider unreachable or 5xx. */
  | "provider_unavailable"
  /** Our own database/queue step failed before the provider was involved. */
  | "queue_failure"
  /** Anything we could not classify. */
  | "unknown";

export function redactEmail(email: string | null | undefined): string {
  if (!email) return "***";
  const [local, domain] = email.split("@");
  if (!local || !domain) return "***";
  return `${local[0]}***@${domain}`;
}

function statusOf(error: unknown): number | null {
  if (error && typeof error === "object" && "status" in error) {
    const status = (error as { status: unknown }).status;
    if (typeof status === "number") return status;
  }
  return null;
}

export function classifyEmailFailure(error: unknown): EmailFailureCause {
  const message = (
    error instanceof Error ? error.message : typeof error === "string" ? error : ""
  ).toLowerCase();

  if (
    message.includes("sender_domain") ||
    message.includes("domain not verified") ||
    message.includes("unverified domain") ||
    message.includes("domain_not_found") ||
    message.includes("no such domain")
  ) {
    return "domain_unconfigured";
  }

  const status = statusOf(error) ?? (message.match(/\b(4\d\d|5\d\d)\b/)?.[1] ? Number(message.match(/\b(4\d\d|5\d\d)\b/)![1]) : null);
  if (status === 429) return "rate_limited";
  if (status === 401 || status === 403) return "provider_forbidden";
  if (status !== null && status >= 500) return "provider_unavailable";
  if (status !== null && status >= 400) return "provider_rejected";
  if (message.includes("fetch failed") || message.includes("network")) {
    return "provider_unavailable";
  }
  return "unknown";
}

/** Emits exactly one structured line. Never throws. */
export function logEmailFailure(fields: {
  stage: string;
  template: string | null;
  recipient?: string | null;
  cause: EmailFailureCause;
  detail?: unknown;
  extra?: Record<string, unknown>;
}): void {
  try {
    const detail =
      fields.detail instanceof Error
        ? fields.detail.message
        : typeof fields.detail === "string"
          ? fields.detail
          : fields.detail == null
            ? null
            : JSON.stringify(fields.detail);
    console.error(
      JSON.stringify({
        tag: "email-failure",
        at: new Date().toISOString(),
        stage: fields.stage,
        template: fields.template,
        recipient: redactEmail(fields.recipient),
        cause: fields.cause,
        detail: detail ? detail.slice(0, 500) : null,
        ...(fields.extra ?? {}),
      }),
    );
  } catch {
    // logging must never break a send path
  }
}
