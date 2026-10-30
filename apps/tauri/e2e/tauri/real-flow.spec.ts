import fs from "node:fs";
import path from "node:path";

import { chromium, expect, test } from "@playwright/test";

import type { LayerAdapter } from "../flows/layer-adapter.ts";
import { runMainFlow } from "../flows/main-flow.ts";

const repoRoot = process.env.E2E_REPO_ROOT ?? process.cwd();
const stateModuleUrl = `/@fs/${repoRoot.replace(/\\/g, "/")}/apps/tauri/e2e/entry/e2e-state.ts`;

const installE2eState = async (
  page: import("@playwright/test").Page,
): Promise<void> => {
  await page.evaluate(async (moduleUrl: string) => {
    const stateModule: { installE2eState: () => void } =
      await import(moduleUrl);
    stateModule.installE2eState();
  }, stateModuleUrl);
};

test("real Tauri main flow", async () => {
  const cdpUrl = process.env.E2E_CDP_URL;
  const appDataDir = process.env.E2E_APP_DATA_DIR;
  const runRoot = process.env.E2E_RUN_ROOT;
  if (!cdpUrl || !appDataDir || !runRoot) {
    throw new Error("E2E_CDP_URL, E2E_APP_DATA_DIR and E2E_RUN_ROOT are required");
  }

  const browser = await chromium.connectOverCDP(cdpUrl);
  const pages = browser.contexts().flatMap((context) => context.pages());
  let page: import("@playwright/test").Page | null = null;
  for (const candidate of pages) {
    try {
      await candidate
        .getByRole("tab", { name: "AIO", exact: true })
        .waitFor({ state: "visible", timeout: 180_000 });
      page = candidate;
      break;
    } catch {
      // try the next CDP page
    }
  }
  if (!page) throw new Error("E2E_CDP_NO_APP_PAGE");

  await expect(
    page.getByRole("tab", { name: "AIO", exact: true }),
  ).toBeVisible({ timeout: 180_000 });
  await expect(page.locator(".auth-shell")).toHaveCount(0);

  await page.evaluate(() => {
    localStorage.setItem(
      "koma_theme",
      JSON.stringify({ state: { theme: "dark", family: "noir" }, version: 2 }),
    );
    localStorage.setItem("koma-studio.locale.v1", "en");
    localStorage.setItem(
      "koma-aio-gpu-stages",
      JSON.stringify({
        detectText: false,
        recognizeText: false,
        segmentText: false,
        cleanImage: false,
      }),
    );
  });

  const reload = async (
    target: import("@playwright/test").Page,
  ): Promise<void> => {
    await target.reload({
      waitUntil: "domcontentloaded",
      timeout: 120_000,
    });
    await expect(
      target.getByRole("tab", { name: "AIO", exact: true }),
    ).toBeVisible({ timeout: 180_000 });
    await installE2eState(target);
  };

  await reload(page);

  const adapter: LayerAdapter = {
    canExport: false,
    canImportWorkspace: false,
    canCaptureBlobDownloads: false,
    fullManual: false,
    workspaceAutosavePath: path.join(appDataDir, "workspace"),
    modelsRoot: path.join(appDataDir, "models"),
    reload,
  };

  const result = await runMainFlow(page, adapter, {
    stopAfter: process.env.E2E_STOP_AFTER ?? "",
  });

  const reportDirectory = path.join(runRoot, "report");
  fs.mkdirSync(reportDirectory, { recursive: true });
  fs.writeFileSync(
    path.join(reportDirectory, "tauri-summary.json"),
    JSON.stringify(result, null, 2),
    "utf8",
  );
});
