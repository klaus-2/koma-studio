import { useCallback } from 'react';

import { useI18n } from '../i18n';
import { fetchWithTimeoutAndRetry } from '../utils/http';
import {
  applyRenderDefaultsToRegion,
  clamp,
  cloneAioRegions,
  cloneRenderStyle,
  normalizeDetectedGradient,
  normalizeRgbTriplet,
  normalizeTranslationNotes,
  readExecutionRuntimeNotice,
} from '../utils/dashboard.utils';
import { createDefaultTypographyShape } from '../typography/types';
import { normalizeDetectedRenderMode } from '../utils/renderModes';
import { type CustomLlmProfile, toCustomLlmRequestPayload } from '../utils/customLlm';
import type { RenderTextStyle } from '../utils/renderText';
import type {
  AioBatchImageResult,
  AioDownloadEntry,
  AioPipelineSnapshotKey,
  AioTextRegion,
  DetectApiResponse,
  LoadedImage,
  OcrApiResponse,
  RuntimeExecutionNotice,
  SegmentApiResponse,
  TranslationApiResponse,
} from '../types/dashboard.types';

interface UseAioSingleImageProcessorArgs {
  localApiUrl: string;
  minRegionSize: number;
  renderDefaultStyle: RenderTextStyle;
  applyDetectedGradientToStyle: (...args: any[]) => any;
  isDesktopRuntime: boolean;
  refreshSession: () => Promise<string | null>;
  parseApiError: (response: Response) => Promise<string>;
  getAbortSignal: () => AbortSignal | null;
  onStageStart: (stageKey: AioPipelineSnapshotKey, image: LoadedImage, index: number) => void;
  setRuntimeExecutionNotice: (notice: RuntimeExecutionNotice | null) => void;
}

export interface GpuStagePreferences {
  detectText: boolean;
  recognizeText: boolean;
  segmentText: boolean;
  cleanImage: boolean;
}

interface SingleImageRunConfig {
  sourceLanguage: string;
  targetLanguage: string;
  detectSelectionKey: string;
  ocrSelectionKey: string;
  translationSelectionKey: string;
  segmentSelectionKey: string;
  cleanSelectionKey: string;
  aioSteps: {
    recognizeText: boolean;
    getTranslations: boolean;
    segmentText: boolean;
    cleanImage: boolean;
    render: boolean;
  };
  useCloudOcr: boolean;
  useLlmSettingsForOcr: boolean;
  useLlmSettingsForTranslation: boolean;
  llmSettings: unknown;
  selectedCustomOcrProfile: CustomLlmProfile | null;
  selectedCustomTranslationProfile: CustomLlmProfile | null;
  maskDilation: number;
  hdStrategy: string;
  hdResizeLimit: number;
  hdCropMargin: number;
  hdCropTriggerSize: number;
  gpuStages?: GpuStagePreferences;
}

