/**
 * Model manager IPC module.
 * Extracted from electron/main.ts during God File decomposition.
 */
import { app, dialog } from "electron";
import { DesktopModelManagerService } from "../model-manager.ts";
import { registerSecureIpcHandler } from "./shared.ts";

// ---------------------------------------------------------------------------
// Model manager service factory
// ---------------------------------------------------------------------------

interface ModelsDeps {
  getMainWindow: () => import("electron").BrowserWindow | null;
  getLocalApiUrl: () => string;
  getLocalApiSessionSecret: () => string;
}

let desktopModelManagerService: DesktopModelManagerService | null = null;

const getDesktopModelManagerService = (deps: ModelsDeps): DesktopModelManagerService => {
  if (!desktopModelManagerService) {
    desktopModelManagerService = new DesktopModelManagerService(
      () => app.getPath("userData"),
      deps.getMainWindow,
      deps.getLocalApiUrl,
      deps.getLocalApiSessionSecret,
    );
  }

  return desktopModelManagerService;
};

// ---------------------------------------------------------------------------
// IPC handler setup
// ---------------------------------------------------------------------------

const setupDesktopModelIpcHandlers = (deps: ModelsDeps): void => {
  registerSecureIpcHandler("desktop-models:list-installed", async () => {
    const manager = getDesktopModelManagerService(deps);
    return manager.listInstalledModels();
  });

  registerSecureIpcHandler("desktop-models:get-disk-space", async () => {
    const manager = getDesktopModelManagerService(deps);
    return manager.getDiskSpaceInfo();
  });

  registerSecureIpcHandler("desktop-models:check-updates", async (value) => {
    const payload = (value ?? {}) as Record<string, unknown>;
    const rawPayloads = Array.isArray(payload.payloads) ? payload.payloads : [];
    const models = rawPayloads
      .filter((entry): entry is Record<string, unknown> => Boolean(entry) && typeof entry === "object" && !Array.isArray(entry))
      .map((entry) => ({
        id: typeof entry.id === "string" ? entry.id.trim() : "",
        name: typeof entry.name === "string" ? entry.name.trim() : "",
        version: typeof entry.version === "string" ? entry.version.trim() : "0.0.0",
        downloadUrl: typeof entry.downloadUrl === "string" ? entry.downloadUrl.trim() : "",
        checksumSHA256: typeof entry.checksumSHA256 === "string" ? entry.checksumSHA256.trim() : "",
        expectedDownloadBytes: Number(entry.expectedDownloadBytes ?? 0),
        requiredDiskBytes: Number(entry.requiredDiskBytes ?? 0),
        sourceLanguage: typeof entry.sourceLanguage === "string" ? entry.sourceLanguage.trim().toLowerCase() : undefined,
        installStrategy: entry.installStrategy === "manual_import"
          ? "manual_import" as const
          : entry.installStrategy === "backend_managed"
            ? "backend_managed" as const
            : "direct_download" as const,
        runtimeFamily: typeof entry.runtimeFamily === "string" ? entry.runtimeFamily as never : undefined,
        backendInstallEndpoint: typeof entry.backendInstallEndpoint === "string" ? entry.backendInstallEndpoint : undefined,
      }))
      .filter((entry) => entry.id && entry.downloadUrl);

    const manager = getDesktopModelManagerService(deps);
    return manager.checkRemoteUpdates(models);
  });

  registerSecureIpcHandler("desktop-models:download", async (value) => {
    const payload = (value ?? {}) as Record<string, unknown>;
    const id = typeof payload.id === "string" ? payload.id.trim() : "";
    const name = typeof payload.name === "string" ? payload.name.trim() : "";
    const version = typeof payload.version === "string" ? payload.version.trim() : "";
    const downloadUrl = typeof payload.downloadUrl === "string" ? payload.downloadUrl.trim() : "";
    const checksumSHA256 =
      typeof payload.checksumSHA256 === "string" ? payload.checksumSHA256.trim() : "";
    const expectedDownloadBytes = Number(payload.expectedDownloadBytes ?? 0);
    const requiredDiskBytes = Number(payload.requiredDiskBytes ?? 0);
    const sourceLanguage =
      typeof payload.sourceLanguage === "string" ? payload.sourceLanguage.trim().toLowerCase() : "";
    const installStrategy =
      payload.installStrategy === "manual_import"
        ? "manual_import"
        : payload.installStrategy === "backend_managed"
          ? "backend_managed"
          : "direct_download";
    const runtimeFamily = typeof payload.runtimeFamily === "string" ? payload.runtimeFamily as never : undefined;
    const backendInstallEndpoint =
      typeof payload.backendInstallEndpoint === "string" ? payload.backendInstallEndpoint.trim() : undefined;

    if (!id || !name || !version || !downloadUrl || !checksumSHA256) {
      throw new Error("Invalid model download payload.");
    }

    const manager = getDesktopModelManagerService(deps);
    return manager.enqueueDownload({
      id,
      name,
      version,
      downloadUrl,
      checksumSHA256,
      expectedDownloadBytes: Number.isFinite(expectedDownloadBytes) ? expectedDownloadBytes : 0,
      requiredDiskBytes: Number.isFinite(requiredDiskBytes) ? requiredDiskBytes : 0,
      sourceLanguage: sourceLanguage || undefined,
      installStrategy,
      runtimeFamily,
      backendInstallEndpoint,
    });
  });

  registerSecureIpcHandler("desktop-models:import-onnx", async (value) => {
    const payload = (value ?? {}) as Record<string, unknown>;
    const id = typeof payload.id === "string" ? payload.id.trim() : "";
    const name = typeof payload.name === "string" ? payload.name.trim() : "";
    const version = typeof payload.version === "string" ? payload.version.trim() : "";
    if (!id || !name || !version) {
      throw new Error("Invalid ONNX import payload.");
    }

    const result = await dialog.showOpenDialog(deps.getMainWindow() as any, {
      title: "Import ONNX model",
      buttonLabel: "Importar",
      filters: [{ name: "ONNX", extensions: ["onnx"] }],
      properties: ["openFile"],
    });
    if (result.canceled || result.filePaths.length === 0) {
      throw new Error("ONNX import canceled.");
    }

    const manager = getDesktopModelManagerService(deps);
    return manager.importOnnxModel({ id, name, version }, result.filePaths[0] || "");
  });

  registerSecureIpcHandler<void>("desktop-models:cancel", async (value) => {
    const payload = (value ?? {}) as Record<string, unknown>;
    const modelId = typeof payload.modelId === "string" ? payload.modelId : "";
    if (!modelId) {
      throw new Error("Model ID ausente para cancelamento.");
    }

    const manager = getDesktopModelManagerService(deps);
    manager.cancelDownload(modelId);
  });

  registerSecureIpcHandler<void>("desktop-models:cancel-all", async () => {
    const manager = getDesktopModelManagerService(deps);
    manager.cancelAllDownloads();
  });

  registerSecureIpcHandler<void>("desktop-models:uninstall", async (value) => {
    const payload = (value ?? {}) as Record<string, unknown>;
    const modelId = typeof payload.modelId === "string" ? payload.modelId : "";
    if (!modelId) {
      throw new Error("Model ID missing for uninstall.");
    }

    const manager = getDesktopModelManagerService(deps);
    manager.uninstallModel(modelId);
  });
};

// ---------------------------------------------------------------------------
// Exports
// ---------------------------------------------------------------------------

export {
  type ModelsDeps,
  getDesktopModelManagerService,
  setupDesktopModelIpcHandlers,
};
