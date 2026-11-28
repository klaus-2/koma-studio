import { Suspense, lazy, memo, useMemo } from 'react';
import { Languages, Upload } from 'lucide-react';
import { useI18n } from '@/i18n';
import { useThemeStore } from '@koma/ui/stores/theme-store';
import { memoLoad } from '../../utils/lazyModule';
import { useExportStore } from '../../pages/dashboard/stores/export-store';
import { useCurrentUtilityWorkspaceStates } from '../../pages/dashboard/hooks/utility-workspaces';
import { getModeLabels } from '../../constants/dashboard.constants';
import type { ToolMode } from '../../types/dashboard.types';
import { DashboardLazyFallback } from './DashboardLazyFallback';

const loadStitchWorkspace = memoLoad(() => import('./stitch/StitchWorkspace'));
const loadSplitterWorkspace = memoLoad(() => import('./splitter/SplitterWorkspace'));
const loadWatermarkWorkspace = memoLoad(() => import('./watermark/WatermarkWorkspace'));
const loadChapterOptimizerWorkspace = memoLoad(() => import('./optimizer/ChapterOptimizerWorkspace'));

const StitchWorkspace = lazy(loadStitchWorkspace);
const SplitterWorkspace = lazy(loadSplitterWorkspace);
const WatermarkWorkspace = lazy(loadWatermarkWorkspace);
const ChapterOptimizerWorkspace = lazy(loadChapterOptimizerWorkspace);

export function preloadSpecialWorkspaces() {
  void loadStitchWorkspace().catch(() => { });
  void loadSplitterWorkspace().catch(() => { });
  void loadWatermarkWorkspace().catch(() => { });
  void loadChapterOptimizerWorkspace().catch(() => { });
}

const DashboardSpecialModeStage = ({
  props,
  stageMode,
}: {
  props: any;
  stageMode?: ToolMode;
}) => {
  const { t } = useI18n();
  const noir = useThemeStore((s) => s.family === 'noir');
  const downloadItems = useExportStore((s) => s.downloadItems);
  const modeLabels = useMemo(() => getModeLabels(t), [t]);
  const optimizerSourceVariants = useMemo(() => {
    const variants: Array<{
      id: string;
      imageId: string;
      label: string;
      scope: string;
      blob: Blob;
      previewUrl: string;
    }> = [];
    for (const item of downloadItems) {
      if (item.scope === 'proofreader' || item.scope === 'optimizer') continue;
      variants.push({
        id: `${item.scope}-${item.sourceImageId}`,
        imageId: item.sourceImageId,
        label: modeLabels[item.scope],
        scope: item.scope,
        blob: item.blob,
        previewUrl: item.previewUrl,
      });
    }
    return variants;
  }, [downloadItems, modeLabels]);
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
    outFormat,
    workspaceRestoreToken,
    onWatermarkWorkspaceStateChange,
    onOptimizerWorkspaceStateChange,
  } = props;
  const {
    currentWatermarkWorkspaceState: watermarkWorkspaceState,
    currentOptimizerWorkspaceState: optimizerWorkspaceState,
  } = useCurrentUtilityWorkspaceStates();

  const mode = (stageMode ?? immediateMode) as ToolMode;

  if (mode === 'translator' && translatorWorkspaceMode === 'visual' && images.length === 0) {
    return (
      <div className="koma-stage__empty" data-tour="dashboard-stage-empty">
        <Languages size={48} />
        <p>{t('dashboard.specialMode.visualEmpty.title')}</p>
        <span>{t('dashboard.specialMode.visualEmpty.description')}</span>
        <button
          type="button"
          className={noir ? 'btn-primary panel-cut-sm' : 'koma-btn koma-btn--primary'}
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
      <Suspense fallback={<DashboardLazyFallback />}>
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
      <Suspense fallback={<DashboardLazyFallback />}>
        <SplitterWorkspace />
      </Suspense>
    );
  }

  if (mode === 'watermark') {
    return (
      <Suspense fallback={<DashboardLazyFallback />}>
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
      <Suspense fallback={<DashboardLazyFallback />}>
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
