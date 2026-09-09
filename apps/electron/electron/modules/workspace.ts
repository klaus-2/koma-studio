/**
 * Workspace management module.
 * Extracted from electron/main.ts during God File decomposition.
 */
import {
  ipcMain,
  app,
  dialog,
  session as electronSession,
  type IpcMainEvent,
  type OpenDialogOptions,
  type SaveDialogOptions,
} from "electron";
import path from "node:path";
import fs from "node:fs";
import { createHash, randomUUID } from "node:crypto";
import {
  WORKSPACE_AUTOSAVE_FILE_BASENAME,
  WORKSPACE_FILE_EXTENSION,
  type WorkspaceAutosaveClearPayload,
  type WorkspaceAutosaveClearResult,
  type WorkspaceAutosaveLoadResult,
  type WorkspaceAutosaveSavePayload,
  type WorkspaceExportPayload,
  type WorkspaceExportResult,
  type WorkspaceImportResult,
  type WorkspacePackagePayload,
} from "../../../../packages/types/src/workspace.ts";
import {
  buildWorkspacePackageZip,
  parseWorkspacePackageZip,
} from "../../../../packages/types/src/workspace-package.ts";
import {
  assertTrustedIpcSender,
} from "./shared.ts";
import {
  clearMiniBackendRuntimeSelection,
  getMiniBackendRuntimeSelectionPath,
} from "../mini-backend-runtime-selection.ts";
import { registerSecureIpcHandler } from "./shared.ts";

// ---------------------------------------------------------------------------
// Helpers
// ---------------------------------------------------------------------------

const ensureWorkspaceStorageDir = (): string => {
  const workspaceDir = path.join(app.getPath("userData"), "workspace");
  fs.mkdirSync(workspaceDir, { recursive: true });
  return workspaceDir;
};

const sanitizeWorkspaceUserId = (value: unknown): string =>
  typeof value === "string" ? value.trim().slice(0, 256) : "";

const getWorkspaceAutosavePath = (userId?: string | null): string => {
  const normalizedUserId = sanitizeWorkspaceUserId(userId) || "guest";
  const hashedUserId = createHash("sha256").update(normalizedUserId).digest("hex");
  return path.join(
    ensureWorkspaceStorageDir(),
    `${WORKSPACE_AUTOSAVE_FILE_BASENAME}.${hashedUserId}.${WORKSPACE_FILE_EXTENSION}`,
  );
};

const writeWorkspacePackageToFile = (
  filePath: string,
  payload: WorkspacePackagePayload,
): void => {
  const zipBytes = buildWorkspacePackageZip(payload);
  const tempPath = `${filePath}.${randomUUID()}.tmp`;
  fs.mkdirSync(path.dirname(filePath), { recursive: true });
  fs.writeFileSync(tempPath, Buffer.from(zipBytes));
  if (fs.existsSync(filePath)) {
    fs.rmSync(filePath, { force: true });
  }
  fs.renameSync(tempPath, filePath);
};

const readWorkspacePackageFromFile = (filePath: string): WorkspacePackagePayload => {
  const rawBuffer = fs.readFileSync(filePath);
  return parseWorkspacePackageZip(new Uint8Array(rawBuffer.buffer, rawBuffer.byteOffset, rawBuffer.byteLength));
};

const resetDesktopLocalSettings = async (): Promise<{
  cleared: true;
  userDataPath: string;
  clearedPaths: string[];
}> => {
  const userDataPath = app.getPath("userData");
  const secureStorePath = path.join(userDataPath, "secure-store");
  const deviceIdPath = path.join(userDataPath, "desktop-device-id.json");
  const runtimeSelectionPath = getMiniBackendRuntimeSelectionPath(userDataPath);
  const clearedPaths: string[] = [];

  try {
    await electronSession.defaultSession.clearStorageData({
      storages: ["cookies", "localstorage", "indexdb", "serviceworkers", "cachestorage"],
    });
  } catch (error) {
    console.warn("[desktop] Failed to clear Chromium storage during local reset", error);
  }

  const removePath = (targetPath: string, _recursive: boolean = false): void => {
    fs.rmSync(targetPath, { force: true, recursive: true });
    clearedPaths.push(targetPath);
  };

  removePath(secureStorePath, true);
  removePath(deviceIdPath);
  clearMiniBackendRuntimeSelection(userDataPath);
  clearedPaths.push(runtimeSelectionPath);

  return {
    cleared: true,
    userDataPath,
    clearedPaths,
  };
};

// ---------------------------------------------------------------------------
// IPC handler setup
// ---------------------------------------------------------------------------

interface WorkspaceDeps {
  getMainWindow: () => import("electron").BrowserWindow | null;
}

