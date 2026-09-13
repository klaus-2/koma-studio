import { expect, test, type Page } from "@playwright/test";

// Refactor smoke for the Dashboard decomposition (refactor-queue.md):
// DashboardPage was extracted into 15 zustand stores + 15 hook files + 12
// section components. Runs with auth disabled (.env.e2e → VITE_AUTH_DISABLED),
// walking the protected routes and failing on any uncaught exception, React
// render error, or Vite overlay. Local sidecars the desktop shell normally
// supervises (auth :3001, mini-backend :8001) are offline in web e2e — their
// connection failures are expected noise, not app errors.

const DASHBOARD_ROUTES = [
  "/#/dashboard",
  "/#/dashboard?panel=aio",
  "/#/dashboard?panel=aio&stage=translate",
  "/#/dashboard?panel=translation",
  "/#/dashboard?panel=cleaner",
  "/#/dashboard?panel=autosave",
  "/#/settings",
  "/#/model-rankings",
  "/#/scanlation-feed",
];

const LOCAL_SIDECAR_NOISE =
  /127\.0\.0\.1:(3001|8000|8001)|localhost:(3001|8000|8001)|Failed to fetch|net::ERR_CONNECTION_REFUSED|net::ERR_FAILED|Failed to load resource/i;

interface Problem {
  kind: "pageerror" | "react-fatal" | "vite-overlay" | "http-5xx";
  detail: string;
}

const collectProblems = (page: Page): Problem[] => {
  const problems: Problem[] = [];
  page.on("pageerror", (error) => {
    problems.push({ kind: "pageerror", detail: error.message });
  });
  page.on("console", (message) => {
    if (message.type() !== "error") return;
    const text = message.text();
    if (LOCAL_SIDECAR_NOISE.test(text)) return;
    if (
      text.includes("[react] uncaught render error") ||
      text.includes("[react] error caught by boundary")
    ) {
      problems.push({ kind: "react-fatal", detail: text });
    }
  });
  page.on("response", (response) => {
    if (response.status() >= 500 && !LOCAL_SIDECAR_NOISE.test(response.url())) {
      problems.push({
        kind: "http-5xx",
        detail: `${response.status()} ${response.url()}`,
      });
    }
  });
  return problems;
};

const settle = async (page: Page): Promise<void> => {
  await expect(page.locator("#root")).toBeVisible();
  await expect(page.locator("vite-error-overlay")).toHaveCount(0);
  // Let async effects (stores hydrating, lazy catalogs) settle.
  await page.waitForLoadState("networkidle").catch(() => undefined);
};

test.describe("dashboard refactor smoke", () => {
  test("auth bypass lands directly on the dashboard shell", async ({ page }) => {
    const problems = collectProblems(page);

    await page.goto("/#/dashboard", { waitUntil: "domcontentloaded" });
    await expect(page.locator("html")).toHaveAttribute(
      "data-playwright-web-access",
      "enabled",
    );
    await settle(page);

    // Auth disabled: no login shell, dashboard chrome instead.
    await expect(page.locator(".auth-shell")).toHaveCount(0);
    await expect(page.locator(".koma-topbar")).toBeVisible();
    await expect(page).not.toHaveURL(/#\/login/);

    expect(problems, "fatal problems on the dashboard shell").toEqual([]);
  });

  for (const route of DASHBOARD_ROUTES) {
    test(`no fatal errors on ${route}`, async ({ page }) => {
      const problems = collectProblems(page);

      await page.goto(route, { waitUntil: "domcontentloaded" });
      await settle(page);

      expect(problems, `fatal problems on ${route}`).toEqual([]);
    });
  }

  test("dashboard screenshot for the refactor hand-off", async ({ page }) => {
    await page.goto("/#/dashboard", { waitUntil: "domcontentloaded" });
    await settle(page);
    await expect(page.locator(".koma-topbar")).toBeVisible();
    await page.screenshot({
      path: "tests/e2e/.artifacts/dashboard-refactor-smoke.png",
      fullPage: false,
    });
  });
});