export function useAioSingleImageProcessor({
  localApiUrl,
  minRegionSize,
  renderDefaultStyle,
  applyDetectedGradientToStyle,
  isDesktopRuntime,
  refreshSession,
  parseApiError,
  getAbortSignal,
  onStageStart,
  setRuntimeExecutionNotice,
}: UseAioSingleImageProcessorArgs) {
  const { t } = useI18n();

  return useCallback(async (
    imgData: LoadedImage,
    index: number,
    {
      sourceLanguage,
      targetLanguage,
      detectSelectionKey,
      ocrSelectionKey,
      translationSelectionKey,
      segmentSelectionKey,
      cleanSelectionKey,
      aioSteps,
      useCloudOcr,
      useLlmSettingsForOcr,
      useLlmSettingsForTranslation,
      llmSettings,
      selectedCustomOcrProfile,
      selectedCustomTranslationProfile,
      maskDilation,
      hdStrategy,
      hdResizeLimit,
      hdCropMargin,
      hdCropTriggerSize,
      gpuStages,
    }: SingleImageRunConfig,
  ): Promise<AioBatchImageResult> => {
    const executionNotices: string[] = [];
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

    const formData = new FormData();
    assertNotAborted();
    onStageStart('detectText', imgData, index);
    formData.append('file', imgData.file);
    formData.append('model_key', detectSelectionKey);
    formData.append('language', sourceLanguage);
    formData.append('source_language', sourceLanguage);
    if (gpuStages) formData.append('use_gpu', String(gpuStages.detectText));

    const response = await fetchWithTimeoutAndRetry(
      `${localApiUrl}/detect`,
      { method: 'POST', body: formData },
      { timeoutMs: 90_000, retryCount: 0, signal: signal ?? undefined },
    );
    if (!response.ok) {
      const detectFailureNotice = await readExecutionRuntimeNotice(response, 'Detectar Texto');
      if (detectFailureNotice) {
        executionNotices.push(detectFailureNotice.detail);
        setRuntimeExecutionNotice(detectFailureNotice);
      }
      const message = await parseApiError(response);
      throw new Error(`Failed to detect text in "${imgData.file.name}": ${message}`);
    }
    const detectNotice = await readExecutionRuntimeNotice(response, 'Detectar Texto');
    if (detectNotice) {
      executionNotices.push(detectNotice.detail);
      setRuntimeExecutionNotice(detectNotice);
    }

    const payload = (await response.json()) as DetectApiResponse;
    const sourceWidth = payload.image_width > 0 ? payload.image_width : imgData.width;
    const sourceHeight = payload.image_height > 0 ? payload.image_height : imgData.height;
    const scaleX = imgData.width / Math.max(1, sourceWidth);
    const scaleY = imgData.height / Math.max(1, sourceHeight);
    const normalizedDetections = payload.detections
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
        const boxWidth = x2 - x1;
        const boxHeight = y2 - y1;
        if (boxWidth < minRegionSize || boxHeight < minRegionSize) return null;

        const areaRatio = ((rawX2 - rawX1) * (rawY2 - rawY1)) / Math.max(1, sourceWidth * sourceHeight);
        if (areaRatio > 0.75 && item.score < 0.9) return null;

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
            normalizeDetectedRenderMode(item.label) === 'text_bubble' || normalizeDetectedRenderMode(item.label) === 'text_inside_black_bubble'
              ? 'rounded'
              : 'square',
            'detected',
          ),
        };
      })
      .filter((item): item is AioTextRegion => item !== null);

    const detectDetections = cloneAioRegions(normalizedDetections, cloneRenderStyle);
    let enrichedDetections = cloneAioRegions(normalizedDetections, cloneRenderStyle);

    if (aioSteps.recognizeText && normalizedDetections.length > 0) {
      assertNotAborted();
      onStageStart('recognizeText', imgData, index);
      const ocrFormData = new FormData();
      ocrFormData.append('file', imgData.file);
      ocrFormData.append('model_key', ocrSelectionKey);
      ocrFormData.append('language', sourceLanguage);
      ocrFormData.append(
        'regions',
        JSON.stringify(
          normalizedDetections.map((region) => ({
            id: region.id,
            bbox: region.bbox,
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
        const ocrFailureNotice = await readExecutionRuntimeNotice(ocrResponse, 'Reconhecer Texto');
        if (ocrFailureNotice) {
          executionNotices.push(ocrFailureNotice.detail);
          setRuntimeExecutionNotice(ocrFailureNotice);
        }
        const message = await parseApiError(ocrResponse);
        throw new Error(`Failed to recognize text in "${imgData.file.name}": ${message}`);
      }
      const ocrNotice = await readExecutionRuntimeNotice(ocrResponse, 'Reconhecer Texto');
      if (ocrNotice) {
        executionNotices.push(ocrNotice.detail);
        setRuntimeExecutionNotice(ocrNotice);
      }
      const ocrPayload = (await ocrResponse.json()) as OcrApiResponse;
      const ocrById = new Map(ocrPayload.regions.map((region) => [region.id, region]));
      enrichedDetections = normalizedDetections.map((region) => {
        const match = ocrById.get(region.id);
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

    const ocrDetections = cloneAioRegions(enrichedDetections, cloneRenderStyle);
    const hasTextForTranslation = enrichedDetections.some((region) => (region.recognizedText ?? '').trim().length > 0);

    if (aioSteps.getTranslations && hasTextForTranslation) {
      assertNotAborted();
      onStageStart('getTranslations', imgData, index);
      const translateFormData = new FormData();
      translateFormData.append('model_key', translationSelectionKey);
      translateFormData.append('source_language', sourceLanguage);
      translateFormData.append('target_language', targetLanguage);
      if (useLlmSettingsForTranslation) {
        translateFormData.append('file', imgData.file);
        translateFormData.append('llm_settings', JSON.stringify(llmSettings));
        const customPayload = toCustomLlmRequestPayload(selectedCustomTranslationProfile);
        if (customPayload) {
          translateFormData.append('custom_llm', JSON.stringify(customPayload));
        }
      }
      translateFormData.append(
        'regions',
        JSON.stringify(
          enrichedDetections.map((region) => ({
            id: region.id,
            text: region.recognizedText ?? '',
            source: region.source,
            detector_model_key: region.detectorModelKey ?? region.modelKey,
            ocr_model_key: region.ocrModelKey ?? ocrSelectionKey,
          })),
        ),
      );

      const translationRequestUrl = `${localApiUrl}/translate`;
      const translationResponse = await fetchWithTimeoutAndRetry(
        translationRequestUrl,
        { method: 'POST', body: translateFormData },
        { timeoutMs: 120_000, retryCount: 0, signal: signal ?? undefined },
      );
      if (!translationResponse.ok) {
        const message = await parseApiError(translationResponse);
        throw new Error(`Failed to translate text in "${imgData.file.name}": ${message}`);
      }
      const translationPayload = (await translationResponse.json()) as TranslationApiResponse;
      const translationById = new Map(translationPayload.regions.map((region) => [region.id, region]));
      enrichedDetections = enrichedDetections.map((region) => {
        const match = translationById.get(region.id);
        if (!match) return region;
        return {
          ...region,
          translatedText: match.translated_text,
          translationNotes: normalizeTranslationNotes(match.translation_notes),
          translationNoteOverlay: undefined,
          translatorModelKey: match.translator_model_key,
        };
      });
    }

    const translationDetections = cloneAioRegions(enrichedDetections, cloneRenderStyle);

    if (aioSteps.segmentText && enrichedDetections.length > 0) {
      assertNotAborted();
      onStageStart('segmentText', imgData, index);
      const segmentFormData = new FormData();
      segmentFormData.append('file', imgData.file);
      segmentFormData.append('model_key', segmentSelectionKey);
      if (gpuStages) segmentFormData.append('use_gpu', String(gpuStages.segmentText));
      segmentFormData.append(
        'regions',
        JSON.stringify(
          enrichedDetections.map((region) => ({
            id: region.id,
            bbox: region.bbox,
            source: region.source,
            detector_model_key: region.detectorModelKey ?? region.modelKey,
            ocr_model_key: region.ocrModelKey ?? ocrSelectionKey,
            translator_model_key: region.translatorModelKey ?? translationSelectionKey,
          })),
        ),
      );

      const segmentResponse = await fetchWithTimeoutAndRetry(
        `${localApiUrl}/segment`,
        { method: 'POST', body: segmentFormData },
        { timeoutMs: 120_000, retryCount: 0, signal: signal ?? undefined },
      );
      if (!segmentResponse.ok) {
        const segmentFailureNotice = await readExecutionRuntimeNotice(segmentResponse, 'Segmentar Texto');
        if (segmentFailureNotice) {
          executionNotices.push(segmentFailureNotice.detail);
          setRuntimeExecutionNotice(segmentFailureNotice);
        }
        const message = await parseApiError(segmentResponse);
        throw new Error(`Failed to segment text in "${imgData.file.name}": ${message}`);
      }

      const segmentPayload = (await segmentResponse.json()) as SegmentApiResponse;
      const segmentById = new Map(segmentPayload.regions.map((region) => [region.id, region]));
      enrichedDetections = enrichedDetections.map((region) => {
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
    }

    const segmentDetections = cloneAioRegions(enrichedDetections, cloneRenderStyle);
    let cleanedDownload: AioDownloadEntry | null = null;

    if (aioSteps.cleanImage) {
      assertNotAborted();
      onStageStart('cleanImage', imgData, index);
      const inpaintFormData = new FormData();
      inpaintFormData.append('file', imgData.file);
      inpaintFormData.append('model_key', cleanSelectionKey);
      if (gpuStages) inpaintFormData.append('use_gpu', String(gpuStages.cleanImage));
      inpaintFormData.append('mask_dilation', String(maskDilation));
      inpaintFormData.append('hd_strategy', hdStrategy);
      inpaintFormData.append('hd_strategy_resize_limit', String(hdResizeLimit));
      inpaintFormData.append('hd_strategy_crop_margin', String(hdCropMargin));
      inpaintFormData.append('hd_strategy_crop_trigger_size', String(hdCropTriggerSize));
      inpaintFormData.append(
        'regions',
        JSON.stringify(
          enrichedDetections.map((region) => ({
            id: region.id,
            bbox: region.bbox,
            source: region.source,
            detector_model_key: region.detectorModelKey ?? region.modelKey,
            ocr_model_key: region.ocrModelKey ?? ocrSelectionKey,
            translator_model_key: region.translatorModelKey ?? translationSelectionKey,
            segment_model_key: region.segmentModelKey ?? segmentSelectionKey,
            segment_boxes: region.segmentBoxes ?? [],
            merged_boxes: region.mergedSegmentBoxes ?? [],
            mask_base64: region.maskBase64 ?? '',
          })),
        ),
      );

      const inpaintResponse = await fetchWithTimeoutAndRetry(
        `${localApiUrl}/inpaint`,
        { method: 'POST', body: inpaintFormData },
        { timeoutMs: 180_000, retryCount: 0, signal: signal ?? undefined },
      );
      if (!inpaintResponse.ok) {
        const cleanFailureNotice = await readExecutionRuntimeNotice(inpaintResponse, 'Clean Image');
        if (cleanFailureNotice) {
          executionNotices.push(cleanFailureNotice.detail);
          setRuntimeExecutionNotice(cleanFailureNotice);
        }
        const message = await parseApiError(inpaintResponse);
        throw new Error(`Failed to clean the image "${imgData.file.name}": ${message}`);
      }
      const cleanNotice = await readExecutionRuntimeNotice(inpaintResponse, 'Clean Image');
      if (cleanNotice) {
        executionNotices.push(cleanNotice.detail);
        setRuntimeExecutionNotice(cleanNotice);
      }

      const inpaintBlob = await inpaintResponse.blob();
      if (!inpaintBlob.type.startsWith('image/')) {
        throw new Error(t('aioSingleProcessor.invalidCleanResponse', { fileName: imgData.file.name }));
      }

      cleanedDownload = {
        fileName: `koma-studio-aio-clean-${imgData.file.name.replace(/\s+/g, '-')}.png`,
        blob: inpaintBlob,
        sourceImageId: imgData.id,
      };
    }

    const cleanDetections = cloneAioRegions(enrichedDetections, cloneRenderStyle);

    if (aioSteps.render) {
      assertNotAborted();
      onStageStart('render', imgData, index);
      enrichedDetections = enrichedDetections.map((region) =>
        applyRenderDefaultsToRegion(region, renderDefaultStyle, applyDetectedGradientToStyle, undefined, targetLanguage));
    }

    return {
      imageId: imgData.id,
      detectDetections,
      ocrDetections,
      translationDetections,
      segmentDetections,
      cleanDetections,
      renderDetections: cloneAioRegions(enrichedDetections, cloneRenderStyle),
      cleanedDownload,
      countAsProcessed: true,
      executionNotices,
    };
  }, [
    applyDetectedGradientToStyle,
    isDesktopRuntime,
    localApiUrl,
    minRegionSize,
    getAbortSignal,
    onStageStart,
    parseApiError,
    refreshSession,
    renderDefaultStyle,
    setRuntimeExecutionNotice,
    t,
  ]);
}
