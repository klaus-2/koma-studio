/**
 * Mini-backend downloaded runtime install pipeline (download parts → verify
 * each part → extract all parts into one temp dir → atomic rename).
 */
import { app } from "electron";
import fs from "node:fs";
import path from "node:path";
import { Unzip, UnzipInflate } from "fflate";
import {
  isSafeManifestPathSegment,
  type MiniBackendRuntimeArtifactManifest,
  type MiniBackendRuntimeArtifactRecord,
} from "../mini-backend-artifacts.ts";
import type { MiniBackendAccelerationProfile } from "../mini-backend-runtime.ts";
import { estimateRuntimeInstallRequiredBytes } from "../mini-backend-runtime-download.ts";
import { isRetryableRuntimeDownloadError } from "./mini-backend-runtime-disk.ts";
import { ensureMiniBackendRuntimeDiskSpace } from "./mini-backend-runtime-disk.ts";
import {
  computeSha512Base64ForFile,
  getMiniBackendRuntimeInstallDir,
} from "./mini-backend-runtime-integrity.ts";
import {
  buildRuntimePartDownloadPlan,
  computeRuntimePartsTotalBytes,
  downloadRuntimeParts,
  isRuntimeManifestForCurrentPlatform,
  resolveExistingRuntimePartBytes,
} from "./mini-backend-runtime-parts.ts";
import type { MiniBackendRuntimeStore } from "./mini-backend-runtime-store.ts";
import { resolveMiniBackendRuntimeManifestUrl } from "./mini-backend-runtime-urls.ts";

