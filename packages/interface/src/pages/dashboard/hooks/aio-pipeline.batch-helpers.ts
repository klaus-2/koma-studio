import {
  StageBusyError,
  StageModelRefusalError,
  stageKeyForRefusalStage,
} from '@/aio-stages';
import type { TranslateFn } from '@/i18n';
import { useAioPipelineStore } from '@/pages/dashboard/stores/aio-pipeline-store';
import type {
  AioBatchImageResult,
  LoadedImage,
} from '@/types/dashboard.types';

export function isSameImageCollection(
  current: ReadonlyArray<LoadedImage>,
  captured: ReadonlyArray<LoadedImage>,
): boolean {
  return (
    current.length === captured.length &&
    current.every((image, index) => image === captured[index])
  );
}

const ITEM_ERROR_NOTICE_MAX_LENGTH = 200;

function itemErrorMessage(error: unknown): string {
  if (error instanceof Error && error.message.trim().length > 0) {
    return error.message;
  }
  if (typeof error === 'string' && error.trim().length > 0) {
    return error;
  }
  return 'Unknown error';
}

/**
 * The named "model busy — retry" state replaces the raw refusal text on the
 * per-item error notice; any other failure keeps its message.
 */
export function itemBusyMessage(error: unknown, t: TranslateFn): string | null {
  return error instanceof StageBusyError ? t('dashboard.aio.batchItemBusy') : null;
}

/**
 * Surfaces a structured backend refusal (explicit selection of an
 * unimplemented/unknown/unconfigured model) on the stage picker, where the
 * "use default model" action lives.
 */
export function recordStageModelRefusal(error: unknown): void {
  if (!(error instanceof StageModelRefusalError)) {
    return;
  }
  const stageKey = stageKeyForRefusalStage(error.refusal.stage);
  if (stageKey !== null) {
    useAioPipelineStore
      .getState()
      .setAioStageModelRefusal(stageKey, error.refusal);
  }
}

export function buildItemErrorNotice(
  fileName: string,
  error: unknown,
  busyMessage: string | null,
): string {
  if (busyMessage !== null) {
    return `${fileName}: ${busyMessage}`;
  }
  const firstLine = itemErrorMessage(error).split(/\r?\n/, 1)[0] ?? '';
  const collapsed = firstLine.replace(/\s+/g, ' ').trim();
  const summary =
    collapsed.length > ITEM_ERROR_NOTICE_MAX_LENGTH
      ? `${collapsed.slice(0, ITEM_ERROR_NOTICE_MAX_LENGTH - 3)}...`
      : collapsed;

  return `${fileName}: ${summary.length > 0 ? summary : 'Unknown error'}`;
}

export function buildFailedBatchResult(
  image: LoadedImage,
  error: unknown,
  busyMessage: string | null,
): AioBatchImageResult {
  return {
    imageId: image.id,
    detectDetections: [],
    ocrDetections: [],
    translationDetections: [],
    segmentDetections: [],
    cleanDetections: [],
    renderDetections: [],
    cleanedDownload: null,
    countAsProcessed: false,
    executionNotices: [
      buildItemErrorNotice(image.file.name, error, busyMessage),
    ],
  };
}
