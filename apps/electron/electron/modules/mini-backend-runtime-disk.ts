/**
 * Runtime install disk-space checks + retryable download error detection.
 */
import fs from "node:fs";
import {
  resolveExistingPathForStatfs,
} from "../mini-backend-runtime-download.ts";
import { formatRuntimeBytes } from "./mini-backend-runtime-store.ts";

const RUNTIME_RETRYABLE_HTTP_STATUSES = new Set([408, 429, 500, 502, 503, 504]);

const getAvailableDiskBytes = (targetPath: string): number => {
  const statfsPath = resolveExistingPathForStatfs(targetPath);
  if (!statfsPath) {
    return 0;
  }
  try {
    const stats = fs.statfsSync(statfsPath);
    const statsWithOptionalFrsize = stats as typeof stats & { frsize?: number };
    const blockSize = Number(stats.bsize || statsWithOptionalFrsize.frsize || 0);
    const availableBlocks = Number(stats.bavail ?? stats.blocks ?? 0);
    if (!Number.isFinite(blockSize) || !Number.isFinite(availableBlocks)) {
      return 0;
    }
    return Math.max(0, Math.trunc(blockSize * availableBlocks));
  } catch {
    return 0;
  }
};

const ensureMiniBackendRuntimeDiskSpace = (
  targetPaths: string[],
  requiredBytes: number,
): void => {
  for (const targetPath of targetPaths) {
    const availableBytes = getAvailableDiskBytes(targetPath);
    if (availableBytes > 0 && availableBytes < requiredBytes) {
      throw new Error(
        `Insufficient disk space for runtime artifact. Need ${formatRuntimeBytes(requiredBytes)} free, found ${formatRuntimeBytes(availableBytes)}.`,
      );
    }
  }
};

const isRetryableRuntimeDownloadError = (error: unknown): boolean => {
  if (!(error instanceof Error)) {
    return false;
  }

  const message = error.message.trim();
  if (!message) {
    return true;
  }

  if (error.name === "AbortError" || error.name === "TimeoutError") {
    return true;
  }

  const httpMatch = message.match(/HTTP\s+(\d{3})/i);
  if (httpMatch) {
    return RUNTIME_RETRYABLE_HTTP_STATUSES.has(Number(httpMatch[1]));
  }

  return /fetch failed|network|socket|timed out|timeout|temporar/i.test(message);
};

export {
  ensureMiniBackendRuntimeDiskSpace,
  getAvailableDiskBytes,
  isRetryableRuntimeDownloadError,
};
