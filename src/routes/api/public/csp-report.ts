import { createFileRoute } from "@tanstack/react-router";

// CSP violation report sink for the report-only policy. Always 204, never
// persisted — the body is only logged so the report-only policy can be
// evaluated before ever becoming enforcing.
const MAX_REPORT_BYTES = 8 * 1024;

export const Route = createFileRoute("/api/public/csp-report")({
  server: {
    handlers: {
      POST: async ({ request }) => {
        const contentLength = Number(request.headers.get("content-length") ?? "0");
        if (contentLength > MAX_REPORT_BYTES) {
          return new Response(null, { status: 413 });
        }
        const report = await request.text();
        console.warn("[csp-report]", report);
        return new Response(null, { status: 204 });
      },
    },
  },
});
