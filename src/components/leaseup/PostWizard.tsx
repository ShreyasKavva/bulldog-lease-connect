/**
 * PostWizard — Airbnb-style "Become a Host" multi-step flow for posting a
 * sublease (Q95). Six steps, progress bar, fixed footer, localStorage draft.
 */
import { useEffect, useMemo, useRef, useState } from "react";
import { Link, useNavigate } from "@tanstack/react-router";
import { toast } from "sonner";
import { Check, X, Minus, Plus, ImagePlus, Loader2 } from "lucide-react";
import { cn } from "@/lib/utils";
import { supabase } from "@/integrations/supabase/client";
import { fetchCampuses, type Campus } from "@/lib/leaseup/campuses";
import { uploadListingPhotos } from "@/lib/leaseup/queries";
import { ListingCard } from "./ListingCard";
import type { Listing } from "@/lib/leaseup/types";

const DRAFT_KEY = "leaseup-post-draft";
const TOTAL_STEPS = 6;

const PLACE_TYPES = [
  { id: "entire", label: "Entire apartment", emoji: "🏢" },
  { id: "private", label: "Private room", emoji: "🚪" },
  { id: "shared", label: "Shared room", emoji: "🛏️" },
  { id: "studio", label: "Studio", emoji: "🏠" },
] as const;

const AMENITIES = [
  { id: "furnished", label: "Furnished" },
  { id: "utilities_included", label: "Utilities included" },
  { id: "parking", label: "Parking" },
  { id: "pet_friendly", label: "Pets allowed" },
  { id: "wifi", label: "WiFi" },
  { id: "laundry", label: "In-unit laundry" },
  { id: "ac", label: "A/C" },
  { id: "gym", label: "Pool/gym" },
] as const;

type Photo = { path: string; url: string };

type Draft = {
  step: number;
  placeType: string;
  title: string;
  campusId: string;
  area: string;
  beds: number;
  baths: number;
  photos: Photo[];
  amenities: string[];
  price: string;
  availableFrom: string;
  availableTo: string;
  description: string;
};

const EMPTY: Draft = {
  step: 1,
  placeType: "",
  title: "",
  campusId: "",
  area: "",
  beds: 1,
  baths: 1,
  photos: [],
  amenities: [],
  price: "",
  availableFrom: "",
  availableTo: "",
  description: "",
};

function labelInput(extra?: string) {
  return cn(
    "w-full rounded-xl border border-gray-300 px-4 py-3 text-base outline-none transition focus:border-gray-900",
    extra,
  );
}

function Stepper({
  value, onChange, min, max, step = 1, format,
}: {
  value: number;
  onChange: (v: number) => void;
  min: number;
  max: number;
  step?: number;
  format?: (v: number) => string;
}) {
  const btn =
    "flex h-9 w-9 items-center justify-center rounded-full border border-gray-300 text-gray-700 transition hover:border-gray-900 disabled:opacity-40";
  return (
    <div className="flex items-center gap-4">
      <button type="button" className={btn} disabled={value <= min} onClick={() => onChange(Math.max(min, +(value - step).toFixed(1)))}>
        <Minus className="h-4 w-4" />
      </button>
      <span className="min-w-[72px] text-center text-base font-medium text-gray-900">
        {format ? format(value) : value}
      </span>
      <button type="button" className={btn} disabled={value >= max} onClick={() => onChange(Math.min(max, +(value + step).toFixed(1)))}>
        <Plus className="h-4 w-4" />
      </button>
    </div>
  );
}

