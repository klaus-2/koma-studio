import { useCallback } from 'react';

import TextDetectionPreview from '../../../components/dashboard/TextDetectionPreview';
import RenderTextPreview from '../../../components/dashboard/RenderTextPreview';
import DashboardInfoModeStage from '../../../components/dashboard/DashboardInfoModeStage';
import DashboardSpecialModeStage from '../../../components/dashboard/DashboardSpecialModeStage';
import DashboardStageGrid from '../../../components/dashboard/DashboardStageGrid';
import DashboardEmptyStage from '../../../components/dashboard/DashboardEmptyStage';
import { PreviewStageItem } from '../../../components/dashboard/PreviewStageItem';
import { TranslatorVisualStageItem } from '../../../components/dashboard/TranslatorVisualStageItem';
import { CleanerStageItem } from '../../../components/dashboard/CleanerStageItem';
import { TypesetterStageItem } from '../../../components/dashboard/TypesetterStageItem';
import TranslatorTextStage from './TranslatorTextStage';
import type { useSpecialModeStageProps } from '../hooks/utility-workspaces';

type SpecialModeStageProps = ReturnType<typeof useSpecialModeStageProps>['specialModeStageProps'];

import { useI18n } from '../../../i18n';
import { cn } from '../../../utils/dashboard.utils';
import { EMPTY_REGIONS } from '../../../utils/dashboardRenderUtils';
import { AIO_STAGE_BADGE_LABELS } from '../../../constants/dashboard.constants';
import { useImageCollectionStore } from '../stores/image-collection-store';
import { useUiShellStore } from '../stores/ui-shell-store';
import { useRegionEditorStore } from '../stores/region-editor-store';
import { useAioPipelineStore } from '../stores/aio-pipeline-store';
import { useManualToolsStore } from '../stores/manual-tools-store';
import { useTypographerStore } from '../stores/typographer-store';
import { useCleanerStore } from '../stores/cleaner-store';
import { useTranslatorStore } from '../stores/translator-store';
import { useAioRegionSnapshotSync, useAioRegionEditing } from '../hooks/region-editor';
import { useCleanerRegionEditing, useCleanerManualEdits, useCleanerWandHealing } from '../hooks/cleaner';
import { useAioManualEdits, useAioWandHealing } from '../hooks/manual-tools';
import { useTranslatorRegionEditing, useTranslatorTextActions, useTranslatorImports } from '../hooks/translator';
import { useTypographerWorkspace, useTypographerControls } from '../hooks/typographer';
import { useDashboardImageCollection } from '../hooks/image-collection';
import { useRenderFontCatalog } from '../../../hooks/useRenderFontCatalog';
import { useDashboardDownloadActions } from '../hooks/export-download';
import type {
  AioPipelineSnapshotKey,
  DownloadItem,
} from '../../../types/dashboard.types';
import type { TypographyShapeKind } from '../../../typography/types';
import type { listTextFillSwatches } from '../../../utils/textFillPicker';

/* Store/hook-backed prop types (same fields the page reads today). */
type ImageCollectionState = ReturnType<typeof useImageCollectionStore.getState>;
type UiShellState = ReturnType<typeof useUiShellStore.getState>;
type RegionEditorState = ReturnType<typeof useRegionEditorStore.getState>;
type AioPipelineState = ReturnType<typeof useAioPipelineStore.getState>;
type ManualToolsState = ReturnType<typeof useManualToolsStore.getState>;
type TypographerState = ReturnType<typeof useTypographerStore.getState>;
type CleanerState = ReturnType<typeof useCleanerStore.getState>;
type TranslatorState = ReturnType<typeof useTranslatorStore.getState>;
type AioSnapshotSyncApi = ReturnType<typeof useAioRegionSnapshotSync>;
type AioRegionEditingApi = ReturnType<typeof useAioRegionEditing>;
type TypographerControlsApi = ReturnType<typeof useTypographerControls>;
type CleanerRegionEditingApi = ReturnType<typeof useCleanerRegionEditing>;
type TranslatorRegionEditingApi = ReturnType<typeof useTranslatorRegionEditing>;
type CleanerManualEditsApi = ReturnType<typeof useCleanerManualEdits>;
type AioManualEditsApi = ReturnType<typeof useAioManualEdits>;
type CleanerWandHealingApi = ReturnType<typeof useCleanerWandHealing>;
type AioWandHealingApi = ReturnType<typeof useAioWandHealing>;
type TypographerWorkspaceApi = ReturnType<typeof useTypographerWorkspace>;
type ImageCollectionApi = ReturnType<typeof useDashboardImageCollection>;
type RenderFontCatalogApi = ReturnType<typeof useRenderFontCatalog>;
type TranslatorTextActionsApi = ReturnType<typeof useTranslatorTextActions>;
type TranslatorImportsApi = ReturnType<typeof useTranslatorImports>;
type DownloadActionsApi = ReturnType<typeof useDashboardDownloadActions>;

