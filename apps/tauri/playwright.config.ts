import { defineConfig, devices } from "@playwright/test";

const PORT = Number(process.env.PLAYWRIGHT_PORT ?? 5173);
const BASE_URL = process.env.PLAYWRIGHT_BASE_URL ?? `http://127.0.0.1:${PORT}`;
const V1_PORT = Number(process.env.PLAYWRIGHT_V1_PORT ?? 5174);
const V1_BASE_URL =
  process.env.PLAYWRIGHT_V1_BASE_URL ?? `http://127.0.0.1:${V1_PORT}`;
const VISUAL_COMPARE = process.env.PLAYWRIGHT_VISUAL_COMPARE === "1";
const reuseExistingServer = !process.env.CI;
const webServer = process.env.PLAYWRIGHT_REUSE_SERVER
  ? undefined
  : [
      {
        command: "bun run dev:e2e",
        url: BASE_URL,
        name: "v2",
        reuseExistingServer,
        timeout: 120_000,
      },
      ...(VISUAL_COMPARE
        ? [
            {
              command: "node scripts/start-v1-e2e.mjs",
              url: V1_BASE_URL,
              name: "v1",
              reuseExistingServer,
              timeout: 120_000,
            },
          ]
        : []),
    ];

export default defineConfig({
  testDir: "./tests/e2e",
  outputDir: "./tests/e2e/.artifacts",
  fullyParallel: true,
  forbidOnly: !!process.env.CI,
  retries: process.env.CI ? 2 : 0,
  workers: process.env.CI ? 2 : undefined,
  reporter: [["list"], ["html", { open: "never" }]],
  expect: {
    timeout: 10_000,
    toHaveScreenshot: {
      maxDiffPixelRatio: 0.02,
      threshold: 0.2,
    },
    toMatchSnapshot: {
      maxDiffPixelRatio: 0.02,
      threshold: 0.2,
    },
  },
  use: {
    baseURL: BASE_URL,
    trace: "on-first-retry",
    screenshot: "only-on-failure",
    video: "retain-on-failure",
  },
  projects: [
    { name: "chromium", use: { ...devices["Desktop Chrome"] } },
    { name: "webkit", use: { ...devices["Desktop Safari"] } },
  ],
  webServer,
});
