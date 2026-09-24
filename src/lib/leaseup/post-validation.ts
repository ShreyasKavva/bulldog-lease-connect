/**
 * Q519 — pure validation for the /post wizard. No browser APIs, no Supabase,
 * so it is SSR-safe and unit-tested in tests/post-validation.test.ts.
 */

export const TITLE_MIN = 3;
export const TITLE_MAX = 100;
export const DESCRIPTION_MAX = 500;
export const MAX_PRICE = 20000;
export const BEDS_MIN = 0;
export const BEDS_MAX = 6;
export const MAX_PHOTO_MB = 10;
export const MAX_PHOTO_BYTES = MAX_PHOTO_MB * 1024 * 1024;
export const ALLOWED_PHOTO_TYPES = ["image/jpeg", "image/png", "image/webp", "image/heic", "image/heif"];

export type Step1Field = "title" | "campus" | "price" | "availableFrom" | "availableTo" | "area";

/** Field order = on-screen order; the first key with an error gets focus. */
export const STEP1_ORDER: Step1Field[] = ["title", "campus", "price", "availableFrom", "availableTo", "area"];

export type Step1Input = {
  title: string;
  campusId: string;
  price: string;
  availableFrom: string;
  availableTo: string;
  area: string;
  beds?: number;
};

export type Step1Errors = Partial<Record<Step1Field, string>>;

export function validateTitle(title: string): string | null {
  const t = title.trim();
  if (t.length < TITLE_MIN) return "Add a listing title (at least 3 characters).";
  if (t.length > TITLE_MAX) return `Keep the title under ${TITLE_MAX} characters.`;
  if (!/[a-z0-9]/i.test(t)) return "Give your listing a title students can read — a few words about the place.";
  return null;
}

export function validatePrice(raw: string): string | null {
  const s = raw.trim();
  if (!s) return "Add a monthly rent.";
  const n = Number(s);
  if (!Number.isFinite(n)) return "Enter the monthly rent as a number, like 750.";
  if (n < 0) return "Rent can't be a negative number.";
  if (n === 0) return "Add a monthly rent above $0.";
  if (!Number.isInteger(n)) return "Enter a whole dollar amount, like 750.";
  if (n > MAX_PRICE) return "That rent looks too high — enter the monthly rent, not the whole lease.";
  return null;
}

export function validateBeds(beds: number): string | null {
  if (!Number.isInteger(beds) || beds < BEDS_MIN || beds > BEDS_MAX) {
    return `Bedrooms must be between Studio and ${BEDS_MAX}.`;
  }
  return null;
}

/** Returns errors keyed to the field they belong to. `now` is injectable for tests. */
export function validateDates(from: string, to: string, now = Date.now()): Pick<Step1Errors, "availableFrom" | "availableTo"> {
  const out: Pick<Step1Errors, "availableFrom" | "availableTo"> = {};
  if (!from) out.availableFrom = "Add the date it's available from.";
  if (!to) out.availableTo = "Add the date it's available until.";
  if (out.availableFrom || out.availableTo) return out;
  const f = new Date(`${from}T00:00:00`).getTime();
  const t = new Date(`${to}T00:00:00`).getTime();
  if (!Number.isFinite(f)) out.availableFrom = "Check this date.";
  if (!Number.isFinite(t)) out.availableTo = "Check this date.";
  if (out.availableFrom || out.availableTo) return out;
  if (t <= f) out.availableTo = "The end date must be after the start date.";
  else if (t < now - 86400000) out.availableTo = "Those dates are already in the past — pick dates students can still move in on.";
  return out;
}

export function validateStep1(
  d: Step1Input,
  opts: { now?: number; isStreetAddress?: (s: string) => boolean; addressError?: string } = {},
): Step1Errors {
  const e: Step1Errors = {};
  const title = validateTitle(d.title);
  if (title) e.title = title;
  if (!d.campusId) e.campus = "Pick your campus.";
  const price = validatePrice(d.price);
  if (price) e.price = price;
  Object.assign(e, validateDates(d.availableFrom, d.availableTo, opts.now));
  if (opts.isStreetAddress?.(d.area)) e.area = opts.addressError ?? "Neighborhood only — not a street address.";
  return e;
}

export function firstErrorField(errors: Step1Errors): Step1Field | null {
  return STEP1_ORDER.find((k) => errors[k]) ?? null;
}

/** Friendly per-file check before any upload starts. */
export function validatePhotoFile(file: { name: string; type: string; size: number }): string | null {
  const type = (file.type || "").toLowerCase();
  if (!type.startsWith("image/") || !ALLOWED_PHOTO_TYPES.includes(type)) {
    return `${file.name} isn't a photo we can use. Upload a JPG, PNG, WebP or HEIC.`;
  }
  if (file.size > MAX_PHOTO_BYTES) {
    return `${file.name} is over ${MAX_PHOTO_MB} MB. Try a smaller photo, or screenshot it first.`;
  }
  if (file.size === 0) return `${file.name} is empty. Pick a different photo.`;
  return null;
}

/** Stored photo values must be storage paths, never signed/http URLs. */
export function isStoragePath(v: string): boolean {
  return !!v && !/^https?:\/\//i.test(v) && !v.includes("token=") && !v.startsWith("/");
}
