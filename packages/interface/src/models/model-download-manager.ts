import { toDesktopDownloadPayload } from "./model-storage";
import type {
  ModelManagerEvent,
  TranslationModel,
} from "./types";

import { desktopBridge } from "@/lib/desktop-bridge";
type ModelManagerListener = (event: ModelManagerEvent) => void;

interface QueuedDownloadEntry {
  model: TranslationModel;
  sourceLanguage?: string;
}

const MAX_ENQUEUE_RETRY = 3;

const wait = (ms: number): Promise<void> =>
  new Promise((resolve) => {
    window.setTimeout(resolve, ms);
  });

export class ModelDownloadManager {
  private readonly queue: QueuedDownloadEntry[] = [];

  private readonly queuedIds = new Set<string>();

  private readonly listeners = new Set<ModelManagerListener>();

  private draining = false;

  private bridgeSubscribed = false;

  constructor() {
    this.subscribeBridgeEvents();
  }

  subscribe(listener: ModelManagerListener): () => void {
    this.listeners.add(listener);
    return () => {
      this.listeners.delete(listener);
    };
  }

  async enqueue(model: TranslationModel, sourceLanguage?: string): Promise<void> {
    if (this.queuedIds.has(model.id)) {
      return;
    }

    this.queue.push({ model, sourceLanguage });
    this.queuedIds.add(model.id);
    this.emit({ type: "queued", modelId: model.id, queueLength: this.queue.length });
    void this.drainQueue();
  }

  async enqueueMany(models: TranslationModel[], sourceLanguage?: string): Promise<void> {
    models.forEach((model) => {
      if (this.queuedIds.has(model.id)) {
        return;
      }
      this.queue.push({ model, sourceLanguage });
      this.queuedIds.add(model.id);
      this.emit({ type: "queued", modelId: model.id, queueLength: this.queue.length });
    });

    void this.drainQueue();
  }

  async cancel(modelId: string): Promise<void> {
    const desktopApi = desktopBridge.desktop?.models;
    if (!desktopApi) {
      return;
    }

    const queueIndex = this.queue.findIndex((item) => item.model.id === modelId);
    if (queueIndex >= 0) {
      this.queue.splice(queueIndex, 1);
      this.queuedIds.delete(modelId);
      this.emit({ type: "cancelled", modelId });
      return;
    }

    await desktopApi.cancel(modelId);
  }

  async cancelAll(): Promise<void> {
    const desktopApi = desktopBridge.desktop?.models;
    this.queue.splice(0, this.queue.length);
    this.queuedIds.clear();

    if (!desktopApi) {
      return;
    }

    await desktopApi.cancelAll();
  }

  private emit(event: ModelManagerEvent): void {
    this.listeners.forEach((listener) => {
      try {
        listener(event);
      } catch {
        // Listener failures must not break queue flow.
      }
    });
  }

  private subscribeBridgeEvents(): void {
    if (this.bridgeSubscribed) {
      return;
    }

    const desktopApi = desktopBridge.desktop?.models;
    if (!desktopApi) {
      console.warn("[model-events] bridge absent — events not subscribed");
      return;
    }

    desktopApi.on((event) => {
      if (event.type === "completed" || event.type === "failed" || event.type === "cancelled") {
        this.queuedIds.delete(event.modelId);
      }
      this.emit(event);
    });

    this.bridgeSubscribed = true;
  }

  private async drainQueue(): Promise<void> {
    if (this.draining) {
      return;
    }

    const desktopApi = desktopBridge.desktop?.models;
    if (!desktopApi) {
      while (this.queue.length > 0) {
        const nextQueueEntry = this.queue.shift();
        if (!nextQueueEntry) {
          break;
        }
        const nextModel = nextQueueEntry.model;
        this.queuedIds.delete(nextModel.id);
        this.emit({
          type: "failed",
          modelId: nextModel.id,
          message: "modelDownload.desktopOnly",
          attempt: 1,
          willRetry: false,
        });
      }
      return;
    }

    this.draining = true;
    try {
      while (this.queue.length > 0) {
        const nextQueueEntry = this.queue.shift();
        if (!nextQueueEntry) {
          continue;
        }
        const nextModel = nextQueueEntry.model;

        const payload = toDesktopDownloadPayload(nextModel, {
          sourceLanguage: nextQueueEntry.sourceLanguage,
        });
        let lastError: unknown = null;

        for (let attempt = 1; attempt <= MAX_ENQUEUE_RETRY; attempt += 1) {
          try {
            await desktopApi.download(payload);
            this.emit({ type: "started", modelId: nextModel.id, attempt });
            break;
          } catch (error) {
            lastError = error;
            const willRetry = attempt < MAX_ENQUEUE_RETRY;
            this.emit({
              type: "failed",
              modelId: nextModel.id,
              message: error instanceof Error ? error.message : "Failed to queue the download.",
              attempt,
              willRetry,
            });
            if (willRetry) {
              await wait(250 * attempt);
              continue;
            }
          }
        }

        if (lastError && !this.queuedIds.has(nextModel.id)) {
          this.queuedIds.delete(nextModel.id);
        }
      }
    } finally {
      this.draining = false;
    }
  }
}

let sharedModelDownloadManager: ModelDownloadManager | null = null;

export const getModelDownloadManager = (): ModelDownloadManager => {
  if (!sharedModelDownloadManager) {
    sharedModelDownloadManager = new ModelDownloadManager();
  }

  return sharedModelDownloadManager;
};
