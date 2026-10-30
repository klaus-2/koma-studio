import fs from "node:fs";
import path from "node:path";

import type { Page } from "@playwright/test";

import { desktopCommandChannels } from "../../../../packages/types/src/desktop-api.ts";
import type {
  DesktopDiskSpaceInfo,
  DesktopInstalledModelRecord,
  DesktopModelQueueResult,
} from "../../../../packages/types/src/desktop-api.ts";
import type { ModelManagerEvent } from "../../../../packages/types/src/desktop-events.ts";

const channels = desktopCommandChannels;

const PAYLOAD_FILES: Record<string, string[]> = {
  font_rtdetr_v2: ["detector.onnx"],
  manga_ocr: ["encoder_model.onnx", "decoder_model.onnx", "vocab.txt"],
  "nllb-200-600m-int8": [
    "config.json",
    "model.bin",
    "sentencepiece.bpe.model",
    "shared_vocabulary.txt",
    "special_tokens_map.json",
    "tokenizer.json",
    "tokenizer_config.json",
  ],
  baka_content_cc: ["segmenter.meta"],
  aot: ["aot.onnx"],
};

interface JobSnapshot {
  state: string;
  bytesDownloaded: number;
  totalBytes: number | null;
  speedBytesPerSecond: number;
  percent: number | null;
  error: string | null;
}

const isRecord = (value: unknown): value is Record<string, unknown> =>
  typeof value === "object" && value !== null && !Array.isArray(value);

interface E2eModelDownloadPayload {
  readonly id: string;
  readonly version: string;
  readonly checksumSHA256: string;
  readonly sourceLanguage?: string | null;
  readonly requiredDiskBytes: number;
}

const isE2eModelDownloadPayload = (
  value: unknown,
): value is E2eModelDownloadPayload => {
  if (!isRecord(value)) return false;
  return (
    typeof value.id === "string" &&
    typeof value.version === "string" &&
    typeof value.checksumSHA256 === "string" &&
    typeof value.requiredDiskBytes === "number" &&
    (value.sourceLanguage === undefined ||
      value.sourceLanguage === null ||
      typeof value.sourceLanguage === "string")
  );
};

const parseJobSnapshot = (value: unknown): JobSnapshot => {
  if (!isRecord(value) || typeof value.state !== "string") {
    throw new Error("E2E_BACKEND_BAD_RESPONSE: download job snapshot");
  }
  return {
    state: value.state,
    bytesDownloaded:
      typeof value.bytesDownloaded === "number" ? value.bytesDownloaded : 0,
    totalBytes:
      typeof value.totalBytes === "number" ? value.totalBytes : null,
    speedBytesPerSecond:
      typeof value.speedBytesPerSecond === "number"
        ? value.speedBytesPerSecond
        : 0,
    percent: typeof value.percent === "number" ? value.percent : null,
    error: typeof value.error === "string" ? value.error : null,
  };
};

const safeName = (value: string, fallback: string): string => {
  const normalized = path.basename(value).replace(/[^A-Za-z0-9._-]+/g, "-");
  return normalized.replace(/^[-_.]+|[-_.]+$/g, "") || fallback;
};

const directorySize = (directory: string): number => {
  if (!fs.existsSync(directory)) return 0;
  let total = 0;
  for (const entry of fs.readdirSync(directory, { withFileTypes: true })) {
    const entryPath = path.join(directory, entry.name);
    if (entry.isDirectory()) total += directorySize(entryPath);
    else if (entry.isFile()) total += fs.statSync(entryPath).size;
  }
  return total;
};

const isArrayBuffer = (value: unknown): value is ArrayBuffer =>
  value instanceof ArrayBuffer ||
  Object.prototype.toString.call(value) === "[object ArrayBuffer]";

const encodeWorkspacePayload = (payload: unknown): unknown => {
  if (!isRecord(payload) || !Array.isArray(payload.assets)) return payload;
  return {
    ...payload,
    assets: payload.assets.map((asset) => {
      if (!isRecord(asset)) return asset;
      const buffer = asset.buffer;
      let bytes: Buffer | null = null;
      if (isArrayBuffer(buffer)) {
        bytes = Buffer.from(buffer);
      } else if (ArrayBuffer.isView(buffer)) {
        bytes = Buffer.from(
          buffer.buffer,
          buffer.byteOffset,
          buffer.byteLength,
        );
      } else if (Array.isArray(buffer)) {
        bytes = Buffer.from(buffer);
      }
      if (!bytes) return asset;
      return { ...asset, buffer: { __komaE2EBase64: bytes.toString("base64") } };
    }),
  };
};

