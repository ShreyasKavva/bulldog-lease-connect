/**
 * PostWizard — 2-step "Post a sublease" flow (Q112).
 *
 * Step 1: the basics (title, type, campus, rent, dates, neighborhood).
 * Step 2: photos & details (photos, beds/baths, furnished, description, amenities).
 * State persists in localStorage so Back never loses step 1.
 */
import { useEffect, useRef, useState } from "react";
import { Link, useBlocker, useNavigate } from "@tanstack/react-router";
import {
  validateStep1, firstErrorField, validateBeds, validatePhotoFile, isStoragePath,
  TITLE_MAX, DESCRIPTION_MAX, MAX_PRICE, MAX_PHOTO_MB, BEDS_MIN, BEDS_MAX, ALLOWED_PHOTO_TYPES,
  type Step1Errors, type Step1Field,
} from "@/lib/leaseup/post-validation";
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
/** Q447/Q519 — limits live in post-validation.ts so they are unit-tested. */

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

/** Q519 — one indigo focus ring for every control on the page. */
const FOCUS_RING =
  "outline-none focus-visible:ring-2 focus-visible:ring-[#4F46E5] focus-visible:ring-offset-2 focus-visible:ring-offset-background";
const PRIMARY_BTN = cn(
  "inline-flex min-h-11 items-center justify-center rounded-full bg-[#4F46E5] px-6 py-3 font-medium text-white transition hover:bg-[#4338CA] disabled:opacity-60",
  FOCUS_RING,
);
const BACK_BTN = cn(
  "inline-flex min-h-11 items-center justify-center rounded-full px-3 text-sm text-gray-600 hover:text-gray-900 dark:text-muted-foreground dark:hover:text-foreground",
  FOCUS_RING,
);

type PendingUpload = { id: string; name: string; file: File; status: "uploading" | "failed" };

function FieldError({ id, msg }: { id: string; msg?: string | null }) {
  if (!msg) return null;
  return (
    <p id={id} className="mt-1 text-sm text-red-700 dark:text-red-400">
      {msg}
    </p>
  );
}

function inputCls(extra?: string) {
  return cn(
    "w-full min-w-0 rounded-xl border border-gray-400 px-4 py-3 text-base outline-none transition focus:border-[#4F46E5] focus:ring-2 focus:ring-[#4F46E5]/40 aria-[invalid=true]:border-red-600 dark:border-border dark:bg-background",
    extra,
  );
}

function Stepper({
  value, onChange, min, max, step = 1, format, label, labelledBy,
}: {
  value: number;
  onChange: (v: number) => void;
  min: number;
  max: number;
  step?: number;
  format?: (v: number) => string;
  label: string;
  labelledBy: string;
}) {
  const btn = cn(
    "flex h-11 w-11 items-center justify-center rounded-full border border-gray-400 text-gray-700 transition hover:border-gray-900 disabled:opacity-40 dark:border-border dark:text-foreground",
    FOCUS_RING,
  );
  return (
    <div className="flex items-center gap-4" role="group" aria-labelledby={labelledBy}>
      <button type="button" aria-label={`Fewer ${label}`} className={btn} disabled={value <= min} onClick={() => onChange(Math.max(min, +(value - step).toFixed(1)))}>
        <Minus className="h-4 w-4" aria-hidden="true" />
      </button>
      <span className="min-w-[72px] text-center text-base font-medium" aria-live="polite">{format ? format(value) : value}</span>
      <button type="button" aria-label={`More ${label}`} className={btn} disabled={value >= max} onClick={() => onChange(Math.min(max, +(value + step).toFixed(1)))}>
        <Plus className="h-4 w-4" aria-hidden="true" />
      </button>
    </div>
  );
}

