/**
 * PostListingDialog — the create/edit flow for listings.
 *
 * Q53 fixes:
 *   - Added campus dropdown (defaults to profile.campus_id, falls back to
 *     manual pick if the profile has none — no more silent "Complete your
 *     profile first" dead-end).
 *   - Photo upload: single dashed drop area, client-side type + size
 *     validation (jpg/png/webp/heic ≤ 10MB), max 5 photos per spec,
 *     upload-progress state, 0-photo warning banner (not a block).
 *   - Price input: number, min=0, "/mo" suffix, "e.g. 650" placeholder.
 *   - Dates: default available_from to today+30, inline error when
 *     available_to <= available_from.
 *   - Description: real-example placeholder + "make it longer" hint.
 *   - Submit: "Post listing →" with spinner, disabled while submitting to
 *     prevent double-click, navigates to the new /listing/$id detail page
 *     with the spec success toast.
 *
 * Submit pipeline unchanged: validate → screenListing (AI moderation) →
 * upload photos as storage paths → insert listing row (RLS scopes user_id).
 */
import { Dialog, DialogContent, DialogHeader, DialogTitle } from "@/components/ui/dialog";
import { friendlyError } from "@/lib/leaseup/friendly-error";
import { Input } from "@/components/ui/input";
import { Textarea } from "@/components/ui/textarea";
import { Label } from "@/components/ui/label";
import { Button } from "@/components/ui/button";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
import { useEffect, useMemo, useState } from "react";
import { signPaths } from "@/lib/leaseup/signed-urls";
import { NEIGHBORHOODS, AMENITIES } from "@/lib/leaseup/constants";
import { supabase } from "@/integrations/supabase/client";
import { uploadListingPhotos } from "@/lib/leaseup/queries";
import { fetchCampuses, type Campus } from "@/lib/leaseup/campuses";
import { CampusAutocomplete } from "@/components/leaseup/CampusAutocomplete";
import { useSession, useMyProfile } from "@/lib/leaseup/use-session";
import { toast } from "sonner";
import { useQuery, useQueryClient } from "@tanstack/react-query";
import { Upload, X, ShieldAlert, Sparkles, ImagePlus, Loader2, AlertTriangle, ArrowRight } from "lucide-react";
import { cn } from "@/lib/utils";
import { InviteRoommatesDialog } from "@/components/leaseup/InviteRoommatesDialog";
import { PriceGuidance } from "@/components/leaseup/PriceGuidance";
import { useServerFn } from "@tanstack/react-start";
import { useRouter } from "@tanstack/react-router";
import { screenListing, type ScreenResult } from "@/lib/leaseup/ai.functions";

const MAX_PHOTOS = 10;
const MAX_PHOTO_BYTES = 10 * 1024 * 1024;
const ALLOWED_TYPES = ["image/jpeg", "image/jpg", "image/png", "image/webp", "image/heic", "image/heif"];

function defaultAvailableFrom(): string {
  const d = new Date();
  d.setDate(d.getDate() + 30);
  return d.toISOString().slice(0, 10);
}

type Preview = { file: File; url: string };