const decodeWorkspacePayload = (payload: unknown): unknown => {
  if (!isRecord(payload) || !Array.isArray(payload.assets)) return payload;
  return {
    ...payload,
    assets: payload.assets.map((asset) => {
      if (!isRecord(asset) || !isRecord(asset.buffer)) return asset;
      const encoded = asset.buffer.__komaE2EBase64;
      if (typeof encoded !== "string") return asset;
      const bytes = Buffer.from(encoded, "base64");
      const buffer = bytes.buffer.slice(
        bytes.byteOffset,
        bytes.byteOffset + bytes.byteLength,
      );
      return { ...asset, buffer };
    }),
  };
};

export interface BridgeHostOptions {
  runRoot: string;
  backendUrl: string;
  page: Page;
  workspaceImportPath?: string | null;
}

export class E2eBridgeHost {
  private readonly runRoot: string;
  private readonly backendUrl: string;
  private readonly page: Page;
  private readonly jobs = new Map<
    string,
    { jobId: string; cancelled: boolean }
  >();
  private workspaceImportPath: string | null;

  constructor(options: BridgeHostOptions) {
    this.runRoot = options.runRoot;
    this.backendUrl = options.backendUrl.replace(/\/+$/, "");
    this.page = options.page;
    this.workspaceImportPath = options.workspaceImportPath ?? null;
  }

  setWorkspaceImportPath(filePath: string | null): void {
    this.workspaceImportPath = filePath;
  }

