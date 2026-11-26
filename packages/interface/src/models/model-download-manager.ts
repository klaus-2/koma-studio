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

  private bridgeSubscriptionPromise: Promise<boolean> | null = null;

  constructor() {
    void this.ensureBridgeSubscription();
  }

  subscribe(listener: ModelManagerListener): () => void {
    this.listeners.add(listener);
    return () => {
      this.listeners.delete(listener);
    };
  }

  async enqueue(model: TranslationModel, sourceLanguage?: string): Promise<void> {
    void this.ensureBridgeSubscription();
    if (this.queuedIds.has(model.id)) {
      return;
    }

    this.queue.push({ model, sourceLanguage });
    this.queuedIds.add(model.id);
    this.emit({ type: "queued", modelId: model.id, queueLength: this.queue.length });
    void this.drainQueue();
  }

  async enqueueMany(models: TranslationModel[], sourceLanguage?: string): Promise<void> {
    void this.ensureBridgeSubscription();
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

    try {
      await desktopApi.cancel(modelId);
    } catch (error) {
      this.queuedIds.delete(modelId);
      throw error;
    }
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

  markSettled(modelId: string): void {
    this.queuedIds.delete(modelId);
  }

  queuedModelIds(): ReadonlySet<string> {
    return new Set(this.queuedIds);
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

  private ensureBridgeSubscription(): Promise<boolean> {
    if (this.bridgeSubscribed) {
      return Promise.resolve(true);
    }
    if (this.bridgeSubscriptionPromise) {
      return this.bridgeSubscriptionPromise;
    }

    this.bridgeSubscriptionPromise = this.subscribeBridgeEvents().finally(() => {
      this.bridgeSubscriptionPromise = null;
    });
    return this.bridgeSubscriptionPromise;
  }

  private async subscribeBridgeEvents(): Promise<boolean> {
    try {
      const desktopApi = desktopBridge.desktop?.models;
      if (!desktopApi) {
        console.warn("[model-events] bridge absent — events not subscribed");
        return false;
      }

      const subscribed = await desktopApi.on((event) => {
        if (event.type === "completed" || event.type === "failed" || event.type === "cancelled") {
          this.queuedIds.delete(event.modelId);
        }
        this.emit(event);
      });
      this.bridgeSubscribed = subscribed;
      return subscribed;
    } catch {
      return false;
    }
  }

  private async drainQueue(): Promise<void> {
    await this.ensureBridgeSubscription();
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
            lastError = null;
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

        if (lastError) {
          // The download never started, so nothing will ever release this id
          // through a bridge event. Leaving it queued makes every later
          // enqueue for the same model a silent no-op: the button appears
          // dead and nothing is reported.
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
