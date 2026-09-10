import { useCallback, useMemo, useEffect } from 'react';

import { useI18n } from '../../../i18n';
import { EMPTY_AIO_MANUAL_EDIT_STATE } from '../../../constants/dashboard.constants';
import type {
  AioManualImageEditState,
  AioPipelineSnapshotKey,
  AioTextRegion,
  DownloadItem,
  LoadedImage,
  ManualImageEditTool,
} from '../../../types/dashboard.types';
import {
  blobToDataUrl,
  buildMagicWandMaskDataUrl,
  canvasToBlob,
  dataUrlToBlob,
  loadImageFromSource,
} from '../../../utils/dashboard.utils';
import { fetchWithTimeoutAndRetry } from '../../../utils/http';
import { parseApiError } from '../helpers';
import { useAioPipelineStore } from '../stores/aio-pipeline-store';
import { useCleanerStore } from '../stores/cleaner-store';
import { useImageCollectionStore } from '../stores/image-collection-store';
import { useManualToolsStore } from '../stores/manual-tools-store';
import { useStatusStore } from '../stores/status-store';
import { useUiShellStore } from '../stores/ui-shell-store';

interface UseAioManualEditsArgs {
  /* Cross-domain value (export-download T10) */
  getAioDownloadItemForImage: (imageId: string) => DownloadItem | null;
}

/* ── AIO manual edit layers (paint/base/wand/segment brush) ── */