export function PostWizard({ userId }: { userId: string }) {
  const navigate = useNavigate();
  const [d, setD] = useState<Draft>(EMPTY);
  const [campuses, setCampuses] = useState<Campus[]>([]);
  const [draftPrompt, setDraftPrompt] = useState<Draft | null>(null);
  const [uploading, setUploading] = useState<string | null>(null);
  const [photoError, setPhotoError] = useState<string | null>(null);
  const [publishing, setPublishing] = useState(false);
  const [dragging, setDragging] = useState(false);
  const fileRef = useRef<HTMLInputElement>(null);

  const set = (patch: Partial<Draft>) => setD((p) => ({ ...p, ...patch }));

  useEffect(() => {
    fetchCampuses().then(setCampuses).catch(() => setCampuses([]));
    try {
      const raw = localStorage.getItem(DRAFT_KEY);
      if (raw) {
        const parsed = JSON.parse(raw) as Draft;
        if (parsed && (parsed.title || parsed.placeType || parsed.photos?.length)) {
          setDraftPrompt({ ...EMPTY, ...parsed });
        }
      }
    } catch { /* ignore bad draft */ }
  }, []);

  // Persist on step change
  useEffect(() => {
    try {
      localStorage.setItem(DRAFT_KEY, JSON.stringify(d));
    } catch { /* quota */ }
  }, [d.step]); // eslint-disable-line react-hooks/exhaustive-deps

  const checklist = useMemo(
    () => [
      { label: "Title", ok: d.title.trim().length > 2 },
      { label: "Campus", ok: !!d.campusId },
      { label: "At least 1 photo", ok: d.photos.length > 0 },
      { label: "Price", ok: Number(d.price) > 0 },
      { label: "Available from + until", ok: !!d.availableFrom && !!d.availableTo },
    ],
    [d],
  );
  const canPublish = checklist.every((c) => c.ok);

  const stepValid = (() => {
    if (d.step === 1) return !!d.placeType;
    if (d.step === 2) return d.title.trim().length > 2 && !!d.campusId;
    if (d.step === 3) return d.photos.length > 0;
    if (d.step === 5) return Number(d.price) > 0 && !!d.availableFrom && !!d.availableTo;
    return true;
  })();

  async function handleFiles(list: FileList | File[]) {
    const files = Array.from(list).filter((f) => f.type.startsWith("image/"));
    if (!files.length) return;
    setPhotoError(null);
    try {
      for (const file of files) {
        setUploading(file.name);
        const [path] = await uploadListingPhotos(userId, [file]);
        const { data } = await supabase.storage.from("listing-photos").createSignedUrl(path, 60 * 60 * 24);
        setD((p) => ({ ...p, photos: [...p.photos, { path, url: data?.signedUrl ?? "" }] }));
      }
    } catch (e: any) {
      setPhotoError(e?.message ?? "Upload failed");
    } finally {
      setUploading(null);
    }
  }

  async function publish() {
    if (!canPublish || publishing) return;
    setPublishing(true);
    try {
      const a = new Set(d.amenities);
      const extras: string[] = [];
      if (a.has("ac")) extras.push("A/C");
      if (a.has("gym")) extras.push("Pool/gym");
      const beds = d.placeType === "studio" ? 0 : d.beds;
      const { data, error } = await supabase
        .from("listings")
        .insert({
          user_id: userId,
          campus_id: d.campusId,
          title: d.title.trim(),
          description: d.description.trim() || d.title.trim(),
          type: "sublease",
          price: Math.round(Number(d.price)),
          beds,
          baths: d.baths,
          area: d.area.trim() || null,
          furnished: a.has("furnished"),
          utilities_included: a.has("utilities_included"),
          parking: a.has("parking"),
          pet_friendly: a.has("pet_friendly"),
          wifi_included: a.has("wifi"),
          laundry: a.has("laundry") ? "in-unit" : null,
          amenities: extras,
          photos: d.photos.map((p) => p.path),
          available_from: d.availableFrom || null,
          available_to: d.availableTo || null,
          is_active: true,
          status: "active",
        })
        .select("id")
        .single();
      if (error) throw error;
      try { localStorage.removeItem(DRAFT_KEY); } catch { /* noop */ }
      toast.success("Your listing is live! 🎉");
      navigate({ to: "/listing/$id", params: { id: data.id } });
    } catch (e: any) {
      toast.error(e?.message ?? "Could not publish listing");
      setPublishing(false);
    }
  }

  const previewListing = {
    id: "preview",
    user_id: userId,
    campus_id: d.campusId,
    title: d.title || "Your listing title",
    description: d.description,
    type: "sublease",
    price: Number(d.price) || 0,
    beds: d.placeType === "studio" ? 0 : d.beds,
    baths: d.baths,
    area: d.area || null,
    lat: null,
    lng: null,
    furnished: d.amenities.includes("furnished"),
    utilities_included: d.amenities.includes("utilities_included"),
    pet_friendly: d.amenities.includes("pet_friendly"),
    parking: d.amenities.includes("parking"),
    available_from: d.availableFrom || null,
    available_to: d.availableTo || null,
    amenities: [],
    photos: d.photos.map((p) => p.path),
    photo_urls: d.photos.map((p) => p.url),
    is_active: true,
    safe_score: null,
    created_at: new Date().toISOString(),
  } as unknown as Listing;

  return (
    <div className="flex min-h-screen flex-col bg-white">
      {/* progress */}
      <div className="sticky top-0 z-30 bg-white">
        <div className="h-1 w-full bg-gray-200">
          <div
            className="h-1 bg-gray-900 transition-all duration-300 ease-out"
            style={{ width: `${(d.step / TOTAL_STEPS) * 100}%` }}
          />
        </div>
        <div className="flex items-center justify-between px-6 py-4">
          <Link to="/" className="text-xl font-bold text-gray-900">LeaseUp</Link>
          <button
            type="button"
            onClick={() => {
              try { localStorage.setItem(DRAFT_KEY, JSON.stringify(d)); } catch { /* noop */ }
              toast.success("Draft saved");
              navigate({ to: "/" });
            }}
            className="text-sm text-gray-500 transition hover:text-gray-900"
          >
            Save &amp; exit
          </button>
        </div>
      </div>

      {draftPrompt && (
        <div className="mx-auto mt-2 flex w-full max-w-xl items-center justify-between gap-4 rounded-2xl border border-gray-200 bg-gray-50 px-5 py-3">
          <span className="text-sm font-medium text-gray-900">Continue your draft?</span>
          <div className="flex items-center gap-3">
            <button
              type="button"
              onClick={() => { setD(draftPrompt); setDraftPrompt(null); }}
              className="rounded-full bg-gray-900 px-4 py-2 text-sm font-semibold text-white"
            >
              Continue
            </button>
            <button
              type="button"
              onClick={() => { setDraftPrompt(null); try { localStorage.removeItem(DRAFT_KEY); } catch { /* noop */ } }}
              className="text-sm text-gray-500"
            >
              Start fresh
            </button>
          </div>
        </div>
      )}

      <main className="mx-auto w-full max-w-xl flex-1 px-6 py-12 pb-40 md:py-16">
        {d.step === 1 && (
          <>
            <h1 className="text-2xl font-bold text-gray-900">What kind of place are you listing?</h1>
            <div className="mt-8 grid grid-cols-2 gap-4">
              {PLACE_TYPES.map((t) => (
                <button
                  key={t.id}
                  type="button"
                  onClick={() => set({ placeType: t.id })}
                  className={cn(
                    "rounded-2xl border-2 border-gray-200 p-6 text-left transition hover:border-gray-400",
                    d.placeType === t.id && "border-gray-900 bg-gray-50",
                  )}
                >
                  <div className="text-2xl">{t.emoji}</div>
                  <div className="mt-3 text-base font-semibold text-gray-900">{t.label}</div>
                </button>
              ))}
            </div>
          </>
        )}

        {d.step === 2 && (
          <>
            <h1 className="text-2xl font-bold text-gray-900">Tell us about the place</h1>
            <div className="mt-8 space-y-6">
              <div>
                <label className="mb-1 block text-sm font-medium text-gray-700">Title</label>
                <input
                  className={labelInput()}
                  value={d.title}
                  maxLength={100}
                  onChange={(e) => set({ title: e.target.value })}
                  placeholder="e.g. Cozy 1BR near campus"
                />
              </div>
              <div>
                <label className="mb-1 block text-sm font-medium text-gray-700">Campus</label>
                <select className={labelInput("bg-white")} value={d.campusId} onChange={(e) => set({ campusId: e.target.value })}>
                  <option value="">Select your campus</option>
                  {campuses.map((c) => (
                    <option key={c.id} value={c.id}>{c.name}</option>
                  ))}
                </select>
              </div>
              <div>
                <label className="mb-1 block text-sm font-medium text-gray-700">Neighborhood</label>
                <input
                  className={labelInput()}
                  value={d.area}
                  onChange={(e) => set({ area: e.target.value })}
                  placeholder="e.g. Milledge Ave, Five Points"
                />
              </div>
              <div className="flex items-center justify-between border-t border-gray-100 pt-5">
                <span className="text-sm font-medium text-gray-700">Bedrooms</span>
                <Stepper value={d.beds} min={0} max={10} onChange={(v) => set({ beds: v })} format={(v) => (v === 0 ? "Studio" : String(v))} />
              </div>
              <div className="flex items-center justify-between border-t border-gray-100 pt-5">
                <span className="text-sm font-medium text-gray-700">Bathrooms</span>
                <Stepper value={d.baths} min={1} max={10} step={0.5} onChange={(v) => set({ baths: v })} />
              </div>
            </div>
          </>
        )}

        {d.step === 3 && (
          <>
            <h1 className="text-2xl font-bold text-gray-900">Add some photos</h1>
            <p className="mt-2 text-sm text-gray-500">Listings with photos get 3x more inquiries</p>
            <input
              ref={fileRef}
              type="file"
              accept="image/*"
              multiple
              className="hidden"
              onChange={(e) => { if (e.target.files) handleFiles(e.target.files); e.target.value = ""; }}
            />
            <div
              onClick={() => fileRef.current?.click()}
              onDragOver={(e) => { e.preventDefault(); setDragging(true); }}
              onDragLeave={() => setDragging(false)}
              onDrop={(e) => { e.preventDefault(); setDragging(false); handleFiles(e.dataTransfer.files); }}
              className={cn(
                "mt-8 flex h-48 cursor-pointer flex-col items-center justify-center gap-2 rounded-2xl border-2 border-dashed border-gray-300 transition hover:border-gray-500",
                dragging && "border-gray-900 bg-gray-50",
              )}
            >
              {uploading ? (
                <>
                  <Loader2 className="h-6 w-6 animate-spin text-gray-500" />
                  <span className="text-sm text-gray-500">Uploading {uploading}…</span>
                </>
              ) : (
                <>
                  <ImagePlus className="h-7 w-7 text-gray-400" />
                  <span className="text-sm font-medium text-gray-700">Click to upload or drag &amp; drop</span>
                  <span className="text-xs text-gray-400">JPG or PNG</span>
                </>
              )}
            </div>
            {photoError && <p className="mt-3 text-sm text-red-600">{photoError}</p>}
            {d.photos.length > 0 && (
              <div className={cn("mt-6 grid gap-3", d.photos.length >= 3 ? "grid-cols-2" : "grid-cols-1")}>
                {d.photos.map((p, i) => (
                  <div
                    key={p.path}
                    className={cn(
                      "relative overflow-hidden rounded-xl bg-gray-100",
                      d.photos.length >= 3 && i === 0 && "col-span-2",
                    )}
                  >
                    <img src={p.url} alt="" className="h-44 w-full object-cover" />
                    <button
                      type="button"
                      onClick={() => set({ photos: d.photos.filter((x) => x.path !== p.path) })}
                      className="absolute right-2 top-2 rounded-full bg-white/90 p-1.5 shadow"
                    >
                      <X className="h-4 w-4 text-gray-900" />
                    </button>
                  </div>
                ))}
              </div>
            )}
          </>
        )}

        {d.step === 4 && (
          <>
            <h1 className="text-2xl font-bold text-gray-900">What&apos;s included?</h1>
            <div className="mt-8 grid grid-cols-2 gap-3 md:grid-cols-3">
              {AMENITIES.map((a) => {
                const on = d.amenities.includes(a.id);
                return (
                  <button
                    key={a.id}
                    type="button"
                    onClick={() =>
                      set({ amenities: on ? d.amenities.filter((x) => x !== a.id) : [...d.amenities, a.id] })
                    }
                    className={cn(
                      "rounded-xl border-2 border-gray-200 p-4 text-sm font-medium text-gray-900 transition hover:border-gray-400",
                      on && "border-gray-900 bg-gray-50",
                    )}
                  >
                    {a.label}
                  </button>
                );
              })}
            </div>
          </>
        )}

        {d.step === 5 && (
          <>
            <h1 className="text-2xl font-bold text-gray-900">Set your price and availability</h1>
            <div className="mt-8 space-y-6">
              <div>
                <label className="mb-1 block text-sm font-medium text-gray-700">Monthly rent</label>
                <div className="flex items-center gap-2">
                  <span className="text-lg font-semibold text-gray-900">$</span>
                  <input
                    type="number"
                    inputMode="numeric"
                    min={0}
                    className={labelInput()}
                    value={d.price}
                    onChange={(e) => set({ price: e.target.value })}
                    placeholder="750"
                  />
                </div>
              </div>
              <div className="grid grid-cols-1 gap-4 sm:grid-cols-2">
                <div>
                  <label className="mb-1 block text-sm font-medium text-gray-700">Available from</label>
                  <input type="date" className={labelInput()} value={d.availableFrom} onChange={(e) => set({ availableFrom: e.target.value })} />
                </div>
                <div>
                  <label className="mb-1 block text-sm font-medium text-gray-700">Available until</label>
                  <input type="date" className={labelInput()} value={d.availableTo} onChange={(e) => set({ availableTo: e.target.value })} />
                </div>
              </div>
              <div>
                <label className="mb-1 block text-sm font-medium text-gray-700">Description</label>
                <textarea
                  rows={6}
                  maxLength={500}
                  className={labelInput("resize-none")}
                  value={d.description}
                  onChange={(e) => set({ description: e.target.value })}
                  placeholder="Describe your place — what makes it great, what's nearby, house rules..."
                />
                <div className="mt-1 text-right text-xs text-gray-400">{d.description.length}/500</div>
              </div>
            </div>
          </>
        )}

        {d.step === 6 && (
          <>
            <h1 className="text-2xl font-bold text-gray-900">Review your listing</h1>
            <div className="mt-8 max-w-sm">
              <ListingCard listing={previewListing} saved={false} onSave={() => {}} onOpen={() => {}} onHeart={() => {}} />
            </div>
            <ul className="mt-8 space-y-2">
              {checklist.map((c) => (
                <li key={c.label} className="flex items-center gap-2 text-sm">
                  {c.ok ? <Check className="h-4 w-4 text-green-600" /> : <X className="h-4 w-4 text-red-500" />}
                  <span className={c.ok ? "text-gray-700" : "text-red-600"}>{c.label}</span>
                </li>
              ))}
            </ul>
            <button
              type="button"
              disabled={!canPublish || publishing}
              onClick={publish}
              className="mt-8 w-full rounded-full bg-gray-900 py-4 text-lg font-semibold text-white transition disabled:opacity-50"
            >
              {publishing ? "Publishing…" : "Publish listing →"}
            </button>
          </>
        )}
      </main>

      <div className="fixed inset-x-0 bottom-0 z-30 flex items-center justify-between border-t border-gray-100 bg-white px-6 py-4">
        {d.step > 1 ? (
          <button type="button" onClick={() => set({ step: d.step - 1 })} className="text-sm font-medium text-gray-500">
            Back
          </button>
        ) : <span />}
        {d.step < TOTAL_STEPS && (
          <button
            type="button"
            disabled={!stepValid}
            onClick={() => {
              if (d.step === 3 && d.photos.length === 0) { setPhotoError("Add at least 1 photo"); return; }
              set({ step: d.step + 1 });
            }}
            className="rounded-full bg-gray-900 px-8 py-3 font-semibold text-white transition disabled:opacity-50"
          >
            Next →
          </button>
        )}
      </div>
    </div>
  );
}
