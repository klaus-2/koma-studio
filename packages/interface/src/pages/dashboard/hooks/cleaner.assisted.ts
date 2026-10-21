import { AIO_STAGE_LABELS } from '../../../constants/dashboard.constants';
import {
  ensureStageModelReadiness,
  resolveUpstreamRegions,
  runCleanImageStage,
  runDetectTextStage,
  runRecognizeTextStage,
  runSegmentTextStage,
  skipStageCatalog,
  stageCatalogOption,
  StageTransportError,
  type StageReadinessReady,
  type StageRegions,
} from '../../../aio-stages';
import {
  blobToDataUrl,
  buildAioSelectionMapFromDetections,
  cloneAioRegions,
  cloneRenderStyle,
} from '../../../utils/dashboard.utils';
import { runConcurrentBatch } from '../../../utils/concurrentBatch';
import { useAioPipelineStore } from '../stores/aio-pipeline-store';
import { useCleanerStore } from '../stores/cleaner-store';
import type {
  AioTextRegion,
  CleanerRunMeta,
  LoadedImage,
} from '../../../types/dashboard.types';
import type { CleanerRunContext } from './cleaner.types';
import { scheduleNoticeClear } from './cleaner.runtime';
import { createAioStageRunSession } from './aio-stage-runner';


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
    openModelManagerForStage,
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
  const readinessSink = { setStatusMessage, openModelManagerForStage };
  const ensureReady = (
    args: Parameters<typeof ensureStageModelReadiness>[0],
  ): StageReadinessReady | null => ensureStageModelReadiness(args, readinessSink);

  const detectReadiness = ensureReady({
    stage: 'detectText',
    stageLabel: AIO_STAGE_LABELS.detectText,
    modelKey: selectedDetectorKey,
    catalog: skipStageCatalog(),
    modelEntries,
    t,
  });
  if (!detectReadiness) {
    return;
  }

  const ocrReadiness = ensureReady({
    stage: 'recognizeText',
    stageLabel: AIO_STAGE_LABELS.recognizeText,
    modelKey: selectedOcrKey,
    catalog: stageCatalogOption(getAioStageOption('recognizeText', selectedOcrKey)),
    modelEntries,
    customProfile: selectedCustomOcrProfile,
    t,
  });
  if (!ocrReadiness) {
    return;
  }
  const useLlmSettingsForOcr = ocrReadiness.useLlmSettings;

  const segmentReadiness = ensureReady({
    stage: 'segmentText',
    stageLabel: AIO_STAGE_LABELS.segmentText,
    modelKey: selectedSegmentKey,
    catalog: skipStageCatalog(),
    modelEntries,
    t,
  });
  if (!segmentReadiness) {
    return;
  }
  const cleanReadiness = ensureReady({
    stage: 'cleanImage',
    stageLabel: AIO_STAGE_LABELS.cleanImage,
    modelKey: selectedCleanKey,
    catalog: skipStageCatalog(),
    modelEntries,
    t,
  });
  if (!cleanReadiness) {
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

        // The signal comes from the shared AIO pipeline AbortController so a
        // stop request aborts in-flight cleaner stage fetches.
        const session = createAioStageRunSession({
          localApiUrl,
          signal: useAioPipelineStore.getState().getActiveAioAbortSignal(),
          collectNotices: true,
          onRuntimeNotice: setRuntimeExecutionNotice,
        });
        const { stageRuntime, executionNotices } = session;

        session.assertNotAborted();
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
        session.pushNotice(detectDone.notice);
        const detectDetections = detectDone.value;
        let stageRegions: StageRegions = {
          detectText: detectDetections,
        };

        let enrichedDetections = cloneAioRegions(detectDetections, cloneRenderStyle);

        if (detectDetections.length > 0) {
          session.assertNotAborted();
          const ocrDone = await runRecognizeTextStage(
            {
              image: imgData,
              modelKey: selectedOcrKey,
              sourceLanguage,
              regions: detectDetections,
              llmSettings: useLlmSettingsForOcr ? llmSettings : null,
              customProfile: useLlmSettingsForOcr ? ocrReadiness.customProfile : null,
            },
            stageRuntime,
            {
              stageLabel: AIO_STAGE_LABELS.recognizeText,
              failurePrefix: `Failed to recognize text in "${imgData.file.name}"`,
              parseApiError,
            },
          );
          session.pushNotice(ocrDone.notice);
          enrichedDetections = ocrDone.value;
          stageRegions = { ...stageRegions, recognizeText: enrichedDetections };
        }

        const segmentInputRegions = resolveUpstreamRegions('segmentText', stageRegions);
        let segmentDetections = cloneAioRegions(segmentInputRegions, cloneRenderStyle);
        if (segmentInputRegions.length > 0) {
          session.assertNotAborted();
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
          session.pushNotice(segmentDone.notice);
          segmentDetections = segmentDone.value;
          stageRegions = { ...stageRegions, segmentText: segmentDetections };
        }

        const cleanInputRegions = resolveUpstreamRegions('cleanImage', stageRegions);
        const manualEditState =
          useCleanerStore.getState().cleanerManualImageEditsByImage[imgData.id];
        session.assertNotAborted();
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
        session.pushNotice(cleanDone.notice);
        const blob = session.ensureStageImageBlob(
          cleanDone.value,
          t('cleanerActions.invalidCleanResponseNamed', { name: imgData.file.name }),
        );

        return {
          imageId: imgData.id,
          fileName: session.buildCleanDownloadName('koma-studio-cleaner-clean', imgData.file.name),
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
    const noticeDetail =
      error instanceof StageTransportError && error.notice
        ? ` ${error.notice.detail}`
        : '';
    if (
      (error instanceof DOMException && error.name === 'TimeoutError')
      || (error instanceof Error && error.name === 'TimeoutError')
    ) {
      setStatusMessage(`Tempo limite excedido durante o Cleaner Assistido. O backend local demorou demais para responder.${noticeDetail}`);
    } else {
      setStatusMessage(error instanceof Error ? `${error.message}${noticeDetail}` : 'Failed to clean the images.');
    }
  } finally {
    setProcessing(false);
    setProgress(0);
    void syncDiscordForTab();
  }
}


