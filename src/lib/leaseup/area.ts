/**
 * Q454 — `listings.area` is meant to be a NEIGHBORHOOD, not a street address.
 *
 * The column is readable by anonymous visitors, and the old post-form
 * placeholder ("e.g. 120 W 21st St") actively invited posters to type where
 * they live. On a product where students meet strangers at apartments that is
 * a safety problem, so both write surfaces (PostWizard and the owner edit
 * screen) reject address-shaped input before it is ever stored.
 *
 * Deliberately conservative: it only catches the two shapes that are almost
 * never a neighborhood name — a leading house number, or a street suffix.
 */
const STREET_SUFFIX =
  /\b(st|street|ave|av|avenue|rd|road|blvd|boulevard|dr|drive|ln|lane|ct|court|way|pkwy|parkway|ter|terrace|cir|circle|hwy|highway|apt|unit|suite|ste)\.?\b/i;

/** Leading house number followed by anything else, e.g. "120 W 21st". */
const LEADING_HOUSE_NUMBER = /^\s*#?\d+\s+\S/;

export function looksLikeStreetAddress(value: string | null | undefined): boolean {
  const v = (value ?? "").trim();
  if (!v) return false;
  return LEADING_HOUSE_NUMBER.test(v) || STREET_SUFFIX.test(v);
}

/** Friendly, student-facing wording — never shows the value back. */
export const AREA_ADDRESS_ERROR =
  "Use the neighborhood, not the street address — renters see this before you've met them. Try something like \"Five Points\" or \"West Campus\".";
