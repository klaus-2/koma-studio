import { Suspense, lazy, memo, useCallback, useMemo, useRef } from 'react';
import { useShallowStableObject } from '../../../utils/shallowStable';

import { memoLoad } from '../../../utils/lazyModule';

import DashboardLazyFallback from '../../../components/dashboard/DashboardLazyFallback';
import DashboardInfoModeStage from '../../../components/dashboard/DashboardInfoModeStage';
import DashboardSpecialModeStage from '../../../components/dashboard/DashboardSpecialModeStage';
import DashboardStageGrid from '../../../components/dashboard/DashboardStageGrid';
import DashboardEmptyStage from '../../../components/dashboard/DashboardEmptyStage';

const loadRenderTextPreview = memoLoad(() => import('../../../components/dashboard/RenderTextPreview'));
const loadTextDetectionPreview = memoLoad(() => import('../../../components/dashboard/TextDetectionPreview'));
const loadTranslatorTextStage = memoLoad(() => import('./TranslatorTextStage'));
const RenderTextPreview = lazy(loadRenderTextPreview);
const TextDetectionPreview = lazy(loadTextDetectionPreview);
const TranslatorTextStage = lazy(loadTranslatorTextStage);

/** Fire-and-forget warmup of the heavy stage modules (called at browser idle). */
export function preloadStageHeavyModules() {
  void loadRenderTextPreview().catch(() => { });
  void loadTextDetectionPreview().catch(() => { });
  void loadTranslatorTextStage().catch(() => { });
}

import type { DashboardStageSectionProps } from './stage-grid/stageSectionProps';
import { renderAioStageItemBody } from './stage-grid/aioStageItemRenderer';
import { renderStageItemBody } from './stage-grid/stageItemRenderer';

export type { DashboardStageSectionProps } from './stage-grid/stageSectionProps';

import { useI18n } from '../../../i18n';
import { cn } from '../../../utils/dashboard.utils';
import {
  EMPTY_REGION_MAP,
  needsAioRegionMaps,
  needsCleanerRegionMaps,
  needsTranslatorRegionMaps,
} from '../../../utils/regionMapGating';
import { useRegionEditorStore } from '../stores/region-editor-store';
import { useAioPipelineStore } from '../stores/aio-pipeline-store';
import { useManualToolsStore } from '../stores/manual-tools-store';
import { useTypographerStore } from '../stores/typographer-store';
import { useCleanerStore } from '../stores/cleaner-store';
import { useExportStore } from '../stores/export-store';
import { useTranslatorStore } from '../stores/translator-store';
import { useNonPassiveWheel } from '../../../hooks/useNonPassiveWheel';
import type { AioPipelineSnapshotKey } from '../../../types/dashboard.types';
import type { TypographyShapeKind } from '../../../typography/types';
import { resolveTypographyPresetForMode } from '../../../typography/presets';
import { listTextFillSwatches } from '../../../utils/textFillPicker';


/**
 * Center-stage view: the `<section>` stage block with its mode branches and
 * the per-image stage-item renderers (moved 1:1 from the page, deps fed by
 * same-name props).
 */
