/**
 * /auth — single-form sign in + create account.
 *
 * Google OAuth is the primary path (top of the card, full-width).
 * Below that: one shared email + password form with two actions —
 * "Sign in" and "Create account". No mode toggle tabs.
 *
 * .edu emails are auto-verified by a DB trigger on auth.users insert.
 * After a NEW signup we send the user to /onboarding; returning sign-ins
 * (and any user whose profile.onboarding_completed is already true)
 * go straight to `?next` or "/".
 */
import { createFileRoute, useNavigate } from "@tanstack/react-router";
import { useEffect, useState } from "react";
import { supabase } from "@/integrations/supabase/client";
import { lovable } from "@/integrations/lovable";
import { Input } from "@/components/ui/input";
import { Button } from "@/components/ui/button";
import { Label } from "@/components/ui/label";
import { toast } from "sonner";
import { z } from "zod";

const search = z.object({
  mode: z.enum(["in", "up"]).catch("in"),
  message: z.string().optional().catch(undefined),
  next: z.string().optional().catch(undefined),
  redirect: z.string().optional().catch(undefined),
});

function safeNext(next: string | undefined): string {
  if (!next) return "/";
  if (!next.startsWith("/") || next.startsWith("//")) return "/";
  return next;
}

export const Route = createFileRoute("/auth")({
  validateSearch: (s) => search.parse(s),
  head: () => ({
    meta: [
      { title: "Sign in — LeaseUp" },
      { name: "description", content: "Sign in to LeaseUp with Google or your .edu email to browse and post student subleases." },
      { property: "og:title", content: "Sign in — LeaseUp" },
      { property: "og:description", content: "Student sublease listings, direct messages, no fees." },
      { property: "og:url", content: "https://leasup.co/auth" },
      { property: "og:type", content: "website" },
    ],
  }),
  component: AuthPage,
});

