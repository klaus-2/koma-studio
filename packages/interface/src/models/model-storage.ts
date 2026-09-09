import type {
  DesktopDownloadModelPayload,
  DiskSpaceInfo,
  InstalledModelRecord,
  ModelInstallState,
  RemoteModelUpdateCheckResult,
  TranslationModel,
} from "./types";
import { checkModelVersions } from "./model-version-checker";

import { desktopBridge } from "@/lib/desktop-bridge";
const SIZE_UNITS: Record<string, number> = {
  b: 1,
  kb: 1024,
  mb: 1024 ** 2,
  gb: 1024 ** 3,
  tb: 1024 ** 4,
};

const EASYOCR_MODEL_ID = "easyocr";
const normalizeLanguageCode = (value: string): string => value.trim().toLowerCase();

export const parseHumanSizeToBytes = (rawValue: string): number => {
  const normalized = rawValue
    .replace(/~/g, "")
    .replace(/\s+/g, "")
    .toLowerCase();
  const match = normalized.match(/([\d.]+)(b|kb|mb|gb|tb)/i);
  if (!match) {
    return 0;
  }

  const value = Number.parseFloat(match[1] ?? "0");
  const unit = (match[2] ?? "b").toLowerCase();
  if (!Number.isFinite(value)) {
    return 0;
  }

  const multiplier = SIZE_UNITS[unit] ?? 1;
  return Math.max(0, Math.round(value * multiplier));
};

export const formatBytes = (value: number): string => {
  if (!Number.isFinite(value) || value <= 0) {
    return "0 B";
  }

  const units = ["B", "KB", "MB", "GB", "TB"];
  let currentValue = value;
  let unitIndex = 0;
  while (currentValue >= 1024 && unitIndex < units.length - 1) {
    currentValue /= 1024;
    unitIndex += 1;
  }

  const decimals = currentValue >= 10 ? 0 : 1;
  return `${currentValue.toFixed(decimals)} ${units[unitIndex]}`;
};

export const estimateModelDownloadBytes = (model: TranslationModel): number =>
  parseHumanSizeToBytes(model.fileSize);

export const estimateModelRequiredDiskBytes = (model: TranslationModel): number => {
  const fileBytes = parseHumanSizeToBytes(model.fileSize);
  const diskBytes = parseHumanSizeToBytes(model.requirements.diskSpace);
  return Math.max(fileBytes, diskBytes);
};

interface ToDesktopDownloadPayloadOptions {
  sourceLanguage?: string;
}

export const toDesktopDownloadPayload = (
  model: TranslationModel,
  options?: ToDesktopDownloadPayloadOptions,
): DesktopDownloadModelPayload => ({
  id: model.id,
  name: model.name,
  version: model.version,
  downloadUrl: model.downloadUrl,
  checksumSHA256: model.checksumSHA256,
  expectedDownloadBytes: estimateModelDownloadBytes(model),
  requiredDiskBytes: estimateModelRequiredDiskBytes(model),
  sourceLanguage: options?.sourceLanguage?.trim().toLowerCase() || undefined,
  installStrategy: model.installStrategy,
  runtimeFamily: model.runtimeFamily,
  backendInstallEndpoint: model.backendInstallEndpoint,
});

const listInstalledFromDesktopBridge = async (): Promise<InstalledModelRecord[]> => {
  const desktopModelsApi = desktopBridge.desktop?.models;
  if (!desktopModelsApi) {
    return [];
  }

  return desktopModelsApi.listInstalled();
};

export const listInstalledModels = async (): Promise<InstalledModelRecord[]> => {
  try {
    return await listInstalledFromDesktopBridge();
  } catch {
    return [];
  }
};

export const getDiskSpace = async (): Promise<DiskSpaceInfo | null> => {
  const desktopModelsApi = desktopBridge.desktop?.models;
  if (!desktopModelsApi) {
    return null;
  }

  try {
    return await desktopModelsApi.getDiskSpace();
  } catch {
    return null;
  }
};