/**
 * Stage-item render helpers that feed `React.memo(..., areEqual)` previews
 * (RenderTextPreview / TextDetectionPreview). Callback identity is
 * load-bearing: every dep arrives as a same-name prop so the original
 * `useCallback` dep values (and their re-creation cadence) are preserved.
 */
export interface DashboardStageSectionProps {
  /* ── Store-backed values (forwarded by DashboardMainLayout selectors) ── */
  images: ImageCollectionState['images'];
  setActiveId: ImageCollectionState['setActiveId'];
  mode: UiShellState['mode'];
  subMode: UiShellState['subMode'];
  viewMode: UiShellState['viewMode'];
  zoom: UiShellState['zoom'];
  inlineEditorShortcutRequestKey: UiShellState['inlineEditorShortcutRequestKey'];
  emptyPreviewTipIndex: UiShellState['emptyPreviewTipIndex'];
  aioDetectionsByImage: RegionEditorState['aioDetectionsByImage'];
  aioSelectedRegionByImage: RegionEditorState['aioSelectedRegionByImage'];
  renderDefaultStyle: RegionEditorState['renderDefaultStyle'];
  aioSteps: AioPipelineState['aioSteps'];
  aioPipelineSnapshots: AioPipelineState['aioPipelineSnapshots'];
  aioManualHealingBusyByImage: ManualToolsState['aioManualHealingBusyByImage'];
  manualImageTool: ManualToolsState['manualImageTool'];
  manualImagePaintColor: ManualToolsState['manualImagePaintColor'];
  manualImageBrushSize: ManualToolsState['manualImageBrushSize'];
  manualImageBrushOpacity: ManualToolsState['manualImageBrushOpacity'];
  manualImageBrushBlur: ManualToolsState['manualImageBrushBlur'];
  segmentEditTool: ManualToolsState['segmentEditTool'];
  segmentBrushSize: ManualToolsState['segmentBrushSize'];
  typographerSelectionTool: TypographerState['typographerSelectionTool'];
  typographerMultiSelectedByImage: TypographerState['typographerMultiSelectedByImage'];
  setTypographerMultiSelectedByImage: TypographerState['setTypographerMultiSelectedByImage'];
  cleanerRunMetaByImage: CleanerState['cleanerRunMetaByImage'];
  cleanerDetectionsByImage: CleanerState['cleanerDetectionsByImage'];
  cleanerSelectedRegionByImage: CleanerState['cleanerSelectedRegionByImage'];
  cleanerHealingBusyByImage: CleanerState['cleanerHealingBusyByImage'];
  cleanerShowOverlays: CleanerState['cleanerShowOverlays'];
  translatorRunMetaByImage: TranslatorState['translatorRunMetaByImage'];
  translatorDetectionsByImage: TranslatorState['translatorDetectionsByImage'];
  translatorSelectedRegionByImage: TranslatorState['translatorSelectedRegionByImage'];
  translatorWorkspaceMode: TranslatorState['translatorWorkspaceMode'];

  /* ── Region editing / manual tools callbacks ── */
  selectAioRegionForImage: AioSnapshotSyncApi['selectAioRegionForImage'];
  updateAioRegionsForImage: AioSnapshotSyncApi['updateAioRegionsForImage'];
  selectCleanerRegionForImage: CleanerRegionEditingApi['selectCleanerRegionForImage'];
  updateCleanerRegionsForImage: CleanerRegionEditingApi['updateCleanerRegionsForImage'];
  selectTranslatorRegionForImage: TranslatorRegionEditingApi['selectTranslatorRegionForImage'];
  updateTranslatorRegionsForImage: TranslatorRegionEditingApi['updateTranslatorRegionsForImage'];
  getAioManualImageEditState: AioManualEditsApi['getAioManualImageEditState'];
  patchAioManualImageEditState: AioManualEditsApi['patchAioManualImageEditState'];
  getCleanerManualImageEditState: CleanerManualEditsApi['getCleanerManualImageEditState'];
  patchCleanerManualImageEditState: CleanerManualEditsApi['patchCleanerManualImageEditState'];
  runAioMagicWandForImage: AioWandHealingApi['runAioMagicWandForImage'];
  applyAioHealingMaskForImage: AioWandHealingApi['applyAioHealingMaskForImage'];
  runCleanerMagicWandForImage: CleanerWandHealingApi['runCleanerMagicWandForImage'];
  applyCleanerHealingMaskForImage: CleanerWandHealingApi['applyCleanerHealingMaskForImage'];
  refineActiveTypographerShape: TypographerControlsApi['refineActiveTypographerShape'];

