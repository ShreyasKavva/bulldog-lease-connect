/**
 * PostListingDialog — the create/edit flow for listings.
 *
 * Submit pipeline:
 *   1. Validate form locally.
 *   2. Call screenListing (AI moderation, ai.functions.ts).
 *      - auto_reject     → block, surface reasons.
 *      - pending_review  → insert with pending_review=true (lands in admin
 *                          Suspicious tab).
 *      - quality_nudge   → show nudge dialog; user can fix or publish anyway.
 *      - ok              → proceed.
 *   3. Upload photos to the listing-photos Storage bucket via uploadListingPhotos.
 *      We persist STORAGE PATHS in listings.photos, not URLs — signed URLs
 *      are minted on read.
 *   4. Insert the listing row (RLS scopes user_id = auth.uid()).
 *   5. Optionally open InviteRoommatesDialog for viral growth.
 *
 * PriceGuidance shows live Deal/Fair/Above-market feedback as the user
 * types a price, sourced from campus_price_stats.
 */
import { Dialog, DialogContent, DialogHeader, DialogTitle } from "@/components/ui/dialog";
import { Input } from "@/components/ui/input";
import { Textarea } from "@/components/ui/textarea";
import { Label } from "@/components/ui/label";
import { Button } from "@/components/ui/button";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
import { Switch } from "@/components/ui/switch";
import { useState } from "react";
import { NEIGHBORHOODS, AMENITIES } from "@/lib/leaseup/constants";
import { supabase } from "@/integrations/supabase/client";
import { uploadListingPhotos } from "@/lib/leaseup/queries";
import { useSession, useMyProfile } from "@/lib/leaseup/use-session";
import { toast } from "sonner";
import { useQueryClient } from "@tanstack/react-query";
import { Upload, X, ShieldAlert, Sparkles } from "lucide-react";
import { cn } from "@/lib/utils";
import { InviteRoommatesDialog } from "@/components/leaseup/InviteRoommatesDialog";
import { PriceGuidance } from "@/components/leaseup/PriceGuidance";
import { useServerFn } from "@tanstack/react-start";
import { useRouter } from "@tanstack/react-router";
import { screenListing, type ScreenResult } from "@/lib/leaseup/ai.functions";

