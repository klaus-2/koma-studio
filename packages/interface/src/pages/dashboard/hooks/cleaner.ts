/**
 * Cleaner domain — entry point. Hosts the assisted-clean run orchestration
 * (useCleanerActions + the automatic AI clean / AI SFX workflow) and
 * re-exports the per-concern sibling modules split out in T10, so consumer
 * imports from 'hooks/cleaner' stay valid.
 */
import { useCallback, useEffect, useRef } from 'react';

import { useI18n } from '../../../i18n';
import { AIO_STAGE_LABELS } from '../../../constants/dashboard.constants';
import type { AioStageOption } from '../../../models/aioStageCatalog';
import type { DiscordActivityPreset } from '../../../types';
import { fetchWithTimeoutAndRetry } from '../../../utils/http';
import {
  blobToDataUrl,
  buildAioSelectionMapFromDetections,
  clamp,
  cloneAioRegions,
  cloneRenderStyle,
  normalizeDetectedGradient,
  normalizeRgbTriplet,
  readExecutionRuntimeNotice,
  toApiIntegerBbox,
} from '../../../utils/dashboard.utils';
import { normalizeDetectedRenderMode } from '../../../utils/renderModes';
import {
  hasAnyLlmCapability,
  inferLlmCapabilitiesForModelSelection,
  isCustomModelSelectionKey,
  isCloudOcrModelKey,
  normalizeKnownCustomLlmApiBase,
  requiresCustomLlmApiKey,
} from '../../../utils/customLlm';
import { runConcurrentBatch } from '../../../utils/concurrentBatch';
import { createDefaultTypographyShape } from '../../../typography/types';
import {
  applySfxDecisionsToRegions,
  buildSfxClassifierInstructions,
  buildSfxClassifierRegionsPayload,
  buildSfxCleanInstructions,
  isLikelySfxCandidate,
  type SfxClassificationResponse,
} from '../../../utils/sfx';
import type {
  AioManualImageEditState,
  AioTextRegion,
  CleanerMode,
  CleanerRunMeta,
  DetectApiResponse,
  LoadedImage,
  OcrApiResponse,
  RuntimeExecutionNotice,
  SegmentApiResponse,
} from '../../../types/dashboard.types';

export { useCleanerRegionEditing, useCleanerManualEdits, useCleanerWandHealing, useActiveCleanerRegionState } from './cleaner.editing';
export { useCleanerModelSelection, useCleanerAiStageOptions, useCleanerAiDraftProfileActions } from './cleaner.options';

/**
 * Converts a segment brush data URL (image-scale PNG with painted areas)
 * into a binary grayscale mask Blob (painted pixels = white, unpainted = black).
 * This gives pixel-exact inpainting — only the brushed pixels are cleaned.
 */
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

interface CustomProfileLike {
  apiBase: string;
  apiKey: string;
  model?: string;
}

interface DiscordLike {
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
  cleanerMode: CleanerMode;
  cleanerAiModelKey: string;
  selectedCleanerCustomProfile: CustomProfileLike | null;
  cleanerAiAdditionalInstructions: string;
  sourceLanguage: string;
  llmSettings: unknown;
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
  setCleanerDetectionsByImage: (value: Record<string, AioTextRegion[]>) => void;
  setCleanerSelectedRegionByImage: (value: Record<string, string | null>) => void;
  setCleanerProcessedBaseByImage: (value: Record<string, string>) => void;
  setCleanerRunMetaByImage: (value: Record<string, CleanerRunMeta>) => void;
  setCleanerManualImageEditsByImage: (value: Record<string, AioManualImageEditState>) => void;
  cleanerManualImageEditsByImage: Record<string, AioManualImageEditState>;
  setCleanerHealingBusyByImage: (value: Record<string, boolean>) => void;
  setProcessing: (value: boolean) => void;
  setProgress: (value: number) => void;
  setStatusMessage: (value: string) => void;
  setRuntimeExecutionNotice: (notice: RuntimeExecutionNotice | null) => void;
  onRunComplete?: () => void;
}

