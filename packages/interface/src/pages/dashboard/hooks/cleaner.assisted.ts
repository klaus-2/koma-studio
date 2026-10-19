import { AIO_STAGE_LABELS } from '../../../constants/dashboard.constants';
import {
  runCleanImageStage,
  runDetectTextStage,
  runRecognizeTextStage,
  runSegmentTextStage,
  type StageRunNotice,
} from '../../../aio-stages';
import {
  blobToDataUrl,
  buildAioSelectionMapFromDetections,
  cloneAioRegions,
  cloneRenderStyle,
} from '../../../utils/dashboard.utils';
import {
  hasAnyLlmCapability,
  inferLlmCapabilitiesForModelSelection,
  isCustomModelSelectionKey,
  isCloudOcrModelKey,
  requiresCustomLlmApiKey,
} from '../../../utils/customLlm';
import { runConcurrentBatch } from '../../../utils/concurrentBatch';
import { useCleanerStore } from '../stores/cleaner-store';
import type {
  AioTextRegion,
  CleanerRunMeta,
  LoadedImage,
  RuntimeExecutionNotice,
} from '../../../types/dashboard.types';
import type { CleanerRunContext } from './cleaner.types';
import { scheduleNoticeClear } from './cleaner.types';


export async function runAssistedCleanerWorkflow(ctx: CleanerRunContext): Promise<void> {
  const {
    images,
    localApiUrl,
    detectSelectionKey,
    ocrSelectionKey,
    segmentSelectionKey,
    cleanSelectionKey,
    sourceLanguage,
    llmSettings,
    maskDilation,
    hdStrategy,
    hdResizeLimit,
    hdCropMargin,
    hdCropTriggerSize,
    effectiveBatchConcurrency,
    minRegionSize,
    modelEntries,
    selectedCustomOcrProfile,
    discord,
    validateManualLocalStageModel,
    getAioStageOption,
    parseApiError,
    registerDownloads,
    recordProcessedPages,
    emitProcessStartWebhook,
    emitProcessCompleteWebhook,
    emitProcessErrorWebhook,
    syncDiscordForTab,
    setCleanerDetectionsByImage,
    setCleanerSelectedRegionByImage,
    setCleanerProcessedBaseByImage,
    setCleanerRunMetaByImage,
    setCleanerManualImageEditsByImage,
    setCleanerHealingBusyByImage,
    setProcessing,
    setProgress,
    setStatusMessage,
    setRuntimeExecutionNotice,
    onRunComplete,
    t,
  } = ctx;

  let selectedDetectorKey = detectSelectionKey;
  let selectedOcrKey = ocrSelectionKey;
  const selectedSegmentKey = segmentSelectionKey;
  const selectedCleanKey = cleanSelectionKey;
  const selectedOcrOption = getAioStageOption('recognizeText', selectedOcrKey);
  const useCloudOcr = isCloudOcrModelKey(selectedOcrKey);
  const useLlmSettingsForOcr = useCloudOcr && hasAnyLlmCapability(
    selectedOcrOption?.llm_capabilities ?? inferLlmCapabilitiesForModelSelection('ocr', selectedOcrKey),
  );

  if (!validateManualLocalStageModel('detectText', AIO_STAGE_LABELS.detectText, selectedDetectorKey)) {
    return;
  }
  if (modelEntries[selectedOcrKey]) {
    if (!validateManualLocalStageModel('recognizeText', AIO_STAGE_LABELS.recognizeText, selectedOcrKey)) {
      return;
    }
  } else {
    if (!selectedOcrOption) {
      setStatusMessage(t('cleanerActions.selectValidOcrModel'));
      return;
    }
    if (!selectedOcrOption.implemented) {
      setStatusMessage(t('aioModel.status.inRoadmap', { name: selectedOcrOption.name }));
      return;
    }
    if (!selectedOcrOption.available) {
      setStatusMessage(t('aioModel.status.requiresConfig', { name: selectedOcrOption.name }));
      return;
    }
    if (isCustomModelSelectionKey(selectedOcrKey) && !selectedCustomOcrProfile) {
      setStatusMessage('Select or save a Custom AI OCR profile before running the Cleaner.');
      return;
    }
    if (
      isCustomModelSelectionKey(selectedOcrKey)
      && selectedCustomOcrProfile
      && requiresCustomLlmApiKey(selectedCustomOcrProfile.apiBase)
      && !selectedCustomOcrProfile.apiKey.trim()
    ) {
      setStatusMessage('This OCR provider requires an API key. Configure the key before running.');
      return;
    }
  }
  if (!validateManualLocalStageModel('segmentText', AIO_STAGE_LABELS.segmentText, selectedSegmentKey)) {
    return;
  }
  if (!validateManualLocalStageModel('cleanImage', AIO_STAGE_LABELS.cleanImage, selectedCleanKey)) {
    return;
  }

  setCleanerManualImageEditsByImage({});
  setCleanerHealingBusyByImage({});
  setProcessing(true);
  setProgress(0);
  setStatusMessage(
    effectiveBatchConcurrency > 1
      ? `Executando Cleaner Assistido em lote com ${effectiveBatchConcurrency} threads...`
      : 'Executando Cleaner Assistido em lote...',
  );
  emitProcessStartWebhook('Cleaner Assistido', images.length, {
    threads: effectiveBatchConcurrency,
    modelo_ocr: selectedOcrKey,
    modelo_segmentacao: selectedSegmentKey,
    modelo_limpeza: selectedCleanKey,
    idioma_ocr: sourceLanguage,
  });
  await discord.setPreset('cleaner_redraw_mode', {
    details: t('discord.presence.cleaner.details'),
    state: t('discord.presence.cleaner.state.basic'),
  });

  try {
    const results = await runConcurrentBatch({
      items: images,
      concurrency: effectiveBatchConcurrency,
      worker: async ({ item: imgData, index }: { item: LoadedImage; index: number }) => {
        await discord.setPreset('batch_mode', {
          details: t('discord.presence.batch.fileDetails', { fileName: imgData.file.name }),
          state: t('discord.presence.batch.state', { current: index + 1, total: images.length }),
        });

        const executionNotices: string[] = [];
        const stageRuntime = { localApiUrl };
        const pushNotice = (notice: StageRunNotice | null): void => {
          if (notice) {
            executionNotices.push(notice.detail);
            setRuntimeExecutionNotice(notice as RuntimeExecutionNotice);
          }
        };

        const detectDone = await runDetectTextStage(
          {
            image: imgData,
            modelKey: selectedDetectorKey,
            sourceLanguage,
            minRegionSize,
          },
          stageRuntime,
          {
            stageLabel: AIO_STAGE_LABELS.detectText,
            failurePrefix: `Failed to detect text in "${imgData.file.name}"`,
            parseApiError,
          },
        );
        pushNotice(detectDone.notice);
        const detectDetections = detectDone.value;

        let enrichedDetections = cloneAioRegions(detectDetections, cloneRenderStyle);

        if (detectDetections.length > 0) {
          const ocrDone = await runRecognizeTextStage(
            {
              image: imgData,
              modelKey: selectedOcrKey,
              sourceLanguage,
              regions: detectDetections,
              llmSettings: useLlmSettingsForOcr ? llmSettings : null,
              customProfile: useLlmSettingsForOcr ? selectedCustomOcrProfile : null,
            },
            stageRuntime,
            {
              stageLabel: AIO_STAGE_LABELS.recognizeText,
              failurePrefix: `Failed to recognize text in "${imgData.file.name}"`,
              parseApiError,
            },
          );
          pushNotice(ocrDone.notice);
          enrichedDetections = ocrDone.value;
        }

        const segmentInputRegions = enrichedDetections.length > 0 ? enrichedDetections : detectDetections;
        let segmentDetections = cloneAioRegions(segmentInputRegions, cloneRenderStyle);
        if (segmentInputRegions.length > 0) {
          const segmentDone = await runSegmentTextStage(
            {
              image: imgData,
              modelKey: selectedSegmentKey,
              regions: segmentInputRegions,
              fallbackOcrModelKey: selectedOcrKey,
              fallbackTranslatorModelKey: '',
            },
            stageRuntime,
            {
              stageLabel: AIO_STAGE_LABELS.segmentText,
              failurePrefix: `Failed to segment text in "${imgData.file.name}"`,
              parseApiError,
            },
          );
          pushNotice(segmentDone.notice);
          segmentDetections = segmentDone.value;
        }

        const cleanInputRegions = segmentDetections.length > 0 ? segmentDetections : detectDetections;
        const manualEditState =
          useCleanerStore.getState().cleanerManualImageEditsByImage[imgData.id];
        const cleanDone = await runCleanImageStage(
          {
            image: imgData,
            modelKey: selectedCleanKey,
            regions: cleanInputRegions,
            fallbackOcrModelKey: selectedOcrKey,
            fallbackSegmentModelKey: selectedSegmentKey,
            options: {
              maskDilation,
              hdStrategy,
              hdResizeLimit,
              hdCropMargin,
              hdCropTriggerSize,
              brushDataUrl: manualEditState?.segmentBrushDataUrl ?? null,
            },
          },
          stageRuntime,
          {
            stageLabel: AIO_STAGE_LABELS.cleanImage,
            failurePrefix: `Failed to clean "${imgData.file.name}"`,
            parseApiError,
          },
        );
        pushNotice(cleanDone.notice);
        const blob = cleanDone.value;
        if (!blob.type.startsWith('image/')) {
          throw new Error(t('cleanerActions.invalidCleanResponseNamed', { name: imgData.file.name }));
        }

        return {
          imageId: imgData.id,
          fileName: `koma-studio-cleaner-clean-${imgData.file.name.replace(/\s+/g, '-')}.png`,
          blob,
          baseImageDataUrl: await blobToDataUrl(blob),
          regions: cloneAioRegions(segmentDetections, cloneRenderStyle),
          detectCount: detectDetections.length,
          ocrCount: enrichedDetections.filter((region) => (region.recognizedText ?? '').trim().length > 0).length,
          segmentedCount: segmentDetections.filter((region) => (
            (region.mergedSegmentBoxes?.length ?? region.segmentBoxes?.length ?? 0) > 0
          )).length,
          executionNotices,
        };
      },
      onProgress: ({ completed }: { completed: number }) => {
        setProgress((completed / images.length) * 100);
      },
    });

    const outputs = results.map((result) => ({
      fileName: result.fileName,
      blob: result.blob,
      sourceImageId: result.imageId,
    }));
    registerDownloads(outputs, 'cleaner');

    const nextDetections: Record<string, AioTextRegion[]> = {};
    const nextSelections: Record<string, string | null> = {};
    const nextBaseByImage: Record<string, string> = {};
    const nextMeta: Record<string, CleanerRunMeta> = {};
    let totalDetected = 0;
    let totalRecognized = 0;
    let totalSegmented = 0;
    let processedPagesCount = 0;
    const executionNotices = Array.from(new Set(results.flatMap((result) => result.executionNotices ?? [])));

    results.forEach((result) => {
      nextDetections[result.imageId] = cloneAioRegions(result.regions, cloneRenderStyle);
      nextSelections[result.imageId] = buildAioSelectionMapFromDetections({ [result.imageId]: result.regions })[result.imageId] ?? null;
      nextBaseByImage[result.imageId] = result.baseImageDataUrl;
      nextMeta[result.imageId] = {
        detected: result.detectCount > 0,
        ocrCount: result.ocrCount,
        segmentedCount: result.segmentedCount,
        cleaned: true,
        detectModelKey: selectedDetectorKey,
        ocrModelKey: selectedOcrKey,
        segmentModelKey: selectedSegmentKey,
        cleanModelKey: selectedCleanKey,
        sourceLanguage,
      };
      totalDetected += result.detectCount;
      totalRecognized += result.ocrCount;
      totalSegmented += result.segmentedCount;
      processedPagesCount += 1;
    });

    setCleanerDetectionsByImage(nextDetections);
    setCleanerSelectedRegionByImage(nextSelections);
    setCleanerProcessedBaseByImage(nextBaseByImage);
    setCleanerRunMetaByImage(nextMeta);

    if (processedPagesCount > 0) {
      recordProcessedPages(processedPagesCount);
    }
    emitProcessCompleteWebhook('Cleaner Assistido', images.length, {
      imagens_limpas: outputs.length,
      regioes_detectadas: totalDetected,
      textos_reconhecidos: totalRecognized,
      regioes_segmentadas: totalSegmented,
      threads: effectiveBatchConcurrency,
    });
    const doneMessage = t('cleanerActions.assistedDone', { images: outputs.length, detected: totalDetected, recognized: totalRecognized, segmented: totalSegmented });
    setStatusMessage(executionNotices.length > 0 ? `${doneMessage} ${executionNotices.join(' ')}` : doneMessage);
    onRunComplete?.();
    if (executionNotices.length > 0) {
      scheduleNoticeClear(() => setRuntimeExecutionNotice(null));
    }
  } catch (error) {
    emitProcessErrorWebhook('Cleaner Assistido', images.length, error, {
      threads: effectiveBatchConcurrency,
    });
    if (
      (error instanceof DOMException && error.name === 'TimeoutError')
      || (error instanceof Error && error.name === 'TimeoutError')
    ) {
      setStatusMessage('Tempo limite excedido durante o Cleaner Assistido. O backend local demorou demais para responder.');
    } else {
      setStatusMessage(error instanceof Error ? error.message : 'Failed to clean the images.');
    }
  } finally {
    setProcessing(false);
    setProgress(0);
    void syncDiscordForTab();
  }
}


