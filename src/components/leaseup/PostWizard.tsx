/**
 * PostWizard — 2-step "Post a sublease" flow (Q112).
 *
 * Step 1: the basics (title, type, campus, rent, dates, neighborhood).
 * Step 2: photos & details (photos, beds/baths, furnished, description, amenities).
 * State persists in localStorage so Back never loses step 1.
 */
import { useEffect, useRef, useState } from "react";
import { Link, useNavigate } from "@tanstack/react-router";
import { toast } from "sonner";
import { X, Minus, Plus, ImagePlus, ImageOff, Loader2 } from "lucide-react";
import { cn } from "@/lib/utils";
import { supabase } from "@/integrations/supabase/client";
import { fetchCampuses, type Campus } from "@/lib/leaseup/campuses";
import { uploadListingPhotos } from "@/lib/leaseup/queries";

const DRAFT_KEY = "leaseup-post-draft";
const MAX_PHOTOS = 5;

const PLACE_TYPES = [
  { id: "entire", label: "Entire Place" },
  { id: "private", label: "Private Room" },
  { id: "shared", label: "Shared Room" },
] as const;

const AMENITIES = [
  { id: "laundry", label: "In-unit laundry" },
  { id: "parking", label: "Parking" },
  { id: "pet_friendly", label: "Pet-friendly" },
  { id: "ac", label: "AC" },
  { id: "gym", label: "Gym" },
  { id: "pool", label: "Pool" },
  { id: "utilities_included", label: "Utilities included" },
  { id: "furnished", label: "Furnished" },
  { id: "bus", label: "Near bus stop" },
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
  photoUrls: string[];
  amenities: string[];
  furnished: boolean;
  price: string;
  availableFrom: string;
  availableTo: string;
  description: string;
};

const EMPTY: Draft = {
  step: 1,
  placeType: "entire",
  title: "",
  campusId: "",
  area: "",
  beds: 1,
  baths: 1,
  photos: [],
  photoUrls: [""],
  amenities: [],
  furnished: false,
  price: "",
  availableFrom: "",
  availableTo: "",
  description: "",
};

/**
 * One "paste a photo URL" row. After a 600ms debounce the URL is loaded into
 * an offscreen Image; a thumbnail shows on success, a broken-image box on
 * failure. SSR-safe: the Image is only constructed inside the effect.
 */
