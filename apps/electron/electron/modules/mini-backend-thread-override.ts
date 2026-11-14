import { randomUUID } from "node:crypto";
import fs from "node:fs";
import path from "node:path";

export interface MiniBackendThreadOverride {
  intraOpThreads: number | null;
  interOpThreads: number | null;
}

export const MINI_BACKEND_THREAD_OVERRIDE_FILENAME =
  "mini-backend-thread-override.json";

const MAX_THREADS = 64;

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

export const sanitizeMiniBackendThreadOverride = (
  value: unknown,
): MiniBackendThreadOverride => {
  if (
    typeof value !== "object" ||
    value === null ||
    Array.isArray(value) ||
    !("intraOpThreads" in value)
  ) {
    return { intraOpThreads: null, interOpThreads: null };
  }
  const interOpThreads =
    "interOpThreads" in value ? sanitizeThreadValue(value.interOpThreads) : null;
  return {
    intraOpThreads: sanitizeThreadValue(value.intraOpThreads),
    interOpThreads,
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
  } catch {
    // Missing or malformed file: the sidecar keeps its defaults.
    return { intraOpThreads: null, interOpThreads: null };
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
  return envVars;
};
