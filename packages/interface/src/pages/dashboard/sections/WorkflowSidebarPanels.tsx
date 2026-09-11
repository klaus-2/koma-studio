import { useI18n } from '../../../i18n';
import {
  moveLastImageToNextBatch,
  pullFirstImageFromNextBatch,
} from '../../../components/dashboard/stitch/stitchUtils';
import WorkflowSidebarPanels from '../../../components/dashboard/WorkflowSidebarPanels';
import type {
  useStitchWorkspace,
  useUtilitySplitterController,
} from '../hooks/utility-workspaces';
import { useImageCollectionStore } from '../stores/image-collection-store';
import { useStatusStore } from '../stores/status-store';
import { useUiShellStore } from '../stores/ui-shell-store';
import { useUtilityStore } from '../stores/utility-store';

type StitchWorkspaceApi = ReturnType<typeof useStitchWorkspace>;
type UtilitySplitterControllerApi = ReturnType<
  typeof useUtilitySplitterController
>;

interface WorkflowSidebarPanelsSectionProps {
  /* ── Stitch planning memos + splitter controller (dashboard/hooks/utility-workspaces) ── */
  stitchBatchPlans: StitchWorkspaceApi['stitchBatchPlans'];
  stitchAutoBatchIndexes: StitchWorkspaceApi['stitchAutoBatchIndexes'];
  splitterController: UtilitySplitterControllerApi['splitterController'];
}

/**
 * Workflow sidebar panels view (stitch/split toolboxes). Reads the
 * utility/shell/image/status stores and forwards the same-name props the
 * page previously passed (planning memos and the splitter controller stay
 * hook props).
 */
export default function WorkflowSidebarPanelsSection({
  stitchBatchPlans,
  stitchAutoBatchIndexes,
  splitterController,
}: WorkflowSidebarPanelsSectionProps) {
  const { t } = useI18n();
  const mode = useUiShellStore((s) => s.mode);
  const processing = useUiShellStore((s) => s.processing);
  const images = useImageCollectionStore((s) => s.images);
  const setTonedStatus = useStatusStore((s) => s.setTonedStatus);
  const setStatusMessage = useStatusStore((s) => s.setStatusMessage);
  const stitchLayoutMode = useUtilityStore((s) => s.stitchLayoutMode);
  const setStitchLayoutMode = useUtilityStore((s) => s.setStitchLayoutMode);
  const stitchBatchStrategy = useUtilityStore((s) => s.stitchBatchStrategy);
  const setStitchBatchStrategy = useUtilityStore(
    (s) => s.setStitchBatchStrategy,
  );
  const stitchBatchSize = useUtilityStore((s) => s.stitchBatchSize);
  const setStitchBatchSize = useUtilityStore((s) => s.setStitchBatchSize);
  const stitchTargetPrimaryAxis = useUtilityStore(
    (s) => s.stitchTargetPrimaryAxis,
  );
  const setStitchTargetPrimaryAxis = useUtilityStore(
    (s) => s.setStitchTargetPrimaryAxis,
  );
  const stitchGap = useUtilityStore((s) => s.stitchGap);
  const setStitchGap = useUtilityStore((s) => s.setStitchGap);
  const stitchAlignMode = useUtilityStore((s) => s.stitchAlignMode);
  const setStitchAlignMode = useUtilityStore((s) => s.setStitchAlignMode);
  const stitchBackground = useUtilityStore((s) => s.stitchBackground);
  const setStitchBackground = useUtilityStore((s) => s.setStitchBackground);
  const stitchSingleExportFormat = useUtilityStore(
    (s) => s.stitchSingleExportFormat,
  );
  const setStitchSingleExportFormat = useUtilityStore(
    (s) => s.setStitchSingleExportFormat,
  );
  const stitchFileBaseName = useUtilityStore((s) => s.stitchFileBaseName);
  const setStitchFileBaseName = useUtilityStore((s) => s.setStitchFileBaseName);
  const stitchSelectedBatchIndex = useUtilityStore(
    (s) => s.stitchSelectedBatchIndex,
  );
  const setStitchSelectedBatchIndex = useUtilityStore(
    (s) => s.setStitchSelectedBatchIndex,
  );
  const setStitchBatchIndexes = useUtilityStore((s) => s.setStitchBatchIndexes);
  const stitchTargetAxisLabel =
    stitchLayoutMode === 'webtoon'
      ? 'Altura alvo por lote'
      : 'Comprimento alvo por lote';

  return (
    <WorkflowSidebarPanels
      mode={mode}
      imagesCount={images.length}
      stitchLayoutMode={stitchLayoutMode}
      setStitchLayoutMode={setStitchLayoutMode}
      stitchBatchStrategy={stitchBatchStrategy}
      setStitchBatchStrategy={setStitchBatchStrategy}
      stitchBatchSize={stitchBatchSize}
      setStitchBatchSize={setStitchBatchSize}
      stitchTargetPrimaryAxis={stitchTargetPrimaryAxis}
      stitchTargetAxisLabel={stitchTargetAxisLabel}
      setStitchTargetPrimaryAxis={setStitchTargetPrimaryAxis}
      stitchGap={stitchGap}
      setStitchGap={setStitchGap}
      stitchAlignMode={stitchAlignMode}
      setStitchAlignMode={setStitchAlignMode}
      stitchBackground={stitchBackground}
      setStitchBackground={setStitchBackground}
      stitchSingleExportFormat={stitchSingleExportFormat}
      setStitchSingleExportFormat={setStitchSingleExportFormat}
      stitchFileBaseName={stitchFileBaseName}
      setStitchFileBaseName={setStitchFileBaseName}
      stitchSelectedBatchIndex={stitchSelectedBatchIndex}
      stitchBatchPlans={stitchBatchPlans}
      moveLastToNext={() => {
        setStitchBatchIndexes((current) =>
          moveLastImageToNextBatch(current, stitchSelectedBatchIndex),
        );
        setTonedStatus(t('dashboard.status.stitchLastMoved'), 'success');
      }}
      pullFirstFromNext={() => {
        setStitchBatchIndexes((current) =>
          pullFirstImageFromNextBatch(current, stitchSelectedBatchIndex),
        );
        setTonedStatus(
          t('dashboard.status.stitchFirstPulled'),
          'success',
        );
      }}
      resetPlanning={() => {
        setStitchBatchIndexes(stitchAutoBatchIndexes);
        setStitchSelectedBatchIndex(0);
        setStatusMessage(
          'Stitcher plan recalculated automatically.',
        );
      }}
      splitterController={splitterController}
      processing={processing}
    />
  );
}
