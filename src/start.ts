/**
 * TanStack Start instance configuration.
 *
 * functionMiddleware runs on EVERY createServerFn call.
 *   - attachSupabaseAuth: client-side middleware that grabs the current
 *     Supabase session and attaches `Authorization: Bearer <token>` so server
 *     fns guarded by requireSupabaseAuth can identify the caller. If you
 *     replace it, the replacement MUST still set the Authorization header or
 *     every protected server fn will 401.
 *
 * requestMiddleware runs on every server request (SSR + server routes).
 *   - errorMiddleware: catches uncaught throws, logs them, and renders the
 *     friendly error page from lib/error-page. We bypass it for /lovable/*
 *     (the Lovable email integration owns its own responses) and the
 *     unsubscribe link (must always return its own redirect).
 */
import { createStart, createMiddleware } from "@tanstack/react-start";

import { renderErrorPage } from "./lib/error-page";
import { attachSupabaseAuth } from "@/integrations/supabase/auth-attacher";

const errorMiddleware = createMiddleware().server(async ({ next, request }) => {
  const url = new URL(request.url);
  if (url.pathname.startsWith("/lovable/") || url.pathname === "/email/unsubscribe") {
    return next();
  }
  try {
    return await next();
  } catch (error) {
    if (error != null && typeof error === "object" && "statusCode" in error) {
      throw error;
    }
    console.error(error);
    return new Response(renderErrorPage(), {
      status: 500,
      headers: { "content-type": "text/html; charset=utf-8" },
    });
  }
});

export const startInstance = createStart(() => ({
  functionMiddleware: [attachSupabaseAuth],
  requestMiddleware: [errorMiddleware],
}));
