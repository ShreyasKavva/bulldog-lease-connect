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
import { X, Minus, Plus, ImagePlus, ImageOff, Loader2, Star, ChevronLeft, ChevronRight } from "lucide-react";
import { cn } from "@/lib/utils";
import { deleteListingPhoto } from "@/lib/leaseup/post-photos";
import { supabase } from "@/integrations/supabase/client";
import { looksLikeStreetAddress, AREA_ADDRESS_ERROR } from "@/lib/leaseup/area";
import { signPath } from "@/lib/leaseup/signed-urls";
import { fetchCampuses, type Campus } from "@/lib/leaseup/campuses";
import { CampusAutocomplete } from "@/components/leaseup/CampusAutocomplete";
import { CampusAvgPriceHint } from "@/components/leaseup/CampusAvgPriceHint";
import { EstimatedReach } from "@/components/leaseup/EstimatedReach";
import { uploadListingPhotos } from "@/lib/leaseup/queries";
import { RoommatePrefsSection } from "@/components/leaseup/RoommatePrefsSection";
import { termPresets, isQuarterSystem } from "@/lib/leaseup/academic-calendar";
import { hasRoommatePrefs, type RoommatePrefs } from "@/lib/leaseup/roommate-prefs";

/**
 * Q451 — drafts are scoped per signed-in user so two students sharing a laptop
 * never see each other's half-written listing. The old shared keys are cleared
 * on mount. Every storage touch is SSR-guarded and wrapped in try/catch.
 */
const LEGACY_DRAFT_KEY = "leaseup-post-draft";
const LEGACY_DISMISSED_KEY = "leaseup-post-draft-dismissed";
const draftKey = (userId: string) => `leaseup-post-draft:${userId}`;
const dismissedKey = (userId: string) => `leaseup-post-draft-dismissed:${userId}`;

function lsGet(key: string): string | null {
  if (typeof window === "undefined") return null;
  try { return window.localStorage.getItem(key); } catch { return null; }
}
function lsSet(key: string, value: string) {
  if (typeof window === "undefined") return;
  try { window.localStorage.setItem(key, value); } catch { /* quota / private mode */ }
}
function lsRemove(key: string) {
  if (typeof window === "undefined") return;
  try { window.localStorage.removeItem(key); } catch { /* noop */ }
}

function draftId(userId: string) {
  try {
    const raw = lsGet(draftKey(userId));
    const parsed = raw ? JSON.parse(raw) : null;
    if (parsed?.draftId) return parsed.draftId as string;
  } catch { /* noop */ }
  return `d${Date.now()}`;
}

const MAX_PHOTOS = 10;
/** Q447 — client-side guards so bad input never reaches the database. */
const MAX_PHOTO_MB = 10;
const MAX_PHOTO_BYTES = MAX_PHOTO_MB * 1024 * 1024;
const MAX_PRICE = 20000;

/** Q447 — a storage failure in student English, never the raw error text. */
function friendlyPhotoError(e: any): string {
  const raw = String(e?.message ?? "").toLowerCase();
  if (raw.includes("exceeded the maximum allowed size") || raw.includes("payload too large") || raw.includes("413")) {
    return `That photo is too large. Try one under ${MAX_PHOTO_MB} MB.`;
  }
  if (raw.includes("row-level security") || raw.includes("unauthorized") || raw.includes("jwt") || raw.includes("401")) {
    return "Your sign-in expired. Open LeaseUp in a new tab, sign in again, then come back — your draft is saved.";
  }
  if (raw.includes("mime") || raw.includes("content type")) {
    return "That file type isn't supported. Upload a JPG or PNG.";
  }
  if (raw.includes("network") || raw.includes("failed to fetch")) {
    return "That upload didn't go through — check your connection and try again.";
  }
  return "That photo didn't upload. Try again, or pick a different photo.";
}

