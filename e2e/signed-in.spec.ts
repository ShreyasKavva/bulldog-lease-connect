/**
 * Signed-in flows. Only run with E2E_EMAIL + E2E_PASSWORD, and never against
 * production (fixture skips). Use a dedicated test account on the preview/dev
 * backend. NOTE: preview and leasup.co share one database today, so these
 * specs write real rows — each cleans up what it creates where the UI allows.
 */
import { authed as test, expect, waitForBrowse, cardLinks } from "./fixtures";

test("save and unsave a listing", async ({ signedIn: page }) => {
  await page.goto("/browse?view=grid");
  await waitForBrowse(page);
  const heart = page.getByRole("button", { name: /^(Save|Unsave)$/ }).first();
  const before = await heart.getAttribute("aria-label");
  await heart.click();
  await expect(heart).not.toHaveAttribute("aria-label", before!);
  await heart.click(); // restore original state
  await expect(heart).toHaveAttribute("aria-label", before!);
});

test("send a message to a poster", async ({ signedIn: page }) => {
  await page.goto("/browse?view=grid");
  await waitForBrowse(page);
  await page.goto((await cardLinks(page).first().getAttribute("href"))!);
  await page.getByRole("button", { name: /message/i }).first().click();
  const box = page.getByRole("textbox").last();
  await box.fill(`[e2e] automated test ${Date.now()} — please ignore`);
  await box.press("Enter");
  await expect(page.getByText(/\[e2e\] automated test/).last()).toBeVisible();
});

test("post wizard opens for a signed-in user (does not publish)", async ({ signedIn: page }) => {
  // Stops before the final publish so no listing is created.
  await page.goto("/post");
  await expect(page.getByRole("heading").first()).toBeVisible();
  await expect(page.getByText(/sign in to continue/i)).toHaveCount(0);
});
