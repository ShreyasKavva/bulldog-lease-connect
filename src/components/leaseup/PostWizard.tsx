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
import { X, Minus, Plus, ImagePlus, ImageOff, Loader2, Star } from "lucide-react";
import { cn } from "@/lib/utils";
import { supabase } from "@/integrations/supabase/client";
import { fetchCampuses, type Campus } from "@/lib/leaseup/campuses";
import { CampusAutocomplete } from "@/components/leaseup/CampusAutocomplete";
import { CampusAvgPriceHint } from "@/components/leaseup/CampusAvgPriceHint";
import { EstimatedReach } from "@/components/leaseup/EstimatedReach";
import { uploadListingPhotos } from "@/lib/leaseup/queries";
import { RoommatePrefsSection } from "@/components/leaseup/RoommatePrefsSection";
import { termPresets, isQuarterSystem } from "@/lib/leaseup/academic-calendar";
import { hasRoommatePrefs, type RoommatePrefs } from "@/lib/leaseup/roommate-prefs";

const DRAFT_KEY = "leaseup-post-draft";
/** Q181 — remembers which draft id the user waved off, so it never nags again. */
const DISMISSED_KEY = "leaseup-post-draft-dismissed";

function draftId() {
  try {
    const raw = localStorage.getItem(DRAFT_KEY);
    const parsed = raw ? JSON.parse(raw) : null;
    if (parsed?.draftId) return parsed.draftId as string;
  } catch { /* noop */ }
  return `d${Date.now()}`;
}
const MAX_PHOTOS = 10;

