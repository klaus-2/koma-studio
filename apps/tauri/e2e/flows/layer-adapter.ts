import type { Page } from "@playwright/test";

export interface LayerAdapter {
  canExport: boolean;
  canImportWorkspace: boolean;
  canCaptureBlobDownloads: boolean;
  fullManual: boolean;
  workspaceAutosavePath: string;
  modelsRoot: string;
  reload(page: Page): Promise<void>;
}