  async handle(channel: string, args: Record<string, unknown>): Promise<unknown> {
    if (channel.startsWith("desktop-models:")) {
      process.stdout.write(`[host] ${channel}\n`);
    }
    switch (channel) {
      case channels.models.listInstalled:
        return this.listInstalled();
      case channels.models.getDiskSpace:
        return this.getDiskSpace();
      case channels.models.checkUpdates:
        return [];
      case channels.models.download: {
        const payload: unknown = args.payload;
        if (!isE2eModelDownloadPayload(payload)) {
          throw new Error("E2E_MODEL_PAYLOAD_INVALID");
        }
        return this.download(payload);
      }
      case channels.models.importOnnx:
        throw new Error("E2E_UNMOCKED_COMMAND: model ONNX import is not used");
      case channels.models.cancel:
        return this.cancel(String(args.modelId ?? ""));
      case channels.models.cancelAll:
        return this.cancelAll();
      case channels.models.uninstall:
        return this.uninstall(String(args.modelId ?? ""));
      case channels.workspace.loadAutosave:
        return this.loadAutosave(this.userId(args.userId));
      case channels.workspace.saveAutosave:
        return this.saveAutosave(
          this.userId(args.userId),
          args.payload,
        );
      case channels.workspace.clearAutosave:
        return this.clearAutosave(this.userId(args.userId));
      case channels.workspace.exportCurrent:
        return this.exportWorkspace(
          String(args.defaultFileName ?? "workspace.koma"),
          args.payload,
        );
      case channels.workspace.importFile:
        return this.importWorkspace();
      case channels.files.saveBlob:
        return this.saveBlob(
          String(args.defaultFileName ?? "export.bin"),
          String(args.dataBase64 ?? ""),
        );
      case channels.runtime.getMiniBackendRuntimeState:
        return null;
      case channels.runtime.listMiniBackendRuntimeArtifacts:
        return [];
      case channels.runtime.installRecommendedMiniBackendRuntime:
      case channels.runtime.installMiniBackendRuntimeProfile:
        return { installed: false };
      case channels.runtime.resetLocalSettings:
      case channels.runtime.restartApp:
        return undefined;
      case channels.locale.getPreferences:
        return { locale: "en" };
      case channels.localBackend.check:
        return true;
      case channels.localBackend.restart:
        return true;
      case channels.logging.sessionLog:
        return undefined;
      case channels.links.openExternal:
      case channels.links.openCommunityLink:
        return undefined;
      case channels.api.auth.config:
        return {
          ok: true,
          status: 200,
          payload: {
            captchaEnabled: false,
            emailDeliveryEnabled: false,
            desktopClientEnforced: false,
          },
        };
      case channels.api.auth.session:
        return { ok: true, status: 200, payload: null };
      case channels.api.auth.refreshSession:
        return { ok: true, status: 200, payload: { refreshed: false } };
      case channels.api.auth.login:
      case channels.api.auth.register:
      case channels.api.auth.verifyEmail:
      case channels.api.auth.confirmEmail:
      case channels.api.auth.forgotPassword:
      case channels.api.auth.resetPassword:
      case channels.api.auth.setTravelToken:
      case channels.api.auth.createTravelToken:
        return {
          ok: false,
          status: 503,
          payload: null,
          error: "Authentication is disabled in the E2E harness.",
        };
      case channels.api.auth.signOut:
        return undefined;
      case channels.api.fonts.list:
        return { system: [], custom: [] };
      case channels.api.fonts.import:
      case channels.api.fonts.install:
      case channels.api.fonts.uninstall:
        return {};
      case channels.api.llmProfiles.list:
        return [];
      case channels.api.llmProfiles.save:
      case channels.api.llmProfiles.remove:
      case channels.api.llmProfiles.resolve:
        return {};
      case channels.api.blogger.loadConfig:
      case channels.api.blogger.saveConfig:
        return { config: {}, secureStorage: false };
      case channels.api.blogger.testConnection:
        return { ok: false, message: "Blogger is not configured in E2E." };
      case channels.api.blogger.uploadImages:
        return { items: [], optimizerApplied: false };
      case channels.api.blogger.publishPost:
        return {};
      case channels.api.imgur.loadConfig:
      case channels.api.imgur.saveConfig:
        return {
          config: {},
          secureStorage: false,
          rateLimit: { remaining: 0, resetAt: null },
        };
      case channels.api.imgur.uploadImages:
        return { items: [], rateLimit: { remaining: 0, resetAt: null } };
      case channels.api.discordWebhook.send:
        return { ok: false };
      case channels.api.bugReport.prepare:
      case channels.api.bugReport.submit:
        return {};
      case channels.api.identity.hardwareId:
        return "e2e-hardware-id";
      case channels.api.identity.machineFingerprint:
        return "e2e-machine-fingerprint";
      case channels.api.integrations.deepLinkExtract:
      case channels.api.integrations.deepLinkRoute:
        return null;
      case channels.api.integrations.deepLinkFormat:
        return "";
      case channels.api.integrations.deepLinkNavigate:
        return undefined;
      case channels.api.security.certPinningSnapshot:
        return {};
      case channels.images.listFolder:
        return { files: [], nextCursor: null };
      case channels.images.allowPaths:
        return [];
      case channels.discordRPC.setEnabled:
        return false;
      case channels.discordRPC.isConnected:
      case channels.discordRPC.isEnabled:
        return false;
      case channels.discordRPC.getPresetAssets:
        return {};
      default:
        if (channel.startsWith("desktop-discord-rpc:")) {
          return undefined;
        }
        throw new Error(`E2E_UNMOCKED_COMMAND: ${channel}`);
    }
  }

  private userId(value: unknown): string | null {
    return typeof value === "string" && value.trim() ? value.trim() : null;
  }

  private modelsRoot(): string {
    return path.join(this.runRoot, "models");
  }

  private modelDir(modelId: string): string {
    return path.join(this.modelsRoot(), modelId);
  }

  private listInstalled(): DesktopInstalledModelRecord[] {
    const root = this.modelsRoot();
    if (!fs.existsSync(root)) return [];
    const records: DesktopInstalledModelRecord[] = [];
    for (const entry of fs.readdirSync(root, { withFileTypes: true })) {
      if (!entry.isDirectory()) continue;
      const manifestPath = path.join(root, entry.name, "manifest.json");
      if (!fs.existsSync(manifestPath)) continue;
      const parsed: unknown = JSON.parse(
        fs.readFileSync(manifestPath, "utf8"),
      );
      if (!isRecord(parsed) || parsed.status !== "installed") continue;
      records.push({
        modelId: String(parsed.modelId ?? entry.name),
        version: String(parsed.version ?? "1.0.0"),
        installedAt: String(parsed.installedAt ?? new Date().toISOString()),
        checksumSHA256: String(parsed.checksumSHA256 ?? ""),
        status: "installed",
        origin: typeof parsed.origin === "string" ? parsed.origin : "download",
        modelDir: path.join(root, entry.name),
        manifestPath,
        sizeBytes: directorySize(path.join(root, entry.name)),
      });
    }
    return records;
  }

