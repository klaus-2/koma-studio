/**
 * Mini-backend downloaded runtime install pipeline (download → verify → extract).
 */
import { app } from "electron";
import { execFileSync } from "node:child_process";
import fs from "node:fs";
import path from "node:path";
import type {
  MiniBackendRuntimeArtifactManifest,
  MiniBackendRuntimeArtifactRecord,
} from "../mini-backend-artifacts.ts";
import type { MiniBackendAccelerationProfile } from "../mini-backend-runtime.ts";
import {
  downloadUrlToFileWithResume,
  resolveRuntimeTransferTimeoutMs,
  runWithRetry,
  RUNTIME_DOWNLOAD_RETRY_COUNT,
} from "../mini-backend-runtime-download.ts";
import { ensureMiniBackendRuntimeDiskSpace, isRetryableRuntimeDownloadError } from "./mini-backend-runtime-disk.ts";
import {
  computeSha512Base64ForFile,
  getMiniBackendRuntimeInstallDir,
} from "./mini-backend-runtime-integrity.ts";
import type { MiniBackendRuntimeStore } from "./mini-backend-runtime-store.ts";
import {
  resolveMiniBackendRuntimeManifestUrl,
  resolveMiniBackendRuntimeUrl,
} from "./mini-backend-runtime-urls.ts";

const RUNTIME_ARCHIVE_EXTRACT_TIMEOUT_MS = 60 * 60_000;

