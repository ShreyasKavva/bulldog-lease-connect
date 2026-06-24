import { createFileRoute, useNavigate, Link } from "@tanstack/react-router";
import { useEffect, useState } from "react";
import { supabase } from "@/integrations/supabase/client";
import { useSession, useMyProfile } from "@/lib/leaseup/use-session";
import { useQueryClient } from "@tanstack/react-query";
import { AVATAR_EMOJIS, BANNER_COLORS, YEARS, VIBE_TAGS } from "@/lib/leaseup/constants";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { ShieldCheck, Sparkles, Home, Search as SearchIcon } from "lucide-react";
import { cn } from "@/lib/utils";
import { toast } from "sonner";

export const Route = createFileRoute("/onboarding")({
  head: () => ({ meta: [{ title: "Welcome to LeaseUp" }] }),
  component: Onboarding,
});

function Onboarding() {
  const navigate = useNavigate();
  const { user, loading } = useSession();
  const { data: profile } = useMyProfile();
  const qc = useQueryClient();

  const [step, setStep] = useState(1);
  const [name, setName] = useState("");
  const [year, setYear] = useState<string>("");
  const [major, setMajor] = useState("");
  const [emoji, setEmoji] = useState("🙂");
  const [color, setColor] = useState(BANNER_COLORS[0]);
  const [vibe, setVibe] = useState<string>("");
  const [busy, setBusy] = useState(false);

  useEffect(() => {
    if (!loading && !user) navigate({ to: "/auth", search: { mode: "up" } });
  }, [loading, user, navigate]);

  useEffect(() => {
    if (profile) {
      setName(profile.name ?? "");
      setYear(profile.year ?? "");
      setMajor(profile.major ?? "");
      setEmoji(profile.avatar_emoji ?? "🙂");
      setColor(profile.banner_color ?? BANNER_COLORS[0]);
      setVibe(profile.vibe_tags?.[0] ?? "");
    }
  }, [profile]);

  const verified = !!profile?.verified_email;
  const campusName = profile?.email?.split("@")[1] ?? "";

  async function saveProfile() {
    if (!user) return;
    if (!name.trim()) { toast.error("Add your name"); return; }
    setBusy(true);
    try {
      const { error } = await supabase.from("profiles").update({
        name: name.trim(),
        year: year || null,
        major: major.trim() || null,
        avatar_emoji: emoji,
        banner_color: color,
        vibe_tags: vibe ? [vibe] : [],
      }).eq("id", user.id);
      if (error) throw error;
      qc.invalidateQueries({ queryKey: ["profile", user.id] });
      setStep(4);
    } catch (e: any) {
      toast.error(e.message ?? "Could not save");
    } finally { setBusy(false); }
  }

  if (loading || !user) {
    return <div className="min-h-screen grid place-items-center bg-background text-sm text-muted-foreground">Loading…</div>;
  }

  return (
    <div className="min-h-screen bg-background flex items-center justify-center p-4">
      <div className="w-full max-w-lg rounded-2xl bg-surface p-8 shadow-card-md">
        <div className="flex items-center justify-between mb-6">
          <Link to="/" className="text-xl font-black tracking-tight">
            <span className="text-primary">Lease</span><span>Up</span>
          </Link>
          <div className="flex gap-1">
            {[1, 2, 3, 4].map(n => (
              <div key={n} className={cn("h-1.5 w-8 rounded-full", n <= step ? "bg-primary" : "bg-border")} />
            ))}
          </div>
        </div>

        {step === 1 && (
          <div className="space-y-4 text-center">
            <div className="text-4xl">🏠</div>
            <h1 className="text-2xl font-black">Welcome to LeaseUp</h1>
            <p className="text-sm text-muted-foreground">
              The student sublease marketplace built for <span className="font-bold text-foreground">verified students only</span>. No scams. No randos. Just your campus.
            </p>
            <ul className="text-left text-sm space-y-2 bg-background rounded-xl p-4">
              <li className="flex gap-2"><ShieldCheck className="h-4 w-4 text-primary mt-0.5 shrink-0" />.edu verified students</li>
              <li className="flex gap-2"><Sparkles className="h-4 w-4 text-primary mt-0.5 shrink-0" />AI lease analysis + match finder</li>
              <li className="flex gap-2"><Home className="h-4 w-4 text-primary mt-0.5 shrink-0" />SafeScore on every listing</li>
            </ul>
            <Button onClick={() => setStep(2)} className="w-full bg-primary hover:bg-primary-dark text-primary-foreground font-bold h-11">
              Get started →
            </Button>
          </div>
        )}

        {step === 2 && (
          <div className="space-y-4 text-center">
            <div className={cn(
              "mx-auto inline-flex items-center gap-2 rounded-full px-4 py-2 text-sm font-bold",
              verified ? "bg-success-light text-success" : "bg-background text-muted-foreground",
            )}>
              {verified ? <><ShieldCheck className="h-4 w-4" /> Verified student ✓</> : "Unverified domain"}
            </div>
            <h2 className="text-xl font-black">
              {verified ? `You're in. We recognized @${campusName}.` : "We didn't recognize your email domain"}
            </h2>
            <p className="text-sm text-muted-foreground">
              {verified
                ? "Your profile gets a verified badge on every listing and message, so other students know you're real."
                : "You can still use LeaseUp, but your listings won't carry the verified badge. Use your campus .edu to verify."}
            </p>
            <Button onClick={() => setStep(3)} className="w-full bg-primary hover:bg-primary-dark text-primary-foreground font-bold h-11">
              Next: set up your profile
            </Button>
          </div>
        )}

        {step === 3 && (
          <div className="space-y-4">
            <div>
              <h2 className="text-xl font-black">Set up your profile</h2>
              <p className="text-xs text-muted-foreground">60 seconds. Other students see this on your listings.</p>
            </div>

            <div className="flex items-center gap-3">
              <div
                className="grid h-16 w-16 place-items-center rounded-full text-3xl shrink-0"
                style={{ background: color }}
              >{emoji}</div>
              <div className="flex-1">
                <Label>Name</Label>
                <Input value={name} onChange={e => setName(e.target.value)} placeholder="Alex Smith" />
              </div>
            </div>

            <div>
              <Label className="text-xs">Avatar</Label>
              <div className="flex flex-wrap gap-1 mt-1">
                {AVATAR_EMOJIS.map(e => (
                  <button key={e} onClick={() => setEmoji(e)}
                    className={cn("h-8 w-8 rounded-full text-lg grid place-items-center hover:bg-background",
                      emoji === e && "ring-2 ring-primary")}>{e}</button>
                ))}
              </div>
              <div className="flex flex-wrap gap-1 mt-2">
                {BANNER_COLORS.map(c => (
                  <button key={c} onClick={() => setColor(c)}
                    style={{ background: c }}
                    className={cn("h-6 w-6 rounded-full", color === c && "ring-2 ring-offset-2 ring-foreground")} />
                ))}
              </div>
            </div>

            <div className="grid grid-cols-2 gap-3">
              <div>
                <Label>Year</Label>
                <select value={year} onChange={e => setYear(e.target.value)}
                  className="h-9 w-full rounded-md border bg-surface px-2 text-sm">
                  <option value="">Select…</option>
                  {YEARS.map(y => <option key={y}>{y}</option>)}
                </select>
              </div>
              <div>
                <Label>Major</Label>
                <Input value={major} onChange={e => setMajor(e.target.value)} placeholder="Finance" />
              </div>
            </div>

            <div>
              <Label className="text-xs">Pick a vibe (optional)</Label>
              <div className="flex flex-wrap gap-1 mt-1">
                {VIBE_TAGS.slice(0, 8).map(v => (
                  <button key={v} onClick={() => setVibe(vibe === v ? "" : v)}
                    className={cn("rounded-full border px-2.5 py-1 text-xs font-semibold",
                      vibe === v ? "border-primary bg-primary-light text-primary-dark" : "hover:bg-background")}>
                    {v}
                  </button>
                ))}
              </div>
            </div>

            <Button onClick={saveProfile} disabled={busy}
              className="w-full bg-primary hover:bg-primary-dark text-primary-foreground font-bold h-11">
              {busy ? "Saving…" : "Continue"}
            </Button>
          </div>
        )}

        {step === 4 && (
          <div className="space-y-4">
            <h2 className="text-xl font-black text-center">What brings you here?</h2>
            <p className="text-sm text-muted-foreground text-center">Pick one — you can do both later.</p>
            <button
              onClick={() => navigate({ to: "/", search: { post: 1 } as any })}
              className="w-full text-left rounded-xl border-2 border-border hover:border-primary p-5 transition-colors group"
            >
              <div className="flex items-center gap-3">
                <div className="grid h-12 w-12 place-items-center rounded-xl bg-primary-light text-2xl">🏠</div>
                <div>
                  <div className="font-bold">I have a place to sublease</div>
                  <div className="text-xs text-muted-foreground">Post your unit in under 3 minutes</div>
                </div>
              </div>
            </button>
            <button
              onClick={() => navigate({ to: "/" })}
              className="w-full text-left rounded-xl border-2 border-border hover:border-primary p-5 transition-colors"
            >
              <div className="flex items-center gap-3">
                <div className="grid h-12 w-12 place-items-center rounded-xl bg-primary-light text-2xl"><SearchIcon className="h-6 w-6 text-primary" /></div>
                <div>
                  <div className="font-bold">I'm looking for a place</div>
                  <div className="text-xs text-muted-foreground">Browse subleases or post what you need</div>
                </div>
              </div>
            </button>
            <Link to="/looking-for" className="block text-center text-xs text-muted-foreground hover:text-foreground pt-2">
              Skip — take me to the Looking For board
            </Link>
          </div>
        )}
      </div>
    </div>
  );
}
