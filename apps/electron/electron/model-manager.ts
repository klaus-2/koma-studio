import fs from "node:fs";
import path from "node:path";

import type { BrowserWindow } from "electron";

import { LOCAL_API_SESSION_HEADER } from "./modules/desktop-auth-constants.ts";
import { runBackendJobInstall, shouldRetryDownload } from "./model-manager/backend-job.ts";
import {
  BACKEND_MANAGED_MODEL_IDS,
  EASYOCR_MODEL_ID,
  ENHANCE_MODEL_FILE_NAME,
  MANIFEST_FILE_NAME,
  MAX_RETRY_ATTEMPTS,
  MODEL_JOB_POLL_INTERVAL_MS,
  PARTIAL_FILE_NAME,
} from "./model-manager/constants.ts";
import {
  detectEasyocrInstalledLanguages,
  isInstalledPayloadPresent,
} from "./model-manager/installed-state.ts";
import {
  computeDirectorySize,
  getModelDir as resolveModelDirPath,
  getModelManifestPath as resolveModelManifestPath,
  getModelsRootDir as resolveModelsRootDirPath,
  readJsonFile,
  writeIncompleteManifest as persistIncompleteManifest,
  writeInstalledManifest as persistInstalledManifest,
} from "./model-manager/manifests.ts";
import {
  resolveChecksumFromHead,
  resolveChecksumFromHuggingFaceApi,
} from "./model-manager/remote-checksums.ts";
import {
  isModelDownloadErrorCode,
  type DesktopDiskSpaceInfo,
  type DesktopDownloadModelPayload,
  type DesktopInstalledModelRecord,
  type DesktopModelManagerEvent,
  type DesktopModelManifest,
  type DesktopRemoteModelUpdateCheckResult,
  type DownloadTask,
} from "./model-manager/types.ts";
import {
  assertValidDownloadChecksum,
  assertValidDownloadUrl,
  checksumFile,
  normalizeChecksum,
  normalizeLanguageCode,
  sanitizeModelId,
  warnIfInsufficientDiskSpace,
} from "./model-manager/validation.ts";

export type {
  DesktopDiskSpaceInfo,
  DesktopDownloadModelPayload,
  DesktopInstalledModelRecord,
  DesktopModelManagerEvent,
  DesktopModelManifestStatus,
  DesktopRemoteModelUpdateCheckResult,
} from "./model-manager/types.ts";

interface ActiveDownload {
  modelId: string;
  abortController: AbortController;
}

export class DesktopModelManagerService {
  private readonly queue: DownloadTask[] = [];

  private activeDownload: ActiveDownload | null = null;

  private processing = false;

  // Model ids the user uninstalled mid-download: their aborted cleanup must
  // not recreate the directory the uninstall just removed.
  private readonly deliberatelyRemovedModelIds = new Set<string>();

  // A cancel clicked between attempts has no active AbortController to abort;
  // remember the request so the next attempt can observe it.
  private readonly cancelRequested = new Set<string>();

  private readonly retryGapModelIds = new Set<string>();

  protected jobPollIntervalMs: number = MODEL_JOB_POLL_INTERVAL_MS;

  // 150 × 200 ms ≈ 30 s of a local backend that never answers a job poll.
  protected maxConsecutivePollFailures: number = 150;

  // Declared as fields (not constructor parameter properties) so the service
  // stays loadable by Node's strip-only TypeScript loader in `node --test`.
  private readonly userDataDirProvider: () => string;

  private readonly windowProvider: () => BrowserWindow | null;

  private readonly backendBaseUrlProvider: () => string;

  private readonly localApiSessionSecretProvider: () => string;

  constructor(
    userDataDirProvider: () => string,
    windowProvider: () => BrowserWindow | null,
    backendBaseUrlProvider: () => string,
    localApiSessionSecretProvider: () => string = () => "",
  ) {
    this.userDataDirProvider = userDataDirProvider;
    this.windowProvider = windowProvider;
    this.backendBaseUrlProvider = backendBaseUrlProvider;
    this.localApiSessionSecretProvider = localApiSessionSecretProvider;
  }

  private createLocalBackendHeaders(contentType = true): Record<string, string> {
    const headers: Record<string, string> = {};
    if (contentType) {
      headers["Content-Type"] = "application/json";
    }

    const localApiSessionSecret = this.localApiSessionSecretProvider().trim();
    if (localApiSessionSecret) {
      headers[LOCAL_API_SESSION_HEADER] = localApiSessionSecret;
    }

    return headers;
  }

