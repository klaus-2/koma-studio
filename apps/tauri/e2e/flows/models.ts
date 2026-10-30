import fs from "node:fs";
import path from "node:path";

import { expect, type Page } from "@playwright/test";

import type { LayerAdapter } from "./layer-adapter.ts";

export interface ModelToInstall {
  stage: string;
  modelId: string;
}

export const MAIN_FLOW_MODELS: ModelToInstall[] = [
  { stage: "Detect Text", modelId: "font_rtdetr_v2" },
  { stage: "Recognize Text", modelId: "manga_ocr" },
  { stage: "Get Translations", modelId: "nllb-200-600m-int8" },
  { stage: "Segment Text", modelId: "baka_content_cc" },
  { stage: "Clean Image", modelId: "aot" },
];

const reloadDashboard = async (
  page: Page,
  adapter: LayerAdapter,
): Promise<void> => {
  await adapter.reload(page);
  await expect(
    page.getByRole("tab", { name: "AIO", exact: true }),
  ).toBeVisible({
    timeout: 120_000,
  });
};

const selectStageTab = async (page: Page, stage: string): Promise<void> => {
  await page.getByRole("tab", { name: stage, exact: true }).click();
  await expect(
    page.getByRole("button", { name: "Models", exact: true }).first(),
  ).toBeVisible();
};

const openStageManager = async (page: Page): Promise<void> => {
  await page
    .getByRole("button", { name: "Models", exact: true })
    .first()
    .click();
  await expect(page.getByText("Model Vault").first()).toBeVisible();
};

const readManifestStatus = (filePath: string): string | null => {
  try {
    const parsed: unknown = JSON.parse(fs.readFileSync(filePath, "utf8"));
    if (typeof parsed !== "object" || parsed === null || !("status" in parsed)) {
      return null;
    }
    return typeof parsed.status === "string" ? parsed.status : null;
  } catch {
    return null;
  }
};

/**
 * The shell writes an `incomplete` placeholder before the download job runs,
 * so waiting for the file to exist would return immediately and move on
 * before the install finished.
 */
const waitForManifest = async (
  modelId: string,
  filePath: string,
): Promise<void> => {
  const deadline = Date.now() + 20 * 60_000;
  let lastStatus = "missing";
  while (Date.now() < deadline) {
    const status = readManifestStatus(filePath);
    if (status !== null) {
      lastStatus = status;
    }
    if (status === "installed") return;
    await new Promise((resolve) => setTimeout(resolve, 1_000));
  }
  throw new Error(
    `E2E_INSTALL_TIMEOUT: ${modelId} manifest stayed '${lastStatus}'`,
  );
};

export const ensureAllModelsInstalled = async (
  page: Page,
  adapter: LayerAdapter,
): Promise<void> => {
  for (const model of MAIN_FLOW_MODELS) {
    const manifestPath = path.join(
      adapter.modelsRoot,
      model.modelId,
      "manifest.json",
    );
    if (readManifestStatus(manifestPath) === "installed") {
      console.log(`[flow] ${model.modelId} already installed`);
      continue;
    }

    console.log(`[flow] install ${model.modelId} (stage ${model.stage})`);
    await selectStageTab(page, model.stage);
    await openStageManager(page);

    const card = page.locator(`[data-model-id="${model.modelId}"]`);
    await expect(card).toBeVisible({ timeout: 60_000 });
    await card
      .getByRole("button", { name: "Install", exact: true })
      .click();
    console.log(`[flow] ${model.modelId} install clicked`);

    await waitForManifest(model.modelId, manifestPath);
    console.log(`[flow] ${model.modelId} manifest installed`);
    await reloadDashboard(page, adapter);
  }
};

export const selectMainFlowModels = async (page: Page): Promise<void> => {
  for (const model of MAIN_FLOW_MODELS) {
    console.log(`[flow] select ${model.modelId} (stage ${model.stage})`);
    await selectStageTab(page, model.stage);
    const select = page.locator(`select:has(option[value="${model.modelId}"])`);
    console.log(
      `[flow] ${model.modelId} select count: ${await select.count()}`,
    );
    // The real shell reboots its runtime after installs and shows the stage
    // model picker only once warmup completes; CPU warmup can take minutes.
    await expect(select).toHaveCount(1, { timeout: 10 * 60_000 });
    await expect(select).toBeEnabled({ timeout: 10 * 60_000 });
    await select.selectOption(model.modelId);
  }

  await page
    .getByLabel("Source Language (Detect/OCR/Translate)", { exact: true })
    .selectOption({ label: "Japanese" });
  await page
    .getByLabel("Translation Language", { exact: true })
    .selectOption({ label: "Portuguese (BR)" });
};
