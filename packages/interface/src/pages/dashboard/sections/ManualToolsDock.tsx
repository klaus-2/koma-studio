import type { TypographyShapeKind } from '../../../typography/types';
import { resolveTypographyPresetForMode } from '../../../typography/presets';
import { useEffect, useMemo } from 'react';
import { useI18n } from '../../../i18n';
import type { useAioRegionEditing } from '../hooks/region-editor';
import type { useCleanerManualEdits } from '../hooks/cleaner';
import {
  useManualToolGatingEffects,
} from '../hooks/manual-tools';
import type {
  useAioManualEdits,
  useAioWandHealing,
  useManualToolToggles as useManualToolTogglesApi,
} from '../hooks/manual-tools';
import { useAioPipelineStore } from '../stores/aio-pipeline-store';
import { useCleanerStore } from '../stores/cleaner-store';
import { useManualToolsStore } from '../stores/manual-tools-store';
import { useRegionEditorStore } from '../stores/region-editor-store';
import { useUiShellStore } from '../stores/ui-shell-store';
import { DashboardManualDock } from '../../../features/dashboard/components/DashboardManualDock';
import { HealingToolHint } from '../../../components/dashboard/HealingToolHint';

type AioRegionEditingApi = ReturnType<typeof useAioRegionEditing>;

interface ManualToolsDockSectionProps {
  /* ── Dock gating (stage-class booleans; tool-value derivations are local) ── */
  manualDockVisible: boolean;
  manualDockRightOffset: number;
  isAioManualMode: boolean;
  activeStageAllowsAreaTools: boolean;
  activeStageAllowsSegmentTools: boolean;
  activeStageAllowsManualImageTools: boolean;

  /* ── Region editor / typographer callbacks (not yet migrated) ── */
  duplicateSelectedTypographerRegion: AioRegionEditingApi['duplicateSelectedTypographerRegion'];
  applyAutoDetectedShapeToActiveRegion: AioRegionEditingApi['applyAutoDetectedShapeToActiveRegion'];
  convertActiveTypographerShape: AioRegionEditingApi['convertActiveTypographerShape'];
  clearAioRegionsForActiveImage: AioRegionEditingApi['clearAioRegionsForActiveImage'];

  /* ── Manual tools callbacks (hooks/manual-tools + hooks/cleaner) ── */
  applyHealingFromActiveWandSelection: ReturnType<
    typeof useAioWandHealing
  >['applyHealingFromActiveWandSelection'];
  activeId: string | null;
  clearManualWandSelection: (imageId: string) => void;
  toggleManualToolsConfig: ReturnType<
    typeof useManualToolTogglesApi
  >['toggleManualToolsConfig'];
  toggleManualImageTool: ReturnType<
    typeof useManualToolTogglesApi
  >['toggleManualImageTool'];
  clearCleanerManualPaintForImage: ReturnType<
    typeof useCleanerManualEdits
  >['clearCleanerManualPaintForImage'];
  clearAioManualPaintForImage: ReturnType<
    typeof useAioManualEdits
  >['clearAioManualPaintForImage'];
  resetCleanerManualImageEditsForImage: ReturnType<
    typeof useCleanerManualEdits
  >['resetCleanerManualImageEditsForImage'];
  resetAioManualImageEditsForImage: ReturnType<
    typeof useAioManualEdits
  >['resetAioManualImageEditsForImage'];

  /* ── Active-image manual edit memos (mode-dependent page memos) ── */
  activeHasManualWandSelection: boolean;
  activeManualHealingBusy: boolean;
  activeHasManualPaintLayer: boolean;
  activeHasManualEdits: boolean;
}

/**
 * Manual tools dock view (the `DashboardManualDock` mount + the healing
 * tool hint). Reads the manual-tools/shell/aio stores and forwards the
 * same-name props the page previously passed (multi-store gating memos
 * stay page props).
 */
