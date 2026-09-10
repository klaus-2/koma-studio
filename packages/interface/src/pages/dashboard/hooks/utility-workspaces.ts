import { useEffect, useMemo } from 'react';
import type { RefObject } from 'react';

import type {
  StitchImageInput,
} from '../../../components/dashboard/stitch/types';
import {
  buildAutoBatchIndexes,
  buildBatchPlanFromIndexes,
  sanitizeFileStem,
} from '../../../components/dashboard/stitch/stitchUtils';
import type { SplitterWorkspaceState } from '../../../components/dashboard/splitter/types';
import { createDefaultSplitterRecipe } from '../../../components/dashboard/splitter/splitterUtils';
import { useSplitterController } from '../../../components/dashboard/splitter/useSplitterController';
import type { WatermarkWorkspaceState } from '../../../components/dashboard/watermark/watermarkTypes';
import { createDefaultWatermarkDraft } from '../../../components/dashboard/watermark/watermark-core.js';
import type { ChapterOptimizerWorkspaceState } from '../../../components/dashboard/optimizer/ChapterOptimizerWorkspace';
import type { useDashboardProcessingStats } from '../../../hooks/useDashboardProcessingStats';
import type { useDashboardUsageAndPresence } from '../../../hooks/useDashboardUsageAndPresence';
import { useExportStore } from '../stores/export-store';
import { useImageCollectionStore } from '../stores/image-collection-store';
import { useStatusStore } from '../stores/status-store';
import { useTranslatorStore } from '../stores/translator-store';
import { useUiShellStore } from '../stores/ui-shell-store';
import { useUtilityStore } from '../stores/utility-store';
import { useWorkspacePersistenceStore } from '../stores/workspace-persistence-store';
import { triggerBlobDownload } from './export-download';
import type { useDashboardImageCollection } from './image-collection';

type RegisterDownloadsFn = ReturnType<
  typeof useDashboardImageCollection
>['registerDownloads'];
type EnsureVerifiedEmailOrNotifyFn = ReturnType<
  typeof useDashboardUsageAndPresence
>['ensureVerifiedEmailOrNotify'];
type RecordProcessedPagesFn = ReturnType<
  typeof useDashboardProcessingStats
>['recordProcessedPages'];

/**
 * Stitch planning memos + the two [DERIVED] sync effects (batch indexes
 * follow the auto plan; selected batch is clamped to the plan length)
 * and the safe file stem memo.
 */
export function useStitchWorkspace() {
  const images = useImageCollectionStore((s) => s.images);
  const stitchLayoutMode = useUtilityStore((s) => s.stitchLayoutMode);
  const stitchBatchStrategy = useUtilityStore((s) => s.stitchBatchStrategy);
  const stitchBatchSize = useUtilityStore((s) => s.stitchBatchSize);
  const stitchTargetPrimaryAxis = useUtilityStore(
    (s) => s.stitchTargetPrimaryAxis,
  );
  const stitchGap = useUtilityStore((s) => s.stitchGap);
  const stitchBatchIndexes = useUtilityStore((s) => s.stitchBatchIndexes);
  const stitchFileBaseName = useUtilityStore((s) => s.stitchFileBaseName);
  const setStitchBatchIndexes = useUtilityStore((s) => s.setStitchBatchIndexes);
  const setStitchSelectedBatchIndex = useUtilityStore(
    (s) => s.setStitchSelectedBatchIndex,
  );

  const stitchImages = images as StitchImageInput[];
  const stitchAutoBatchIndexes = useMemo(
    () =>
      buildAutoBatchIndexes(
        stitchImages,
        stitchBatchStrategy,
        stitchBatchSize,
        stitchTargetPrimaryAxis,
        stitchLayoutMode,
        stitchGap,
      ),
    [
      stitchBatchSize,
      stitchBatchStrategy,
      stitchGap,
      stitchImages,
      stitchLayoutMode,
      stitchTargetPrimaryAxis,
    ],
  );
  useEffect(() => {
    setStitchBatchIndexes(stitchAutoBatchIndexes);
  }, [setStitchBatchIndexes, stitchAutoBatchIndexes]);
  const stitchBatchPlans = useMemo(
    () =>
      buildBatchPlanFromIndexes(
        stitchBatchIndexes,
        stitchImages,
        stitchLayoutMode,
        stitchGap,
      ),
    [stitchBatchIndexes, stitchGap, stitchImages, stitchLayoutMode],
  );
  useEffect(() => {
    setStitchSelectedBatchIndex((current) => {
      if (stitchBatchPlans.length === 0) return 0;
      return Math.min(current, stitchBatchPlans.length - 1);
    });
  }, [setStitchSelectedBatchIndex, stitchBatchPlans.length]);
  const stitchSafeFileStem = useMemo(
    () => sanitizeFileStem(stitchFileBaseName),
    [stitchFileBaseName],
  );

  return { stitchAutoBatchIndexes, stitchBatchPlans, stitchSafeFileStem };
}

