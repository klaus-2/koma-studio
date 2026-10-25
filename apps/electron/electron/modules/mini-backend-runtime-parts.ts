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
import { pipeline as streamPipeline } from "node:stream/promises";
import { createInflateRaw } from "node:zlib";
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

/**
 * Zip entry names are producer-controlled; forward slashes are the only
 * accepted separator (our zips are produced with forward slashes on every
 * platform) and traversal or absolute segments are rejected.
 */
const resolveSafeZipEntryTarget = (destinationDir: string, entryName: string): string | null => {
  if (
    entryName.length === 0
    || entryName.length > 400
    || entryName.includes("\\")
    || entryName.includes("\0")
    || entryName.startsWith("/")
  ) {
    return null;
  }
  const segments = entryName.split("/");
  if (segments.some((segment) => segment === "" || segment === "." || segment === "..")) {
    return null;
  }
  return path.join(destinationDir, ...segments);
};

interface ZipCentralDirectoryEntry {
  name: string;
  compressionMethod: number;
  compressedSize: number;
  localHeaderOffset: number;
}

const readZipTail = (archivePath: string, maxTailBytes: number): Buffer => {
  const fileDescriptor = fs.openSync(archivePath, "r");
  try {
    const fileSize = fs.fstatSync(fileDescriptor).size;
    const tailSize = Math.min(fileSize, maxTailBytes);
    const tail = Buffer.alloc(tailSize);
    fs.readSync(fileDescriptor, tail, 0, tailSize, fileSize - tailSize);
    return tail;
  } finally {
    fs.closeSync(fileDescriptor);
  }
};

/**
 * Parses the zip central directory (fixed tail of the archive). Producer zips
 * stay below the zip64 thresholds (parts < 2 GiB, < 65 535 entries), so a
 * missing EOCD or a zip64 marker is a hard, loud error.
 */
const parseZipCentralDirectory = (archivePath: string): ZipCentralDirectoryEntry[] => {
  const tail = readZipTail(archivePath, 65_557);
  let eocdOffset = -1;
  for (let index = tail.length - 22; index >= 0; index -= 1) {
    if (tail.readUInt32LE(index) === 0x06054b50) {
      eocdOffset = index;
      break;
    }
  }
  if (eocdOffset < 0) {
    throw new Error(`Runtime part is not a valid zip (no end-of-central-directory): ${path.basename(archivePath)}`);
  }
  const entryCount = tail.readUInt16LE(eocdOffset + 10);
  const directoryOffset = tail.readUInt32LE(eocdOffset + 16);
  const directorySize = tail.readUInt32LE(eocdOffset + 12);
  if (directoryOffset === 0xffffffff || directorySize === 0xffffffff || entryCount === 0xffff) {
    throw new Error(`Runtime part uses zip64 extensions, which are unsupported: ${path.basename(archivePath)}`);
  }

  const directory = Buffer.alloc(directorySize);
  const fileDescriptor = fs.openSync(archivePath, "r");
  try {
    fs.readSync(fileDescriptor, directory, 0, directorySize, directoryOffset);
  } finally {
    fs.closeSync(fileDescriptor);
  }

  const entries: ZipCentralDirectoryEntry[] = [];
  let cursor = 0;
  for (let index = 0; index < entryCount; index += 1) {
    if (cursor + 46 > directory.length || directory.readUInt32LE(cursor) !== 0x02014b50) {
      throw new Error(`Runtime part has a corrupt central directory: ${path.basename(archivePath)}`);
    }
    const compressionMethod = directory.readUInt16LE(cursor + 10);
    const compressedSize = directory.readUInt32LE(cursor + 20);
    const nameLength = directory.readUInt16LE(cursor + 28);
    const extraLength = directory.readUInt16LE(cursor + 30);
    const commentLength = directory.readUInt16LE(cursor + 32);
    const localHeaderOffset = directory.readUInt32LE(cursor + 42);
    const name = directory.subarray(cursor + 46, cursor + 46 + nameLength).toString("utf8");
    entries.push({ name, compressionMethod, compressedSize, localHeaderOffset });
    cursor += 46 + nameLength + extraLength + commentLength;
  }
  return entries;
};

const readZipLocalHeaderDataOffset = (archivePath: string, localHeaderOffset: number): number => {
  const header = Buffer.alloc(30);
  const fileDescriptor = fs.openSync(archivePath, "r");
  try {
    fs.readSync(fileDescriptor, header, 0, 30, localHeaderOffset);
  } finally {
    fs.closeSync(fileDescriptor);
  }
  if (header.readUInt32LE(0) !== 0x04034b50) {
    throw new Error(`Runtime part has a corrupt local header: ${path.basename(archivePath)}`);
  }
  const nameLength = header.readUInt16LE(26);
  const extraLength = header.readUInt16LE(28);
  return localHeaderOffset + 30 + nameLength + extraLength;
};

/**
 * Streams one part zip into the destination directory without wiping it, so
 * consecutive parts of the same runtime land in the same extraction tree.
 * Entry ranges come straight from the central directory (deterministic; the
 * last entry of a producer zip finalizes exactly like every other one).
 */
const extractZipStreamToDir = async (archivePath: string, destinationDir: string): Promise<void> => {
  const entries = parseZipCentralDirectory(archivePath);
  fs.mkdirSync(destinationDir, { recursive: true });

  for (const entry of entries) {
    if (entry.name.endsWith("/")) {
      continue;
    }
    const target = resolveSafeZipEntryTarget(destinationDir, entry.name);
    if (!target) {
      throw new Error(`Runtime archive contains an unsafe entry name: ${entry.name}`);
    }
    fs.mkdirSync(path.dirname(target), { recursive: true });
    const dataOffset = readZipLocalHeaderDataOffset(archivePath, entry.localHeaderOffset);
    const compressed = fs
      .createReadStream(archivePath, {
        start: dataOffset,
        end: dataOffset + entry.compressedSize - 1,
      });
    const output = fs.createWriteStream(target);
    if (entry.compressionMethod === 0) {
      await streamPipeline(compressed, output);
    } else if (entry.compressionMethod === 8) {
      await streamPipeline(compressed, createInflateRaw(), output);
    } else {
      throw new Error(
        `Runtime part uses unsupported compression method ${entry.compressionMethod}: ${entry.name}`,
      );
    }
  }
};

export {
  buildRuntimePartDownloadPlan,
  computeRuntimePartsTotalBytes,
  downloadRuntimeParts,
  extractZipStreamToDir,
  isRuntimeManifestForCurrentPlatform,
  resolveExistingRuntimePartBytes,
};