  private getModelsRootDir(): string {
    return resolveModelsRootDirPath(this.userDataDirProvider());
  }

  private getModelDir(modelId: string): string {
    return resolveModelDirPath(this.userDataDirProvider(), modelId);
  }

  private getModelManifestPath(modelId: string): string {
    return resolveModelManifestPath(this.userDataDirProvider(), modelId);
  }

  private emit(event: DesktopModelManagerEvent): void {
    const targetWindow = this.windowProvider();
    if (!targetWindow || targetWindow.isDestroyed()) {
      return;
    }

    targetWindow.webContents.send("model-manager:event", event);
  }

  getDiskSpaceInfo(): DesktopDiskSpaceInfo {
    const rootDir = this.getModelsRootDir();
    const stats = fs.statfsSync(rootDir);

    return {
      freeBytes: Number(stats.bavail) * Number(stats.bsize),
      totalBytes: Number(stats.blocks) * Number(stats.bsize),
      path: rootDir,
    };
  }

  listInstalledModels(): DesktopInstalledModelRecord[] {
    const rootDir = this.getModelsRootDir();
    const records: DesktopInstalledModelRecord[] = [];

    for (const entry of fs.readdirSync(rootDir, { withFileTypes: true })) {
      if (!entry.isDirectory()) {
        continue;
      }

      const modelId = entry.name;
      const modelDir = path.join(rootDir, modelId);
      const manifestPath = path.join(modelDir, MANIFEST_FILE_NAME);
      const partialPath = path.join(modelDir, PARTIAL_FILE_NAME);
      const manifest = readJsonFile<DesktopModelManifest>(manifestPath);
      const hasPartial = fs.existsSync(partialPath);
      const sizeBytes = computeDirectorySize(modelDir);

      if (manifest?.status === "installed") {
        const hasPayload = isInstalledPayloadPresent(modelId, modelDir);
        const installedLanguages =
          modelId === EASYOCR_MODEL_ID ? detectEasyocrInstalledLanguages(modelDir) : undefined;
        if (!hasPayload) {
          records.push({
            modelId,
            version: manifest.version,
            installedAt: manifest.installedAt,
            checksumSHA256: manifest.checksumSHA256,
            status: "incomplete",
            installedLanguages,
            modelDir,
            manifestPath,
            sizeBytes,
          });
          continue;
        }

        records.push({
          modelId,
          version: manifest.version,
          installedAt: manifest.installedAt,
          checksumSHA256: manifest.checksumSHA256,
          status: "installed",
          installedLanguages,
          origin: typeof manifest.origin === "string" ? manifest.origin : null,
          modelDir,
          manifestPath,
          sizeBytes,
        });
        continue;
      }

      if (manifest?.status === "incomplete" || hasPartial) {
        const installedLanguages =
          modelId === EASYOCR_MODEL_ID ? detectEasyocrInstalledLanguages(modelDir) : undefined;
        records.push({
          modelId,
          version: manifest?.version ?? "0.0.0",
          installedAt: manifest?.installedAt ?? new Date(0).toISOString(),
          checksumSHA256: manifest?.checksumSHA256 ?? "",
          status: "incomplete",
          installedLanguages,
          origin: typeof manifest?.origin === "string" ? manifest.origin : null,
          modelDir,
          manifestPath,
          sizeBytes,
        });
      }
    }

    return records;
  }

