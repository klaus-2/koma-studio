import { randomUUID } from "node:crypto";
import fs from "node:fs";
import path from "node:path";

export interface MiniBackendThreadOverride {
  intraOpThreads: number | null;
  interOpThreads: number | null;
  engineIdleTimeoutSeconds: number | null;
  workingResolutionMegapixels: number | null;
  workingResolutionOcrClean: boolean | null;
}

export const MINI_BACKEND_THREAD_OVERRIDE_FILENAME =
  "mini-backend-thread-override.json";

const MAX_THREADS = 64;
const MAX_ENGINE_IDLE_TIMEOUT_SECONDS = 86400;
const WORKING_RESOLUTION_MIN_MEGAPIXELS = 4;
const WORKING_RESOLUTION_MAX_MEGAPIXELS = 64;

export const getMiniBackendThreadOverridePath = (userDataPath: string): string =>
  path.join(userDataPath, MINI_BACKEND_THREAD_OVERRIDE_FILENAME);

const sanitizeThreadValue = (value: unknown): number | null => {
  if (typeof value !== "number" || !Number.isFinite(value)) {
    return null;
  }
  const rounded = Math.round(value);
  if (rounded < 1) {
    return null;
  }
  return Math.min(MAX_THREADS, rounded);
};

const sanitizeSecondsValue = (value: unknown): number | null => {
  if (typeof value !== "number" || !Number.isFinite(value)) {
    return null;
  }
  return Math.min(
    MAX_ENGINE_IDLE_TIMEOUT_SECONDS,
    Math.max(0, Math.round(value)),
  );
};

const sanitizeMegapixelsValue = (value: unknown): number | null => {
  if (typeof value !== "number" || !Number.isFinite(value)) {
    return null;
  }
  return Math.min(
    WORKING_RESOLUTION_MAX_MEGAPIXELS,
    Math.max(WORKING_RESOLUTION_MIN_MEGAPIXELS, value),
  );
};

const sanitizeFlagValue = (value: unknown): boolean | null =>
  typeof value === "boolean" ? value : null;

export const sanitizeMiniBackendThreadOverride = (
  value: unknown,
): MiniBackendThreadOverride => {
  if (
    typeof value !== "object" ||
    value === null ||
    Array.isArray(value)
  ) {
    return {
      intraOpThreads: null,
      interOpThreads: null,
      engineIdleTimeoutSeconds: null,
      workingResolutionMegapixels: null,
      workingResolutionOcrClean: null,
    };
  }
  const intraOpThreads =
    "intraOpThreads" in value ? sanitizeThreadValue(value.intraOpThreads) : null;
  const interOpThreads =
    "interOpThreads" in value ? sanitizeThreadValue(value.interOpThreads) : null;
  const engineIdleTimeoutSeconds =
    "engineIdleTimeoutSeconds" in value
      ? sanitizeSecondsValue(value.engineIdleTimeoutSeconds)
      : null;
  const workingResolutionMegapixels =
    "workingResolutionMegapixels" in value
      ? sanitizeMegapixelsValue(value.workingResolutionMegapixels)
      : null;
  const workingResolutionOcrClean =
    "workingResolutionOcrClean" in value
      ? sanitizeFlagValue(value.workingResolutionOcrClean)
      : null;
  return {
    intraOpThreads,
    interOpThreads,
    engineIdleTimeoutSeconds,
    workingResolutionMegapixels,
    workingResolutionOcrClean,
  };
};

export const readMiniBackendThreadOverride = (
  userDataPath: string,
): MiniBackendThreadOverride => {
  const filePath = getMiniBackendThreadOverridePath(userDataPath);
  try {
    return sanitizeMiniBackendThreadOverride(
      JSON.parse(fs.readFileSync(filePath, "utf-8")),
    );
  } catch (error) {
    if (
      error instanceof Error
      && "code" in error
      && typeof error.code === "string"
      && error.code === "ENOENT"
    ) {
      // Missing file: the sidecar keeps its defaults.
      return {
        intraOpThreads: null,
        interOpThreads: null,
        engineIdleTimeoutSeconds: null,
        workingResolutionMegapixels: null,
        workingResolutionOcrClean: null,
      };
    }
    if (error instanceof SyntaxError) {
      console.warn(
        "[mini-backend] Failed to parse the thread override file:",
        error,
      );
    } else {
      console.warn(
        "[mini-backend] Failed to read the thread override file:",
        error,
      );
    }
    return {
      intraOpThreads: null,
      interOpThreads: null,
      engineIdleTimeoutSeconds: null,
      workingResolutionMegapixels: null,
      workingResolutionOcrClean: null,
    };
  }
};

export const writeMiniBackendThreadOverride = (
  userDataPath: string,
  payload: unknown,
): MiniBackendThreadOverride => {
  const override = sanitizeMiniBackendThreadOverride(payload);
  const filePath = getMiniBackendThreadOverridePath(userDataPath);
  const tempPath = `${filePath}.${randomUUID()}.tmp`;
  fs.mkdirSync(path.dirname(filePath), { recursive: true });
  fs.writeFileSync(tempPath, JSON.stringify(override));
  if (fs.existsSync(filePath)) {
    fs.rmSync(filePath, { force: true });
  }
  fs.renameSync(tempPath, filePath);
  return override;
};

export const clearMiniBackendThreadOverride = (userDataPath: string): void => {
  fs.rmSync(getMiniBackendThreadOverridePath(userDataPath), { force: true });
};

/** Pure mapping: override → the spawn-env variables the sidecar reads. */
export const miniBackendThreadEnvVars = (
  override: MiniBackendThreadOverride,
): Record<string, string> => {
  const envVars: Record<string, string> = {};
  if (override.intraOpThreads !== null) {
    envVars.MINI_BACKEND_INTRA_OP_THREADS = String(override.intraOpThreads);
    // OpenMP reads OMP_NUM_THREADS once at process start: the shell mirrors
    // the intra-op value so native runtimes pick the same limit up.
    envVars.OMP_NUM_THREADS = String(override.intraOpThreads);
  }
  if (override.interOpThreads !== null) {
    envVars.MINI_BACKEND_INTER_OP_THREADS = String(override.interOpThreads);
  }
  if (override.engineIdleTimeoutSeconds !== null) {
    envVars.MINI_BACKEND_ENGINE_IDLE_TIMEOUT_SECONDS = String(
      override.engineIdleTimeoutSeconds,
    );
  }
  if (override.workingResolutionMegapixels !== null) {
    envVars.MINI_BACKEND_WORKING_RESOLUTION_MEGAPIXELS = String(
      override.workingResolutionMegapixels,
    );
  }
  if (override.workingResolutionOcrClean !== null) {
    envVars.MINI_BACKEND_WORKING_RESOLUTION_OCR_CLEAN =
      override.workingResolutionOcrClean ? "1" : "0";
  }
  return envVars;
};