function AuthPage() {
  const { message, next, redirect } = Route.useSearch();
  const navigate = useNavigate();
  const [email, setEmail] = useState("");
  const [password, setPassword] = useState("");
  const [busy, setBusy] = useState<"in" | "up" | "google" | null>(null);
  const dest = safeNext(next ?? redirect);

  useEffect(() => {
    supabase.auth.getSession().then(({ data }) => {
      if (data.session) window.location.assign(dest);
    });
  }, [dest]);

  async function handleGoogle() {
    setBusy("google");
    try {
      try { sessionStorage.setItem("lu_post_onboarding_next", dest); } catch {}
      const result = await lovable.auth.signInWithOAuth("google", {
        redirect_uri: `${window.location.origin}/auth/callback${dest && dest !== "/" ? `?next=${encodeURIComponent(dest)}` : ""}`,
      });
      if (result.error) throw new Error(result.error.message ?? "Google sign-in failed");
      if (result.redirected) return;
      // Session established — decide where to go based on onboarding state.
      await routeAfterAuth(dest);
    } catch (e) {
      const msg = e instanceof Error ? e.message : "Google sign-in failed";
      toast.error(msg);
    } finally {
      setBusy(null);
    }
  }

  async function routeAfterAuth(fallback: string) {
    const { data: userData } = await supabase.auth.getUser();
    const uid = userData.user?.id;
    if (!uid) { window.location.assign(fallback); return; }
    const { data: profile } = await supabase
      .from("profiles").select("onboarding_completed").eq("id", uid).maybeSingle();
    if (!profile?.onboarding_completed) {
      try { sessionStorage.setItem("lu_post_onboarding_next", fallback); } catch {}
      navigate({ to: "/onboarding" });
    } else {
      window.location.assign(fallback);
    }
  }

  async function handleSignIn(e: React.FormEvent) {
    e.preventDefault();
    if (!email || !password) return;
    setBusy("in");
    try {
      const { error } = await supabase.auth.signInWithPassword({ email, password });
      if (error) throw error;
      window.location.assign(dest);
    } catch (e) {
      const msg = e instanceof Error ? e.message : "Sign in failed";
      toast.error(msg);
    } finally {
      setBusy(null);
    }
  }

  async function handleCreate() {
    if (!email || !password) { toast.error("Enter an email and password"); return; }
    if (password.length < 6) { toast.error("Password must be at least 6 characters"); return; }
    setBusy("up");
    try {
      let ref: string | null = null;
      try { ref = localStorage.getItem("lu_ref"); } catch {}
      const nameGuess = email.split("@")[0]?.replace(/[._-]+/g, " ") ?? "";
      const { error } = await supabase.auth.signUp({
        email, password,
        options: {
          emailRedirectTo: window.location.origin,
          data: { name: nameGuess, ...(ref ? { ref } : {}) },
        },
      });
      if (error) throw error;
      try { if (ref) localStorage.removeItem("lu_ref"); } catch {}
      toast.success("Welcome to LeaseUp 🎉");
      try { sessionStorage.setItem("lu_post_onboarding_next", dest); } catch {}
      navigate({ to: "/onboarding" });
    } catch (e) {
      const msg = e instanceof Error ? e.message : "Could not create account";
      toast.error(msg);
    } finally {
      setBusy(null);
    }
  }

  return (
    <div className="min-h-screen bg-background flex items-center justify-center p-4">
      <div className="w-full max-w-md rounded-2xl bg-surface p-8 shadow-card-md">
        <div className="text-center mb-6">
          <div className="text-3xl font-black tracking-tight">
            <span className="text-primary">Lease</span><span>Up</span>
          </div>
          <p className="text-sm text-muted-foreground mt-1">
            Your campus housing — subleases, roommates, and transfers.
          </p>
          {message && (
            <div className="mt-3 rounded-md bg-primary-light px-3 py-2 text-xs font-semibold text-primary-dark">
              {message}
            </div>
          )}
        </div>

        {/* Google — primary, first, most prominent */}
        <button
          type="button"
          onClick={handleGoogle}
          disabled={busy !== null}
          className="w-full h-12 rounded-lg border border-border bg-white text-foreground font-bold text-sm flex items-center justify-center gap-3 shadow-sm hover:shadow-md transition-shadow disabled:opacity-60"
        >
          <GoogleIcon />
          {busy === "google" ? "Connecting…" : "Continue with Google"}
        </button>

        <div className="my-5 flex items-center gap-3 text-[11px] font-semibold uppercase tracking-wide text-muted-foreground">
          <div className="h-px flex-1 bg-border" />
          or
          <div className="h-px flex-1 bg-border" />
        </div>

        <form onSubmit={handleSignIn} className="space-y-3">
          <div>
            <Label>Email</Label>
            <Input
              type="email"
              value={email}
              onChange={(e) => setEmail(e.target.value)}
              required
              placeholder="yourname@uga.edu"
              autoComplete="email"
            />
            <p className="text-[11px] text-muted-foreground mt-1">
              We detect your school from your email domain.
            </p>
          </div>
          <div>
            <Label>Password</Label>
            <Input
              type="password"
              value={password}
              onChange={(e) => setPassword(e.target.value)}
              required
              minLength={6}
              autoComplete="current-password"
            />
          </div>
          <div className="grid grid-cols-2 gap-2 pt-1">
            <Button
              type="submit"
              disabled={busy !== null}
              className="bg-primary hover:bg-primary-dark text-primary-foreground font-bold h-11"
            >
              {busy === "in" ? "…" : "Sign in →"}
            </Button>
            <Button
              type="button"
              onClick={handleCreate}
              disabled={busy !== null}
              variant="outline"
              className="font-bold h-11"
            >
              {busy === "up" ? "…" : "Create account →"}
            </Button>
          </div>
        </form>

        <p className="mt-4 text-center text-[11px] text-muted-foreground">
          By continuing you agree to LeaseUp&apos;s terms. We are not a party to any lease agreement.
        </p>
      </div>
    </div>
  );
}

function GoogleIcon() {
  return (
    <svg width="18" height="18" viewBox="0 0 18 18" aria-hidden>
      <path fill="#4285F4" d="M17.64 9.2c0-.64-.06-1.25-.17-1.84H9v3.48h4.84a4.14 4.14 0 0 1-1.8 2.72v2.26h2.92c1.7-1.57 2.68-3.88 2.68-6.62Z" />
      <path fill="#34A853" d="M9 18c2.43 0 4.47-.8 5.96-2.18l-2.92-2.26c-.81.54-1.85.86-3.04.86-2.34 0-4.32-1.58-5.03-3.7H.92v2.32A9 9 0 0 0 9 18Z" />
      <path fill="#FBBC05" d="M3.97 10.72A5.4 5.4 0 0 1 3.68 9c0-.6.1-1.18.29-1.72V4.96H.92A9 9 0 0 0 0 9c0 1.45.35 2.82.92 4.04l3.05-2.32Z" />
      <path fill="#EA4335" d="M9 3.58c1.32 0 2.5.45 3.44 1.35l2.58-2.58C13.47.89 11.43 0 9 0A9 9 0 0 0 .92 4.96l3.05 2.32C4.68 5.16 6.66 3.58 9 3.58Z" />
    </svg>
  );
}