export function PostWizard({ userId }: { userId: string }) {
  const navigate = useNavigate();
  const [d, setD] = useState<Draft>(EMPTY);
  const [campuses, setCampuses] = useState<Campus[]>([]);
  const [photoError, setPhotoError] = useState<string | null>(null);
  /** Q470 — index of the thumbnail being dragged (desktop reordering). */
  const [dragIdx, setDragIdx] = useState<number | null>(null);
  const [publishing, setPublishing] = useState(false);
  const [dragging, setDragging] = useState(false);
  /** Q519 — inline, field-linked errors for step 1. */
  const [fieldErrors, setFieldErrors] = useState<Step1Errors>({});
  const [publishError, setPublishError] = useState<string | null>(null);
  const [successId, setSuccessId] = useState<string | null>(null);
  /** Q519 — per-photo upload rows (uploading / failed with Retry). */
  const [pending, setPending] = useState<PendingUpload[]>([]);
  const pendingRef = useRef(pending);
  pendingRef.current = pending;
  const [urlOk, setUrlOk] = useState<Record<string, boolean>>({});
  const fileRef = useRef<HTMLInputElement>(null);
  const campusWrapRef = useRef<HTMLDivElement>(null);
  const successHeadingRef = useRef<HTMLHeadingElement>(null);
  /** Q519 — Save & exit already saves; don't ask "leave?" on top of it. */
  const exitingRef = useRef(false);
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

  const clearFieldError = (k: Step1Field) =>
    setFieldErrors((prev) => {
      if (!prev[k]) return prev;
      const n = { ...prev };
      delete n[k];
      return n;
    });

  const FIELD_IDS: Record<Step1Field, string> = {
    title: "post-title", campus: "post-campus", price: "post-price",
    availableFrom: "post-from", availableTo: "post-to", area: "post-area",
  };
  const describedBy = (k: Step1Field, extra?: string) =>
    [extra, fieldErrors[k] ? `${FIELD_IDS[k]}-error` : null].filter(Boolean).join(" ") || undefined;

  function focusField(k: Step1Field) {
    if (typeof document === "undefined") return;
    const el = document.getElementById(FIELD_IDS[k]) as HTMLElement | null;
    el?.focus();
    el?.scrollIntoView?.({ block: "center" });
  }

  // Q519 — CampusAutocomplete owns its <input>; give it the id/ARIA the label
  // and inline error need. Runs client-side only (SSR-safe).
  useEffect(() => {
    const input = campusWrapRef.current?.querySelector("input");
    if (!input) return;
    input.id = "post-campus";
    input.setAttribute("aria-label", "Campus");
    input.style.minHeight = "44px";
    campusWrapRef.current?.querySelectorAll<HTMLElement>("[role=option]").forEach((o) => { o.style.minHeight = "44px"; });
    input.setAttribute("aria-invalid", fieldErrors.campus ? "true" : "false");
    if (fieldErrors.campus) input.setAttribute("aria-describedby", "post-campus-error");
    else input.removeAttribute("aria-describedby");
  });

  useEffect(() => {
    if (successId) successHeadingRef.current?.focus();
  }, [successId]);

  // Q519 — unsaved-changes guard for in-app navigation and tab close.
  const isDirty =
    !successId &&
    !!(d.title.trim() || d.price.trim() || d.campusId || d.description.trim() || d.photos.length || d.area.trim());
  const dirtyRef = useRef(isDirty);
  dirtyRef.current = isDirty;
  useBlocker({
    shouldBlockFn: () => {
      if (!dirtyRef.current || publishedRef.current || exitingRef.current) return false;
      if (typeof window === "undefined") return false;
      return !window.confirm(
        "Leave without posting? Your details are saved as a draft on this device, but photos aren't.",
      );
    },
    enableBeforeUnload: () => dirtyRef.current && !publishedRef.current,
  });

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
    const notes: string[] = [];
    // Q519 — type/size/empty checks per file, with the file named in the copy.
    const ok: File[] = [];
    for (const f of all) {
      const err = validatePhotoFile(f);
      if (err) notes.push(err);
      else ok.push(f);
    }
    const inFlight = pendingRef.current.filter((p) => p.status === "uploading").length;
    const room = Math.max(0, MAX_PHOTOS - draftRef.current.photos.length - inFlight);
    const files = ok.slice(0, room);
    // Q464 — silently dropping extras looked like a failed upload.
    if (ok.length > files.length) {
      notes.push(`You can add ${MAX_PHOTOS} photos — the extra ${ok.length - files.length === 1 ? "one wasn't" : "ones weren't"} added.`);
    }
    setPhotoError(notes.length ? notes.join(" ") : null);
    if (!files.length) return;

    // Q519 — every photo gets its own row + status; uploads run side by side
    // and one failure never blocks the others.
    const entries: PendingUpload[] = files.map((file) => ({
      id: `${Date.now()}-${Math.random().toString(36).slice(2)}`,
      name: file.name,
      file,
      status: "uploading",
    }));
    setPending((prev) => [...prev, ...entries]);

    let failed = 0;
    await Promise.all(
      entries.map(async (entry) => {
        try {
          const [path] = await uploadListingPhotos(userId, [entry.file]);
          if (!isStoragePath(path)) throw new Error("unexpected upload path");
          const url = await signPath("listing-photos", path, { ttl: 60 * 60 * 24 });
          // `path` is what gets stored; `url` is only for the thumbnail.
          setD((p) => ({ ...p, photos: [...p.photos, { path, url: url ?? "" }] }));
          setPending((prev) => prev.filter((x) => x.id !== entry.id));
        } catch (e: any) {
          failed += 1;
          console.error("[post] photo upload failed", e); // Q508 — raw error for debugging only
          setPending((prev) => prev.map((x) => (x.id === entry.id ? { ...x, status: "failed" } : x)));
          if (failed === 1) notes.push(friendlyPhotoError(e));
        }
      }),
    );
    if (failed > 1) notes.push(`${failed} photos didn't upload — the rest were added. Tap Retry on each one.`);
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
    const errs = validateStep1(d, { isStreetAddress: looksLikeStreetAddress, addressError: AREA_ADDRESS_ERROR });
    setFieldErrors(errs);
    const first = firstErrorField(errs);
    if (first) {
      focusField(first);
      return;
    }
    set({ step: 2 });
    if (typeof window !== "undefined") window.scrollTo({ top: 0 });
  }

  /** Q163 — step 2 → preview. Validates photos before showing the preview card. */
  function goPreview() {
    const validUrls = d.photoUrls.map((u) => u.trim()).filter((u) => u && urlOk[u]);
    if (d.photos.length === 0 && validUrls.length === 0) {
      setPhotoError("Please add at least 1 photo");
      fileRef.current?.parentElement?.querySelector<HTMLButtonElement>("button")?.focus();
      return;
    }
    if (validateBeds(d.beds)) return setPhotoError(validateBeds(d.beds));
    setPhotoError(null);
    set({ step: 3 });
    if (typeof window !== "undefined") window.scrollTo({ top: 0 });
  }



  async function publish() {
    // Q451 — a ref, not the state flag: two clicks in the same tick both read
    // the old `publishing` value, so state alone cannot stop a double insert.
    if (publishingRef.current || publishedRef.current) return;
    const validUrls = d.photoUrls.map((u) => u.trim()).filter((u) => u && urlOk[u]);
    // Q519 — uploaded photos are stored as storage PATHS, never signed URLs.
    const storagePaths = d.photos.map((p) => p.path).filter(isStoragePath);
    if (storagePaths.length === 0 && validUrls.length === 0) {
      setPhotoError("Please add at least 1 photo");
      return;
    }
    publishingRef.current = true;
    setPublishing(true);
    setPublishError(null);
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
          photos: [...storagePaths, ...validUrls],
          available_from: d.availableFrom || null,
          available_to: d.availableTo || null,
          roommate_prefs: hasRoommatePrefs(d.roommatePrefs) ? d.roommatePrefs : null,
          is_active: true,
          status: "active",
        })
        .select("id")
        .single();
      if (err) throw err;
      if (!data?.id) throw new Error("no id returned");
      // Q181 — the draft became a live listing: it is dead, never prompt again.
      // Q479 — flag it before navigating: unmount would otherwise re-save it.
      publishedRef.current = true;
      lsRemove(draftKey(userId));
      lsRemove(dismissedKey(userId));
      toast.success("Your sublease is live! 🎉");
      // Q519 — explicit success state with a link, instead of a silent redirect.
      setSuccessId(data.id);
      setPublishing(false);
      if (typeof window !== "undefined") window.scrollTo({ top: 0 });
    } catch (e: any) {
      console.error("[post] publish failed", e); // Q508 — raw error for debugging only
      // Q451 — an expired session mid-publish keeps the form and the draft.
      const low = String(e?.message ?? "").toLowerCase();
      if (low.includes("jwt") || low.includes("not authenticated") || e?.code === "42501" || low.includes("row-level security")) {
        saveDraftNow();
        setSessionExpired(true);
      } else {
        const msg = friendlyPublishError(e);
        setPublishError(msg);
        toast.error(msg);
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
          <Link to="/" className={cn("rounded text-xl font-bold", FOCUS_RING)}>LeaseUp</Link>
          <button
            type="button"
            onClick={() => {
              exitingRef.current = true;
              saveDraftNow();
              toast.success("Draft saved");
              navigate({ to: "/" });
            }}

            className={cn("inline-flex min-h-[44px] items-center justify-center rounded-full px-3 text-sm text-gray-600 transition hover:text-gray-900 dark:text-muted-foreground dark:hover:text-foreground", FOCUS_RING)}
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
              className="rounded-lg bg-amber-700 px-3 py-1.5 min-h-11 inline-flex items-center text-xs font-semibold text-white hover:bg-amber-800"
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
              className="rounded-lg border border-amber-300 px-3 py-1.5 min-h-11 inline-flex items-center text-xs font-semibold hover:bg-amber-100 dark:hover:bg-amber-500/20"
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
              className="rounded-lg border border-indigo-300 px-3 py-1.5 min-h-11 inline-flex items-center text-xs font-semibold hover:bg-indigo-100 dark:hover:bg-indigo-500/20"
            >
              Start fresh
            </button>
            <button
              type="button"
              onClick={() => setRestored(null)}
              aria-label="Dismiss"
              className="grid h-11 w-11 place-items-center rounded-full hover:bg-indigo-100 dark:hover:bg-indigo-500/20"
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
                className="rounded-lg bg-amber-700 px-3 py-1.5 min-h-11 inline-flex items-center text-xs font-semibold text-white hover:bg-amber-800"
              >
                Sign in again
              </Link>
              <button
                type="button"
                onClick={() => setSessionExpired(false)}
                className="rounded-lg border border-amber-300 px-3 py-1.5 min-h-11 inline-flex items-center text-xs font-semibold hover:bg-amber-100 dark:hover:bg-amber-500/20"
              >
                Dismiss
              </button>
            </div>
          </div>
        )}

        {successId ? (
          <div role="status" className="rounded-2xl border border-emerald-200 bg-emerald-50 p-6 text-center dark:border-emerald-500/30 dark:bg-emerald-500/10">
            <h1 ref={successHeadingRef} tabIndex={-1} className="text-2xl font-extrabold tracking-tight text-gray-900 outline-none dark:text-foreground">
              Your sublease is live
            </h1>
            <p className="mt-2 text-sm text-gray-700 dark:text-muted-foreground">
              Students can find it now. Replies land in your messages.
            </p>
            <div className="mt-5 flex flex-col items-center gap-3 sm:flex-row sm:justify-center">
              <Link to="/listing/$id" params={{ id: successId }} className={PRIMARY_BTN}>
                View your listing
              </Link>
              <Link to="/my-listings" className={BACK_BTN}>
                Go to My listings
              </Link>
            </div>
          </div>
        ) : d.step === 1 ? (
          <>
            <p className="mb-6 text-xs text-gray-500">Step 1 of 3 — Basic details</p>
            <div className="space-y-6">
              <div>
                <label htmlFor="post-title" className="mb-1 block text-sm font-medium">Listing title</label>
                <input
                  id="post-title"
                  className={inputCls()}
                  maxLength={TITLE_MAX}
                  value={d.title}
                  aria-invalid={!!fieldErrors.title}
                  aria-describedby={describedBy("title", "post-title-count")}
                  onChange={(e) => { set({ title: e.target.value }); clearFieldError("title"); }}
                  placeholder="e.g. Cozy 1BR in West Campus"
                />
                <div className="mt-1 flex items-start justify-between gap-3">
                  <FieldError id="post-title-error" msg={fieldErrors.title} />
                  <span id="post-title-count" aria-live="polite" className="ml-auto shrink-0 text-xs text-gray-500">
                    {d.title.length}/{TITLE_MAX} characters
                  </span>
                </div>
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
                      onClick={() => { set({ title: suggested.slice(0, TITLE_MAX) }); clearFieldError("title"); }}
                      className={cn("mt-1.5 flex min-h-11 w-full cursor-pointer items-center justify-between gap-2 rounded-lg bg-indigo-50 px-3 py-2 text-left text-xs text-indigo-700 dark:bg-indigo-500/10 dark:text-indigo-300", FOCUS_RING)}
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
                <label htmlFor="post-campus" className="mb-1 block text-sm font-medium">Campus</label>
                {/* Q179 — typeahead over every accredited US school. */}
                <div
                  ref={campusWrapRef}
                  className={cn(
                    "rounded-xl border bg-background px-3 focus-within:border-[#4F46E5] focus-within:ring-2 focus-within:ring-[#4F46E5]/40",
                    fieldErrors.campus ? "border-red-600" : "border-border",
                  )}
                >
                  <CampusAutocomplete
                    value={campuses.find((c) => c.id === d.campusId)?.name ?? ""}
                    placeholder="Search your school…"
                    onSelect={(c) => {
                      setCampuses((prev) => (prev.some((x) => x.id === c.id) ? prev : [...prev, c]));
                      set({ campusId: c.id });
                      clearFieldError("campus");
                    }}
                    onClear={() => set({ campusId: "" })}
                  />
                </div>
                <FieldError id="post-campus-error" msg={fieldErrors.campus} />
                <EstimatedReach
                  campusId={d.campusId}
                  campusName={campuses.find((c) => c.id === d.campusId)?.name}
                />
              </div>

              <div>
                <label htmlFor="post-price" className="mb-1 block text-sm font-medium">Monthly rent (whole dollars)</label>
                <div className="flex items-center gap-2">
                  <span className="text-lg font-semibold" aria-hidden="true">$</span>
                  <input
                    id="post-price"
                    type="number"
                    inputMode="numeric"
                    min={1}
                    max={MAX_PRICE}
                    step={1}
                    className={inputCls()}
                    value={d.price}
                    aria-invalid={!!fieldErrors.price}
                    aria-describedby={describedBy("price")}
                    onChange={(e) => { set({ price: e.target.value }); clearFieldError("price"); }}
                    placeholder="750"
                  />
                </div>
                <FieldError id="post-price-error" msg={fieldErrors.price} />
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
                        aria-pressed={active}
                        onClick={() => { set({ availableFrom: p.from, availableTo: p.to }); clearFieldError("availableFrom"); clearFieldError("availableTo"); }}
                        className={cn(
                          "min-h-11 rounded-full border px-3.5 py-1.5 text-sm font-medium transition",
                          FOCUS_RING,
                          active
                            ? "border-[#4F46E5] bg-[#4F46E5] text-white"
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
                  <div className="min-w-0">
                    <label htmlFor="post-from" className="mb-1 block text-sm font-medium">Available from</label>
                    <input
                      id="post-from"
                      type="date"
                      className={inputCls()}
                      value={d.availableFrom}
                      aria-invalid={!!fieldErrors.availableFrom}
                      aria-describedby={describedBy("availableFrom")}
                      onChange={(e) => { set({ availableFrom: e.target.value }); clearFieldError("availableFrom"); }}
                    />
                    <FieldError id="post-from-error" msg={fieldErrors.availableFrom} />
                  </div>
                  <div className="min-w-0">
                    <label htmlFor="post-to" className="mb-1 block text-sm font-medium">Available until</label>
                    <input
                      id="post-to"
                      type="date"
                      min={d.availableFrom || undefined}
                      className={inputCls()}
                      value={d.availableTo}
                      aria-invalid={!!fieldErrors.availableTo}
                      aria-describedby={describedBy("availableTo")}
                      onChange={(e) => { set({ availableTo: e.target.value }); clearFieldError("availableTo"); }}
                    />
                    <FieldError id="post-to-error" msg={fieldErrors.availableTo} />
                  </div>
                </div>
              </div>

              <div>
                <label htmlFor="post-area" className="mb-1 block text-sm font-medium">Neighborhood <span className="font-normal text-gray-500">(optional)</span></label>
                <input
                  id="post-area"
                  className={inputCls()}
                  maxLength={120}
                  value={d.area}
                  aria-invalid={!!fieldErrors.area || looksLikeStreetAddress(d.area)}
                  aria-describedby={describedBy("area", "post-area-help")}
                  onChange={(e) => { set({ area: e.target.value }); clearFieldError("area"); }}
                  placeholder="e.g. West Campus or Five Points"
                />
                <p id="post-area-help" className="mt-1 text-xs text-gray-500">
                  Neighborhood only — not your street address. Renters see this before you've met them.
                  {" "}Your exact address is never on your listing. Share it in messages once you've connected with someone.
                </p>
                <FieldError
                  id="post-area-error"
                  msg={fieldErrors.area ?? (looksLikeStreetAddress(d.area) ? AREA_ADDRESS_ERROR : undefined)}
                />
              </div>

              {Object.keys(fieldErrors).length > 0 && (
                <p role="alert" className="text-sm text-red-700 dark:text-red-400">
                  Fix the highlighted {Object.keys(fieldErrors).length === 1 ? "field" : "fields"} above to continue.
                </p>
              )}

              <button
                type="button"
                onClick={next}
                className={PRIMARY_BTN}
              >
                Next →
              </button>
            </div>
          </>
        ) : d.step === 2 ? (
          <>
            <p className="mb-6 text-xs text-gray-500">Step 2 of 3 — Photos &amp; details</p>

            <div className="space-y-8">
              <div>
                <div className="mb-1 flex items-baseline justify-between gap-3">
                  <h2 id="post-photos-label" className="block text-sm font-medium">Photos (up to {MAX_PHOTOS})</h2>
                  <span className="text-xs text-gray-500">{d.photos.length} / {MAX_PHOTOS} photos added</span>
                </div>
                <p id="post-photos-help" className="mb-3 text-xs text-gray-500">
                  {/* Q479 — dropped an invented "5× more views" statistic. */}
                  Add at least 3 photos — students skip listings they can't see inside. JPG, PNG, WebP or HEIC, up to {MAX_PHOTO_MB} MB each.
                </p>
                <input
                  ref={fileRef}
                  type="file"
                  accept={ALLOWED_PHOTO_TYPES.join(",")}
                  multiple
                  className="hidden"
                  tabIndex={-1}
                  aria-hidden="true"
                  data-testid="post-photo-input"
                  onChange={(e) => { if (e.target.files) handleFiles(e.target.files); e.target.value = ""; }}
                />
                <button
                  type="button"
                  onClick={() => fileRef.current?.click()}
                  disabled={d.photos.length >= MAX_PHOTOS}
                  aria-describedby={photoError ? "post-photos-help post-photos-error" : "post-photos-help"}
                  onDragOver={(e) => { e.preventDefault(); setDragging(true); }}
                  onDragLeave={() => setDragging(false)}
                  onDrop={(e) => { e.preventDefault(); setDragging(false); handleFiles(e.dataTransfer.files); }}
                  className={cn(
                    "flex h-40 w-full cursor-pointer flex-col items-center justify-center gap-2 rounded-2xl border-2 border-dashed border-gray-300 transition hover:border-gray-500 disabled:cursor-not-allowed disabled:opacity-50 dark:border-border",
                    FOCUS_RING,
                    dragging && "border-[#4F46E5] bg-muted",
                  )}
                >
                  <ImagePlus className="h-7 w-7 text-gray-500" aria-hidden="true" />
                  <span className="text-sm font-medium">Add photos — click, drag &amp; drop, or paste</span>
                  <span className="text-xs text-gray-500">{d.photos.length}/{MAX_PHOTOS}</span>
                </button>
                {photoError && <p id="post-photos-error" role="alert" className="mt-2 text-sm text-red-700 dark:text-red-400">{photoError}</p>}
                {pending.length > 0 && (
                  <ul className="mt-3 space-y-2" aria-label="Photo uploads">
                    {pending.map((p) => (
                      <li key={p.id} className="flex items-center gap-3 rounded-xl border border-gray-200 px-3 py-2 text-sm dark:border-border">
                        <span className="min-w-0 flex-1 truncate">{p.name}</span>
                        {p.status === "uploading" ? (
                          <span className="inline-flex items-center gap-1.5 text-gray-600 dark:text-muted-foreground" aria-live="polite">
                            <Loader2 className="h-4 w-4 animate-spin" aria-hidden="true" /> Uploading…
                          </span>
                        ) : (
                          <>
                            <span className="text-red-700 dark:text-red-400">Didn't upload</span>
                            <button
                              type="button"
                              onClick={() => { setPending((prev) => prev.filter((x) => x.id !== p.id)); void handleFiles([p.file]); }}
                              className={cn("min-h-11 rounded-full px-3 font-semibold text-[#4F46E5]", FOCUS_RING)}
                            >
                              Retry
                            </button>
                            <button
                              type="button"
                              aria-label={`Dismiss ${p.name}`}
                              onClick={() => setPending((prev) => prev.filter((x) => x.id !== p.id))}
                              className={cn("grid h-11 w-11 place-items-center rounded-full", FOCUS_RING)}
                            >
                              <X className="h-4 w-4" aria-hidden="true" />
                            </button>
                          </>
                        )}
                      </li>
                    ))}
                  </ul>
                )}
                {d.photos.length > 1 && (
                  <p className="mt-3 text-xs text-gray-500 dark:text-foreground/60">
                    The first photo is the one renters see first. Drag a photo, or use the buttons on it, to change the order.
                  </p>
                )}
                {d.photos.length > 0 && (
                  <ul className="mt-4 grid grid-cols-2 gap-3" aria-labelledby="post-photos-label">
                    {d.photos.map((p, i) => (
                      <li
                        key={p.path}
                        data-photo-path={p.path}
                        draggable
                        onDragStart={() => setDragIdx(i)}
                        onDragOver={(e) => e.preventDefault()}
                        onDrop={(e) => { e.preventDefault(); e.stopPropagation(); if (dragIdx !== null) movePhoto(dragIdx, i); setDragIdx(null); }}
                        onDragEnd={() => setDragIdx(null)}
                        className={cn(
                          "relative overflow-hidden rounded-xl bg-muted",
                          dragIdx === i && "opacity-60 ring-2 ring-[#4F46E5]",
                        )}
                      >
                        <img src={p.url} alt={`Photo ${i + 1} of ${d.photos.length}${i === 0 ? " (cover)" : ""}`} className="h-32 w-full object-cover" />
                        {i === 0 && (
                          <span className="absolute left-2 top-2 inline-flex items-center gap-1 rounded-full bg-gray-900/85 px-2 py-1 text-[11px] font-medium text-white">
                            <Star className="h-3 w-3 fill-current" aria-hidden="true" />
                            Cover photo
                          </span>
                        )}
                        <button
                          type="button"
                          onClick={() => removePhoto(p.path)}
                          aria-label={`Remove photo ${i + 1}`}
                          className={cn("absolute right-2 top-2 grid h-11 w-11 place-items-center rounded-full bg-white/90 shadow", FOCUS_RING)}
                        >
                          <X className="h-4 w-4 text-gray-900" aria-hidden="true" />
                        </button>
                        {/* Q470 — touch-friendly reordering; drag works on desktop. */}
                        <div className="absolute inset-x-0 bottom-0 flex items-stretch gap-px bg-black/60 backdrop-blur-sm">
                          <button
                            type="button"
                            onClick={() => movePhoto(i, i - 1)}
                            disabled={i === 0}
                            aria-label={`Move photo ${i + 1} left`}
                            className={cn("grid min-h-11 flex-1 place-items-center text-white disabled:opacity-35", FOCUS_RING)}
                          >
                            <ChevronLeft className="h-4 w-4" aria-hidden="true" />
                          </button>
                          <button
                            type="button"
                            onClick={() => movePhoto(i, 0)}
                            disabled={i === 0}
                            aria-label={i === 0 ? "This is the cover photo" : `Make photo ${i + 1} the cover photo`}
                            className={cn("min-h-11 flex-[2] px-1 text-[11px] font-semibold text-white disabled:opacity-35", FOCUS_RING)}
                          >
                            {i === 0 ? "Cover" : "Make cover"}
                          </button>
                          <button
                            type="button"
                            onClick={() => movePhoto(i, i + 1)}
                            disabled={i === d.photos.length - 1}
                            aria-label={`Move photo ${i + 1} right`}
                            className={cn("grid min-h-11 flex-1 place-items-center text-white disabled:opacity-35", FOCUS_RING)}
                          >
                            <ChevronRight className="h-4 w-4" aria-hidden="true" />
                          </button>
                        </div>
                      </li>
                    ))}
                  </ul>
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
                <span id="post-beds-label" className="text-sm font-medium">Bedrooms</span>
                <Stepper label="bedrooms" labelledBy="post-beds-label" value={d.beds} min={BEDS_MIN} max={BEDS_MAX} onChange={(v) => set({ beds: v })} format={(v) => (v === 0 ? "Studio" : String(v))} />
              </div>
              <div className="flex items-center justify-between border-t border-gray-100 pt-5 dark:border-border">
                <span id="post-baths-label" className="text-sm font-medium">Bathrooms</span>
                <Stepper label="bathrooms" labelledBy="post-baths-label" value={d.baths} min={1} max={4} step={0.5} onChange={(v) => set({ baths: v })} />
              </div>

              <div className="flex items-center justify-between border-t border-gray-100 pt-5 dark:border-border">
                <span id="post-furnished-label" className="text-sm font-medium">Furnished?</span>
                <button
                  type="button"
                  role="switch"
                  aria-checked={d.furnished}
                  aria-labelledby="post-furnished-label"
                  onClick={() => set({ furnished: !d.furnished })}
                  className={cn("grid h-11 w-14 place-items-center rounded-full", FOCUS_RING)}
                >
                  <span
                    className={cn(
                      "relative block h-6 w-11 rounded-full transition",
                      d.furnished ? "bg-[#4F46E5]" : "bg-gray-400 dark:bg-muted",
                    )}
                  >
                    <span
                      className={cn(
                        "absolute top-0.5 h-5 w-5 rounded-full bg-white shadow transition-all",
                        d.furnished ? "left-[22px]" : "left-0.5",
                      )}
                    />
                  </span>
                </button>
              </div>

              <div>
                <label htmlFor="post-description" className="mb-1 block text-sm font-medium">Description <span className="font-normal text-gray-500">(optional)</span></label>
                <textarea
                  id="post-description"
                  rows={6}
                  maxLength={DESCRIPTION_MAX}
                  aria-describedby="post-description-count"
                  className={inputCls("resize-none")}
                  value={d.description}
                  onChange={(e) => set({ description: e.target.value })}
                  placeholder="Describe the space, vibe, and what's included..."
                />
                <div id="post-description-count" aria-live="polite" className="mt-1 text-right text-xs text-gray-500">
                  {d.description.length}/{DESCRIPTION_MAX} characters
                </div>
              </div>

              <RoommatePrefsSection
                value={d.roommatePrefs ?? {}}
                onChange={(roommatePrefs) => set({ roommatePrefs })}
              />

              <fieldset>
                <legend className="mb-2 block text-sm font-medium">Amenities</legend>
                <div className="grid grid-cols-2 gap-x-2 sm:grid-cols-3">
                  {AMENITIES.map((a) => {
                    const on = d.amenities.includes(a.id);
                    return (
                      <label key={a.id} className="flex min-h-11 cursor-pointer items-center gap-2 text-sm">
                        <input
                          type="checkbox"
                          checked={on}
                          onChange={() =>
                            set({ amenities: on ? d.amenities.filter((x) => x !== a.id) : [...d.amenities, a.id] })
                          }
                          className={cn("h-5 w-5 rounded border-gray-400 accent-[#4F46E5]", FOCUS_RING)}
                        />
                        {a.label}
                      </label>
                    );
                  })}
                </div>
              </fieldset>

              <div className="flex items-center gap-4">
                <button
                  type="button"
                  onClick={() => set({ step: 1 })}
                  className={BACK_BTN}
                >
                  ← Back
                </button>
                <button
                  type="button"
                  onClick={goPreview}
                  disabled={pending.some((p) => p.status === "uploading")}
                  className={PRIMARY_BTN}
                >
                  Preview →
                </button>
              </div>
            </div>
          </>
        ) : (
          <>
            <p className="mb-6 text-xs text-gray-500">Step 3 of 3 — Preview</p>
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
                      className={cn(BACK_BTN)}
                    >
                      ← Back
                    </button>
                    <button
                      type="button"
                      disabled={publishing}
                      aria-busy={publishing}
                      onClick={publish}
                      className={cn(PRIMARY_BTN, "inline-flex items-center gap-2")}
                    >
                      {publishing ? (<><Loader2 className="h-4 w-4 animate-spin" aria-hidden="true" />Posting…</>) : "Publish listing"}
                    </button>
                  </div>
                  {publishError && (
                    <p role="alert" className="mt-3 text-sm text-red-700 dark:text-red-400">{publishError}</p>
                  )}
                </>
              );
            })()}
          </>
        )}

      </main>
    </div>
  );
}
