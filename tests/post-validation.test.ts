import { describe, expect, test } from "bun:test";
import {
  validateTitle, validatePrice, validateBeds, validateDates, validateStep1,
  firstErrorField, validatePhotoFile, isStoragePath, TITLE_MAX, MAX_PHOTO_BYTES,
} from "../src/lib/leaseup/post-validation";

const NOW = new Date("2026-09-01T12:00:00").getTime();

describe("title", () => {
  test("too short", () => expect(validateTitle("ab")).toBeTruthy());
  test("emoji only", () => expect(validateTitle("🏡🏡🏡")).toBeTruthy());
  test("too long", () => expect(validateTitle("a".repeat(TITLE_MAX + 1))).toBeTruthy());
  test("ok", () => expect(validateTitle("Cozy 1BR near campus")).toBeNull());
});

describe("price", () => {
  test("empty", () => expect(validatePrice("")).toMatch(/Add a monthly rent/));
  test("not a number", () => expect(validatePrice("abc")).toMatch(/as a number/));
  test("negative", () => expect(validatePrice("-5")).toMatch(/negative/));
  test("zero", () => expect(validatePrice("0")).toMatch(/above \$0/));
  test("decimal", () => expect(validatePrice("750.5")).toMatch(/whole dollar/));
  test("too high", () => expect(validatePrice("50000")).toMatch(/too high/));
  test("ok", () => expect(validatePrice(" 750 ")).toBeNull());
});

describe("beds", () => {
  test("studio ok", () => expect(validateBeds(0)).toBeNull());
  test("6 ok", () => expect(validateBeds(6)).toBeNull());
  test("7 rejected", () => expect(validateBeds(7)).toBeTruthy());
  test("negative rejected", () => expect(validateBeds(-1)).toBeTruthy());
  test("fraction rejected", () => expect(validateBeds(1.5)).toBeTruthy());
});

describe("dates", () => {
  test("missing both", () => {
    const e = validateDates("", "", NOW);
    expect(e.availableFrom).toBeTruthy();
    expect(e.availableTo).toBeTruthy();
  });
  test("same day rejected (must be after)", () =>
    expect(validateDates("2026-10-01", "2026-10-01", NOW).availableTo).toMatch(/after/));
  test("end before start", () =>
    expect(validateDates("2026-12-01", "2026-10-01", NOW).availableTo).toMatch(/after/));
  test("past", () => expect(validateDates("2026-01-01", "2026-02-01", NOW).availableTo).toMatch(/past/));
  test("ok", () => expect(validateDates("2026-10-01", "2026-12-15", NOW)).toEqual({}));
});

describe("step 1", () => {
  const good = { title: "Cozy 1BR", campusId: "c1", price: "750", availableFrom: "2026-10-01", availableTo: "2026-12-15", area: "Five Points" };
  test("valid", () => expect(validateStep1(good, { now: NOW })).toEqual({}));
  test("first error follows on-screen order", () => {
    const e = validateStep1({ ...good, campusId: "", price: "0" }, { now: NOW });
    expect(Object.keys(e).sort()).toEqual(["campus", "price"]);
    expect(firstErrorField(e)).toBe("campus");
  });
  test("street address flagged", () => {
    const e = validateStep1({ ...good, area: "123 Main St" }, { now: NOW, isStreetAddress: (s) => /^\d+ /.test(s) });
    expect(e.area).toBeTruthy();
  });
  test("no errors -> null focus", () => expect(firstErrorField({})).toBeNull());
});

describe("photo files", () => {
  test("pdf rejected", () => expect(validatePhotoFile({ name: "a.pdf", type: "application/pdf", size: 10 })).toMatch(/isn't a photo/));
  test("gif rejected", () => expect(validatePhotoFile({ name: "a.gif", type: "image/gif", size: 10 })).toMatch(/JPG/));
  test("too big", () => expect(validatePhotoFile({ name: "a.jpg", type: "image/jpeg", size: MAX_PHOTO_BYTES + 1 })).toMatch(/over 10 MB/));
  test("empty", () => expect(validatePhotoFile({ name: "a.jpg", type: "image/jpeg", size: 0 })).toMatch(/empty/));
  test("ok", () => expect(validatePhotoFile({ name: "a.png", type: "image/png", size: 1000 })).toBeNull());
});

describe("storage paths", () => {
  test("path ok", () => expect(isStoragePath("uid/abc.jpg")).toBe(true));
  test("signed url rejected", () => expect(isStoragePath("https://x.supabase.co/storage/v1/object/sign/a?token=1")).toBe(false));
  test("empty rejected", () => expect(isStoragePath("")).toBe(false));
});
