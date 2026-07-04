/**
 * Root route. Owns the <html>/<head>/<body> shell, the global head() metadata,
 * and all app-wide providers/listeners. Everything else renders inside <Outlet/>.
 *
 * head() entries CONCATENATE into every route — leaf routes can add their own
 * meta but cannot remove root meta. Keep og:image OUT of root (it would
 * override per-listing share images).
 *
 * The inline <script> at the bottom of head() runs BEFORE hydration to set
 * the dark-mode class and color-scheme. This prevents a flash of the wrong
 * theme. Don't remove without replacing — the FOUC is jarring.
 *
 * Providers mounted here:
 *   - QueryClientProvider (per-request QueryClient from router context)
 *   - OfflineIndicator + InstallPrompt + Toaster (global UI)
 *   - NotificationToastListener (subscribes to the notifications table and
 *     shows a sonner toast for each new row for the current user)
 *
 * Effects on mount: register PWA service worker, apply stored theme,
 * invalidate the router + query cache on Supabase auth state changes.
 */
import { QueryClient, QueryClientProvider } from "@tanstack/react-query";
import {
  Outlet,
  Link,
  createRootRouteWithContext,
  useRouter,
  HeadContent,
  Scripts,
} from "@tanstack/react-router";
import { useEffect, type ReactNode } from "react";

import appCss from "../styles.css?url";
import { reportLovableError } from "../lib/lovable-error-reporting";
import { Toaster } from "@/components/ui/sonner";
import { supabase } from "@/integrations/supabase/client";
import { OfflineIndicator } from "@/components/leaseup/OfflineIndicator";
import { InstallPrompt } from "@/components/leaseup/InstallPrompt";
import { NotificationToastListener } from "@/components/leaseup/NotificationToastListener";
import { TopBar } from "@/components/leaseup/TopBar";
import { BottomNav } from "@/components/leaseup/BottomNav";
import { PullToRefresh } from "@/components/leaseup/PullToRefresh";
import { useRouterState } from "@tanstack/react-router";

function AppShell() {
  const router = useRouter();
  const path = useRouterState({ select: (s) => s.location.pathname });
  const hideNav = path.startsWith("/auth") || path.startsWith("/onboarding");
  const handleRefresh = async () => {
    await router.invalidate();
  };
  if (hideNav) return <Outlet />;
  return (
    <>
      <TopBar />
      <PullToRefresh onRefresh={handleRefresh}>
        <div key={path} className="lu-page-enter min-h-[calc(100dvh-3.5rem)] pb-[calc(5rem+env(safe-area-inset-bottom))] md:pb-0">
          <Outlet />
        </div>
      </PullToRefresh>
      <BottomNav />
    </>
  );
}

function NotFoundComponent() {
  return (
    <div className="flex min-h-screen items-center justify-center bg-background px-4">
      <div className="max-w-md text-center">
        <h1 className="text-7xl font-bold text-foreground">404</h1>
        <h2 className="mt-4 text-xl font-semibold">Page not found</h2>
        <div className="mt-6">
          <Link to="/" className="inline-flex items-center justify-center rounded-md bg-primary px-4 py-2 text-sm font-semibold text-primary-foreground hover:bg-primary-dark">
            Go home
          </Link>
        </div>
      </div>
    </div>
  );
}

function ErrorComponent({ error, reset }: { error: Error; reset: () => void }) {
  console.error(error);
  const router = useRouter();
  useEffect(() => { reportLovableError(error, { boundary: "root" }); }, [error]);
  return (
    <div className="flex min-h-screen items-center justify-center bg-background px-4">
      <div className="max-w-md text-center">
        <h1 className="text-xl font-semibold">This page didn't load</h1>
        <button
          onClick={() => { router.invalidate(); reset(); }}
          className="mt-4 inline-flex rounded-md bg-primary px-4 py-2 text-sm font-semibold text-primary-foreground hover:bg-primary-dark"
        >Try again</button>
      </div>
    </div>
  );
}

