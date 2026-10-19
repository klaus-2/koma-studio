import { AIO_STAGE_LABELS } from '../../../constants/dashboard.constants';
import { fetchWithTimeoutAndRetry } from '../../../utils/http';
import {
  blobToDataUrl,
  buildAioSelectionMapFromDetections,
  cloneAioRegions,
  cloneRenderStyle,
  normalizeDetectedGradient,
  readExecutionRuntimeNotice,
  toApiIntegerBbox,
} from '../../../utils/dashboard.utils';
import { regionsFromDetectPayload } from '../../../utils/detectTextRegions';
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
  DetectApiResponse,
  LoadedImage,
  OcrApiResponse,
  SegmentApiResponse,
} from '../../../types/dashboard.types';
import type { CleanerRunContext } from './cleaner.types';
import { scheduleNoticeClear } from './cleaner.types';

async function brushDataUrlToMaskBlob(
  dataUrl: string,
  imageWidth: number,
  imageHeight: number,
): Promise<Blob | null> {
  return new Promise((resolve) => {
    const img = new Image();
    img.onload = () => {
      try {
        const canvas = document.createElement('canvas');
        canvas.width = imageWidth;
        canvas.height = imageHeight;
        const ctx = canvas.getContext('2d');
        if (!ctx) { resolve(null); return; }
        ctx.drawImage(img, 0, 0, imageWidth, imageHeight);
        const srcData = ctx.getImageData(0, 0, imageWidth, imageHeight).data;

        const maskData = new Uint8ClampedArray(imageWidth * imageHeight * 4);
        for (let i = 0; i < imageWidth * imageHeight; i++) {
          const val = srcData[i * 4 + 3]! > 8 ? 255 : 0;
          maskData[i * 4] = val;
          maskData[i * 4 + 1] = val;
          maskData[i * 4 + 2] = val;
          maskData[i * 4 + 3] = 255;
        }

        const maskImageData = new ImageData(maskData, imageWidth, imageHeight);
        ctx.putImageData(maskImageData, 0, 0);
        canvas.toBlob((blob) => resolve(blob), 'image/png');
      } catch {
        resolve(null);
      }
    };
    img.onerror = () => resolve(null);
    img.src = dataUrl;
  });
}


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

        const detectFormData = new FormData();
        detectFormData.append('file', imgData.file);
        detectFormData.append('model_key', selectedDetectorKey);
        detectFormData.append('language', sourceLanguage);
        detectFormData.append('source_language', sourceLanguage);

        const detectResponse = await fetchWithTimeoutAndRetry(
          `${localApiUrl}/detect`,
          { method: 'POST', body: detectFormData },
          { timeoutMs: 90_000, retryCount: 0 },
        );
        if (!detectResponse.ok) {
          const detectFailureNotice = await readExecutionRuntimeNotice(detectResponse, AIO_STAGE_LABELS.detectText);
          if (detectFailureNotice) {
            executionNotices.push(detectFailureNotice.detail);
            setRuntimeExecutionNotice(detectFailureNotice);
          }
          const apiMessage = await parseApiError(detectResponse);
          throw new Error(`Failed to detect text in "${imgData.file.name}": ${apiMessage}`);
        }
        const detectNotice = await readExecutionRuntimeNotice(detectResponse, AIO_STAGE_LABELS.detectText);
        if (detectNotice) {
          executionNotices.push(detectNotice.detail);
          setRuntimeExecutionNotice(detectNotice);
        }
        const detectPayload = (await detectResponse.json()) as DetectApiResponse;
        const detectDetections = regionsFromDetectPayload(detectPayload, imgData, {
          minRegionSize,
        });

        let enrichedDetections = cloneAioRegions(detectDetections, cloneRenderStyle);

        if (detectDetections.length > 0) {
          const ocrFormData = new FormData();
          ocrFormData.append('file', imgData.file);
          ocrFormData.append('model_key', selectedOcrKey);
          ocrFormData.append('language', sourceLanguage);
          ocrFormData.append(
            'regions',
            JSON.stringify(
              detectDetections.map((region) => ({
                id: region.id,
                bbox: toApiIntegerBbox(region.bbox, imgData.width, imgData.height),
                source: region.source,
                detector_model_key: region.detectorModelKey ?? region.modelKey,
              })),
            ),
          );
          if (useLlmSettingsForOcr) {
            ocrFormData.append('llm_settings', JSON.stringify(llmSettings));
            const customPayload = selectedCustomOcrProfile
              ? {
                api_base: selectedCustomOcrProfile.apiBase,
                model: selectedCustomOcrProfile.model?.trim() ?? '',
                ...(selectedCustomOcrProfile.apiKey.trim()
                  ? { api_key: selectedCustomOcrProfile.apiKey.trim() }
                  : {}),
              }
              : null;
            if (customPayload) {
              ocrFormData.append('custom_llm', JSON.stringify(customPayload));
            }
          }
          const ocrRequestUrl = `${localApiUrl}/ocr`;
          const ocrResponse = await fetchWithTimeoutAndRetry(
            ocrRequestUrl,
            { method: 'POST', body: ocrFormData },
            { timeoutMs: 90_000, retryCount: 0 },
          );
          if (!ocrResponse.ok) {
            const ocrFailureNotice = await readExecutionRuntimeNotice(ocrResponse, AIO_STAGE_LABELS.recognizeText);
            if (ocrFailureNotice) {
              executionNotices.push(ocrFailureNotice.detail);
              setRuntimeExecutionNotice(ocrFailureNotice);
            }
            const apiMessage = await parseApiError(ocrResponse);
            throw new Error(`Failed to recognize text in "${imgData.file.name}": ${apiMessage}`);
          }
          const ocrNotice = await readExecutionRuntimeNotice(ocrResponse, AIO_STAGE_LABELS.recognizeText);
          if (ocrNotice) {
            executionNotices.push(ocrNotice.detail);
            setRuntimeExecutionNotice(ocrNotice);
          }
          const ocrPayload = (await ocrResponse.json()) as OcrApiResponse;
          const ocrById = new Map(ocrPayload.regions.map((region) => [String(region.id), region]));
          enrichedDetections = detectDetections.map((region) => {
            const match = ocrById.get(String(region.id)) ?? null;
            if (!match) return region;
            return {
              ...region,
              recognizedText: match.text,
              ocrScore: match.score,
              ocrModelKey: match.ocr_model_key,
              detectedGradient: normalizeDetectedGradient(match.foreground_gradient),
            };
          });
        }

        const segmentInputRegions = enrichedDetections.length > 0 ? enrichedDetections : detectDetections;
        let segmentDetections = cloneAioRegions(segmentInputRegions, cloneRenderStyle);
        if (segmentInputRegions.length > 0) {
          const segmentFormData = new FormData();
          segmentFormData.append('file', imgData.file);
          segmentFormData.append('model_key', selectedSegmentKey);
          segmentFormData.append(
            'regions',
            JSON.stringify(
              segmentInputRegions.map((region) => ({
                id: region.id,
                bbox: toApiIntegerBbox(region.bbox, imgData.width, imgData.height),
                source: region.source,
                detector_model_key: region.detectorModelKey ?? region.modelKey,
                ocr_model_key: region.ocrModelKey ?? selectedOcrKey,
              })),
            ),
          );
          const segmentResponse = await fetchWithTimeoutAndRetry(
            `${localApiUrl}/segment`,
            { method: 'POST', body: segmentFormData },
            { timeoutMs: 120_000, retryCount: 0 },
          );
          if (!segmentResponse.ok) {
            const apiMessage = await parseApiError(segmentResponse);
            throw new Error(`Failed to segment text in "${imgData.file.name}": ${apiMessage}`);
          }
          const segmentPayload = (await segmentResponse.json()) as SegmentApiResponse;
          const segmentById = new Map(segmentPayload.regions.map((region) => [region.id, region]));
          segmentDetections = segmentInputRegions.map((region) => {
            const match = segmentById.get(region.id) ?? null;
            if (!match) return region;
            return {
              ...region,
              segmentBoxes: match.segment_boxes,
              mergedSegmentBoxes: match.merged_boxes,
              segmentModelKey: match.segment_model_key,
              maskBase64: match.mask_base64 ?? undefined,
            };
          });
        }

        const cleanInputRegions = segmentDetections.length > 0 ? segmentDetections : detectDetections;
        const cleanFormData = new FormData();
        cleanFormData.append('file', imgData.file);
        cleanFormData.append('model_key', selectedCleanKey);
        cleanFormData.append('mask_dilation', String(maskDilation));
        cleanFormData.append('hd_strategy', hdStrategy);
        cleanFormData.append('hd_strategy_resize_limit', String(hdResizeLimit));
        cleanFormData.append('hd_strategy_crop_margin', String(hdCropMargin));
        cleanFormData.append('hd_strategy_crop_trigger_size', String(hdCropTriggerSize));

        const manualEditState =
          useCleanerStore.getState().cleanerManualImageEditsByImage[imgData.id];
        const brushDataUrl = manualEditState?.segmentBrushDataUrl ?? null;
        let brushMaskBlob: Blob | null = null;
        if (brushDataUrl) {
          brushMaskBlob = await brushDataUrlToMaskBlob(
            brushDataUrl,
            imgData.width,
            imgData.height,
          );
          if (brushMaskBlob) {
            cleanFormData.append('brush_mask', brushMaskBlob, 'brush_mask.png');
          }
        }

        cleanFormData.append(
          'regions',
          JSON.stringify(
            cleanInputRegions.map((region) => ({
              id: region.id,
              bbox: toApiIntegerBbox(region.bbox, imgData.width, imgData.height),
              source: region.source,
              detector_model_key: region.detectorModelKey ?? region.modelKey,
              ocr_model_key: region.ocrModelKey ?? selectedOcrKey,
              segment_model_key: region.segmentModelKey ?? selectedSegmentKey,
              segment_boxes: region.segmentBoxes ?? [],
              merged_boxes: region.mergedSegmentBoxes ?? [],
              mask_base64: region.maskBase64 ?? '',
            })),
          ),
        );
        const cleanResponse = await fetchWithTimeoutAndRetry(
          `${localApiUrl}/inpaint`,
          { method: 'POST', body: cleanFormData },
          { timeoutMs: 180_000, retryCount: 0 },
        );
        if (!cleanResponse.ok) {
          const cleanFailureNotice = await readExecutionRuntimeNotice(cleanResponse, AIO_STAGE_LABELS.cleanImage);
          if (cleanFailureNotice) {
            executionNotices.push(cleanFailureNotice.detail);
            setRuntimeExecutionNotice(cleanFailureNotice);
          }
          const apiMessage = await parseApiError(cleanResponse);
          throw new Error(`Failed to clean "${imgData.file.name}": ${apiMessage}`);
        }
        const cleanNotice = await readExecutionRuntimeNotice(cleanResponse, AIO_STAGE_LABELS.cleanImage);
        if (cleanNotice) {
          executionNotices.push(cleanNotice.detail);
          setRuntimeExecutionNotice(cleanNotice);
        }
        const blob = await cleanResponse.blob();
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


