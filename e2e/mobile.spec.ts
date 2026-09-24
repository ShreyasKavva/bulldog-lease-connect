import { test, expect } from "./fixtures";

test.use({ viewport: { width: 375, height: 812 }, isMobile: true, hasTouch: true });

/** Route -> whether the signed-out bottom tab bar is expected. */
const ROUTES: [string, boolean][] = [
  ["/", true],
  ["/browse", true],
  ["/looking", true],
  ["/market", true],
  ["/campuses", true],
  ["/about", true],
  ["/faq", true],
  ["/messages", true],
  ["/saved", true],
  ["/post", true],
  ["/tours", true],
  ["/my-listings", true],
];

const BAD_TEXT = [/\bundefined\b/, /\bNaN\b/, /\bnull\b/];
// Zero counts shown to a renter, e.g. "0 listings", "0 subleases", "Upvote 0".
const ZERO_COUNT = /(^|[^\d$.,])0 (listings?|subleases?|campus(es)?|results?|reviews?|saves?)\b|Upvote 0\b/i;

for (const [path, wantsNav] of ROUTES) {
  test(`${path} @375: no h-scroll, clean text, tab bar ${wantsNav ? "visible" : "absent"}`, async ({ page }) => {
    await page.goto(path);
    await page.waitForLoadState("networkidle").catch(() => {});
    await page.waitForTimeout(800);

    const overflow = await page.evaluate(() => document.documentElement.scrollWidth - window.innerWidth);
    expect(overflow, `horizontal overflow of ${overflow}px`).toBeLessThanOrEqual(1);

    const text = await page.locator("body").innerText();
    for (const r of BAD_TEXT) expect(text, `found ${r}`).not.toMatch(r);
    expect(text.match(ZERO_COUNT)?.[0] ?? null, "zero count shown").toBeNull();

    const nav = page.locator("nav.fixed.bottom-0");
    if (wantsNav) await expect(nav).toBeVisible();
    else await expect(nav).toHaveCount(0);
  });
}
