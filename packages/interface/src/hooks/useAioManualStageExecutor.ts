import { useCallback, useEffect, useRef } from 'react';

import { useI18n } from '../i18n';
import {
  AIO_MANUAL_STAGE_ORDER,
  AIO_PIPELINE_STAGE_LABELS,
  AIO_STAGE_LABELS,
} from '../constants/dashboard.constants';
import { fetchWithTimeoutAndRetry } from '../utils/http';
import {
  applyRenderDefaultsToRegion,
  clamp,
  normalizeDetectedGradient,
  normalizeRgbTriplet,
  readExecutionRuntimeNotice,
  normalizeTranslationNotes,
  toApiIntegerBbox,
} from '../utils/dashboard.utils';
import { createDefaultTypographyShape } from '../typography/types';
import { normalizeDetectedRenderMode } from '../utils/renderModes';
import {
  type CustomLlmProfile,
  getCustomLlmRuntimeRestriction,
  hasAnyLlmCapability,
  inferLlmCapabilitiesForModelSelection,
  isCustomModelSelectionKey,
  isCloudOcrModelKey,
  isCloudTranslationModelKey,
  requiresCustomLlmApiKey,
  shouldUseLocalDesktopTranslationForCustomProfile,
  toCustomLlmRequestPayload,
} from '../utils/customLlm';
import type { RenderTextStyle } from '../utils/renderText';
import type {
  AioDownloadEntry,
  AioManualImageEditState,
  AioManualImageProgress,
  AioPipelineSnapshotKey,
  AioTextRegion,
  DetectApiResponse,
  LoadedImage,
  OcrApiResponse,
  RuntimeExecutionNotice,
  SegmentApiResponse,
  TranslationApiResponse,
} from '../types/dashboard.types';
import type { AioStageOption } from '../models/aioStageCatalog';

interface ModelManagerEntryLike {
  status: string;
  model: {
    id: string;
    name: string;
  };
}

interface UseAioManualStageExecutorArgs {
  activeId: string | null;
  processing: boolean;
  images: LoadedImage[];
  aioManualProgressByImage: Record<string, AioManualImageProgress>;
  aioAutoProcessedImageById: Record<string, boolean>;
  aioDetectionsByImage: Record<string, AioTextRegion[]>;
  aioStageOptions: {
    detectText: AioStageOption[];
    recognizeText: AioStageOption[];
    segmentText: AioStageOption[];
    cleanImage: AioStageOption[];
  };
  aioStageSelection: {
    detectText: string;
    recognizeText: string;
    getTranslations: string;
    segmentText: string;
    cleanImage: string;
  };
  aioSrcLang: string;
  aioTgtLang: string;
  aioMaskDilation: number;
  aioHdStrategy: string;
  aioHdResizeLimit: number;
  aioHdCropMargin: number;
  aioHdCropTriggerSize: number;
  gpuStages?: { detectText: boolean; recognizeText: boolean; segmentText: boolean; cleanImage: boolean };
  minRegionSize: number;
  llmSettings: unknown;
  renderDefaultStyle: RenderTextStyle;
  localApiUrl: string;
  modelEntries: Record<string, ModelManagerEntryLike | undefined>;
  compatibleTranslationModelIds: Set<string>;
  selectedCustomOcrProfile: CustomLlmProfile | null;
  selectedCustomTranslationProfile: CustomLlmProfile | null;
  validateManualLocalStageModel: (stageKey: string, stageLabel: string, modelKey: string) => boolean;
  getAioStageOption: (stageKey: 'recognizeText' | 'getTranslations', key: string) => AioStageOption | null;
  parseApiError: (response: Response) => Promise<string>;
  getAioRegionsFromSnapshot: (stageKey: AioPipelineSnapshotKey, imageId: string) => AioTextRegion[];
  getAioManualImageEditState: (imageId: string) => AioManualImageEditState;
  patchAioSnapshotStageForImage: (
    imageId: string,
    stageIndex: number,
    regions: AioTextRegion[],
    downloadEntry?: AioDownloadEntry | null,
  ) => void;
  completeManualStageForImage: (imageId: string, stageIndex: number, status: 'done' | 'skipped') => void;
  recordProcessedPages: (pages: number) => void;
  syncDiscordForTab: () => Promise<void> | void;
  setProcessing: (value: boolean) => void;
  setProgress: (value: number) => void;
  setStatusMessage: (value: string) => void;
  applyDetectedGradientToStyle: (...args: any[]) => any;
  getAbortSignal: () => AbortSignal | null;
  onStageStart: (stageKey: AioPipelineSnapshotKey, image: LoadedImage, index: number) => void;
  setRuntimeExecutionNotice: (notice: RuntimeExecutionNotice | null) => void;
}

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

        // Build a grayscale mask: any painted pixel (alpha > 8) -> white (255), rest -> black (0)
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