export function PostListingDialog({ open, onOpenChange }: { open: boolean; onOpenChange: (o: boolean) => void }) {
  const { user } = useSession();
  const { data: profile } = useMyProfile();
  const qc = useQueryClient();
  const router = useRouter();
  const [submitting, setSubmitting] = useState(false);
  const [files, setFiles] = useState<File[]>([]);
  const [inviteOpen, setInviteOpen] = useState(false);
  const [screenResult, setScreenResult] = useState<ScreenResult | null>(null);
  const [pendingForm, setPendingForm] = useState<null | (() => Promise<void>)>(null);
  const runScreen = useServerFn(screenListing);
  const [form, setForm] = useState({
    title: "", description: "", type: "sublease", price: "",
    beds: "1", baths: "1", area: NEIGHBORHOODS[0].name,
    available_from: "", available_to: "",
    furnished: false, utilities_included: false, pet_friendly: false, parking: false,
    amenities: [] as string[],
    deposit_amount: "", deposit_escrow_enabled: false,
  });

  function setField<K extends keyof typeof form>(k: K, v: (typeof form)[K]) {
    setForm((f) => ({ ...f, [k]: v }));
  }

  function toggleAmenity(a: string) {
    setForm((f) => ({ ...f, amenities: f.amenities.includes(a) ? f.amenities.filter(x => x !== a) : [...f.amenities, a] }));
  }

  function onFiles(e: React.ChangeEvent<HTMLInputElement>) {
    const arr = Array.from(e.target.files ?? []);
    setFiles((prev) => [...prev, ...arr].slice(0, 10));
  }

  async function submit() {
    if (!user || !profile?.campus_id) { toast.error("Complete your profile first"); return; }
    if (!form.title || !form.price) { toast.error("Title and price required"); return; }
    setSubmitting(true);
    try {
      // Queue 21 — pre-publish screening
      let screen: ScreenResult | null = null;
      try {
        screen = await runScreen({
          data: {
            title: form.title,
            description: form.description ?? "",
            price: parseInt(form.price) || 0,
            beds: parseInt(form.beds) || 0,
            campus: profile?.campus_id ?? "",
            has_contact: !!profile?.phone,
            photo_count: files.length,
          },
        });
      } catch (_e) {
        // If screening fails (gateway down), do not block legitimate users
        screen = null;
      }

      if (screen?.auto_reject) {
        setScreenResult(screen);
        setSubmitting(false);
        return;
      }

      const doPublish = async () => {
        const { count: existingCount } = await supabase
          .from("listings")
          .select("id", { count: "exact", head: true })
          .eq("user_id", user.id);

        const photos = files.length ? await uploadListingPhotos(user.id, files) : [];
        const hood = NEIGHBORHOODS.find(n => n.name === form.area);
        const { error } = await supabase.from("listings").insert({
          user_id: user.id,
          campus_id: profile.campus_id,
          title: form.title,
          description: form.description,
          type: form.type,
          price: parseInt(form.price),
          beds: parseInt(form.beds),
          baths: parseFloat(form.baths),
          area: form.area,
          lat: hood?.lat, lng: hood?.lng,
          furnished: form.furnished,
          utilities_included: form.utilities_included,
          pet_friendly: form.pet_friendly,
          parking: form.parking,
          available_from: form.available_from || null,
          available_to: form.available_to || null,
          amenities: form.amenities,
          photos,
          deposit_amount: form.deposit_escrow_enabled && form.deposit_amount ? parseFloat(form.deposit_amount) : null,
          deposit_escrow_enabled: form.deposit_escrow_enabled && !!form.deposit_amount,
          // Queue 21: temporary review hold for high-risk content
          pending_review: screen?.scam_risk === "high",
          pending_review_since: screen?.scam_risk === "high" ? new Date().toISOString() : null,
        } as any);
        if (error) throw error;
        toast.success(screen?.scam_risk === "high"
          ? "Posted — under brief review before going public"
          : "🎉 Listing posted!");
        qc.invalidateQueries({ queryKey: ["listings"] });
        onOpenChange(false);
        setForm({ ...form, title: "", description: "", price: "" });
        setFiles([]);
        if ((existingCount ?? 0) === 0) setInviteOpen(true);
        setScreenResult(null);
        setPendingForm(null);
      };

      // Quality nudge — confirm before publishing
      if (screen && (screen.quality_score < 40 || screen.warnings.length > 0)) {
        setScreenResult(screen);
        setPendingForm(() => doPublish);
        setSubmitting(false);
        return;
      }

      await doPublish();
    } catch (e: any) {
      toast.error(e.message ?? "Failed to post");
    } finally { setSubmitting(false); }
  }


  return (
    <>
    <Dialog open={open} onOpenChange={onOpenChange}>
      <DialogContent className="max-h-[90vh] max-w-2xl overflow-y-auto">
        <DialogHeader><DialogTitle className="text-2xl">Post a sublease</DialogTitle></DialogHeader>
        <div className="space-y-4">
          <Field label="Title"><Input value={form.title} onChange={(e) => setField("title", e.target.value)} placeholder="Cozy 1BR near North Campus" /></Field>

          <div className="grid grid-cols-2 gap-3">
            <Field label="Monthly rent ($)"><Input type="number" value={form.price} onChange={(e) => setField("price", e.target.value)} placeholder="850" /></Field>
            <Field label="Type">
              <Select value={form.type} onValueChange={(v) => setField("type", v)}>
                <SelectTrigger><SelectValue /></SelectTrigger>
                <SelectContent>
                  <SelectItem value="sublease">Sublease</SelectItem>
                  <SelectItem value="transfer">Lease Transfer</SelectItem>
                </SelectContent>
              </Select>
            </Field>
          </div>

          <div className="grid grid-cols-3 gap-3">
            <Field label="Beds"><Input type="number" value={form.beds} onChange={(e) => setField("beds", e.target.value)} /></Field>
            <Field label="Baths"><Input type="number" step="0.5" value={form.baths} onChange={(e) => setField("baths", e.target.value)} /></Field>
            <Field label="Neighborhood">
              <Select value={form.area} onValueChange={(v) => setField("area", v)}>
                <SelectTrigger><SelectValue /></SelectTrigger>
                <SelectContent>{NEIGHBORHOODS.map(n => <SelectItem key={n.name} value={n.name}>{n.name}</SelectItem>)}</SelectContent>
              </Select>
            </Field>
          </div>

          <PriceGuidance
            campusId={profile?.campus_id ?? null}
            beds={form.beds ? parseInt(form.beds) : null}
            price={form.price ? parseInt(form.price) : null}
            onPickMedian={(m: number) => setField("price", String(m))}
          />

          <div className="grid grid-cols-2 gap-3">
            <Field label="Available from"><Input type="date" value={form.available_from} onChange={(e) => setField("available_from", e.target.value)} /></Field>
            <Field label="Available until"><Input type="date" value={form.available_to} onChange={(e) => setField("available_to", e.target.value)} /></Field>
          </div>

          <Field label="Description">
            <Textarea rows={4} value={form.description} onChange={(e) => setField("description", e.target.value)} placeholder="Tell other students about the place…" />
          </Field>

          <div className="grid grid-cols-2 gap-3">
            <ToggleField label="Furnished" checked={form.furnished} onChange={(v) => setField("furnished", v)} />
            <ToggleField label="Utilities included" checked={form.utilities_included} onChange={(v) => setField("utilities_included", v)} />
            <ToggleField label="Pet friendly" checked={form.pet_friendly} onChange={(v) => setField("pet_friendly", v)} />
            <ToggleField label="Parking" checked={form.parking} onChange={(v) => setField("parking", v)} />
          </div>

          <Field label="Amenities">
            <div className="flex flex-wrap gap-1.5">
              {AMENITIES.map(a => (
                <button key={a} type="button" onClick={() => toggleAmenity(a)}
                  className={cn("rounded-full border px-3 py-1 text-xs font-semibold transition",
                    form.amenities.includes(a) ? "border-primary bg-primary-light text-primary-dark" : "border-border text-muted-foreground hover:border-primary"
                  )}>{a}</button>
              ))}
            </div>
          </Field>

          <Field label={`Photos (${files.length}/10)`}>
            <div className="grid grid-cols-2 gap-2">
              <label className="flex min-h-11 cursor-pointer items-center justify-center gap-2 rounded-lg border-2 border-dashed border-border py-4 text-sm font-semibold text-muted-foreground hover:border-primary hover:text-primary">
                📷 Take Photo
                <input type="file" accept="image/*" capture="environment" multiple onChange={onFiles} className="hidden" />
              </label>
              <label className="flex min-h-11 cursor-pointer items-center justify-center gap-2 rounded-lg border-2 border-dashed border-border py-4 text-sm font-semibold text-muted-foreground hover:border-primary hover:text-primary">
                <Upload className="h-4 w-4" />Choose from Library
                <input type="file" accept="image/*" multiple onChange={onFiles} className="hidden" />
              </label>
            </div>
            {files.length > 0 && (
              <div className="mt-2 grid grid-cols-5 gap-2">
                {files.map((f, i) => (
                  <div key={i} className="relative aspect-square overflow-hidden rounded-md bg-muted">
                    <img src={URL.createObjectURL(f)} alt="" className="h-full w-full object-cover" loading="lazy" />
                    <button aria-label="Remove photo" onClick={() => setFiles(files.filter((_, j) => j !== i))} className="absolute right-1 top-1 grid h-6 w-6 place-items-center rounded-full bg-black/60 text-white">
                      <X className="h-3 w-3" />
                    </button>
                  </div>
                ))}
              </div>
            )}
          </Field>

          <div className="rounded-xl border-2 border-dashed border-success/40 bg-success-light/30 p-4">
            <div className="flex items-center gap-2 text-sm font-bold">💰 Secure Deposit <span className="rounded-full bg-success/15 px-1.5 py-0.5 text-[10px] font-bold uppercase text-success">Optional</span></div>
            <p className="mt-1 text-xs text-muted-foreground">
              Collect a refundable deposit through LeaseUp. Funds are held until move-in — protects both sides. A 2.5% platform fee is charged to the subletter at payment.
            </p>
            <div className="mt-3 grid grid-cols-2 gap-3">
              <Field label="Deposit amount ($)">
                <Input type="number" min="0" placeholder="500" value={form.deposit_amount} onChange={(e) => setField("deposit_amount", e.target.value)} />
              </Field>
              <ToggleField label="Enable secure deposit" checked={form.deposit_escrow_enabled} onChange={(v) => setField("deposit_escrow_enabled", v)} />
            </div>
          </div>

          <Button disabled={submitting} onClick={submit} className="w-full bg-primary hover:bg-primary-dark text-primary-foreground font-bold h-11">
            {submitting ? "Posting…" : "Post listing"}
          </Button>
        </div>
      </DialogContent>
    </Dialog>
    <InviteRoommatesDialog
      open={inviteOpen}
      onOpenChange={setInviteOpen}
      referralCode={(profile as any)?.referral_code ?? null}
    />
    <Dialog open={!!screenResult} onOpenChange={(o) => { if (!o) { setScreenResult(null); setPendingForm(null); } }}>
      <DialogContent className="max-w-md">
        {screenResult?.auto_reject ? (
          <>
            <DialogHeader>
              <DialogTitle className="flex items-center gap-2 text-lg">
                <ShieldAlert className="h-5 w-5 text-destructive" /> We couldn't publish your listing
              </DialogTitle>
            </DialogHeader>
            <p className="text-sm text-muted-foreground">
              Our system detected content that may violate LeaseUp's community guidelines:
            </p>
            <ul className="list-disc space-y-1 pl-5 text-sm">
              {screenResult.issues.map((it, i) => <li key={i}>{it}</li>)}
            </ul>
            <Button onClick={() => { setScreenResult(null); setPendingForm(null); }} className="w-full">
              Edit listing
            </Button>
          </>
        ) : screenResult ? (
          <>
            <DialogHeader>
              <DialogTitle className="flex items-center gap-2 text-lg">
                <Sparkles className="h-5 w-5 text-primary" /> Your listing could perform better
              </DialogTitle>
            </DialogHeader>
            <div className="space-y-2 text-sm">
              {screenResult.quality_score < 40 && (
                <div className="rounded-lg bg-amber-50 dark:bg-amber-500/10 p-2 text-amber-900 dark:text-amber-100">
                  Quality score: <b>{screenResult.quality_score}/100</b>
                </div>
              )}
              {screenResult.warnings.length > 0 && (
                <ul className="list-disc space-y-1 pl-5">
                  {screenResult.warnings.map((w, i) => <li key={i}>{w}</li>)}
                </ul>
              )}
            </div>
            <div className="flex gap-2">
              <Button variant="outline" className="flex-1" onClick={() => { setScreenResult(null); setPendingForm(null); }}>
                Improve my listing
              </Button>
              <Button className="flex-1" onClick={async () => { const fn = pendingForm; setScreenResult(null); setPendingForm(null); if (fn) { setSubmitting(true); try { await fn(); } finally { setSubmitting(false); } } }}>
                Post anyway
              </Button>
            </div>
          </>
        ) : null}
      </DialogContent>
    </Dialog>
    </>
  );
}

function Field({ label, children }: { label: string; children: React.ReactNode }) {
  return (<div className="space-y-1.5"><Label className="text-xs font-bold uppercase text-muted-foreground">{label}</Label>{children}</div>);
}

function ToggleField({ label, checked, onChange }: { label: string; checked: boolean; onChange: (v: boolean) => void }) {
  return (
    <div className="flex items-center justify-between rounded-lg border bg-surface px-3 py-2.5">
      <span className="text-sm font-semibold">{label}</span>
      <Switch checked={checked} onCheckedChange={onChange} />
    </div>
  );
}
