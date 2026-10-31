import { expect, type Page } from "@playwright/test";

import type { KomaE2EManualEditState } from "../entry/e2e-state.ts";
import { clickWithDomFallback } from "../support/dom.ts";

export const DETECT_STAGE = 0;
export const RENDER_STAGE = 5;
export const SEGMENT_STAGE = 3;

const palette = (page: Page) =>
  page.locator('[data-tour="dashboard-manual-dock"]');

const configPanel = (page: Page) =>
  page.locator('aside[aria-label="Active tool configuration"]');

export const toolButton = (page: Page, name: string) =>
  palette(page).getByRole("button", { name, exact: true }).first();

const clickConfigButton = async (page: Page, name: string): Promise<void> => {
  await clickWithDomFallback(
    configPanel(page).getByRole("button", { name, exact: true }),
  );
};

export const readActiveImage = (page: Page): Promise<string | null> =>
  page.evaluate(() => window.__komaE2E?.activeImageId() ?? null);

export const readRegionCount = (page: Page, imageId: string): Promise<number> =>
  page.evaluate(
    (id) => window.__komaE2E?.regionCount(id) ?? 0,
    imageId,
  );

const readManualEdit = (
  page: Page,
  imageId: string,
): Promise<KomaE2EManualEditState> =>
  page.evaluate(
    (id) =>
      window.__komaE2E?.manualEdit(id) ?? {
        paint: false,
        wand: false,
        segment: false,
        base: false,
      },
    imageId,
  );

export const setStage = async (page: Page, index: number): Promise<void> => {
  await page.evaluate(
    (stageIndex) => window.__komaE2E?.setManualStageIndex(stageIndex),
    index,
  );
  await page.waitForTimeout(300);
};

const ACTIVE_CARD = '[data-tour="dashboard-active-preview-card"]';

const largestCanvas = async (page: Page) => {
  const selectors = [
    ".koma-render-canvas",
    ".koma-segment-brush-canvas",
    "main canvas",
  ];
  const cards = page.locator(ACTIVE_CARD);
  const scopes =
    (await cards.count()) > 0 ? [cards.first(), page] : [page];
  for (const scope of scopes) {
    for (const selector of selectors) {
      const locator = scope.locator(selector).last();
      if ((await locator.count()) === 0) continue;
      await locator.scrollIntoViewIfNeeded().catch(() => undefined);
      const box = await locator.boundingBox();
      if (box && box.width > 100 && box.height > 100) {
        console.log(
          `[flow] manual: canvas ${selector}${scope === page ? " (page scope)" : ""} ${Math.round(box.width)}x${Math.round(box.height)}`,
        );
        return { locator, box };
      }
    }
  }
  throw new Error("E2E_MANUAL_CANVAS_MISSING");
};

export const dragCanvas = async (page: Page): Promise<void> => {
  const { box } = await largestCanvas(page);
  const startX = box.x + box.width * 0.32;
  const startY = box.y + box.height * 0.32;
  const endX = box.x + box.width * 0.52;
  const endY = box.y + box.height * 0.52;
  await page.mouse.move(startX, startY);
  await page.mouse.down();
  await page.mouse.move(endX, endY, { steps: 8 });
  await page.mouse.up();
};

const clickCanvas = async (page: Page): Promise<void> => {
  const { box } = await largestCanvas(page);
  await page.mouse.click(box.x + box.width * 0.45, box.y + box.height * 0.45);
};

const expectEdit = async (
  page: Page,
  imageId: string,
  field: keyof KomaE2EManualEditState,
): Promise<void> => {
  await expect
    .poll(async () => (await readManualEdit(page, imageId))[field], {
      timeout: 30_000,
    })
    .toBe(true);
};

export const selectCompletedImage = async (page: Page): Promise<string> => {
  const summaries = await page.evaluate(
    () => window.__komaE2E?.imageSummaries() ?? [],
  );
  if (summaries.length === 0) throw new Error("E2E_MANUAL_NO_IMAGES");
  console.log(
    `[flow] manual: regions ${summaries
      .map((summary) => `${summary.name}=${summary.regions}`)
      .join(", ")}`,
  );
  const best = summaries.reduce((left, right) =>
    right.regions > left.regions ? right : left,
  );
  if (best.regions === 0) throw new Error("E2E_MANUAL_NO_DETECTIONS");
  if ((await readActiveImage(page)) !== best.id) {
    await page
      .locator('[data-tour="dashboard-sidebar"]')
      .getByText(best.name, { exact: true })
      .click();
    await expect.poll(() => readActiveImage(page)).toBe(best.id);
  }
  console.log(`[flow] manual: active image ${best.name}`);
  return best.id;
};

export const closeManualConfig = async (page: Page): Promise<void> => {
  if (
    await page.evaluate(
      () => window.__komaE2E?.manualToolsConfigOpen() ?? false,
    )
  ) {
    await toolButton(page, "Close config").click();
    await expect
      .poll(() =>
        page.evaluate(() => window.__komaE2E?.manualToolsConfigOpen()),
      )
      .toBe(false);
  }
};

