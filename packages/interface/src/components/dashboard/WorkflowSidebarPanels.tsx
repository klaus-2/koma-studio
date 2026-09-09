
import StitchSidebarToolbox from './stitch/StitchSidebarToolbox';
import SplitterSidebarToolbox from './splitter/SplitterSidebarToolbox';

interface WorkflowSidebarPanelsProps {
  mode: string;
  imagesCount: number;
  stitchLayoutMode: any;
  setStitchLayoutMode: (value: any) => void;
  stitchBatchStrategy: any;
  setStitchBatchStrategy: (value: any) => void;
  stitchBatchSize: number;
  setStitchBatchSize: (value: number) => void;
  stitchTargetPrimaryAxis: any;
  stitchTargetAxisLabel: string;
  setStitchTargetPrimaryAxis: (value: any) => void;
  stitchGap: number;
  setStitchGap: (value: number) => void;
  stitchAlignMode: any;
  setStitchAlignMode: (value: any) => void;
  stitchBackground: string;
  setStitchBackground: (value: string) => void;
  stitchSingleExportFormat: any;
  setStitchSingleExportFormat: (value: any) => void;
  stitchFileBaseName: string;
  setStitchFileBaseName: (value: string) => void;
  stitchSelectedBatchIndex: number;
  stitchBatchPlans: any[];
  moveLastToNext: () => void;
  pullFirstFromNext: () => void;
  resetPlanning: () => void;
  splitterController: any;
  processing: boolean;
}

export default function WorkflowSidebarPanels({
  mode,
  imagesCount,
  stitchLayoutMode,
  setStitchLayoutMode,
  stitchBatchStrategy,
  setStitchBatchStrategy,
  stitchBatchSize,
  setStitchBatchSize,
  stitchTargetPrimaryAxis,
  stitchTargetAxisLabel,
  setStitchTargetPrimaryAxis,
  stitchGap,
  setStitchGap,
  stitchAlignMode,
  setStitchAlignMode,
  stitchBackground,
  setStitchBackground,
  stitchSingleExportFormat,
  setStitchSingleExportFormat,
  stitchFileBaseName,
  setStitchFileBaseName,
  stitchSelectedBatchIndex,
  stitchBatchPlans,
  moveLastToNext,
  pullFirstFromNext,
  resetPlanning,
  splitterController,
  processing,
}: WorkflowSidebarPanelsProps) {
  if (mode === 'stitch') {
    return (
      <StitchSidebarToolbox
        imagesCount={imagesCount}
        layoutMode={stitchLayoutMode}
        onLayoutModeChange={setStitchLayoutMode}
        batchStrategy={stitchBatchStrategy}
        onBatchStrategyChange={setStitchBatchStrategy}
        batchSize={stitchBatchSize}
        onBatchSizeChange={setStitchBatchSize}
        targetPrimaryAxis={stitchTargetPrimaryAxis}
        targetAxisLabel={stitchTargetAxisLabel}
        onTargetPrimaryAxisChange={setStitchTargetPrimaryAxis}
        gap={stitchGap}
        onGapChange={setStitchGap}
        alignMode={stitchAlignMode}
        onAlignModeChange={setStitchAlignMode}
        background={stitchBackground}
        onBackgroundChange={setStitchBackground}
        singleExportFormat={stitchSingleExportFormat}
        onSingleExportFormatChange={setStitchSingleExportFormat}
        fileBaseName={stitchFileBaseName}
        onFileBaseNameChange={setStitchFileBaseName}
        selectedBatchIndex={stitchSelectedBatchIndex}
        batchPlans={stitchBatchPlans}
        onMoveLastToNext={moveLastToNext}
        onPullFirstFromNext={pullFirstFromNext}
        onResetPlanning={resetPlanning}
      />
    );
  }

  if (mode === 'split') {
    return (
      <SplitterSidebarToolbox
        controller={splitterController}
        imagesCount={imagesCount}
        processing={processing}
      />
    );
  }

  return null;
}