  /* ── AIO pipeline history ── */
  rewindAioPipelineForImage: (imageId: string) => void;
  forwardAioPipelineForImage: (imageId: string) => void;
  getAioImageSnapshotMeta: (
    imageId: string,
  ) => {
    index: number;
    canRewind: boolean;
    canForward: boolean;
    label: string | null;
    key: AioPipelineSnapshotKey | null;
  };
  getAioFallbackStageKey: () => AioPipelineSnapshotKey;
  getAioDownloadItemForImage: (imageId: string) => DownloadItem | null;

  /* ── Region-editor / typographer derived values ── */
  resolvedActiveId: string | null;
  resolvedAioAreaSelectionShapeKind: TypographyShapeKind;
  areaSelectionToolActive: boolean;
  applyAutoDetectedShapeToActiveRegion: AioRegionEditingApi['applyAutoDetectedShapeToActiveRegion'];
  applyAutoDetectedShapeToRegionById: AioRegionEditingApi['applyAutoDetectedShapeToRegionById'];
  applyTypographyPresetToRegionById: AioRegionEditingApi['applyTypographyPresetToRegionById'];
  convertRegionShapeById: AioRegionEditingApi['convertRegionShapeById'];
  textFillSwatches: ReturnType<typeof listTextFillSwatches>;
  typographyPresetList: RegionEditorState['typographyPresetState']['presets'];
  typographyFolderList: RegionEditorState['typographyPresetState']['folders'];
  translationNotesEnabled: boolean;
  currentEmptyPreviewTip: string | undefined;

  /* ── Shell / fonts ── */
  isCompactViewport: boolean;
  renderFontRefreshToken: RenderFontCatalogApi['renderFontRefreshToken'];
  availableRenderFonts: RenderFontCatalogApi['availableRenderFonts'];
  handleStageWheelZoom: (event: React.WheelEvent<HTMLElement>) => void;

  /* ── Stage branch consumers ── */
  specialModeStageProps: SpecialModeStageProps;
  onOpenSettings: (() => void) | undefined;
  translatorTextImportRef: React.RefObject<HTMLInputElement | null>;
  runTranslatorText: TranslatorTextActionsApi;
  handleDownload: DownloadActionsApi['handleDownload'];
  handleTranslatorTextImport: TranslatorImportsApi['handleTranslatorTextImport'];
  getPreviewSrc: ImageCollectionApi['getPreviewSrc'];
  typographerWorkspace: TypographerWorkspaceApi;
}

/**
 * Center-stage view: the `<section>` stage block with its mode branches and
 * the per-image stage-item renderers (moved 1:1 from the page, deps fed by
 * same-name props).
 */
