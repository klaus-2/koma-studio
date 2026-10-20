import type { AioStageOption } from '../../../models/aioStageCatalog';
import type { DiscordActivityPreset } from '../../../types';
import type { LlmRequestSettings } from '../../../utils/customLlm';
import type {
  AioTextRegion,
  CleanerRunMeta,
  LoadedImage,
} from '../../../types/dashboard.types';
import { useI18n } from '../../../i18n';
import type { CleanerStoreBits } from './cleaner.runtime';

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
  modelEntries: Record<string, { status: string; model: { id: string; name: string } } | null | undefined>;
  selectedCustomOcrProfile: CustomProfileLike | null;
  discord: DiscordLike;
  ensureVerifiedEmailOrNotify: () => boolean;
  openModelManagerForStage: (stage: string, options?: Record<string, unknown>) => void;
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

export type { CleanerStoreBits };

export type CleanerRunContext = UseCleanerActionsArgs &
  CleanerStoreBits & {
    t: ReturnType<typeof useI18n>['t'];
  };

export type { AioTextRegion, CleanerRunMeta };

export type I18nTranslate = ReturnType<typeof useI18n>['t'];
