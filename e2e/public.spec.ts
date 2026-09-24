import { test, expect, collectConsoleErrors, waitForBrowse, cardLinks } from "./fixtures";

test.describe("homepage", () => {
  test("loads with no console errors", async ({ page }) => {
    const errors = collectConsoleErrors(page);
    await page.goto("/");
    await expect(page.locator("h1").first()).toBeVisible();
    await page.waitForLoadState("networkidle").catch(() => {});
    expect(errors, errors.join("\n")).toEqual([]);
  });
});

test.describe("/browse grid", () => {
  test("renders cards, each with a real /listing/$id link", async ({ page }) => {
    await page.goto("/browse?view=grid");
    await waitForBrowse(page);
    const links = cardLinks(page);
    const n = await links.count();
    expect(n).toBeGreaterThan(0);
    for (let i = 0; i < n; i++) {
      const href = await links.nth(i).getAttribute("href");
      expect(href).toMatch(/^\/listing\/[0-9a-f-]{36}$/);
    }
    // Links must resolve: open the first one directly.
    const href = await links.first().getAttribute("href");
    const res = await page.request.get(href!);
    expect(res.status()).toBe(200);
  });
});

test.describe("/browse filters", () => {
  const cases: { name: string; qs: string }[] = [
    { name: "price", qs: "max_price=1" },
    { name: "beds", qs: "bedrooms=2" },
    { name: "dates", qs: "from=2031-01-01&to=2031-02-01" },
    { name: "campus", qs: "campus=georgia-tech" },
  ];

  for (const c of cases) {
    test(`${c.name} filter changes results and survives reload`, async ({ page }) => {
      await page.goto("/browse?view=grid");
      await waitForBrowse(page);
      const baseline = await cardLinks(page).count();
      expect(baseline).toBeGreaterThan(0);

      await page.goto(`/browse?view=grid&${c.qs}`);
      await waitForBrowse(page);
      const filtered = await cardLinks(page).count();
      expect(filtered).toBeLessThan(baseline);

      await page.reload();
      await waitForBrowse(page);
      // Router may JSON-quote values (bedrooms=2 -> bedrooms=%222%22); compare decoded.
      const [k, v] = c.qs.split("&")[0].split("=");
      expect(new URL(page.url()).searchParams.get(k)?.replace(/"/g, "")).toBe(v);
      expect(await cardLinks(page).count()).toBe(filtered);
    });
  }
});

test.describe("/browse view toggle", () => {
  test("Grid -> Map -> Grid works", async ({ page }) => {
    await page.goto("/browse?view=grid");
    await waitForBrowse(page);
    await page.locator("button[aria-pressed]", { hasText: /^Map$/ }).click();
    await expect(page).toHaveURL(/view=map/);
    await expect(page.locator(".leaflet-container").first()).toBeVisible();
    await expect(page.locator(".leaflet-control-attribution").first()).toContainText("OpenStreetMap");
    await page.locator("button[aria-pressed]", { hasText: /^Grid$/ }).click();
    await expect(page).toHaveURL(/view=grid/);
    await expect(cardLinks(page).first()).toBeVisible();
    // Remembered view must not trap the user in map after reload.
    await page.reload();
    await expect(cardLinks(page).first()).toBeVisible();
  });
});

test.describe("listing slide-out", () => {
  test("opens with Enter and closes with Escape", async ({ page }) => {
    await page.goto("/browse?view=grid");
    await waitForBrowse(page);
    const first = cardLinks(page).first();
    await first.focus();
    await page.keyboard.press("Enter");
    const dialog = page.getByRole("dialog").first();
    await expect(dialog).toBeVisible();
    await page.keyboard.press("Escape");
    await expect(dialog).toBeHidden();
    await expect(page).toHaveURL(/\/browse/);
  });

  test("/listing/$id page loads directly", async ({ page }) => {
    await page.goto("/browse?view=grid");
    await waitForBrowse(page);
    const href = await cardLinks(page).first().getAttribute("href");
    const errors = collectConsoleErrors(page);
    await page.goto(href!);
    await expect(page.locator("h1").first()).toBeVisible();
    await expect(page.locator("h1").first()).not.toHaveText("");
    expect(errors, errors.join("\n")).toEqual([]);
  });
});

test.describe("sign-in gates (signed out)", () => {
  for (const path of ["/post", "/messages", "/my-listings"]) {
    test(`${path} shows a sign-in gate`, async ({ page }) => {
      await page.goto(path);
      await expect(page.getByText(/sign in/i).first()).toBeVisible();
      // Must not render signed-in UI.
      await expect(page.getByRole("textbox", { name: /message/i })).toHaveCount(0);
    });
  }

  test("save heart prompts sign-in", async ({ page }) => {
    await page.goto("/browse?view=grid");
    await waitForBrowse(page);
    await page.getByRole("button", { name: /^Save$/ }).first().click();
    await expect(page.getByText(/sign in/i).first()).toBeVisible();
  });
});