function PhotoUrlRow({
  value, onChange, onRemove, onStatus, canRemove,
}: {
  value: string;
  onChange: (v: string) => void;
  onRemove: () => void;
  onStatus: (ok: boolean) => void;
  canRemove: boolean;
}) {
  const [status, setStatus] = useState<"idle" | "loading" | "ok" | "error">("idle");

  useEffect(() => {
    const url = value.trim();
    if (!url) { setStatus("idle"); onStatus(false); return; }
    setStatus("loading");
    let cancelled = false;
    const t = setTimeout(() => {
      const img = new Image();
      img.onload = () => { if (!cancelled) { setStatus("ok"); onStatus(true); } };
      img.onerror = () => { if (!cancelled) { setStatus("error"); onStatus(false); } };
      img.src = url;
    }, 600);
    return () => { cancelled = true; clearTimeout(t); };
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [value]);

  return (
    <div className="flex items-center gap-3">
      <input
        className={inputCls("py-2.5 text-sm")}
        value={value}
        onChange={(e) => onChange(e.target.value)}
        placeholder="https://example.com/room.jpg"
      />
      {status === "ok" ? (
        <img
          src={value.trim()}
          alt="Photo preview"
          className="h-12 w-16 shrink-0 rounded-lg object-cover"
        />
      ) : status === "error" ? (
        <span
          title="URL didn't load — try a direct image link"
          className="grid h-12 w-16 shrink-0 place-items-center rounded-lg bg-gray-100 dark:bg-white/10"
        >
          <ImageOff className="h-5 w-5 text-gray-300" />
        </span>
      ) : (
        <span className="grid h-12 w-16 shrink-0 place-items-center rounded-lg bg-gray-100 dark:bg-white/10">
          {status === "loading" ? <Loader2 className="h-4 w-4 animate-spin text-gray-400" /> : null}
        </span>
      )}
      {canRemove ? (
        <button
          type="button"
          onClick={onRemove}
          aria-label="Remove photo URL"
          className="grid h-8 w-8 shrink-0 place-items-center rounded-full text-gray-400 hover:bg-gray-100 hover:text-gray-900 dark:hover:bg-white/10"
        >
          <X className="h-4 w-4" />
        </button>
      ) : (
        <span className="h-8 w-8 shrink-0" />
      )}
    </div>
  );
}

function inputCls(extra?: string) {
  return cn(
    "w-full rounded-xl border border-gray-300 px-4 py-3 text-base outline-none transition focus:border-gray-900 dark:border-border dark:bg-background",
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
    "flex h-9 w-9 items-center justify-center rounded-full border border-gray-300 text-gray-700 transition hover:border-gray-900 disabled:opacity-40 dark:border-border dark:text-foreground";
  return (
    <div className="flex items-center gap-4">
      <button type="button" className={btn} disabled={value <= min} onClick={() => onChange(Math.max(min, +(value - step).toFixed(1)))}>
        <Minus className="h-4 w-4" />
      </button>
      <span className="min-w-[72px] text-center text-base font-medium">{format ? format(value) : value}</span>
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
  const [uploading, setUploading] = useState<string | null>(null);
  const [photoError, setPhotoError] = useState<string | null>(null);
  const [publishing, setPublishing] = useState(false);
  const [dragging, setDragging] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [urlOk, setUrlOk] = useState<Record<string, boolean>>({});
  const fileRef = useRef<HTMLInputElement>(null);

  const set = (patch: Partial<Draft>) => setD((p) => ({ ...p, ...patch }));

  useEffect(() => {
    fetchCampuses().then(setCampuses).catch(() => setCampuses([]));
    try {
      const raw = localStorage.getItem(DRAFT_KEY);
      if (raw) {
        const parsed = JSON.parse(raw) as Draft;
        if (parsed && (parsed.title || parsed.photos?.length)) setD({ ...EMPTY, ...parsed });
      }
    } catch { /* ignore bad draft */ }
  }, []);

  useEffect(() => {
    try { localStorage.setItem(DRAFT_KEY, JSON.stringify(d)); } catch { /* quota */ }
  }, [d]);

  async function handleFiles(list: FileList | File[]) {
    const files = Array.from(list)
      .filter((f) => f.type.startsWith("image/"))
      .slice(0, MAX_PHOTOS - d.photos.length);
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

  function next() {
    if (d.title.trim().length < 3) return setError("Add a listing title");
    if (!d.campusId) return setError("Pick your campus");
    if (!(Number(d.price) > 0)) return setError("Add a monthly rent");
    if (!d.availableFrom || !d.availableTo) return setError("Add your available dates");
    setError(null);
    set({ step: 2 });
    if (typeof window !== "undefined") window.scrollTo({ top: 0 });
  }

  async function publish() {
    if (publishing) return;
    if (d.photos.length === 0) { setPhotoError("Add at least 1 photo"); return; }
    setPublishing(true);
    try {
      const a = new Set(d.amenities);
      const extras: string[] = [];
      if (a.has("ac")) extras.push("A/C");
      if (a.has("gym")) extras.push("Gym");
      if (a.has("pool")) extras.push("Pool");
      if (a.has("bus")) extras.push("Near bus stop");
      const { data, error: err } = await supabase
        .from("listings")
        .insert({
          user_id: userId,
          campus_id: d.campusId,
          title: d.title.trim(),
          description: d.description.trim() || d.title.trim(),
          type: "sublease",
          price: Math.round(Number(d.price)),
          beds: d.beds,
          baths: d.baths,
          area: d.area.trim() || null,
          furnished: d.furnished || a.has("furnished"),
          utilities_included: a.has("utilities_included"),
          parking: a.has("parking"),
          pet_friendly: a.has("pet_friendly"),
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
      if (err) throw err;
      try { localStorage.removeItem(DRAFT_KEY); } catch { /* noop */ }
      toast.success("Listing posted! 🎉");
      navigate({ to: "/listing/$id", params: { id: data.id } });
    } catch (e: any) {
      toast.error(e?.message ?? "Could not publish listing");
      setPublishing(false);
    }
  }

  return (
    <div className="flex min-h-screen flex-col bg-background">
      <div className="sticky top-0 z-30 bg-background">
        <div className="h-1 w-full bg-gray-200 dark:bg-muted">
          <div
            className="h-1 bg-gray-900 transition-all duration-300 ease-out dark:bg-white"
            style={{ width: d.step === 1 ? "50%" : "100%" }}
          />
        </div>
        <div className="flex items-center justify-between px-6 py-4">
          <Link to="/" className="text-xl font-bold">LeaseUp</Link>
          <button
            type="button"
            onClick={() => { toast.success("Draft saved"); navigate({ to: "/" }); }}
            className="text-sm text-gray-500 transition hover:text-gray-900 dark:hover:text-foreground"
          >
            Save &amp; exit
          </button>
        </div>
      </div>

      <main className="mx-auto w-full max-w-xl flex-1 px-6 py-10 pb-24">
        {d.step === 1 ? (
          <>
            <p className="mb-6 text-xs text-gray-400">Step 1 of 2 — Basic details</p>
            <div className="space-y-6">
              <div>
                <label className="mb-1 block text-sm font-medium">Listing title</label>
                <input
                  className={inputCls()}
                  maxLength={100}
                  value={d.title}
                  onChange={(e) => set({ title: e.target.value })}
                  placeholder="e.g. Cozy 1BR in West Campus"
                />
              </div>

              <div>
                <label className="mb-1 block text-sm font-medium">Listing type</label>
                <div className="flex overflow-hidden rounded-full border border-gray-300 dark:border-border">
                  {PLACE_TYPES.map((t) => (
                    <button
                      key={t.id}
                      type="button"
                      onClick={() => set({ placeType: t.id })}
                      className={cn(
                        "flex-1 px-3 py-2.5 text-sm font-medium transition",
                        d.placeType === t.id ? "bg-gray-900 text-white dark:bg-white dark:text-gray-900" : "hover:bg-muted",
                      )}
                    >
                      {t.label}
                    </button>
                  ))}
                </div>
              </div>

              <div>
                <label className="mb-1 block text-sm font-medium">Campus</label>
                <select className={inputCls("bg-background")} value={d.campusId} onChange={(e) => set({ campusId: e.target.value })}>
                  <option value="">Select your campus</option>
                  {campuses.map((c) => (
                    <option key={c.id} value={c.id}>{c.name}</option>
                  ))}
                </select>
              </div>

              <div>
                <label className="mb-1 block text-sm font-medium">Monthly rent</label>
                <div className="flex items-center gap-2">
                  <span className="text-lg font-semibold">$</span>
                  <input
                    type="number"
                    inputMode="numeric"
                    min={0}
                    className={inputCls()}
                    value={d.price}
                    onChange={(e) => set({ price: e.target.value })}
                    placeholder="750"
                  />
                </div>
              </div>

              <div className="grid grid-cols-1 gap-4 sm:grid-cols-2">
                <div>
                  <label className="mb-1 block text-sm font-medium">Available from</label>
                  <input type="date" className={inputCls()} value={d.availableFrom} onChange={(e) => set({ availableFrom: e.target.value })} />
                </div>
                <div>
                  <label className="mb-1 block text-sm font-medium">Available until</label>
                  <input type="date" className={inputCls()} value={d.availableTo} onChange={(e) => set({ availableTo: e.target.value })} />
                </div>
              </div>

              <div>
                <label className="mb-1 block text-sm font-medium">Address or neighborhood</label>
                <input
                  className={inputCls()}
                  value={d.area}
                  onChange={(e) => set({ area: e.target.value })}
                  placeholder="e.g. 120 W 21st St or West Campus"
                />
              </div>

              {error && <p className="text-sm text-red-600">{error}</p>}

              <button
                type="button"
                onClick={next}
                className="rounded-full bg-gray-900 px-6 py-3 font-medium text-white dark:bg-white dark:text-gray-900"
              >
                Next →
              </button>
            </div>
          </>
        ) : (
          <>
            <p className="mb-6 text-xs text-gray-400">Step 2 of 2 — Photos &amp; details</p>
            <div className="space-y-8">
              <div>
                <label className="mb-1 block text-sm font-medium">Photos (up to {MAX_PHOTOS})</label>
                <input
                  ref={fileRef}
                  type="file"
                  accept="image/*"
                  multiple
                  className="hidden"
                  onChange={(e) => { if (e.target.files) handleFiles(e.target.files); e.target.value = ""; }}
                />
                <div
                  onClick={() => d.photos.length < MAX_PHOTOS && fileRef.current?.click()}
                  onDragOver={(e) => { e.preventDefault(); setDragging(true); }}
                  onDragLeave={() => setDragging(false)}
                  onDrop={(e) => { e.preventDefault(); setDragging(false); handleFiles(e.dataTransfer.files); }}
                  className={cn(
                    "flex h-40 cursor-pointer flex-col items-center justify-center gap-2 rounded-2xl border-2 border-dashed border-gray-300 transition hover:border-gray-500 dark:border-border",
                    dragging && "border-gray-900 bg-muted",
                    d.photos.length >= MAX_PHOTOS && "cursor-not-allowed opacity-50",
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
                      <span className="text-sm font-medium">Click to upload or drag &amp; drop</span>
                      <span className="text-xs text-gray-400">JPG or PNG · {d.photos.length}/{MAX_PHOTOS}</span>
                    </>
                  )}
                </div>
                {photoError && <p className="mt-2 text-sm text-red-600">{photoError}</p>}
                {d.photos.length > 0 && (
                  <div className="mt-4 grid grid-cols-2 gap-3">
                    {d.photos.map((p) => (
                      <div key={p.path} className="relative overflow-hidden rounded-xl bg-muted">
                        <img src={p.url} alt="" className="h-32 w-full object-cover" />
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

                {/* Or paste direct image links */}
                <div className="mt-5 space-y-3 border-t border-gray-100 pt-5 dark:border-border">
                  <p className="text-sm font-medium">Or paste a photo URL</p>
                  {d.photoUrls.map((u, i) => (
                    <PhotoUrlRow
                      key={i}
                      value={u}
                      canRemove={i > 0}
                      onChange={(v) => set({ photoUrls: d.photoUrls.map((x, j) => (j === i ? v : x)) })}
                      onRemove={() => set({ photoUrls: d.photoUrls.filter((_, j) => j !== i) })}
                      onStatus={(ok) =>
                        setUrlOk((prev) => {
                          const nextMap = { ...prev, [u.trim()]: ok };
                          return nextMap;
                        })
                      }
                    />
                  ))}
                  {d.photoUrls[d.photoUrls.length - 1]?.trim() && d.photoUrls.length < MAX_PHOTOS && (
                    <button
                      type="button"
                      onClick={() => set({ photoUrls: [...d.photoUrls, ""] })}
                      className="text-sm font-medium text-gray-600 hover:text-gray-900 dark:text-foreground/70"
                    >
                      Add another photo +
                    </button>
                  )}
                </div>
              </div>

              <div className="flex items-center justify-between border-t border-gray-100 pt-5 dark:border-border">
                <span className="text-sm font-medium">Bedrooms</span>
                <Stepper value={d.beds} min={0} max={6} onChange={(v) => set({ beds: v })} format={(v) => (v === 0 ? "Studio" : String(v))} />
              </div>
              <div className="flex items-center justify-between border-t border-gray-100 pt-5 dark:border-border">
                <span className="text-sm font-medium">Bathrooms</span>
                <Stepper value={d.baths} min={1} max={4} step={0.5} onChange={(v) => set({ baths: v })} />
              </div>

              <div className="flex items-center justify-between border-t border-gray-100 pt-5 dark:border-border">
                <span className="text-sm font-medium">Furnished?</span>
                <button
                  type="button"
                  role="switch"
                  aria-checked={d.furnished}
                  onClick={() => set({ furnished: !d.furnished })}
                  className={cn(
                    "relative h-6 w-11 rounded-full transition",
                    d.furnished ? "bg-gray-900 dark:bg-white" : "bg-gray-300 dark:bg-muted",
                  )}
                >
                  <span
                    className={cn(
                      "absolute top-0.5 h-5 w-5 rounded-full bg-white shadow transition-all dark:bg-gray-900",
                      d.furnished ? "left-[22px]" : "left-0.5",
                    )}
                  />
                </button>
              </div>

              <div>
                <label className="mb-1 block text-sm font-medium">Description</label>
                <textarea
                  rows={6}
                  maxLength={500}
                  className={inputCls("resize-none")}
                  value={d.description}
                  onChange={(e) => set({ description: e.target.value })}
                  placeholder="Describe the space, vibe, and what's included..."
                />
                <div className="mt-1 text-right text-xs text-gray-400">{d.description.length}/500</div>
              </div>

              <div>
                <label className="mb-2 block text-sm font-medium">Amenities</label>
                <div className="grid grid-cols-2 gap-2 sm:grid-cols-3">
                  {AMENITIES.map((a) => {
                    const on = d.amenities.includes(a.id);
                    return (
                      <label key={a.id} className="flex cursor-pointer items-center gap-2 text-sm">
                        <input
                          type="checkbox"
                          checked={on}
                          onChange={() =>
                            set({ amenities: on ? d.amenities.filter((x) => x !== a.id) : [...d.amenities, a.id] })
                          }
                          className="h-4 w-4 rounded border-gray-300 accent-gray-900"
                        />
                        {a.label}
                      </label>
                    );
                  })}
                </div>
              </div>

              <div className="flex items-center gap-4">
                <button
                  type="button"
                  onClick={() => set({ step: 1 })}
                  className="text-sm text-gray-400 hover:text-gray-600"
                >
                  ← Back
                </button>
                <button
                  type="button"
                  disabled={publishing}
                  onClick={publish}
                  className="rounded-full bg-gray-900 px-6 py-3 font-medium text-white disabled:opacity-50 dark:bg-white dark:text-gray-900"
                >
                  {publishing ? "Posting…" : "Post listing →"}
                </button>
              </div>
            </div>
          </>
        )}
      </main>
    </div>
  );
}
