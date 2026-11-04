import type { ReactNode } from 'react';

import { PipelineStageRow } from '../../../../components/dashboard/PipelineStageRow';
import { AIO_STAGE_BADGE_LABELS } from '../../../../constants/dashboard.constants';

import type { EMPTY_REGION_MAP } from '../../../../utils/regionMapGating';
import type { AioPipelineSnapshotKey } from '../../../../types/dashboard.types';
import type { TypographyShapeKind } from '../../../../typography/types';
import type { useI18n } from '../../../../i18n';
import type { useAioPipelineStore } from '../../stores/aio-pipeline-store';
import type { useRegionEditorStore } from '../../stores/region-editor-store';
import type { useManualToolsStore } from '../../stores/manual-tools-store';
import type { useTypographerStore } from '../../stores/typographer-store';
import type { useCleanerStore } from '../../stores/cleaner-store';
import type { useTranslatorStore } from '../../stores/translator-store';
import type { useExportStore } from '../../stores/export-store';
import type { DashboardStageSectionProps } from './stageSectionProps';

type AioPipelineState = ReturnType<typeof useAioPipelineStore.getState>;
type RegionEditorState = ReturnType<typeof useRegionEditorStore.getState>;
type ManualToolsState = ReturnType<typeof useManualToolsStore.getState>;
type TypographerState = ReturnType<typeof useTypographerStore.getState>;
type CleanerState = ReturnType<typeof useCleanerStore.getState>;
type TranslatorState = ReturnType<typeof useTranslatorStore.getState>;
type ExportState = ReturnType<typeof useExportStore.getState>;
type AioImageSnapshotMeta = ReturnType<DashboardStageSectionProps['getAioImageSnapshotMeta']>;
type I18nT = ReturnType<typeof useI18n>['t'];
type TextFillSwatches = string[];

/**
 * Deps record for `renderStageItemBody` — everything the extracted body
 * read from the component scope (the original `useCallback` dep-array
 * values plus the stable handler callbacks it closes over). Forwarded by
 * the `renderStageItem` wrapper that stays in StageGrid.tsx.
 */
