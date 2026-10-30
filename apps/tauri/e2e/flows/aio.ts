import { expect, type Locator, type Page } from "@playwright/test";

// Toast/status overlays occasionally sit on top of the primary action; the
// React handler still fires when the click is dispatched straight at it.
const clickWithDomFallback = async (locator: Locator): Promise<void> => {
  try {
    await locator.click({ timeout: 10_000 });
    return;
  } catch {
    console.log("[flow] click intercepted; dispatching DOM click");
    await locator.evaluate((element) => {
      if (element instanceof HTMLElement) element.click();
    });
  }
};

export const ensureAutomaticSubMode = async (page: Page): Promise<void> => {
  const tab = page.getByRole("tab", {
    name: "AIO automatic",
    exact: true,
  });
  if ((await tab.getAttribute("aria-selected")) !== "true") {
    await tab.click();
  }
};

export const loadImages = async (
  page: Page,
  files: string[],
): Promise<void> => {
  await page
    .locator('[data-tour="dashboard-dropzone"] input[type="file"]')
    .setInputFiles(files);
};

export const imageCount = (page: Page): Promise<number> =>
  page.evaluate(() => window.__komaE2E?.imageCount() ?? 0);

export const aioSnapshotCount = (page: Page): Promise<number> =>
  page.evaluate(() => window.__komaE2E?.aioSnapshots() ?? 0);

export const waitForAioIdle = async (page: Page): Promise<void> => {
  const stop = page.getByRole("button", {
    name: "Stop execution",
    exact: true,
  });
  await expect(stop).toBeVisible({ timeout: 60_000 });
  console.log("[flow] AIO processing started");
  await expect(stop).toHaveCount(0, { timeout: 25 * 60_000 });
  await expect
    .poll(() => page.evaluate(() => window.__komaE2E?.processing() ?? true), {
      timeout: 30_000,
    })
    .toBe(false);
  console.log("[flow] AIO processing finished");
};

export const runAio = async (page: Page): Promise<void> => {
  const run = page.getByRole("button", { name: "Run AIO", exact: true });
  await expect(run).toBeEnabled({ timeout: 60_000 });
  console.log("[flow] Run AIO clicked");
  await clickWithDomFallback(run);
  await waitForAioIdle(page);
};
