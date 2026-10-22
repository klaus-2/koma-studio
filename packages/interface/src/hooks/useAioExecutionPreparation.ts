import { useCallback } from 'react';

import { useI18n } from '../i18n';
import {
  ensureStageModelReadiness,
  skipStageCatalog,
  stageCatalogOption,
  type StageReadinessReady,
} from '../aio-stages';
import {
  LOCAL_AIO_BATCH_CHUNK_SIZE,
  resolveBatchCapacity,
} from '@/pages/dashboard/lib/local-aio-batch';
import type { AioStageKey } from '../types/aioModelPresets';
import type { AioStageOption } from '../models/aioStageCatalog';
import type { CustomLlmProfile } from '../utils/customLlm';

interface ModelEntryLike {
  status: string;
  model: {
    id: string;
    name: string;
  };
}

interface UseAioExecutionPreparationArgs {
  imagesCount: number;
  localApiUrl: string;
  aioSteps: Record<string, boolean>;
  aioSrcLang: string;
  aioTgtLang: string;
  detectSelectionKey: string;
  ocrSelectionKey: string;
  translationSelectionKey: string;
  segmentSelectionKey: string;
  cleanSelectionKey: string;
  effectiveBatchConcurrency: number;
  modelEntries: Record<string, ModelEntryLike | undefined>;
  selectedCustomOcrProfile: CustomLlmProfile | null;
  selectedCustomTranslationProfile: CustomLlmProfile | null;
  getAioStageOption: (stageKey: 'recognizeText' | 'getTranslations', key: string) => AioStageOption | null;
  openModelManagerForStage: (stage: AioStageKey, options?: Record<string, unknown>) => void;
  refreshSession: () => Promise<string | null>;
  getAuthToken: () => string | null;
  invalidateAioPipelineHistory: () => void;
  setAioManualImageEditsByImage: (value: Record<string, never>) => void;
  setAioManualHealingBusyByImage: (value: Record<string, never>) => void;
  setProcessing: (value: boolean) => void;
  setProgress: (value: number) => void;
  setStatusMessage: (value: string) => void;
  emitProcessStartWebhook: (processName: string, pages: number, context?: Record<string, unknown>) => void;
}