export interface StageItemDeps {
  aioDetectionsByImage: RegionEditorState['aioDetectionsByImage'] | typeof EMPTY_REGION_MAP;
  aioManualImageEditsByImage: ManualToolsState['aioManualImageEditsByImage'] | typeof EMPTY_REGION_MAP;
  aioPipelineSnapshots: AioPipelineState['aioPipelineSnapshots'];
  aioSelectedRegionByImage: RegionEditorState['aioSelectedRegionByImage'] | typeof EMPTY_REGION_MAP;
  applyAutoDetectedShapeToActiveRegion: DashboardStageSectionProps['applyAutoDetectedShapeToActiveRegion'];
  applyTypographyPresetToRegionById: DashboardStageSectionProps['applyTypographyPresetToRegionById'];
  availableRenderFonts: DashboardStageSectionProps['availableRenderFonts'];
  cleanerDetectionsByImage: CleanerState['cleanerDetectionsByImage'] | typeof EMPTY_REGION_MAP;
  cleanerHealingBusyByImage: CleanerState['cleanerHealingBusyByImage'];
  cleanerManualImageEditsByImage: CleanerState['cleanerManualImageEditsByImage'] | typeof EMPTY_REGION_MAP;
  cleanerProcessedBaseByImage: CleanerState['cleanerProcessedBaseByImage'] | typeof EMPTY_REGION_MAP;
  cleanerRunMetaByImage: CleanerState['cleanerRunMetaByImage'];
  cleanerSelectedRegionByImage: CleanerState['cleanerSelectedRegionByImage'] | typeof EMPTY_REGION_MAP;
  cleanerShowOverlays: CleanerState['cleanerShowOverlays'];
  downloadItems: ExportState['downloadItems'];
  getAioFallbackStageKey: DashboardStageSectionProps['getAioFallbackStageKey'];
  getAioImageSnapshotMeta: DashboardStageSectionProps['getAioImageSnapshotMeta'];
  getCleanerManualImageEditState: DashboardStageSectionProps['getCleanerManualImageEditState'];
  getPreviewSrc: DashboardStageSectionProps['getPreviewSrc'];
  handleAioRegionSelect: (imageId: string, regionId: string | null) => void;
  handleAioRegionsChange: (
    imageId: string,
    nextRegions: Parameters<DashboardStageSectionProps['updateAioRegionsForImage']>[1],
    selectedRegionIdOverride?: string | null,
  ) => void;
  handleCleanerHealingMaskCommit: (imageId: string, maskDataUrl: string) => Promise<void>;
  handleCleanerPaintLayerChange: (imageId: string, nextLayer: string | null) => void;
  handleCleanerRegionSelect: (imageId: string, regionId: string | null) => void;
  handleCleanerRegionsChange: (
    imageId: string,
    nextRegions: Parameters<DashboardStageSectionProps['updateCleanerRegionsForImage']>[1],
    selectedRegionIdOverride?: string | null,
  ) => void;
  handleCleanerWandMaskChange: (imageId: string, nextMask: string | null) => void;
  handleCleanerWandRequest: (imageId: string, x: number, y: number) => Promise<void>;
  handleClearTypographerMultiSelect: (imageId: string) => void;
  handleConvertRegionShape: (imageId: string, regionId: string, kind: 'auto' | 'square' | 'rounded') => void;
  handleRefineTypographerShape: () => void;
  handleStageImageSelect: (id: string) => void;
  handleTranslatorRegionSelect: (imageId: string, regionId: string | null) => void;
  handleTranslatorRegionsChange: (
    imageId: string,
    nextRegions: Parameters<DashboardStageSectionProps['updateTranslatorRegionsForImage']>[1],
    selectedRegionIdOverride?: string | null,
  ) => void;
  handleTypographerDownloadPreview: (imageId: string) => { previewUrl: string } | undefined;
  handleTypographerMultiSelectToggle: (imageId: string, regionId: string) => void;
  handleTypographerRegionSelect: (imageId: string, regionId: string | null) => void;
  images: DashboardStageSectionProps['images'];
  inlineEditorShortcutRequestKey: DashboardStageSectionProps['inlineEditorShortcutRequestKey'];
  isCompactViewport: DashboardStageSectionProps['isCompactViewport'];
  manualImageBrushBlur: ManualToolsState['manualImageBrushBlur'];
  manualImageBrushOpacity: ManualToolsState['manualImageBrushOpacity'];
  manualImageBrushSize: ManualToolsState['manualImageBrushSize'];
  manualImagePaintColor: ManualToolsState['manualImagePaintColor'];
  manualImageTool: ManualToolsState['manualImageTool'];
  mode: DashboardStageSectionProps['mode'];
  renderAioStageItem: (
    img: DashboardStageSectionProps['images'][number],
    index: number,
    imageHistoryMeta: AioImageSnapshotMeta,
    imageStageKey: AioPipelineSnapshotKey,
    imageStageBadgeLabel: string,
    imageHistoryHint: string | null,
  ) => ReactNode;
  renderDefaultStyle: RegionEditorState['renderDefaultStyle'];
  renderFontRefreshToken: DashboardStageSectionProps['renderFontRefreshToken'];
  resolvedActiveId: DashboardStageSectionProps['resolvedActiveId'];
  resolvedAioAreaSelectionShapeKind: TypographyShapeKind;
  segmentBrushSize: ManualToolsState['segmentBrushSize'];
  segmentEditTool: ManualToolsState['segmentEditTool'];
  subMode: DashboardStageSectionProps['subMode'];
  t: I18nT;
  textFillSwatches: TextFillSwatches;
  typographyPresetList: RegionEditorState['typographyPresetState']['presets'];
  translatorDetectionsByImage: TranslatorState['translatorDetectionsByImage'] | typeof EMPTY_REGION_MAP;
  translatorProcessedBaseByImage: TranslatorState['translatorProcessedBaseByImage'] | typeof EMPTY_REGION_MAP;
  translatorRunMetaByImage: TranslatorState['translatorRunMetaByImage'];
  translatorSelectedRegionByImage: TranslatorState['translatorSelectedRegionByImage'] | typeof EMPTY_REGION_MAP;
  translatorWorkspaceMode: TranslatorState['translatorWorkspaceMode'];
  translationNotesEnabled: boolean;
  typographerMultiSelectedByImage: TypographerState['typographerMultiSelectedByImage'];
  typographerSelectionTool: TypographerState['typographerSelectionTool'];
  viewMode: DashboardStageSectionProps['viewMode'];
}

/**
 * Extracted body of StageGrid's `renderStageItem` callback (verbatim move,
 * de-indented one level). StageGrid keeps the identical `useCallback`
 * wrapper (same deps array) and forwards this deps record on every call.
 */
