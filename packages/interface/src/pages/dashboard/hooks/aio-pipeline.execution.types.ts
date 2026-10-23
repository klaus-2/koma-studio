import type { useAioExecutionPreparation } from '@/hooks/useAioExecutionPreparation';
import type { useAioResultConsolidation } from '@/hooks/useAioResultConsolidation';
import type { useAioSingleImageProcessor } from '@/hooks/useAioSingleImageProcessor';
import type {
  AioPipelineSnapshotKey,
  LoadedImage,
  WebhookMetrics,
} from '@/types/dashboard.types';
import type { AioExecutionScope } from '@/utils/dashboardRenderUtils';

type PreparationArgs = Parameters<typeof useAioExecutionPreparation>[0];
type ProcessorArgs = Parameters<typeof useAioSingleImageProcessor>[0];
type ConsolidationArgs = Parameters<typeof useAioResultConsolidation>[0];

export interface UseAioPipelineExecutionArgs
  extends Pick<
      PreparationArgs,
      | 'effectiveBatchConcurrency'
      | 'modelEntries'
      | 'selectedCustomOcrProfile'
      | 'selectedCustomTranslationProfile'
      | 'getAioStageOption'
      | 'openModelManagerForStage'
      | 'refreshSession'
      | 'getAuthToken'
      | 'setAioManualImageEditsByImage'
      | 'setAioManualHealingBusyByImage'
    >,
    Pick<
      ProcessorArgs,
      'renderDefaultStyle' | 'isDesktopRuntime' | 'localApiUrl'
    >,
    Pick<
      ConsolidationArgs,
      | 'setAioDetectionsByImage'
      | 'setAioSelectedRegionByImage'
      | 'setAioDownloadItems'
      | 'buildAioImageSnapshotIndexMap'
    > {
  readonly aioPipelineStageProgressLabels: Readonly<
    Record<AioPipelineSnapshotKey, string>
  >;

  readonly emitProcessStartWebhook: (
    processMode: string,
    pages: number,
    metrics?: WebhookMetrics,
  ) => void;

  readonly emitProcessCompleteWebhook: (
    processMode: string,
    pages: number,
    metrics?: WebhookMetrics,
  ) => void;

  readonly emitProcessErrorWebhook: (
    processMode: string,
    pages: number,
    error: unknown,
    metrics?: WebhookMetrics,
  ) => void;

  readonly ensureVerifiedEmailOrNotify: () => boolean;
  readonly recordProcessedPages: (pages: number) => void;
  readonly syncDiscordForTab: () => Promise<void> | void;
  readonly tryShowHealingHint: () => void;
  /** Called after an auto run, once the shell is free to switch modes. */
  readonly onAutoRunCompleted: () => void;

  readonly beginAioExecution: (
    scope: AioExecutionScope,
    totalImages: number,
    stageKeys: AioPipelineSnapshotKey[],
  ) => void;

  readonly updateAioExecutionStage: (
    scope: AioExecutionScope,
    stageKey: AioPipelineSnapshotKey,
    image: LoadedImage,
    index: number,
    totalImages: number,
  ) => void;
}
