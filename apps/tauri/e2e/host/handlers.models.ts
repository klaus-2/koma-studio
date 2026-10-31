import fs from "node:fs";
import path from "node:path";

import type { Page } from "@playwright/test";

import type {
  DesktopDiskSpaceInfo,
  DesktopInstalledModelRecord,
  DesktopModelQueueResult,
} from "../../../../packages/types/src/desktop-api.ts";
import type { ModelManagerEvent } from "../../../../packages/types/src/desktop-events.ts";

import { isRecord } from "./util.ts";

export const PAYLOAD_FILES: Record<string, string[]> = {
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

export interface E2eModelDownloadPayload {
  readonly id: string;
  readonly version: string;
  readonly checksumSHA256: string;
  readonly sourceLanguage?: string | null;
  readonly requiredDiskBytes: number;
}

export const isE2eModelDownloadPayload = (
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

interface JobSnapshot {
  state: string;
  bytesDownloaded: number;
  totalBytes: number | null;
  speedBytesPerSecond: number;
  percent: number | null;
  error: string | null;
}

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

/** Model-manager command handlers: real downloads against the mini backend. */
export class ModelHandlers {
  private readonly runRoot: string;
  private readonly backendUrl: string;
  private readonly page: Page;
  private readonly jobs = new Map<
    string,
    { jobId: string; cancelled: boolean }
  >();

  constructor(options: { runRoot: string; backendUrl: string; page: Page }) {
    this.runRoot = options.runRoot;
    this.backendUrl = options.backendUrl.replace(/\/+$/, "");
    this.page = options.page;
  }

  listInstalled(): DesktopInstalledModelRecord[] {
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

  getDiskSpace(): DesktopDiskSpaceInfo {
    const stats = fs.statfsSync(this.runRoot);
    return {
      freeBytes: Number(stats.bavail) * Number(stats.bsize),
      totalBytes: Number(stats.blocks) * Number(stats.bsize),
      path: this.runRoot,
    };
  }

  async download(
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

  async cancel(modelId: string): Promise<unknown> {
    const job = this.jobs.get(modelId);
    if (!job) return { cancelled: false };
    job.cancelled = true;
    await fetch(
      `${this.backendUrl}/models/downloads/${job.jobId}/cancel`,
      { method: "POST" },
    ).catch(() => undefined);
    return { cancelled: true };
  }

  async cancelAll(): Promise<unknown> {
    for (const modelId of this.jobs.keys()) {
      await this.cancel(modelId);
    }
    return { cancelled: true };
  }

  uninstall(modelId: string): unknown {
    fs.rmSync(this.modelDir(modelId), { recursive: true, force: true });
    return { removed: true };
  }

  private modelsRoot(): string {
    return path.join(this.runRoot, "models");
  }

  private modelDir(modelId: string): string {
    return path.join(this.modelsRoot(), modelId);
  }

  private async pollDownload(
    payload: E2eModelDownloadPayload,
    job: { jobId: string; cancelled: boolean },
  ): Promise<void> {
    await this.emit({ type: "started", modelId: payload.id, attempt: 1 });
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
}
