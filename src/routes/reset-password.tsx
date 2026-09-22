/**
 * /reset-password — landing page for the password-reset email link.
 *
 * Supabase puts a recovery session in the URL hash; onAuthStateChange
 * fires PASSWORD_RECOVERY once it is picked up. We then let the user set
 * a new password via supabase.auth.updateUser({ password }) — no current
 * password required on a recovery session.
 */
import { Link, createFileRoute } from "@tanstack/react-router";
import { useEffect, useState } from "react";
import { supabase } from "@/integrations/supabase/client";
import { Input } from "@/components/ui/input";
import { Button } from "@/components/ui/button";
import { Label } from "@/components/ui/label";
import { toast } from "sonner";

export const Route = createFileRoute("/reset-password")({
  ssr: false,
  head: () => ({
    meta: [
      { title: "Reset your password — LeaseUp" },
      { name: "description", content: "Choose a new password for your LeaseUp account." },
      { name: "robots", content: "noindex" },
      { property: "og:title", content: "Reset your password — LeaseUp" },
      { property: "og:description", content: "Choose a new password for your LeaseUp account." },
      { property: "og:type", content: "website" },
      { name: "twitter:card", content: "summary" },
    ],
  }),
  component: ResetPasswordPage,
});

function ResetPasswordPage() {
  const [ready, setReady] = useState(false);
  const [checked, setChecked] = useState(false);
  const [password, setPassword] = useState("");
  const [confirm, setConfirm] = useState("");
  const [busy, setBusy] = useState(false);
  const [done, setDone] = useState(false);

  useEffect(() => {
    let active = true;
    const { data: sub } = supabase.auth.onAuthStateChange((event, session) => {
      if (!active) return;
      if (event === "PASSWORD_RECOVERY" || session) {
        setReady(true);
        setChecked(true);
      }
    });
    supabase.auth.getSession().then(({ data }) => {
      if (!active) return;
      if (data.session) setReady(true);
      setChecked(true);
    });
    return () => {
      active = false;
      sub.subscription.unsubscribe();
    };
  }, []);

  async function handleSubmit(e: React.FormEvent) {
    e.preventDefault();
    if (password.length < 6) {
      toast.error("Password must be at least 6 characters");
      return;
    }
    if (password !== confirm) {
      toast.error("Those passwords don't match");
      return;
    }
    setBusy(true);
    try {
      const { error } = await supabase.auth.updateUser({ password });
      if (error) throw error;
      setDone(true);
      toast.success("Password updated");
    } catch (err) {
      toast.error(err instanceof Error ? err.message : "Could not update your password");
    } finally {
      setBusy(false);
    }
  }

  return (
    <div className="min-h-screen bg-background flex items-center justify-center p-4">
      <div className="w-full max-w-md rounded-2xl bg-surface p-8 shadow-card-md">
        <div className="text-center mb-6">
          <Link to="/" className="inline-block">
            <div className="text-3xl font-black tracking-tight">
              <span className="text-primary">Lease</span><span>Up</span>
            </div>
          </Link>
        </div>

        {done ? (
          <div className="text-center space-y-4">
            <h1 className="text-lg font-bold">Password updated</h1>
            <p className="text-sm text-muted-foreground">
              You're signed in with your new password.
            </p>
            <Link
              to="/"
              className="inline-flex h-11 items-center justify-center rounded-full bg-primary px-5 text-sm font-bold text-primary-foreground"
            >
              Go home
            </Link>
          </div>
        ) : !checked ? (
          <p className="text-center text-sm text-muted-foreground">Checking your link…</p>
        ) : !ready ? (
          <div className="text-center space-y-4">
            <h1 className="text-lg font-bold">This reset link has expired</h1>
            <p className="text-sm text-muted-foreground">
              Reset links work once and expire after a short while. Request a new one and we'll email it again.
            </p>
            <Link
              to="/auth"
              search={{ mode: "in" as const }}
              className="inline-flex h-11 items-center justify-center rounded-full bg-primary px-5 text-sm font-bold text-primary-foreground"
            >
              Back to sign in
            </Link>
          </div>
        ) : (
          <form onSubmit={handleSubmit} className="space-y-3">
            <h1 className="text-lg font-bold text-center">Choose a new password</h1>
            <div>
              <Label>New password</Label>
              <Input
                type="password"
                value={password}
                onChange={(e) => setPassword(e.target.value)}
                required
                minLength={6}
                autoComplete="new-password"
              />
            </div>
            <div>
              <Label>Confirm new password</Label>
              <Input
                type="password"
                value={confirm}
                onChange={(e) => setConfirm(e.target.value)}
                required
                minLength={6}
                autoComplete="new-password"
              />
            </div>
            <Button
              type="submit"
              disabled={busy}
              className="w-full bg-primary hover:bg-primary-dark text-primary-foreground font-bold h-11"
            >
              {busy ? "Saving…" : "Update password →"}
            </Button>
          </form>
        )}
      </div>
    </div>
  );
}
