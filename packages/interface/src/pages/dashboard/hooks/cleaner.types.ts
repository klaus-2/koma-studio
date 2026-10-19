import type { AioStageOption } from '../../../models/aioStageCatalog';
import type { DiscordActivityPreset } from '../../../types';
import type { LlmRequestSettings } from '../../../utils/customLlm';
import type {
  AioTextRegion,
  CleanerRunMeta,
  LoadedImage,
} from '../../../types/dashboard.types';
import { useI18n } from '../../../i18n';
import { useCleanerStore } from '../stores/cleaner-store';
import { useStatusStore } from '../stores/status-store';
import { useUiShellStore } from '../stores/ui-shell-store';

export interface CustomProfileLike {
  apiBase: string;
  apiKey: string;
  model?: string;
}

export interface DiscordLike {
  setPreset: (preset: DiscordActivityPreset, overrides?: Record<string, unknown>) => Promise<void>;
}

export interface CleanerDownloadEntry {
  fileName: string;
  blob: Blob;
  sourceImageId: string;
}

export interface UseCleanerActionsArgs {
  images: LoadedImage[];
  activeImage: LoadedImage | null;
  localApiUrl: string;
  detectSelectionKey: string;
  ocrSelectionKey: string;
  segmentSelectionKey: string;
  cleanSelectionKey: string;
  selectedCleanerCustomProfile: CustomProfileLike | null;
  sourceLanguage: string;
  llmSettings: LlmRequestSettings;
  maskDilation: number;
  hdStrategy: string;
  hdResizeLimit: number;
  hdCropMargin: number;
  hdCropTriggerSize: number;
  effectiveBatchConcurrency: number;
  minRegionSize: number;
  modelEntries: Record<string, unknown>;
  selectedCustomOcrProfile: CustomProfileLike | null;
  discord: DiscordLike;
  ensureVerifiedEmailOrNotify: () => boolean;
  validateManualLocalStageModel: (stageKey: string, stageLabel: string, modelKey: string) => boolean;
  getAioStageOption: (stageKey: 'recognizeText', key: string) => AioStageOption | null;
  parseApiError: (response: Response) => Promise<string>;
  registerDownloads: (items: CleanerDownloadEntry[], scope: 'cleaner') => void;
  recordProcessedPages: (pages: number) => void;
  emitProcessStartWebhook: (processName: string, pages: number, context?: Record<string, unknown>) => void;
  emitProcessCompleteWebhook: (processName: string, pages: number, context?: Record<string, unknown>) => void;
  emitProcessErrorWebhook: (processName: string, pages: number, error: unknown, context?: Record<string, unknown>) => void;
  syncDiscordForTab: () => Promise<void> | void;
  onRunComplete?: () => void;
}

export type CleanerRun = () => Promise<void>;

export type CleanerStoreBits = ReturnType<typeof resolveCleanerRunStores>;

export type CleanerRunContext = UseCleanerActionsArgs &
  CleanerStoreBits & {
    t: ReturnType<typeof useI18n>['t'];
  };

let noticeClearTimer: number | null = null;

export function scheduleNoticeClear(clear: () => void, ms = 4500): void {
  if (noticeClearTimer !== null) {
    window.clearTimeout(noticeClearTimer);
  }
  noticeClearTimer = window.setTimeout(() => {
    noticeClearTimer = null;
    clear();
  }, ms);
}

export function cancelCleanerNoticeTimer(): void {
  if (noticeClearTimer !== null) {
    window.clearTimeout(noticeClearTimer);
    noticeClearTimer = null;
  }
}

export function resolveCleanerRunStores() {
  const cleaner = useCleanerStore.getState();
  const status = useStatusStore.getState();
  const uiShell = useUiShellStore.getState();
  return {
    cleanerMode: cleaner.cleanerMode,
    cleanerAiModelKey: cleaner.cleanerAiModelKey,
    cleanerAiAdditionalInstructions: cleaner.cleanerAiAdditionalInstructions,
    setCleanerDetectionsByImage: cleaner.setCleanerDetectionsByImage,
    setCleanerSelectedRegionByImage: cleaner.setCleanerSelectedRegionByImage,
    setCleanerProcessedBaseByImage: cleaner.setCleanerProcessedBaseByImage,
    setCleanerRunMetaByImage: cleaner.setCleanerRunMetaByImage,
    setCleanerManualImageEditsByImage: cleaner.setCleanerManualImageEditsByImage,
    setCleanerHealingBusyByImage: cleaner.setCleanerHealingBusyByImage,
    setProcessing: uiShell.setProcessing,
    setProgress: uiShell.setProgress,
    setStatusMessage: status.setStatusMessage,
    setRuntimeExecutionNotice: status.setRuntimeExecutionNotice,
  };
}

export type { AioTextRegion, CleanerRunMeta };

export type I18nTranslate = ReturnType<typeof useI18n>['t'];