function DashboardStageSection({
  images,
  setActiveId,
  mode,
  subMode,
  viewMode,
  inlineEditorShortcutRequestKey,
  selectAioRegionForImage,
  updateAioRegionsForImage,
  selectCleanerRegionForImage,
  updateCleanerRegionsForImage,
  selectTranslatorRegionForImage,
  updateTranslatorRegionsForImage,
  getAioManualImageEditState,
  patchAioManualImageEditState,
  getCleanerManualImageEditState,
  patchCleanerManualImageEditState,
  runAioMagicWandForImage,
  applyAioHealingMaskForImage,
  runCleanerMagicWandForImage,
  applyCleanerHealingMaskForImage,
  refineActiveTypographerShape,
  rewindAioPipelineForImage,
  forwardAioPipelineForImage,
  getAioImageSnapshotMeta,
  getAioFallbackStageKey,
  getAioDownloadItemForImage,
  resolvedActiveId,
  applyAutoDetectedShapeToActiveRegion,
  applyAutoDetectedShapeToRegionById,
  applyTypographyPresetToRegionById,
  convertRegionShapeById,
  translationNotesEnabled,
  isCompactViewport,
  renderFontRefreshToken,
  availableRenderFonts,
  handleStageWheelZoom,
  specialModeStageProps,
  onOpenSettings,
  translatorTextImportRef,
  runTranslatorText,
  handleDownload,
  handleTranslatorTextImport,
  getPreviewSrc,
  typographerWorkspace,
}: DashboardStageSectionProps) {
  const { t } = useI18n();

  // React's onWheel is passive; the zoom gesture needs preventDefault, so the
  // listener is attached directly as non-passive instead.
  const stageRef = useRef<HTMLElement>(null);
  useNonPassiveWheel(stageRef, handleStageWheelZoom, true);

  // ── Stage-owned store slices ──
  const trackAioMaps = needsAioRegionMaps(mode);
  const trackCleanerMaps = needsCleanerRegionMaps(mode);
  const trackTranslatorMaps = needsTranslatorRegionMaps(mode);
  const aioDetectionsByImage = useRegionEditorStore(
    (s) => (trackAioMaps ? s.aioDetectionsByImage : EMPTY_REGION_MAP),
  );
  const aioSelectedRegionByImage = useRegionEditorStore(
    (s) => (trackAioMaps ? s.aioSelectedRegionByImage : EMPTY_REGION_MAP),
  );
  const renderDefaultStyle = useRegionEditorStore(
    (s) => s.renderDefaultStyle,
  );
  const textFillSwatchState = useRegionEditorStore(
    (s) => s.textFillSwatchState,
  );
  const typographyPresetState = useRegionEditorStore(
    (s) => s.typographyPresetState,
  );
  const areaSelectionCreateMode = useManualToolsStore(
    (s) => s.areaSelectionCreateMode,
  );
  // Same derivations the page computes for these lists (single source stores).
  const textFillSwatches = useMemo(
    () => listTextFillSwatches(textFillSwatchState),
    [textFillSwatchState],
  );
  const typographyPresetList = useMemo(
    () =>
      [...typographyPresetState.presets].sort((left, right) =>
        left.name.localeCompare(right.name, 'pt-BR'),
      ),
    [typographyPresetState.presets],
  );
  const typographyFolderList = useMemo(
    () =>
      [...typographyPresetState.folders].sort(
        (left, right) =>
          left.order - right.order ||
          left.name.localeCompare(right.name, 'pt-BR'),
      ),
    [typographyPresetState.folders],
  );
  const aioSteps = useAioPipelineStore((s) => s.aioSteps);
  const aioPipelineSnapshots = useAioPipelineStore(
    (s) => s.aioPipelineSnapshots,
  );
  const aioManualHealingBusyByImage = useManualToolsStore(
    (s) => s.aioManualHealingBusyByImage,
  );
  const manualImageTool = useManualToolsStore((s) => s.manualImageTool);
  const manualImagePaintColor = useManualToolsStore(
    (s) => s.manualImagePaintColor,
  );
  const manualImageBrushSize = useManualToolsStore(
    (s) => s.manualImageBrushSize,
  );
  const manualImageBrushOpacity = useManualToolsStore(
    (s) => s.manualImageBrushOpacity,
  );
  const manualImageBrushBlur = useManualToolsStore(
    (s) => s.manualImageBrushBlur,
  );
  const segmentEditTool = useManualToolsStore((s) => s.segmentEditTool);
  const segmentBrushSize = useManualToolsStore((s) => s.segmentBrushSize);

  const areaSelectionToolActive =
    segmentEditTool === 'select' && manualImageTool === 'none';
  const resolvedAioAreaSelectionShapeKind = useMemo<TypographyShapeKind>(() => {
    if (
      areaSelectionCreateMode === 'square' ||
      areaSelectionCreateMode === 'rounded'
    ) {
      return areaSelectionCreateMode;
    }
    return (
      resolveTypographyPresetForMode('text_bubble', typographyPresetState)
        ?.defaultShapeKind ?? 'rounded'
    );
  }, [areaSelectionCreateMode, typographyPresetState]);
  const typographerSelectionTool = useTypographerStore(
    (s) => s.typographerSelectionTool,
  );
  const typographerMultiSelectedByImage = useTypographerStore(
    (s) => s.typographerMultiSelectedByImage,
  );
  const setTypographerMultiSelectedByImage = useTypographerStore(
    (s) => s.setTypographerMultiSelectedByImage,
  );
  const cleanerRunMetaByImage = useCleanerStore((s) => s.cleanerRunMetaByImage);
  const cleanerDetectionsByImage = useCleanerStore(
    (s) => (trackCleanerMaps ? s.cleanerDetectionsByImage : EMPTY_REGION_MAP),
  );
  const cleanerSelectedRegionByImage = useCleanerStore(
    (s) => (trackCleanerMaps ? s.cleanerSelectedRegionByImage : EMPTY_REGION_MAP),
  );
  const cleanerHealingBusyByImage = useCleanerStore(
    (s) => s.cleanerHealingBusyByImage,
  );
  const cleanerShowOverlays = useCleanerStore((s) => s.cleanerShowOverlays);
  const translatorRunMetaByImage = useTranslatorStore(
    (s) => s.translatorRunMetaByImage,
  );
  const translatorDetectionsByImage = useTranslatorStore(
    (s) => (trackTranslatorMaps ? s.translatorDetectionsByImage : EMPTY_REGION_MAP),
  );
  const translatorSelectedRegionByImage = useTranslatorStore(
    (s) => (trackTranslatorMaps ? s.translatorSelectedRegionByImage : EMPTY_REGION_MAP),
  );
  const translatorWorkspaceMode = useTranslatorStore(
    (s) => s.translatorWorkspaceMode,
  );
  // Preview/base sources read the stores at call time inside getPreviewSrc
  // and the per-item manual-edit getters; these slices keep the grade's
  // re-render cadence in sync with those reads (T4.2).
  const aioManualImageEditsByImage = useManualToolsStore(
    (s) => (trackAioMaps ? s.aioManualImageEditsByImage : EMPTY_REGION_MAP),
  );
  const cleanerManualImageEditsByImage = useCleanerStore(
    (s) => (trackCleanerMaps ? s.cleanerManualImageEditsByImage : EMPTY_REGION_MAP),
  );
  const cleanerProcessedBaseByImage = useCleanerStore(
    (s) => (trackCleanerMaps ? s.cleanerProcessedBaseByImage : EMPTY_REGION_MAP),
  );
  const translatorProcessedBaseByImage = useTranslatorStore(
    (s) => (trackTranslatorMaps ? s.translatorProcessedBaseByImage : EMPTY_REGION_MAP),
  );
  const downloadItems = useExportStore((s) => s.downloadItems);

  const stageItemRenderDeps = useShallowStableObject({
    aioDetectionsByImage,
    aioManualHealingBusyByImage,
    aioSelectedRegionByImage,
    aioStepsRender: aioSteps.render,
    applyAioHealingMaskForImage,
    applyAutoDetectedShapeToActiveRegion,
    applyAutoDetectedShapeToRegionById,
    applyTypographyPresetToRegionById,
    areaSelectionToolActive,
    availableRenderFonts,
    convertRegionShapeById,
    getAioManualImageEditState,
    getPreviewSrc,
    inlineEditorShortcutRequestKey,
    isCompactViewport,
    manualImageBrushBlur,
    manualImageBrushOpacity,
    manualImageBrushSize,
    manualImagePaintColor,
    manualImageTool,
    patchAioManualImageEditState,
    refineActiveTypographerShape,
    renderDefaultStyle,
    renderFontRefreshToken,
    resolvedActiveId,
    resolvedAioAreaSelectionShapeKind,
    rewindAioPipelineForImage,
    runAioMagicWandForImage,
    segmentBrushSize,
    segmentEditTool,
    selectAioRegionForImage,
    setActiveId,
    subMode,
    textFillSwatches,
    translationNotesEnabled,
    typographyFolderList,
    typographyPresetList,
    updateAioRegionsForImage,
    viewMode,
    forwardAioPipelineForImage,
  });

  const renderAioStageItem = useCallback(
    (
      img: (typeof images)[number],
      index: number,
      imageHistoryMeta: ReturnType<typeof getAioImageSnapshotMeta>,
      imageStageKey: AioPipelineSnapshotKey,
      imageStageBadgeLabel: string,
      imageHistoryHint: string | null,
    ) =>
      renderAioStageItemBody(
        {
          RenderTextPreview,
          TextDetectionPreview,
          subMode,
          areaSelectionToolActive,
          aioSteps,
          manualImageBrushBlur,
          manualImageBrushOpacity,
          manualImageBrushSize,
          manualImagePaintColor,
          manualImageTool,
          getPreviewSrc,
          viewMode,
          resolvedActiveId,
          aioDetectionsByImage,
          aioSelectedRegionByImage,
          setActiveId,
          selectAioRegionForImage,
          updateAioRegionsForImage,
          resolvedAioAreaSelectionShapeKind,
          renderDefaultStyle,
          renderFontRefreshToken,
          availableRenderFonts,
          isCompactViewport,
          rewindAioPipelineForImage,
          forwardAioPipelineForImage,
          refineActiveTypographerShape,
          applyAutoDetectedShapeToActiveRegion,
          typographyPresetList,
          typographyFolderList,
          applyTypographyPresetToRegionById,
          applyAutoDetectedShapeToRegionById,
          convertRegionShapeById,
          getAioManualImageEditState,
          patchAioManualImageEditState,
          aioManualHealingBusyByImage,
          textFillSwatches,
          segmentEditTool,
          segmentBrushSize,
          inlineEditorShortcutRequestKey,
          runAioMagicWandForImage,
          applyAioHealingMaskForImage,
          translationNotesEnabled,
        },
        img,
        index,
        imageHistoryMeta,
        imageStageKey,
        imageStageBadgeLabel,
        imageHistoryHint,
      ),
    [stageItemRenderDeps],
  );
  const stageItemKey = useCallback(
    (index: number) => images[index]?.id ?? `${index}`,
    [images],
  );
  // Stable row callbacks: memoized PipelineStageRow rows bail out unless
  // their own data (or one of these identities) actually changed.
  const handleStageImageSelect = useCallback(
    (id: string) => setActiveId(id),
    [setActiveId],
  );
  const handleAioRegionSelect = useCallback(
    (imageId: string, regionId: string | null) =>
      selectAioRegionForImage(imageId, regionId),
    [selectAioRegionForImage],
  );
  const handleCleanerRegionSelect = useCallback(
    (imageId: string, regionId: string | null) =>
      selectCleanerRegionForImage(imageId, regionId),
    [selectCleanerRegionForImage],
  );
  const handleTranslatorRegionSelect = useCallback(
    (imageId: string, regionId: string | null) =>
      selectTranslatorRegionForImage(imageId, regionId),
    [selectTranslatorRegionForImage],
  );
  const handleAioRegionsChange = useCallback(
    (
      imageId: string,
      nextRegions: Parameters<typeof updateAioRegionsForImage>[1],
      selectedRegionIdOverride?: string | null,
    ) =>
      updateAioRegionsForImage(imageId, nextRegions, selectedRegionIdOverride),
    [updateAioRegionsForImage],
  );
  const handleCleanerRegionsChange = useCallback(
    (
      imageId: string,
      nextRegions: Parameters<typeof updateCleanerRegionsForImage>[1],
      selectedRegionIdOverride?: string | null,
    ) =>
      updateCleanerRegionsForImage(imageId, nextRegions, selectedRegionIdOverride),
    [updateCleanerRegionsForImage],
  );
  const handleTranslatorRegionsChange = useCallback(
    (
      imageId: string,
      nextRegions: Parameters<typeof updateTranslatorRegionsForImage>[1],
      selectedRegionIdOverride?: string | null,
    ) =>
      updateTranslatorRegionsForImage(imageId, nextRegions, selectedRegionIdOverride),
    [updateTranslatorRegionsForImage],
  );
  const handleCleanerPaintLayerChange = useCallback(
    (imageId: string, nextLayer: string | null) =>
      patchCleanerManualImageEditState(imageId, {
        paintLayerDataUrl: nextLayer,
      }),
    [patchCleanerManualImageEditState],
  );
  const handleCleanerWandMaskChange = useCallback(
    (imageId: string, nextMask: string | null) =>
      patchCleanerManualImageEditState(imageId, {
        wandMaskDataUrl: nextMask,
      }),
    [patchCleanerManualImageEditState],
  );
  const handleCleanerWandRequest = useCallback(
    async (imageId: string, x: number, y: number) => {
      await runCleanerMagicWandForImage(imageId, x, y);
    },
    [runCleanerMagicWandForImage],
  );
  const handleCleanerHealingMaskCommit = useCallback(
    async (imageId: string, maskDataUrl: string) => {
      await applyCleanerHealingMaskForImage(imageId, maskDataUrl);
    },
    [applyCleanerHealingMaskForImage],
  );
  const handleTypographerDownloadPreview = useCallback(
    (imageId: string) => {
      const item = getAioDownloadItemForImage(imageId);
      return item ? { previewUrl: item.previewUrl } : undefined;
    },
    [getAioDownloadItemForImage],
  );
  const handleTypographerRegionSelect = useCallback(
    (imageId: string, regionId: string | null) =>
      typographerWorkspace.setSelectedRegionId(imageId, regionId),
    [typographerWorkspace],
  );
  const handleClearTypographerMultiSelect = useCallback(
    (imageId: string) => {
      setTypographerMultiSelectedByImage((prev: Record<string, string[]>) => {
        const { [imageId]: _removed, ...rest } = prev;
        return rest;
      });
    },
    [setTypographerMultiSelectedByImage],
  );
  const handleRefineTypographerShape = useCallback(() => {
    void refineActiveTypographerShape();
  }, [refineActiveTypographerShape]);
  const handleConvertRegionShape = useCallback(
    (imageId: string, regionId: string, kind: 'auto' | 'square' | 'rounded') =>
      convertRegionShapeById(
        imageId,
        regionId,
        kind as unknown as Parameters<typeof convertRegionShapeById>[2],
      ),
    [convertRegionShapeById],
  );
  const handleTypographerMultiSelectToggle = useCallback(
    (imageId: string, regionId: string) => {
      setActiveId(imageId);
      setTypographerMultiSelectedByImage((prev: Record<string, string[]>) => {
        const current = prev[imageId] ?? [];
        const idx = current.indexOf(regionId);
        if (idx >= 0) {
          const next = current.filter((id: string) => id !== regionId);
          if (next.length === 0) {
            const { [imageId]: _removed, ...rest } = prev;
            return rest;
          }
          return { ...prev, [imageId]: next };
        }
        return { ...prev, [imageId]: [...current, regionId] };
      });
    },
    [setActiveId, setTypographerMultiSelectedByImage],
  );
  const renderStageItem = useCallback(
    (index: number) =>
      renderStageItemBody(
        {
          aioDetectionsByImage,
          aioManualImageEditsByImage,
          aioPipelineSnapshots,
          aioSelectedRegionByImage,
          applyAutoDetectedShapeToActiveRegion,
          applyTypographyPresetToRegionById,
          availableRenderFonts,
          cleanerDetectionsByImage,
          cleanerHealingBusyByImage,
          cleanerManualImageEditsByImage,
          cleanerProcessedBaseByImage,
          cleanerRunMetaByImage,
          cleanerSelectedRegionByImage,
          cleanerShowOverlays,
          downloadItems,
          getAioFallbackStageKey,
          getAioImageSnapshotMeta,
          getCleanerManualImageEditState,
          getPreviewSrc,
          handleAioRegionSelect,
          handleAioRegionsChange,
          handleCleanerHealingMaskCommit,
          handleCleanerPaintLayerChange,
          handleCleanerRegionSelect,
          handleCleanerRegionsChange,
          handleCleanerWandMaskChange,
          handleCleanerWandRequest,
          handleClearTypographerMultiSelect,
          handleConvertRegionShape,
          handleRefineTypographerShape,
          handleStageImageSelect,
          handleTranslatorRegionSelect,
          handleTranslatorRegionsChange,
          handleTypographerDownloadPreview,
          handleTypographerMultiSelectToggle,
          handleTypographerRegionSelect,
          images,
          inlineEditorShortcutRequestKey,
          isCompactViewport,
          manualImageBrushBlur,
          manualImageBrushOpacity,
          manualImageBrushSize,
          manualImagePaintColor,
          manualImageTool,
          mode,
          renderAioStageItem,
          renderDefaultStyle,
          renderFontRefreshToken,
          resolvedActiveId,
          resolvedAioAreaSelectionShapeKind,
          segmentBrushSize,
          segmentEditTool,
          subMode,
          t,
          textFillSwatches,
          typographyPresetList,
          translatorDetectionsByImage,
          translatorProcessedBaseByImage,
          translatorRunMetaByImage,
          translatorSelectedRegionByImage,
          translatorWorkspaceMode,
          translationNotesEnabled,
          typographerMultiSelectedByImage,
          typographerSelectionTool,
          viewMode,
        },
        index,
      ),
    [
      aioDetectionsByImage,
      aioManualImageEditsByImage,
      aioPipelineSnapshots,
      aioSelectedRegionByImage,
      applyAutoDetectedShapeToActiveRegion,
      applyCleanerHealingMaskForImage,
      applyTypographyPresetToRegionById,
      availableRenderFonts,
      cleanerDetectionsByImage,
      cleanerHealingBusyByImage,
      cleanerManualImageEditsByImage,
      cleanerProcessedBaseByImage,
      cleanerRunMetaByImage,
      cleanerSelectedRegionByImage,
      cleanerShowOverlays,
      convertRegionShapeById,
      downloadItems,
      getAioDownloadItemForImage,
      getAioFallbackStageKey,
      getAioImageSnapshotMeta,
      getCleanerManualImageEditState,
      getPreviewSrc,
      images,
      inlineEditorShortcutRequestKey,
      isCompactViewport,
      manualImageBrushBlur,
      manualImageBrushOpacity,
      manualImageBrushSize,
      manualImagePaintColor,
      manualImageTool,
      mode,
      patchCleanerManualImageEditState,
      refineActiveTypographerShape,
      renderAioStageItem,
      renderDefaultStyle,
      renderFontRefreshToken,
      resolvedActiveId,
      resolvedAioAreaSelectionShapeKind,
      runCleanerMagicWandForImage,
      segmentBrushSize,
      segmentEditTool,
      selectAioRegionForImage,
      selectTranslatorRegionForImage,
      setActiveId,
      setTypographerMultiSelectedByImage,
      subMode,
      t,
      textFillSwatches,
      translatorDetectionsByImage,
      translatorProcessedBaseByImage,
      translatorRunMetaByImage,
      translatorSelectedRegionByImage,
      translatorWorkspaceMode,
      translationNotesEnabled,
      typographerMultiSelectedByImage,
      typographerSelectionTool,
      typographerWorkspace,
      typographyPresetList,
      updateAioRegionsForImage,
      updateTranslatorRegionsForImage,
      viewMode,
    ],
  );

  // ═══════════ CENTER STAGE ═══════════
  return (
    <section
      ref={stageRef}
      className="koma-stage custom-scrollbar"
      data-tour="dashboard-stage"
    >
      {/* Info modes show content instead of images */}
      {mode === 'guides' ||
        mode === 'resources' ||
        mode === 'blogger' ||
        mode === 'imgur' ? (
        <DashboardInfoModeStage
          mode={mode}
          onOpenSettings={onOpenSettings ?? (() => { })}
        />
      ) : mode === 'translator' && translatorWorkspaceMode === 'text' ? (
        <Suspense fallback={<DashboardLazyFallback />}>
          <TranslatorTextStage
            translatorTextImportRef={translatorTextImportRef}
            runTranslatorText={runTranslatorText}
            handleDownload={handleDownload}
            handleTranslatorTextImport={handleTranslatorTextImport}
          />
        </Suspense>
      ) : [
        'translator',
        'stitch',
        'split',
        'watermark',
        'optimizer',
      ].includes(mode) ? (
        <DashboardSpecialModeStage
          props={specialModeStageProps}
          stageMode={mode}
        />
      ) : images.length > 0 ? (
        <div
          className={cn(
            'koma-stage__grid',
            viewMode === 'paginated'
              ? 'koma-stage__grid--pages'
              : 'koma-stage__grid--strip',
          )}
          data-tour="dashboard-stage-grid"
        >
          <Suspense fallback={<DashboardLazyFallback />}>
            <DashboardStageGrid
              viewMode={viewMode}
              itemCount={images.length}
              itemKey={stageItemKey}
              renderStageItem={renderStageItem}
            />
          </Suspense>
        </div>
      ) : (
        <DashboardEmptyStage />
      )}
    </section>
  );
}

// The parent layout re-renders for state this section does not consume
// (footer/badge progress ticks); memo bails those out. Its props are stable
// by contract: store primitives, hook useCallbacks, useMemo-wrapped objects.
export default memo(DashboardStageSection);