  private getDiskSpace(): DesktopDiskSpaceInfo {
    const stats = fs.statfsSync(this.runRoot);
    return {
      freeBytes: Number(stats.bavail) * Number(stats.bsize),
      totalBytes: Number(stats.blocks) * Number(stats.bsize),
      path: this.runRoot,
    };
  }

  private async download(
    payload: E2eModelDownloadPayload,
  ): Promise<DesktopModelQueueResult> {
    process.stdout.write(`[host] download request ${payload?.id ?? "<missing>"}\n`);
    if (!payload || !PAYLOAD_FILES[payload.id]) {
      throw new Error(`E2E_MODEL_PAYLOAD_UNKNOWN: ${payload?.id ?? "<missing>"}`);
    }
    const response = await fetch(`${this.backendUrl}/models/downloads`, {
      method: "POST",
      headers: { "content-type": "application/json" },
      body: JSON.stringify({
        model_id: payload.id,
        source_language: payload.sourceLanguage ?? null,
        required_disk_bytes: payload.requiredDiskBytes,
      }),
    });
    if (!response.ok) {
      throw new Error(
        `E2E_BACKEND_DOWNLOAD_FAILED: ${payload.id} HTTP ${response.status}`,
      );
    }
    const created: unknown = await response.json();
    if (!isRecord(created) || typeof created.jobId !== "string") {
      throw new Error("E2E_BACKEND_BAD_RESPONSE: missing jobId");
    }
    const job = { jobId: created.jobId, cancelled: false };
    this.jobs.set(payload.id, job);
    void this.pollDownload(payload, job);
    return { queued: true, queueLength: 1 };
  }

  private async pollDownload(
    payload: E2eModelDownloadPayload,
    job: { jobId: string; cancelled: boolean },
  ): Promise<void> {
    await this.emit({ type: "started", modelId: payload.id, attempt: 1 });
    let lastState = "";
    while (!job.cancelled) {
      await new Promise((resolve) => setTimeout(resolve, 500));
      let snapshot: JobSnapshot;
      try {
        const response = await fetch(
          `${this.backendUrl}/models/downloads/${job.jobId}`,
        );
        if (!response.ok) {
          throw new Error(`HTTP ${response.status}`);
        }
        snapshot = parseJobSnapshot(await response.json());
      } catch (error) {
        await this.emitFailed(payload.id, error);
        return;
      }
      if (snapshot.state !== lastState) {
        lastState = snapshot.state;
      }
      if (snapshot.state === "downloading") {
        await this.emit({
          type: "progress",
          modelId: payload.id,
          bytesDownloaded: snapshot.bytesDownloaded,
          totalBytes: snapshot.totalBytes,
          speedBytesPerSecond: snapshot.speedBytesPerSecond,
          percent: snapshot.percent,
          attempt: 1,
        });
        continue;
      }
      if (snapshot.state === "verifying") {
        await this.emit({ type: "verifying", modelId: payload.id });
        continue;
      }
      if (snapshot.state === "ready") {
        try {
          this.assertPayload(payload.id);
          const manifest = this.writeManifest(payload);
          await this.emit({
            type: "completed",
            modelId: payload.id,
            version: manifest.version,
            installedAt: manifest.installedAt,
          });
        } catch (error) {
          await this.emitFailed(payload.id, error);
        }
        return;
      }
      if (snapshot.state === "cancelled") {
        await this.emit({ type: "cancelled", modelId: payload.id });
        return;
      }
      if (snapshot.state === "error") {
        await this.emitFailed(
          payload.id,
          new Error(snapshot.error ?? "Model download failed."),
        );
        return;
      }
    }
    await this.emit({ type: "cancelled", modelId: payload.id });
  }

  private assertPayload(modelId: string): void {
    const expected = PAYLOAD_FILES[modelId];
    if (!expected) {
      throw new Error(`E2E_MODEL_PAYLOAD_UNKNOWN: ${modelId}`);
    }
    for (const file of expected) {
      if (!fs.existsSync(path.join(this.modelDir(modelId), file))) {
        throw new Error(
          `E2E_MODEL_PAYLOAD_INCOMPLETE: ${modelId} missing ${file}`,
        );
      }
    }
  }