export default function ManualToolsDockSection({
  manualDockVisible,
  manualDockRightOffset,
  isAioManualMode,
  activeStageAllowsAreaTools,
  activeStageAllowsSegmentTools,
  activeStageAllowsManualImageTools,
  duplicateSelectedTypographerRegion,
  applyAutoDetectedShapeToActiveRegion,
  convertActiveTypographerShape,
  clearAioRegionsForActiveImage,
  applyHealingFromActiveWandSelection,
  activeId,
  clearManualWandSelection,
  toggleManualToolsConfig,
  toggleManualImageTool,
  clearCleanerManualPaintForImage,
  clearAioManualPaintForImage,
  resetCleanerManualImageEditsForImage,
  resetAioManualImageEditsForImage,
  activeHasManualWandSelection,
  activeManualHealingBusy,
  activeHasManualPaintLayer,
  activeHasManualEdits,
}: ManualToolsDockSectionProps) {
  const { t } = useI18n();
  const setManualToolsConfigOpen = useManualToolsStore(
    (s) => s.setManualToolsConfigOpen,
  );
  const areaSelectionCreateMode = useManualToolsStore(
    (s) => s.areaSelectionCreateMode,
  );
  const setAreaSelectionCreateMode = useManualToolsStore(
    (s) => s.setAreaSelectionCreateMode,
  );
  const segmentEditTool = useManualToolsStore((s) => s.segmentEditTool);
  const segmentBrushSize = useManualToolsStore((s) => s.segmentBrushSize);
  const setSegmentBrushSize = useManualToolsStore(
    (s) => s.setSegmentBrushSize,
  );
  const manualImageTool = useManualToolsStore((s) => s.manualImageTool);
  const manualImageBrushSize = useManualToolsStore(
    (s) => s.manualImageBrushSize,
  );
  const setManualImageBrushSize = useManualToolsStore(
    (s) => s.setManualImageBrushSize,
  );
  const manualImageBrushOpacity = useManualToolsStore(
    (s) => s.manualImageBrushOpacity,
  );
  const setManualImageBrushOpacity = useManualToolsStore(
    (s) => s.setManualImageBrushOpacity,
  );
  const manualImageBrushBlur = useManualToolsStore(
    (s) => s.manualImageBrushBlur,
  );
  const setManualImageBrushBlur = useManualToolsStore(
    (s) => s.setManualImageBrushBlur,
  );
  const manualImagePaintColor = useManualToolsStore(
    (s) => s.manualImagePaintColor,
  );
  const setManualImagePaintColor = useManualToolsStore(
    (s) => s.setManualImagePaintColor,
  );
  const manualImageWandTolerance = useManualToolsStore(
    (s) => s.manualImageWandTolerance,
  );
  const setManualImageWandTolerance = useManualToolsStore(
    (s) => s.setManualImageWandTolerance,
  );
  const setSegmentEditTool = useManualToolsStore((s) => s.setSegmentEditTool);
  const setManualImageTool = useManualToolsStore((s) => s.setManualImageTool);
  const manualToolsConfigOpen = useManualToolsStore(
    (s) => s.manualToolsConfigOpen,
  );
  const healingHintTrigger = useManualToolsStore((s) => s.healingHintTrigger);
  const typographyPresetState = useRegionEditorStore(
    (s) => s.typographyPresetState,
  );
  const mode = useUiShellStore((s) => s.mode);
  const keyboardShortcutConfig = useUiShellStore(
    (s) => s.keyboardShortcutConfig,
  );
  const aioStageSelection = useAioPipelineStore((s) => s.aioStageSelection);

  useManualToolGatingEffects({
    activeStageAllowsAreaTools,
    activeStageAllowsSegmentTools,
    activeStageAllowsManualImageTools,
  });

  const resolvedAioAreaSelectionShapeKindLocal = useMemo<TypographyShapeKind>(() => {
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

  const areaSelectionToolActive =
    segmentEditTool === 'select' && manualImageTool === 'none';
  const manualImageToolHasConfig =
    manualImageTool === 'paint' ||
    manualImageTool === 'paint_eraser' ||
    manualImageTool === 'healing_brush' ||
    manualImageTool === 'magic_wand';
  const areaSelectionToolHasConfig =
    activeStageAllowsAreaTools && areaSelectionToolActive;
  const segmentToolHasConfig =
    activeStageAllowsSegmentTools &&
    (segmentEditTool === 'brush' || segmentEditTool === 'eraser');
  const manualToolHasConfigActiveStage =
    activeStageAllowsManualImageTools && manualImageToolHasConfig;
  const activeDockToolHasConfig =
    areaSelectionToolHasConfig ||
    segmentToolHasConfig ||
    manualToolHasConfigActiveStage;
  const manualToolsConfigVisible =
    manualDockVisible && manualToolsConfigOpen && activeDockToolHasConfig;
  const manualToolsConfigTitle = areaSelectionToolHasConfig
    ? t('dashboard.status.toolSelectArea')
    : segmentToolHasConfig
      ? segmentEditTool === 'brush'
        ? t('dashboard.status.toolSegmentBrush')
        : t('dashboard.status.toolSegmentEraser')
      : manualToolHasConfigActiveStage
        ? manualImageTool === 'paint'
          ? 'Pincel'
          : manualImageTool === 'paint_eraser'
            ? 'Borracha'
            : manualImageTool === 'magic_wand'
              ? 'Varinha'
              : 'Healing'
        : 'Ferramenta';
  useEffect(() => {
    if (!activeDockToolHasConfig && manualToolsConfigOpen) {
      setManualToolsConfigOpen(false);
    }
  }, [activeDockToolHasConfig, manualToolsConfigOpen, setManualToolsConfigOpen]);

  const activeSelectedRegion = useRegionEditorStore((s) => {
    if (!activeId) return null;
    const selectedRegionId =
      s.aioSelectedRegionByImage[activeId] ?? null;
    return (
      s.aioDetectionsByImage[activeId]?.find(
        (region) => region.id === selectedRegionId,
      ) ?? null
    );
  });
  const activeCleanerDetectionsCount = useCleanerStore((s) =>
    activeId ? (s.cleanerDetectionsByImage[activeId]?.length ?? 0) : 0,
  );
  const activeAioRegionsCount = useRegionEditorStore((s) =>
    activeId ? (s.aioDetectionsByImage[activeId]?.length ?? 0) : 0,
  );
  const activeDockRegionsCount =
    mode === 'cleaner'
      ? activeCleanerDetectionsCount
      : activeAioRegionsCount;

  return (
    <>
      {manualDockVisible && (
        <DashboardManualDock
          manualDockRightOffset={manualDockRightOffset}
          manualToolsConfigVisible={manualToolsConfigVisible}
          manualToolsConfigTitle={manualToolsConfigTitle}
          setManualToolsConfigOpen={setManualToolsConfigOpen}
          areaSelectionToolHasConfig={areaSelectionToolHasConfig}
          areaSelectionCreateMode={areaSelectionCreateMode}
          setAreaSelectionCreateMode={setAreaSelectionCreateMode}
          resolvedAioAreaSelectionShapeKind={resolvedAioAreaSelectionShapeKindLocal}
          activeSelectedRegion={activeSelectedRegion}
          duplicateSelectedTypographerRegion={
            duplicateSelectedTypographerRegion
          }
          applyAutoDetectedShapeToActiveRegion={
            applyAutoDetectedShapeToActiveRegion
          }
          convertActiveTypographerShape={convertActiveTypographerShape}
          activeStageAllowsSegmentTools={activeStageAllowsSegmentTools}
          segmentEditTool={segmentEditTool}
          segmentBrushSize={segmentBrushSize}
          setSegmentBrushSize={setSegmentBrushSize}
          activeStageAllowsManualImageTools={activeStageAllowsManualImageTools}
          manualImageTool={manualImageTool}
          manualImageBrushSize={manualImageBrushSize}
          setManualImageBrushSize={setManualImageBrushSize}
          manualImageBrushOpacity={manualImageBrushOpacity}
          setManualImageBrushOpacity={setManualImageBrushOpacity}
          manualImageBrushBlur={manualImageBrushBlur}
          setManualImageBrushBlur={setManualImageBrushBlur}
          manualImagePaintColor={manualImagePaintColor}
          setManualImagePaintColor={setManualImagePaintColor}
          manualImageWandTolerance={manualImageWandTolerance}
          setManualImageWandTolerance={setManualImageWandTolerance}
          activeHasManualWandSelection={activeHasManualWandSelection}
          activeManualHealingBusy={activeManualHealingBusy}
          applyHealingFromActiveWandSelection={
            applyHealingFromActiveWandSelection
          }
          activeId={activeId}
          clearManualWandSelection={clearManualWandSelection}
          aioStageSelection={aioStageSelection}
          toggleManualToolsConfig={toggleManualToolsConfig}
          activeDockToolHasConfig={activeDockToolHasConfig}
          isAioManualMode={isAioManualMode}
          areaSelectionToolActive={areaSelectionToolActive}
          activeStageAllowsAreaTools={activeStageAllowsAreaTools}
          setSegmentEditTool={setSegmentEditTool}
          setManualImageTool={setManualImageTool}
          clearAioRegionsForActiveImage={clearAioRegionsForActiveImage}
          activeDockRegionsCount={activeDockRegionsCount}
          toggleManualImageTool={toggleManualImageTool}
          mode={mode}
          clearCleanerManualPaintForImage={clearCleanerManualPaintForImage}
          clearAioManualPaintForImage={clearAioManualPaintForImage}
          resetCleanerManualImageEditsForImage={
            resetCleanerManualImageEditsForImage
          }
          resetAioManualImageEditsForImage={resetAioManualImageEditsForImage}
          activeHasManualPaintLayer={activeHasManualPaintLayer}
          activeHasManualEdits={activeHasManualEdits}
          shortcutConfig={keyboardShortcutConfig}
        />
      )}

      <HealingToolHint trigger={healingHintTrigger} />
    </>
  );
}