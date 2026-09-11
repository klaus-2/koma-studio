import { useCallback, useEffect, useMemo, useRef } from 'react';

import { useI18n } from '../../../i18n';
import {
  AIO_STAGE_LABELS,
  EMPTY_AIO_MANUAL_EDIT_STATE,
} from '../../../constants/dashboard.constants';
import type { AioStageOption } from '../../../models/aioStageCatalog';
import type { DiscordActivityPreset } from '../../../types';
import { fetchWithTimeoutAndRetry } from '../../../utils/http';
import {
  blobToDataUrl,
  buildAioSelectionMapFromDetections,
  buildMagicWandMaskDataUrl,
  canvasToBlob,
  clamp,
  cloneAioRegions,
  cloneRenderStyle,
  dataUrlToBlob,
  loadImageFromSource,
  normalizeDetectedGradient,
  normalizeRgbTriplet,
  readExecutionRuntimeNotice,
  resolveSelectedRegionForRegions,
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
import type { CustomLlmProfile } from '../../../utils/customLlm';
import {
  findCustomProfileForSelection,
  getCustomLlmProviderNotice,
} from '../../../utils/customLlm';
import type { useCustomLlmDrafts } from './llm-providers';
import {
  buildCustomStageOption,
  ocrStageOptionSupportsLanguage as ocrModelSupportsLanguage,
} from '../../../models/aioStageCatalog';
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
import { parseApiError } from '../helpers';
import type {
  AioManualImageEditState,
  AioTextRegion,
  CleanerMode,
  CleanerRunMeta,
  DetectApiResponse,
  DownloadItem,
  LoadedImage,
  OcrApiResponse,
  ProcessableMode,
  RuntimeExecutionNotice,
  SegmentApiResponse,
} from '../../../types/dashboard.types';
import { useAioPipelineStore } from '../stores/aio-pipeline-store';
import { useCleanerStore } from '../stores/cleaner-store';
import { useImageCollectionStore } from '../stores/image-collection-store';
import { useLlmProvidersStore } from '../stores/llm-providers-store';
import { useStatusStore } from '../stores/status-store';

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

/* ── Region editing: cleaner detections/selection maps ── */

export function useCleanerRegionEditing() {
  const cleanerDetectionsByImage = useCleanerStore(
    (s) => s.cleanerDetectionsByImage,
  );
  const setCleanerDetectionsByImage = useCleanerStore(
    (s) => s.setCleanerDetectionsByImage,
  );
  const setCleanerSelectedRegionByImage = useCleanerStore(
    (s) => s.setCleanerSelectedRegionByImage,
  );

  const updateCleanerRegionsForImage = useCallback(
    (
      imageId: string,
      nextRegions: AioTextRegion[],
      selectedRegionIdOverride?: string | null,
    ) => {
      const clonedRegions = cloneAioRegions(nextRegions, cloneRenderStyle);
      setCleanerDetectionsByImage((prev) => ({
        ...prev,
        [imageId]: clonedRegions,
      }));
      setCleanerSelectedRegionByImage((prev) => {
        const currentSelected = prev[imageId] ?? null;
        const resolvedSelected =
          selectedRegionIdOverride === undefined
            ? resolveSelectedRegionForRegions(clonedRegions, currentSelected)
            : resolveSelectedRegionForRegions(
                clonedRegions,
                selectedRegionIdOverride,
              );
        return {
          ...prev,
          [imageId]: resolvedSelected,
        };
      });
    },
    [
      resolveSelectedRegionForRegions,
      setCleanerDetectionsByImage,
      setCleanerSelectedRegionByImage,
    ],
  );

  const selectCleanerRegionForImage = useCallback(
    (imageId: string, regionId: string | null) => {
      const regions = cleanerDetectionsByImage[imageId] ?? [];
      const resolvedSelected = resolveSelectedRegionForRegions(
        regions,
        regionId,
      );
      setCleanerSelectedRegionByImage((prev) => ({
        ...prev,
        [imageId]: resolvedSelected,
      }));
    },
    [cleanerDetectionsByImage, resolveSelectedRegionForRegions, setCleanerSelectedRegionByImage],
  );

  return { updateCleanerRegionsForImage, selectCleanerRegionForImage };
}

/* ── Manual edit state (paint/base/wand layers) + editable canvas composers ── */

interface UseCleanerManualEditsArgs {
  /* Cross-domain callback (downloadItems — export-download domain, T10) */
  getCleanerDownloadItemForImage: (imageId: string) => DownloadItem | null;
}

export function useCleanerManualEdits({
  getCleanerDownloadItemForImage,
}: UseCleanerManualEditsArgs) {
  const { t } = useI18n();
  const cleanerManualImageEditsByImage = useCleanerStore(
    (s) => s.cleanerManualImageEditsByImage,
  );
  const cleanerProcessedBaseByImage = useCleanerStore(
    (s) => s.cleanerProcessedBaseByImage,
  );
  const setCleanerManualImageEditsByImage = useCleanerStore(
    (s) => s.setCleanerManualImageEditsByImage,
  );

  const getCleanerManualImageEditState = useCallback(
    (imageId: string): AioManualImageEditState =>
      cleanerManualImageEditsByImage[imageId] ?? EMPTY_AIO_MANUAL_EDIT_STATE,
    [cleanerManualImageEditsByImage],
  );

  const hasCleanerManualImageEdits = useCallback(
    (imageId: string): boolean => {
      const state = cleanerManualImageEditsByImage[imageId];
      return Boolean(state?.baseImageDataUrl || state?.paintLayerDataUrl);
    },
    [cleanerManualImageEditsByImage],
  );

  const patchCleanerManualImageEditState = useCallback(
    (imageId: string, patch: Partial<AioManualImageEditState>) => {
      setCleanerManualImageEditsByImage((prev) => {
        const current = prev[imageId] ?? EMPTY_AIO_MANUAL_EDIT_STATE;
        const nextValue: AioManualImageEditState = {
          ...current,
          ...patch,
        };
        const shouldDelete =
          !nextValue.paintLayerDataUrl &&
          !nextValue.baseImageDataUrl &&
          !nextValue.wandMaskDataUrl;
        if (shouldDelete) {
          if (!prev[imageId]) return prev;
          const { [imageId]: _removed, ...rest } = prev;
          return rest;
        }
        if (
          current.paintLayerDataUrl === nextValue.paintLayerDataUrl &&
          current.baseImageDataUrl === nextValue.baseImageDataUrl &&
          current.wandMaskDataUrl === nextValue.wandMaskDataUrl
        ) {
          return prev;
        }
        return { ...prev, [imageId]: nextValue };
      });
    },
    [setCleanerManualImageEditsByImage],
  );

  const resolveCleanerEditableBaseSourceForImage = useCallback(
    (imgData: LoadedImage): string => {
      const manualState = cleanerManualImageEditsByImage[imgData.id];
      if (manualState?.baseImageDataUrl) return manualState.baseImageDataUrl;
      if (cleanerProcessedBaseByImage[imgData.id])
        return cleanerProcessedBaseByImage[imgData.id]!;
      const baseItem = getCleanerDownloadItemForImage(imgData.id);
      return baseItem?.previewUrl ?? imgData.url;
    },
    [
      cleanerManualImageEditsByImage,
      cleanerProcessedBaseByImage,
      getCleanerDownloadItemForImage,
    ],
  );

  const composeCleanerEditableCanvas = useCallback(
    async (
      imgData: LoadedImage,
      fallbackBaseSource?: string,
      options?: { includePaintLayer?: boolean },
    ): Promise<HTMLCanvasElement> => {
      const includePaintLayer = options?.includePaintLayer ?? true;
      const manualState = getCleanerManualImageEditState(imgData.id);
      const source =
        manualState.baseImageDataUrl ??
        fallbackBaseSource ??
        getCleanerDownloadItemForImage(imgData.id)?.previewUrl ??
        cleanerProcessedBaseByImage[imgData.id] ??
        imgData.url;
      const sourceImage = await loadImageFromSource(source);
      const width =
        sourceImage.naturalWidth || sourceImage.width || imgData.width;
      const height =
        sourceImage.naturalHeight || sourceImage.height || imgData.height;
      const canvas = document.createElement('canvas');
      canvas.width = width;
      canvas.height = height;
      const ctx = canvas.getContext('2d');
      if (!ctx) {
        throw new Error(
          t('dashboard.status.cleanerCanvasInitFailed'),
        );
      }
      ctx.drawImage(sourceImage, 0, 0, width, height);
      if (includePaintLayer && manualState.paintLayerDataUrl) {
        const paintLayer = await loadImageFromSource(
          manualState.paintLayerDataUrl,
        );
        ctx.drawImage(paintLayer, 0, 0, width, height);
      }
      return canvas;
    },
    [
      cleanerProcessedBaseByImage,
      getCleanerDownloadItemForImage,
      getCleanerManualImageEditState,
    ],
  );

  const clearCleanerManualPaintForImage = useCallback(
    (imageId: string) => {
      patchCleanerManualImageEditState(imageId, { paintLayerDataUrl: null });
    },
    [patchCleanerManualImageEditState],
  );

  const resetCleanerManualImageEditsForImage = useCallback(
    (imageId: string) => {
      patchCleanerManualImageEditState(imageId, {
        paintLayerDataUrl: null,
        baseImageDataUrl: null,
        wandMaskDataUrl: null,
      });
    },
    [patchCleanerManualImageEditState],
  );

  return {
    getCleanerManualImageEditState,
    hasCleanerManualImageEdits,
    patchCleanerManualImageEditState,
    resolveCleanerEditableBaseSourceForImage,
    composeCleanerEditableCanvas,
    clearCleanerManualPaintForImage,
    resetCleanerManualImageEditsForImage,
  };
}

/* ── Magic wand + healing (cleaner halves; the AIO halves stay in the page/manual-tools) ── */

interface UseCleanerWandHealingArgs {
  /* Cross-domain values (image-collection, manual-tools T08b, export-download T10) */
  images: LoadedImage[];
  manualImageWandTolerance: number;
  localApiUrl: string;
  setDownloadItems: React.Dispatch<React.SetStateAction<DownloadItem[]>>;
  setLastActionScope: React.Dispatch<React.SetStateAction<ProcessableMode | null>>;
  /* Cleaner manual-edit callbacks (useCleanerManualEdits) */
  patchCleanerManualImageEditState: (
    imageId: string,
    patch: Partial<AioManualImageEditState>,
  ) => void;
  resolveCleanerEditableBaseSourceForImage: (imgData: LoadedImage) => string;
  composeCleanerEditableCanvas: (
    imgData: LoadedImage,
    fallbackBaseSource?: string,
    options?: { includePaintLayer?: boolean },
  ) => Promise<HTMLCanvasElement>;
}

export function useCleanerWandHealing({
  images,
  manualImageWandTolerance,
  localApiUrl,
  setDownloadItems,
  setLastActionScope,
  patchCleanerManualImageEditState,
  resolveCleanerEditableBaseSourceForImage,
  composeCleanerEditableCanvas,
}: UseCleanerWandHealingArgs) {
  const { t } = useI18n();
  const setTonedStatus = useStatusStore((s) => s.setTonedStatus);
  const setCleanerHealingBusyByImage = useCleanerStore(
    (s) => s.setCleanerHealingBusyByImage,
  );
  const setCleanerProcessedBaseByImage = useCleanerStore(
    (s) => s.setCleanerProcessedBaseByImage,
  );
  const aioStageSelection = useAioPipelineStore((s) => s.aioStageSelection);
  const aioMaskDilation = useAioPipelineStore((s) => s.aioMaskDilation);
  const aioHdStrategy = useAioPipelineStore((s) => s.aioHdStrategy);
  const aioHdResizeLimit = useAioPipelineStore((s) => s.aioHdResizeLimit);
  const aioHdCropMargin = useAioPipelineStore((s) => s.aioHdCropMargin);
  const aioHdCropTriggerSize = useAioPipelineStore(
    (s) => s.aioHdCropTriggerSize,
  );

  const runCleanerMagicWandForImage = useCallback(
    async (imageId: string, pointX: number, pointY: number) => {
      const imgData = images.find((item) => item.id === imageId);
      if (!imgData) return;
      try {
        const source = resolveCleanerEditableBaseSourceForImage(imgData);
        const sourceImage = await loadImageFromSource(source);
        const canvas = document.createElement('canvas');
        canvas.width =
          sourceImage.naturalWidth || sourceImage.width || imgData.width;
        canvas.height =
          sourceImage.naturalHeight || sourceImage.height || imgData.height;
        const ctx = canvas.getContext('2d', { willReadFrequently: true });
        if (!ctx)
          throw new Error(t('dashboard.status.cleanerWandPrepFailed'));
        ctx.drawImage(sourceImage, 0, 0, canvas.width, canvas.height);

        const scaleX = canvas.width / Math.max(1, imgData.width);
        const scaleY = canvas.height / Math.max(1, imgData.height);
        const seedX = pointX * scaleX;
        const seedY = pointY * scaleY;
        const nextMaskDataUrl = buildMagicWandMaskDataUrl(
          ctx.getImageData(0, 0, canvas.width, canvas.height),
          seedX,
          seedY,
          manualImageWandTolerance,
        );
        patchCleanerManualImageEditState(imageId, {
          wandMaskDataUrl: nextMaskDataUrl,
        });
        if (nextMaskDataUrl) {
          setTonedStatus(
            t('dashboard.status.cleanerWandSelectionUpdated'),
            'success',
          );
        } else {
          setTonedStatus(
            t('dashboard.status.cleanerWandNoArea'),
            'warning',
          );
        }
      } catch (error) {
        setTonedStatus(
          error instanceof Error
            ? error.message
            : t('dashboard.status.cleanerWandExecFailed'),
          'error',
        );
      }
    },
    [
      images,
      manualImageWandTolerance,
      patchCleanerManualImageEditState,
      resolveCleanerEditableBaseSourceForImage,
      setTonedStatus,
    ],
  );

  const applyCleanerHealingMaskForImage = useCallback(
    async (imageId: string, maskDataUrl: string) => {
      const imgData = images.find((item) => item.id === imageId);
      if (!imgData) return;
      setCleanerHealingBusyByImage((prev) => ({ ...prev, [imageId]: true }));
      try {
        const sourceCanvas = await composeCleanerEditableCanvas(
          imgData,
          resolveCleanerEditableBaseSourceForImage(imgData),
          { includePaintLayer: false },
        );
        const sourceBlob = await canvasToBlob(sourceCanvas, 'image/png', 1);
        const maskBlob = await dataUrlToBlob(maskDataUrl);
        const sourceFile = new File(
          [sourceBlob],
          `cleaner-${imgData.file.name}.png`,
          { type: 'image/png' },
        );
        const maskFile = new File(
          [maskBlob],
          `cleaner-mask-${imgData.file.name}.png`,
          { type: 'image/png' },
        );

        const formData = new FormData();
        formData.append('file', sourceFile);
        formData.append('mask', maskFile);
        formData.append('model_key', aioStageSelection.cleanImage);
        formData.append('mask_dilation', String(aioMaskDilation));
        formData.append('hd_strategy', aioHdStrategy);
        formData.append('hd_strategy_resize_limit', String(aioHdResizeLimit));
        formData.append('hd_strategy_crop_margin', String(aioHdCropMargin));
        formData.append(
          'hd_strategy_crop_trigger_size',
          String(aioHdCropTriggerSize),
        );

        const response = await fetchWithTimeoutAndRetry(
          `${localApiUrl}/inpaint-mask`,
          { method: 'POST', body: formData },
          { timeoutMs: 180_000, retryCount: 0 },
        );
        if (!response.ok) {
          const apiMessage = await parseApiError(response);
          throw new Error(t('dashboard.error.cleanerHealingBrushFailed', { message: apiMessage }));
        }
        const outputBlob = await response.blob();
        if (!outputBlob.type.startsWith('image/')) {
          throw new Error(
            t('dashboard.status.cleanerHealingInvalidResponse'),
          );
        }

        const nextBaseDataUrl = await blobToDataUrl(outputBlob);
        const previewUrl = URL.createObjectURL(outputBlob);
        setCleanerProcessedBaseByImage((prev) => ({
          ...prev,
          [imageId]: nextBaseDataUrl,
        }));
        patchCleanerManualImageEditState(imageId, {
          baseImageDataUrl: nextBaseDataUrl,
          wandMaskDataUrl: null,
        });
        setDownloadItems((prev) => {
          const next: DownloadItem[] = [];
          prev.forEach((item) => {
            if (item.scope === 'cleaner' && item.sourceImageId === imageId) {
              URL.revokeObjectURL(item.previewUrl);
              return;
            }
            next.push(item);
          });
          next.push({
            name: `koma-studio-cleaner-clean-${imgData.file.name.replace(/\s+/g, '-')}.png`,
            blob: outputBlob,
            scope: 'cleaner',
            sourceImageId: imageId,
            previewUrl,
          });
          return next;
        });
        setLastActionScope('cleaner');
        setTonedStatus(`Healing applied in the Cleaner for "${imgData.file.name}".`,
          'success',
        );
      } catch (error) {
        if (
          error instanceof TypeError &&
          /failed to fetch/i.test(error.message)
        ) {
          setTonedStatus(
            t('dashboard.status.cleanerHealingConnectFailed', { url: localApiUrl }),
            'error',
          );
        } else {
          setTonedStatus(
            error instanceof Error
              ? error.message
              : t('dashboard.status.cleanerHealingFailed'),
            'error',
          );
        }
      } finally {
        setCleanerHealingBusyByImage((prev) => {
          if (!prev[imageId]) return prev;
          const { [imageId]: _removed, ...rest } = prev;
          return rest;
        });
      }
    },
    [
      aioHdCropMargin,
      aioHdCropTriggerSize,
      aioHdResizeLimit,
      aioHdStrategy,
      aioMaskDilation,
      aioStageSelection.cleanImage,
      composeCleanerEditableCanvas,
      images,
      localApiUrl,
      parseApiError,
      patchCleanerManualImageEditState,
      resolveCleanerEditableBaseSourceForImage,
      setCleanerHealingBusyByImage,
      setCleanerProcessedBaseByImage,
      setDownloadItems,
      setLastActionScope,
      setTonedStatus,
    ],
  );

  return { runCleanerMagicWandForImage, applyCleanerHealingMaskForImage };
}

/* ── Automatic AI Clean model selection + custom profile reuse ── */

interface UseCleanerModelSelectionArgs {
  /* Page memos (multi-store derived — selector candidates in T12) */
  cleanerAiOptionsForSelect: AioStageOption[];
  cleanStandaloneCustomProfiles: CustomLlmProfile[];
}

export function useCleanerModelSelection({
  cleanerAiOptionsForSelect,
  cleanStandaloneCustomProfiles,
}: UseCleanerModelSelectionArgs) {
  const { t } = useI18n();
  const setTonedStatus = useStatusStore((s) => s.setTonedStatus);
  const setStatusMessage = useStatusStore((s) => s.setStatusMessage);
  const customLlmDrafts = useLlmProvidersStore((s) => s.customLlmDrafts);
  const setCleanerAiModelKey = useCleanerStore((s) => s.setCleanerAiModelKey);

  const useExistingCleanerCustomProfile = useCallback(() => {
    const profileId = customLlmDrafts.clean?.id;
    if (!profileId) {
      setTonedStatus(t('dashboard.status.cleanerSelectProfileFirst'), 'error');
      return;
    }
    const profile =
      cleanStandaloneCustomProfiles.find((item) => item.id === profileId) ?? null;
    if (!profile) {
      setTonedStatus(t('dashboard.status.cleanerProfileNotFound'), 'error');
      return;
    }
    setCleanerAiModelKey(`custom_clean:${profile.id}`);
    setStatusMessage(t('dashboard.status.cleanerProfileInUse', { label: profile.label }));
  }, [customLlmDrafts.clean?.id, cleanStandaloneCustomProfiles, setCleanerAiModelKey, setStatusMessage, setTonedStatus]);

  const selectCleanerAiModel = useCallback(
    (modelKey: string) => {
      const option = cleanerAiOptionsForSelect.find(
        (item) => item.key === modelKey,
      );
      if (!option) {
        setTonedStatus(t('dashboard.status.cleanerSelectValidModel'), 'error');
        return;
      }
      if (!option.implemented) {
        setTonedStatus(t('dashboard.status.modelInRoadmap', { name: option.name }), 'error');
        return;
      }
      if (!option.available) {
        setTonedStatus(t('dashboard.status.modelNeedsConfig', { name: option.name }), 'error');
        return;
      }
      setCleanerAiModelKey(modelKey);
    },
    [cleanerAiOptionsForSelect, setCleanerAiModelKey, setStatusMessage, setTonedStatus],
  );

  return { selectCleanerAiModel, useExistingCleanerCustomProfile };
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

/* ── Active cleaner region state: memos for the active image (cleaner store) ── */

export function useActiveCleanerRegionState({ resolvedActiveId }: { resolvedActiveId: string | null }) {
  const activeId = useImageCollectionStore((s) => s.activeId);
  const cleanerDetectionsByImage = useCleanerStore(
    (s) => s.cleanerDetectionsByImage,
  );
  const cleanerSelectedRegionByImage = useCleanerStore(
    (s) => s.cleanerSelectedRegionByImage,
  );
  const cleanerRunMetaByImage = useCleanerStore(
    (s) => s.cleanerRunMetaByImage,
  );
  const activeCleanerDetections = useMemo(
    () =>
      resolvedActiveId
        ? (cleanerDetectionsByImage[resolvedActiveId] ?? [])
        : [],
    [cleanerDetectionsByImage, resolvedActiveId],
  );
  const activeCleanerSelectedRegionId = useMemo(
    () =>
      resolvedActiveId
        ? (cleanerSelectedRegionByImage[resolvedActiveId] ?? null)
        : null,
    [cleanerSelectedRegionByImage, resolvedActiveId],
  );
  const activeCleanerSelectedRegion = useMemo(
    () =>
      activeCleanerDetections.find(
        (region) => region.id === activeCleanerSelectedRegionId,
      ) ?? null,
    [activeCleanerDetections, activeCleanerSelectedRegionId],
  );
  const activeCleanerRunMeta = useMemo(
    () => (activeId ? (cleanerRunMetaByImage[activeId] ?? null) : null),
    [activeId, cleanerRunMetaByImage],
  );

  return {
    activeCleanerDetections,
    activeCleanerSelectedRegionId,
    activeCleanerSelectedRegion,
    activeCleanerRunMeta,
  };
}


/* ── Cleaner AI stage options: option lists, custom-profile resolution and the
   draft-profile callbacks for the Automatic AI Clean manager (cleaner + llm +
   aio store reads; profile lists arrive from the llm domain by args) ── */

export function useCleanerAiStageOptions({ cleanCustomProfiles }: { cleanCustomProfiles: CustomLlmProfile[] }) {
  const cleanerAiModelKey = useCleanerStore((s) => s.cleanerAiModelKey);
  const cleanerSrcLang = useCleanerStore((s) => s.cleanerSrcLang);
  const customLlmDrafts = useLlmProvidersStore((s) => s.customLlmDrafts);
  const aioStageOptions = useAioPipelineStore((s) => s.aioStageOptions);
  const filteredCleanerOcrStageOptions = useMemo(() => {
    const compatible = aioStageOptions.recognizeText.filter((option) =>
      ocrModelSupportsLanguage(option, cleanerSrcLang),
    );
    return compatible.length > 0 ? compatible : aioStageOptions.recognizeText;
  }, [cleanerSrcLang, aioStageOptions.recognizeText]);
  const cleanerAiCustomOptionsForSelect = useMemo(
    () =>
      cleanCustomProfiles.map((profile) => ({
        ...buildCustomStageOption(profile),
        key: `custom_clean:${profile.id}`,
      })),
    [buildCustomStageOption, cleanCustomProfiles],
  );
  const cleanerAiOptionsForSelect = useMemo(() => {
    const customSelectedOption = cleanerAiCustomOptionsForSelect.find(
      (option) => option.key === cleanerAiModelKey,
    );
    if (customSelectedOption) {
      return [customSelectedOption];
    }
    return [...cleanerAiCustomOptionsForSelect];
  }, [
    cleanerAiCustomOptionsForSelect,
    cleanerAiModelKey,
  ]);
  const selectedCleanerAiDisplayOption = useMemo(() => {
    return (
      cleanerAiOptionsForSelect.find((option) => option.key === cleanerAiModelKey)
      ?? null
    );
  }, [
    cleanerAiOptionsForSelect,
    cleanerAiModelKey,
  ]);
  const selectedCleanerCustomProfile = useMemo(
    () =>
      findCustomProfileForSelection(cleanerAiModelKey, cleanCustomProfiles),
    [cleanerAiModelKey, cleanCustomProfiles],
  );
  const cleanerAiCustomProviderNotice = useMemo(
    () =>
      getCustomLlmProviderNotice(selectedCleanerCustomProfile?.apiBase ?? customLlmDrafts.ocr.apiBase),
    [customLlmDrafts.ocr.apiBase, selectedCleanerCustomProfile?.apiBase],
  );
  return {
    filteredCleanerOcrStageOptions,
    cleanerAiCustomOptionsForSelect,
    cleanerAiOptionsForSelect,
    selectedCleanerAiDisplayOption,
    selectedCleanerCustomProfile,
    cleanerAiCustomProviderNotice,
  };
}


/* ── Cleaner AI draft-profile actions (need the custom-llm drafts hook
   callbacks, which arrive by args; the manager sections consume them) ── */

export function useCleanerAiDraftProfileActions({
  cleanerAiOptionsForSelect,
  saveCustomProfileInline,
  removeCustomLlmProfileById,
}: {
  cleanerAiOptionsForSelect: AioStageOption[];
  saveCustomProfileInline: ReturnType<typeof useCustomLlmDrafts>['saveCustomProfileInline'];
  removeCustomLlmProfileById: ReturnType<typeof useCustomLlmDrafts>['removeCustomLlmProfileById'];
}) {
  const { t } = useI18n();
  const setTonedStatus = useStatusStore((s) => s.setTonedStatus);
  const setStatusMessage = useStatusStore((s) => s.setStatusMessage);
  const cleanerAiModelKey = useCleanerStore((s) => s.cleanerAiModelKey);
  const setCleanerAiModelKey = useCleanerStore((s) => s.setCleanerAiModelKey);
  const customLlmDrafts = useLlmProvidersStore((s) => s.customLlmDrafts);
  const saveCleanerCustomDraftProfile = useCallback(async () => {
    try {
      const profile = await saveCustomProfileInline('clean', customLlmDrafts.clean);
      setCleanerAiModelKey(`custom_clean:${profile.id}`);
      setTonedStatus(t('dashboard.status.cleanerProfileSaved', { label: profile.label }), 'success');
    } catch {
      // saveCustomProfileInline already updates the error message
    }
  }, [customLlmDrafts.clean, saveCustomProfileInline, setCleanerAiModelKey, setStatusMessage, setTonedStatus]);
  const removeCleanerCustomDraftProfile = useCallback(async () => {
    const profileId = customLlmDrafts.clean?.id;
    if (!profileId) {
      setTonedStatus(t('dashboard.status.cleanerSelectProfileToRemove'), 'error');
      return;
    }
    await removeCustomLlmProfileById('clean', profileId);
    if (cleanerAiModelKey === `custom_clean:${profileId}`) {
      const fallbackManagedKey = cleanerAiOptionsForSelect[0]?.key ?? '';
      if (fallbackManagedKey) {
        setCleanerAiModelKey(fallbackManagedKey);
      }
    }
  }, [
    cleanerAiModelKey,
    cleanerAiOptionsForSelect,
    customLlmDrafts.clean?.id,
    removeCustomLlmProfileById,
    setCleanerAiModelKey,
    setStatusMessage,
    setTonedStatus,
  ]);
  return {
    saveCleanerCustomDraftProfile,
    removeCleanerCustomDraftProfile,
  };
}