export function useAioManualEdits({
  getAioDownloadItemForImage,
}: UseAioManualEditsArgs) {
  const { t } = useI18n();
  const aioManualImageEditsByImage = useManualToolsStore(
    (s) => s.aioManualImageEditsByImage,
  );
  const setAioManualImageEditsByImage = useManualToolsStore(
    (s) => s.setAioManualImageEditsByImage,
  );

  const getAioManualImageEditState = useCallback(
    (imageId: string): AioManualImageEditState =>
      aioManualImageEditsByImage[imageId] ?? EMPTY_AIO_MANUAL_EDIT_STATE,
    [aioManualImageEditsByImage],
  );

  const hasAioManualImageEdits = useCallback(
    (imageId: string): boolean => {
      const state = aioManualImageEditsByImage[imageId];
      return Boolean(state?.baseImageDataUrl || state?.paintLayerDataUrl);
    },
    [aioManualImageEditsByImage],
  );

  const patchAioManualImageEditState = useCallback(
    (imageId: string, patch: Partial<AioManualImageEditState>) => {
      setAioManualImageEditsByImage((prev) => {
        const current = prev[imageId] ?? EMPTY_AIO_MANUAL_EDIT_STATE;
        const nextValue: AioManualImageEditState = {
          ...current,
          ...patch,
        };
        const shouldDelete =
          !nextValue.paintLayerDataUrl &&
          !nextValue.baseImageDataUrl &&
          !nextValue.wandMaskDataUrl &&
          !nextValue.segmentBrushDataUrl;
        if (shouldDelete) {
          if (!prev[imageId]) return prev;
          const { [imageId]: _removed, ...rest } = prev;
          return rest;
        }
        if (
          current.paintLayerDataUrl === nextValue.paintLayerDataUrl &&
          current.baseImageDataUrl === nextValue.baseImageDataUrl &&
          current.wandMaskDataUrl === nextValue.wandMaskDataUrl &&
          current.segmentBrushDataUrl === nextValue.segmentBrushDataUrl
        ) {
          return prev;
        }
        return { ...prev, [imageId]: nextValue };
      });
    },
    [setAioManualImageEditsByImage],
  );

  const resolveAioEditableBaseSourceForImage = useCallback(
    (imgData: LoadedImage): string => {
      const manualState = aioManualImageEditsByImage[imgData.id];
      if (manualState?.baseImageDataUrl) return manualState.baseImageDataUrl;
      const baseItem = getAioDownloadItemForImage(imgData.id);
      return baseItem?.previewUrl ?? imgData.url;
    },
    [aioManualImageEditsByImage, getAioDownloadItemForImage],
  );

  const composeAioEditableCanvas = useCallback(
    async (
      imgData: LoadedImage,
      fallbackBaseSource?: string,
      options?: { includePaintLayer?: boolean },
    ): Promise<HTMLCanvasElement> => {
      const includePaintLayer = options?.includePaintLayer ?? true;
      const manualState = getAioManualImageEditState(imgData.id);
      const source =
        manualState.baseImageDataUrl ??
        fallbackBaseSource ??
        getAioDownloadItemForImage(imgData.id)?.previewUrl ??
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
        throw new Error(t('dashboard.status.canvasInitFailed'));
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
    [getAioDownloadItemForImage, getAioManualImageEditState],
  );

  const clearAioManualPaintForImage = useCallback(
    (imageId: string) => {
      patchAioManualImageEditState(imageId, { paintLayerDataUrl: null });
    },
    [patchAioManualImageEditState],
  );

  const resetAioManualImageEditsForImage = useCallback(
    (imageId: string) => {
      patchAioManualImageEditState(imageId, {
        paintLayerDataUrl: null,
        baseImageDataUrl: null,
        wandMaskDataUrl: null,
      });
    },
    [patchAioManualImageEditState],
  );

  return {
    getAioManualImageEditState,
    hasAioManualImageEdits,
    patchAioManualImageEditState,
    resolveAioEditableBaseSourceForImage,
    composeAioEditableCanvas,
    clearAioManualPaintForImage,
    resetAioManualImageEditsForImage,
  };
}

/* ── Magic wand + healing (AIO halves; the cleaner halves live in hooks/cleaner.ts) ── */

interface UseAioWandHealingArgs {
  /* Cross-domain values (image-collection, manual-tools slot, aio page wiring) */
  images: LoadedImage[];
  manualImageWandTolerance: number;
  localApiUrl: string;
  /* AIO manual-edit callbacks (useAioManualEdits) */
  getAioManualImageEditState: (imageId: string) => AioManualImageEditState;
  patchAioManualImageEditState: (
    imageId: string,
    patch: Partial<AioManualImageEditState>,
  ) => void;
  resolveAioEditableBaseSourceForImage: (imgData: LoadedImage) => string;
  composeAioEditableCanvas: (
    imgData: LoadedImage,
    fallbackBaseSource?: string,
    options?: { includePaintLayer?: boolean },
  ) => Promise<HTMLCanvasElement>;
  /* Cleaner half callbacks (useCleanerManualEdits / useCleanerWandHealing) */
  getCleanerManualImageEditState: (imageId: string) => AioManualImageEditState;
  applyCleanerHealingMaskForImage: (imageId: string, maskDataUrl: string) => Promise<void>;
}

export function useAioWandHealing({
  images,
  manualImageWandTolerance,
  localApiUrl,
  getAioManualImageEditState,
  patchAioManualImageEditState,
  resolveAioEditableBaseSourceForImage,
  composeAioEditableCanvas,
  getCleanerManualImageEditState,
  applyCleanerHealingMaskForImage,
}: UseAioWandHealingArgs) {
  const { t } = useI18n();
  const setTonedStatus = useStatusStore((s) => s.setTonedStatus);
  const setAioManualHealingBusyByImage = useManualToolsStore(
    (s) => s.setAioManualHealingBusyByImage,
  );
  const activeId = useImageCollectionStore((s) => s.activeId);
  const mode = useUiShellStore((s) => s.mode);
  const aioStageSelection = useAioPipelineStore((s) => s.aioStageSelection);
  const aioMaskDilation = useAioPipelineStore((s) => s.aioMaskDilation);
  const aioHdStrategy = useAioPipelineStore((s) => s.aioHdStrategy);
  const aioHdResizeLimit = useAioPipelineStore((s) => s.aioHdResizeLimit);
  const aioHdCropMargin = useAioPipelineStore((s) => s.aioHdCropMargin);
  const aioHdCropTriggerSize = useAioPipelineStore(
    (s) => s.aioHdCropTriggerSize,
  );

  const runAioMagicWandForImage = useCallback(
    async (imageId: string, pointX: number, pointY: number) => {
      const imgData = images.find((item) => item.id === imageId);
      if (!imgData) return;
      try {
        const source = resolveAioEditableBaseSourceForImage(imgData);
        const sourceImage = await loadImageFromSource(source);
        const canvas = document.createElement('canvas');
        canvas.width =
          sourceImage.naturalWidth || sourceImage.width || imgData.width;
        canvas.height =
          sourceImage.naturalHeight || sourceImage.height || imgData.height;
        const ctx = canvas.getContext('2d', { willReadFrequently: true });
        if (!ctx) throw new Error(t('dashboard.status.wandPrepFailed'));
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
        patchAioManualImageEditState(imageId, {
          wandMaskDataUrl: nextMaskDataUrl,
        });
        if (nextMaskDataUrl) {
          setTonedStatus(
            t('dashboard.status.wandSelectionUpdated'),
            'success',
          );
        } else {
          setTonedStatus(
            t('dashboard.status.wandNoArea'),
            'warning',
          );
        }
      } catch (error) {
        setTonedStatus(
          error instanceof Error
            ? error.message
            : t('dashboard.status.wandExecFailed'),
          'error',
        );
      }
    },
    [
      images,
      manualImageWandTolerance,
      patchAioManualImageEditState,
      resolveAioEditableBaseSourceForImage,
      setTonedStatus,
    ],
  );

  const applyAioHealingMaskForImage = useCallback(
    async (imageId: string, maskDataUrl: string) => {
      const imgData = images.find((item) => item.id === imageId);
      if (!imgData) return;
      setAioManualHealingBusyByImage((prev) => ({ ...prev, [imageId]: true }));
      try {
        const sourceCanvas = await composeAioEditableCanvas(
          imgData,
          resolveAioEditableBaseSourceForImage(imgData),
          { includePaintLayer: false },
        );
        const sourceBlob = await canvasToBlob(sourceCanvas, 'image/png', 1);
        const maskBlob = await dataUrlToBlob(maskDataUrl);
        const sourceFile = new File(
          [sourceBlob],
          `manual-${imgData.file.name}.png`,
          { type: 'image/png' },
        );
        const maskFile = new File([maskBlob], `mask-${imgData.file.name}.png`, {
          type: 'image/png',
        });

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
          throw new Error(t('dashboard.error.healingBrushFailed', { message: apiMessage }));
        }
        const outputBlob = await response.blob();
        if (!outputBlob.type.startsWith('image/')) {
          throw new Error(t('dashboard.status.healingInvalidResponse'));
        }
        const nextBaseDataUrl = await blobToDataUrl(outputBlob);
        patchAioManualImageEditState(imageId, {
          baseImageDataUrl: nextBaseDataUrl,
          wandMaskDataUrl: null,
        });
        setTonedStatus(`Healing aplicado em "${imgData.file.name}".`,
          'success',
        );
      } catch (error) {
        if (
          error instanceof TypeError &&
          /failed to fetch/i.test(error.message)
        ) {
          setTonedStatus(
            `Healing failed to reach the backend (${localApiUrl}). Check that the mini-backend is running.`,
            'error',
          );
        } else {
          setTonedStatus(
            error instanceof Error
              ? error.message
              : t('dashboard.status.healingBrushApplyFailed'),
            'error',
          );
        }
      } finally {
        setAioManualHealingBusyByImage((prev) => {
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
      localApiUrl,
      composeAioEditableCanvas,
      images,
      parseApiError,
      patchAioManualImageEditState,
      resolveAioEditableBaseSourceForImage,
      setAioManualHealingBusyByImage,
      setTonedStatus,
    ],
  );

  const applyHealingFromActiveWandSelection = useCallback(async () => {
    if (!activeId) return;
    const maskDataUrl =
      mode === 'cleaner'
        ? getCleanerManualImageEditState(activeId).wandMaskDataUrl
        : getAioManualImageEditState(activeId).wandMaskDataUrl;
    if (!maskDataUrl) {
      setTonedStatus(t('dashboard.status.wandNoSelectionForHealing'), 'error');
      return;
    }
    if (mode === 'cleaner') {
      await applyCleanerHealingMaskForImage(activeId, maskDataUrl);
      return;
    }
    await applyAioHealingMaskForImage(activeId, maskDataUrl);
  }, [
    activeId,
    applyAioHealingMaskForImage,
    applyCleanerHealingMaskForImage,
    getAioManualImageEditState,
    getCleanerManualImageEditState,
    mode,
    setTonedStatus,
  ]);

  return {
    runAioMagicWandForImage,
    applyAioHealingMaskForImage,
    applyHealingFromActiveWandSelection,
  };
}

/* ── Active tool toggling + dock config gating effects (manual-tools) ── */

interface UseManualToolTogglesArgs {
  /* Cross-domain inputs for the tool-gating memos (aio stage key + cleaner detections) */
  activeAioStageKey: AioPipelineSnapshotKey;
  activeCleanerDetections: AioTextRegion[];
  resolvedActiveId: string | null;
}

export function useManualToolToggles({
  activeAioStageKey,
  activeCleanerDetections,
  resolvedActiveId,
}: UseManualToolTogglesArgs) {
  const mode = useUiShellStore((s) => s.mode);
  const subMode = useUiShellStore((s) => s.subMode);
  const isAioManualMode = useMemo(
    () => mode === 'aio' && subMode === 'manual',
    [mode, subMode],
  );
  const isCleanerToolMode = mode === 'cleaner';
  const activeStageAllowsAreaTools = useMemo(
    () =>
      isAioManualMode &&
      (activeAioStageKey === 'detectText' || activeAioStageKey === 'render'),
    [activeAioStageKey, isAioManualMode],
  );
  const activeStageAllowsSegmentTools = useMemo(
    () =>
      (isAioManualMode && activeAioStageKey === 'segmentText') ||
      (isCleanerToolMode && activeCleanerDetections.length > 0),
    [
      activeAioStageKey,
      activeCleanerDetections.length,
      isAioManualMode,
      isCleanerToolMode,
    ],
  );
  const activeStageAllowsManualImageTools = useMemo(
    () =>
      (isAioManualMode && activeAioStageKey === 'render') ||
      (isCleanerToolMode && Boolean(resolvedActiveId)),
    [
      activeAioStageKey,
      isAioManualMode,
      isCleanerToolMode,
      resolvedActiveId,
    ],
  );
  const segmentEditTool = useManualToolsStore((s) => s.segmentEditTool);
  const manualImageTool = useManualToolsStore((s) => s.manualImageTool);
  const setSegmentEditTool = useManualToolsStore((s) => s.setSegmentEditTool);
  const setManualImageTool = useManualToolsStore((s) => s.setManualImageTool);
  const setManualToolsConfigOpen = useManualToolsStore(
    (s) => s.setManualToolsConfigOpen,
  );
  const setHealingHintTrigger = useManualToolsStore(
    (s) => s.setHealingHintTrigger,
  );

  const tryShowHealingHint = useCallback(() => {
    setHealingHintTrigger((v) => v + 1);
  }, [setHealingHintTrigger]);

  useEffect(() => {
    if (!activeStageAllowsSegmentTools && segmentEditTool !== 'select') {
      setSegmentEditTool('select');
    }
  }, [activeStageAllowsSegmentTools, segmentEditTool, setSegmentEditTool]);
  useEffect(() => {
    if (!activeStageAllowsManualImageTools && manualImageTool !== 'none') {
      setManualImageTool('none');
      return;
    }
    if (!activeStageAllowsManualImageTools || manualImageTool === 'none') {
      const areaSelectionHasConfig =
        activeStageAllowsAreaTools &&
        segmentEditTool === 'select' &&
        manualImageTool === 'none';
      if (!areaSelectionHasConfig) {
        setManualToolsConfigOpen(false);
      }
    }
  }, [activeStageAllowsAreaTools, activeStageAllowsManualImageTools, manualImageTool, segmentEditTool, setManualImageTool, setManualToolsConfigOpen]);

  const toggleManualImageTool = useCallback(
    (tool: Exclude<ManualImageEditTool, 'none'>) => {
      if (!activeStageAllowsManualImageTools) return;
      const sameTool = manualImageTool === tool;
      setSegmentEditTool('select');
      setManualImageTool(sameTool ? 'none' : tool);
      setManualToolsConfigOpen(!sameTool);
      if (!sameTool && tool === 'healing_brush') {
        tryShowHealingHint();
      }
    },
    [activeStageAllowsManualImageTools, manualImageTool, setManualImageTool, setManualToolsConfigOpen, setSegmentEditTool, tryShowHealingHint],
  );

  const manualImageToolHasConfig = useMemo(
    () =>
      manualImageTool === 'paint' ||
      manualImageTool === 'paint_eraser' ||
      manualImageTool === 'healing_brush' ||
      manualImageTool === 'magic_wand',
    [manualImageTool],
  );

  const toggleManualToolsConfig = useCallback(() => {
    const hasAreaSelectionConfig =
      activeStageAllowsAreaTools &&
      segmentEditTool === 'select' &&
      manualImageTool === 'none';
    const hasSegmentConfig =
      activeStageAllowsSegmentTools &&
      (segmentEditTool === 'brush' || segmentEditTool === 'eraser');
    const hasManualConfig =
      activeStageAllowsManualImageTools && manualImageToolHasConfig;
    if (!hasAreaSelectionConfig && !hasSegmentConfig && !hasManualConfig) return;
    setManualToolsConfigOpen((current) => !current);
  }, [
    activeStageAllowsAreaTools,
    activeStageAllowsManualImageTools,
    activeStageAllowsSegmentTools,
    manualImageTool,
    manualImageToolHasConfig,
    segmentEditTool,
    setManualToolsConfigOpen,
  ]);

  return {
    isAioManualMode,
    activeStageAllowsAreaTools,
    activeStageAllowsSegmentTools,
    activeStageAllowsManualImageTools,
    tryShowHealingHint,
    manualImageToolHasConfig,
    toggleManualImageTool,
    toggleManualToolsConfig,
  };
}

/* ── Active-image manual edit state (mode-dependent aio/cleaner switch) ── */

interface UseActiveManualEditStateArgs {
  resolvedActiveId: string | null;
  getAioManualImageEditState: (imageId: string) => AioManualImageEditState;
  getCleanerManualImageEditState: (imageId: string) => AioManualImageEditState;
}

export function useActiveManualEditState({
  resolvedActiveId,
  getAioManualImageEditState,
  getCleanerManualImageEditState,
}: UseActiveManualEditStateArgs) {
  const mode = useUiShellStore((s) => s.mode);
  const aioManualHealingBusyByImage = useManualToolsStore(
    (s) => s.aioManualHealingBusyByImage,
  );
  const cleanerHealingBusyByImage = useCleanerStore(
    (s) => s.cleanerHealingBusyByImage,
  );
  const activeManualImageEditState = useMemo(() => {
    if (!resolvedActiveId) return EMPTY_AIO_MANUAL_EDIT_STATE;
    if (mode === 'cleaner')
      return getCleanerManualImageEditState(resolvedActiveId);
    return getAioManualImageEditState(resolvedActiveId);
  }, [
    getAioManualImageEditState,
    getCleanerManualImageEditState,
    mode,
    resolvedActiveId,
  ]);
  const activeManualHealingBusy = useMemo(
    () =>
      Boolean(
        resolvedActiveId &&
        (mode === 'cleaner'
          ? cleanerHealingBusyByImage[resolvedActiveId]
          : aioManualHealingBusyByImage[resolvedActiveId]),
      ),
    [
      aioManualHealingBusyByImage,
      cleanerHealingBusyByImage,
      mode,
      resolvedActiveId,
    ],
  );
  const activeHasManualPaintLayer = useMemo(
    () => Boolean(activeManualImageEditState.paintLayerDataUrl),
    [activeManualImageEditState.paintLayerDataUrl],
  );
  const activeHasManualBaseOverride = useMemo(
    () => Boolean(activeManualImageEditState.baseImageDataUrl),
    [activeManualImageEditState.baseImageDataUrl],
  );
  const activeHasManualWandSelection = useMemo(
    () => Boolean(activeManualImageEditState.wandMaskDataUrl),
    [activeManualImageEditState.wandMaskDataUrl],
  );

  return {
    activeManualImageEditState,
    activeManualHealingBusy,
    activeHasManualPaintLayer,
    activeHasManualBaseOverride,
    activeHasManualWandSelection,
  };
}
