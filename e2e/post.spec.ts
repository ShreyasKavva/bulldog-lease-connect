/**
 * Q519 — /post end-to-end. Write-safe by construction:
 *  - The signed-out test only reads the page.
 *  - Every signed-in test uses a FAKE session in localStorage and intercepts
 *    every backend request with page.route(), so no row, upload or storage
 *    object is ever created — not in production, not in preview.
 */
import { test, expect, type Page, type Route } from "@playwright/test";
import { isProduction } from "./fixtures";

const REF = "qiqrgiisphsunszchxgx";
const STORAGE_KEY = `sb-${REF}-auth-token`;
const USER_ID = "00000000-0000-4000-8000-00000000e2e0";
const CAMPUS = { id: "c-e2e", name: "Test University", short_name: "TU", slug: "test-university", city: "Athens", state: "GA", listing_count: 3 };

type Captured = { inserts: any[]; uploads: string[] };

async function mockBackend(page: Page, opts: { failUploadName?: string; insertDelayMs?: number } = {}): Promise<Captured> {
  const cap: Captured = { inserts: [], uploads: [] };
  const user = { id: USER_ID, aud: "authenticated", role: "authenticated", email: "e2e@example.edu", app_metadata: {}, user_metadata: {}, created_at: "2026-01-01T00:00:00Z" };
  await page.route(/supabase\.co\//, async (route: Route) => {
    const req = route.request();
    const url = req.url();
    const method = req.method();
    const json = (body: unknown, status = 200) => route.fulfill({ status, contentType: "application/json", body: JSON.stringify(body) });
    if (url.includes("/auth/v1/user")) return json(user);
    if (url.includes("/auth/v1/")) return json({});
    if (url.includes("/storage/v1/object/sign/")) {
      const signed = decodeURIComponent(url.split("/storage/v1/object/sign/listing-photos/")[1] ?? "x").split("?")[0];
      return json({ signedURL: `/storage/v1/object/sign/listing-photos/${signed}?token=fake` });
    }
    if (url.includes("/storage/v1/object/listing-photos/") && method === "POST") {
      const path = decodeURIComponent(url.split("/storage/v1/object/listing-photos/")[1] ?? "");
      const body = req.postDataBuffer()?.toString("latin1") ?? "";
      if (opts.failUploadName && body.includes(opts.failUploadName)) return json({ statusCode: "500", error: "internal", message: "duplicate key value violates unique constraint" }, 500);
      cap.uploads.push(path);
      return json({ Key: `listing-photos/${path}`, Id: "x" });
    }
    if (url.includes("/storage/v1/object/listing-photos") && method === "DELETE") return json([]);
    if (url.includes("/storage/v1/")) return route.fulfill({ status: 200, contentType: "image/png", body: Buffer.alloc(0) });
    if (url.includes("/rest/v1/listings") && method === "POST") {
      cap.inserts.push(req.postDataJSON());
      if (opts.insertDelayMs) await new Promise((r) => setTimeout(r, opts.insertDelayMs));
      return json({ id: "11111111-2222-4333-8444-555555555555" }, 201);
    }
    if (url.includes("/rest/v1/rpc/") && /campus/i.test(url)) return json([CAMPUS]);
    if (url.includes("/rest/v1/campuses")) return json([CAMPUS]);
    if (method !== "GET" && method !== "HEAD" && method !== "OPTIONS") return json({}, 200); // swallow any other write
    return json([]);
  });
  await page.goto("/");
  await page.evaluate(
    ([k, v]) => { localStorage.setItem(k, v); localStorage.setItem("leaseup-onboarding-complete", "true"); },
    [STORAGE_KEY, JSON.stringify({
      access_token: "e2e.fake.token", refresh_token: "fake", token_type: "bearer",
      expires_in: 3600, expires_at: Math.floor(Date.now() / 1000) + 3600 * 24, user,
    })],
  );
  return cap;
}

async function openForm(page: Page) {
  await page.goto("/post");
  await expect(page.getByLabel("Listing title")).toBeVisible({ timeout: 20_000 });
  await page.waitForLoadState("networkidle").catch(() => {});
}

function isoDaysFromNow(n: number) {
  const d = new Date(Date.now() + n * 86400000);
  return d.toISOString().slice(0, 10);
}

async function fillStep1(page: Page) {
  await page.getByLabel("Listing title").fill("Sunny 1BR near Test University");
  const campus = page.locator("#post-campus");
  await campus.fill("Test");
  await page.getByRole("option").first().click();
  await page.getByLabel(/Monthly rent/).fill("750");
  await page.getByLabel("Available from").fill(isoDaysFromNow(30));
  await page.getByLabel("Available until").fill(isoDaysFromNow(120));
}

const PNG = Buffer.from("89504e470d0a1a0a0000000d49484452000000010000000108060000001f15c4890000000d49444154789c6360000002000154a24f5d0000000049454e44ae426082", "hex");