export function useCleanerActions(args: UseCleanerActionsArgs) {
  const {
    images,
    activeImage,
    localApiUrl,
    detectSelectionKey,
    ocrSelectionKey,
    segmentSelectionKey,
    cleanSelectionKey,
    cleanerMode,
    cleanerAiModelKey,
    selectedCleanerCustomProfile,
    cleanerAiAdditionalInstructions,
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
    ensureVerifiedEmailOrNotify,
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
    cleanerManualImageEditsByImage,
    setCleanerHealingBusyByImage,
    setProcessing,
    setProgress,
    setStatusMessage,
    setRuntimeExecutionNotice,
    onRunComplete,
  } = args;
  const { t } = useI18n();
  const noticeTimeoutRef = useRef<number | null>(null);

  useEffect(() => {
    return () => {
      if (noticeTimeoutRef.current) {
        window.clearTimeout(noticeTimeoutRef.current);
      }
    };
  }, []);

  return useCallback(async () => {
    if (!ensureVerifiedEmailOrNotify()) return;
    if (images.length === 0) return;
    setRuntimeExecutionNotice(null);

    if (cleanerMode === 'automatic_ai' || cleanerMode === 'ai_sfx') {
      await runAutomaticCleanerWorkflow({ ...args, t });
      return;
    }

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
      details: t('discord.presence.cleaner.details' as any),
      state: t('discord.presence.cleaner.state.basic' as any),
    });

    try {
      const results = await runConcurrentBatch({
        items: images,
        concurrency: effectiveBatchConcurrency,
        worker: async ({ item: imgData, index }: { item: LoadedImage; index: number }) => {
          await discord.setPreset('batch_mode', {
            details: t('discord.presence.batch.fileDetails' as any, { fileName: imgData.file.name }),
            state: t('discord.presence.batch.state' as any, { current: index + 1, total: images.length }),
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
          const sourceWidth = detectPayload.image_width > 0 ? detectPayload.image_width : imgData.width;
          const sourceHeight = detectPayload.image_height > 0 ? detectPayload.image_height : imgData.height;
          const scaleX = imgData.width / Math.max(1, sourceWidth);
          const scaleY = imgData.height / Math.max(1, sourceHeight);
          const detectDetections = detectPayload.detections
            .map((item): AioTextRegion | null => {
              const [bx1, by1, bx2, by2] = item.bbox;
              const rawX1 = clamp(Math.min(bx1, bx2), 0, sourceWidth);
              const rawY1 = clamp(Math.min(by1, by2), 0, sourceHeight);
              const rawX2 = clamp(Math.max(bx1, bx2), 0, sourceWidth);
              const rawY2 = clamp(Math.max(by1, by2), 0, sourceHeight);
              const x1 = Math.round(clamp(rawX1 * scaleX, 0, imgData.width));
              const y1 = Math.round(clamp(rawY1 * scaleY, 0, imgData.height));
              const x2 = Math.round(clamp(rawX2 * scaleX, 0, imgData.width));
              const y2 = Math.round(clamp(rawY2 * scaleY, 0, imgData.height));
              if ((x2 - x1) < minRegionSize || (y2 - y1) < minRegionSize) return null;
              return {
                id: item.id,
                bbox: [x1, y1, x2, y2],
                score: item.score,
                source: item.source,
                modelKey: item.model_key,
                detectorModelKey: item.model_key,
                detectedForegroundRgb: normalizeRgbTriplet(item.foreground_rgb),
                structuralType: item.structural_type ?? undefined,
                structuralConfidence: item.structural_confidence ?? undefined,
                structuralSource: item.structural_source ?? undefined,
                matchedReferenceImage: item.matched_reference_image ?? undefined,
                detectedRenderMode: normalizeDetectedRenderMode(item.label) ?? 'text_bubble',
                renderMode: 'auto',
                shape: createDefaultTypographyShape(
                  x2 - x1,
                  y2 - y1,
                  (() => {
                    const mode = normalizeDetectedRenderMode(item.label);
                    return mode === 'text_bubble' || mode === 'text_inside_black_bubble'
                      ? 'rounded'
                      : 'square';
                  })(),
                  'detected',
                ),
              };
            })
            .filter((item): item is AioTextRegion => item !== null);

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

          // If the user painted on the segment brush canvas, convert it to a pixel-exact
          // binary mask and send it as brush_mask. This ensures inpainting only touches
          // the exact painted pixels (not their bounding boxes).
          const manualEditState = cleanerManualImageEditsByImage[imgData.id];
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
        if (noticeTimeoutRef.current) window.clearTimeout(noticeTimeoutRef.current);
        noticeTimeoutRef.current = window.setTimeout(() => {
          setRuntimeExecutionNotice(null);
          noticeTimeoutRef.current = null;
        }, 4500);
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
  }, [
    activeImage,
    args,
    cleanerAiAdditionalInstructions,
    cleanerAiModelKey,
    cleanerManualImageEditsByImage,
    cleanerMode,
    cleanSelectionKey,
    detectSelectionKey,
    discord,
    effectiveBatchConcurrency,
    emitProcessCompleteWebhook,
    emitProcessErrorWebhook,
    emitProcessStartWebhook,
    ensureVerifiedEmailOrNotify,
    getAioStageOption,
    hdCropMargin,
    hdCropTriggerSize,
    hdResizeLimit,
    hdStrategy,
    images,
    llmSettings,
    localApiUrl,
    maskDilation,
    minRegionSize,
    modelEntries,
    ocrSelectionKey,
    parseApiError,
    registerDownloads,
    selectedCleanerCustomProfile,
    segmentSelectionKey,
    selectedCustomOcrProfile,
    setCleanerDetectionsByImage,
    setCleanerHealingBusyByImage,
    setCleanerManualImageEditsByImage,
    setCleanerProcessedBaseByImage,
    setCleanerRunMetaByImage,
    setCleanerSelectedRegionByImage,
    setProcessing,
    setProgress,
    setStatusMessage,
    setRuntimeExecutionNotice,
    onRunComplete,
    sourceLanguage,
    syncDiscordForTab,
    recordProcessedPages,
    t,
    validateManualLocalStageModel,
  ]);
}

type I18nTranslate = ReturnType<typeof useI18n>['t'];

type CleanerAutomaticWorkflowContext = UseCleanerActionsArgs & {
  t: I18nTranslate;
};

export async function runAutomaticCleanerWorkflow(
  ctx: CleanerAutomaticWorkflowContext,
): Promise<void> {
  const {
    images,
    localApiUrl,
    detectSelectionKey,
    cleanerMode,
    cleanerAiModelKey,
    selectedCleanerCustomProfile,
    cleanerAiAdditionalInstructions,
    sourceLanguage,
    effectiveBatchConcurrency,
    minRegionSize,
    discord,
    validateManualLocalStageModel,
    parseApiError,
    registerDownloads,
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
    onRunComplete,
    t,
  } = ctx;
  const translate = (key: string, vars?: Record<string, unknown>) =>
    t(key as Parameters<I18nTranslate>[0], vars as Parameters<I18nTranslate>[1]);

    const isAutomaticAiMode = cleanerMode === 'automatic_ai';
    const isAiSfxMode = cleanerMode === 'ai_sfx';
    const isCustomCleanerAi = cleanerAiModelKey.startsWith('custom_clean');
    const normalizedCleanerAiInstructions = cleanerAiAdditionalInstructions.trim();

    if (isAutomaticAiMode || isAiSfxMode) {
      if (
        !validateManualLocalStageModel(
          'detectText',
          AIO_STAGE_LABELS.detectText,
          detectSelectionKey,
        )
      ) {
        return;
      }

      const normalizedCustomApiBase = normalizeKnownCustomLlmApiBase(
        selectedCleanerCustomProfile?.apiBase ?? '',
      );
      const normalizedCustomModel = selectedCleanerCustomProfile?.model?.trim() ?? '';
      const normalizedCustomApiKey = selectedCleanerCustomProfile?.apiKey.trim() ?? '';
      const customCleanerPayload = isCustomCleanerAi
        ? {
            api_base: normalizedCustomApiBase,
            model: normalizedCustomModel,
            ...(normalizedCustomApiKey
              ? { api_key: normalizedCustomApiKey }
              : {}),
          }
        : null;

      if (isCustomCleanerAi) {
        if (!normalizedCustomApiBase || !normalizedCustomModel) {
          setStatusMessage(
            'Fill in API Base and Model before running Automatic AI Clean with AI Custom.',
          );
          return;
        }
        if (
          requiresCustomLlmApiKey(normalizedCustomApiBase)
          && !normalizedCustomApiKey
        ) {
          setStatusMessage(
            'This AI Custom provider requires an API key for Automatic AI Clean.',
          );
          return;
        }
      }

      setCleanerManualImageEditsByImage({});
      setCleanerHealingBusyByImage({});
      setProcessing(true);
      setProgress(0);
      setStatusMessage(
        effectiveBatchConcurrency > 1
          ? `Executando ${isAiSfxMode ? 'AI SFX Cleaner' : 'Automatic AI Clean'} em lote com ${effectiveBatchConcurrency} threads...`
          : `Executando ${isAiSfxMode ? 'AI SFX Cleaner' : 'Automatic AI Clean'} em lote...`,
      );
      emitProcessStartWebhook(isAiSfxMode ? 'AI SFX Cleaner' : 'Automatic AI Clean', images.length, {
        threads: effectiveBatchConcurrency,
        modelo_ai: cleanerAiModelKey,
        detector_modelo: detectSelectionKey,
        custom_provider: isCustomCleanerAi,
      });
      await discord.setPreset('cleaner_redraw_mode', {
        details: translate('discord.presence.cleaner.details'),
        state: translate('discord.presence.cleaner.state.advanced'),
      });

      try {
        const results = await runConcurrentBatch({
          items: images,
          concurrency: effectiveBatchConcurrency,
          worker: async ({
            item: imgData,
            index,
          }: {
            item: LoadedImage;
            index: number;
          }) => {
            await discord.setPreset('batch_mode', {
              details: translate('discord.presence.batch.fileDetails', { fileName: imgData.file.name }),
              state: translate('discord.presence.batch.state', { current: index + 1, total: images.length }),
            });

            const detectFormData = new FormData();
            detectFormData.append('file', imgData.file);
            detectFormData.append('model_key', detectSelectionKey);
            detectFormData.append('language', sourceLanguage);
            detectFormData.append('source_language', sourceLanguage);

            const detectResponse = await fetchWithTimeoutAndRetry(
              `${localApiUrl}/detect`,
              { method: 'POST', body: detectFormData },
              { timeoutMs: 90_000, retryCount: 0 },
            );
            if (!detectResponse.ok) {
              const apiMessage = await parseApiError(detectResponse);
              throw new Error(
                t('cleanerActions.detectFailed', { fileName: imgData.file.name, message: apiMessage }),
              );
            }

            const detectPayload =
              (await detectResponse.json()) as DetectApiResponse;
            const sourceWidth =
              detectPayload.image_width > 0
                ? detectPayload.image_width
                : imgData.width;
            const sourceHeight =
              detectPayload.image_height > 0
                ? detectPayload.image_height
                : imgData.height;
            const scaleX = imgData.width / Math.max(1, sourceWidth);
            const scaleY = imgData.height / Math.max(1, sourceHeight);
            const detectDetections = detectPayload.detections
              .map((item): AioTextRegion | null => {
                const [bx1, by1, bx2, by2] = item.bbox;
                const rawX1 = clamp(Math.min(bx1, bx2), 0, sourceWidth);
                const rawY1 = clamp(Math.min(by1, by2), 0, sourceHeight);
                const rawX2 = clamp(Math.max(bx1, bx2), 0, sourceWidth);
                const rawY2 = clamp(Math.max(by1, by2), 0, sourceHeight);
                const x1 = Math.round(clamp(rawX1 * scaleX, 0, imgData.width));
                const y1 = Math.round(clamp(rawY1 * scaleY, 0, imgData.height));
                const x2 = Math.round(clamp(rawX2 * scaleX, 0, imgData.width));
                const y2 = Math.round(clamp(rawY2 * scaleY, 0, imgData.height));
                if ((x2 - x1) < minRegionSize || (y2 - y1) < minRegionSize) {
                  return null;
                }
                const detectedRenderMode = normalizeDetectedRenderMode(item.label) ?? 'text_bubble';

                return {
                  id: item.id,
                  bbox: [x1, y1, x2, y2],
                  score: item.score,
                  source: item.source,
                  modelKey: item.model_key,
                  detectorModelKey: item.model_key,
                  detectedForegroundRgb: normalizeRgbTriplet(
                    item.foreground_rgb,
                  ),
                  structuralType: item.structural_type ?? undefined,
                  structuralConfidence: item.structural_confidence ?? undefined,
                  structuralSource: item.structural_source ?? undefined,
                  matchedReferenceImage:
                    item.matched_reference_image ?? undefined,
                  detectedRenderMode,
                  renderMode: 'auto',
                  shape: createDefaultTypographyShape(
                    x2 - x1,
                    y2 - y1,
                    detectedRenderMode === 'text_bubble' || detectedRenderMode === 'text_inside_black_bubble'
                      ? 'rounded'
                      : 'square',
                    'detected',
                  ),
                };
              })
              .filter((item): item is AioTextRegion => item !== null);

            let outputRegions = detectDetections;
            let candidateCount = detectDetections.length;
            let approvedCount = detectDetections.length;
            let reviewCount = 0;
            let blob: Blob;

            if (isAiSfxMode) {
              const candidateRegions = detectDetections.filter(isLikelySfxCandidate);
              candidateCount = candidateRegions.length;
              let enrichedCandidates: AioTextRegion[] = candidateRegions.map((region) => ({
                ...region,
                sfxCandidate: true,
                sfxApproved: false,
                sfxConfidence: null,
                sfxRequiresRedraw: false,
                sfxReason: null,
              }));

              if (candidateRegions.length > 0) {
                const classifyFormData = new FormData();
                classifyFormData.append('file', imgData.file);
                classifyFormData.append('model_key', cleanerAiModelKey);
                classifyFormData.append(
                  'regions',
                  JSON.stringify(buildSfxClassifierRegionsPayload(candidateRegions, imgData)),
                );
                classifyFormData.append(
                  'additional_instructions',
                  buildSfxClassifierInstructions(normalizedCleanerAiInstructions),
                );
                if (customCleanerPayload) {
                  classifyFormData.append('custom_llm', JSON.stringify(customCleanerPayload));
                }

                const classifyResponse = await fetchWithTimeoutAndRetry(
                  `${localApiUrl}/sfx/classify`,
                  { method: 'POST', body: classifyFormData },
                  { timeoutMs: 180_000, retryCount: 0 },
                );
                if (!classifyResponse.ok) {
                  const apiMessage = await parseApiError(classifyResponse);
                  throw new Error(
                    `Failed to classify SFX in "${imgData.file.name}": ${apiMessage}`,
                  );
                }
                const classifyPayload =
                  (await classifyResponse.json()) as SfxClassificationResponse;
                enrichedCandidates = applySfxDecisionsToRegions(
                  candidateRegions,
                  classifyPayload.regions,
                );
              }

              outputRegions = enrichedCandidates.filter((region) => region.sfxApproved);
              approvedCount = outputRegions.length;
              reviewCount = outputRegions.filter((region) => region.sfxRequiresRedraw).length;

              if (outputRegions.length === 0) {
                blob = imgData.file;
              } else {
                const cleanFormData = new FormData();
                cleanFormData.append('file', imgData.file);
                cleanFormData.append('model_key', cleanerAiModelKey);
                cleanFormData.append(
                  'regions',
                  JSON.stringify(buildSfxClassifierRegionsPayload(outputRegions, imgData)),
                );
                cleanFormData.append(
                  'additional_instructions',
                  buildSfxCleanInstructions(normalizedCleanerAiInstructions),
                );
                if (customCleanerPayload) {
                  cleanFormData.append('custom_llm', JSON.stringify(customCleanerPayload));
                }

                const cleanResponse = await fetchWithTimeoutAndRetry(
                  `${localApiUrl}/clean/ai`,
                  { method: 'POST', body: cleanFormData },
                  { timeoutMs: 240_000, retryCount: 0 },
                );
                if (!cleanResponse.ok) {
                  const apiMessage = await parseApiError(cleanResponse);
                  throw new Error(
                    `AI SFX Cleaner failed for "${imgData.file.name}": ${apiMessage}`,
                  );
                }
                blob = await cleanResponse.blob();
                if (!blob.type.startsWith('image/')) {
                  throw new Error(
                    t('cleanerActions.invalidSfxResponse', { fileName: imgData.file.name }),
                  );
                }
              }
            } else {
              const cleanFormData = new FormData();
              cleanFormData.append('file', imgData.file);
              cleanFormData.append('model_key', cleanerAiModelKey);
              cleanFormData.append(
                'regions',
                JSON.stringify(
                  detectDetections.map((region) => ({
                    id: region.id,
                    bbox: toApiIntegerBbox(
                      region.bbox,
                      imgData.width,
                      imgData.height,
                    ),
                    source: region.source,
                    detector_model_key: region.detectorModelKey ?? region.modelKey,
                    score: region.score ?? 0,
                    structural_type: region.structuralType ?? null,
                    structural_confidence: region.structuralConfidence ?? null,
                    structural_source: region.structuralSource ?? null,
                    matched_reference_image: region.matchedReferenceImage ?? null,
                    detected_render_mode: region.detectedRenderMode ?? null,
                  })),
                ),
              );
              if (normalizedCleanerAiInstructions) {
                cleanFormData.append(
                  'additional_instructions',
                  normalizedCleanerAiInstructions,
                );
              }
              if (customCleanerPayload) {
                cleanFormData.append(
                  'custom_llm',
                  JSON.stringify(customCleanerPayload),
                );
              }

              const cleanResponse = await fetchWithTimeoutAndRetry(
                `${localApiUrl}/clean/ai`,
                { method: 'POST', body: cleanFormData },
                { timeoutMs: 240_000, retryCount: 0 },
              );
              if (!cleanResponse.ok) {
                const apiMessage = await parseApiError(cleanResponse);
                throw new Error(
                  `Automatic AI Clean failed for "${imgData.file.name}": ${apiMessage}`,
                );
              }

              blob = await cleanResponse.blob();
              if (!blob.type.startsWith('image/')) {
                throw new Error(
                  t('cleanerActions.invalidAutoCleanResponse', { fileName: imgData.file.name }),
                );
              }
            }

            return {
              imageId: imgData.id,
              fileName: `${
                isAiSfxMode
                  ? 'koma-studio-ai-sfx-clean'
                  : 'koma-studio-automatic-ai-clean'
              }-${imgData.file.name.replace(/\s+/g, '-')}.png`,
              blob,
              baseImageDataUrl: await blobToDataUrl(blob),
              regions: cloneAioRegions(outputRegions, cloneRenderStyle),
              detectCount: outputRegions.length,
              candidateCount,
              approvedCount,
              reviewCount,
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
        let totalCandidates = 0;
        let totalReviews = 0;

        results.forEach((result) => {
          nextDetections[result.imageId] = cloneAioRegions(
            result.regions,
            cloneRenderStyle,
          );
          nextSelections[result.imageId] =
            buildAioSelectionMapFromDetections({
              [result.imageId]: result.regions,
            })[result.imageId] ?? null;
          nextBaseByImage[result.imageId] = result.baseImageDataUrl;
          nextMeta[result.imageId] = {
            detected: result.detectCount > 0,
            ocrCount: 0,
            segmentedCount: 0,
            cleaned: true,
            detectModelKey: detectSelectionKey,
            ocrModelKey: null,
            segmentModelKey: null,
            cleanModelKey: cleanerAiModelKey,
            sourceLanguage,
            candidateCount: result.candidateCount ?? result.detectCount,
            approvedCount: result.approvedCount ?? result.detectCount,
            reviewCount: result.reviewCount ?? 0,
          };
          totalDetected += result.detectCount;
          totalCandidates += result.candidateCount ?? result.detectCount;
          totalReviews += result.reviewCount ?? 0;
        });

        setCleanerDetectionsByImage(nextDetections);
        setCleanerSelectedRegionByImage(nextSelections);
        setCleanerProcessedBaseByImage(nextBaseByImage);
        setCleanerRunMetaByImage(nextMeta);

        emitProcessCompleteWebhook(isAiSfxMode ? 'AI SFX Cleaner' : 'Automatic AI Clean', images.length, {
          imagens_limpas: outputs.length,
          regioes_detectadas: totalDetected,
          regioes_candidatas: totalCandidates,
          regioes_review: totalReviews,
          threads: effectiveBatchConcurrency,
          modelo_ai: cleanerAiModelKey,
        });
        setStatusMessage(
          isAiSfxMode
            ? t('cleanerActions.sfxDone', { images: outputs.length, candidates: totalCandidates, approved: totalDetected, redraw: totalReviews })
            : t('cleanerActions.autoCleanDone', { images: outputs.length, detected: totalDetected }),
        );
        onRunComplete?.();
      } catch (error) {
        emitProcessErrorWebhook(isAiSfxMode ? 'AI SFX Cleaner' : 'Automatic AI Clean', images.length, error, {
          threads: effectiveBatchConcurrency,
          modelo_ai: cleanerAiModelKey,
        });
        setStatusMessage(
          error instanceof Error
            ? error.message
            : `Failed to run ${isAiSfxMode ? 'AI SFX Cleaner' : 'Automatic AI Clean'}.`,
        );
      } finally {
        setProcessing(false);
        setProgress(0);
        void syncDiscordForTab();
      }

      return;
    }
}
