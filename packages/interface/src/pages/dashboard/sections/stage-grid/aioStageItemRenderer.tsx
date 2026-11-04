import type { LazyExoticComponent, ReactNode } from 'react';

import { EMPTY_REGIONS } from '../../../../utils/dashboardRenderUtils';

import type { EMPTY_REGION_MAP } from '../../../../utils/regionMapGating';
import type { AioPipelineSnapshotKey } from '../../../../types/dashboard.types';
import type { TypographyShapeKind } from '../../../../typography/types';
import type { listTextFillSwatches } from '../../../../utils/textFillPicker';
import type { useAioPipelineStore } from '../../stores/aio-pipeline-store';
import type { useRegionEditorStore } from '../../stores/region-editor-store';
import type { useManualToolsStore } from '../../stores/manual-tools-store';
import type { DashboardStageSectionProps } from './stageSectionProps';

type AioPipelineState = ReturnType<typeof useAioPipelineStore.getState>;
type RegionEditorState = ReturnType<typeof useRegionEditorStore.getState>;
type ManualToolsState = ReturnType<typeof useManualToolsStore.getState>;
type AioImageSnapshotMeta = ReturnType<DashboardStageSectionProps['getAioImageSnapshotMeta']>;
type TextFillSwatches = ReturnType<typeof listTextFillSwatches>;

/**
 * Deps record for `renderAioStageItemBody` — everything the extracted body
 * read from the component scope. Forwarded by the `renderAioStageItem`
 * `useCallback` wrapper that stays in StageGrid.tsx (callback identity is
 * load-bearing for the memoized previews — see stageSectionProps.ts).
 */
export interface AioStageItemDeps {
  /** Lazy preview components — defined in StageGrid; the loaders stay there. */
  RenderTextPreview: LazyExoticComponent<
    typeof import('../../../../components/dashboard/RenderTextPreview')['default']
  >;
  TextDetectionPreview: LazyExoticComponent<
    typeof import('../../../../components/dashboard/TextDetectionPreview')['default']
  >;
  subMode: DashboardStageSectionProps['subMode'];
  areaSelectionToolActive: boolean;
  aioSteps: AioPipelineState['aioSteps'];
  manualImageBrushBlur: ManualToolsState['manualImageBrushBlur'];
  manualImageBrushOpacity: ManualToolsState['manualImageBrushOpacity'];
  manualImageBrushSize: ManualToolsState['manualImageBrushSize'];
  manualImagePaintColor: ManualToolsState['manualImagePaintColor'];
  manualImageTool: ManualToolsState['manualImageTool'];
  getPreviewSrc: DashboardStageSectionProps['getPreviewSrc'];
  viewMode: DashboardStageSectionProps['viewMode'];
  resolvedActiveId: DashboardStageSectionProps['resolvedActiveId'];
  aioDetectionsByImage: RegionEditorState['aioDetectionsByImage'] | typeof EMPTY_REGION_MAP;
  aioSelectedRegionByImage: RegionEditorState['aioSelectedRegionByImage'] | typeof EMPTY_REGION_MAP;
  setActiveId: DashboardStageSectionProps['setActiveId'];
  selectAioRegionForImage: DashboardStageSectionProps['selectAioRegionForImage'];
  updateAioRegionsForImage: DashboardStageSectionProps['updateAioRegionsForImage'];
  resolvedAioAreaSelectionShapeKind: TypographyShapeKind;
  renderDefaultStyle: RegionEditorState['renderDefaultStyle'];
  renderFontRefreshToken: DashboardStageSectionProps['renderFontRefreshToken'];
  availableRenderFonts: DashboardStageSectionProps['availableRenderFonts'];
  isCompactViewport: DashboardStageSectionProps['isCompactViewport'];
  rewindAioPipelineForImage: DashboardStageSectionProps['rewindAioPipelineForImage'];
  forwardAioPipelineForImage: DashboardStageSectionProps['forwardAioPipelineForImage'];
  refineActiveTypographerShape: DashboardStageSectionProps['refineActiveTypographerShape'];
  applyAutoDetectedShapeToActiveRegion: DashboardStageSectionProps['applyAutoDetectedShapeToActiveRegion'];
  typographyPresetList: RegionEditorState['typographyPresetState']['presets'];
  typographyFolderList: RegionEditorState['typographyPresetState']['folders'];
  applyTypographyPresetToRegionById: DashboardStageSectionProps['applyTypographyPresetToRegionById'];
  applyAutoDetectedShapeToRegionById: DashboardStageSectionProps['applyAutoDetectedShapeToRegionById'];
  convertRegionShapeById: DashboardStageSectionProps['convertRegionShapeById'];
  getAioManualImageEditState: DashboardStageSectionProps['getAioManualImageEditState'];
  patchAioManualImageEditState: DashboardStageSectionProps['patchAioManualImageEditState'];
  aioManualHealingBusyByImage: ManualToolsState['aioManualHealingBusyByImage'];
  textFillSwatches: TextFillSwatches;
  segmentEditTool: ManualToolsState['segmentEditTool'];
  segmentBrushSize: ManualToolsState['segmentBrushSize'];
  inlineEditorShortcutRequestKey: DashboardStageSectionProps['inlineEditorShortcutRequestKey'];
  runAioMagicWandForImage: DashboardStageSectionProps['runAioMagicWandForImage'];
  applyAioHealingMaskForImage: DashboardStageSectionProps['applyAioHealingMaskForImage'];
  translationNotesEnabled: boolean;
}