export const runManualTools = async (page: Page): Promise<void> => {
  console.log("[flow] manual: open AIO manual");
  await page
    .getByRole("tab", { name: "AIO manual", exact: true })
    .click();
  await expect(palette(page)).toBeVisible();

  const imageId = await selectCompletedImage(page);

  const configOpen = await page.evaluate(
    () => window.__komaE2E?.manualToolsConfigOpen() ?? false,
  );
  await toolButton(page, configOpen ? "Close config" : "Open config").click();
  await expect
    .poll(() => page.evaluate(() => window.__komaE2E?.manualToolsConfigOpen()))
    .toBe(!configOpen);
  await toolButton(page, configOpen ? "Open config" : "Close config").click();
  await expect
    .poll(() => page.evaluate(() => window.__komaE2E?.manualToolsConfigOpen()))
    .toBe(configOpen);

  await setStage(page, DETECT_STAGE);
  console.log("[flow] manual: area select + duplicate/convert");
  await toolButton(page, "Select area").click();
  await dragCanvas(page);
  const baselineRegions = await readRegionCount(page, imageId);
  expect(baselineRegions).toBeGreaterThanOrEqual(1);
  await page.evaluate(() => window.__komaE2E?.selectFirstRegion());
  await clickConfigButton(page, "Duplicate");
  await expect.poll(() => readRegionCount(page, imageId)).toBe(baselineRegions + 1);
  for (const label of ["→ Auto", "→ Rectangular", "→ Elliptical"]) {
    await clickConfigButton(page, label);
  }
  await page.evaluate(() => window.__komaE2E?.clearRegionSelection());

  await setStage(page, SEGMENT_STAGE);
  console.log("[flow] manual: segment brush/eraser");
  await toolButton(page, "Segmented area brush").click();
  await dragCanvas(page);
  await expectEdit(page, imageId, "segment");
  await toolButton(page, "Segmented area eraser").click();
  await dragCanvas(page);

  await setStage(page, RENDER_STAGE);
  console.log("[flow] manual: paint/eraser/wand/healing");
  await toolButton(page, "Paint brush").click();
  await dragCanvas(page);
  await expectEdit(page, imageId, "paint");
  await toolButton(page, "Paint eraser").click();
  await dragCanvas(page);

  await toolButton(page, "Magic wand").click();
  await clickCanvas(page);
  await expect
    .poll(async () => (await readManualEdit(page, imageId)).wand, {
      timeout: 30_000,
    })
    .toBe(true);
  await clickConfigButton(page, "Healing");
  await expect
    .poll(async () => (await readManualEdit(page, imageId)).base, {
      timeout: 5 * 60_000,
    })
    .toBe(true);
  await expect
    .poll(async () => (await readManualEdit(page, imageId)).wand)
    .toBe(false);

  const baseBeforeHealingBrush = await page.evaluate(
    (id) => window.__komaE2E?.baseSignature(id) ?? null,
    imageId,
  );
  await toolButton(page, "Healing Brush").click();
  await dragCanvas(page);
  await expect
    .poll(
      async () =>
        page.evaluate(
          (id) => window.__komaE2E?.baseSignature(id) ?? null,
          imageId,
        ),
      { timeout: 5 * 60_000 },
    )
    .not.toBe(baseBeforeHealingBrush);
  await toolButton(page, "Clear paint").click();
  await expect
    .poll(async () => (await readManualEdit(page, imageId)).paint)
    .toBe(false);
  await toolButton(page, "Reset all edits").click();
  await expect
    .poll(async () => {
      const state = await readManualEdit(page, imageId);
      return state.paint || state.wand || state.base;
    })
    .toBe(false);

  await closeManualConfig(page);
};

export const clearAllRegions = async (page: Page): Promise<void> => {
  const imageId = await readActiveImage(page);
  if (!imageId) throw new Error("E2E_MANUAL_ACTIVE_IMAGE_MISSING");
  await setStage(page, RENDER_STAGE);
  console.log("[flow] manual: clear all regions");
  await toolButton(page, "Clear all regions").click();
  await expect.poll(() => readRegionCount(page, imageId)).toBe(0);
};

export const runManualSmoke = async (page: Page): Promise<void> => {
  await page.getByRole("tab", { name: "AIO manual", exact: true }).click();
  await expect(palette(page)).toBeVisible();
  const imageId = await readActiveImage(page);
  if (!imageId) throw new Error("E2E_MANUAL_ACTIVE_IMAGE_MISSING");

  await setStage(page, DETECT_STAGE);
  console.log("[flow] manual: area select + duplicate/convert");
  await toolButton(page, "Select area").click();
  await clickCanvas(page);

  await setStage(page, SEGMENT_STAGE);
  console.log("[flow] manual: segment brush/eraser");
  await toolButton(page, "Segmented area brush").click();
  await dragCanvas(page);

  await setStage(page, RENDER_STAGE);
  console.log("[flow] manual: paint/eraser/wand/healing");
  await toolButton(page, "Paint brush").click();
  await dragCanvas(page);
  await expectEdit(page, imageId, "paint");
  await toolButton(page, "Clear paint").click();
  await expect
    .poll(async () => (await readManualEdit(page, imageId)).paint)
    .toBe(false);
};