/** Q157 — "2h ago" style label for the draft-recovery banner. */
function relativeSince(ts: number) {
  const m = Math.max(1, Math.round((Date.now() - ts) / 60000));
  if (m < 60) return `${m} minute${m === 1 ? "" : "s"} ago`;
  const h = Math.round(m / 60);
  if (h < 24) return `${h} hour${h === 1 ? "" : "s"} ago`;
  const day = Math.round(h / 24);
  return `${day} day${day === 1 ? "" : "s"} ago`;
}



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
  roommatePrefs: RoommatePrefs;
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
  roommatePrefs: {},
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

  // Q157 — draft recovery: a saved draft is offered, never silently restored.
  const [recovered, setRecovered] = useState<{ draft: Draft; savedAt: number; draftId?: string } | null>(null);

  const set = (patch: Partial<Draft>) => setD((p) => ({ ...p, ...patch }));

  useEffect(() => {
    fetchCampuses().then(setCampuses).catch(() => setCampuses([]));
    try {
      const raw = localStorage.getItem(DRAFT_KEY);
      if (raw) {
        const parsed = JSON.parse(raw) as Draft & { savedAt?: number; draftId?: string };
        const savedAt = typeof parsed?.savedAt === "number" ? parsed.savedAt : 0;
        // Q181 — only offer a draft that is actually worth resuming.
        const fresh = savedAt > 0 && Date.now() - savedAt < 14 * 24 * 60 * 60 * 1000;
        const meaningful = !!(parsed?.campusId || parsed?.price || parsed?.title?.trim());
        const datesPast =
          !!parsed?.availableTo && new Date(parsed.availableTo).getTime() < Date.now();
        const dismissed =
          !!parsed?.draftId && localStorage.getItem(DISMISSED_KEY) === parsed.draftId;
        if (fresh && meaningful && !datesPast && !dismissed) {
          setRecovered({ draft: { ...EMPTY, ...parsed, step: 1 }, savedAt, draftId: parsed.draftId });
        } else if (!dismissed) {
          localStorage.removeItem(DRAFT_KEY);
        }
      }
    } catch { /* ignore bad draft */ }
    // Always start fresh at step 1 on mount (SPA navigation keeps state otherwise).
    setD((p) => ({ ...p, step: 1 }));
  }, []);

  // Keep the newest form state for the interval / unload writers.
  const draftRef = useRef(d);
  draftRef.current = d;
  const blockedRef = useRef(false);
  blockedRef.current = !!recovered;

  useEffect(() => {
    const save = () => {
      // Don't clobber a recoverable draft the user hasn't answered on yet.
      if (blockedRef.current) return;
      const cur = draftRef.current;
      // Q181 — a draft is only real once a campus, price or title exists.
      if (!cur.campusId && !cur.price && !cur.title?.trim()) return;
      try {
        localStorage.setItem(DRAFT_KEY, JSON.stringify({ ...cur, draftId: draftId(), savedAt: Date.now() }));
      } catch { /* quota */ }
    };
    const id = window.setInterval(save, 60_000);
    window.addEventListener("beforeunload", save);
    return () => {
      window.clearInterval(id);
      window.removeEventListener("beforeunload", save);
      save();
    };
  }, []);

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
        const url = await signPath("listing-photos", path, { ttl: 60 * 60 * 24 });
        setD((p) => ({ ...p, photos: [...p.photos, { path, url: url ?? "" }] }));
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

  /** Q163 — step 2 → preview. Validates photos before showing the preview card. */
  function goPreview() {
    const validUrls = d.photoUrls.map((u) => u.trim()).filter((u) => u && urlOk[u]);
    if (d.photos.length === 0 && validUrls.length === 0) {
      setPhotoError("Please add at least 1 photo");
      return;
    }
    setPhotoError(null);
    set({ step: 3 });
    if (typeof window !== "undefined") window.scrollTo({ top: 0 });
  }



  async function publish() {
    if (publishing) return;
    const validUrls = d.photoUrls.map((u) => u.trim()).filter((u) => u && urlOk[u]);
    if (d.photos.length === 0 && validUrls.length === 0) {
      setPhotoError("Please add at least 1 photo");
      return;
    }
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
          photos: [...d.photos.map((p) => p.path), ...validUrls],
          available_from: d.availableFrom || null,
          available_to: d.availableTo || null,
          roommate_prefs: hasRoommatePrefs(d.roommatePrefs) ? d.roommatePrefs : null,
          is_active: true,
          status: "active",
        })
        .select("id")
        .single();
      if (err) throw err;
      // Q181 — the draft became a live listing: it is dead, never prompt again.
      try { localStorage.removeItem(DRAFT_KEY); localStorage.removeItem(DISMISSED_KEY); } catch { /* noop */ }
      toast.success("Your sublease is live! 🎉");
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
            style={{ width: d.step === 1 ? "33%" : d.step === 2 ? "66%" : "100%" }}
          />
        </div>

        <div className="flex items-center justify-between px-6 py-4">
          <Link to="/" className="text-xl font-bold">LeaseUp</Link>
          <button
            type="button"
            onClick={() => {
              try {
                localStorage.setItem(DRAFT_KEY, JSON.stringify({ ...draftRef.current, draftId: draftId(), savedAt: Date.now() }));
              } catch { /* quota */ }
              toast.success("Draft saved");
              navigate({ to: "/" });
            }}
            className="text-sm text-gray-500 transition hover:text-gray-900 dark:hover:text-foreground"
          >
            Save &amp; exit
          </button>
        </div>
      </div>

      <main className="mx-auto w-full max-w-xl flex-1 px-4 py-10 pb-24 sm:px-6">
        {/* Q157 — resume an unfinished draft */}
        {recovered && (
          <div className="mb-6 flex flex-wrap items-center gap-3 rounded-xl border border-amber-200 bg-amber-50 px-4 py-3 text-sm text-amber-800 dark:border-amber-500/30 dark:bg-amber-500/10 dark:text-amber-200">
            <span className="flex-1">
              📝 Resume your draft from {relativeSince(recovered.savedAt)}?
            </span>
            <button
              type="button"
              onClick={() => { setD({ ...recovered.draft, step: 1 }); setRecovered(null); }}
              className="rounded-lg bg-amber-600 px-3 py-1.5 text-xs font-semibold text-white hover:bg-amber-700"
            >
              Resume
            </button>
            <button
              type="button"
              onClick={() => {
                // Q181 — remember the dismissal so this draft never nags again.
                try {
                  if (recovered.draftId) localStorage.setItem(DISMISSED_KEY, recovered.draftId);
                  localStorage.removeItem(DRAFT_KEY);
                } catch { /* noop */ }
                setRecovered(null);
              }}
              className="rounded-lg border border-amber-300 px-3 py-1.5 text-xs font-semibold hover:bg-amber-100 dark:hover:bg-amber-500/20"
            >
              Start fresh
            </button>
          </div>
        )}
        {d.step === 1 ? (
          <>
            <p className="mb-6 text-xs text-gray-400">Step 1 of 3 — Basic details</p>
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
                {(() => {
                  if (d.title.trim().length > 0) return null;
                  const campusName = campuses.find((c) => c.id === d.campusId)?.name;
                  const price = Number(d.price);
                  if (!campusName || !(price > 0)) return null;
                  const beds = Number(d.beds ?? 0);
                  const bedLabel = beds === 0 ? "Studio" : beds >= 4 ? "4BR+" : `${beds}BR`;
                  const suggested = `${bedLabel} sublease near ${campusName} — $${price}/mo`;
                  return (
                    <button
                      type="button"
                      onClick={() => set({ title: suggested })}
                      className="mt-1.5 flex w-full cursor-pointer items-center justify-between gap-2 rounded-lg bg-indigo-50 px-3 py-2 text-left text-xs text-indigo-600 dark:bg-indigo-500/10 dark:text-indigo-300"
                    >
                      <span className="truncate">💡 Try: "{suggested}"</span>
                      <span className="shrink-0 font-semibold">Use →</span>
                    </button>
                  );
                })()}
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
                {/* Q179 — typeahead over every accredited US school. */}
                <div className="rounded-xl border border-border bg-background px-3 py-2.5">
                  <CampusAutocomplete
                    value={campuses.find((c) => c.id === d.campusId)?.name ?? ""}
                    placeholder="Search your school…"
                    onSelect={(c) => {
                      setCampuses((prev) => (prev.some((x) => x.id === c.id) ? prev : [...prev, c]));
                      set({ campusId: c.id });
                    }}
                    onClear={() => set({ campusId: "" })}
                  />
                </div>
                <EstimatedReach
                  campusId={d.campusId}
                  campusName={campuses.find((c) => c.id === d.campusId)?.name}
                />
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
                <CampusAvgPriceHint
                  campusId={d.campusId}
                  campusName={campuses.find((c) => c.id === d.campusId)?.name}
                />
              </div>

              <div>
                <div className="mb-3 flex flex-wrap gap-2 [&>button]:flex-1 [&>button]:min-w-[7.5rem] sm:[&>button]:flex-none sm:[&>button]:min-w-0">
                  {termPresets(campuses.find((c) => c.id === d.campusId)?.name).map((p) => {
                    const active = d.availableFrom === p.from && d.availableTo === p.to;
                    return (
                      <button
                        key={p.label}
                        type="button"
                        onClick={() => set({ availableFrom: p.from, availableTo: p.to })}
                        className={cn(
                          "rounded-full border px-3.5 py-1.5 text-sm font-medium transition",
                          active
                            ? "border-gray-900 bg-gray-900 text-white dark:border-white dark:bg-white dark:text-gray-900"
                            : "border-gray-300 hover:border-gray-500 dark:border-border",
                        )}
                      >
                        {p.label}
                      </button>
                    );
                  })}
                </div>
                {isQuarterSystem(campuses.find((c) => c.id === d.campusId)?.name) && (
                  <p className="mb-3 text-xs text-muted-foreground">
                    {campuses.find((c) => c.id === d.campusId)?.short_name ?? "This school"} runs on quarters — these dates match its quarter calendar.
                  </p>
                )}
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
        ) : d.step === 2 ? (
          <>
            <p className="mb-6 text-xs text-gray-400">Step 2 of 3 — Photos &amp; details</p>

            <div className="space-y-8">
              <div>
                <div className="mb-1 flex items-baseline justify-between gap-3">
                  <label className="block text-sm font-medium">Photos (up to {MAX_PHOTOS})</label>
                  <span className="text-xs text-gray-500">{d.photos.length} / {MAX_PHOTOS} photos added</span>
                </div>
                <p className="mb-3 text-xs text-gray-500">
                  Add at least 3 photos — listings with photos get 5× more views
                </p>
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
                    {d.photos.map((p, i) => (
                      <div key={p.path} className="relative overflow-hidden rounded-xl bg-muted">
                        <img src={p.url} alt="" className="h-32 w-full object-cover" />
                        {i === 0 && (
                          <span className="absolute left-2 top-2 inline-flex items-center gap-1 rounded-full bg-gray-900/85 px-2 py-1 text-[11px] font-medium text-white">
                            <Star className="h-3 w-3 fill-current" />
                            Cover photo
                          </span>
                        )}
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

              <RoommatePrefsSection
                value={d.roommatePrefs ?? {}}
                onChange={(roommatePrefs) => set({ roommatePrefs })}
              />

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
                  onClick={goPreview}
                  className="rounded-full bg-gray-900 px-6 py-3 font-medium text-white disabled:opacity-50 dark:bg-white dark:text-gray-900"
                >
                  Preview →
                </button>
              </div>
            </div>
          </>
        ) : (
          <>
            <p className="mb-6 text-xs text-gray-400">Step 3 of 3 — Preview</p>
            {(() => {
              const incomplete = d.title.trim().length < 3 || !(Number(d.price) > 0);
              const cover =
                d.photos?.[0]?.url ||
                d.photoUrls?.map((u) => u.trim()).find((u) => u && urlOk[u]) ||
                null;
              const campusName = campuses.find((c) => c.id === d.campusId)?.name ?? null;
              // Show the year whenever the range leaves the current year, so a
              // lease that crosses into next year never reads as ambiguous.
              const years = [d.availableFrom, d.availableTo]
                .filter(Boolean)
                .map((s) => new Date(s as string).getFullYear());
              const showYear =
                years.length > 0 &&
                (new Set(years).size > 1 || years.some((y) => y !== new Date().getFullYear()));
              const fmt = (s?: string | null) =>
                s
                  ? new Date(s).toLocaleDateString("en-US", {
                      month: "short",
                      day: "numeric",
                      ...(showYear ? { year: "numeric" as const } : {}),
                    })
                  : null;
              const dates = [fmt(d.availableFrom), fmt(d.availableTo)].filter(Boolean).join(" – ");
              const photoCount = (d.photos?.length ?? 0) + (d.photoUrls?.filter((u) => u.trim() && urlOk[u.trim()]).length ?? 0);

              if (incomplete) {
                return (
                  <div className="rounded-xl border border-amber-200 bg-amber-50 p-4 text-sm text-amber-800 dark:border-amber-500/30 dark:bg-amber-500/10 dark:text-amber-200">
                    ⚠️ Your listing is missing a title or a monthly rent. Go back and finish step 1 before publishing.
                  </div>
                );
              }

              return (
                <>
                  <p className="mb-3 text-sm font-medium">How your listing will appear to students</p>
                  <div className="overflow-hidden rounded-xl border border-gray-200 bg-white shadow-sm dark:border-border dark:bg-surface">
                    {cover ? (
                      <img src={cover} alt={d.title} className="h-48 w-full object-cover" />
                    ) : (
                      <div className="grid h-48 w-full place-items-center bg-gray-100 text-3xl dark:bg-muted">🏠</div>
                    )}
                    <div className="p-4">
                      <div className="flex items-start justify-between gap-3">
                        <h3 className="min-w-0 flex-1 truncate text-base font-semibold">{d.title}</h3>
                        <span className="shrink-0 font-bold">${Math.round(Number(d.price)).toLocaleString()}/mo</span>
                      </div>
                      {campusName && <p className="mt-1 text-sm text-gray-500">{campusName}</p>}
                      <p className="mt-1 text-sm text-gray-500">
                        {d.beds === 0 ? "Studio" : `${d.beds} bd`} · {d.baths} ba
                        {d.area?.trim() ? ` · ${d.area.trim()}` : ""}
                      </p>
                      {dates && <p className="mt-1 text-xs text-gray-400">{dates}</p>}
                    </div>
                  </div>

                  <p className="mt-4 rounded-xl bg-gray-50 px-3 py-2 text-xs text-gray-600 dark:bg-muted dark:text-muted-foreground">
                    💡 Complete listings get 3x more inquiries. Add at least 3 photos!
                    {photoCount < 3 ? ` You have ${photoCount}.` : ""}
                  </p>

                  <div className="mt-6 flex items-center gap-4">
                    <button
                      type="button"
                      onClick={() => set({ step: 2 })}
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
                      {publishing ? "Posting…" : "✅ Publish listing"}
                    </button>
                  </div>
                </>
              );
            })()}
          </>
        )}

      </main>
    </div>
  );
}
