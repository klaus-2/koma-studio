import { createHash } from "node:crypto";
import fs from "node:fs";

import type { DesktopDiskSpaceInfo } from "./types.ts";

const sanitizeModelId = (modelId: string): string => {
  const normalized = modelId.trim().toLowerCase();
  if (!/^[a-z0-9._-]+$/.test(normalized)) {
    throw new Error("Invalid model ID.");
  }
  return normalized;
};

const isValidChecksum = (value: string): boolean => /^[a-fA-F0-9]{64}$/.test(value.trim());

const normalizeChecksum = (value: string): string => value.trim().toLowerCase();

const normalizeLanguageCode = (value: string | undefined): string | undefined => {
  if (typeof value !== "string") {
    return undefined;
  }

  const normalized = value.trim().toLowerCase();
  return normalized || undefined;
};

const assertValidDownloadUrl = (downloadUrl: string): void => {
  if (!/^https?:\/\//i.test(downloadUrl)) {
    throw new Error("Invalid download URL.");
  }
};

const assertValidDownloadChecksum = (checksumSHA256: string): void => {
  if (!isValidChecksum(checksumSHA256)) {
    throw new Error("Invalid SHA256 checksum.");
  }
};

const checksumFile = async (filePath: string): Promise<string> => {
  const hash = createHash("sha256");
  const stream = fs.createReadStream(filePath);
  await new Promise<void>((resolve, reject) => {
    stream.on("data", (chunk: Buffer) => {
      hash.update(chunk);
    });
    stream.once("end", () => resolve());
    stream.once("error", (error) => reject(error));
  });
  return hash.digest("hex");
};

const warnIfInsufficientDiskSpace = (
  diskSpace: DesktopDiskSpaceInfo,
  requiredBytes: number,
): void => {
  if (requiredBytes <= 0) {
    return;
  }

  // Not a gate: the shell only knows the registry's declared size, which is
  // an estimate for multi-asset models, and blocking here refused installs
  // that fitted easily. The backend owns the admission check and the real
  // enforcement is ENOSPC while the bytes are written.
  if (diskSpace.freeBytes < requiredBytes) {
    const requiredGb = (requiredBytes / 1024 ** 3).toFixed(1);
    const freeGb = (diskSpace.freeBytes / 1024 ** 3).toFixed(1);
    console.warn(
      `[models] low disk space for a download: required ${requiredGb} GB, available ${freeGb} GB`,
    );
  }
};

export {
  assertValidDownloadChecksum,
  assertValidDownloadUrl,
  checksumFile,
  isValidChecksum,
  normalizeChecksum,
  normalizeLanguageCode,
  sanitizeModelId,
  warnIfInsufficientDiskSpace,
};