/** Q447 — a publish failure in student English, never a Postgres string. */
function friendlyPublishError(e: any): string {
  const raw = String(e?.message ?? "");
  const low = raw.toLowerCase();
  if (low.includes("row-level security") || low.includes("jwt") || low.includes("not authenticated") || (e?.code === "42501")) {
    return "Your sign-in expired before we could post this. Sign in again — your draft is saved.";
  }
  if (low.includes("price must be greater")) return "Add a monthly rent above $0.";
  if (low.includes("unrealistically high")) return "That rent looks too high — enter the monthly rent, not the whole lease.";
  if (low.includes("end date cannot be before")) return "Your end date is before your start date — go back and fix the dates.";
  if (low.includes("title cannot be empty")) return "Add a listing title before publishing.";
  if (low.includes("description cannot be empty")) return "Add a short description before publishing.";
  if (low.includes("bedrooms must be") || low.includes("bathrooms must be")) return "Check the bedroom and bathroom counts.";
  if (low.includes("banned")) return "This account can't post listings. Email us if you think that's a mistake.";
  if (low.includes("failed to fetch") || low.includes("network")) return "We couldn't reach LeaseUp. Check your connection and try again.";
  return "We couldn't post your listing. Try again in a moment — your draft is saved.";
}

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
          className="grid h-11 w-11 shrink-0 place-items-center rounded-full text-gray-400 hover:bg-gray-100 hover:text-gray-900 dark:hover:bg-white/10"
        >
          <X className="h-4 w-4" />
        </button>
      ) : (
        <span className="h-11 w-11 shrink-0" />
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
    "flex h-11 w-11 items-center justify-center rounded-full border border-gray-300 text-gray-700 transition hover:border-gray-900 disabled:opacity-40 dark:border-border dark:text-foreground";
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
  /** Q470 — index of the thumbnail being dragged (desktop reordering). */
  const [dragIdx, setDragIdx] = useState<number | null>(null);
  const [publishing, setPublishing] = useState(false);
  const [dragging, setDragging] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [urlOk, setUrlOk] = useState<Record<string, boolean>>({});
  const fileRef = useRef<HTMLInputElement>(null);
  /** Q451 — in-flight guard: state updates are async, a ref is not. */
  const publishingRef = useRef(false);
  /**
   * Q479 — once the listing is live the draft is dead. Without this flag the
   * unmount save() below (it runs when publish navigates away) re-wrote the
   * draft that publish had just deleted, so the next visit to /post offered
   * "Resume your draft" for a listing the student had already posted.
   */
  const publishedRef = useRef(false);
  /** Q479 — one photo batch at a time; picker, drag-drop and paste share it. */
  const uploadingRef = useRef(false);


  // Q157 — draft recovery: a saved draft is offered, never silently restored.
  const [recovered, setRecovered] = useState<{ draft: Draft; savedAt: number; draftId?: string } | null>(null);
  // Q451 — confirmation bar after a restore, plus a "re-add your photos" note.
  const [restored, setRestored] = useState<{ hadPhotos: boolean } | null>(null);
  // Q451 — the session died before the insert; keep the form, ask them to sign in.
  const [sessionExpired, setSessionExpired] = useState(false);

  const set = (patch: Partial<Draft>) => setD((p) => ({ ...p, ...patch }));

  const saveDraftNow = () => {
    const cur = draftRef.current;
    lsSet(
      draftKey(userId),
      JSON.stringify({ ...cur, photos: [], draftId: draftId(userId), savedAt: Date.now() }),
    );
  };

  useEffect(() => {
    fetchCampuses().then(setCampuses).catch(() => setCampuses([]));
    // Q451 — retire the account-agnostic keys so a draft can't cross accounts.
    lsRemove(LEGACY_DRAFT_KEY);
    lsRemove(LEGACY_DISMISSED_KEY);
    try {
      const raw = lsGet(draftKey(userId));
      if (raw) {
        const parsed = JSON.parse(raw) as Draft & { savedAt?: number; draftId?: string };
        const savedAt = typeof parsed?.savedAt === "number" ? parsed.savedAt : 0;
        // Q181 — only offer a draft that is actually worth resuming.
        const fresh = savedAt > 0 && Date.now() - savedAt < 14 * 24 * 60 * 60 * 1000;
        const meaningful = !!(parsed?.campusId || parsed?.price || parsed?.title?.trim());
        const datesPast =
          !!parsed?.availableTo && new Date(parsed.availableTo).getTime() < Date.now();
        const dismissed =
          !!parsed?.draftId && lsGet(dismissedKey(userId)) === parsed.draftId;
        if (fresh && meaningful && !datesPast && !dismissed) {
          setRecovered({ draft: { ...EMPTY, ...parsed, step: 1 }, savedAt, draftId: parsed.draftId });
        } else if (!dismissed) {
          lsRemove(draftKey(userId));
        }
      }
    } catch { /* ignore bad draft */ }
    // Always start fresh at step 1 on mount (SPA navigation keeps state otherwise).
    setD((p) => ({ ...p, step: 1 }));
  }, [userId]);

  // Keep the newest form state for the interval / unload writers.
  const draftRef = useRef(d);
  draftRef.current = d;
  const blockedRef = useRef(false);
  blockedRef.current = !!recovered;

  useEffect(() => {
    const save = () => {
      // Don't clobber a recoverable draft the user hasn't answered on yet.
      if (blockedRef.current) return;
      // Q479 — the listing was published; never resurrect its draft.
      if (publishedRef.current) return;
      const cur = draftRef.current;
      // Q181 — a draft is only real once a campus, price or title exists.
      if (!cur.campusId && !cur.price && !cur.title?.trim()) return;
      saveDraftNow();
    };
    const id = window.setInterval(save, 60_000);
    window.addEventListener("beforeunload", save);
    return () => {
      window.clearInterval(id);
      window.removeEventListener("beforeunload", save);
      save();
    };
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [userId]);


  // Q470 — the same size/type checks must cover a pasted screenshot, not just
  // the picker and drag & drop. Only active while the photo step is showing.
  useEffect(() => {
    if (d.step !== 2) return;
    function onPaste(e: ClipboardEvent) {
      const files = Array.from(e.clipboardData?.files ?? []);
      if (files.length) { e.preventDefault(); void handleFiles(files); }
    }
    document.addEventListener("paste", onPaste);
    return () => document.removeEventListener("paste", onPaste);
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [d.step, d.photos.length]);

  async function handleFiles(list: FileList | File[]) {
    // Q479 — a second pick/drop/paste while a batch is still uploading read a
    // stale photo count, so the 10-photo cap could be overshot and the
    // "Uploading…" label jumped between the two batches. One batch at a time.
    if (uploadingRef.current) {
      setPhotoError("Still uploading your last photos — give it a second, then add more.");
      return;
    }
    uploadingRef.current = true;
    try {
      await handleFilesInner(list);
    } finally {
      uploadingRef.current = false;
    }
  }

  async function handleFilesInner(list: FileList | File[]) {
    const all = Array.from(list);
    const picked = all.filter((f) => f.type.startsWith("image/"));
    const notes: string[] = [];
    if (picked.length < all.length) {
      notes.push("Only photos can be uploaded — skipped the other files.");
    }
    // Q447 — phone photos are routinely 10–15 MB; reject before the upload
    // so the student gets a sentence instead of a stalled spinner.
    const tooBig = picked.filter((f) => f.size > MAX_PHOTO_BYTES);
    if (tooBig.length) {
      notes.push(
        `${tooBig.length === 1 ? "That photo is" : `${tooBig.length} photos are`} over ${MAX_PHOTO_MB} MB. Try a smaller photo, or screenshot it first.`,
      );
    }
    const room = Math.max(0, MAX_PHOTOS - d.photos.length);
    const okSize = picked.filter((f) => f.size <= MAX_PHOTO_BYTES);
    const files = okSize.slice(0, room);
    // Q464 — silently dropping extras looked like a failed upload.
    if (okSize.length > files.length) {
      notes.push(`You can add ${MAX_PHOTOS} photos — the extra ${okSize.length - files.length === 1 ? "one wasn't" : "ones weren't"} added.`);
    }
    if (!files.length) {
      setPhotoError(notes.length ? notes.join(" ") : null);
      return;
    }
    // Q464 — one bad file used to abort the whole batch. Upload each on its
    // own so the good photos still land and only the failures are reported.
    let failed = 0;
    for (const file of files) {
      try {
        setUploading(file.name);
        const [path] = await uploadListingPhotos(userId, [file]);
        const url = await signPath("listing-photos", path, { ttl: 60 * 60 * 24 });
        setD((p) => ({ ...p, photos: [...p.photos, { path, url: url ?? "" }] }));
      } catch (e: any) {
        failed += 1;
        // Q447 — never surface the raw storage error to a student.
        if (failed === 1) notes.push(friendlyPhotoError(e));
      }
    }
    setUploading(null);
    if (failed > 1) notes.push(`${failed} photos didn't upload — the rest were added.`);
    setPhotoError(notes.length ? notes.join(" ") : null);
  }

  /** Q470 — removing a photo also deletes the object the student uploaded. */
  function removePhoto(path: string) {
    setD((p) => ({ ...p, photos: p.photos.filter((x) => x.path !== path) }));
    void deleteListingPhoto(path);
  }

  /** Q470 — photo order IS the stored order; index 0 is the cover. */
  function movePhoto(from: number, to: number) {
    setD((p) => {
      if (to < 0 || to >= p.photos.length || from === to) return p;
      const next = [...p.photos];
      const [moved] = next.splice(from, 1);
      next.splice(to, 0, moved);
      return { ...p, photos: next };
    });
  }

  function next() {
    if (d.title.trim().length < 3) return setError("Add a listing title");
    // Q447 — an emoji-only title passes a length check but tells nobody anything.
    if (!/[a-z0-9]/i.test(d.title)) return setError("Give your listing a title students can read — a few words about the place");
    if (!d.campusId) return setError("Pick your campus");
    const price = Number(d.price);
    // Q464 — order matters: "abc" is NaN, which also fails `> 0`, so the
    // number check has to come first or the student gets the wrong sentence.
    if (!d.price.trim()) return setError("Add a monthly rent");
    if (!Number.isFinite(price)) return setError("Enter the monthly rent as a number, like 750");
    if (price < 0) return setError("Rent can't be a negative number");
    if (price === 0) return setError("Add a monthly rent above $0");
    if (!(price > 0)) return setError("Add a monthly rent");
    if (price > MAX_PRICE) return setError(`That rent looks too high — enter the monthly rent, not the whole lease`);
    if (!d.availableFrom || !d.availableTo) return setError("Add your available dates");
    const from = new Date(`${d.availableFrom}T00:00:00`).getTime();
    const to = new Date(`${d.availableTo}T00:00:00`).getTime();
    if (!Number.isFinite(from) || !Number.isFinite(to)) return setError("Check your available dates");
    if (to < from) return setError("Your end date is before your start date — swap them around");
    if (to < Date.now() - 86400000) return setError("Those dates are already in the past — pick dates students can still move in on");
    // Q454 — `area` is public; a street address here is a safety problem.
    if (looksLikeStreetAddress(d.area)) return setError(AREA_ADDRESS_ERROR);
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
    // Q451 — a ref, not the state flag: two clicks in the same tick both read
    // the old `publishing` value, so state alone cannot stop a double insert.
    if (publishingRef.current) return;
    const validUrls = d.photoUrls.map((u) => u.trim()).filter((u) => u && urlOk[u]);
    if (d.photos.length === 0 && validUrls.length === 0) {
      setPhotoError("Please add at least 1 photo");
      return;
    }
    publishingRef.current = true;
    setPublishing(true);
    try {
      // Q451 — if the session died while the form was open, keep everything.
      const { data: sess } = await supabase.auth.getSession();
      if (!sess?.session) {
        saveDraftNow();
        setSessionExpired(true);
        publishingRef.current = false;
        setPublishing(false);
        return;
      }

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
      // Q479 — flag it before navigating: unmount would otherwise re-save it.
      publishedRef.current = true;
      lsRemove(draftKey(userId));
      lsRemove(dismissedKey(userId));
      toast.success("Your sublease is live! 🎉");
      navigate({ to: "/listing/$id", params: { id: data.id } });
    } catch (e: any) {
      // Q451 — an expired session mid-publish keeps the form and the draft.
      const low = String(e?.message ?? "").toLowerCase();
      if (low.includes("jwt") || low.includes("not authenticated") || e?.code === "42501" || low.includes("row-level security")) {
        saveDraftNow();
        setSessionExpired(true);
      } else {
        toast.error(friendlyPublishError(e));
      }
      publishingRef.current = false;
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
              saveDraftNow();
              toast.success("Draft saved");
              navigate({ to: "/" });
            }}

            className="inline-flex min-h-[44px] items-center justify-center rounded-full px-3 text-sm text-gray-500 transition hover:text-gray-900 dark:hover:text-foreground"
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
              onClick={() => {
                // Q451 — photos are never persisted; the student re-adds them.
                const hadPhotos =
                  (recovered.draft.photos?.length ?? 0) > 0 ||
                  !!recovered.draft.photoUrls?.some((u) => u.trim());
                setD({ ...recovered.draft, photos: [], photoUrls: [""], step: 1 });
                setRecovered(null);
                setRestored({ hadPhotos });
              }}
              className="rounded-lg bg-amber-600 px-3 py-1.5 text-xs font-semibold text-white hover:bg-amber-700"
            >
              Resume
            </button>
            <button
              type="button"
              onClick={() => {
                // Q181 — remember the dismissal so this draft never nags again.
                if (recovered.draftId) lsSet(dismissedKey(userId), recovered.draftId);
                lsRemove(draftKey(userId));
                setRecovered(null);
              }}
              className="rounded-lg border border-amber-300 px-3 py-1.5 text-xs font-semibold hover:bg-amber-100 dark:hover:bg-amber-500/20"
            >
              Start fresh
            </button>
          </div>
        )}

        {/* Q451 — post-restore confirmation, dismissible, with a way back to blank. */}
        {restored && (
          <div className="mb-6 flex flex-wrap items-center gap-3 rounded-xl border border-indigo-200 bg-indigo-50 px-4 py-3 text-sm text-indigo-800 dark:border-indigo-500/30 dark:bg-indigo-500/10 dark:text-indigo-200">
            <span className="flex-1">
              We restored your draft.{restored.hadPhotos ? " Photos aren't saved with a draft — please re-add them." : ""}
            </span>
            <button
              type="button"
              onClick={() => {
                setD({ ...EMPTY });
                lsRemove(draftKey(userId));
                setRestored(null);
              }}
              className="rounded-lg border border-indigo-300 px-3 py-1.5 text-xs font-semibold hover:bg-indigo-100 dark:hover:bg-indigo-500/20"
            >
              Start fresh
            </button>
            <button
              type="button"
              onClick={() => setRestored(null)}
              aria-label="Dismiss"
              className="rounded-full p-1 hover:bg-indigo-100 dark:hover:bg-indigo-500/20"
            >
              <X className="h-4 w-4" />
            </button>
          </div>
        )}

        {/* Q451 — session expired at publish: the form and draft are both kept. */}
        {sessionExpired && (
          <div className="mb-6 rounded-xl border border-amber-200 bg-amber-50 px-4 py-3 text-sm text-amber-900 dark:border-amber-500/30 dark:bg-amber-500/10 dark:text-amber-200">
            <p className="font-semibold">You've been signed out</p>
            <p className="mt-1">
              Your listing is saved as a draft — nothing is lost. Sign in again and it'll be waiting here.
            </p>
            <div className="mt-3 flex flex-wrap gap-2">
              <Link
                to="/auth"
                search={{ mode: "in", next: "/post" } as any}
                className="rounded-lg bg-amber-600 px-3 py-1.5 text-xs font-semibold text-white hover:bg-amber-700"
              >
                Sign in again
              </Link>
              <button
                type="button"
                onClick={() => setSessionExpired(false)}
                className="rounded-lg border border-amber-300 px-3 py-1.5 text-xs font-semibold hover:bg-amber-100 dark:hover:bg-amber-500/20"
              >
                Dismiss
              </button>
            </div>
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


              {/* Q470 — "Listing type" was collected but there is no column to
                  store it, so the choice silently vanished on publish. Hidden
                  until a column exists; see the Q470 report for the migration. */}

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
                <label className="mb-1 block text-sm font-medium">Neighborhood</label>
                <input
                  className={inputCls()}
                  maxLength={120}
                  value={d.area}
                  onChange={(e) => set({ area: e.target.value })}
                  placeholder="e.g. West Campus or Five Points"
                />
                <p className="mt-1 text-xs text-gray-500">
                  Neighborhood only — not your street address. Renters see this before you've met them.
                </p>
                {/* Q464 — say plainly where the exact address does go. */}
                <p className="mt-1 text-xs text-gray-500">
                  Your exact address is never on your listing. Share it in messages once you've connected with someone.
                </p>
                {looksLikeStreetAddress(d.area) && (
                  <p className="mt-1 text-xs text-red-600">{AREA_ADDRESS_ERROR}</p>
                )}
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
                  {/* Q479 — dropped an invented "5× more views" statistic. */}
                  Add at least 3 photos — students skip listings they can't see inside
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
                {d.photos.length > 1 && (
                  <p className="mt-3 text-xs text-gray-500 dark:text-foreground/60">
                    The first photo is the one renters see first. Drag a photo, or use the buttons on it, to change the order.
                  </p>
                )}
                {d.photos.length > 0 && (
                  <div className="mt-4 grid grid-cols-2 gap-3">
                    {d.photos.map((p, i) => (
                      <div
                        key={p.path}
                        draggable
                        onDragStart={() => setDragIdx(i)}
                        onDragOver={(e) => e.preventDefault()}
                        onDrop={(e) => { e.preventDefault(); e.stopPropagation(); if (dragIdx !== null) movePhoto(dragIdx, i); setDragIdx(null); }}
                        onDragEnd={() => setDragIdx(null)}
                        className={cn(
                          "relative overflow-hidden rounded-xl bg-muted",
                          dragIdx === i && "opacity-60 ring-2 ring-gray-900 dark:ring-white",
                        )}
                      >
                        <img src={p.url} alt="" className="h-32 w-full object-cover" />
                        {i === 0 && (
                          <span className="absolute left-2 top-2 inline-flex items-center gap-1 rounded-full bg-gray-900/85 px-2 py-1 text-[11px] font-medium text-white">
                            <Star className="h-3 w-3 fill-current" />
                            Cover photo
                          </span>
                        )}
                        <button
                          type="button"
                          onClick={() => removePhoto(p.path)}
                          aria-label="Remove photo"
                          className="absolute right-2 top-2 grid h-11 w-11 place-items-center rounded-full bg-white/90 shadow"
                        >
                          <X className="h-4 w-4 text-gray-900" />
                        </button>
                        {/* Q470 — touch-friendly reordering; drag works on desktop. */}
                        <div className="absolute inset-x-0 bottom-0 flex items-stretch gap-px bg-black/45 backdrop-blur-sm">
                          <button
                            type="button"
                            onClick={() => movePhoto(i, i - 1)}
                            disabled={i === 0}
                            aria-label="Move photo left"
                            className="grid min-h-11 flex-1 place-items-center text-white disabled:opacity-35"
                          >
                            <ChevronLeft className="h-4 w-4" />
                          </button>
                          <button
                            type="button"
                            onClick={() => movePhoto(i, 0)}
                            disabled={i === 0}
                            aria-label="Make this the cover photo"
                            className="min-h-11 flex-[2] px-1 text-[11px] font-semibold text-white disabled:opacity-35"
                          >
                            {i === 0 ? "Cover" : "Make cover"}
                          </button>
                          <button
                            type="button"
                            onClick={() => movePhoto(i, i + 1)}
                            disabled={i === d.photos.length - 1}
                            aria-label="Move photo right"
                            className="grid min-h-11 flex-1 place-items-center text-white disabled:opacity-35"
                          >
                            <ChevronRight className="h-4 w-4" />
                          </button>
                        </div>
                      </div>
                    ))}
                  </div>
                )}

                {/* Or paste direct image links */}
                <div className="mt-5 space-y-3 border-t border-gray-100 pt-5 dark:border-border">
                  <p className="text-sm font-medium">Or paste a photo URL</p>
                  {/* Q451 — testers saw the same stock cover on several listings. */}
                  <p className="text-xs text-gray-500 dark:text-foreground/60">
                    Use real photos of your place. Stock photos get listings taken down, and renters skip them.
                  </p>

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
                      className="inline-flex min-h-[44px] items-center rounded-full text-sm font-medium text-gray-600 hover:text-gray-900 dark:text-foreground/70"
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
                  className="inline-flex min-h-[44px] items-center justify-center rounded-full px-3 text-sm text-gray-400 hover:text-gray-600"
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

                  {/* Q479 — dropped an invented "3x more inquiries" statistic. */}
                  <p className="mt-4 rounded-xl bg-gray-50 px-3 py-2 text-xs text-gray-600 dark:bg-muted dark:text-muted-foreground">
                    💡 Listings with three or more photos are far easier to say yes to.
                    {photoCount < 3 ? ` You have ${photoCount}.` : ""}
                  </p>

                  <div className="mt-6 flex items-center gap-4">
                    <button
                      type="button"
                      onClick={() => set({ step: 2 })}
                      className="inline-flex min-h-[44px] items-center justify-center rounded-full px-3 text-sm text-gray-400 hover:text-gray-600"
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