const setupDesktopWorkspaceIpcHandlers = (deps: WorkspaceDeps): void => {
  const { getMainWindow } = deps;

  registerSecureIpcHandler<WorkspaceAutosaveLoadResult>(
    "desktop-workspace:load-autosave",
    async (value) => {
      const payload = (value ?? {}) as Record<string, unknown>;
      const filePath = getWorkspaceAutosavePath(sanitizeWorkspaceUserId(payload.userId));
      if (!fs.existsSync(filePath)) {
        return { found: false, path: filePath };
      }

      return {
        found: true,
        path: filePath,
        payload: readWorkspacePackageFromFile(filePath),
      };
    },
  );

  registerSecureIpcHandler<{ saved: true; path: string }>(
    "desktop-workspace:save-autosave",
    async (value) => {
      const payload = (value ?? {}) as WorkspaceAutosaveSavePayload;
      if (!payload.payload) {
        throw new Error("Invalid workspace autosave.");
      }

      const filePath = getWorkspaceAutosavePath(sanitizeWorkspaceUserId(payload.userId));
      writeWorkspacePackageToFile(filePath, payload.payload);
      return { saved: true, path: filePath };
    },
  );

  registerSecureIpcHandler<WorkspaceAutosaveClearResult>(
    "desktop-workspace:clear-autosave",
    async (value) => {
      const payload = (value ?? {}) as WorkspaceAutosaveClearPayload;
      const filePath = getWorkspaceAutosavePath(sanitizeWorkspaceUserId(payload.userId));
      if (fs.existsSync(filePath)) {
        fs.rmSync(filePath, { force: true });
        return { cleared: true };
      }

      return { cleared: false };
    },
  );

  registerSecureIpcHandler<WorkspaceExportResult>(
    "desktop-workspace:export-current",
    async (value) => {
      const payload = (value ?? {}) as WorkspaceExportPayload;
      if (!payload.payload) {
        throw new Error("Invalid workspace export.");
      }

      const ownerWindow = getMainWindow();
      const saveOptions: SaveDialogOptions = {
        title: "Exportar workspace",
        buttonLabel: "Exportar",
        defaultPath: payload.defaultFileName,
        filters: [{
          name: "KOMA Workspace",
          extensions: [WORKSPACE_FILE_EXTENSION],
        }],
      };
      const result = ownerWindow
        ? await dialog.showSaveDialog(ownerWindow, saveOptions)
        : await dialog.showSaveDialog(saveOptions);

      if (result.canceled || !result.filePath) {
        return { cancelled: true, filePath: null };
      }

      let finalPath = result.filePath;
      if (!finalPath.toLowerCase().endsWith(`.${WORKSPACE_FILE_EXTENSION}`)) {
        finalPath = `${finalPath}.${WORKSPACE_FILE_EXTENSION}`;
      }

      writeWorkspacePackageToFile(finalPath, payload.payload);
      return { cancelled: false, filePath: finalPath };
    },
  );

  registerSecureIpcHandler<WorkspaceImportResult>(
    "desktop-workspace:import-file",
    async () => {
      const ownerWindow = getMainWindow();
      const openOptions: OpenDialogOptions = {
        title: "Importar workspace",
        buttonLabel: "Importar",
        filters: [{
          name: "KOMA Workspace",
          extensions: [WORKSPACE_FILE_EXTENSION],
        }],
        properties: ["openFile"],
      };
      const result = ownerWindow
        ? await dialog.showOpenDialog(ownerWindow, openOptions)
        : await dialog.showOpenDialog(openOptions);

      if (result.canceled || result.filePaths.length === 0) {
        return { cancelled: true, filePath: null, payload: null };
      }

      const filePath = result.filePaths[0] || null;
      if (!filePath) {
        return { cancelled: true, filePath: null, payload: null };
      }

      return {
        cancelled: false,
        filePath,
        payload: readWorkspacePackageFromFile(filePath),
      };
    },
  );

  // Fire-and-forget autosave channel for save-on-unmount / save-on-close.
  // Uses ipcMain.on (no reply) so the renderer is not blocked by the response.
  ipcMain.removeAllListeners("desktop-workspace:send-autosave");
  ipcMain.on("desktop-workspace:send-autosave", (event: IpcMainEvent, value: unknown) => {
    try {
      assertTrustedIpcSender(event, "desktop-workspace:send-autosave");
    } catch {
      return;
    }

    const payload = (value ?? {}) as WorkspaceAutosaveSavePayload;
    if (!payload.payload) {
      return;
    }

    try {
      const filePath = getWorkspaceAutosavePath(sanitizeWorkspaceUserId(payload.userId));
      writeWorkspacePackageToFile(filePath, payload.payload);
    } catch (error) {
      console.warn("[desktop] sendAutosave failed:", error instanceof Error ? error.message : error);
    }
  });
};

// ---------------------------------------------------------------------------
// Exports
// ---------------------------------------------------------------------------

export {
  type WorkspaceDeps,
  ensureWorkspaceStorageDir,
  sanitizeWorkspaceUserId,
  getWorkspaceAutosavePath,
  writeWorkspacePackageToFile,
  readWorkspacePackageFromFile,
  resetDesktopLocalSettings,
  setupDesktopWorkspaceIpcHandlers,
};
