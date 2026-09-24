import { defineConfig, devices } from "@playwright/test";

/**
 * LeaseUp end-to-end suite. Run: `bun run test:e2e`
 * Target defaults to the local dev server; override with E2E_BASE_URL.
 * Signed-in specs only run when E2E_EMAIL + E2E_PASSWORD are set AND the
 * target is not production (see e2e/fixtures.ts).
 */
export default defineConfig({
  testDir: "./e2e",
  timeout: 60_000,
  expect: { timeout: 15_000 },
  fullyParallel: false,
  workers: 2,
  retries: 0,
  reporter: [["list"]],
  use: {
    baseURL: process.env.E2E_BASE_URL ?? "http://localhost:8080",
    trace: "retain-on-failure",
    viewport: { width: 1280, height: 900 },
  },
  projects: [{ name: "chromium", use: { ...devices["Desktop Chrome"], viewport: { width: 1280, height: 900 } } }],
});