/**
 * Extracted body of StageGrid's `renderAioStageItem` callback (verbatim
 * move, de-indented one level). StageGrid keeps the identical `useCallback`
 * wrapper and forwards this deps record on every invocation.
 */
export function renderAioStageItemBody(
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
  }: AioStageItemDeps,
  img: DashboardStageSectionProps['images'][number],
  index: number,
  imageHistoryMeta: AioImageSnapshotMeta,
  imageStageKey: AioPipelineSnapshotKey,
  imageStageBadgeLabel: string,
  imageHistoryHint: string | null,
): ReactNode {
  const imageAllowsAreaSelection =
    subMode === 'manual' &&
    areaSelectionToolActive &&
    (imageStageKey === 'detectText' || imageStageKey === 'render');
  const imageAllowsSegmentBrush =
    subMode === 'manual' && imageStageKey === 'segmentText';
  const isManualEarlyStage =
    subMode === 'manual' &&
    (imageStageKey === 'detectText' ||
      imageStageKey === 'recognizeText' ||
      imageStageKey === 'getTranslations');
  const shouldUseRenderPreview =
    (!isManualEarlyStage && aioSteps.render) ||
    (subMode === 'manual' && imageStageKey === 'render') ||
    (manualImageTool !== 'none' && imageStageKey === 'render');

  if (shouldUseRenderPreview) {
    return (
      <RenderTextPreview
        key={`${img.id}-snapshot-${imageHistoryMeta.index}`}
        label={`#${index + 1} — ${img.file.name}`}
        image={img}
        previewSrc={getPreviewSrc(img)}
        viewMode={viewMode}
        active={resolvedActiveId === img.id}
        regions={aioDetectionsByImage[img.id] ?? EMPTY_REGIONS}
        selectedRegionId={aioSelectedRegionByImage[img.id] ?? null}
        onCardSelect={() => setActiveId(img.id)}
        onSelectRegion={(regionId) =>
          selectAioRegionForImage(img.id, regionId)
        }
        onRegionsChange={(nextRegions, selectedRegionIdOverride) =>
          updateAioRegionsForImage(
            img.id,
            nextRegions,
            selectedRegionIdOverride,
          )
        }
        editable={subMode === 'manual'}
        areaSelectionEnabled={imageAllowsAreaSelection}
        newRegionShapeKind={resolvedAioAreaSelectionShapeKind}
        fallbackStyle={renderDefaultStyle}
        fontRefreshToken={renderFontRefreshToken}
        availableRenderFonts={availableRenderFonts}
        isCompactViewport={isCompactViewport}
        stageBadgeKey={imageStageKey}
        stageBadgeLabel={imageStageBadgeLabel}
        canRewind={imageHistoryMeta.canRewind}
        canForward={imageHistoryMeta.canForward}
        onRewind={() => rewindAioPipelineForImage(img.id)}
        onForward={() => forwardAioPipelineForImage(img.id)}
        historyHint={imageHistoryHint}
        renderStageActive={imageStageKey === 'render'}
        onRequestRefineRegion={() => void refineActiveTypographerShape()}
        onRequestAutoShapeRegion={applyAutoDetectedShapeToActiveRegion}
        availableTypographyPresets={typographyPresetList}
        availableTypographyFolders={typographyFolderList}
        onRequestApplyPresetById={(regionId, presetId) =>
          applyTypographyPresetToRegionById(img.id, regionId, presetId)
        }
        onRequestConvertShapeRegion={(regionId, kind) => {
          if (kind === 'auto') {
            applyAutoDetectedShapeToRegionById(img.id, regionId);
            return;
          }
          convertRegionShapeById(img.id, regionId, kind);
        }}
        manualEditEnabled={subMode === 'manual'}
        manualImageTool={manualImageTool}
        manualPaintColor={manualImagePaintColor}
        manualBrushSize={manualImageBrushSize}
        manualBrushOpacity={manualImageBrushOpacity}
        manualBrushBlur={manualImageBrushBlur}
        manualPaintLayerDataUrl={
          getAioManualImageEditState(img.id).paintLayerDataUrl
        }
        manualWandMaskDataUrl={
          getAioManualImageEditState(img.id).wandMaskDataUrl
        }
        manualHealingPending={Boolean(aioManualHealingBusyByImage[img.id])}
        textFillSwatches={textFillSwatches}
        segmentEditEnabled={imageAllowsSegmentBrush}
        segmentEditTool={segmentEditTool}
        segmentBrushSize={segmentBrushSize}
        segmentBrushDataUrl={
          getAioManualImageEditState(img.id).segmentBrushDataUrl
        }
        onSegmentBrushChange={(nextUrl) =>
          patchAioManualImageEditState(img.id, {
            segmentBrushDataUrl: nextUrl,
          })
        }
        inlineEditorRequestKey={inlineEditorShortcutRequestKey}
        onManualPaintLayerChange={(nextLayer) => {
          patchAioManualImageEditState(img.id, {
            paintLayerDataUrl: nextLayer,
          });
        }}
        onManualWandMaskChange={(nextMask) => {
          patchAioManualImageEditState(img.id, {
            wandMaskDataUrl: nextMask,
          });
        }}
        onManualWandRequest={async (x, y) => {
          await runAioMagicWandForImage(img.id, x, y);
        }}
        onManualHealingMaskCommit={async (maskDataUrl) => {
          await applyAioHealingMaskForImage(img.id, maskDataUrl);
        }}
        translationNotesEnabled={translationNotesEnabled}
      />
    );
  }

  return (
    <TextDetectionPreview
      key={`${img.id}-snapshot-${imageHistoryMeta.index}`}
      label={`#${index + 1} — ${img.file.name}`}
      image={img}
      previewSrc={getPreviewSrc(img)}
      viewMode={viewMode}
      active={resolvedActiveId === img.id}
      regions={aioDetectionsByImage[img.id] ?? EMPTY_REGIONS}
      selectedRegionId={aioSelectedRegionByImage[img.id] ?? null}
      onCardSelect={() => setActiveId(img.id)}
      onSelectRegion={(regionId) =>
        selectAioRegionForImage(img.id, regionId)
      }
      onRegionsChange={(nextRegions, selectedRegionIdOverride) =>
        updateAioRegionsForImage(
          img.id,
          nextRegions,
          selectedRegionIdOverride,
        )
      }
      editable={subMode === 'manual'}
      selectionEnabled={imageAllowsAreaSelection}
      creationEnabled={imageAllowsAreaSelection}
      newRegionShapeKind={resolvedAioAreaSelectionShapeKind}
      segmentEditEnabled={imageAllowsSegmentBrush}
      segmentEditTool={segmentEditTool}
      segmentBrushSize={segmentBrushSize}
      segmentBrushDataUrl={
        getAioManualImageEditState(img.id).segmentBrushDataUrl
      }
      onSegmentBrushChange={(nextUrl) =>
        patchAioManualImageEditState(img.id, {
          segmentBrushDataUrl: nextUrl,
        })
      }
      stageBadgeKey={imageStageKey}
      stageBadgeLabel={imageStageBadgeLabel}
      canRewind={imageHistoryMeta.canRewind}
      canForward={imageHistoryMeta.canForward}
      onRewind={() => rewindAioPipelineForImage(img.id)}
      onForward={() => forwardAioPipelineForImage(img.id)}
      historyHint={imageHistoryHint}
      translationNotesEnabled={translationNotesEnabled}
    />
  );
}