const createMiniBackendRuntimeInstaller = (deps: {
  isDev: boolean;
  runtimeStore: MiniBackendRuntimeStore;
  miniBackendArtifactsUrl: string | null;
  readManifest: (
    options?: { silent?: boolean },
  ) => Promise<MiniBackendRuntimeArtifactManifest | null>;
}) => {
  const downloadRuntimeArtifactToDisk = async (
    profile: MiniBackendAccelerationProfile,
    record: MiniBackendRuntimeArtifactRecord,
    downloadUrl: string,
    outputPath: string,
  ): Promise<void> => {
    const maxAttempts = RUNTIME_DOWNLOAD_RETRY_COUNT + 1;
    let currentAttempt = 0;

    await runWithRetry({
      retryCount: RUNTIME_DOWNLOAD_RETRY_COUNT,
      isRetryable: isRetryableRuntimeDownloadError,
      onRetry: ({ attempt, delayMs, error }) => {
        const nextAttempt = Math.min(maxAttempts, attempt + 1);
        deps.runtimeStore.patch({
          status: "downloading",
          statusMessage: `Retrying ${profile} runtime download (${nextAttempt}/${maxAttempts}) in ${Math.max(1, Math.ceil(delayMs / 1000))}s.`,
          lastError: error instanceof Error ? error.message : String(error),
          attempt: nextAttempt,
          maxAttempts,
        });
      },
      operation: async () => {
        currentAttempt += 1;
        deps.runtimeStore.patch({
          status: "downloading",
          statusMessage:
            (fs.existsSync(outputPath) && fs.statSync(outputPath).size > 0)
              ? `Resuming ${profile} runtime download (${currentAttempt}/${maxAttempts}).`
              : `Downloading ${profile} runtime (${currentAttempt}/${maxAttempts}).`,
          lastError: null,
          attempt: currentAttempt,
          maxAttempts,
          progress: {
            transferredBytes: fs.existsSync(outputPath) ? fs.statSync(outputPath).size : 0,
            totalBytes: Math.max(0, record.size),
            percent: record.size > 0 && fs.existsSync(outputPath)
              ? Math.max(0, Math.min(100, (fs.statSync(outputPath).size / record.size) * 100))
              : 0,
            speedBytesPerSecond: 0,
          },
        });

        await downloadUrlToFileWithResume(downloadUrl, outputPath, {
          expectedTotalBytes: record.size,
          fetchImpl: (url, init) => fetch(url, {
            ...init,
            signal: AbortSignal.timeout(resolveRuntimeTransferTimeoutMs(record.size)),
          }),
          onProgress: (progress) => {
            deps.runtimeStore.patch({
              status: "downloading",
              progress,
              attempt: currentAttempt,
              maxAttempts,
              lastError: null,
            });
          },
        });
      },
    });
  };

  const extractRuntimeArchive = async (
    archivePath: string,
    destinationDir: string,
  ): Promise<void> => {
    fs.rmSync(destinationDir, { recursive: true, force: true });
    fs.mkdirSync(destinationDir, { recursive: true });

    if (process.platform === "win32") {
      execFileSync(
        "powershell.exe",
        [
          "-NoProfile",
          "-Command",
          "Expand-Archive",
          "-LiteralPath",
          archivePath,
          "-DestinationPath",
          destinationDir,
          "-Force",
        ],
        {
          stdio: "ignore",
          windowsHide: true,
          timeout: RUNTIME_ARCHIVE_EXTRACT_TIMEOUT_MS,
        },
      );
      return;
    }

    throw new Error("Runtime archive extraction is currently supported only on Windows builds.");
  };

  const ensureMiniBackendDownloadedRuntime = async (
    profile: MiniBackendAccelerationProfile,
    { allowCpuDownload = false }: { allowCpuDownload?: boolean } = {},
  ): Promise<{
    binaryPath: string;
    installDir: string;
    version: string;
    archiveUrl: string;
  } | null> => {
    if (deps.isDev || (profile === "cpu" && !allowCpuDownload)) {
      return null;
    }

    const manifest = await deps.readManifest();
    const manifestUrl = resolveMiniBackendRuntimeManifestUrl(deps.miniBackendArtifactsUrl);
    if (!manifest || !manifestUrl) {
      return null;
    }

    const record = manifest.profiles?.[profile] as MiniBackendRuntimeArtifactRecord | undefined;
    if (!record) {
      deps.runtimeStore.patch({
        status: "fallback",
        statusMessage: `Runtime profile not available in manifest: ${profile}`,
        runtimeManifestUrl: manifestUrl,
        lastError: `Runtime profile not available in manifest: ${profile}`,
      });
      return null;
    }

    const installDir = getMiniBackendRuntimeInstallDir(manifest.version, profile);
    const binaryPath = path.join(installDir, record.entry);
    const archiveUrl = resolveMiniBackendRuntimeUrl(manifestUrl, record.url);
    if (fs.existsSync(binaryPath)) {
      deps.runtimeStore.patch({
        requestedProfile: profile,
        activeProfile: profile,
        source: "downloaded-runtime",
        runtimeManifestUrl: manifestUrl,
        runtimeArchiveUrl: archiveUrl,
        installDir,
        version: manifest.version,
        lastError: null,
        status: "ready",
        statusMessage: `${profile} runtime ready.`,
        attempt: 0,
        maxAttempts: 0,
        progress: null,
      });
      return {
        binaryPath,
        installDir,
        version: manifest.version,
        archiveUrl,
      };
    }

    const tempDir = path.join(app.getPath("temp"), "koma-runtime-downloads");
    const tempZipPath = path.join(tempDir, record.fileName);
    const tempExtractDir = `${installDir}.tmp`;

    try {
      ensureMiniBackendRuntimeDiskSpace(tempZipPath, installDir, record.size);
      await downloadRuntimeArtifactToDisk(profile, record, archiveUrl, tempZipPath);
      deps.runtimeStore.patch({
        status: "verifying",
        statusMessage: `Verifying ${profile} runtime archive.`,
      });
      const currentSha512 = await computeSha512Base64ForFile(tempZipPath);
      if (currentSha512 !== record.sha512) {
        throw new Error("Runtime archive sha512 mismatch.");
      }

      deps.runtimeStore.patch({
        status: "extracting",
        statusMessage: `Installing ${profile} runtime.`,
      });
      await extractRuntimeArchive(tempZipPath, tempExtractDir);
      fs.rmSync(installDir, { recursive: true, force: true });
      fs.renameSync(tempExtractDir, installDir);

      deps.runtimeStore.patch({
        requestedProfile: profile,
        activeProfile: profile,
        source: "downloaded-runtime",
        runtimeManifestUrl: manifestUrl,
        runtimeArchiveUrl: archiveUrl,
        installDir,
        version: manifest.version,
        lastError: null,
        status: "ready",
        statusMessage: `${profile} runtime installed successfully.`,
        progress: null,
        attempt: 0,
        maxAttempts: 0,
      });
      return {
        binaryPath,
        installDir,
        version: manifest.version,
        archiveUrl,
      };
    } catch (error) {
      fs.rmSync(tempExtractDir, { recursive: true, force: true });
      const message = error instanceof Error ? error.message : String(error);
      deps.runtimeStore.patch({
        requestedProfile: profile,
        activeProfile: "cpu",
        source: "bundled-core",
        runtimeManifestUrl: manifestUrl,
        runtimeArchiveUrl: archiveUrl,
        installDir: null,
        version: manifest.version,
        lastError: message,
        status: "fallback",
        statusMessage: `Failed to install ${profile} runtime. Falling back to the embedded runtime.`,
        progress: null,
      });
      console.warn(`[mini-backend-runtime] ${message}`);
      return null;
    } finally {
      if (fs.existsSync(binaryPath)) {
        fs.rmSync(tempZipPath, { force: true });
      }
    }
  };

  return {
    downloadRuntimeArtifactToDisk,
    ensureMiniBackendDownloadedRuntime,
    extractRuntimeArchive,
  };
};

export { createMiniBackendRuntimeInstaller };
