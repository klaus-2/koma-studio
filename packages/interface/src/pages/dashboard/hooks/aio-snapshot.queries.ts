import { AIO_MANUAL_STAGE_ORDER } from '@/constants/dashboard.constants';
import type { useAioPipelineStore } from '@/pages/dashboard/stores/aio-pipeline-store';
import type { useUiShellStore } from '@/pages/dashboard/stores/ui-shell-store';
import type { AioPipelineSnapshotKey } from '@/types/dashboard.types';

export type PipelineState = ReturnType<typeof useAioPipelineStore.getState>;
export type ShellState = ReturnType<typeof useUiShellStore.getState>;

export interface AioImageSnapshotMeta {
  readonly index: number;
  readonly canRewind: boolean;
  readonly canForward: boolean;
  readonly label: string | null;
  readonly key: AioPipelineSnapshotKey | null;
}

export function isSnapshotIndex(index: number, length: number): boolean {
  return Number.isInteger(index) && index >= 0 && index < length;
}

export function isManualAioMode(
  shell: Pick<ShellState, 'mode' | 'subMode'>,
): boolean {
  return shell.mode === 'aio' && shell.subMode === 'manual';
}

export function resolveImageSnapshotIndex(
  imageId: string,
  pipeline: PipelineState,
  shell: Pick<ShellState, 'mode' | 'subMode'>,
): number {
  const manual = isManualAioMode(shell)
    ? pipeline.aioManualProgressByImage[imageId]
    : undefined;

  const explicit = pipeline.aioImageSnapshotIndexById[imageId];
  const index =
    manual?.currentIndex ??
    explicit ??
    (pipeline.aioPipelineSnapshotIndex >= 0
      ? pipeline.aioPipelineSnapshotIndex
      : pipeline.aioPipelineSnapshots.length - 1);

  return isSnapshotIndex(index, pipeline.aioPipelineSnapshots.length)
    ? index
    : -1;
}

export function resolveImageSnapshotMeta(
  imageId: string,
  pipeline: PipelineState,
  shell: Pick<ShellState, 'mode' | 'subMode'>,
): AioImageSnapshotMeta {
  const index = resolveImageSnapshotIndex(imageId, pipeline, shell);
  const snapshot =
    index >= 0 ? pipeline.aioPipelineSnapshots[index] : undefined;
  const manual = isManualAioMode(shell)
    ? pipeline.aioManualProgressByImage[imageId]
    : undefined;

  const lastIndex = pipeline.aioPipelineSnapshots.length - 1;
  const forwardCap = isManualAioMode(shell)
    ? Math.min(manual?.unlockedMaxIndex ?? index, lastIndex)
    : lastIndex;

  return {
    index,
    canRewind: index > 0,
    canForward: index >= 0 && index < forwardCap,
    label: snapshot?.label ?? null,
    key: snapshot?.key ?? null,
  };
}

export function resolveFallbackStageKey(
  steps: PipelineState['aioSteps'],
): AioPipelineSnapshotKey {
  if (steps.render) return 'render';
  if (steps.cleanImage) return 'cleanImage';
  if (steps.segmentText) return 'segmentText';
  if (steps.getTranslations) return 'getTranslations';
  if (steps.recognizeText) return 'recognizeText';
  return 'detectText';
}

export function resolveImageStageKey(
  imageId: string,
  pipeline: PipelineState,
  shell: Pick<ShellState, 'mode' | 'subMode'>,
): AioPipelineSnapshotKey {
  const index = resolveImageSnapshotIndex(imageId, pipeline, shell);

  if (isManualAioMode(shell) && index >= 0) {
    return (
      AIO_MANUAL_STAGE_ORDER[index] ??
      resolveFallbackStageKey(pipeline.aioSteps)
    );
  }

  return (
    resolveImageSnapshotMeta(imageId, pipeline, shell).key ??
    resolveFallbackStageKey(pipeline.aioSteps)
  );
}

export function isPipelineSnapshotKey(
  value: unknown,
): value is AioPipelineSnapshotKey {
  return (
    value === 'detectText' ||
    value === 'recognizeText' ||
    value === 'getTranslations' ||
    value === 'segmentText' ||
    value === 'cleanImage' ||
    value === 'render'
  );
}