interface UseUtilitySplitterControllerArgs {
  /** workspace-persistence restore token (persistence domain keeps it). */
  workspaceRestoreToken: number;
  isDesktopRuntime: boolean;
  localApiBase: string;
  registerDownloads: RegisterDownloadsFn;
  ensureVerifiedEmailOrNotify: EnsureVerifiedEmailOrNotifyFn;
  recordProcessedPages: RecordProcessedPagesFn;
}

/**
 * Splitter workspace controller (split API) wired to the image-collection,
 * utility and shell/status stores; cross-domain callbacks stay args.
 */
export function useUtilitySplitterController({
  workspaceRestoreToken,
  isDesktopRuntime,
  localApiBase,
  registerDownloads,
  ensureVerifiedEmailOrNotify,
  recordProcessedPages,
}: UseUtilitySplitterControllerArgs) {
  const images = useImageCollectionStore((s) => s.images);
  const activeId = useImageCollectionStore((s) => s.activeId);
  const setActiveId = useImageCollectionStore((s) => s.setActiveId);
  const splitterWorkspaceState = useUtilityStore(
    (s) => s.splitterWorkspaceState,
  );
  const setSplitterWorkspaceState = useUtilityStore(
    (s) => s.setSplitterWorkspaceState,
  );
  const setProcessing = useUiShellStore((s) => s.setProcessing);
  const setProgress = useUiShellStore((s) => s.setProgress);
  const setStatusMessage = useStatusStore((s) => s.setStatusMessage);

  const splitterController = useSplitterController({
    images,
    activeImageId: activeId,
    setActiveImageId: setActiveId,
    initialWorkspaceState: splitterWorkspaceState,
    restoreToken: workspaceRestoreToken,
    onWorkspaceStateChange: setSplitterWorkspaceState,
    isDesktopRuntime,
    localApiBase,
    registerDownloads,
    triggerBlobDownload,
    setProcessing,
    setProgress,
    setStatusMessage,
    ensureVerifiedEmailOrNotify,
    recordProcessedPages,
  });

  return { splitterController };
}

/**
 * Current splitter/watermark/optimizer workspace states: the persisted
 * state or the same defaults the page's memos used.
 */
export function useCurrentUtilityWorkspaceStates() {
  const activeId = useImageCollectionStore((s) => s.activeId);
  const splitterWorkspaceState = useUtilityStore(
    (s) => s.splitterWorkspaceState,
  );
  const watermarkWorkspaceState = useUtilityStore(
    (s) => s.watermarkWorkspaceState,
  );
  const optimizerWorkspaceState = useUtilityStore(
    (s) => s.optimizerWorkspaceState,
  );

  const currentSplitterWorkspaceState = useMemo<SplitterWorkspaceState>(
    () =>
      splitterWorkspaceState ?? {
        recipe: createDefaultSplitterRecipe(),
        imageStates: {},
        activeImageId: activeId,
      },
    [activeId, splitterWorkspaceState],
  );
  const currentWatermarkWorkspaceState = useMemo<WatermarkWorkspaceState>(
    () =>
      watermarkWorkspaceState ?? {
        draft: createDefaultWatermarkDraft(),
        activeImageId: activeId,
        compareMode: 'split',
        compareValue: 58,
        selectedPresetId: '',
        autoSuggestion: 'Use Smart Placement para sugerir posicionamento.',
        userPresets: [],
        watermarkImageFile: null,
        results: [],
        textZoneCache: {},
      },
    [activeId, watermarkWorkspaceState],
  );
  const currentOptimizerWorkspaceState =
    useMemo<ChapterOptimizerWorkspaceState>(
      () =>
        optimizerWorkspaceState ?? {
          recipe: {
            preset: 'web-light',
            outputFormat: 'webp',
            quality: 0.78,
            resizeEnabled: true,
            maxWidth: 1600,
            maxHeight: 2400,
            trimBorders: true,
            trimTolerance: 18,
          },
          selectedPreset: 'web-light',
          activeImageId: activeId,
          results: [],
        },
      [activeId, optimizerWorkspaceState],
    );

  return {
    currentSplitterWorkspaceState,
    currentWatermarkWorkspaceState,
    currentOptimizerWorkspaceState,
  };
}


/* ── Special-mode stage props: the memo bundle handed to DashboardSpecialModeStage
   (multi-store by design: utility stitch config + shell + translator + export +
   persistence; page-only collaborators arrive by args). Identity cadence is
   preserved byte-identically (deps unchanged from the baseline memo). */

