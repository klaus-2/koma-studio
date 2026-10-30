import { defineConfig, devices } from "@playwright/test";

const runRoot = process.env.E2E_RUN_ROOT ?? "./.runs/local";

export default defineConfig({
  testDir: "./specs",
  outputDir: `${runRoot}/report/playwright`,
  fullyParallel: false,
  workers: 1,
  timeout: 120 * 60_000,
  expect: { timeout: 30_000 },
  reporter: [
    ["list"],
    ["junit", { outputFile: `${runRoot}/report/junit.xml` }],
  ],
  use: {
    baseURL: process.env.E2E_VITE_URL ?? "http://127.0.0.1:43102",
    locale: "en-US",
    viewport: { width: 1280, height: 800 },
    deviceScaleFactor: 1,
    actionTimeout: 60_000,
    navigationTimeout: 120_000,
    trace: "retain-on-failure",
    screenshot: "only-on-failure",
  },
  projects: [{ name: "chromium", use: { ...devices["Desktop Chrome"] } }],
});
