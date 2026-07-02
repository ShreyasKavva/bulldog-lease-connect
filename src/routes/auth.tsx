/**
 * /auth — single page for sign-in AND sign-up (toggle via ?mode=in|up).
 *
 * Providers:
 *   - Email + password (any domain; .edu emails are auto-flipped to
 *     verified_email=true by a DB trigger on auth.users insert).
 *   - Google OAuth. The Supabase Google provider MUST be configured in the
 *     project for this button to work, otherwise sign-in throws
 *     "Unsupported provider".
 *
 * After successful auth, the SIGNED_IN listener in __root.tsx invalidates
 * the router; if profile.onboarding_completed is false the index route
 * redirects to /onboarding.
 *
 * ?message= surfaces a one-time toast (used for password-reset / email-
 * confirmation success).
 */
import { createFileRoute, useNavigate } from "@tanstack/react-router";
import { useEffect, useState } from "react";
import { supabase } from "@/integrations/supabase/client";
import { Input } from "@/components/ui/input";
import { Button } from "@/components/ui/button";
import { Label } from "@/components/ui/label";
import { toast } from "sonner";
import { z } from "zod";

const search = z.object({
  mode: z.enum(["in", "up"]).catch("in"),
  message: z.string().optional().catch(undefined),
  next: z.string().optional().catch(undefined),
});

function safeNext(next: string | undefined): string {
  if (!next) return "/";
  // Only allow same-origin relative paths.
  if (!next.startsWith("/") || next.startsWith("//")) return "/";
  return next;
}

export const Route = createFileRoute("/auth")({
  validateSearch: (s) => search.parse(s),
  head: ({ match }) => {
    const mode = (match.search as { mode?: "in" | "up" })?.mode ?? "in";
    const isUp = mode === "up";
    const title = isUp ? "Join LeaseUp — Free for Students" : "Sign in — LeaseUp";
    const desc = isUp
      ? "Verified .edu profiles, SafeScore on every listing, zero scams."
      : "Sign in to LeaseUp to browse and post student subleases.";
    return {
      meta: [
        { title },
        { name: "description", content: desc },
        { property: "og:title", content: title },
        { property: "og:description", content: desc },
        { property: "og:url", content: "https://leasup.co/auth" },
        { property: "og:type", content: "website" },
      ],
    };
  },
  component: AuthPage,
});

function AuthPage() {
  const { mode: initial, message, next } = Route.useSearch();
  const navigate = useNavigate();
  const [mode, setMode] = useState<"in" | "up">(initial);
  const [email, setEmail] = useState("");
  const [password, setPassword] = useState("");
  const [name, setName] = useState("");
  const [busy, setBusy] = useState(false);
  const dest = safeNext(next);

  useEffect(() => {
    supabase.auth.getSession().then(({ data }) => {
      if (data.session) window.location.assign(dest);
    });
  }, [dest]);

  async function submit(e: React.FormEvent) {
    e.preventDefault();
    setBusy(true);
    try {
      if (mode === "up") {
        let ref: string | null = null;
        try { ref = localStorage.getItem("lu_ref"); } catch {}
        const { error } = await supabase.auth.signUp({
          email, password,
          options: {
            emailRedirectTo: window.location.origin,
            data: { name, ...(ref ? { ref } : {}) },
          },
        });
        if (error) throw error;
        try { if (ref) localStorage.removeItem("lu_ref"); } catch {}
        toast.success("Welcome to LeaseUp 🎉");
        // Send new users through onboarding, then bounce to `next` after.
        try { sessionStorage.setItem("lu_post_onboarding_next", dest); } catch {}
        navigate({ to: "/onboarding" });
      } else {
        const { error } = await supabase.auth.signInWithPassword({ email, password });
        if (error) throw error;
        // Full navigation so ?post=1 / ?message=1 handlers on the target route run cleanly.
        window.location.assign(dest);
      }
    } catch (e: any) {
      toast.error(e.message ?? "Auth failed");
    } finally { setBusy(false); }
  }

  return (
    <div className="min-h-screen bg-background flex items-center justify-center p-4">
      <div className="w-full max-w-md rounded-2xl bg-surface p-8 shadow-card-md">
        <div className="text-center mb-6">
          <div className="text-3xl font-black tracking-tight">
            <span className="text-primary">Lease</span><span>Up</span>
          </div>
          <p className="text-sm text-muted-foreground mt-1">Find your next place. Leave your current one.</p>
          {message && (
            <div className="mt-3 rounded-md bg-primary-light px-3 py-2 text-xs font-semibold text-primary-dark">
              {message}
            </div>
          )}
        </div>

        <div className="flex rounded-lg bg-background p-1 mb-5">
          <button onClick={() => setMode("in")} className={`flex-1 rounded-md py-2 text-sm font-bold ${mode === "in" ? "bg-surface shadow" : "text-muted-foreground"}`}>Sign in</button>
          <button onClick={() => setMode("up")} className={`flex-1 rounded-md py-2 text-sm font-bold ${mode === "up" ? "bg-surface shadow" : "text-muted-foreground"}`}>Sign up</button>
        </div>

        <form onSubmit={submit} className="space-y-3">
          {mode === "up" && (
            <div><Label>Name</Label><Input value={name} onChange={(e) => setName(e.target.value)} required /></div>
          )}
          <div>
            <Label>Email</Label>
            <Input type="email" value={email} onChange={(e) => setEmail(e.target.value)} required placeholder="you@school.edu" />
            <p className="text-[11px] text-muted-foreground mt-1">.edu emails get a verified ✓ badge automatically.</p>
          </div>
          <div><Label>Password</Label><Input type="password" value={password} onChange={(e) => setPassword(e.target.value)} required minLength={6} /></div>
          <Button type="submit" disabled={busy} className="w-full bg-primary hover:bg-primary-dark text-primary-foreground font-bold h-11 mt-2">
            {busy ? "…" : (mode === "up" ? "Create account" : "Sign in")}
          </Button>
        </form>

        <p className="mt-4 text-center text-[11px] text-muted-foreground">
          By continuing you agree to LeaseUp's terms. We are not a party to any lease agreement.
        </p>
      </div>
    </div>
  );
}