export function renderStageItemBody(
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
  }: StageItemDeps,
  index: number,
): ReactNode {
  const img = images[index];
  if (!img) return null;

  if (
    !aioManualImageEditsByImage &&
    !cleanerManualImageEditsByImage &&
    !cleanerProcessedBaseByImage &&
    !translatorProcessedBaseByImage &&
    !downloadItems
  ) {
    return null;
  }

  const imageHistoryMeta = getAioImageSnapshotMeta(img.id);
  const imageStageKey = imageHistoryMeta.key ?? getAioFallbackStageKey();
  const imageStageBadgeLabel = AIO_STAGE_BADGE_LABELS[imageStageKey];
  const imageHistoryHint = imageHistoryMeta.label
    ? t('dashboard.aio.historyHint', {
      label: imageHistoryMeta.label,
      current: imageHistoryMeta.index + 1,
      total: aioPipelineSnapshots.length,
    })
    : null;

  if (mode === 'aio') {
    return renderAioStageItem(
      img,
      index,
      imageHistoryMeta,
      imageStageKey,
      imageStageBadgeLabel,
      imageHistoryHint,
    );
  }

  if (mode === 'typesetter') {
    return (
      <PipelineStageRow
        kind="typesetter"
        props={{
          img,
          index,
          getAioDownloadItemForImage: handleTypographerDownloadPreview,
          getPreviewSrc,
          aioDetectionsByImage,
          aioSelectedRegionByImage,
          resolvedActiveId,
          subMode,
          typographerSelectionTool,
          renderDefaultStyle,
          renderFontRefreshToken,
          availableRenderFonts,
          isCompactViewport,
          inlineEditorShortcutRequestKey,
          textFillSwatches,
          translationNotesEnabled,
          typographerMultiSelectedByImage,
          typographyPresetList,
          viewMode,
          onSelect: handleStageImageSelect,
          onSelectRegion: handleAioRegionSelect,
          onSetTypographerSelectedRegionId: handleTypographerRegionSelect,
          onClearTypographerMultiSelect: handleClearTypographerMultiSelect,
          onRegionsChange: handleAioRegionsChange,
          onRefineActiveShape: handleRefineTypographerShape,
          onAutoShapeActiveRegion: applyAutoDetectedShapeToActiveRegion,
          onApplyPresetToRegion: applyTypographyPresetToRegionById,
          onConvertRegionShape: handleConvertRegionShape,
          onMultiSelectToggle: handleTypographerMultiSelectToggle,
        }}
      />
    );
  }

  if (mode === 'cleaner') {
    return (
      <PipelineStageRow
        kind="cleaner"
        props={{
          img,
          index,
          cleanerRunMetaByImage,
          cleanerDetectionsByImage,
          cleanerSelectedRegionByImage,
          cleanerHealingBusyByImage,
          cleanerShowOverlays,
          getCleanerManualImageEditState,
          getPreviewSrc,
          resolvedActiveId,
          resolvedAioAreaSelectionShapeKind,
          renderDefaultStyle,
          renderFontRefreshToken,
          availableRenderFonts,
          isCompactViewport,
          manualImageBrushOpacity,
          manualImageBrushBlur,
          manualImageBrushSize,
          manualImagePaintColor,
          manualImageTool,
          segmentEditTool,
          segmentBrushSize,
          inlineEditorShortcutRequestKey,
          textFillSwatches,
          viewMode,
          onSelect: handleStageImageSelect,
          onSelectRegion: handleCleanerRegionSelect,
          onRegionsChange: handleCleanerRegionsChange,
          onManualPaintLayerChange: handleCleanerPaintLayerChange,
          onManualWandMaskChange: handleCleanerWandMaskChange,
          onManualWandRequest: handleCleanerWandRequest,
          onManualHealingMaskCommit: handleCleanerHealingMaskCommit,
        }}
      />
    );
  }

  if (mode === 'translator' && translatorWorkspaceMode === 'visual') {
    return (
      <PipelineStageRow
        kind="translator"
        props={{
          img,
          index,
          translatorRunMetaByImage,
          translatorDetectionsByImage,
          translatorSelectedRegionByImage,
          resolvedActiveId,
          resolvedAioAreaSelectionShapeKind,
          segmentBrushSize,
          translationNotesEnabled,
          viewMode,
          getPreviewSrc,
          onSelect: handleStageImageSelect,
          onSelectRegion: handleTranslatorRegionSelect,
          onRegionsChange: handleTranslatorRegionsChange,
        }}
      />
    );
  }

  return (
    <PipelineStageRow
      kind="preview"
      props={{
        img,
        index,
        viewMode,
        resolvedActiveId,
        onSelect: handleStageImageSelect,
        getPreviewSrc,
      }}
    />
  );
}
