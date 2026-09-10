import type { TypographyShapeKind } from '../../../typography/types';
import type { AioTextRegion } from '../../../types/dashboard.types';
import type { useAioRegionEditing } from '../hooks/region-editor';
import type { useCleanerManualEdits } from '../hooks/cleaner';
import type {
  useAioManualEdits,
  useAioWandHealing,
  useManualToolToggles,
} from '../hooks/manual-tools';
import { useAioPipelineStore } from '../stores/aio-pipeline-store';
import { useManualToolsStore } from '../stores/manual-tools-store';
import { useUiShellStore } from '../stores/ui-shell-store';
import { DashboardManualDock } from '../../../features/dashboard/components/DashboardManualDock';
import { HealingToolHint } from '../../../components/dashboard/HealingToolHint';

type AioRegionEditingApi = ReturnType<typeof useAioRegionEditing>;

interface ManualToolsDockSectionProps {
  /* ── Dock gating (multi-store derived in the page; selector candidates in T12) ── */
  manualDockVisible: boolean;
  manualDockRightOffset: number;
  manualToolsConfigVisible: boolean;
  manualToolsConfigTitle: string;
  areaSelectionToolHasConfig: boolean;
  activeDockToolHasConfig: boolean;
  activeDockRegionsCount: number;
  isAioManualMode: boolean;
  areaSelectionToolActive: boolean;
  activeStageAllowsAreaTools: boolean;
  activeStageAllowsSegmentTools: boolean;
  activeStageAllowsManualImageTools: boolean;

  /* ── Region editor / typographer callbacks (not yet migrated) ── */
  resolvedAioAreaSelectionShapeKind: TypographyShapeKind;
  activeSelectedRegion: AioTextRegion | null;
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
    typeof useManualToolToggles
  >['toggleManualToolsConfig'];
  toggleManualImageTool: ReturnType<
    typeof useManualToolToggles
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
  manualToolsConfigVisible,
  manualToolsConfigTitle,
  areaSelectionToolHasConfig,
  activeDockToolHasConfig,
  activeDockRegionsCount,
  isAioManualMode,
  areaSelectionToolActive,
  activeStageAllowsAreaTools,
  activeStageAllowsSegmentTools,
  activeStageAllowsManualImageTools,
  resolvedAioAreaSelectionShapeKind,
  activeSelectedRegion,
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
  const healingHintTrigger = useManualToolsStore((s) => s.healingHintTrigger);
  const mode = useUiShellStore((s) => s.mode);
  const keyboardShortcutConfig = useUiShellStore(
    (s) => s.keyboardShortcutConfig,
  );
  const aioStageSelection = useAioPipelineStore((s) => s.aioStageSelection);

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
          resolvedAioAreaSelectionShapeKind={resolvedAioAreaSelectionShapeKind}
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
