import { defineConfig, devices } from "@playwright/test";

export default defineConfig({
  testDir: "./e2e",
  fullyParallel: true,
  // session-expiry.spec.ts's short-timebox group stops and swaps the shared
  // local Supabase backend out from under whatever else is running against
  // it (see that file's own header comment) — every spec file in this suite
  // shares one Supabase instance, so cross-file parallelism is not safe.
  workers: 1,
  forbidOnly: !!process.env.CI,
  retries: process.env.CI ? 2 : 0,
  reporter: "html",
  use: {
    baseURL: "http://localhost:3000",
    trace: "on-first-retry",
    ...devices["Desktop Chrome"],
  },
  webServer: {
    // Keep the app's client-side expiry calculation aligned with the
    // 10-second Supabase project used by session-expiry.spec.ts. The app
    // falls back to its real 30-day lifetime outside this test server.
    command: "SESSION_TIMEBOX_MS=10000 npm run dev",
    url: "http://localhost:3000",
    timeout: 120_000,
    reuseExistingServer: !process.env.CI,
  },
});
