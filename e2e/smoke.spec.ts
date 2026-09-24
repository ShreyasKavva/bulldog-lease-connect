/**
 * Q522 — route-by-route smoke test. Every public route in src/routes/, at
 * 375px and 1280px: 200 response, no console errors, no horizontal overflow,
 * exactly one h1, no serious/critical axe violations (WCAG 2.1 A/AA).
 * Read-only: never signs in, never writes. Target: E2E_BASE_URL / BASE_URL.
 *
 * Left out on purpose (not public): /admin, /onboarding, /ambassador/dashboard,
 * /post/edit/$id, /listing/$id/edit, /my-listings/$id/analytics, /profile/edit,
 * /roommates/create, /messages/$conversationId, /api/*, /email/*, /lovable/*.
 */
import { test, expect, type Page } from "@playwright/test";
import AxeBuilder from "@axe-core/playwright";

const STATIC_ROUTES = [
  "/", "/about", "/faq", "/browse", "/subleases", "/campuses", "/market", "/looking",
  "/looking-for", "/roommates", "/find-my-match", "/lease-analysis", "/tours", "/ambassador",
  "/join", "/auth", "/reset-password", "/unsubscribe", "/post", "/messages", "/saved",
  "/my-listings", "/notifications", "/alerts", "/saved-alerts", "/activity", "/profile",
];

// Dynamic routes: resolve one real example from server-rendered HTML so the
// suite follows whatever data the target site actually has.
async function dynamicRoutes(page: Page): Promise<string[]> {
  const out: string[] = [];
  const home = await (await page.request.get("/")).text();
  const listing = home.match(/href="(\/listing\/[0-9a-f-]{36})"/)?.[1];
  if (listing) out.push(listing);
  const market = await (await page.request.get("/market")).text();
  const campus = market.match(/href="\/market\?campus=([a-z0-9-]+)"/)?.[1];
  if (campus) out.push(`/sublease/${campus}`, `/campus/${campus}`);
  return out;
}

async function check(page: Page, path: string, width: number) {
  const errors: string[] = [];
  page.on("console", (m) => { if (m.type() === "error") errors.push(m.text()); });
  page.on("pageerror", (e) => errors.push(`pageerror: ${e.message}`));
  await page.setViewportSize({ width, height: 900 });
  const res = await page.goto(path, { waitUntil: "networkidle" });
  expect(res?.status(), `${path} status`).toBe(200);
  await page.waitForTimeout(600);

  const { sw, cw } = await page.evaluate(() => ({
    sw: document.documentElement.scrollWidth,
    cw: document.documentElement.clientWidth,
  }));
  expect(sw, `${path}@${width} horizontal overflow: scrollWidth ${sw} > clientWidth ${cw}`).toBeLessThanOrEqual(cw);

  await expect(page.locator("h1"), `${path}@${width} should have exactly one h1`).toHaveCount(1);

  const axe = await new AxeBuilder({ page }).withTags(["wcag2a", "wcag2aa", "wcag21a", "wcag21aa"]).analyze();
  const serious = axe.violations
    .filter((v) => v.impact === "serious" || v.impact === "critical")
    .map((v) => `${v.id} (${v.impact}): ${v.nodes.slice(0, 3).map((n) => n.target.join(" ")).join(" | ")}`);
  expect(serious, `${path}@${width} axe`).toEqual([]);

  expect(errors, `${path}@${width} console errors`).toEqual([]);
}

for (const width of [375, 1280]) {
  test.describe(`smoke @${width}`, () => {
    for (const path of STATIC_ROUTES) {
      test(`${path}`, async ({ page }) => { await check(page, path, width); });
    }
    test("dynamic routes (one real listing and campus)", async ({ page }) => {
      const paths = await dynamicRoutes(page);
      expect(paths.length, "no listing or campus found in SSR HTML").toBeGreaterThan(0);
      for (const p of paths) await test.step(p, async () => { await check(page, p, width); });
    });
  });
}

// Known finding (reported, not fixed here — browse.tsx is owned by other
// queued work): /browse at 1024px has scrollWidth 1036 vs clientWidth 1024.
// test.fail() means this passes while the bug exists and fails once fixed,
// so it can't be forgotten.
test("/browse @1024: no horizontal overflow (known bug: 1036 > 1024)", async ({ page }) => {
  test.fail();
  await page.setViewportSize({ width: 1024, height: 900 });
  await page.goto("/browse", { waitUntil: "networkidle" });
  await page.waitForTimeout(600);
  const { sw, cw } = await page.evaluate(() => ({
    sw: document.documentElement.scrollWidth,
    cw: document.documentElement.clientWidth,
  }));
  expect(sw).toBeLessThanOrEqual(cw);
});