export const checkInstalledModelsAgainstSource = async (
  models: TranslationModel[],
): Promise<RemoteModelUpdateCheckResult[]> => {
  const desktopModelsApi = desktopBridge.desktop?.models;
  if (!desktopModelsApi) {
    return [];
  }

  const payloads = models.map((model) => toDesktopDownloadPayload(model));
  return desktopModelsApi.checkUpdates(payloads) as Promise<RemoteModelUpdateCheckResult[]>;
};

export const uninstallModelFromStorage = async (modelId: string): Promise<void> => {
  const desktopModelsApi = desktopBridge.desktop?.models;
  if (!desktopModelsApi) {
    throw new Error("Model management is available only in the desktop app.");
  }

  await desktopModelsApi.uninstall(modelId);
};

export const importOnnxModelFromStorage = async (model: TranslationModel): Promise<InstalledModelRecord> => {
  const desktopModelsApi = desktopBridge.desktop?.models;
  if (!desktopModelsApi) {
    throw new Error("ONNX import is available only in the desktop app.");
  }

  return desktopModelsApi.importOnnx({
    id: model.id,
    name: model.name,
    version: model.version,
  }) as Promise<InstalledModelRecord>;
};

export const cancelModelDownload = async (modelId: string): Promise<void> => {
  const desktopModelsApi = desktopBridge.desktop?.models;
  if (!desktopModelsApi) {
    return;
  }

  await desktopModelsApi.cancel(modelId);
};

export const cancelAllModelDownloads = async (): Promise<void> => {
  const desktopModelsApi = desktopBridge.desktop?.models;
  if (!desktopModelsApi) {
    return;
  }

  await desktopModelsApi.cancelAll();
};

export const buildModelInstallStates = (
  models: TranslationModel[],
  installedModels: InstalledModelRecord[],
  sourceLanguage?: string,
): Record<string, ModelInstallState> => {
  const installedById = new Map(installedModels.map((item) => [item.modelId, item]));
  const versionCheck = checkModelVersions(installedModels, models);
  const versionByModel = new Map(versionCheck.map((item) => [item.modelId, item]));

  const state: Record<string, ModelInstallState> = {};

  models.forEach((model) => {
    const installed = installedById.get(model.id);
    const versionMeta = versionByModel.get(model.id);
    const normalizedSourceLanguage = sourceLanguage ? normalizeLanguageCode(sourceLanguage) : "";
    const easyocrLanguageInstalled =
      model.id !== EASYOCR_MODEL_ID ||
      !normalizedSourceLanguage ||
      (installed?.installedLanguages ?? []).map(normalizeLanguageCode).includes(normalizedSourceLanguage);
    const incomplete =
      installed?.status === "incomplete" ||
      Boolean(installed?.status === "installed" && model.id === EASYOCR_MODEL_ID && !easyocrLanguageInstalled);

    let status: ModelInstallState["status"] = "not_installed";

    if (installed?.status === "installed" && versionMeta?.updateAvailable) {
      status = "update_available";
    } else if (installed?.status === "installed" && easyocrLanguageInstalled) {
      status = "installed";
    } else if (incomplete) {
      status = "incomplete";
    }

    state[model.id] = {
      model,
      status,
      errorCode: null,
      installedVersion: installed?.version ?? null,
      availableVersion: model.version,
      installedAt: installed?.installedAt ?? null,
      checksumSHA256: installed?.checksumSHA256 ?? null,
      updateAvailable: Boolean(versionMeta?.updateAvailable),
      error: null,
      progress: null,
      incomplete,
    };
  });

  return state;
};

export const summarizeInstalledModels = (state: Record<string, ModelInstallState>): {
  installedCount: number;
  totalCount: number;
  updateCount: number;
} => {
  const values = Object.values(state);
  const installedCount = values.filter((entry) => entry.status === "installed" || entry.status === "update_available").length;
  const updateCount = values.filter((entry) => entry.status === "update_available").length;

  return {
    installedCount,
    totalCount: values.length,
    updateCount,
  };
};

export const computeInstalledSizeBytes = (
  installedModels: InstalledModelRecord[],
): number => installedModels.reduce((acc, item) => acc + Math.max(0, item.sizeBytes || 0), 0);
