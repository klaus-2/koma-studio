import fs from "node:fs";
import path from "node:path";

import { expect, type Page } from "@playwright/test";

import type { LayerAdapter } from "./layer-adapter.ts";
import { imageCount } from "./aio.ts";
import { closeManualConfig, dragCanvas, toolButton } from "./manual.ts";
import { pollUntil } from "../support/wait.ts";

const waitForFile = (
  predicate: () => string | null,
  timeoutMs: number,
): Promise<string> => pollUntil(predicate, timeoutMs, "E2E_WORKSPACE_TIMEOUT");

const newestAutosave = (directory: string): string | null => {
  if (!fs.existsSync(directory)) return null;
  const files = fs
    .readdirSync(directory)
    .filter((file) => file.startsWith("autosave."))
    .map((file) => path.join(directory, file))
    .sort((left, right) => fs.statSync(right).mtimeMs - fs.statSync(left).mtimeMs);
  return files[0] ?? null;
};

const newestKoma = (directory: string): string | null => {
  if (!fs.existsSync(directory)) return null;
  const files = fs
    .readdirSync(directory)
    .filter((file) => file.endsWith(".koma"))
    .map((file) => path.join(directory, file))
    .sort((left, right) => fs.statSync(right).mtimeMs - fs.statSync(left).mtimeMs);
  return files[0] ?? null;
};

const openUserMenu = async (page: Page): Promise<void> => {
  await page.locator('[data-tour="topbar-user-trigger"]').click();
  await expect(
    page.getByRole("menuitem", { name: "Export workspace", exact: true }),
  ).toBeVisible();
};

export interface WorkspaceResult {
  autosave: boolean;
  exported: string;
  imported: false;
  reload: false;
}

export const exportWorkspaceFile = async (
  page: Page,
  adapter: LayerAdapter,
): Promise<string> => {
  await openUserMenu(page);
  await page
    .getByRole("menuitem", { name: "Export workspace", exact: true })
    .click();
  return waitForFile(
    () => newestKoma(adapter.workspaceAutosavePath),
    60_000,
  );
};

export const runWorkspace = async (
  page: Page,
  adapter: LayerAdapter,
): Promise<WorkspaceResult> => {
  await page.getByRole("tab", { name: "AIO manual", exact: true }).click();
  await toolButton(page, "Paint brush").click();
  await dragCanvas(page);
  console.log("[flow] workspace paint edit");

  await waitForFile(
    () => newestAutosave(adapter.workspaceAutosavePath),
    120_000,
  );

  console.log("[flow] workspace autosave present");
  await closeManualConfig(page);
  const exported = await exportWorkspaceFile(page, adapter);
  console.log(`[flow] workspace exported ${exported}`);

  return { autosave: true, exported, imported: false, reload: false };
};

export interface WorkspaceAutosaveResult {
  autosave: boolean;
  reload: boolean;
}

export const runWorkspaceAutosave = async (
  page: Page,
  adapter: LayerAdapter,
): Promise<WorkspaceAutosaveResult> => {
  await page.getByRole("tab", { name: "AIO manual", exact: true }).click();
  await toolButton(page, "Paint brush").click();
  await dragCanvas(page);
  console.log("[flow] workspace paint edit");

  await waitForFile(
    () => newestAutosave(adapter.workspaceAutosavePath),
    120_000,
  );
  await adapter.reload(page);
  await expect(
    page.getByRole("tab", { name: "AIO", exact: true }),
  ).toBeVisible({ timeout: 120_000 });
  await expect.poll(() => imageCount(page), { timeout: 120_000 }).toBe(3);

  return { autosave: true, reload: true };
};