  async checkRemoteUpdates(
    models: DesktopDownloadModelPayload[],
  ): Promise<DesktopRemoteModelUpdateCheckResult[]> {
    const installedById = new Map(
      this.listInstalledModels()
        .filter((record) => record.status === "installed")
        .map((record) => [record.modelId, record]),
    );

    const results: DesktopRemoteModelUpdateCheckResult[] = [];
    for (const model of models) {
      const normalizedModelId = sanitizeModelId(model.id);
      const installed = installedById.get(normalizedModelId);
      if (!installed) {
        continue;
      }

      const controller = new AbortController();
      const timeout = setTimeout(() => controller.abort(), 15_000);
      try {
        const checksumCandidates = new Set<string>();
        const fromHead = await resolveChecksumFromHead(model.downloadUrl, controller.signal);
        if (fromHead) checksumCandidates.add(fromHead);
        const fromHfApi = await resolveChecksumFromHuggingFaceApi(model.downloadUrl, controller.signal);
        if (fromHfApi) checksumCandidates.add(fromHfApi);
        const remoteChecksum = Array.from(checksumCandidates)[0] ?? null;
        const installedChecksum = normalizeChecksum(installed.checksumSHA256 || "");
        const updateAvailable = Boolean(remoteChecksum) && remoteChecksum !== installedChecksum;

        results.push({
          modelId: normalizedModelId,
          installedChecksumSHA256: installed.checksumSHA256 || null,
          remoteChecksumSHA256: remoteChecksum,
          registryVersion: model.version,
          checked: Boolean(remoteChecksum),
          updateAvailable,
        });
      } finally {
        clearTimeout(timeout);
      }
    }

    return results;
  }

  enqueueDownload(model: DesktopDownloadModelPayload): { queued: boolean; queueLength: number } {
    const normalizedModelId = sanitizeModelId(model.id);
    // A fresh download is a new intent: an earlier uninstall must not keep
    // suppressing this task's incomplete manifest, and a stale cancel from a
    // finished task must not kill it on the first attempt.
    this.deliberatelyRemovedModelIds.delete(normalizedModelId);
    this.cancelRequested.delete(normalizedModelId);
    this.retryGapModelIds.delete(normalizedModelId);
    const normalizedModel: DesktopDownloadModelPayload = {
      ...model,
      id: normalizedModelId,
      checksumSHA256: normalizeChecksum(model.checksumSHA256),
      sourceLanguage: normalizeLanguageCode(model.sourceLanguage),
      installStrategy: model.installStrategy ?? (BACKEND_MANAGED_MODEL_IDS.has(normalizedModelId) ? "backend_managed" : "direct_download"),
      runtimeFamily: model.runtimeFamily,
      backendInstallEndpoint: model.backendInstallEndpoint ?? (BACKEND_MANAGED_MODEL_IDS.has(normalizedModelId) ? "/models/install" : undefined),
    };

    assertValidDownloadUrl(normalizedModel.downloadUrl);

    assertValidDownloadChecksum(normalizedModel.checksumSHA256);

    const alreadyQueued = this.queue.some((item) => item.model.id === normalizedModel.id);
    if (alreadyQueued || this.activeDownload?.modelId === normalizedModel.id) {
      return { queued: true, queueLength: this.queue.length + (this.activeDownload ? 1 : 0) };
    }

    this.queue.push({
      model: normalizedModel,
      enqueuedAt: Date.now(),
    });

    this.emit({
      type: "queued",
      modelId: normalizedModel.id,
      queueLength: this.queue.length,
    });

    void this.processQueue();

    return {
      queued: true,
      queueLength: this.queue.length,
    };
  }

  cancelDownload(modelId: string): void {
    const normalizedModelId = sanitizeModelId(modelId);

    const queueIndex = this.queue.findIndex((item) => item.model.id === normalizedModelId);
    if (queueIndex >= 0) {
      this.queue.splice(queueIndex, 1);
      this.emit({ type: "cancelled", modelId: normalizedModelId });
      return;
    }

    if (this.activeDownload?.modelId === normalizedModelId) {
      this.activeDownload.abortController.abort();
      return;
    }

    // Between retry attempts there is no active download to abort; the retry
    // loop observes this flag before starting the next attempt.
    this.cancelRequested.add(normalizedModelId);
  }

  cancelAllDownloads(): void {
    const queuedIds = this.queue.map((item) => item.model.id);
    this.queue.splice(0, this.queue.length);
    queuedIds.forEach((modelId) => {
      this.emit({ type: "cancelled", modelId });
    });

    // Retry gaps carry no active controller, so they need the explicit flag.
    for (const modelId of Array.from(this.retryGapModelIds)) {
      this.cancelRequested.add(modelId);
    }

    if (this.activeDownload) {
      this.activeDownload.abortController.abort();
    }
  }

  uninstallModel(modelId: string): void {
    const normalizedModelId = sanitizeModelId(modelId);
    // Record the removal before the abort: the aborted download's cleanup runs
    // after this and must not write an "incomplete" manifest back.
    this.deliberatelyRemovedModelIds.add(normalizedModelId);

    if (this.activeDownload?.modelId === normalizedModelId) {
      this.activeDownload.abortController.abort();
    }

    this.queue.forEach((item, index) => {
      if (item.model.id === normalizedModelId) {
        this.queue.splice(index, 1);
      }
    });

    const modelDir = this.getModelDir(normalizedModelId);
    fs.rmSync(modelDir, { recursive: true, force: true });
  }