export function PostListingDialog({ open, onOpenChange, relistFrom, editListingId }: { open: boolean; onOpenChange: (o: boolean) => void; relistFrom?: string | null; editListingId?: string | null }) {
  const { user } = useSession();
  const { data: profile } = useMyProfile();
  const qc = useQueryClient();
  const router = useRouter();
  const [submitting, setSubmitting] = useState(false);
  const [uploading, setUploading] = useState(false);
  const [uploadStatus, setUploadStatus] = useState<string | null>(null);
  const [previews, setPreviews] = useState<Preview[]>([]);
  const [existingPhotos, setExistingPhotos] = useState<{ path: string; url: string }[]>([]);
  const [inviteOpen, setInviteOpen] = useState(false);
  const [screenResult, setScreenResult] = useState<ScreenResult | null>(null);
  const [pendingForm, setPendingForm] = useState<null | (() => Promise<void>)>(null);
  const [relistPrefilled, setRelistPrefilled] = useState(false);
  const runScreen = useServerFn(screenListing);

  const { data: campusesWithListings = [] } = useQuery({ queryKey: ["campuses"], queryFn: fetchCampuses });
  // Q179 — a student can post at any accredited school, not just ones we already cover.
  const [pickedCampus, setPickedCampus] = useState<Campus | null>(null);
  const campuses = pickedCampus && !campusesWithListings.some((c) => c.id === pickedCampus.id)
    ? [...campusesWithListings, pickedCampus]
    : campusesWithListings;

  const isEdit = !!editListingId;
  const isRelist = !!relistFrom && !isEdit;
  const sourceId = editListingId ?? relistFrom ?? null;

  const [form, setForm] = useState({
    title: "", description: "", type: "sublease", price: "",
    beds: "1", baths: "1", area: NEIGHBORHOODS[0].name,
    campus_id: "",
    available_from: defaultAvailableFrom(), available_to: "",
    furnished: false, utilities_included: false, pet_friendly: false, parking: false, wifi_included: false,
    amenities: [] as string[],
    deposit_amount: "", deposit_escrow_enabled: false,
  });

  // Pre-fill campus from profile when it loads
  useEffect(() => {
    if (profile?.campus_id && !form.campus_id) {
      setForm((f) => ({ ...f, campus_id: profile.campus_id! }));
    }
  }, [profile?.campus_id]); // eslint-disable-line react-hooks/exhaustive-deps

  // Relist / Edit prefill: fetch source listing and populate the form.
  useEffect(() => {
    if (!sourceId || !user || relistPrefilled) return;
    let cancelled = false;
    (async () => {
      const { data: src, error } = await supabase
        .from("listings")
        .select("*")
        .eq("id", sourceId)
        .eq("user_id", user.id)
        .maybeSingle();
      if (cancelled) return;
      if (error || !src) {
        if (isEdit) toast.error("You don't have permission to edit this listing");
        return;
      }
      const s = src as any;
      setForm((f) => ({
        ...f,
        title: s.title ?? "",
        description: s.description ?? "",
        type: s.type ?? "sublease",
        price: s.price != null ? String(s.price) : "",
        beds: s.beds != null ? String(s.beds) : "1",
        baths: s.baths != null ? String(s.baths) : "1",
        area: s.area ?? NEIGHBORHOODS[0].name,
        campus_id: s.campus_id ?? f.campus_id,
        available_from: isEdit ? (s.available_from ?? "") : "",
        available_to: isEdit ? (s.available_to ?? "") : "",
        furnished: !!s.furnished,
        utilities_included: !!s.utilities_included,
        pet_friendly: !!s.pet_friendly,
        parking: !!s.parking,
        wifi_included: !!(s as any).wifi_included,
        amenities: (s.amenities ?? []) as string[],
        deposit_amount: s.deposit_amount != null ? String(s.deposit_amount) : "",
        deposit_escrow_enabled: !!s.deposit_escrow_enabled,
      }));
      const paths = (s.photos ?? []) as string[];
      if (paths.length) {
        const signed = await signPaths("listing-photos", paths, { ttl: 60 * 60 * 24 * 7 });
        if (cancelled) return;
        const items = paths
          .map((p) => ({ path: p, url: signed.get(p) ?? "" }))
          .filter((x) => !!x.url);
        setExistingPhotos(items);
      }
      setRelistPrefilled(true);
    })();
    return () => { cancelled = true; };
  }, [sourceId, user?.id, relistPrefilled, isEdit]); // eslint-disable-line react-hooks/exhaustive-deps

  useEffect(() => {
    return () => previews.forEach((p) => URL.revokeObjectURL(p.url));
  }, [previews]);

  const dateError = useMemo(() => {
    if (!form.available_from || !form.available_to) return null;
    if (new Date(form.available_to) <= new Date(form.available_from)) {
      return "End date must be after start date";
    }
    return null;
  }, [form.available_from, form.available_to]);

  function setField<K extends keyof typeof form>(k: K, v: (typeof form)[K]) {
    setForm((f) => ({ ...f, [k]: v }));
  }

  function toggleAmenity(a: string) {
    setForm((f) => ({ ...f, amenities: f.amenities.includes(a) ? f.amenities.filter((x) => x !== a) : [...f.amenities, a] }));
  }

  function onFiles(e: React.ChangeEvent<HTMLInputElement>) {
    const picked = Array.from(e.target.files ?? []);
    // Reset input so re-selecting the same file works
    e.target.value = "";
    const accepted: Preview[] = [];
    for (const file of picked) {
      if (existingPhotos.length + previews.length + accepted.length >= MAX_PHOTOS) {
        toast.error(`You can add up to ${MAX_PHOTOS} photos`);
        break;
      }
      const type = file.type.toLowerCase();
      const looksLikeImage = type.startsWith("image/") || /\.(jpe?g|png|webp|heic|heif)$/i.test(file.name);
      if (!ALLOWED_TYPES.includes(type) && !looksLikeImage) {
        toast.error(`${file.name}: only JPG, PNG, WebP, or HEIC images are allowed`);
        continue;
      }
      if (file.size > MAX_PHOTO_BYTES) {
        toast.error(`${file.name}: photo must be under 10MB`);
        continue;
      }
      accepted.push({ file, url: URL.createObjectURL(file) });
    }
    if (accepted.length > 0) {
      setPreviews((prev) => [...prev, ...accepted].slice(0, MAX_PHOTOS));
    }
  }

  function removePhoto(idx: number) {
    setPreviews((prev) => {
      const next = prev.filter((_, i) => i !== idx);
      const removed = prev[idx];
      if (removed) URL.revokeObjectURL(removed.url);
      return next;
    });
  }

  function moveToFront(idx: number) {
    setPreviews((prev) => {
      if (idx === 0) return prev;
      const next = [...prev];
      const [item] = next.splice(idx, 1);
      next.unshift(item);
      return next;
    });
  }

  async function submit() {
    if (!user) { toast.error("Please sign in"); return; }
    if (!form.campus_id) { toast.error("Pick a campus"); return; }
    if (!form.title.trim()) { toast.error("Add a title"); return; }
    const priceNum = parseInt(form.price);
    if (!form.price || isNaN(priceNum) || priceNum <= 0) { toast.error("Enter a monthly rent"); return; }
    const bedsNum = parseInt(form.beds);
    if (isNaN(bedsNum) || bedsNum < 0) { toast.error("How many bedrooms?"); return; }
    const bathsNum = parseFloat(form.baths);
    if (isNaN(bathsNum) || bathsNum <= 0) { toast.error("How many bathrooms?"); return; }
    if (!form.available_from) { toast.error("Pick a move-in date"); return; }
    if (isRelist && !form.available_to) { toast.error("Set your new end date for this relist"); return; }
    if (dateError) { toast.error(dateError); return; }

    setSubmitting(true);
    try {
      let screen: ScreenResult | null = null;
      if (!isEdit) {
        try {
          screen = await runScreen({
            data: {
              title: form.title,
              description: form.description ?? "",
              price: priceNum,
              beds: bedsNum,
              campus: form.campus_id,
              has_contact: !!profile?.phone,
              photo_count: existingPhotos.length + previews.length,
            },
          });
        } catch {
          screen = null;
        }

        if (screen?.auto_reject) {
          setScreenResult(screen);
          setSubmitting(false);
          return;
        }
      }

      const doPublish = async () => {
        const { count: existingCount } = await supabase
          .from("listings")
          .select("id", { count: "exact", head: true })
          .eq("user_id", user.id);

        let uploaded: string[] = [];
        if (previews.length) {
          setUploading(true);
          setUploadStatus(`Uploading photo 1 of ${previews.length}…`);
          try {
            uploaded = await uploadListingPhotos(
              user.id,
              previews.map((p) => p.file),
              (done, total) => setUploadStatus(`Uploading photo ${done} of ${total}…`),
            );
          } finally {
            setUploading(false);
            setUploadStatus(null);
          }
        }
        const photos: string[] = [...existingPhotos.map((p) => p.path), ...uploaded];

        const hood = NEIGHBORHOODS.find((n) => n.name === form.area);
        const payload = {
          campus_id: form.campus_id,
          title: form.title.trim(),
          description: form.description.trim(),
          type: form.type,
          price: priceNum,
          beds: bedsNum,
          baths: bathsNum,
          area: form.area,
          lat: hood?.lat, lng: hood?.lng,
          furnished: form.furnished,
          utilities_included: form.utilities_included,
          pet_friendly: form.pet_friendly,
          parking: form.parking,
          wifi_included: form.wifi_included,
          available_from: form.available_from || null,
          available_to: form.available_to || null,
          amenities: form.amenities,
          photos,
          deposit_amount: form.deposit_escrow_enabled && form.deposit_amount ? parseFloat(form.deposit_amount) : null,
          deposit_escrow_enabled: form.deposit_escrow_enabled && !!form.deposit_amount,
        };

        let resultId: string | null = null;

        if (isEdit && editListingId) {
          const { error } = await supabase
            .from("listings")
            .update({ ...payload, updated_at: new Date().toISOString() } as any)
            .eq("id", editListingId)
            .eq("user_id", user.id);
          if (error) throw error;
          resultId = editListingId;
        } else {
          const { data: inserted, error } = await supabase
            .from("listings")
            .insert({
              ...payload,
              user_id: user.id,
              pending_review: screen?.scam_risk === "high",
              pending_review_since: screen?.scam_risk === "high" ? new Date().toISOString() : null,
            } as any)
            .select("id")
            .single();
          if (error) throw error;
          resultId = inserted?.id ?? null;
        }

        const campusName = campuses.find((c) => c.id === form.campus_id)?.short_name
          ?? campuses.find((c) => c.id === form.campus_id)?.name
          ?? "your campus";
        toast.success(
          isEdit
            ? "Listing updated."
            : screen?.scam_risk === "high"
              ? "Posted — under brief review before going public"
              : isRelist
                ? `Relisted! Your sublease is live again at ${campusName}.`
                : "Your listing is live! Share it with friends 🎉",
        );
        qc.invalidateQueries({ queryKey: ["listings"] });
        if (resultId) qc.invalidateQueries({ queryKey: ["listing", resultId] });
        onOpenChange(false);
        setPreviews([]);
        setScreenResult(null);
        setPendingForm(null);
        // First-listing → invite dialog; otherwise straight to the new page.
        if (!isEdit && (existingCount ?? 0) === 0) {
          setInviteOpen(true);
        }
        if (resultId) {
          router.navigate({ to: "/listing/$id", params: { id: resultId } });
        } else {
          router.navigate({ to: "/my-listings" });
        }
      };

      if (screen && (screen.quality_score < 40 || screen.warnings.length > 0)) {
        setScreenResult(screen);
        setPendingForm(() => doPublish);
        setSubmitting(false);
        return;
      }

      await doPublish();
    } catch (e: any) {
      console.error("[PostListingDialog] insert failed:", e);
      toast.error(friendlyError(e, "Failed to post listing"));
    } finally {
      setSubmitting(false);
    }
  }

  const descLen = form.description.trim().length;

  return (
    <>
      <Dialog open={open} onOpenChange={onOpenChange}>
        <DialogContent className="max-h-[92vh] max-w-2xl overflow-y-auto">
          <DialogHeader>
            <DialogTitle className="text-2xl">{isEdit ? "Edit your listing" : "Post a sublease"}</DialogTitle>
          </DialogHeader>
          <div className="space-y-4">
            {!isEdit && (() => {
              const basicsDone = !!(form.title.trim() && form.campus_id && form.price && form.available_from);
              const photosDone = (existingPhotos.length + previews.length) > 0;
              const detailsDone = form.description.trim().length >= 30;
              const steps: Array<{ label: string; done: boolean }> = [
                { label: "Basics", done: basicsDone },
                { label: "Photos", done: photosDone },
                { label: "Details", done: detailsDone },
              ];
              const currentIdx = steps.findIndex((s) => !s.done);
              const activeIdx = currentIdx === -1 ? steps.length - 1 : currentIdx;
              return (
                <div className="flex items-center gap-2 text-xs font-semibold" aria-label="Post progress">
                  {steps.map((s, i) => (
                    <div key={s.label} className="flex flex-1 items-center gap-2">
                      <div className={cn(
                        "flex items-center gap-1.5 rounded-full px-3 py-1",
                        s.done ? "bg-green-100 text-green-800 dark:bg-green-500/20 dark:text-green-200"
                          : i === activeIdx ? "bg-primary text-primary-foreground"
                          : "bg-muted text-muted-foreground",
                      )}>
                        <span>{s.done ? "✓" : i + 1}</span>
                        <span>{s.label}</span>
                      </div>
                      {i < steps.length - 1 && <div className="h-px flex-1 bg-border" />}
                    </div>
                  ))}
                </div>
              );
            })()}
            {uploadStatus && (
              <div className="flex items-center gap-2 rounded-lg border border-primary/30 bg-primary-light/60 px-3 py-2 text-sm font-semibold text-primary-dark">
                <Loader2 className="h-4 w-4 animate-spin" /> {uploadStatus}
              </div>
            )}
            {isRelist && (
              <div className="rounded-lg border border-gray-200 bg-gray-50 p-3 text-sm text-gray-900 dark:border-border dark:bg-white/5 dark:text-gray-100">
                ℹ️ Relisting from a previous listing — we've pre-filled your info. Update the dates and price, then post.
              </div>
            )}
            <Field label="Title">
              <Input
                value={form.title}
                onChange={(e) => setField("title", e.target.value)}
                placeholder="Cozy 1BR near North Campus"
                maxLength={120}
              />
            </Field>

            <Field label="Campus">
              <div className="rounded-xl border border-border bg-surface px-3 py-2.5">
                <CampusAutocomplete
                  value={campuses.find((c) => c.id === form.campus_id)?.name ?? ""}
                  placeholder="Search your school…"
                  onSelect={(c) => { setPickedCampus(c); setField("campus_id", c.id); }}
                  onClear={() => setField("campus_id", "")}
                />
              </div>
            </Field>

            <div className="grid grid-cols-2 gap-3">
              <Field label="Monthly rent">
                <div className="relative">
                  <span className="pointer-events-none absolute left-3 top-1/2 -translate-y-1/2 text-sm text-muted-foreground">
                    $
                  </span>
                  <Input
                    type="number"
                    inputMode="numeric"
                    min={0}
                    value={form.price}
                    onChange={(e) => setField("price", e.target.value)}
                    placeholder="e.g. 650"
                    className={cn("pl-6 pr-12", (isRelist || isEdit) && "border-2 border-amber-400 focus-visible:ring-amber-500")}
                  />
                  <span className="pointer-events-none absolute right-3 top-1/2 -translate-y-1/2 text-xs font-semibold text-muted-foreground">
                    /mo
                  </span>
                </div>
              </Field>
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
              <Field label="Beds">
                <Input type="number" inputMode="numeric" min={0} value={form.beds} onChange={(e) => setField("beds", e.target.value)} />
              </Field>
              <Field label="Baths">
                <Input type="number" inputMode="decimal" min={0} step="0.5" value={form.baths} onChange={(e) => setField("baths", e.target.value)} />
              </Field>
              <Field label="Neighborhood">
                <Select value={form.area} onValueChange={(v) => setField("area", v)}>
                  <SelectTrigger><SelectValue /></SelectTrigger>
                  <SelectContent>
                    {NEIGHBORHOODS.map((n) => (
                      <SelectItem key={n.name} value={n.name}>{n.name}</SelectItem>
                    ))}
                  </SelectContent>
                </Select>
              </Field>
            </div>

            <PriceGuidance
              campusId={form.campus_id || null}
              beds={form.beds ? parseInt(form.beds) : null}
              price={form.price ? parseInt(form.price) : null}
              onPickMedian={(m: number) => setField("price", String(m))}
            />

            <div className="grid grid-cols-2 gap-3">
              <Field label="Available from">
                <Input
                  type="date"
                  value={form.available_from}
                  onChange={(e) => setField("available_from", e.target.value)}
                  className={cn(isRelist && "border-2 border-amber-400 focus-visible:ring-amber-500")}
                />
                {isRelist && (
                  <p className="mt-1 text-xs text-amber-700 dark:text-amber-300">Set your new dates for this relist</p>
                )}
              </Field>
              <Field label="Available until">
                <Input
                  type="date"
                  value={form.available_to}
                  min={form.available_from || undefined}
                  onChange={(e) => setField("available_to", e.target.value)}
                  className={cn(isRelist && "border-2 border-amber-400 focus-visible:ring-amber-500")}
                />
                {isRelist && (
                  <p className="mt-1 text-xs text-amber-700 dark:text-amber-300">Set your new dates for this relist</p>
                )}
              </Field>
            </div>
            {dateError && (
              <p className="-mt-2 text-xs font-medium text-destructive">{dateError}</p>
            )}

            <Field label="Description">
              <Textarea
                rows={5}
                value={form.description}
                onChange={(e) => setField("description", e.target.value)}
                placeholder="e.g. Fully furnished 1BR near North Campus. Quiet building, great natural light. Subletting for summer internship — all you need is a suitcase."
              />
              {descLen > 0 && descLen < 50 && (
                <p className="mt-1 text-xs text-muted-foreground">
                  Listings with longer descriptions get more messages ({descLen}/50)
                </p>
              )}
            </Field>

            <div className="grid grid-cols-2 gap-3 sm:grid-cols-4">
              <ToggleField label="Furnished" checked={form.furnished} onChange={(v) => setField("furnished", v)} />
              <ToggleField label="Utilities inc." checked={form.utilities_included} onChange={(v) => setField("utilities_included", v)} />
              <ToggleField label="Pet friendly" checked={form.pet_friendly} onChange={(v) => setField("pet_friendly", v)} />
              <ToggleField label="Parking" checked={form.parking} onChange={(v) => setField("parking", v)} />
              <ToggleField label="WiFi inc." checked={form.wifi_included} onChange={(v) => setField("wifi_included", v)} />
            </div>

            <Field label="Amenities">
              <div className="flex flex-wrap gap-1.5">
                {AMENITIES.map((a) => (
                  <button
                    key={a}
                    type="button"
                    onClick={() => toggleAmenity(a)}
                    className={cn(
                      "rounded-full border px-3 py-1 text-xs font-semibold transition",
                      form.amenities.includes(a)
                        ? "border-primary bg-primary-light text-primary-dark"
                        : "border-border text-muted-foreground hover:border-primary",
                    )}
                  >
                    {a}
                  </button>
                ))}
              </div>
            </Field>

            {/* Photo upload */}
            <div className="space-y-2">
              <Label className="text-xs font-bold uppercase text-muted-foreground">
                Photos ({existingPhotos.length + previews.length}/{MAX_PHOTOS})
              </Label>

              {isRelist && existingPhotos.length > 0 && (
                <p className="text-xs text-muted-foreground">
                  Photos from your original listing. Add new ones or remove any that aren't current.
                </p>
              )}

              {existingPhotos.length + previews.length < MAX_PHOTOS && (
                <label
                  className={cn(
                    "flex min-h-[9rem] cursor-pointer flex-col items-center justify-center gap-2 rounded-xl border-2 border-dashed border-border p-6 text-center transition",
                    "hover:border-primary hover:bg-primary/5",
                  )}
                >
                  <ImagePlus className="h-8 w-8 text-muted-foreground" />
                  <span className="text-sm font-bold text-foreground">📷 Add photos</span>
                  <span className="text-xs text-muted-foreground">
                    Tap to choose from your library or take a new photo
                  </span>
                  <input
                    type="file"
                    accept="image/jpeg,image/png,image/webp,image/heic,image/heif,image/*"
                    capture="environment"
                    multiple
                    onChange={onFiles}
                    className="hidden"
                  />
                </label>
              )}

              <p className="text-xs text-muted-foreground">
                Add up to {MAX_PHOTOS} photos · Listings with 3+ photos get significantly more views
              </p>

              {existingPhotos.length + previews.length === 0 && (
                <div className="flex items-start gap-2 rounded-lg border border-amber-300/60 bg-amber-50 p-3 text-xs text-amber-900 dark:border-amber-500/40 dark:bg-amber-500/10 dark:text-amber-100">
                  <AlertTriangle className="mt-0.5 h-4 w-4 shrink-0" />
                  <span>Your listing will get fewer views without photos.</span>
                </div>
              )}

              {(existingPhotos.length + previews.length) > 0 && (
                <div className="grid grid-cols-2 gap-2 sm:grid-cols-3">
                  {existingPhotos.map((p, i) => (
                    <div key={p.path} className="group relative aspect-square overflow-hidden rounded-lg bg-muted">
                      <img src={p.url} alt={`Photo ${i + 1}`} className="h-full w-full object-cover" loading="lazy" />
                      {i === 0 && (
                        <span className="absolute left-1.5 top-1.5 rounded bg-primary px-1.5 py-0.5 text-[9px] font-bold uppercase text-primary-foreground">
                          Cover
                        </span>
                      )}
                      <button
                        type="button"
                        aria-label="Remove photo"
                        onClick={() => setExistingPhotos((prev) => prev.filter((_, idx) => idx !== i))}
                        className="absolute right-1.5 top-1.5 grid h-7 w-7 place-items-center rounded-full bg-black/70 text-white transition hover:bg-black/85"
                      >
                        <X className="h-3.5 w-3.5" />
                      </button>
                    </div>
                  ))}
                  {previews.map((p, i) => (
                    <div key={p.url} className="group relative aspect-square overflow-hidden rounded-lg bg-muted">
                      <img
                        src={p.url}
                        alt={`Photo ${existingPhotos.length + i + 1}`}
                        className="h-full w-full object-cover"
                        loading="lazy"
                      />
                      {existingPhotos.length === 0 && i === 0 && (
                        <span className="absolute left-1.5 top-1.5 rounded bg-primary px-1.5 py-0.5 text-[9px] font-bold uppercase text-primary-foreground">
                          Cover
                        </span>
                      )}
                      <button
                        type="button"
                        aria-label="Remove photo"
                        onClick={() => removePhoto(i)}
                        className="absolute right-1.5 top-1.5 grid h-7 w-7 place-items-center rounded-full bg-black/70 text-white transition hover:bg-black/85"
                      >
                        <X className="h-3.5 w-3.5" />
                      </button>
                      {existingPhotos.length === 0 && i > 0 && (
                        <button
                          type="button"
                          onClick={() => moveToFront(i)}
                          className="absolute inset-x-0 bottom-0 bg-black/60 py-1 text-[10px] font-semibold text-white opacity-0 transition group-hover:opacity-100"
                        >
                          Make cover
                        </button>
                      )}
                    </div>
                  ))}
                </div>
              )}
            </div>

            {/* Secure deposit */}
            <div className="rounded-xl border-2 border-dashed border-success/40 bg-success-light/30 p-4">
              <div className="flex items-center gap-2 text-sm font-bold">
                💰 Secure Deposit
                <span className="rounded-full bg-success/15 px-1.5 py-0.5 text-[10px] font-bold uppercase text-success">Optional</span>
              </div>
              <p className="mt-1 text-xs text-muted-foreground">
                Collect a refundable deposit through LeaseUp. Funds are held until move-in — protects both sides. A 2.5% platform fee is charged to the subletter at payment.
              </p>
              <div className="mt-3 grid grid-cols-2 gap-3">
                <Field label="Deposit amount ($)">
                  <Input
                    type="number"
                    min={0}
                    placeholder="500"
                    value={form.deposit_amount}
                    onChange={(e) => setField("deposit_amount", e.target.value)}
                  />
                </Field>
                <ToggleField
                  label="Enable secure deposit"
                  checked={form.deposit_escrow_enabled}
                  onChange={(v) => setField("deposit_escrow_enabled", v)}
                />
              </div>
            </div>

            <Button
              disabled={submitting || !!dateError}
              onClick={submit}
              className="h-12 w-full bg-primary text-base font-bold text-primary-foreground hover:bg-primary-dark"
            >
              {submitting ? (
                <span className="inline-flex items-center gap-2">
                  <Loader2 className="h-4 w-4 animate-spin" />
                  {uploading ? "Uploading photos…" : isEdit ? "Saving…" : "Posting…"}
                </span>
              ) : (
                <span className="inline-flex items-center gap-2">
                  {isEdit ? "Save changes" : "Post listing"}
                  <ArrowRight className="h-4 w-4" />
                </span>
              )}
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
                  <div className="rounded-lg bg-amber-50 p-2 text-amber-900 dark:bg-amber-500/10 dark:text-amber-100">
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
                <Button
                  className="flex-1"
                  onClick={async () => {
                    const fn = pendingForm;
                    setScreenResult(null);
                    setPendingForm(null);
                    if (fn) {
                      setSubmitting(true);
                      try { await fn(); } finally { setSubmitting(false); }
                    }
                  }}
                >
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
  return (
    <div className="space-y-1.5">
      <Label className="text-xs font-bold uppercase text-muted-foreground">{label}</Label>
      {children}
    </div>
  );
}

function ToggleField({ label, checked, onChange }: { label: string; checked: boolean; onChange: (v: boolean) => void }) {
  return (
    <button
      type="button"
      onClick={() => onChange(!checked)}
      className={cn(
        "flex items-center justify-between rounded-lg border px-3 py-2 text-xs font-semibold transition",
        checked
          ? "border-primary bg-primary-light text-primary-dark"
          : "border-border text-muted-foreground hover:border-primary",
      )}
    >
      <span>{label}</span>
      <span
        aria-hidden
        className={cn(
          "grid h-4 w-4 place-items-center rounded-full border",
          checked ? "border-primary bg-primary text-primary-foreground" : "border-muted-foreground/40",
        )}
      >
        {checked ? "✓" : ""}
      </span>
    </button>
  );
}
