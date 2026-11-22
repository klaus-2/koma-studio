import fs from "node:fs";
import path from "node:path";
import { Menu, Tray, app, nativeImage } from "electron";
import {
  BATCH_TRAY_ACTION_EVENT_CHANNEL,
  formatBatchTrayPauseLabel,
  formatBatchTrayTooltip,
  getBatchShellState,
  registerMainWindowCloseGuard,
  resolveBatchTrayAction,
  subscribeToBatchShellState,
  type BatchShellState,
  type BatchTrayAction,
  type CloseGuardWindow,
} from "./batch-state.ts";

interface BatchTrayTargetWindow {
  isDestroyed(): boolean;
  isMinimized(): boolean;
  restore(): void;
  focus(): void;
  webContents: { send(channel: string, payload: unknown): void };
}

export interface BatchTrayDeps {
  getMainWindow: () => BatchTrayTargetWindow | null;
}

const BATCH_TRAY_ICON_RELATIVE_PATH = path.join("resources", "windows", "32x32.png");

const batchTrayIconPathCandidates = (): string[] =>
  [
    path.resolve(process.cwd(), BATCH_TRAY_ICON_RELATIVE_PATH),
    typeof process.resourcesPath === "string" && process.resourcesPath.length > 0
      ? path.resolve(process.resourcesPath, BATCH_TRAY_ICON_RELATIVE_PATH)
      : null,
  ].filter((value): value is string => Boolean(value));

const resolveBatchTrayIconPath = (): string | null => {
  for (const candidate of batchTrayIconPathCandidates()) {
    if (fs.existsSync(candidate)) {
      return candidate;
    }
  }
  return null;
};

const showMainWindow = (deps: BatchTrayDeps): void => {
  const window = deps.getMainWindow();
  if (!window || window.isDestroyed()) {
    return;
  }
  if (window.isMinimized()) {
    window.restore();
  }
  window.focus();
};

const sendBatchTrayAction = (deps: BatchTrayDeps, action: BatchTrayAction): void => {
  const window = deps.getMainWindow();
  if (!window || window.isDestroyed()) {
    return;
  }
  window.webContents.send(BATCH_TRAY_ACTION_EVENT_CHANNEL, { action });
};

const buildBatchTrayMenu = (deps: BatchTrayDeps, state: BatchShellState): Menu =>
  Menu.buildFromTemplate([
    {
      label: "Show window",
      click: () => {
        showMainWindow(deps);
      },
    },
    {
      label: formatBatchTrayPauseLabel(state),
      click: () => {
        sendBatchTrayAction(deps, resolveBatchTrayAction(state));
      },
    },
    { type: "separator" },
    {
      label: "Quit",
      click: () => {
        app.quit();
      },
    },
  ]);

let batchTray: Tray | null = null;

const disposeDestroyedBatchTray = (): void => {
  if (batchTray !== null && batchTray.isDestroyed()) {
    batchTray = null;
  }
};

const createBatchTray = (deps: BatchTrayDeps, state: BatchShellState): Tray | null => {
  const iconPath = resolveBatchTrayIconPath();
  if (!iconPath) {
    console.warn("[batch-tray] tray icon file not found:", BATCH_TRAY_ICON_RELATIVE_PATH);
    return null;
  }
  const icon = nativeImage.createFromPath(iconPath);
  if (icon.isEmpty()) {
    console.warn("[batch-tray] tray icon could not be decoded:", iconPath);
    return null;
  }
  const tray = new Tray(icon);
  tray.setToolTip(formatBatchTrayTooltip(state));
  tray.setContextMenu(buildBatchTrayMenu(deps, state));
  return tray;
};

const syncBatchTrayWithState = (deps: BatchTrayDeps, state: BatchShellState): void => {
  disposeDestroyedBatchTray();
  if (batchTray === null) {
    if (state.phase !== "running") {
      return;
    }
    batchTray = createBatchTray(deps, state);
    return;
  }
  batchTray.setToolTip(formatBatchTrayTooltip(state));
  batchTray.setContextMenu(buildBatchTrayMenu(deps, state));
};

export const registerBatchTrayStateSync = (deps: BatchTrayDeps): void => {
  subscribeToBatchShellState((state) => {
    syncBatchTrayWithState(deps, state);
  });
  syncBatchTrayWithState(deps, getBatchShellState());
};

export const destroyBatchTray = (): void => {
  disposeDestroyedBatchTray();
  if (batchTray !== null) {
    batchTray.destroy();
    batchTray = null;
  }
};

export const registerBatchIntegrations = (
  window: CloseGuardWindow & BatchTrayTargetWindow,
  deps: { isAppExiting(): boolean },
): void => {
  registerMainWindowCloseGuard(window, { isAppExiting: deps.isAppExiting });
  registerBatchTrayStateSync({ getMainWindow: () => window });
  app.on("window-all-closed", () => {
    destroyBatchTray();
  });
};
