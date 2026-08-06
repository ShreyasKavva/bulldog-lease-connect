/**
 * Q102 Part C — one-time welcome step after a user's first sign-in.
 *
 * Shown when the signed-in profile is still missing a name or campus. The
 * name is pre-filled from the email local part and the campus is guessed from
 * the email domain (campus_email_domains, falling back to campuses.domain) —
 * both are best-effort and never block the user.
 *
 * A localStorage flag makes it max-once-per-device, whether they finish or skip.
 */
import { useEffect, useMemo, useState } from "react";
import { useQuery, useQueryClient } from "@tanstack/react-query";
import { supabase } from "@/integrations/supabase/client";
import { useSession } from "@/lib/leaseup/use-session";
import { CampusAutocomplete } from "./CampusAutocomplete";
import { fetchCampuses, type Campus } from "@/lib/leaseup/campuses";
import { toast } from "sonner";

const DONE_KEY = "leaseup-onboarding-complete";

/** "john.doe@uga.edu" → "John Doe" */
export function nameFromEmail(email: string | null | undefined): string {
  const local = (email ?? "").split("@")[0] ?? "";
  return local
    .replace(/[._-]+/g, " ")
    .trim()
    .split(/\s+/)
    .filter(Boolean)
    .map((w) => w.charAt(0).toUpperCase() + w.slice(1))
    .join(" ");
}

function isDone() {
  try {
    return window.localStorage.getItem(DONE_KEY) === "true";
  } catch {
    return false;
  }
}
function markDone() {
  try {
    window.localStorage.setItem(DONE_KEY, "true");
  } catch {
    /* private mode — worst case the step shows again next visit */
  }
}

async function fetchDomainCampusId(domain: string): Promise<string | null> {
  if (!domain) return null;
  const { data } = await supabase
    .from("campus_email_domains")
    .select("campus_id")
    .eq("domain", domain)
    .maybeSingle();
  if (data?.campus_id) return data.campus_id;
  const { data: c } = await supabase
    .from("campuses")
    .select("id")
    .eq("domain", domain)
    .maybeSingle();
  return c?.id ?? null;
}

export function OnboardingModal() {
  const { user } = useSession();
  const qc = useQueryClient();
  const [open, setOpen] = useState(false);
  const [name, setName] = useState("");
  const [campus, setCampus] = useState<Campus | null>(null);
  const [busy, setBusy] = useState(false);

  const email = user?.email ?? "";
  const domain = useMemo(() => email.split("@")[1]?.toLowerCase() ?? "", [email]);

  const { data: campuses = [] } = useQuery({
    queryKey: ["campuses"],
    queryFn: fetchCampuses,
    staleTime: Infinity,
    enabled: open,
  });

  useEffect(() => {
    let cancelled = false;
    async function check() {
      if (!user || isDone()) return;
      const { data: profile } = await supabase
        .from("profiles")
        .select("name, campus_id")
        .eq("id", user.id)
        .maybeSingle();
      if (cancelled) return;

      const hasName = !!profile?.name?.trim();
      if (hasName && profile?.campus_id) {
        markDone(); // returning user — never show it
        return;
      }
      setName(profile?.name?.trim() || nameFromEmail(user.email));
      if (profile?.campus_id) {
        setCampus(campuses.find((c) => c.id === profile.campus_id) ?? null);
      } else {
        const guessId = await fetchDomainCampusId(domain).catch(() => null);
        if (guessId && !cancelled) {
          const all = await fetchCampuses().catch(() => [] as Campus[]);
          if (!cancelled) setCampus(all.find((c) => c.id === guessId) ?? null);
        }
      }
      if (!cancelled) setOpen(true);
    }
    void check();
    return () => {
      cancelled = true;
    };
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [user?.id]);

  if (!open || !user) return null;

  function dismiss() {
    markDone();
    setOpen(false);
  }

  async function submit() {
    if (!name.trim() || !user) return;
    setBusy(true);
    try {
      const payload: { name: string; campus_id?: string } = { name: name.trim() };
      if (campus?.id) payload.campus_id = campus.id;
      const { error } = await supabase.from("profiles").update(payload).eq("id", user.id);
      if (error) throw error;
      qc.invalidateQueries({ queryKey: ["profile", user.id] });
      dismiss();
      toast.success(`Welcome, ${name.trim()}! 🎉`);
    } catch (e: unknown) {
      toast.error(e instanceof Error ? e.message : "Could not save your details");
    } finally {
      setBusy(false);
    }
  }

  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center overflow-y-auto bg-surface">
      <div className="mx-auto w-full max-w-md px-6 py-10">
        <div className="text-center text-xl font-black tracking-tight text-foreground">LeaseUp</div>

        <h1 className="mt-8 text-3xl font-bold text-foreground">Welcome to LeaseUp 👋</h1>
        <p className="mt-2 text-lg text-muted-foreground">Let's get you set up in 30 seconds.</p>

        <div className="mt-8">
          <label htmlFor="onb-name" className="font-medium text-foreground">
            What should we call you?
          </label>
          <input
            id="onb-name"
            value={name}
            onChange={(e) => setName(e.target.value)}
            placeholder="Your first name or nickname"
            autoComplete="given-name"
            className="mt-2 h-12 w-full rounded-xl border border-border px-4 text-lg outline-none transition focus:border-foreground"
          />
        </div>

        <div className="mt-6">
          <span className="font-medium text-foreground">Which campus are you at?</span>
          <div className="mt-2">
            <CampusAutocomplete
              value={campus?.name ?? ""}
              onSelect={(c) => setCampus(c)}
              onClear={() => setCampus(null)}
              placeholder="Search campuses…"
              inputClassName="h-12 text-lg"
            />
          </div>
        </div>

        <button
          type="button"
          onClick={submit}
          disabled={!name.trim() || busy}
          className="mt-8 w-full rounded-full bg-gray-900 py-4 text-lg font-semibold text-white transition hover:opacity-90 disabled:cursor-not-allowed disabled:opacity-40 dark:bg-white dark:text-gray-900"
        >
          {busy ? "Saving…" : "Get started →"}
        </button>

        <button
          type="button"
          onClick={dismiss}
          className="mt-4 block w-full text-center text-sm text-gray-400 hover:text-muted-foreground"
        >
          Skip for now
        </button>
      </div>
    </div>
  );
}