  private writeManifest(payload: E2eModelDownloadPayload): {
    version: string;
    installedAt: string;
  } {
    const installedAt = new Date().toISOString();
    const directory = this.modelDir(payload.id);
    fs.mkdirSync(directory, { recursive: true });
    const manifest = {
      modelId: payload.id,
      version: payload.version,
      installedAt,
      checksumSHA256: payload.checksumSHA256,
      status: "installed",
      origin: "download",
      sizeBytes: directorySize(directory),
    };
    fs.writeFileSync(
      path.join(directory, "manifest.json"),
      JSON.stringify(manifest, null, 2),
      "utf8",
    );
    return { version: payload.version, installedAt };
  }

  private async emitFailed(modelId: string, error: unknown): Promise<void> {
    await this.emit({
      type: "failed",
      modelId,
      message: error instanceof Error ? error.message : String(error),
      attempt: 1,
      willRetry: false,
    });
  }

  private async emit(event: ModelManagerEvent): Promise<void> {
    await this.page
      .evaluate(
        (payload: ModelManagerEvent) => {
          window.__e2eDispatchModelEvent?.(payload);
        },
        event,
      )
      .catch(() => undefined);
  }

  private async cancel(modelId: string): Promise<unknown> {
    const job = this.jobs.get(modelId);
    if (!job) return { cancelled: false };
    job.cancelled = true;
    await fetch(
      `${this.backendUrl}/models/downloads/${job.jobId}/cancel`,
      { method: "POST" },
    ).catch(() => undefined);
    return { cancelled: true };
  }

  private async cancelAll(): Promise<unknown> {
    for (const modelId of this.jobs.keys()) {
      await this.cancel(modelId);
    }
    return { cancelled: true };
  }

  private uninstall(modelId: string): unknown {
    fs.rmSync(this.modelDir(modelId), { recursive: true, force: true });
    return { removed: true };
  }

  private workspaceDirectory(): string {
    const directory = path.join(this.runRoot, "workspace");
    fs.mkdirSync(directory, { recursive: true });
    return directory;
  }

  private autosavePath(userId: string | null): string {
    return path.join(
      this.workspaceDirectory(),
      `autosave.${safeName(userId ?? "guest", "guest")}.json`,
    );
  }

  private loadAutosave(userId: string | null): unknown {
    const filePath = this.autosavePath(userId);
    if (!fs.existsSync(filePath)) return { found: false };
    return {
      found: true,
      path: filePath,
      payload: decodeWorkspacePayload(
        JSON.parse(fs.readFileSync(filePath, "utf8")),
      ),
    };
  }

  private saveAutosave(userId: string | null, payload: unknown): unknown {
    const filePath = this.autosavePath(userId);
    fs.writeFileSync(
      filePath,
      JSON.stringify(encodeWorkspacePayload(payload)),
      "utf8",
    );
    return { saved: true, path: filePath };
  }

  private clearAutosave(userId: string | null): unknown {
    fs.rmSync(this.autosavePath(userId), { force: true });
    return { cleared: true };
  }

  private exportWorkspace(
    defaultFileName: string,
    payload: unknown,
  ): unknown {
    const fileName = safeName(defaultFileName, "workspace.koma");
    const filePath = path.join(this.workspaceDirectory(), fileName);
    fs.writeFileSync(
      filePath,
      JSON.stringify(encodeWorkspacePayload(payload)),
      "utf8",
    );
    return { cancelled: false, filePath };
  }

  private importWorkspace(): unknown {
    const filePath =
      this.workspaceImportPath ??
      process.env.E2E_WORKSPACE_IMPORT_PATH ??
      null;
    if (!filePath || !fs.existsSync(filePath)) {
      return { cancelled: true };
    }
    return {
      cancelled: false,
      filePath,
      payload: decodeWorkspacePayload(
        JSON.parse(fs.readFileSync(filePath, "utf8")),
      ),
    };
  }

  private saveBlob(defaultFileName: string, dataBase64: string): unknown {
    const directory = path.join(this.runRoot, "exports");
    fs.mkdirSync(directory, { recursive: true });
    const name = safeName(defaultFileName, "export.bin");
    const extension = path.extname(name);
    const stem = path.basename(name, extension);
    let filePath = path.join(directory, name);
    for (let index = 2; fs.existsSync(filePath); index += 1) {
      filePath = path.join(directory, `${stem}-${index}${extension}`);
    }
    // Rename-based publish so pollers never observe a partially written blob.
    const temporary = `${filePath}.${process.pid}.part`;
    fs.writeFileSync(temporary, Buffer.from(dataBase64, "base64"));
    fs.renameSync(temporary, filePath);
    return { cancelled: false, filePath };
  }
}
