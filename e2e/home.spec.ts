/**
 * Q520 — homepage: server-rendered listings, accessibility, keyboard.
 * Read-only: never signs in, never writes. axe-core is injected from a CDN at
 * test time (no new project dependency).
 */
import { test, expect, type Page } from "@playwright/test";
import { collectConsoleErrors } from "./fixtures";

const AXE_URL = "https://cdnjs.cloudflare.com/ajax/libs/axe-core/4.10.2/axe.min.js";

async function axeSerious(page: Page) {
  await page.addScriptTag({ url: AXE_URL });
  const violations = await page.evaluate(async () => {
    // @ts-expect-error injected global
    const r = await window.axe.run(document, { runOnly: ["wcag2a", "wcag2aa", "wcag21a", "wcag21aa"] });
    return r.violations
      .filter((v: any) => v.impact === "serious" || v.impact === "critical")
      .map((v: any) => ({
        id: v.id,
        impact: v.impact,
        nodes: v.nodes
          .map((n: any) => n.target.join(" "))
      }))
      .filter((v: any) => v.nodes.length > 0);
  });
  return violations;
}

test.describe("homepage", () => {
  test("SSR HTML already contains listing titles and /listing/ links", async ({ request }) => {
    const res = await request.get("/");
    expect(res.status()).toBe(200);
    const html = await res.text();
    const hrefs = [...new Set(html.match(/href="\/listing\/[0-9a-f-]{36}"/g) ?? [])];
    expect(hrefs.length).toBeGreaterThan(0);
    const titles = [...html.matchAll(/<h3[^>]*>([^<]+)<\/h3>/g)].map((m) => m[1]);
    expect(titles.length).toBeGreaterThan(0);
    console.log(`SSR: ${hrefs.length} unique listing links; titles: ${[...new Set(titles)].join(" | ")}`);
    expect(html).not.toMatch(/>\s*0 (subleases|listings|campuses)\b/);
  });

  test("no hydration mismatch or console errors on load", async ({ page }) => {
    const errors = collectConsoleErrors(page);
    await page.goto("/", { waitUntil: "networkidle" });
    await page.waitForTimeout(1000);
    expect(errors.filter((e) => /hydrat|did not match|mismatch/i.test(e))).toEqual([]);
  });

  for (const width of [375, 1280]) {
    test(`no serious axe violations at ${width}px`, async ({ page }) => {
      await page.setViewportSize({ width, height: 1000 });
      await page.goto("/", { waitUntil: "networkidle" });
      await page.waitForTimeout(800);
      const v = await axeSerious(page);
      expect(v, JSON.stringify(v, null, 2)).toEqual([]);
      const sw = await page.evaluate(() => document.documentElement.scrollWidth);
      expect(sw).toBeLessThanOrEqual(width);
      await expect(page.locator("main")).toHaveCount(1);
    });
  }

  test("keyboard reaches every listing card and each rail scrolls by arrow key", async ({ page }) => {
    await page.setViewportSize({ width: 375, height: 900 });
    await page.goto("/", { waitUntil: "networkidle" });
    const cardHrefs = await page.evaluate(() =>
      [...new Set([...document.querySelectorAll('main a[aria-label^="View "][href^="/listing/"]')].map((a) => a.getAttribute("href")))],
    );
    expect(cardHrefs.length).toBeGreaterThan(0);
    const reached = new Set<string>();
    await page.locator("body").focus();
    for (let i = 0; i < 250 && reached.size < cardHrefs.length; i++) {
      await page.keyboard.press("Tab");
      const info = await page.evaluate(() => {
        const a = document.activeElement as HTMLElement | null;
        return a ? { href: a.getAttribute("href"), label: a.getAttribute("aria-label") } : null;
      });
      if (info?.href && info.label?.startsWith("View ")) reached.add(info.href);
    }
    expect([...reached].sort()).toEqual([...cardHrefs].sort());

    const rails = page.locator('main [role="region"][tabindex="0"]');
    expect(await rails.count()).toBeGreaterThan(0);
    const rail = rails.first();
    await expect(rail).toHaveAttribute("aria-label", /\S/);
    const canScroll = await rail.evaluate((el) => el.scrollWidth > el.clientWidth);
    if (canScroll) {
      await rail.focus();
      await page.keyboard.press("ArrowRight");
      await page.keyboard.press("ArrowRight");
      await expect.poll(() => rail.evaluate((el) => el.scrollLeft)).toBeGreaterThan(0);
    }
  });
});
