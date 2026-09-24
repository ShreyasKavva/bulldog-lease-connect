/**
 * Q521 — /market: campus choice in the URL, real controls, honest states,
 * accessibility and 375px layout. Read-only: never signs in, never writes.
 * axe-core is injected from a CDN at test time (no new project dependency).
 */
import { test, expect, type Page } from "@playwright/test";
import { collectConsoleErrors } from "./fixtures";

const AXE_URL = "https://cdnjs.cloudflare.com/ajax/libs/axe-core/4.10.2/axe.min.js";

async function axeSerious(page: Page) {
  await page.addScriptTag({ url: AXE_URL });
  return page.evaluate(async () => {
    // @ts-expect-error injected global
    const r = await window.axe.run(document, { runOnly: ["wcag2a", "wcag2aa", "wcag21a", "wcag21aa"] });
    return r.violations
      .filter((v: any) => v.impact === "serious" || v.impact === "critical")
      .map((v: any) => ({
        id: v.id,
        nodes: v.nodes
          .map((n: any) => n.target.join(" "))
      }))
      .filter((v: any) => v.nodes.length > 0);
  });
}

const pills = (page: Page) => page.getByRole("navigation", { name: "Choose a campus" }).getByRole("link");

test.describe("/market", () => {
  test("SSR HTML has the heading and real campus links, and no zero counts", async ({ request }) => {
    const res = await request.get("/market");
    expect(res.status()).toBe(200);
    const html = await res.text();
    expect(html).toContain("Sublease market data");
    const links = [...new Set(html.match(/href="\/market\?campus=[a-z0-9-]+"/g) ?? [])];
    console.log(`SSR: ${links.length} campus links`);
    expect(links.length).toBeGreaterThan(0);
    expect(html).not.toMatch(/>\s*0\s*(<|listings|subleases)/);
    expect(html).not.toMatch(/\b(NaN|undefined|null)\b<\//);
  });

  test("campus choice goes in the URL, survives reload and Back", async ({ page }) => {
    const errors = collectConsoleErrors(page);
    await page.goto("/market", { waitUntil: "networkidle" });
    const all = pills(page);
    const n = await all.count();
    test.skip(n < 2, "needs at least two campuses");
    await expect(all.first()).toHaveAttribute("aria-current", "page");
    const second = all.nth(1);
    const name = (await second.innerText()).trim();
    await second.click();
    await expect(page).toHaveURL(/\?campus=/);
    await expect(page.getByRole("heading", { level: 2, name: new RegExp(`Price by bedroom — ${name}`) })).toBeVisible();
    const url = page.url();
    await page.reload({ waitUntil: "networkidle" });
    expect(page.url()).toBe(url);
    await expect(pills(page).filter({ hasText: name }).first()).toHaveAttribute("aria-current", "page");
    await page.goBack({ waitUntil: "networkidle" });
    await expect(page).not.toHaveURL(/\?campus=/);
    await expect(pills(page).first()).toHaveAttribute("aria-current", "page");
    expect(errors.filter((e) => /hydrat|did not match|mismatch/i.test(e))).toEqual([]);
  });

  test("unknown campus in the URL falls back with a plain message", async ({ page }) => {
    await page.goto("/market?campus=not-a-real-campus", { waitUntil: "networkidle" });
    await expect(page.getByText("We couldn't find that campus")).toBeVisible();
  });

  test("every control in main is a named link or button, 44px tall", async ({ page }) => {
    await page.goto("/market", { waitUntil: "networkidle" });
    const bad = await page.evaluate(() => {
      const out: string[] = [];
      document.querySelectorAll("main [onclick], main div[role=button], main span[role=button]").forEach((el) => out.push(`click-div: ${el.outerHTML.slice(0, 80)}`));
      document.querySelectorAll("main a, main button").forEach((el) => {
        const r = (el as HTMLElement).getBoundingClientRect();
        const nameText = (el.getAttribute("aria-label") || el.textContent || "").trim();
        if (!nameText) out.push(`unnamed: ${el.outerHTML.slice(0, 80)}`);
        if (r.height > 0 && r.height < 44) out.push(`small ${Math.round(r.height)}px: ${nameText}`);
      });
      return out;
    });
    expect(bad).toEqual([]);
  });

  test("neighborhood error shows a message and a Try again button", async ({ page }) => {
    await page.goto("/market", { waitUntil: "networkidle" });
    test.skip((await pills(page).count()) < 2, "needs at least two campuses");
    await page.route("**/rest/v1/rpc/get_neighborhood_price_breakdown*", (r) =>
      r.fulfill({ status: 500, contentType: "application/json", body: JSON.stringify({ message: "boom" }) }),
    );
    await pills(page).nth(1).click();
    const alert = page.getByRole("alert").filter({ hasText: "couldn't load neighborhoods" });
    await expect(alert).toBeVisible({ timeout: 15000 });
    await expect(alert.getByRole("button", { name: "Try again" })).toBeVisible();
    await expect(page.locator("body")).not.toContainText("boom");
  });

  for (const width of [375, 1280]) {
    test(`no serious axe violations and no overflow at ${width}px`, async ({ page }) => {
      await page.setViewportSize({ width, height: 1000 });
      await page.goto("/market", { waitUntil: "networkidle" });
      await page.waitForTimeout(500);
      const v = await axeSerious(page);
      expect(v, JSON.stringify(v, null, 2)).toEqual([]);
      expect(await page.evaluate(() => document.documentElement.scrollWidth)).toBeLessThanOrEqual(width);
      await expect(page.locator("main")).toHaveCount(1);
      expect(await page.locator("main h1").count()).toBe(1);
    });
  }

  test("keyboard reaches the campus links with a visible focus ring", async ({ page }) => {
    await page.goto("/market", { waitUntil: "networkidle" });
    const first = pills(page).first();
    await first.focus();
    await page.keyboard.press("Tab");
    await page.keyboard.press("Shift+Tab");
    await expect(first).toBeFocused();
    const shadow = await first.evaluate((el) => getComputedStyle(el).boxShadow);
    expect(shadow).not.toBe("none");
  });
});
