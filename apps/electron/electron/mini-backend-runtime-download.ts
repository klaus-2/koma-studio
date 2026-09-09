import fs from "node:fs";
import path from "node:path";
import { Readable, Transform } from "node:stream";
import { pipeline as streamPipeline } from "node:stream/promises";

const MIN_RUNTIME_INSTALL_REQUIRED_BYTES = 512 * 1024 * 1024;

export const RUNTIME_DOWNLOAD_RETRY_COUNT = 2;
export const RUNTIME_DOWNLOAD_RETRY_BASE_DELAY_MS = 1_000;

export interface RuntimeDownloadProgress {
  transferredBytes: number;
  totalBytes: number;
  percent: number;
  speedBytesPerSecond: number;
}

export interface RuntimeDownloadOptions {
  fallbackTotalBytes?: number;
  existingBytes?: number;
  append?: boolean;
  now?: () => number;
  onProgress?: (progress: RuntimeDownloadProgress) => void;
}

export interface RuntimeResumableDownloadOptions extends RuntimeDownloadOptions {
  expectedTotalBytes?: number;
  fetchImpl?: typeof fetch;
}

export interface RuntimeRetryContext {
  attempt: number;
  delayMs: number;
  error: unknown;
}

export interface RuntimeRetryOptions<TResult> {
  operation: () => Promise<TResult>;
  retryCount?: number;
  baseDelayMs?: number;
  isRetryable?: (error: unknown) => boolean;
  sleep?: (delayMs: number) => Promise<void>;
  onRetry?: (context: RuntimeRetryContext) => void;
}

const toPositiveNumber = (value: number): number =>
  Number.isFinite(value) && value > 0 ? value : 0;

export const resolveRuntimeTransferTimeoutMs = (expectedTotalBytes = 0): number => {
  const minTimeoutMs = 30 * 60_000;
  const maxTimeoutMs = 8 * 60 * 60_000;
  if (!Number.isFinite(expectedTotalBytes) || expectedTotalBytes <= 0) {
    return 2 * 60 * 60_000;
  }

  const bytesPerSecondFloor = 1 * 1024 * 1024;
  const transferSeconds = Math.ceil(expectedTotalBytes / bytesPerSecondFloor);
  const timeoutMs = (transferSeconds + 5 * 60) * 1_000;
  return Math.max(minTimeoutMs, Math.min(maxTimeoutMs, timeoutMs));
};

export const resolveExistingPathForStatfs = (targetPath: string): string | null => {
  if (!targetPath) {
    return null;
  }

  let currentPath = path.resolve(path.dirname(targetPath));
  while (true) {
    if (fs.existsSync(currentPath)) {
      return currentPath;
    }

    const parentPath = path.dirname(currentPath);
    if (parentPath === currentPath) {
      return null;
    }
    currentPath = parentPath;
  }
};

export const estimateRuntimeInstallRequiredBytes = (archiveBytes: number): number => {
  const normalizedArchiveBytes = Math.max(0, Math.trunc(archiveBytes));
  return Math.max(MIN_RUNTIME_INSTALL_REQUIRED_BYTES, normalizedArchiveBytes * 3);
};

export const downloadResponseToFile = async (
  response: Response,
  outputPath: string,
  {
    fallbackTotalBytes = 0,
    existingBytes = 0,
    append = false,
    now = Date.now,
    onProgress,
  }: RuntimeDownloadOptions = {},
): Promise<RuntimeDownloadProgress> => {
  if (!response.ok || !response.body) {
    throw new Error(`Download failed: HTTP ${response.status}`);
  }

  const headerTotalBytes = Number(response.headers.get("content-length") ?? 0);
  const totalBytes = toPositiveNumber(headerTotalBytes) + toPositiveNumber(existingBytes)
    || toPositiveNumber(fallbackTotalBytes);
  const startedAtMs = now();
  let transferredBytes = Math.max(0, Math.trunc(existingBytes));

  const emitProgress = (): RuntimeDownloadProgress => {
    const elapsedSeconds = Math.max(0.001, (now() - startedAtMs) / 1000);
    const resolvedTotalBytes = Math.max(totalBytes, transferredBytes);
    const progress: RuntimeDownloadProgress = {
      transferredBytes,
      totalBytes: resolvedTotalBytes,
      percent: resolvedTotalBytes > 0 ? Math.max(0, Math.min(100, (transferredBytes / resolvedTotalBytes) * 100)) : 0,
      speedBytesPerSecond: Math.max(0, Math.round(transferredBytes / elapsedSeconds)),
    };
    onProgress?.(progress);
    return progress;
  };

  fs.mkdirSync(path.dirname(outputPath), { recursive: true });
  const writable = fs.createWriteStream(outputPath, append ? { flags: "a" } : undefined);
  const tracker = new Transform({
    transform(chunk, _encoding, callback) {
      transferredBytes += Buffer.isBuffer(chunk) ? chunk.byteLength : Buffer.byteLength(String(chunk));
      emitProgress();
      callback(null, chunk);
    },
  });

  emitProgress();
  await streamPipeline(Readable.fromWeb(response.body as never), tracker, writable);
  return emitProgress();
};