const ensurePathInsideRoot = (rootDir: string, candidatePath: string): void => {
  const root = path.resolve(rootDir);
  const candidate = path.resolve(candidatePath);
  const relative = path.relative(root, candidate);
  if (relative === "" || relative.startsWith("..") || path.isAbsolute(relative)) {
    throw new Error(`Runtime manifest path escapes the expected root: ${candidatePath}`);
  }
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

/**
 * Streams one part zip into the destination directory without wiping it, so
 * consecutive parts of the same runtime land in the same extraction tree.
 */
const extractZipStreamToDir = (archivePath: string, destinationDir: string): Promise<void> =>
  new Promise<void>((resolve, reject) => {
    const unzip = new Unzip();
    unzip.register(UnzipInflate);
    const activeWrites = new Set<fs.WriteStream>();
    let settled = false;

    const fail = (error: Error): void => {
      if (settled) {
        return;
      }
      settled = true;
      activeWrites.forEach((stream) => {
        stream.destroy();
      });
      reject(error);
    };

    unzip.onfile = (file) => {
      if (file.name.endsWith("/")) {
        return;
      }
      const target = resolveSafeZipEntryTarget(destinationDir, file.name);
      if (!target) {
        fail(new Error(`Runtime archive contains an unsafe entry name: ${file.name}`));
        return;
      }
      fs.mkdirSync(path.dirname(target), { recursive: true });
      const output = fs.createWriteStream(target);
      activeWrites.add(output);
      output.on("error", fail);
      output.on("close", () => {
        activeWrites.delete(output);
      });
      file.ondata = (chunk, final) => {
        // fflate reports decompression failures through this handler with the
        // error object in place of data and final=true.
        if (!(chunk instanceof Uint8Array)) {
          fail(chunk instanceof Error ? chunk : new Error("Runtime part extraction stream failed."));
          return;
        }
        const buffered = output.write(Buffer.from(chunk));
        if (!buffered) {
          readStream.pause();
          output.once("drain", () => readStream.resume());
        }
        if (final) {
          output.end();
        }
      };
      file.start();
    };

    const readStream = fs.createReadStream(archivePath);
    readStream.on("data", (chunk) => {
      try {
        unzip.push(chunk instanceof Uint8Array ? chunk : Buffer.from(chunk));
      } catch (error) {
        fail(error instanceof Error ? error : new Error(String(error)));
        readStream.destroy();
      }
    });
    readStream.on("error", fail);
    readStream.on("close", () => {
      if (settled) {
        return;
      }
      try {
        unzip.push(new Uint8Array(0), true);
      } catch (error) {
        fail(error instanceof Error ? error : new Error(String(error)));
        return;
      }
      const finish = (): void => {
        if (!settled && activeWrites.size === 0) {
          settled = true;
          resolve();
        }
      };
      finish();
      activeWrites.forEach((stream) => {
        stream.once("close", finish);
      });
    });
  });

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

    const failToFallback = (message: string): null => {
      deps.runtimeStore.patch({
        status: "fallback",
        statusMessage: message,
        runtimeManifestUrl: manifestUrl,
        lastError: message,
      });
      return null;
    };

    if (!isRuntimeManifestForCurrentPlatform(manifest, {
      platform: process.platform,
      arch: process.arch,
    })) {
      return failToFallback(
        `Runtime manifest platform mismatch: manifest is ${manifest.platform}/${manifest.arch}, build is ${process.platform}/${process.arch}.`,
      );
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

    // Defense in depth: the manifest reader already rejects these segments
    // (isMiniBackendRuntimeArtifactManifest); re-checking here keeps install
    // safe even if a future caller passes an unvalidated manifest.
    if (
      !isSafeManifestPathSegment(manifest.version)
      || !isSafeManifestPathSegment(record.entry)
      || record.parts.some((part) => !isSafeManifestPathSegment(part.file))
    ) {
      return failToFallback("Runtime manifest contains unsafe path segments.");
    }
    const installDir = getMiniBackendRuntimeInstallDir(manifest.version, profile);
    const runtimeRoot = path.join(app.getPath("userData"), "mini-backend-runtimes");
    ensurePathInsideRoot(runtimeRoot, installDir);
    const binaryPath = path.join(installDir, record.entry);
    ensurePathInsideRoot(installDir, binaryPath);
    const archiveUrl = record.parts[0]?.url ?? "";
    const manifestOrigin = new URL(manifestUrl);
    for (const part of record.parts) {
      const partOrigin = new URL(part.url);
      const insecureLocalAllowed =
        deps.isDev
        && partOrigin.protocol === "http:"
        && (partOrigin.hostname === "127.0.0.1"
          || partOrigin.hostname === "localhost"
          || partOrigin.hostname === "::1");
      if (
        partOrigin.host !== manifestOrigin.host
        || (partOrigin.protocol !== "https:" && !insecureLocalAllowed)
      ) {
        return failToFallback("Runtime part URLs must stay on the manifest origin over https.");
      }
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
    const partItems = buildRuntimePartDownloadPlan(record, tempDir);
    for (const item of partItems) {
      ensurePathInsideRoot(tempDir, item.outputPath);
    }
    const tempExtractDir = `${installDir}.tmp`;
    ensurePathInsideRoot(runtimeRoot, tempExtractDir);
    const totalPartsBytes = computeRuntimePartsTotalBytes(record);
    const requiredBytes = Math.max(
      0,
      Math.max(estimateRuntimeInstallRequiredBytes(0), totalPartsBytes * 3)
        - resolveExistingRuntimePartBytes(partItems),
    );

    try {
      ensureMiniBackendRuntimeDiskSpace([tempDir, installDir], requiredBytes);
      await downloadRuntimeParts({
        record,
        tempDir,
        fetchImpl,
        sha512ForFile: computeSha512Base64ForFile,
        isRetryable: isRetryableRuntimeDownloadError,
        onEvent: (event) => {
          if (event.type === "download-start") {
            deps.runtimeStore.patch({
              status: "downloading",
              statusMessage: event.resuming
                ? `Resuming ${profile} runtime part ${event.file} (${event.attempt}/${event.maxAttempts}).`
                : `Downloading ${profile} runtime part ${event.file} (${event.attempt}/${event.maxAttempts}).`,
              lastError: null,
              attempt: event.attempt,
              maxAttempts: event.maxAttempts,
            });
          } else if (event.type === "download-retry") {
            deps.runtimeStore.patch({
              status: "downloading",
              statusMessage: `Retrying ${profile} runtime part ${event.file} (${event.attempt}/${event.maxAttempts}) in ${Math.max(1, Math.ceil(event.delayMs / 1000))}s.`,
              lastError: event.error instanceof Error ? event.error.message : String(event.error),
              attempt: event.attempt,
              maxAttempts: event.maxAttempts,
            });
          } else if (event.type === "download-progress") {
            deps.runtimeStore.patch({
              status: "downloading",
              progress: event.progress,
              lastError: null,
            });
          } else if (event.type === "verifying-part") {
            deps.runtimeStore.patch({
              status: "verifying",
              statusMessage: `Verifying ${profile} runtime part ${event.file}.`,
            });
          }
        },
      });

      deps.runtimeStore.patch({
        status: "extracting",
        statusMessage: `Installing ${profile} runtime (${record.parts.length} part${record.parts.length === 1 ? "" : "s"}).`,
      });
      // One clean slate for the whole runtime; each part then extracts into
      // the same tree without wiping the previous part's files.
      fs.rmSync(tempExtractDir, { recursive: true, force: true });
      for (const item of partItems) {
        await extractZipStreamToDir(item.outputPath, tempExtractDir);
      }
      fs.rmSync(installDir, { recursive: true, force: true });
      fs.renameSync(tempExtractDir, installDir);
      // Part files are the cross-restart resume ledger until the install
      // commits; only then may they go away.
      for (const item of partItems) {
        fs.rmSync(item.outputPath, { force: true });
      }

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
      // Part files survive a failed attempt so the next one resumes from the
      // verified bytes; only the extraction tree is discarded.
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
    }
  };

  return {
    ensureMiniBackendDownloadedRuntime,
    extractZipStreamToDir,
  };
};

export { createMiniBackendRuntimeInstaller };
