import path from "node:path";

import { expect, type Page } from "@playwright/test";

import type { LayerAdapter } from "./layer-adapter.ts";
import {
  aioSnapshotCount,
  ensureAutomaticSubMode,
  imageCount,
  loadImages,
  runAio,
} from "./aio.ts";
import { runExportOptions } from "./exports.ts";
import {
  clearAllRegions,
  runManualSmoke,
  runManualTools,
} from "./manual.ts";
import { ensureAllModelsInstalled, selectMainFlowModels } from "./models.ts";
import { runWorkspace, runWorkspaceAutosave } from "./workspace.ts";

export interface MainFlowOptions {
  stopAfter?: string;
}

export interface MainFlowResult {
  install: "ok";
  auto?: "ok";
  batch?: number;
  batchImages?: { name: string; regions: number }[];
  manual?: "ok";
  exports?: number;
  workspace?: "ok";
  skipped?: string[];
}

const fixturePath = (name: string): string =>
  path.join(
    process.env.E2E_REPO_ROOT ?? process.cwd(),
    "apps/tauri/e2e/fixtures/pages",
    name,
  );

export const runMainFlow = async (
  page: Page,
  adapter: LayerAdapter,
  options: MainFlowOptions = {},
): Promise<MainFlowResult> => {
  const stopAfter = options.stopAfter ?? "";

  await ensureAllModelsInstalled(page, adapter);
  await selectMainFlowModels(page);
  if (stopAfter === "install") {
    return { install: "ok" };
  }

  await ensureAutomaticSubMode(page);
  await loadImages(page, [fixturePath("page-1.png")]);
  await expect.poll(() => imageCount(page)).toBe(1);
  await runAio(page);
  if (stopAfter === "auto") {
    return { install: "ok", auto: "ok" };
  }

  await ensureAutomaticSubMode(page);
  await loadImages(page, [fixturePath("page-2.png"), fixturePath("page-3.png")]);
  await expect.poll(() => imageCount(page)).toBe(3);
  await runAio(page);
  await expect.poll(() => imageCount(page)).toBe(3);
  await expect.poll(() => aioSnapshotCount(page)).toBe(6);
  const batchImages = await page.evaluate(
    () => window.__komaE2E?.imageSummaries() ?? [],
  );
  if (stopAfter === "batch") {
    return { install: "ok", auto: "ok", batch: 3, batchImages };
  }

  await (adapter.fullManual ? runManualTools(page) : runManualSmoke(page));
  if (stopAfter === "manual") {
    return { install: "ok", auto: "ok", batch: 3, batchImages, manual: "ok" };
  }

  const skipped: string[] = [];
  let exportCount = 0;
  if (adapter.canExport) {
    const exportResult = await runExportOptions(page);
    exportCount = exportResult.cases;
  } else {
    skipped.push("exports");
  }
  if (stopAfter === "exports") {
    return {
      install: "ok",
      auto: "ok",
      batch: 3,
      batchImages,
      manual: "ok",
      exports: exportCount,
      skipped,
    };
  }

  if (adapter.canImportWorkspace) {
    await runWorkspace(page, adapter);
  } else {
    await runWorkspaceAutosave(page, adapter);
    skipped.push("workspaceRoundTrip");
  }
  if (stopAfter === "workspace") {
    return {
      install: "ok",
      auto: "ok",
      batch: 3,
      batchImages,
      manual: "ok",
      exports: exportCount,
      workspace: "ok",
      skipped,
    };
  }

  await clearAllRegions(page);

  return {
    install: "ok",
    auto: "ok",
    batch: 3,
    batchImages,
    manual: "ok",
    exports: exportCount,
    workspace: "ok",
    skipped,
  };
};
