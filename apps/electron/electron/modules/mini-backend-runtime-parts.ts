/**
 * Multi-part runtime download planning and execution. Pure module: no
 * electron imports so it stays unit-testable under node --test.
 *
 * Semantics (mirrored by the Tauri Rust side):
 * - each part is downloaded with Range-resume and sha512-verified immediately
 *   on completion; a verified part file is its own cross-restart ledger, so
 *   completed parts are skipped and failed attempts keep partial files;
 * - part URLs are the absolute tag-pinned URLs from the manifest, never
 *   re-derived from a moving "latest" pointer;
 * - part files are deleted by the caller only after the whole install
 *   succeeds.
 */
import fs from "node:fs";
import path from "node:path";
import {
  isSafeManifestPathSegment,
  type MiniBackendRuntimeArtifactManifest,
  type MiniBackendRuntimeArtifactPart,
  type MiniBackendRuntimeArtifactRecord,
} from "../mini-backend-artifacts.ts";
import {
  downloadUrlToFileWithResume,
  resolveRuntimeTransferTimeoutMs,
  runWithRetry,
  RUNTIME_DOWNLOAD_RETRY_COUNT,
  type RuntimeDownloadProgress,
} from "../mini-backend-runtime-download.ts";

export interface RuntimePartDownloadItem {
  part: MiniBackendRuntimeArtifactPart;
  outputPath: string;
}

export type RuntimePartsEvent =
  | { type: "download-start"; file: string; attempt: number; maxAttempts: number; resuming: boolean }
  | { type: "download-retry"; file: string; attempt: number; maxAttempts: number; delayMs: number; error: unknown }
  | { type: "download-progress"; file: string; progress: RuntimeDownloadProgress }
  | { type: "verifying-part"; file: string }
  | { type: "part-verified"; file: string; bytes: number };

const isRuntimeManifestForCurrentPlatform = (
  manifest: MiniBackendRuntimeArtifactManifest,
  { platform, arch }: { platform: NodeJS.Platform; arch: string },
): boolean => manifest.platform === platform && manifest.arch === arch;

const computeRuntimePartsTotalBytes = (record: MiniBackendRuntimeArtifactRecord): number =>
  record.parts.reduce((total, part) => total + part.size, 0);

const resolveExistingRuntimePartBytes = (items: RuntimePartDownloadItem[]): number =>
  items.reduce((total, item) => {
    if (!fs.existsSync(item.outputPath)) {
      return total;
    }
    return total + Math.max(0, fs.statSync(item.outputPath).size);
  }, 0);

/**
 * Maps every manifest part to a temp-file output path, rejecting unsafe part
 * file names before any network request happens.
 */
const buildRuntimePartDownloadPlan = (
  record: MiniBackendRuntimeArtifactRecord,
  tempDir: string,
): RuntimePartDownloadItem[] =>
  record.parts.map((part) => {
    if (!isSafeManifestPathSegment(part.file)) {
      throw new Error(`Runtime manifest part has an unsafe file name: ${part.file}`);
    }
    return {
      part,
      outputPath: path.join(tempDir, part.file),
    };
  });

const isVerifiedPartOnDisk = async (
  item: RuntimePartDownloadItem,
  sha512ForFile: (filePath: string) => Promise<string>,
): Promise<boolean> => {
  if (!fs.existsSync(item.outputPath) || fs.statSync(item.outputPath).size !== item.part.size) {
    return false;
  }
  return (await sha512ForFile(item.outputPath)) === item.part.sha512;
};

const downloadRuntimeParts = async ({
  record,
  tempDir,
  fetchImpl = fetch,
  sha512ForFile,
  isRetryable,
  onEvent = () => {},
}: {
  record: MiniBackendRuntimeArtifactRecord;
  tempDir: string;
  fetchImpl?: typeof fetch;
  sha512ForFile: (filePath: string) => Promise<string>;
  isRetryable: (error: unknown) => boolean;
  onEvent?: (event: RuntimePartsEvent) => void;
}): Promise<RuntimePartDownloadItem[]> => {
  const items = buildRuntimePartDownloadPlan(record, tempDir);
  const totalBytes = computeRuntimePartsTotalBytes(record);
  const maxAttempts = RUNTIME_DOWNLOAD_RETRY_COUNT + 1;
  let completedBytes = 0;

  for (const item of items) {
    if (await isVerifiedPartOnDisk(item, sha512ForFile)) {
      onEvent({ type: "verifying-part", file: item.part.file });
      completedBytes += item.part.size;
      onEvent({ type: "part-verified", file: item.part.file, bytes: item.part.size });
      continue;
    }

    let currentAttempt = 0;
    await runWithRetry({
      retryCount: RUNTIME_DOWNLOAD_RETRY_COUNT,
      isRetryable,
      onRetry: ({ attempt, delayMs, error }) => {
        const nextAttempt = Math.min(maxAttempts, attempt + 1);
        onEvent({
          type: "download-retry",
          file: item.part.file,
          attempt: nextAttempt,
          maxAttempts,
          delayMs,
          error,
        });
      },
      operation: async () => {
        currentAttempt += 1;
        const resuming = fs.existsSync(item.outputPath) && fs.statSync(item.outputPath).size > 0;
        onEvent({
          type: "download-start",
          file: item.part.file,
          attempt: currentAttempt,
          maxAttempts,
          resuming,
        });

        await downloadUrlToFileWithResume(item.part.url, item.outputPath, {
          expectedTotalBytes: item.part.size,
          fetchImpl: (url, init) => fetchImpl(url, {
            ...init,
            signal: AbortSignal.timeout(resolveRuntimeTransferTimeoutMs(item.part.size)),
          }),
          onProgress: (progress) => {
            onEvent({
              type: "download-progress",
              file: item.part.file,
              progress: {
                transferredBytes: completedBytes + progress.transferredBytes,
                totalBytes,
                percent: totalBytes > 0
                  ? Math.max(0, Math.min(100, ((completedBytes + progress.transferredBytes) / totalBytes) * 100))
                  : 0,
                speedBytesPerSecond: progress.speedBytesPerSecond,
              },
            });
          },
        });
      },
    });

    onEvent({ type: "verifying-part", file: item.part.file });
    const currentSha512 = await sha512ForFile(item.outputPath);
    if (currentSha512 !== item.part.sha512) {
      throw new Error(`Runtime part sha512 mismatch: ${item.part.file}`);
    }
    completedBytes += item.part.size;
    onEvent({ type: "part-verified", file: item.part.file, bytes: item.part.size });
  }

  return items;
};

export {
  buildRuntimePartDownloadPlan,
  computeRuntimePartsTotalBytes,
  downloadRuntimeParts,
  isRuntimeManifestForCurrentPlatform,
  resolveExistingRuntimePartBytes,
};
