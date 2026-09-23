import { createFileRoute } from "@tanstack/react-router";

/**
 * Q443 — CSP violation report sink for the report-only policy.
 *
 * Contract is unchanged: public, unauthenticated, always answers 204 with an
 * empty body so no browser ever retries or learns anything from us.
 *
 * What changed: reports used to be dumped raw into console.warn, which made
 * them effectively unreadable. Now each accepted report is parsed and emitted
 * as ONE structured single-line JSON log entry (prefix "csp-violation") that a
 * human can grep in the deployment logs. Nothing is persisted — no table, no
 * migration, by design.
 *
 * Abuse guards (all cheap, all in-memory):
 *   - hard byte cap on the body actually read, not just the claimed
 *     content-length header (which a client can lie about or omit)
 *   - content-type allowlist for the three types browsers really send
 *   - per-isolate rate limit + per-signature dedupe so one bored stranger (or
 *     one badly broken page) cannot flood the logs
 */

const MAX_REPORT_BYTES = 8 * 1024;

// Types browsers actually use for CSP reports. Anything else is not a browser.
const ALLOWED_CONTENT_TYPES = [
  "application/csp-report",
  "application/reports+json",
  "application/json",
];

// Log budget per isolate, per window. Reports beyond it are counted, not logged.
const RATE_WINDOW_MS = 60_000;
const MAX_LOGS_PER_WINDOW = 60;
// A signature (directive + blocked origin) is logged at most once per window.
const MAX_TRACKED_SIGNATURES = 200;

let windowStartedAt = 0;
let loggedInWindow = 0;
let droppedInWindow = 0;
const seenSignatures = new Set<string>();

function rollWindow(now: number) {
  if (now - windowStartedAt < RATE_WINDOW_MS) return;
  if (droppedInWindow > 0) {
    console.warn(
      JSON.stringify({
        tag: "csp-violation-dropped",
        window_ms: RATE_WINDOW_MS,
        dropped: droppedInWindow,
      }),
    );
  }
  windowStartedAt = now;
  loggedInWindow = 0;
  droppedInWindow = 0;
  seenSignatures.clear();
}

function originOf(value: unknown): string | null {
  if (typeof value !== "string" || value === "") return null;
  if (!value.includes("://")) return value.slice(0, 64); // "inline", "eval", "data", …
  try {
    return new URL(value).origin;
  } catch {
    return value.slice(0, 64);
  }
}

/** Normalizes both the legacy csp-report shape and the Reporting API shape. */
function normalize(parsed: unknown): Record<string, unknown> | null {
  if (parsed == null || typeof parsed !== "object") return null;

  const asRecord = parsed as Record<string, unknown>;
  const legacy = asRecord["csp-report"];
  if (legacy && typeof legacy === "object") {
    const r = legacy as Record<string, unknown>;
    return {
      directive: r["effective-directive"] ?? r["violated-directive"] ?? null,
      blocked: originOf(r["blocked-uri"]),
      document: originOf(r["document-uri"]),
      disposition: r["disposition"] ?? "report",
      status: r["status-code"] ?? null,
    };
  }

  // Reporting API: a single report object or an array of them; take the first.
  const body =
    Array.isArray(parsed) && parsed.length > 0 && typeof parsed[0] === "object"
      ? ((parsed[0] as Record<string, unknown>)["body"] as Record<string, unknown> | undefined)
      : (asRecord["body"] as Record<string, unknown> | undefined);
  if (!body) return null;
  return {
    directive: body["effectiveDirective"] ?? null,
    blocked: originOf(body["blockedURL"]),
    document: originOf(body["documentURL"]),
    disposition: body["disposition"] ?? "report",
    status: body["statusCode"] ?? null,
  };
}

export const Route = createFileRoute("/api/public/csp-report")({
  server: {
    handlers: {
      POST: async ({ request }) => {
        const noContent = new Response(null, { status: 204 });

        const contentType = (request.headers.get("content-type") ?? "").toLowerCase();
        if (!ALLOWED_CONTENT_TYPES.some((t) => contentType.includes(t))) {
          return noContent;
        }

        const claimedLength = Number(request.headers.get("content-length") ?? "0");
        if (Number.isFinite(claimedLength) && claimedLength > MAX_REPORT_BYTES) {
          return noContent;
        }

        // Read at most MAX_REPORT_BYTES regardless of what the headers claim.
        let raw = "";
        try {
          const reader = request.body?.getReader();
          if (!reader) return noContent;
          const decoder = new TextDecoder();
          let total = 0;
          for (;;) {
            const { done, value } = await reader.read();
            if (done) break;
            total += value.byteLength;
            if (total > MAX_REPORT_BYTES) {
              await reader.cancel();
              return noContent;
            }
            raw += decoder.decode(value, { stream: true });
          }
          raw += decoder.decode();
        } catch {
          return noContent;
        }

        let report: Record<string, unknown> | null = null;
        try {
          report = normalize(JSON.parse(raw));
        } catch {
          return noContent;
        }
        if (!report) return noContent;

        const now = Date.now();
        rollWindow(now);

        const signature = `${String(report["directive"])}|${String(report["blocked"])}`;
        if (loggedInWindow >= MAX_LOGS_PER_WINDOW || seenSignatures.has(signature)) {
          droppedInWindow += 1;
          return noContent;
        }
        if (seenSignatures.size < MAX_TRACKED_SIGNATURES) seenSignatures.add(signature);
        loggedInWindow += 1;

        console.warn(
          JSON.stringify({
            tag: "csp-violation",
            at: new Date(now).toISOString(),
            ...report,
          }),
        );

        return noContent;
      },
    },
  },
});
