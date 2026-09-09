import { expect, test } from "@playwright/test";
import fs from "node:fs";

const scenarios = JSON.parse(
  fs.readFileSync(new URL("./e2e-scenarios.json", import.meta.url), "utf8"),
) as Array<{ area: string }>;

test("e2e web access mode serves the app through Vite", async ({ page }) => {
  await page.goto("/#/login", { waitUntil: "domcontentloaded" });

  await expect(page.locator("html")).toHaveAttribute(
    "data-playwright-web-access",
    "enabled",
  );
  await expect(page.locator("#root")).toBeVisible();
  await expect(page.locator("vite-error-overlay")).toHaveCount(0);
});

test("phase 1.6 scenario matrix stays above the required coverage floor", () => {
  expect(scenarios.length).toBeGreaterThanOrEqual(30);
  const areas = [...new Set(scenarios.map((scenario) => scenario.area))];
  expect(areas).toEqual(
    expect.arrayContaining([
      "auth",
      "dashboard",
      "aio",
      "models",
      "autosave",
      "updater",
      "settings",
      "feed",
      "rankings",
      "bug-report",
    ]),
  );
});