const parseContentRangeHeader = (
  value: string | null,
): { start: number; end: number; total: number | null } | null => {
  if (!value) {
    return null;
  }

  const match = value.trim().match(/^bytes\s+(\d+)-(\d+)\/(\d+|\*)$/i);
  if (!match) {
    return null;
  }

  const start = Number(match[1]);
  const end = Number(match[2]);
  const total = match[3] === "*" ? null : Number(match[3]);
  if (!Number.isFinite(start) || !Number.isFinite(end) || (total !== null && !Number.isFinite(total))) {
    return null;
  }

  return { start, end, total };
};

const getExistingDownloadBytes = (outputPath: string, expectedTotalBytes = 0): number => {
  if (!fs.existsSync(outputPath)) {
    return 0;
  }

  const existingBytes = Math.max(0, Math.trunc(fs.statSync(outputPath).size));
  if (expectedTotalBytes > 0 && existingBytes >= expectedTotalBytes) {
    fs.rmSync(outputPath, { force: true });
    return 0;
  }

  return existingBytes;
};

export const downloadUrlToFileWithResume = async (
  downloadUrl: string,
  outputPath: string,
  {
    expectedTotalBytes = 0,
    fetchImpl = fetch,
    fallbackTotalBytes = 0,
    now = Date.now,
    onProgress,
  }: RuntimeResumableDownloadOptions = {},
): Promise<RuntimeDownloadProgress> => {
  const existingBytes = getExistingDownloadBytes(outputPath, expectedTotalBytes || fallbackTotalBytes);
  const headers = new Headers();
  if (existingBytes > 0) {
    headers.set("Range", `bytes=${existingBytes}-`);
  }

  const response = await fetchImpl(downloadUrl, {
    method: "GET",
    headers,
  });

  const expectedBytes = Math.max(expectedTotalBytes, fallbackTotalBytes);
  const contentRange = parseContentRangeHeader(response.headers.get("content-range"));
  const canAppend =
    existingBytes > 0 && response.status === 206 && contentRange !== null && contentRange.start === existingBytes;

  if (!canAppend && existingBytes > 0 && fs.existsSync(outputPath)) {
    fs.rmSync(outputPath, { force: true });
  }

  return downloadResponseToFile(response, outputPath, {
    fallbackTotalBytes: contentRange?.total ?? expectedBytes,
    existingBytes: canAppend ? existingBytes : 0,
    append: canAppend,
    now,
    onProgress,
  });
};

export const runWithRetry = async <TResult>({
  operation,
  retryCount = RUNTIME_DOWNLOAD_RETRY_COUNT,
  baseDelayMs = RUNTIME_DOWNLOAD_RETRY_BASE_DELAY_MS,
  isRetryable = () => true,
  sleep = (delayMs) => new Promise<void>((resolve) => setTimeout(resolve, delayMs)),
  onRetry,
}: RuntimeRetryOptions<TResult>): Promise<TResult> => {
  const maxRetryCount = Math.max(0, Math.trunc(retryCount));

  for (let attempt = 1; attempt <= maxRetryCount + 1; attempt += 1) {
    try {
      return await operation();
    } catch (error) {
      const willRetry = attempt <= maxRetryCount && isRetryable(error);
      if (!willRetry) {
        throw error;
      }

      const delayMs = Math.max(0, Math.trunc(baseDelayMs)) * attempt;
      onRetry?.({ attempt, delayMs, error });
      await sleep(delayMs);
    }
  }

  throw new Error("Unreachable retry state.");
};
