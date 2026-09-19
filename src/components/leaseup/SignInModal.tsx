/**
 * Modal sign-in / create-account. Opens on demand — never navigates.
 * Reuses the same Supabase logic as /auth. New signups go to /onboarding.
 * Existing sign-ins stay on the current page. If ?redirect= or a
 * caller-provided `next` is present, we navigate there after auth.
 */
import { useEffect, useRef, useState } from "react";
import { X, Eye, EyeOff } from "lucide-react";
import { supabase } from "@/integrations/supabase/client";
import { lovable } from "@/integrations/lovable";
import { Input } from "@/components/ui/input";
import { Button } from "@/components/ui/button";
import { Label } from "@/components/ui/label";
import { toast } from "sonner";

function safeNext(next: string | null | undefined): string | null {
  if (!next) return null;
  if (!next.startsWith("/") || next.startsWith("//")) return null;
  return next;
}

export function SignInModal({
  open,
  onClose,
  next,
}: {
  open: boolean;
  onClose: () => void;
  next?: string | null;
}) {
  const [email, setEmail] = useState("");
  const [password, setPassword] = useState("");
  const [showPw, setShowPw] = useState(false);
  const [busy, setBusy] = useState<"in" | "up" | "google" | null>(null);
  const cardRef = useRef<HTMLDivElement>(null);

  useEffect(() => {
    if (!open) return;
    function onKey(e: KeyboardEvent) { if (e.key === "Escape") onClose(); }
    document.addEventListener("keydown", onKey);
    return () => document.removeEventListener("keydown", onKey);
  }, [open, onClose]);

  if (!open) return null;

  const dest = safeNext(next) ?? null;

  function afterSignIn() {
    onClose();
    if (dest) window.location.assign(dest);
    // else stay on current page
  }

  async function afterSignUp() {
    onClose();
    try { if (dest) sessionStorage.setItem("lu_post_onboarding_next", dest); } catch {}
    window.location.assign("/onboarding");
  }

  async function handleGoogle() {
    setBusy("google");
    try {
      try { if (dest) sessionStorage.setItem("lu_post_onboarding_next", dest); } catch {}
      const result = await lovable.auth.signInWithOAuth("google", {
        redirect_uri: `${window.location.origin}/auth/callback${dest ? `?next=${encodeURIComponent(dest)}` : ""}`,
      });
      if (result.error) throw new Error(result.error.message ?? "Google sign-in failed");
      if (result.redirected) return;
      afterSignIn();
    } catch (e) {
      toast.error(e instanceof Error ? e.message : "Google sign-in failed");
    } finally { setBusy(null); }
  }

  async function handleSignIn(e: React.FormEvent) {
    e.preventDefault();
    if (!email || !password) return;
    setBusy("in");
    try {
      const { error } = await supabase.auth.signInWithPassword({ email, password });
      if (error) throw error;
      afterSignIn();
    } catch (e) {
      toast.error(e instanceof Error ? e.message : "Sign in failed");
    } finally { setBusy(null); }
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
      await afterSignUp();
    } catch (e) {
      toast.error(e instanceof Error ? e.message : "Could not create account");
    } finally { setBusy(null); }
  }

  return (
    <div
      className="fixed inset-0 z-50 flex items-center justify-center bg-black/50 p-4"
      onClick={(e) => { if (!cardRef.current?.contains(e.target as Node)) onClose(); }}
    >
      <div
        ref={cardRef}
        className="w-full max-w-md rounded-3xl bg-white p-8 shadow-2xl dark:bg-surface"
      >
        <div className="relative mb-6 flex items-center justify-center">
          <button
            onClick={onClose}
            aria-label="Close"
            className="absolute left-0 grid h-8 w-8 place-items-center rounded-full hover:bg-background"
          ><X className="h-4 w-4" /></button>
          <h2 className="text-lg font-bold">Log in</h2>
        </div>

        <button
          type="button"
          onClick={handleGoogle}
          disabled={busy !== null}
          className="flex h-12 w-full items-center justify-center gap-3 rounded-lg border border-border bg-white text-sm font-bold text-foreground shadow-sm transition-shadow hover:shadow-md disabled:opacity-60 dark:bg-background"
        >
          <GoogleIcon />
          {busy === "google" ? "Connecting…" : "Continue with Google"}
        </button>

        <div className="my-5 flex items-center gap-3 text-[11px] font-semibold uppercase tracking-wide text-muted-foreground">
          <div className="h-px flex-1 bg-border" />or<div className="h-px flex-1 bg-border" />
        </div>

        <form onSubmit={handleSignIn} className="space-y-3">
          <div>
            <Label>Email</Label>
            <Input
              type="email" value={email} onChange={(e) => setEmail(e.target.value)}
              required placeholder="you@yourschool.edu" autoComplete="email"
            />
          </div>
          <div>
            <Label>Password</Label>
            <div className="relative">
              <Input
                type={showPw ? "text" : "password"}
                value={password} onChange={(e) => setPassword(e.target.value)}
                required minLength={6} autoComplete="current-password"
                className="pr-10"
              />
              <button
                type="button" onClick={() => setShowPw((v) => !v)}
                aria-label={showPw ? "Hide password" : "Show password"}
                className="absolute right-2 top-1/2 -translate-y-1/2 rounded p-1 text-muted-foreground hover:text-foreground"
              >{showPw ? <EyeOff className="h-4 w-4" /> : <Eye className="h-4 w-4" />}</button>
            </div>
          </div>
          <Button
            type="submit" disabled={busy !== null}
            className="h-11 w-full bg-primary font-bold text-primary-foreground hover:bg-primary-dark"
          >{busy === "in" ? "…" : "Sign in →"}</Button>
        </form>

        <p className="mt-4 text-center text-sm text-muted-foreground">
          Don't have an account?{" "}
          <button
            type="button" onClick={handleCreate} disabled={busy !== null}
            className="font-semibold text-primary hover:underline"
          >Create account →</button>
        </p>
        <p className="mt-3 text-center text-[11px] text-muted-foreground">
          .edu emails get a ✓ verified badge automatically.
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

/** Fire from anywhere to open the modal. Optional `next` navigates after sign-in. */
export function openSignIn(next?: string) {
  window.dispatchEvent(new CustomEvent("lu:open-signin", { detail: { next } }));
}
