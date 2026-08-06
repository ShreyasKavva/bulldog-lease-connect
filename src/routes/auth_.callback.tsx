/**
 * Q110 Part D — OAuth landing page.
 *
 * Google sign-in returns here. Supabase's client picks up the code/tokens from
 * the URL and stores the session; we wait for that to land, then send the user
 * to `?next` (relative paths only) or the homepage. External URLs are dropped.
 */
import { createFileRoute } from "@tanstack/react-router";
import { useEffect, useState } from "react";
import { supabase } from "@/integrations/supabase/client";

export const Route = createFileRoute("/auth_/callback")({
  ssr: false,
  head: () => ({
    meta: [
      { title: "Signing you in — LeaseUp" },
      { name: "description", content: "Finishing your LeaseUp sign-in." },
      { name: "robots", content: "noindex" },
      { property: "og:title", content: "Signing you in — LeaseUp" },
      { property: "og:description", content: "Finishing your LeaseUp sign-in." },
      { property: "og:type", content: "website" },
      { name: "twitter:card", content: "summary" },
    ],
  }),
  component: AuthCallback,
});

/** Only same-origin relative paths survive. Never an external URL. */
function safeNext(raw: string | null): string {
  if (!raw) return "/";
  let v = raw;
  try { v = decodeURIComponent(raw); } catch { /* use raw */ }
  if (!v.startsWith("/") || v.startsWith("//") || v.startsWith("/\\")) return "/";
  return v;
}

function AuthCallback() {
  const [failed, setFailed] = useState(false);

  useEffect(() => {
    let done = false;
    const params = new URLSearchParams(window.location.search);
    const dest = safeNext(params.get("next"));

    function go() {
      if (done) return;
      done = true;
      window.location.replace(dest);
    }

    // Supabase parses the code/hash on load; onAuthStateChange fires once ready.
    const { data: sub } = supabase.auth.onAuthStateChange((_e, session) => {
      if (session) go();
    });
    void supabase.auth.getSession().then(({ data }) => {
      if (data.session) go();
    });

    // Safety net: don't strand the user on a blank page.
    const t = window.setTimeout(() => {
      if (!done) {
        void supabase.auth.getSession().then(({ data }) => {
          if (data.session) go();
          else setFailed(true);
        });
      }
    }, 6000);

    return () => { sub.subscription.unsubscribe(); window.clearTimeout(t); };
  }, []);

  return (
    <div className="grid min-h-[60vh] place-items-center px-6 text-center">
      {failed ? (
        <div>
          <h1 className="text-xl font-bold text-gray-900 dark:text-foreground">Sign-in didn't finish</h1>
          <p className="mt-2 text-sm text-muted-foreground">Something interrupted the redirect.</p>
          <a
            href="/auth"
            className="mt-5 inline-block rounded-full bg-gray-900 px-6 py-3 text-sm font-medium text-white"
          >Try again →</a>
        </div>
      ) : (
        <div>
          <div className="mx-auto h-8 w-8 animate-spin rounded-full border-2 border-gray-200 border-t-gray-900" />
          <p className="mt-4 text-sm text-muted-foreground">Signing you in…</p>
        </div>
      )}
    </div>
  );
}
