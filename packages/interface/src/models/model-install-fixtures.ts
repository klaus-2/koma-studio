import type {
  ModelInstallLifecycleStatus,
  ModelInstallState,
  ModelProgress,
  TranslationModel,
} from "./types";

export const createMockModel = (id: string): TranslationModel => ({
  id,
  name: id,
  description: "mock",
  version: "1.0.0",
  stage: "translation",
  sourceLanguages: ["ja"],
  targetLanguages: ["en"],
  requirements: {
    gpu: false,
    vramMin: "0",
    ramMin: "4GB",
    diskSpace: "100MB",
  },
  speed: "fast",
  downloadUrl: "https://example.com/mock.bin",
  checksumSHA256: "54e50d7b19c16883541a0f42f2f2be3617c6597457d8a29f86dc6f5d130f8f2d",
  fileSize: "100MB",
});

export const buildInstallState = (
  model: TranslationModel,
  status: ModelInstallLifecycleStatus,
  overrides: Partial<ModelInstallState> = {},
): ModelInstallState => ({
  model,
  status,
  installedVersion: null,
  availableVersion: model.version,
  installedAt: null,
  checksumSHA256: null,
  updateAvailable: status === "update_available",
  error: null,
  errorCode: null,
  progress: null,
  incomplete: status === "incomplete",
  ...overrides,
});

export const buildDownloadingProgress = (modelId: string): ModelProgress => ({
  modelId,
  bytesDownloaded: 256,
  totalBytes: 1024,
  speedBytesPerSecond: 64,
  percent: 25,
  attempt: 1,
});

export const buildInstalledRecord = (model: TranslationModel): {
  modelId: string;
  version: string;
  installedAt: string;
  checksumSHA256: string;
  status: "installed";
  modelDir: string;
  manifestPath: string;
  sizeBytes: number;
} => ({
  modelId: model.id,
  version: model.version,
  installedAt: "2026-11-03T00:00:00.000Z",
  checksumSHA256: model.checksumSHA256,
  status: "installed",
  modelDir: "mock",
  manifestPath: "mock/manifest.json",
  sizeBytes: 1024,
});