test.describe("/post", () => {
  test("signed out: shows the sign-in gate, never the form", async ({ page }) => {
    await page.goto("/post");
    await expect(page.getByRole("button", { name: /sign in to post/i })).toBeVisible({ timeout: 20_000 });
    await expect(page.getByLabel("Listing title")).toHaveCount(0);
  });

  test.describe("mocked signed-in (no real writes)", () => {
    test.beforeEach(({ baseURL }) => {
      test.skip(isProduction(baseURL), "Mocked form tests run against local/preview only.");
    });

    test("empty submit: inline errors, linked by aria-describedby, first field focused", async ({ page }) => {
      await mockBackend(page);
      await openForm(page);
      await page.getByRole("button", { name: "Next →" }).click();
      const title = page.getByLabel("Listing title");
      await expect(title).toBeFocused();
      await expect(title).toHaveAttribute("aria-invalid", "true");
      await expect(title).toHaveAttribute("aria-describedby", /post-title-error/);
      await expect(page.locator("#post-title-error")).toContainText(/at least 3 characters/);
      await expect(page.locator("#post-campus-error")).toBeVisible();
      await expect(page.locator("#post-price-error")).toBeVisible();
      await expect(page.locator("#post-to-error")).toBeVisible();
    });

    test("price must be whole and positive; end date must be after start", async ({ page }) => {
      await mockBackend(page);
      await openForm(page);
      await fillStep1(page);
      await page.getByLabel(/Monthly rent/).fill("750.5");
      await page.getByLabel("Available until").fill(isoDaysFromNow(30));
      await page.getByRole("button", { name: "Next →" }).click();
      await expect(page.getByLabel(/Monthly rent/)).toBeFocused();
      await expect(page.locator("#post-price-error")).toContainText(/whole dollar/);
      await expect(page.locator("#post-to-error")).toContainText(/after the start date/);
    });

    test("title counter updates live", async ({ page }) => {
      await mockBackend(page);
      await openForm(page);
      await page.getByLabel("Listing title").fill("Hello");
      await expect(page.locator("#post-title-count")).toHaveText("5/100 characters");
    });

    test("photos: bad type rejected, one failure doesn't block others, stored values are paths, double-submit inserts once, success links to listing", async ({ page }) => {
      const cap = await mockBackend(page, { failUploadName: "FAILME", insertDelayMs: 800 });
      await openForm(page);
      await fillStep1(page);
      await page.getByRole("button", { name: "Next →" }).click();
      await expect(page.getByText("Step 2 of 3")).toBeVisible();

      const input = page.getByTestId("post-photo-input");
      await input.setInputFiles([{ name: "notes.pdf", mimeType: "application/pdf", buffer: Buffer.from("%PDF") }]);
      await expect(page.locator("#post-photos-error")).toContainText(/isn't a photo we can use/);

      await input.setInputFiles([
        { name: "good1.png", mimeType: "image/png", buffer: PNG },
        { name: "bad.png", mimeType: "image/png", buffer: Buffer.concat([PNG, Buffer.from("FAILME")]) },
        { name: "good2.png", mimeType: "image/png", buffer: PNG },
      ]);
      await expect(page.getByRole("button", { name: /Remove photo \d/ })).toHaveCount(2);
      await expect(page.getByRole("button", { name: "Retry" })).toHaveCount(1);
      await expect(page.locator("#post-photos-error")).toBeVisible();
      await expect(page.locator("#post-photos-error")).not.toContainText(/duplicate key|constraint/i);

      // reorder: make photo 2 the cover (uploads finish in any order, so read it off the page)
      const secondSrc = (await page.locator("li[data-photo-path]").nth(1).getAttribute("data-photo-path")) ?? "";
      await page.getByRole("button", { name: "Make photo 2 the cover photo" }).click();

      await page.getByRole("button", { name: "Preview →" }).click();
      const publish = page.getByRole("button", { name: /Publish listing/ });
      await publish.dblclick();
      await expect(page.getByRole("heading", { name: "Your sublease is live" })).toBeVisible();
      expect(cap.inserts).toHaveLength(1);
      const photos: string[] = cap.inserts[0].photos;
      expect(photos).toHaveLength(2);
      for (const p of photos) {
        expect(p).not.toMatch(/^https?:|token=/);
        expect(p.startsWith(`${USER_ID}/`)).toBe(true);
      }
      expect(photos[0]).toBe(secondSrc); // the photo moved to cover is stored first
      expect(new Set(photos)).toEqual(new Set(cap.uploads));
      expect(cap.inserts[0].price).toBe(750);
      await expect(page.getByRole("link", { name: "View your listing" })).toHaveAttribute("href", "/listing/11111111-2222-4333-8444-555555555555");
    });

    test("unsaved-changes warning on in-app navigation", async ({ page }) => {
      await mockBackend(page);
      await openForm(page);
      await page.getByLabel("Listing title").fill("Half written");
      let asked = false;
      page.once("dialog", (dlg) => { asked = true; void dlg.dismiss(); });
      await page.getByRole("link", { name: "LeaseUp" }).first().click();
      await expect.poll(() => asked).toBe(true);
      await expect(page).toHaveURL(/\/post/);
    });

    test("375px: no overflow, keyboard focus reaches every step-1 field, 44px targets", async ({ page }) => {
      await page.setViewportSize({ width: 375, height: 812 });
      await mockBackend(page);
      await openForm(page);
      const sw = await page.evaluate(() => document.documentElement.scrollWidth);
      expect(sw).toBeLessThanOrEqual(375);
      const seen = new Set<string>();
      await page.getByLabel("Listing title").focus();
      for (let i = 0; i < 25; i++) {
        const id = await page.evaluate(() => document.activeElement?.id ?? "");
        if (id) seen.add(id);
        await page.keyboard.press("Tab");
      }
      for (const id of ["post-title", "post-campus", "post-price", "post-from", "post-to", "post-area"]) expect(seen.has(id), id).toBe(true);
      const small = await page.evaluate(() =>
        [...document.querySelectorAll("main button, main a, main input:not([type=date]):not([type=checkbox])")]
          .filter((el) => (el as HTMLElement).offsetParent !== null)
          .map((el) => { const r = el.getBoundingClientRect(); return { t: (el.textContent || (el as HTMLElement).getAttribute("aria-label") || el.id).trim().slice(0, 30), h: r.height }; })
          .filter((x) => x.h < 44),
      );
      expect(small).toEqual([]);
    });
  });
});