export const Route = createRootRouteWithContext<{ queryClient: QueryClient }>()({
  head: () => ({
    meta: [
      { charSet: "utf-8" },
      { name: "viewport", content: "width=device-width, initial-scale=1, viewport-fit=cover" },
      { title: "LeaseUp — Student Subleases at Every Campus" },
      { name: "description", content: "Find your next place. Leave your current one. The trusted student lease marketplace — at every major US campus." },
      { property: "og:title", content: "LeaseUp — Student Subleases" },
      { property: "og:description", content: "Browse and post verified student subleases at every major US campus. Connect with verified students at your campus." },
      { property: "og:type", content: "website" },
      { name: "twitter:card", content: "summary" },
      { name: "theme-color", content: "#2563EB" },
      { name: "apple-mobile-web-app-capable", content: "yes" },
      { name: "mobile-web-app-capable", content: "yes" },
      { name: "apple-mobile-web-app-status-bar-style", content: "default" },
      { name: "apple-mobile-web-app-title", content: "LeaseUp" },
    ],
    links: [
      { rel: "stylesheet", href: appCss },
      { rel: "stylesheet", href: "https://unpkg.com/leaflet@1.9.4/dist/leaflet.css" },
      { rel: "preconnect", href: "https://fonts.googleapis.com" },
      { rel: "preconnect", href: "https://fonts.gstatic.com", crossOrigin: "anonymous" },
      { rel: "stylesheet", href: "https://fonts.googleapis.com/css2?family=Inter:wght@400;500;600;700;800;900&display=swap" },
      { rel: "manifest", href: "/manifest.webmanifest" },
      { rel: "apple-touch-icon", href: "/icon-192.png" },
      { rel: "icon", type: "image/png", sizes: "192x192", href: "/icon-192.png" },
      { rel: "icon", type: "image/png", sizes: "512x512", href: "/icon-512.png" },
      { rel: "sitemap", type: "application/xml", href: "/sitemap.xml" },
    ],
    scripts: [
      {
        children: `(function(){try{var t=localStorage.getItem('leaseup:theme')||'light';var d=t==='dark'||(t==='system'&&matchMedia('(prefers-color-scheme: dark)').matches);var r=document.documentElement;if(d)r.classList.add('dark');else r.classList.remove('dark');r.style.colorScheme=d?'dark':'light';}catch(e){}})();`,
      },
    ],
  }),
  shellComponent: RootShell,
  component: RootComponent,
  notFoundComponent: NotFoundComponent,
  errorComponent: ErrorComponent,
});

function RootShell({ children }: { children: ReactNode }) {
  return (
    <html lang="en" suppressHydrationWarning>
      <head><HeadContent /></head>
      <body>{children}<Scripts /></body>
    </html>
  );
}

function RootComponent() {
  const { queryClient } = Route.useRouteContext();
  const router = useRouter();
  useEffect(() => {
    const { data: sub } = supabase.auth.onAuthStateChange((event) => {
      if (event !== "SIGNED_IN" && event !== "SIGNED_OUT" && event !== "USER_UPDATED") return;
      router.invalidate();
      if (event !== "SIGNED_OUT") queryClient.invalidateQueries();
    });
    return () => sub.subscription.unsubscribe();
  }, [router, queryClient]);
  useEffect(() => {
    import("@/lib/pwa/register").then((m) => m.registerPwa()).catch(() => {});
  }, []);
  useEffect(() => {
    import("@/lib/leaseup/theme").then((m) => m.applyTheme(m.getStoredTheme())).catch(() => {});
  }, []);
  return (
    <QueryClientProvider client={queryClient}>
      <OfflineIndicator />
      <NotificationToastListener />
      <AppShell />
      <InstallPrompt />
      <Toaster position="top-center" richColors />
    </QueryClientProvider>
  );
}
