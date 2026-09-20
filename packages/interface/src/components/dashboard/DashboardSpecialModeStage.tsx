import { Suspense, lazy, memo } from 'react';
import { Languages, Upload } from 'lucide-react';
import { useI18n } from '@/i18n';
import { memoLoad } from '../../utils/lazyModule';
import type { ToolMode } from '../../types/dashboard.types';

const loadStitchWorkspace = memoLoad(() => import('./stitch/StitchWorkspace'));
const loadSplitterWorkspace = memoLoad(() => import('./splitter/SplitterWorkspace'));
const loadWatermarkWorkspace = memoLoad(() => import('./watermark/WatermarkWorkspace'));
const loadChapterOptimizerWorkspace = memoLoad(() => import('./optimizer/ChapterOptimizerWorkspace'));

const StitchWorkspace = lazy(loadStitchWorkspace);
const SplitterWorkspace = lazy(loadSplitterWorkspace);
const WatermarkWorkspace = lazy(loadWatermarkWorkspace);
const ChapterOptimizerWorkspace = lazy(loadChapterOptimizerWorkspace);

/** Fire-and-forget warmup of the special workspaces (called at browser idle). */
export function preloadSpecialWorkspaces() {
  void loadStitchWorkspace().catch(() => { });
  void loadSplitterWorkspace().catch(() => { });
  void loadWatermarkWorkspace().catch(() => { });
  void loadChapterOptimizerWorkspace().catch(() => { });
}

const LazyFallback = () => (
  <div className="koma-stage__empty" data-tour="dashboard-stage-empty">
    <div className="koma-spinner" />
    <p>Loading workspace...</p>
  </div>
);

const DashboardSpecialModeStage = ({
  props,
  stageMode,
}: {
  props: any;
  stageMode?: ToolMode;
}) => {
  const { t } = useI18n();
  const {
    mode: immediateMode,
    translatorWorkspaceMode,
    images,
    translatorImageImportRef,
    stitchBatchPlans,
    stitchSelectedBatchIndex,
    setStitchSelectedBatchIndex,
    stitchLayoutMode,
    stitchGap,
    stitchAlignMode,
    stitchBackground,
    stitchSingleExportFormat,
    stitchSafeFileStem,
    processing,
    outQuality,
    ensureVerifiedEmailOrNotify,
    isDesktopRuntime,
    registerDownloads,
    triggerBlobDownload,
    setProcessing,
    setProgress,
    setStatusMessage,
    recordProcessedPages,
    splitterController,
    outFormat,
    optimizerSourceVariants,
    watermarkWorkspaceState,
    optimizerWorkspaceState,
    workspaceRestoreToken,
    onWatermarkWorkspaceStateChange,
    onOptimizerWorkspaceStateChange,
  } = props;

  const mode = (stageMode ?? immediateMode) as ToolMode;

  if (mode === 'translator' && translatorWorkspaceMode === 'visual' && images.length === 0) {
    return (
      <div className="koma-stage__empty" data-tour="dashboard-stage-empty">
        <Languages size={48} />
        <p>{t('dashboard.specialMode.visualEmpty.title')}</p>
        <span>{t('dashboard.specialMode.visualEmpty.description')}</span>
        <button
          type="button"
          className="koma-btn koma-btn--primary"
          onClick={() => translatorImageImportRef.current?.click()}
        >
          <Upload size={14} />
          {t('dashboard.specialMode.visualEmpty.cta')}
        </button>
      </div>
    );
  }

  if (mode === 'stitch') {
    return (
      <Suspense fallback={<LazyFallback />}>
        <StitchWorkspace
          images={images}
          batchPlans={stitchBatchPlans}
          selectedBatchIndex={stitchSelectedBatchIndex}
          onSelectBatchIndex={setStitchSelectedBatchIndex}
          layoutMode={stitchLayoutMode}
          gap={stitchGap}
          alignMode={stitchAlignMode}
          background={stitchBackground}
          singleExportFormat={stitchSingleExportFormat}
          safeFileStem={stitchSafeFileStem}
          processing={processing}
          outQuality={outQuality}
          ensureVerifiedEmailOrNotify={ensureVerifiedEmailOrNotify}
          isDesktopRuntime={isDesktopRuntime}
          registerDownloads={registerDownloads}
          triggerBlobDownload={triggerBlobDownload}
          setProcessing={setProcessing}
          setProgress={setProgress}
          setStatusMessage={setStatusMessage}
          recordProcessedPages={recordProcessedPages}
        />
      </Suspense>
    );
  }

  if (mode === 'split') {
    return (
      <Suspense fallback={<LazyFallback />}>
        <SplitterWorkspace controller={splitterController} />
      </Suspense>
    );
  }

  if (mode === 'watermark') {
    return (
      <Suspense fallback={<LazyFallback />}>
        <WatermarkWorkspace
          toolboxHostId="koma-watermark-toolbox-host"
          workspaceState={watermarkWorkspaceState}
          restoreToken={workspaceRestoreToken}
          onWorkspaceStateChange={onWatermarkWorkspaceStateChange}
          images={images}
          processing={processing}
          progress={props.progress ?? 0}
          outputType={outFormat}
          outputQuality={outQuality}
          ensureVerifiedEmailOrNotify={ensureVerifiedEmailOrNotify}
          registerDownloads={registerDownloads}
          triggerBlobDownload={triggerBlobDownload}
          setProcessing={setProcessing}
          setProgress={setProgress}
          setStatusMessage={setStatusMessage}
          recordProcessedPages={recordProcessedPages}
        />
      </Suspense>
    );
  }

  if (mode === 'optimizer') {
    return (
      <Suspense fallback={<LazyFallback />}>
        <ChapterOptimizerWorkspace
          workspaceState={optimizerWorkspaceState}
          restoreToken={workspaceRestoreToken}
          onWorkspaceStateChange={onOptimizerWorkspaceStateChange}
          images={images}
          sourceVariants={optimizerSourceVariants}
          registerDownloads={registerDownloads}
          triggerBlobDownload={triggerBlobDownload}
          setStatusMessage={setStatusMessage}
        />
      </Suspense>
    );
  }

  return null;
};

export default memo(DashboardSpecialModeStage);