export function useAioExecutionPreparation({
  imagesCount,
  localApiUrl,
  aioSteps,
  aioSrcLang,
  aioTgtLang,
  detectSelectionKey,
  ocrSelectionKey,
  translationSelectionKey,
  segmentSelectionKey,
  cleanSelectionKey,
  effectiveBatchConcurrency,
  modelEntries,
  selectedCustomOcrProfile,
  selectedCustomTranslationProfile,
  getAioStageOption,
  openModelManagerForStage,
  refreshSession,
  getAuthToken,
  invalidateAioPipelineHistory,
  setAioManualImageEditsByImage,
  setAioManualHealingBusyByImage,
  setProcessing,
  setProgress,
  setStatusMessage,
  emitProcessStartWebhook,
}: UseAioExecutionPreparationArgs) {
  const { t } = useI18n();

  return useCallback(async () => {
    if (imagesCount === 0) return null;
    if (!aioSteps.detectText) {
      setStatusMessage('Enable the "Detect Text" stage to run the AIO pipeline.');
      return null;
    }

    const selectedDetectorKey = detectSelectionKey;
    const selectedOcrKey = ocrSelectionKey;
    const selectedTranslationKey = translationSelectionKey;
    const selectedSegmentKey = segmentSelectionKey;
    const selectedCleanKey = cleanSelectionKey;

    const selectedOcrOption = getAioStageOption('recognizeText', selectedOcrKey);
    const selectedTranslationOption = getAioStageOption('getTranslations', selectedTranslationKey);

    const readinessSink = { setStatusMessage, openModelManagerForStage };
    const ensureReady = (
      args: Parameters<typeof ensureStageModelReadiness>[0],
    ): StageReadinessReady | null => ensureStageModelReadiness(args, readinessSink);

    const detectReadiness = ensureReady({
      stage: 'detectText',
      stageLabel: 'Detectar Texto',
      modelKey: selectedDetectorKey,
      catalog: skipStageCatalog(),
      modelEntries,
      t,
    });
    if (!detectReadiness) {
      return null;
    }

    let useCloudOcr = false;
    let useLlmSettingsForOcr = false;
    if (aioSteps.recognizeText) {
      const ocrReadiness = ensureReady({
        stage: 'recognizeText',
        stageLabel: 'Reconhecer Texto',
        modelKey: selectedOcrKey,
        catalog: stageCatalogOption(selectedOcrOption),
        modelEntries,
        customProfile: selectedCustomOcrProfile,
        t,
      });
      if (!ocrReadiness) {
        return null;
      }
      useCloudOcr = ocrReadiness.useCloud;
      useLlmSettingsForOcr = ocrReadiness.useLlmSettings;
    }

    if (aioSteps.segmentText) {
      const segmentReadiness = ensureReady({
        stage: 'segmentText',
        stageLabel: 'Segmentar Texto',
        modelKey: selectedSegmentKey,
        catalog: skipStageCatalog(),
        modelEntries,
        t,
      });
      if (!segmentReadiness) {
        return null;
      }
    }
    if (aioSteps.cleanImage) {
      const cleanReadiness = ensureReady({
        stage: 'cleanImage',
        stageLabel: 'Clean Image',
        modelKey: selectedCleanKey,
        catalog: skipStageCatalog(),
        modelEntries,
        t,
      });
      if (!cleanReadiness) {
        return null;
      }
    }

    let useCloudTranslation = false;
    let useLlmSettingsForTranslation = false;
    if (aioSteps.getTranslations) {
      const translationReadiness = ensureReady({
        stage: 'getTranslations',
        stageLabel: 'Obter Traduções',
        modelKey: selectedTranslationKey,
        catalog: stageCatalogOption(selectedTranslationOption),
        modelEntries,
        customProfile: selectedCustomTranslationProfile,
        languages: { source: aioSrcLang, target: aioTgtLang },
        t,
      });
      if (!translationReadiness) {
        return null;
      }
      useCloudTranslation = translationReadiness.useCloud;
      useLlmSettingsForTranslation = translationReadiness.useLlmSettings;
    }

    const useLocalBatchPipeline = !(useCloudOcr || useCloudTranslation);

    if (useCloudOcr || useCloudTranslation) {
      const sessionToken = (await refreshSession()) ?? getAuthToken();
      if (!sessionToken) {
        setStatusMessage(t('aioExec.sessionUnavailable'));
        return null;
      }
    }

    // One capacity preflight per run (never per chunk). The local batch and the
    // status message below reuse this single result.
    const capacityOutcome = useLocalBatchPipeline
      ? await resolveBatchCapacity({
          localApiUrl,
          concurrency: effectiveBatchConcurrency,
        })
      : null;
    const runConcurrency = capacityOutcome
      ? capacityOutcome.capacity.effectiveConcurrency
      : effectiveBatchConcurrency;
    const requestedConcurrency = capacityOutcome
      ? capacityOutcome.capacity.requestedConcurrency
      : effectiveBatchConcurrency;
    const threadNote =
      runConcurrency < requestedConcurrency
        ? `${runConcurrency} effective ${runConcurrency === 1 ? 'thread' : 'threads'}`
        : runConcurrency > 1
          ? `${runConcurrency} threads`
          : '';
    const chunkNote =
      useLocalBatchPipeline && imagesCount > LOCAL_AIO_BATCH_CHUNK_SIZE
        ? ' Neighbor-image context applies within each 20-image chunk.'
        : '';

    invalidateAioPipelineHistory();
    setAioManualImageEditsByImage({});
    setAioManualHealingBusyByImage({});
    setProcessing(true);
    setProgress(0);
    const runningStages = ['detecting text'];
    if (aioSteps.recognizeText) runningStages.push('recognizing text');
    if (aioSteps.getTranslations) runningStages.push('translating text');
    if (aioSteps.segmentText) runningStages.push('segmenting text');
    if (aioSteps.cleanImage) runningStages.push('cleaning image');
    if (aioSteps.render) runningStages.push('preparing render');
    setStatusMessage(
      threadNote
        ? `AIO: ${runningStages.join(', ')} on the images with ${threadNote}...${chunkNote}`
        : `AIO: ${runningStages.join(', ')} on the images...${chunkNote}`,
    );
    emitProcessStartWebhook('AIO', imagesCount, {
      etapas: runningStages.join(', '),
      threads: effectiveBatchConcurrency,
      estrategia: useLocalBatchPipeline ? 'local-batch' : 'cloud-fallback',
    });

    const prepared = {
      selectedDetectorKey,
      selectedOcrKey,
      selectedTranslationKey,
      selectedSegmentKey,
      selectedCleanKey,
      selectedOcrOption,
      selectedTranslationOption,
      useCloudOcr,
      useCloudTranslation,
      useLlmSettingsForOcr,
      useLlmSettingsForTranslation,
      runningStages,
    };

    return capacityOutcome
      ? {
          ...prepared,
          useLocalBatchPipeline: true as const,
          batchCapacity: capacityOutcome.capacity,
          capacityFallback: capacityOutcome.fallback,
        }
      : {
          ...prepared,
          useLocalBatchPipeline: false as const,
          batchCapacity: null,
          capacityFallback: false,
        };
  }, [
    aioSrcLang,
    aioTgtLang,
    aioSteps,
    cleanSelectionKey,
    detectSelectionKey,
    effectiveBatchConcurrency,
    emitProcessStartWebhook,
    getAioStageOption,
    getAuthToken,
    imagesCount,
    invalidateAioPipelineHistory,
    localApiUrl,
    modelEntries,
    ocrSelectionKey,
    openModelManagerForStage,
    refreshSession,
    segmentSelectionKey,
    selectedCustomOcrProfile,
    selectedCustomTranslationProfile,
    setAioManualHealingBusyByImage,
    setAioManualImageEditsByImage,
    setProcessing,
    setProgress,
    setStatusMessage,
    t,
    translationSelectionKey,
  ]);
}