  private async processQueue(): Promise<void> {
    if (this.processing) {
      return;
    }

    this.processing = true;

    try {
      while (this.queue.length > 0) {
        const nextTask = this.queue.shift();
        if (!nextTask) {
          continue;
        }

        try {
          await this.executeDownloadTask(nextTask);
        } catch (error) {
          const normalizedError =
            error instanceof Error ? error : new Error("Unexpected failure while processing download.");
          this.emit({
            type: "failed",
            modelId: nextTask.model.id,
            message: normalizedError.message,
            attempt: MAX_RETRY_ATTEMPTS,
            willRetry: false,
          });
          this.writeIncompleteManifest(nextTask.model);
          this.activeDownload = null;
        }
      }
    } finally {
      this.processing = false;
    }
  }

  private async executeDownloadTask(task: DownloadTask): Promise<void> {
    for (let attempt = 1; attempt <= MAX_RETRY_ATTEMPTS; attempt += 1) {
      this.retryGapModelIds.delete(task.model.id);

      if (this.cancelRequested.has(task.model.id)) {
        this.cancelRequested.delete(task.model.id);
        this.writeIncompleteManifest(task.model);
        this.emit({
          type: "cancelled",
          modelId: task.model.id,
        });
        return;
      }

      const abortController = new AbortController();
      this.activeDownload = {
        modelId: task.model.id,
        abortController,
      };

      this.emit({
        type: "started",
        modelId: task.model.id,
        attempt,
      });

      try {
        await this.downloadAndInstall(task.model, attempt, abortController.signal);

        this.emit({
          type: "completed",
          modelId: task.model.id,
          version: task.model.version,
          installedAt: new Date().toISOString(),
        });

        this.cancelRequested.delete(task.model.id);
        this.activeDownload = null;
        return;
      } catch (error) {
        const isCancelled = abortController.signal.aborted;
        const normalizedError =
          error instanceof Error ? error : new Error("Failed to download model.");
        // The attempt is over: clear the active slot before notifying listeners
        // so a cancel from the `failed` event lands in the retry gap instead of
        // aborting an already-finished attempt.
        this.activeDownload = null;

        if (isCancelled) {
          if (!this.deliberatelyRemovedModelIds.has(task.model.id)) {
            this.writeIncompleteManifest(task.model);
          }
          this.cancelRequested.delete(task.model.id);
          this.retryGapModelIds.delete(task.model.id);
          this.emit({
            type: "cancelled",
            modelId: task.model.id,
          });
          return;
        }

        const willRetry = attempt < MAX_RETRY_ATTEMPTS && shouldRetryDownload(normalizedError);
        const errorCode = (normalizedError as Error & { code?: string }).code;
        this.emit({
          type: "failed",
          modelId: task.model.id,
          message: normalizedError.message,
          attempt,
          willRetry,
          code: isModelDownloadErrorCode(errorCode) ? errorCode : undefined,
        });

        this.writeIncompleteManifest(task.model);

        if (willRetry) {
          this.retryGapModelIds.add(task.model.id);
          continue;
        }

        this.cancelRequested.delete(task.model.id);
        break;
      }
    }
  }

  private ensureEnoughDiskSpace(requiredBytes: number): void {
    warnIfInsufficientDiskSpace(this.getDiskSpaceInfo(), requiredBytes);
  }

  private writeIncompleteManifest(model: DesktopDownloadModelPayload, origin = "download"): void {
    // An uninstall during the download removed the directory on purpose;
    // recreating it with an "incomplete" manifest resurrected a broken model.
    if (this.deliberatelyRemovedModelIds.has(model.id)) {
      return;
    }

    persistIncompleteManifest(this.userDataDirProvider(), model, origin);
  }

  private writeInstalledManifest(model: DesktopDownloadModelPayload, origin = "download"): void {
    persistInstalledManifest(this.userDataDirProvider(), model, origin);
  }