export function useAioManualStageExecutor({
  activeId,
  processing,
  images,
  aioManualProgressByImage,
  aioAutoProcessedImageById,
  aioDetectionsByImage,
  aioStageOptions,
  aioStageSelection,
  aioSrcLang,
  aioTgtLang,
  aioMaskDilation,
  aioHdStrategy,
  aioHdResizeLimit,
  aioHdCropMargin,
  aioHdCropTriggerSize,
  gpuStages,
  minRegionSize,
  llmSettings,
  renderDefaultStyle,
  localApiUrl,
  modelEntries,
  compatibleTranslationModelIds,
  selectedCustomOcrProfile,
  selectedCustomTranslationProfile,
  validateManualLocalStageModel,
  getAioStageOption,
  parseApiError,
  getAioRegionsFromSnapshot,
  getAioManualImageEditState,
  patchAioSnapshotStageForImage,
  completeManualStageForImage,
  recordProcessedPages,
  syncDiscordForTab,
  setProcessing,
  setProgress,
  setStatusMessage,
  applyDetectedGradientToStyle,
  getAbortSignal,
  onStageStart,
  setRuntimeExecutionNotice,
}: UseAioManualStageExecutorArgs) {
  const { t } = useI18n();
  const noticeTimeoutRef = useRef<ReturnType<typeof setTimeout> | null>(null);

  useEffect(() => {
    return () => {
      if (noticeTimeoutRef.current) {
        clearTimeout(noticeTimeoutRef.current);
      }
    };
  }, []);

  return useCallback(async () => {
    if (!activeId) {
      setStatusMessage(t('aioManual.selectImage'));
      return;
    }
    if (processing) return;

    const activeImageData = images.find((image) => image.id === activeId);
    if (!activeImageData) {
      setStatusMessage(t('aioManual.imageNotFound'));
      return;
    }
    const progress = aioManualProgressByImage[activeId];
    if (!progress) {
      setStatusMessage(t('aioManual.progressNotInitialized'));
      return;
    }
    const stageIndex = clamp(progress.currentIndex, 0, AIO_MANUAL_STAGE_ORDER.length - 1);
    const stageKey = AIO_MANUAL_STAGE_ORDER[stageIndex]!;
    const stageLabel = AIO_PIPELINE_STAGE_LABELS[stageKey];
    const signal = getAbortSignal();
    const assertNotAborted = (): void => {
      if (!signal?.aborted) {
        return;
      }

      throw (
        signal.reason instanceof Error
          ? signal.reason
          : new DOMException('The operation was aborted.', 'AbortError')
      );
    };
    let selectedDetectorKey = aioStageSelection.detectText;
    let selectedOcrKey = aioStageSelection.recognizeText;
    let selectedTranslationKey = aioStageSelection.getTranslations;
    let selectedSegmentKey = aioStageSelection.segmentText;
    let selectedCleanKey = aioStageSelection.cleanImage;
    const selectedOcrOption = getAioStageOption('recognizeText', selectedOcrKey);
    const selectedTranslationOption = getAioStageOption('getTranslations', selectedTranslationKey);

    const useCloudOcr = isCloudOcrModelKey(selectedOcrKey);
    const useCloudTranslation = isCustomModelSelectionKey(selectedTranslationKey)
      ? !shouldUseLocalDesktopTranslationForCustomProfile(selectedCustomTranslationProfile)
      : isCloudTranslationModelKey(selectedTranslationKey);
    const useLlmSettingsForOcr = useCloudOcr && hasAnyLlmCapability(
      selectedOcrOption?.llm_capabilities ?? inferLlmCapabilitiesForModelSelection('ocr', selectedOcrKey),
    );
    const useLlmSettingsForTranslation = (useCloudTranslation || isCustomModelSelectionKey(selectedTranslationKey)) && hasAnyLlmCapability(
      selectedTranslationOption?.llm_capabilities
      ?? inferLlmCapabilitiesForModelSelection('translation', selectedTranslationKey),
    );

    setProcessing(true);
    setProgress(0);
    onStageStart(stageKey, activeImageData, 0);
    setStatusMessage(`Modo manual: executando "${stageLabel}" em "${activeImageData.file.name}"...`);

    try {
      let executionNotice: RuntimeExecutionNotice | null = null;
      if (stageKey === 'detectText') {
        assertNotAborted();
        const currentDetectRegions = aioDetectionsByImage[activeId] ?? [];
        const normalizedSelectedRegions = currentDetectRegions
          .map((region): AioTextRegion | null => {
            const normalizedBbox = toApiIntegerBbox(
              region.bbox,
              activeImageData.width,
              activeImageData.height,
            );
            const [x1, y1, x2, y2] = normalizedBbox;
            const width = x2 - x1;
            const height = y2 - y1;
            if (width < minRegionSize || height < minRegionSize) {
              return null;
            }
            const resolvedModelKey = region.modelKey || 'manual';
            return {
              ...region,
              bbox: normalizedBbox,
              source: region.source ?? 'manual',
              score: Number.isFinite(region.score) ? region.score : 1,
              modelKey: resolvedModelKey,
              detectorModelKey: region.detectorModelKey || resolvedModelKey,
            };
          })
          .filter((region): region is AioTextRegion => region !== null);

        if (normalizedSelectedRegions.length > 0) {
          patchAioSnapshotStageForImage(activeId, stageIndex, normalizedSelectedRegions);
        } else {
          if (!aioStageOptions.detectText.some((option) => option.key === selectedDetectorKey)) {
            throw new Error(t('aioManual.selectValidDetectModel'));
          }
          if (!validateManualLocalStageModel('detectText', AIO_STAGE_LABELS.detectText, selectedDetectorKey)) {
            return;
          }

          const detectFormData = new FormData();
          detectFormData.append('file', activeImageData.file);
          detectFormData.append('model_key', selectedDetectorKey);
          detectFormData.append('language', aioSrcLang);
          detectFormData.append('source_language', aioSrcLang);
          if (gpuStages) detectFormData.append('use_gpu', String(gpuStages.detectText));

          const detectResponse = await fetchWithTimeoutAndRetry(
            `${localApiUrl}/detect`,
            { method: 'POST', body: detectFormData },
            { timeoutMs: 90_000, retryCount: 0, signal: signal ?? undefined },
          );
          if (!detectResponse.ok) {
            executionNotice = await readExecutionRuntimeNotice(detectResponse, stageLabel);
            if (executionNotice) setRuntimeExecutionNotice(executionNotice);
            const message = await parseApiError(detectResponse);
            throw new Error(`Failed to detect text: ${message}`);
          }
          executionNotice = await readExecutionRuntimeNotice(detectResponse, stageLabel);
          if (executionNotice) setRuntimeExecutionNotice(executionNotice);

          const payload = (await detectResponse.json()) as DetectApiResponse;
          const sourceWidth = payload.image_width > 0 ? payload.image_width : activeImageData.width;
          const sourceHeight = payload.image_height > 0 ? payload.image_height : activeImageData.height;
          const scaleX = activeImageData.width / Math.max(1, sourceWidth);
          const scaleY = activeImageData.height / Math.max(1, sourceHeight);
          const detections = payload.detections
            .map((item): AioTextRegion | null => {
              const [bx1, by1, bx2, by2] = item.bbox;
              const rawX1 = clamp(Math.min(bx1, bx2), 0, sourceWidth);
              const rawY1 = clamp(Math.min(by1, by2), 0, sourceHeight);
              const rawX2 = clamp(Math.max(bx1, bx2), 0, sourceWidth);
              const rawY2 = clamp(Math.max(by1, by2), 0, sourceHeight);
              const x1 = Math.round(clamp(rawX1 * scaleX, 0, activeImageData.width));
              const y1 = Math.round(clamp(rawY1 * scaleY, 0, activeImageData.height));
              const x2 = Math.round(clamp(rawX2 * scaleX, 0, activeImageData.width));
              const y2 = Math.round(clamp(rawY2 * scaleY, 0, activeImageData.height));
              const boxWidth = x2 - x1;
              const boxHeight = y2 - y1;
              if (boxWidth < minRegionSize || boxHeight < minRegionSize) return null;

              const detectedRenderMode = normalizeDetectedRenderMode(item.label) ?? 'text_bubble';

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
                detectedRenderMode,
                renderMode: 'auto',
                shape: createDefaultTypographyShape(
                  x2 - x1,
                  y2 - y1,
                  detectedRenderMode === 'text_bubble' || detectedRenderMode === 'text_inside_black_bubble' ? 'rounded' : 'square',
                  'detected',
                ),
              };
            })
            .filter((item): item is AioTextRegion => item !== null);

          patchAioSnapshotStageForImage(activeId, stageIndex, detections);
        }
      } else if (stageKey === 'recognizeText') {
        assertNotAborted();
        if (!aioStageOptions.recognizeText.some((option) => option.key === selectedOcrKey)) {
          throw new Error(t('aioExec.selectValidOcrModel'));
        }

        if (modelEntries[selectedOcrKey]) {
          if (!validateManualLocalStageModel('recognizeText', AIO_STAGE_LABELS.recognizeText, selectedOcrKey)) {
            return;
          }
        } else {
          if (!selectedOcrOption) throw new Error(t('aioExec.selectValidOcrModel'));
          if (!selectedOcrOption.implemented) {
            throw new Error(t('aioModel.status.inRoadmap', { name: selectedOcrOption.name }));
          }
          if (!selectedOcrOption.available) {
            throw new Error(t('aioModel.status.requiresConfig', { name: selectedOcrOption.name }));
          }
          if (isCustomModelSelectionKey(selectedOcrKey) && !selectedCustomOcrProfile) {
            throw new Error(t('aioExec.selectCustomOcrProfile'));
          }
          if (
            isCustomModelSelectionKey(selectedOcrKey)
            && selectedCustomOcrProfile
            && requiresCustomLlmApiKey(selectedCustomOcrProfile.apiBase)
            && !selectedCustomOcrProfile.apiKey.trim()
          ) {
            throw new Error(t('aioExec.ocrRequiresApiKey'));
          }
        }

        const detectRegions = getAioRegionsFromSnapshot('detectText', activeId);
        if (detectRegions.length === 0) {
          patchAioSnapshotStageForImage(activeId, stageIndex, []);
        } else {
          const ocrFormData = new FormData();
          ocrFormData.append('file', activeImageData.file);
          ocrFormData.append('model_key', selectedOcrKey);
          ocrFormData.append('language', aioSrcLang);
          ocrFormData.append(
            'regions',
            JSON.stringify(
              detectRegions.map((region) => ({
                id: region.id,
                bbox: toApiIntegerBbox(region.bbox, activeImageData.width, activeImageData.height),
                source: region.source,
                detector_model_key: region.detectorModelKey ?? region.modelKey,
              })),
            ),
          );
          if (useLlmSettingsForOcr) {
            ocrFormData.append('llm_settings', JSON.stringify(llmSettings));
            const customPayload = toCustomLlmRequestPayload(selectedCustomOcrProfile);
            if (customPayload) {
              ocrFormData.append('custom_llm', JSON.stringify(customPayload));
            }
          }
          if (gpuStages && !useCloudOcr) ocrFormData.append('use_gpu', String(gpuStages.recognizeText));

          const ocrRequestUrl = `${localApiUrl}/ocr`;
          const ocrResponse = await fetchWithTimeoutAndRetry(
            ocrRequestUrl,
            { method: 'POST', body: ocrFormData },
            { timeoutMs: 480_000, retryCount: 0, signal: signal ?? undefined },
          );
          if (!ocrResponse.ok) {
            executionNotice = await readExecutionRuntimeNotice(ocrResponse, stageLabel);
            if (executionNotice) setRuntimeExecutionNotice(executionNotice);
            const message = await parseApiError(ocrResponse);
            throw new Error(`Failed to recognize text: ${message}`);
          }
          executionNotice = await readExecutionRuntimeNotice(ocrResponse, stageLabel);
          if (executionNotice) setRuntimeExecutionNotice(executionNotice);

          const ocrPayload = (await ocrResponse.json()) as OcrApiResponse;
          const ocrById = new Map(ocrPayload.regions.map((region) => [String(region.id), region]));
          const mergedRegions = detectRegions.map((region, index) => {
            const match = ocrById.get(String(region.id)) ?? ocrPayload.regions[index] ?? null;
            if (!match) return region;
            const normalizedRenderText = typeof region.renderText === 'string' && region.renderText.trim().length === 0
              ? undefined
              : region.renderText;
            return {
              ...region,
              renderText: normalizedRenderText,
              recognizedText: match.text,
              ocrScore: match.score,
              ocrModelKey: match.ocr_model_key,
              detectedGradient: normalizeDetectedGradient(match.foreground_gradient),
            };
          });
          patchAioSnapshotStageForImage(activeId, stageIndex, mergedRegions);
        }
      } else if (stageKey === 'getTranslations') {
        assertNotAborted();
        const selectedLocalModelState = modelEntries[selectedTranslationKey];
        if (selectedLocalModelState) {
          const selectedModelInstalled =
            selectedLocalModelState.status === 'installed'
            || selectedLocalModelState.status === 'update_available';
          if (!selectedModelInstalled) {
            throw new Error(t('aioExec.installTranslationModel'));
          }
          if (!compatibleTranslationModelIds.has(selectedLocalModelState.model.id)) {
            throw new Error(t('aioExec.incompatibleLanguage'));
          }
        } else {
          if (!selectedTranslationOption) throw new Error(t('aioExec.selectValidTranslation'));
          if (!selectedTranslationOption.implemented) {
            throw new Error(t('aioModel.status.inRoadmap', { name: selectedTranslationOption.name }));
          }
          if (!selectedTranslationOption.available) {
            throw new Error(t('aioModel.status.requiresConfig', { name: selectedTranslationOption.name }));
          }
          if (isCustomModelSelectionKey(selectedTranslationKey) && !selectedCustomTranslationProfile) {
            throw new Error(t('aioExec.selectCustomAiProfile'));
          }
          if (
            isCustomModelSelectionKey(selectedTranslationKey)
            && selectedCustomTranslationProfile
            && requiresCustomLlmApiKey(selectedCustomTranslationProfile.apiBase)
            && !selectedCustomTranslationProfile.apiKey.trim()
          ) {
            throw new Error(t('aioExec.translationRequiresApiKey'));
          }
          if (isCustomModelSelectionKey(selectedTranslationKey) && selectedCustomTranslationProfile) {
            const runtimeRestriction = getCustomLlmRuntimeRestriction(selectedCustomTranslationProfile.apiBase);
            if (runtimeRestriction) {
              throw new Error(runtimeRestriction);
            }
          }
        }

        const ocrRegions = getAioRegionsFromSnapshot('recognizeText', activeId);
        const hasTextForTranslation = ocrRegions.some((region) => (region.recognizedText ?? '').trim().length > 0);
        if (!hasTextForTranslation) {
          patchAioSnapshotStageForImage(activeId, stageIndex, ocrRegions);
        } else {
          const translationFormData = new FormData();
          translationFormData.append('model_key', selectedTranslationKey);
          translationFormData.append('source_language', aioSrcLang);
          translationFormData.append('target_language', aioTgtLang);
          if (useLlmSettingsForTranslation) {
            translationFormData.append('file', activeImageData.file);
            translationFormData.append('llm_settings', JSON.stringify(llmSettings));
            const customPayload = toCustomLlmRequestPayload(selectedCustomTranslationProfile);
            if (customPayload) {
              translationFormData.append('custom_llm', JSON.stringify(customPayload));
            }
          }
          translationFormData.append(
            'regions',
            JSON.stringify(
              ocrRegions.map((region) => ({
                id: region.id,
                text: region.recognizedText ?? '',
                source: region.source,
                detector_model_key: region.detectorModelKey ?? region.modelKey,
                ocr_model_key: region.ocrModelKey ?? selectedOcrKey,
              })),
            ),
          );

          const translationRequestUrl = `${localApiUrl}/translate`;
          const translationResponse = await fetchWithTimeoutAndRetry(
            translationRequestUrl,
            { method: 'POST', body: translationFormData },
            { timeoutMs: 120_000, retryCount: 0, signal: signal ?? undefined },
          );
          if (!translationResponse.ok) {
            const message = await parseApiError(translationResponse);
            throw new Error(`Failed to translate text: ${message}`);
          }

          const translationPayload = (await translationResponse.json()) as TranslationApiResponse;
          const translationById = new Map(translationPayload.regions.map((region) => [region.id, region]));
          const mergedRegions = ocrRegions.map((region) => {
            const match = translationById.get(region.id);
            if (!match) return region;
            const normalizedRenderText = typeof region.renderText === 'string' && region.renderText.trim().length === 0
              ? undefined
              : region.renderText;
            return {
              ...region,
              renderText: normalizedRenderText,
              translatedText: match.translated_text,
              translationNotes: normalizeTranslationNotes(match.translation_notes),
              translationNoteOverlay: undefined,
              translatorModelKey: match.translator_model_key,
            };
          });
          patchAioSnapshotStageForImage(activeId, stageIndex, mergedRegions);
        }
      } else if (stageKey === 'segmentText') {
        assertNotAborted();
        if (!aioStageOptions.segmentText.some((option) => option.key === selectedSegmentKey)) {
          throw new Error(t('aioManual.selectValidSegmentModel'));
        }
        if (!validateManualLocalStageModel('segmentText', AIO_STAGE_LABELS.segmentText, selectedSegmentKey)) {
          return;
        }

        let sourceRegions = getAioRegionsFromSnapshot('getTranslations', activeId);
        if (sourceRegions.length === 0) {
          sourceRegions = getAioRegionsFromSnapshot('recognizeText', activeId);
        }
        if (sourceRegions.length === 0) {
          patchAioSnapshotStageForImage(activeId, stageIndex, []);
        } else {
          const segmentFormData = new FormData();
          segmentFormData.append('file', activeImageData.file);
          segmentFormData.append('model_key', selectedSegmentKey);
          if (gpuStages) segmentFormData.append('use_gpu', String(gpuStages.segmentText));
          segmentFormData.append(
            'regions',
            JSON.stringify(
              sourceRegions.map((region) => ({
                id: region.id,
                bbox: toApiIntegerBbox(region.bbox, activeImageData.width, activeImageData.height),
                source: region.source,
                detector_model_key: region.detectorModelKey ?? region.modelKey,
                ocr_model_key: region.ocrModelKey ?? selectedOcrKey,
                translator_model_key: region.translatorModelKey ?? selectedTranslationKey,
              })),
            ),
          );

          const segmentResponse = await fetchWithTimeoutAndRetry(
            `${localApiUrl}/segment`,
            { method: 'POST', body: segmentFormData },
            { timeoutMs: 120_000, retryCount: 0, signal: signal ?? undefined },
          );
          if (!segmentResponse.ok) {
            const message = await parseApiError(segmentResponse);
            throw new Error(`Failed to segment text: ${message}`);
          }

          const segmentPayload = (await segmentResponse.json()) as SegmentApiResponse;
          const segmentById = new Map(segmentPayload.regions.map((region) => [region.id, region]));
          const mergedRegions = sourceRegions.map((region) => {
            const match = segmentById.get(region.id);
            if (!match) return region;
            return {
              ...region,
              segmentBoxes: match.segment_boxes,
              mergedSegmentBoxes: match.merged_boxes,
              segmentModelKey: match.segment_model_key,
              maskBase64: match.mask_base64 ?? undefined,
            };
          });
          patchAioSnapshotStageForImage(activeId, stageIndex, mergedRegions);
        }
      } else if (stageKey === 'cleanImage') {
        assertNotAborted();
        if (!aioStageOptions.cleanImage.some((option) => option.key === selectedCleanKey)) {
          throw new Error(t('aioManual.selectValidCleanModel'));
        }
        if (!validateManualLocalStageModel('cleanImage', AIO_STAGE_LABELS.cleanImage, selectedCleanKey)) {
          return;
        }

        let sourceRegions = getAioRegionsFromSnapshot('segmentText', activeId);
        if (sourceRegions.length === 0) sourceRegions = getAioRegionsFromSnapshot('recognizeText', activeId);
        if (sourceRegions.length === 0) sourceRegions = getAioRegionsFromSnapshot('detectText', activeId);

        // If the user manually painted brush areas, convert the canvas to a pixel-exact
        // binary mask blob and send it alongside the auto-detected regions. This ensures
        // inpainting only touches the exact painted pixels (not their bounding boxes).
        const manualEditState = getAioManualImageEditState(activeId);
        const brushDataUrl = manualEditState.segmentBrushDataUrl;
        let brushMaskBlob: Blob | null = null;
        if (brushDataUrl) {
          brushMaskBlob = await brushDataUrlToMaskBlob(
            brushDataUrl,
            activeImageData.width,
            activeImageData.height,
          );
        }

        const inpaintFormData = new FormData();
        inpaintFormData.append('file', activeImageData.file);
        if (brushMaskBlob) {
          inpaintFormData.append('brush_mask', brushMaskBlob, 'brush_mask.png');
        }
        inpaintFormData.append('model_key', selectedCleanKey);
        if (gpuStages) inpaintFormData.append('use_gpu', String(gpuStages.cleanImage));
        inpaintFormData.append('mask_dilation', String(aioMaskDilation));
        inpaintFormData.append('hd_strategy', aioHdStrategy);
        inpaintFormData.append('hd_strategy_resize_limit', String(aioHdResizeLimit));
        inpaintFormData.append('hd_strategy_crop_margin', String(aioHdCropMargin));
        inpaintFormData.append('hd_strategy_crop_trigger_size', String(aioHdCropTriggerSize));
        inpaintFormData.append(
          'regions',
          JSON.stringify(
            sourceRegions.map((region) => ({
              id: region.id,
              bbox: toApiIntegerBbox(region.bbox, activeImageData.width, activeImageData.height),
              source: region.source,
              detector_model_key: region.detectorModelKey ?? region.modelKey,
              ocr_model_key: region.ocrModelKey ?? selectedOcrKey,
              translator_model_key: region.translatorModelKey ?? selectedTranslationKey,
              segment_model_key: region.segmentModelKey ?? selectedSegmentKey,
              segment_boxes: region.segmentBoxes ?? [],
              merged_boxes: region.mergedSegmentBoxes ?? [],
              mask_base64: region.maskBase64 ?? '',
            })),
          ),
        );

        const cleanResponse = await fetchWithTimeoutAndRetry(
          `${localApiUrl}/inpaint`,
          { method: 'POST', body: inpaintFormData },
          { timeoutMs: 180_000, retryCount: 0, signal: signal ?? undefined },
        );
        if (!cleanResponse.ok) {
          executionNotice = await readExecutionRuntimeNotice(cleanResponse, stageLabel);
          if (executionNotice) setRuntimeExecutionNotice(executionNotice);
          const message = await parseApiError(cleanResponse);
          throw new Error(`Failed to clean the image: ${message}`);
        }
        executionNotice = await readExecutionRuntimeNotice(cleanResponse, stageLabel);
        if (executionNotice) setRuntimeExecutionNotice(executionNotice);

        const cleanBlob = await cleanResponse.blob();
        if (!cleanBlob.type.startsWith('image/')) {
          throw new Error(t('aioManual.invalidCleanResponse'));
        }

        const cleanEntry: AioDownloadEntry = {
          fileName: `koma-studio-aio-clean-${activeImageData.file.name.replace(/\s+/g, '-')}.png`,
          blob: cleanBlob,
          sourceImageId: activeId,
        };
        // Store the original source regions in the snapshot (NOT the virtual brush region)
        // so downstream stages don't show a giant full-image bounding box.
        patchAioSnapshotStageForImage(activeId, stageIndex, sourceRegions, cleanEntry);
      } else {
        let sourceRegions = getAioRegionsFromSnapshot('cleanImage', activeId);
        if (sourceRegions.length === 0) sourceRegions = getAioRegionsFromSnapshot('segmentText', activeId);
        if (sourceRegions.length === 0) sourceRegions = getAioRegionsFromSnapshot('getTranslations', activeId);
        if (sourceRegions.length === 0) sourceRegions = getAioRegionsFromSnapshot('recognizeText', activeId);
        if (sourceRegions.length === 0) sourceRegions = getAioRegionsFromSnapshot('detectText', activeId);
        const renderRegions = sourceRegions.map((region) => applyRenderDefaultsToRegion(region, renderDefaultStyle, applyDetectedGradientToStyle, undefined, aioTgtLang));
        patchAioSnapshotStageForImage(activeId, stageIndex, renderRegions);
      }

      if (!aioAutoProcessedImageById[activeId]) {
        recordProcessedPages(1);
      }

      completeManualStageForImage(activeId, stageIndex, 'done');
      setProgress(100);
      const doneMessage = t('aioManual.stageDone', { stageLabel, fileName: activeImageData.file.name });
      setStatusMessage(executionNotice ? `${doneMessage} ${executionNotice.detail}` : doneMessage);
      if (executionNotice) {
        if (noticeTimeoutRef.current) clearTimeout(noticeTimeoutRef.current);
        noticeTimeoutRef.current = setTimeout(() => {
          setRuntimeExecutionNotice(null);
          noticeTimeoutRef.current = null;
        }, 4500);
      }
    } catch (error) {
      if (
        (error instanceof DOMException && error.name === 'AbortError')
        || (error instanceof Error && error.name === 'AbortError')
      ) {
        setStatusMessage(t('aioManual.executionAborted'));
      } else if (
        (error instanceof DOMException && error.name === 'TimeoutError')
        || (error instanceof Error && error.name === 'TimeoutError')
      ) {
        setStatusMessage(`Timed out during the "${stageLabel}" stage. The local backend took too long to respond.`);
      } else {
        setStatusMessage(error instanceof Error ? error.message : t('aioManual.stageFailed', { stageLabel }));
      }
    } finally {
      setProcessing(false);
      setProgress(0);
      void syncDiscordForTab();
    }
  }, [
    activeId,
    aioAutoProcessedImageById,
    aioDetectionsByImage,
    aioHdCropMargin,
    aioHdCropTriggerSize,
    aioHdResizeLimit,
    aioHdStrategy,
    aioManualProgressByImage,
    aioMaskDilation,
    aioSrcLang,
    aioStageOptions,
    aioStageSelection,
    aioTgtLang,
      applyDetectedGradientToStyle,
      compatibleTranslationModelIds,
      completeManualStageForImage,
      getAbortSignal,
      getAioRegionsFromSnapshot,
      getAioStageOption,
      gpuStages,
      images,
    llmSettings,
    localApiUrl,
    minRegionSize,
    modelEntries,
    parseApiError,
    patchAioSnapshotStageForImage,
    processing,
    renderDefaultStyle,
    selectedCustomOcrProfile,
    selectedCustomTranslationProfile,
    setRuntimeExecutionNotice,
    onStageStart,
    setProcessing,
      setProgress,
      setStatusMessage,
    syncDiscordForTab,
    recordProcessedPages,
    t,
    validateManualLocalStageModel,
  ]);
}
