import fs from "node:fs";
import os from "node:os";
import path from "node:path";
import process from "node:process";
import { fileURLToPath, pathToFileURL } from "node:url";

const __filename = fileURLToPath(import.meta.url);
const __dirname = path.dirname(__filename);
const rootDir = path.resolve(__dirname, "..");

const isRetryableCleanupError = (error) => {
  const code = error && typeof error === "object" ? error.code : "";
  return code === "EPERM" || code === "EBUSY" || code === "ENOTEMPTY" || code === "EMFILE";
};

export const removeDirIfExists = (
  targetPath,
  {
    fsModule = fs,
    onLog = () => {},
  } = {},
) => {
  if (!targetPath || !fsModule.existsSync(targetPath)) {
    return { removed: false, skipped: false, path: targetPath };
  }

  try {
    fsModule.rmSync(targetPath, {
      recursive: true,
      force: true,
      maxRetries: 3,
      retryDelay: 250,
    });
    onLog("info", `Removed cache directory: ${targetPath}`);
    return { removed: true, skipped: false, path: targetPath };
  } catch (error) {
    if (!isRetryableCleanupError(error)) {
      throw error;
    }

    const reason = error instanceof Error ? error.message : String(error);
    onLog("warn", `Skipping locked cache directory: ${targetPath} (${reason})`);
    return { removed: false, skipped: true, path: targetPath, reason };
  }
};

export const cleanupPyInstallerTempDirs = ({
  fsModule = fs,
  tempDir = os.tmpdir(),
  onLog = () => {},
} = {}) => {
  if (!fsModule.existsSync(tempDir)) {
    return [];
  }

  const results = [];
  for (const entry of fsModule.readdirSync(tempDir, { withFileTypes: true })) {
    if (!entry.isDirectory() || !entry.name.startsWith("_MEI")) {
      continue;
    }

    results.push(
      removeDirIfExists(path.join(tempDir, entry.name), {
        fsModule,
        onLog,
      }),
    );
  }

  return results;
};

export const resolvePipCacheDir = ({ platform = process.platform, homeDir = os.homedir() } = {}) => {
  if (platform === "win32") {
    return path.join(homeDir, "AppData", "Local", "pip", "Cache");
  }

  return path.join(homeDir, ".cache", "pip");
};

export const main = ({
  fsModule = fs,
  onLog = () => {},
} = {}) => {
  const results = [];

  results.push(
    removeDirIfExists(path.join(rootDir, "mini-backend", "build"), {
      fsModule,
      onLog,
    }),
  );
  results.push(
    ...cleanupPyInstallerTempDirs({
      fsModule,
      onLog,
    }),
  );
  results.push(
    removeDirIfExists(resolvePipCacheDir(), {
      fsModule,
      onLog,
    }),
  );

  const removedCount = results.filter((entry) => entry.removed).length;
  const skippedCount = results.filter((entry) => entry.skipped).length;
  onLog(
    "info",
    `[cleanup-build-caches] completed (removed=${removedCount}, skipped=${skippedCount})`,
  );
  onLog("info", "[cleanup-build-caches] .build-cache directory preserved for incremental builds");
  return {
    removedCount,
    skippedCount,
    results,
  };
};

const isDirectExecution = (() => {
  if (!process.argv[1]) {
    return false;
  }

  try {
    return import.meta.url === pathToFileURL(process.argv[1]).href;
  } catch {
    return false;
  }
})();

if (isDirectExecution) {
  main({
    onLog: (_level, message) => console.log(message),
  });
}
