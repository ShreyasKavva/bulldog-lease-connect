import { test as base, expect, type Page } from "@playwright/test";

export const PROD_HOSTS = ["leasup.co", "www.leasup.co", "bulldog-lease-connect.lovable.app"];

export function isProduction(baseURL: string | undefined): boolean {
  if (!baseURL) return false;
  try {
    return PROD_HOSTS.includes(new URL(baseURL).hostname);
  } catch {
    return false;
  }
}

/** Console noise that is not an app error (dev tooling, third-party). */
const IGNORED_CONSOLE = [/\[vite\]/i, /Download the React DevTools/i, /favicon/i, /ERR_BLOCKED_BY_CLIENT/i];

export function collectConsoleErrors(page: Page): string[] {
  const errors: string[] = [];
  page.on("console", (m) => {
    if (m.type() !== "error") return;
    const t = m.text();
    if (IGNORED_CONSOLE.some((r) => r.test(t))) return;
    errors.push(t);
  });
  page.on("pageerror", (e) => errors.push(`pageerror: ${e.message}`));
  return errors;
}

/** Wait until /browse has finished loading: cards or an empty state. */
export async function waitForBrowse(page: Page) {
  await page.waitForLoadState("domcontentloaded");
  await expect
    .poll(async () => (await cardLinks(page).count()) > 0 || (await page.getByText(/^No subleases/).count()) > 0, {
      timeout: 20_000,
    })
    .toBe(true);
}

export function cardLinks(page: Page) {
  // The whole-card anchor on ListingCard (aria-label "View …").
  return page.locator('article a[href^="/listing/"][aria-label^="View "]');
}

/** Signed-in fixture: skipped unless creds exist and target is not prod. */
export const authed = base.extend<{ signedIn: Page }>({
  signedIn: async ({ page, baseURL }, use, testInfo) => {
    const email = process.env.E2E_EMAIL;
    const password = process.env.E2E_PASSWORD;
    testInfo.skip(!email || !password, "Skipped: set E2E_EMAIL and E2E_PASSWORD to run signed-in flows.");
    testInfo.skip(isProduction(baseURL), `Skipped: signed-in flows never run against production (${baseURL}).`);
    await page.goto("/auth");
    await page.getByLabel(/email/i).first().fill(email!);
    await page.getByLabel(/password/i).first().fill(password!);
    await page.getByRole("button", { name: /^sign in/i }).first().click();
    await page.waitForURL((u) => !u.pathname.startsWith("/auth"), { timeout: 20_000 });
    await use(page);
  },
});

export { base as test, expect };
