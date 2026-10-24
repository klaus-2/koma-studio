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
import { isSafeManifestPathSegment } from "../mini-backend-artifacts.ts";
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

const ensurePathInsideRoot = (rootDir: string, candidatePath: string): void => {
  const root = path.resolve(rootDir);
  const candidate = path.resolve(candidatePath);
  const relative = path.relative(root, candidate);
  if (relative === "" || relative.startsWith("..") || path.isAbsolute(relative)) {
    throw new Error(`Runtime manifest path escapes the expected root: ${candidatePath}`);
  }
};

const quote = (value: string): string => `'${value.replace(/'/g, "''")}'`;

const createMiniBackendRuntimeInstaller = (deps: {
  isDev: boolean;
  runtimeStore: MiniBackendRuntimeStore;
  miniBackendArtifactsUrl: string | null;
  fetchImpl?: typeof fetch;
  readManifest: (
    options?: { silent?: boolean },
  ) => Promise<MiniBackendRuntimeArtifactManifest | null>;
}) => {
  const fetchImpl = deps.fetchImpl ?? fetch;
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
          fetchImpl: (url, init) => fetchImpl(url, {
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
      // powershell.exe joins everything after -Command into one script string,
      // so manifest-controlled paths could inject statements. Encode a fixed
      // script instead (single-quoted literals, quotes doubled) and invoke the
      // system binary by absolute path so PATH cannot shadow it either.
      const powershellPath = path.join(
        process.env.SystemRoot ?? "C:\\Windows",
        "System32",
        "WindowsPowerShell",
        "v1.0",
        "powershell.exe",
      );
      const script =
        `Expand-Archive -LiteralPath ${quote(archivePath)} `
        + `-DestinationPath ${quote(destinationDir)} -Force`;
      const encodedCommand = Buffer.from(script, "utf16le").toString("base64");
      execFileSync(
        powershellPath,
        ["-NoProfile", "-NonInteractive", "-EncodedCommand", encodedCommand],
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
    const failToFallback = (message: string): null => {
      deps.runtimeStore.patch({
        status: "fallback",
        statusMessage: message,
        runtimeManifestUrl: manifestUrl,
        lastError: message,
      });
      return null;
    };
    if (!record) {
      deps.runtimeStore.patch({
        status: "fallback",
        statusMessage: `Runtime profile not available in manifest: ${profile}`,
        runtimeManifestUrl: manifestUrl,
        lastError: `Runtime profile not available in manifest: ${profile}`,
      });
      return null;
    }

    // Defense in depth: the manifest reader already rejects these segments
    // (isMiniBackendRuntimeArtifactManifest); re-checking here keeps install
    // safe even if a future caller passes an unvalidated manifest.
    if (
      !isSafeManifestPathSegment(manifest.version)
      || !isSafeManifestPathSegment(record.entry)
      || !isSafeManifestPathSegment(record.fileName)
    ) {
      return failToFallback("Runtime manifest contains unsafe path segments.");
    }
    const installDir = getMiniBackendRuntimeInstallDir(manifest.version, profile);
    const runtimeRoot = path.join(app.getPath("userData"), "mini-backend-runtimes");
    ensurePathInsideRoot(runtimeRoot, installDir);
    const binaryPath = path.join(installDir, record.entry);
    ensurePathInsideRoot(installDir, binaryPath);
    const archiveUrl = resolveMiniBackendRuntimeUrl(manifestUrl, record.url);
    const manifestOrigin = new URL(manifestUrl);
    const archiveOrigin = new URL(archiveUrl);
    const insecureLocalAllowed =
      deps.isDev
      && archiveOrigin.protocol === "http:"
      && (archiveOrigin.hostname === "127.0.0.1"
        || archiveOrigin.hostname === "localhost"
        || archiveOrigin.hostname === "::1");
    if (
      archiveOrigin.host !== manifestOrigin.host
      || (archiveOrigin.protocol !== "https:" && !insecureLocalAllowed)
    ) {
      return failToFallback("Runtime archive URL must stay on the manifest origin over https.");
    }
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
    ensurePathInsideRoot(tempDir, tempZipPath);
    const tempExtractDir = `${installDir}.tmp`;
    ensurePathInsideRoot(runtimeRoot, tempExtractDir);

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
      // The downloaded archive must never outlive the install attempt,
      // regardless of whether the entry binary was produced.
      fs.rmSync(tempZipPath, { force: true });
    }
  };

  return {
    downloadRuntimeArtifactToDisk,
    ensureMiniBackendDownloadedRuntime,
    extractRuntimeArchive,
  };
};

export { createMiniBackendRuntimeInstaller };