  private async validateEnhanceOnnxFile(filePath: string): Promise<void> {
    const backendBaseUrl = this.backendBaseUrlProvider().trim();
    if (!backendBaseUrl) {
      throw new Error("Mini backend unavailable to validate the ONNX file.");
    }

    const fileBytes = fs.readFileSync(filePath);
    const formData = new FormData();
    formData.append(
      "file",
      new Blob([fileBytes], { type: "application/octet-stream" }),
      path.basename(filePath),
    );

    const response = await fetch(`${backendBaseUrl}/enhance/validate-model`, {
      method: "POST",
      headers: this.createLocalBackendHeaders(false),
      body: formData,
    });
    if (response.ok) {
      return;
    }

    let detail = "";
    try {
      const payload = (await response.json()) as { detail?: string };
      detail = typeof payload.detail === "string" ? payload.detail : "";
    } catch {
      // no-op
    }
    throw new Error(detail || `Failed to validate ONNX (HTTP ${response.status}).`);
  }

  async importOnnxModel(model: { id: string; name: string; version: string }, sourcePath: string): Promise<DesktopInstalledModelRecord> {
    const normalizedModelId = sanitizeModelId(model.id);
    const normalizedSourcePath = path.resolve(sourcePath);
    if (!fs.existsSync(normalizedSourcePath)) {
      throw new Error("Selected ONNX file was not found.");
    }
    if (path.extname(normalizedSourcePath).toLowerCase() !== ".onnx") {
      throw new Error("Manual import only accepts .onnx files.");
    }

    await this.validateEnhanceOnnxFile(normalizedSourcePath);
    const modelDir = this.getModelDir(normalizedModelId);
    fs.rmSync(modelDir, { recursive: true, force: true });
    fs.mkdirSync(modelDir, { recursive: true });

    const targetPath = path.join(modelDir, ENHANCE_MODEL_FILE_NAME);
    fs.copyFileSync(normalizedSourcePath, targetPath);
    const checksumSHA256 = await checksumFile(targetPath);
    this.writeInstalledManifest(
      {
        id: normalizedModelId,
        name: model.name.trim(),
        version: model.version.trim(),
        downloadUrl: normalizedSourcePath,
        checksumSHA256,
        expectedDownloadBytes: fs.statSync(targetPath).size,
        requiredDiskBytes: fs.statSync(targetPath).size,
        installStrategy: "manual_import",
        runtimeFamily: "onnx",
      },
      "local_import",
    );

    return {
      modelId: normalizedModelId,
      version: model.version.trim(),
      installedAt: JSON.parse(fs.readFileSync(this.getModelManifestPath(normalizedModelId), "utf8")).installedAt,
      checksumSHA256,
      status: "installed",
      origin: "local_import",
      modelDir,
      manifestPath: this.getModelManifestPath(normalizedModelId),
      sizeBytes: fs.statSync(targetPath).size,
    };
  }

  private async downloadAndInstall(
    model: DesktopDownloadModelPayload,
    attempt: number,
    signal: AbortSignal,
  ): Promise<void> {
    this.ensureEnoughDiskSpace(model.requiredDiskBytes);

    // Single source of truth: the mini-backend downloads (with resume,
    // checksum, and a serial queue) and this process only translates the
    // job snapshot into events. Nothing is deleted before the job runs —
    // the preserved .part file allows the download to resume.
    await this.installViaBackendJob(model, attempt, signal);
    this.writeInstalledManifest(model);
  }

  private async installViaBackendJob(
    model: DesktopDownloadModelPayload,
    attempt: number,
    signal: AbortSignal,
  ): Promise<void> {
    await runBackendJobInstall(this.backendBaseUrlProvider().trim(), model, attempt, signal, {
      headers: () => this.createLocalBackendHeaders(true),
      pollIntervalMs: () => this.jobPollIntervalMs,
      maxConsecutivePollFailures: () => this.maxConsecutivePollFailures,
      emit: (event) => this.emit(event),
      validateInstalledModel: (installedModel) => this.validateBackendInstallResult(installedModel),
    });
  }

  private async validateBackendInstallResult(model: DesktopDownloadModelPayload): Promise<void> {
    const modelDir = this.getModelDir(model.id);
    const hasFiles = fs
      .readdirSync(modelDir, { withFileTypes: true })
      .some((entry) => entry.isDirectory() || entry.isFile());
    if (!hasFiles) {
      throw new Error("Model installation finished with no files in the local directory.");
    }
  }

}
