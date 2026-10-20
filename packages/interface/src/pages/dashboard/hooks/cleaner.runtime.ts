/** Cleaner run runtime — store seam and notice timer. Types stay in cleaner.types. */
import { useCleanerStore } from '../stores/cleaner-store';
import { useStatusStore } from '../stores/status-store';
import { useUiShellStore } from '../stores/ui-shell-store';

let noticeClearTimer: number | null = null;

export function scheduleNoticeClear(clear: () => void, ms = 4500): void {
  if (noticeClearTimer !== null) {
    window.clearTimeout(noticeClearTimer);
  }
  noticeClearTimer = window.setTimeout(() => {
    noticeClearTimer = null;
    clear();
  }, ms);
}

export function cancelCleanerNoticeTimer(): void {
  if (noticeClearTimer !== null) {
    window.clearTimeout(noticeClearTimer);
    noticeClearTimer = null;
  }
}

/**
 * Store-backed Cleaner runtime — the seam between the run and the domain stores.
 * Call sites never inject these setters; the deep module owns the write path.
 */
export function resolveCleanerRunStores() {
  const cleaner = useCleanerStore.getState();
  const status = useStatusStore.getState();
  const uiShell = useUiShellStore.getState();
  return {
    cleanerMode: cleaner.cleanerMode,
    cleanerAiModelKey: cleaner.cleanerAiModelKey,
    cleanerAiAdditionalInstructions: cleaner.cleanerAiAdditionalInstructions,
    setCleanerDetectionsByImage: cleaner.setCleanerDetectionsByImage,
    setCleanerSelectedRegionByImage: cleaner.setCleanerSelectedRegionByImage,
    setCleanerProcessedBaseByImage: cleaner.setCleanerProcessedBaseByImage,
    setCleanerRunMetaByImage: cleaner.setCleanerRunMetaByImage,
    setCleanerManualImageEditsByImage: cleaner.setCleanerManualImageEditsByImage,
    setCleanerHealingBusyByImage: cleaner.setCleanerHealingBusyByImage,
    setProcessing: uiShell.setProcessing,
    setProgress: uiShell.setProgress,
    setStatusMessage: status.setStatusMessage,
    setRuntimeExecutionNotice: status.setRuntimeExecutionNotice,
  };
}

export type CleanerStoreBits = ReturnType<typeof resolveCleanerRunStores>;
