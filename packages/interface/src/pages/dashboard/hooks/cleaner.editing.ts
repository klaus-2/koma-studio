/**
 * Cleaner region/manual editing — cleaner detections & selection maps, the
 * paint/base/wand manual edit state with editable canvas composers, the
 * magic wand + healing halves owned by the cleaner domain, and the active
 * cleaner region memos. Split out of cleaner.ts (T10); the entry file keeps
 * the run orchestration and re-exports this module.
 */
import { useCallback, useMemo } from 'react';

import { useI18n } from '../../../i18n';
import { EMPTY_AIO_MANUAL_EDIT_STATE } from '../../../constants/dashboard.constants';
import { EMPTY_REGIONS } from '../../../utils/dashboardRenderUtils';
import { fetchWithTimeoutAndRetry } from '../../../utils/http';
import {
  blobToDataUrl,
  buildMagicWandMaskDataUrl,
  canvasToBlob,
  cloneAioRegionsCoW,
  cloneRenderStyle,
  dataUrlToBlob,
  loadImageFromSource,
  resolveSelectedRegionForRegions,
} from '../../../utils/dashboard.utils';
import { parseApiError } from '../helpers';
import type {
  AioManualImageEditState,
  AioTextRegion,
  DownloadItem,
  LoadedImage,
  ProcessableMode,
} from '../../../types/dashboard.types';
import { useAioPipelineStore } from '../stores/aio-pipeline-store';
import { useCleanerStore } from '../stores/cleaner-store';
import { useManualToolsStore } from '../stores/manual-tools-store';
import { useStatusStore } from '../stores/status-store';

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
      const { regions: clonedRegions } = cloneAioRegionsCoW(
        nextRegions,
        cleanerDetectionsByImage[imageId],
        cloneRenderStyle,
      );
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
  const setCleanerManualImageEditsByImage = useCleanerStore(
    (s) => s.setCleanerManualImageEditsByImage,
  );

  const getCleanerManualImageEditState = useCallback(
    (imageId: string): AioManualImageEditState =>
      useCleanerStore.getState().cleanerManualImageEditsByImage[imageId] ??
      EMPTY_AIO_MANUAL_EDIT_STATE,
    [],
  );

  const hasCleanerManualImageEdits = useCallback(
    (imageId: string): boolean => {
      const state =
        useCleanerStore.getState().cleanerManualImageEditsByImage[imageId];
      return Boolean(state?.baseImageDataUrl || state?.paintLayerDataUrl);
    },
    [],
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
      const cleanerState = useCleanerStore.getState();
      const manualState = cleanerState.cleanerManualImageEditsByImage[imgData.id];
      if (manualState?.baseImageDataUrl) return manualState.baseImageDataUrl;
      if (cleanerState.cleanerProcessedBaseByImage[imgData.id])
        return cleanerState.cleanerProcessedBaseByImage[imgData.id]!;
      const baseItem = getCleanerDownloadItemForImage(imgData.id);
      return baseItem?.previewUrl ?? imgData.url;
    },
    [
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
        useCleanerStore.getState().cleanerProcessedBaseByImage[imgData.id] ??
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
          useManualToolsStore.getState().manualImageWandTolerance,
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

/* ── Active cleaner region state: memos for the active image (cleaner store) ── */

export function useActiveCleanerRegionState({ resolvedActiveId }: { resolvedActiveId: string | null }) {
  const activeCleanerDetectionsEntry = useCleanerStore((s) =>
    resolvedActiveId
      ? (s.cleanerDetectionsByImage[resolvedActiveId] ?? null)
      : null,
  );
  const activeCleanerDetections = activeCleanerDetectionsEntry ?? EMPTY_REGIONS;
  const activeCleanerSelectedRegionId = useCleanerStore((s) =>
    resolvedActiveId
      ? (s.cleanerSelectedRegionByImage[resolvedActiveId] ?? null)
      : null,
  );
  const activeCleanerRunMeta = useCleanerStore((s) =>
    resolvedActiveId ? (s.cleanerRunMetaByImage[resolvedActiveId] ?? null) : null,
  );
  const activeCleanerSelectedRegion = useMemo(
    () =>
      activeCleanerDetectionsEntry?.find(
        (region) => region.id === activeCleanerSelectedRegionId,
      ) ?? null,
    [activeCleanerDetectionsEntry, activeCleanerSelectedRegionId],
  );

  return {
    activeCleanerDetections,
    activeCleanerSelectedRegionId,
    activeCleanerSelectedRegion,
    activeCleanerRunMeta,
  };
}