export function useSpecialModeStageProps({
  stitchBatchPlans,
  stitchSafeFileStem,
  splitterController,
  ensureVerifiedEmailOrNotify,
  registerDownloads,
  recordProcessedPages,
  optimizerSourceVariants,
  translatorImageImportRef,
  isDesktopRuntime,
  currentWatermarkWorkspaceState,
  currentOptimizerWorkspaceState,
}: {
  stitchBatchPlans: ReturnType<typeof useStitchWorkspace>['stitchBatchPlans'];
  stitchSafeFileStem: ReturnType<typeof useStitchWorkspace>['stitchSafeFileStem'];
  splitterController: ReturnType<typeof useUtilitySplitterController>['splitterController'];
  ensureVerifiedEmailOrNotify: EnsureVerifiedEmailOrNotifyFn;
  registerDownloads: RegisterDownloadsFn;
  recordProcessedPages: RecordProcessedPagesFn;
  optimizerSourceVariants: ReturnType<
    typeof useDashboardImageCollection
  >['optimizerSourceVariants'];
  translatorImageImportRef: RefObject<HTMLInputElement | null>;
  isDesktopRuntime: boolean;
  currentWatermarkWorkspaceState: ReturnType<
    typeof useCurrentUtilityWorkspaceStates
  >['currentWatermarkWorkspaceState'];
  currentOptimizerWorkspaceState: ReturnType<
    typeof useCurrentUtilityWorkspaceStates
  >['currentOptimizerWorkspaceState'];
}) {
  const mode = useUiShellStore((s) => s.mode);
  const processing = useUiShellStore((s) => s.processing);
  const setProcessing = useUiShellStore((s) => s.setProcessing);
  const setProgress = useUiShellStore((s) => s.setProgress);
  const setStatusMessage = useStatusStore((s) => s.setStatusMessage);
  const translatorWorkspaceMode = useTranslatorStore(
    (s) => s.translatorWorkspaceMode,
  );
  const images = useImageCollectionStore((s) => s.images);
  const stitchLayoutMode = useUtilityStore((s) => s.stitchLayoutMode);
  const stitchGap = useUtilityStore((s) => s.stitchGap);
  const stitchAlignMode = useUtilityStore((s) => s.stitchAlignMode);
  const stitchBackground = useUtilityStore((s) => s.stitchBackground);
  const stitchSingleExportFormat = useUtilityStore(
    (s) => s.stitchSingleExportFormat,
  );
  const stitchSelectedBatchIndex = useUtilityStore(
    (s) => s.stitchSelectedBatchIndex,
  );
  const setStitchSelectedBatchIndex = useUtilityStore(
    (s) => s.setStitchSelectedBatchIndex,
  );
  const setWatermarkWorkspaceState = useUtilityStore(
    (s) => s.setWatermarkWorkspaceState,
  );
  const setOptimizerWorkspaceState = useUtilityStore(
    (s) => s.setOptimizerWorkspaceState,
  );
  const outFormat = useExportStore((s) => s.outFormat);
  const outQuality = useExportStore((s) => s.outQuality);
  const workspaceRestoreToken = useWorkspacePersistenceStore(
    (s) => s.workspaceRestoreToken,
  );
  const specialModeStageProps = useMemo(
    () => ({
      mode,
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
      watermarkWorkspaceState: currentWatermarkWorkspaceState,
      optimizerWorkspaceState: currentOptimizerWorkspaceState,
      workspaceRestoreToken,
      onWatermarkWorkspaceStateChange: setWatermarkWorkspaceState,
      onOptimizerWorkspaceStateChange: setOptimizerWorkspaceState,
    }),
    [
      currentOptimizerWorkspaceState,
      currentWatermarkWorkspaceState,
        ensureVerifiedEmailOrNotify,
      images,
      isDesktopRuntime,
      mode,
      optimizerSourceVariants,
      outFormat,
      outQuality,
      processing,
      registerDownloads,
      setOptimizerWorkspaceState,
      setProcessing,
      setProgress,
      setStatusMessage,
      setStitchSelectedBatchIndex,
      setWatermarkWorkspaceState,
      splitterController,
      stitchAlignMode,
      stitchBackground,
      stitchBatchPlans,
      stitchGap,
      stitchLayoutMode,
      stitchSafeFileStem,
      stitchSelectedBatchIndex,
      stitchSingleExportFormat,
      recordProcessedPages,
      translatorImageImportRef,
      translatorWorkspaceMode,
      triggerBlobDownload,
      workspaceRestoreToken,
    ],
  );
  return { specialModeStageProps };
}