export default function DashboardStageSection({
  images,
  setActiveId,
  mode,
  subMode,
  viewMode,
  zoom,
  inlineEditorShortcutRequestKey,
  emptyPreviewTipIndex,
  aioDetectionsByImage,
  aioSelectedRegionByImage,
  renderDefaultStyle,
  aioSteps,
  aioPipelineSnapshots,
  aioManualHealingBusyByImage,
  manualImageTool,
  manualImagePaintColor,
  manualImageBrushSize,
  manualImageBrushOpacity,
  manualImageBrushBlur,
  segmentEditTool,
  segmentBrushSize,
  typographerSelectionTool,
  typographerMultiSelectedByImage,
  setTypographerMultiSelectedByImage,
  cleanerRunMetaByImage,
  cleanerDetectionsByImage,
  cleanerSelectedRegionByImage,
  cleanerHealingBusyByImage,
  cleanerShowOverlays,
  translatorRunMetaByImage,
  translatorDetectionsByImage,
  translatorSelectedRegionByImage,
  translatorWorkspaceMode,
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
  resolvedAioAreaSelectionShapeKind,
  areaSelectionToolActive,
  applyAutoDetectedShapeToActiveRegion,
  applyAutoDetectedShapeToRegionById,
  applyTypographyPresetToRegionById,
  convertRegionShapeById,
  textFillSwatches,
  typographyPresetList,
  typographyFolderList,
  translationNotesEnabled,
  currentEmptyPreviewTip,
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

  const renderAioStageItem = useCallback(
    (
      img: (typeof images)[number],
      index: number,
      imageHistoryMeta: ReturnType<typeof getAioImageSnapshotMeta>,
      imageStageKey: AioPipelineSnapshotKey,
      imageStageBadgeLabel: string,
      imageHistoryHint: string | null,
    ) => {
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
            zoom={zoom}
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
          zoom={zoom}
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
    },
    [
      aioDetectionsByImage,
      aioManualHealingBusyByImage,
      aioSelectedRegionByImage,
      aioSteps.render,
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
      zoom,
      forwardAioPipelineForImage,
    ],
  );
  const stageItemKey = useCallback(
    (index: number) => images[index]?.id ?? `${index}`,
    [images],
  );
  const renderStageItem = useCallback(
    (index: number) => {
      const img = images[index];
      if (!img) return null;

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
          <TypesetterStageItem
            img={img}
            index={index}
            getAioDownloadItemForImage={(imageId) => {
              const item = getAioDownloadItemForImage(imageId);
              return item ? { previewUrl: item.previewUrl } : undefined;
            }}
            getPreviewSrc={getPreviewSrc}
            aioDetectionsByImage={aioDetectionsByImage}
            aioSelectedRegionByImage={aioSelectedRegionByImage}
            resolvedActiveId={resolvedActiveId}
            subMode={subMode}
            typographerSelectionTool={typographerSelectionTool}
            renderDefaultStyle={renderDefaultStyle}
            renderFontRefreshToken={renderFontRefreshToken}
            availableRenderFonts={availableRenderFonts}
            isCompactViewport={isCompactViewport}
            inlineEditorShortcutRequestKey={inlineEditorShortcutRequestKey}
            textFillSwatches={textFillSwatches}
            translationNotesEnabled={translationNotesEnabled}
            typographerMultiSelectedByImage={typographerMultiSelectedByImage}
            typographyPresetList={typographyPresetList}
            viewMode={viewMode}
            zoom={zoom}
            onSelect={(id) => setActiveId(id)}
            onSelectRegion={(imageId, regionId) =>
              selectAioRegionForImage(imageId, regionId)
            }
            onSetTypographerSelectedRegionId={(imageId, regionId) =>
              typographerWorkspace.setSelectedRegionId(imageId, regionId)
            }
            onClearTypographerMultiSelect={(imageId: string) => {
              setTypographerMultiSelectedByImage((prev: Record<string, string[]>) => {
                const { [imageId]: _removed, ...rest } = prev;
                return rest;
              });
            }}
            onRegionsChange={(imageId, nextRegions, selectedRegionIdOverride) =>
              updateAioRegionsForImage(imageId, nextRegions, selectedRegionIdOverride)
            }
            onRefineActiveShape={() => void refineActiveTypographerShape()}
            onAutoShapeActiveRegion={applyAutoDetectedShapeToActiveRegion}
            onApplyPresetToRegion={applyTypographyPresetToRegionById}
            onConvertRegionShape={(imageId, regionId, kind) =>
              convertRegionShapeById(
                imageId,
                regionId,
                kind as unknown as Parameters<typeof convertRegionShapeById>[2],
              )
            }
            onMultiSelectToggle={(imageId: string, regionId: string) => {
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
            }}
          />
        );
      }

      if (mode === 'cleaner') {
        return (
          <CleanerStageItem
            img={img}
            index={index}
            cleanerRunMetaByImage={cleanerRunMetaByImage}
            cleanerDetectionsByImage={cleanerDetectionsByImage}
            cleanerSelectedRegionByImage={cleanerSelectedRegionByImage}
            cleanerHealingBusyByImage={cleanerHealingBusyByImage}
            cleanerShowOverlays={cleanerShowOverlays}
            getCleanerManualImageEditState={getCleanerManualImageEditState}
            getPreviewSrc={getPreviewSrc}
            resolvedActiveId={resolvedActiveId}
            resolvedAioAreaSelectionShapeKind={resolvedAioAreaSelectionShapeKind}
            renderDefaultStyle={renderDefaultStyle}
            renderFontRefreshToken={renderFontRefreshToken}
            availableRenderFonts={availableRenderFonts}
            isCompactViewport={isCompactViewport}
            manualImageBrushOpacity={manualImageBrushOpacity}
            manualImageBrushBlur={manualImageBrushBlur}
            manualImageBrushSize={manualImageBrushSize}
            manualImagePaintColor={manualImagePaintColor}
            manualImageTool={manualImageTool}
            segmentEditTool={segmentEditTool}
            segmentBrushSize={segmentBrushSize}
            inlineEditorShortcutRequestKey={inlineEditorShortcutRequestKey}
            textFillSwatches={textFillSwatches}
            viewMode={viewMode}
            zoom={zoom}
            onSelect={(id) => setActiveId(id)}
            onSelectRegion={(imageId, regionId) =>
              selectCleanerRegionForImage(imageId, regionId)
            }
            onRegionsChange={(imageId, nextRegions, selectedRegionIdOverride) =>
              updateCleanerRegionsForImage(
                imageId,
                nextRegions,
                selectedRegionIdOverride,
              )
            }
            onManualPaintLayerChange={(imageId, nextLayer) =>
              patchCleanerManualImageEditState(imageId, {
                paintLayerDataUrl: nextLayer,
              })
            }
            onManualWandMaskChange={(imageId, nextMask) =>
              patchCleanerManualImageEditState(imageId, {
                wandMaskDataUrl: nextMask,
              })
            }
            onManualWandRequest={async (imageId, x, y) => {
              await runCleanerMagicWandForImage(imageId, x, y);
            }}
            onManualHealingMaskCommit={async (imageId, maskDataUrl) => {
              await applyCleanerHealingMaskForImage(imageId, maskDataUrl);
            }}
          />
        );
      }

      if (mode === 'translator' && translatorWorkspaceMode === 'visual') {
        return (
          <TranslatorVisualStageItem
            img={img}
            index={index}
            translatorRunMetaByImage={translatorRunMetaByImage}
            translatorDetectionsByImage={translatorDetectionsByImage}
            translatorSelectedRegionByImage={translatorSelectedRegionByImage}
            resolvedActiveId={resolvedActiveId}
            resolvedAioAreaSelectionShapeKind={resolvedAioAreaSelectionShapeKind}
            segmentBrushSize={segmentBrushSize}
            translationNotesEnabled={translationNotesEnabled}
            viewMode={viewMode}
            zoom={zoom}
            getPreviewSrc={getPreviewSrc}
            onSelect={(id) => setActiveId(id)}
            onSelectRegion={(imageId, regionId) =>
              selectTranslatorRegionForImage(imageId, regionId)
            }
            onRegionsChange={(imageId, nextRegions, selectedRegionIdOverride) =>
              updateTranslatorRegionsForImage(
                imageId,
                nextRegions,
                selectedRegionIdOverride,
              )
            }
          />
        );
      }

      return (
        <PreviewStageItem
          img={img}
          index={index}
          viewMode={viewMode}
          zoom={zoom}
          resolvedActiveId={resolvedActiveId}
          onSelect={(id) => setActiveId(id)}
          getPreviewSrc={getPreviewSrc}
        />
      );
    },
    [
      aioPipelineSnapshots,
      getAioFallbackStageKey,
      getAioImageSnapshotMeta,
      images,
      mode,
      renderAioStageItem,
      setActiveId,
      setTypographerMultiSelectedByImage,
      t,
      translatorWorkspaceMode,
      translationNotesEnabled,
    ],
  );

  // ═══════════ CENTER STAGE ═══════════
  return (
    <section
      className="koma-stage custom-scrollbar"
      data-tour="dashboard-stage"
      onWheel={handleStageWheelZoom}
    >
      {/* Info modes show content instead of images */}
      {mode === 'guides' ||
      mode === 'resources' ||
      mode === 'blogger' ||
      mode === 'imgur' ? (
        <DashboardInfoModeStage
          mode={mode}
          onOpenSettings={onOpenSettings ?? (() => {})}
        />
      ) : mode === 'translator' && translatorWorkspaceMode === 'text' ? (
        <TranslatorTextStage
          translatorTextImportRef={translatorTextImportRef}
          runTranslatorText={runTranslatorText}
          handleDownload={handleDownload}
          handleTranslatorTextImport={handleTranslatorTextImport}
        />
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
          <DashboardStageGrid
            viewMode={viewMode}
            itemCount={images.length}
            itemKey={stageItemKey}
            renderStageItem={renderStageItem}
          />
        </div>
      ) : (
        <DashboardEmptyStage
          emptyPreviewTipIndex={emptyPreviewTipIndex}
          currentEmptyPreviewTip={currentEmptyPreviewTip ?? ''}
        />
      )}
    </section>
  );
}
