import { defineConfig, devices } from "@playwright/test";

const storageState = process.env.PLAYWRIGHT_STORAGE_STATE;
const executablePath = process.env.PLAYWRIGHT_EXECUTABLE_PATH;
const localLaunchOptions = executablePath ? { launchOptions: { executablePath } } : {};

export default defineConfig({
  testDir: "./tests/e2e",
  // Session tests share the local Supabase rate limiter; keep mutations deterministic.
  fullyParallel: false,
  retries: process.env.CI ? 2 : 0,
  reporter: process.env.CI ? "github" : "list",
  use: {
    baseURL: process.env.PLAYWRIGHT_BASE_URL ?? "http://localhost:3000",
    locale: "pt-BR",
    ...(storageState ? { storageState } : {}),
    trace: "on-first-retry",
  },
  projects: [
    { name: "chromium", use: { ...devices["Desktop Chrome"], ...localLaunchOptions } },
    { name: "mobile", use: { ...devices["Pixel 7"], ...localLaunchOptions } },
  ],
  webServer: process.env.PLAYWRIGHT_BASE_URL
    ? undefined
    : {
        command: "npm run dev:next",
        url: "http://localhost:3000",
        reuseExistingServer: !process.env.CI,
        timeout: 120_000,
      },
});
