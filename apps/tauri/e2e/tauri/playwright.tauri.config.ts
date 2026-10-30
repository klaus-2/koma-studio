import { defineConfig } from "@playwright/test";

const runRoot = process.env.E2E_RUN_ROOT ?? "./.runs/tauri";

export default defineConfig({
  testDir: ".",
  testMatch: /real-flow\.spec\.ts/,
  fullyParallel: false,
  workers: 1,
  timeout: 120 * 60_000,
  expect: { timeout: 30_000 },
  reporter: [
    ["list"],
    ["junit", { outputFile: `${runRoot}/report/tauri-junit.xml` }],
  ],
  use: {
    actionTimeout: 60_000,
    navigationTimeout: 120_000,
    trace: "retain-on-failure",
    screenshot: "only-on-failure",
  },
});
