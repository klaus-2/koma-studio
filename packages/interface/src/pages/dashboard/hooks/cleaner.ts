import { useCallback, useEffect } from 'react';
import { useI18n } from '../../../i18n';
import {
  type CleanerRun,
  type UseCleanerActionsArgs,
} from './cleaner.types';
import {
  cancelCleanerNoticeTimer,
  resolveCleanerRunStores,
} from './cleaner.runtime';
import { runAssistedCleanerWorkflow } from './cleaner.assisted';
import { runAutomaticCleanerWorkflow } from './cleaner.automatic';

export {
  useCleanerRegionEditing,
  useCleanerManualEdits,
  useCleanerWandHealing,
  useActiveCleanerRegionState,
} from './cleaner.editing';
export {
  useCleanerModelSelection,
  useCleanerAiStageOptions,
  useCleanerAiDraftProfileActions,
} from './cleaner.options';
export type {
  CleanerDownloadEntry,
  CleanerRun,
  UseCleanerActionsArgs,
} from './cleaner.types';
export { cancelCleanerNoticeTimer, resolveCleanerRunStores } from './cleaner.runtime';

export function useCleanerActions(args: UseCleanerActionsArgs): CleanerRun {
  const {
    images,
    activeImage,
    localApiUrl,
    detectSelectionKey,
    ocrSelectionKey,
    segmentSelectionKey,
    cleanSelectionKey,
    selectedCleanerCustomProfile,
    sourceLanguage,
    llmSettings,
    maskDilation,
    hdStrategy,
    hdResizeLimit,
    hdCropMargin,
    hdCropTriggerSize,
    effectiveBatchConcurrency,
    minRegionSize,
    modelEntries,
    selectedCustomOcrProfile,
    discord,
    ensureVerifiedEmailOrNotify,
    openModelManagerForStage,
    getAioStageOption,
    parseApiError,
    registerDownloads,
    recordProcessedPages,
    emitProcessStartWebhook,
    emitProcessCompleteWebhook,
    emitProcessErrorWebhook,
    syncDiscordForTab,
    onRunComplete,
  } = args;
  const { t } = useI18n();

  useEffect(() => {
    return () => {
      cancelCleanerNoticeTimer();
    };
  }, []);

  return useCallback(async () => {
    if (!ensureVerifiedEmailOrNotify()) return;
    if (images.length === 0) return;
    const storeBits = resolveCleanerRunStores();
    storeBits.setRuntimeExecutionNotice(null);

    await runCleaner({
      ...args,
      ...storeBits,
      t,
    });
  }, [
    activeImage,
    cleanSelectionKey,
    detectSelectionKey,
    discord,
    effectiveBatchConcurrency,
    emitProcessCompleteWebhook,
    emitProcessErrorWebhook,
    emitProcessStartWebhook,
    ensureVerifiedEmailOrNotify,
    getAioStageOption,
    hdCropMargin,
    hdCropTriggerSize,
    hdResizeLimit,
    hdStrategy,
    images,
    llmSettings,
    localApiUrl,
    maskDilation,
    minRegionSize,
    modelEntries,
    ocrSelectionKey,
    parseApiError,
    registerDownloads,
    selectedCleanerCustomProfile,
    segmentSelectionKey,
    selectedCustomOcrProfile,
    onRunComplete,
    sourceLanguage,
    syncDiscordForTab,
    recordProcessedPages,
    t,
    openModelManagerForStage,
  ]);
}

/**
 * Deep Cleaner run — assisted + automatic AI + AI SFX behind one interface.
 * Tests hit this seam; the workflows behind it stay in their modules.
 */
export async function runCleaner(
  ctx: import('./cleaner.types').CleanerRunContext,
): Promise<void> {
  if (ctx.cleanerMode === 'automatic_ai' || ctx.cleanerMode === 'ai_sfx') {
    await runAutomaticCleanerWorkflow(ctx);
    return;
  }
  await runAssistedCleanerWorkflow(ctx);
}