import { useShallow } from 'zustand/react/shallow';

import {
  applyAioPipelineSnapshotToImage,
  patchAioSnapshotStageForImage,
  syncManualStagePreviewToNextStage,
} from '@/pages/dashboard/hooks/aio-snapshot.commands';
import { useAioSnapshotNavigation } from '@/pages/dashboard/hooks/aio-snapshot.navigation';
import type { SnapshotLabels } from '@/pages/dashboard/hooks/aio-snapshot.normalization';
import {
  isManualAioMode,
  resolveFallbackStageKey,
  resolveImageSnapshotIndex,
  resolveImageSnapshotMeta,
  resolveImageStageKey,
} from '@/pages/dashboard/hooks/aio-snapshot.queries';
import type { AioImageSnapshotMeta } from '@/pages/dashboard/hooks/aio-snapshot.queries';
import { useAioPipelineStore } from '@/pages/dashboard/stores/aio-pipeline-store';
import { useUiShellStore } from '@/pages/dashboard/stores/ui-shell-store';
import type {
  AioManualStageStatus,
  AioPipelineSnapshotKey,
  ToolMode,
} from '@/types/dashboard.types';
import type { AioExecutionStatus } from '@/utils/dashboardRenderUtils';

interface UseAioPipelineSnapshotStateArgs {
  readonly resolvedActiveId: string | null;
  readonly aioPipelineStageLabels: SnapshotLabels;
}

function getAioImageSnapshotIndex(imageId: string): number {
  return resolveImageSnapshotIndex(
    imageId,
    useAioPipelineStore.getState(),
    useUiShellStore.getState(),
  );
}

function getAioImageSnapshotMeta(imageId: string): AioImageSnapshotMeta {
  return resolveImageSnapshotMeta(
    imageId,
    useAioPipelineStore.getState(),
    useUiShellStore.getState(),
  );
}

function getAioFallbackStageKey(): AioPipelineSnapshotKey {
  return resolveFallbackStageKey(useAioPipelineStore.getState().aioSteps);
}

function resolveAioStageKeyForImage(
  imageId: string,
): AioPipelineSnapshotKey {
  return resolveImageStageKey(
    imageId,
    useAioPipelineStore.getState(),
    useUiShellStore.getState(),
  );
}

interface DeriveAioFooterProcessingLabelArgs {
  readonly mode: ToolMode;
  readonly processing: boolean;
  readonly executionStatus: AioExecutionStatus | null;
  readonly manualScopeLabel: string;
  readonly autoScopeLabel: string;
}

export function deriveAioFooterProcessingLabel({
  mode,
  processing,
  executionStatus,
  manualScopeLabel,
  autoScopeLabel,
}: DeriveAioFooterProcessingLabelArgs): string | null {
  if (mode !== 'aio' || !processing || !executionStatus) return null;
  const scopeLabel =
    executionStatus.scope === 'manual' ? manualScopeLabel : autoScopeLabel;
  return `${scopeLabel}: ${executionStatus.label}`;
}

export function useAioPipelineSnapshotState({
  resolvedActiveId,
  aioPipelineStageLabels,
}: UseAioPipelineSnapshotStateArgs) {
  const mode = useUiShellStore((state) => state.mode);
  const subMode = useUiShellStore((state) => state.subMode);

  const active = useAioPipelineStore(
    useShallow((state) => {
      const shell = { mode, subMode };
      const meta = resolvedActiveId
        ? resolveImageSnapshotMeta(resolvedActiveId, state, shell)
        : null;

      return {
        manualProgress: resolvedActiveId
          ? (state.aioManualProgressByImage[resolvedActiveId] ?? null)
          : null,
        stageKey: resolvedActiveId
          ? resolveImageStageKey(resolvedActiveId, state, shell)
          : resolveFallbackStageKey(state.aioSteps),
        snapshotIndex: meta?.index ?? -1,
        snapshotKey: meta?.key ?? null,
        renderEnabled: state.aioSteps.render,
      };
    }),
  );

  const navigation = useAioSnapshotNavigation(
    aioPipelineStageLabels,
    resolvedActiveId,
  );
  const activeManualStageStatus: AioManualStageStatus | null =
    active.manualProgress?.statusByStage[active.stageKey] ?? null;

  const activeImageRenderStageActive =
    mode !== 'aio' ||
    (isManualAioMode({ mode, subMode })
      ? active.stageKey === 'render'
      : !active.renderEnabled ||
      active.snapshotIndex < 0 ||
      active.snapshotKey === 'render' ||
      active.snapshotKey === null);

  return {
    ...navigation,
    getAioImageSnapshotIndex,
    getAioImageSnapshotMeta,
    getAioFallbackStageKey,
    resolveAioStageKeyForImage,
    applyAioPipelineSnapshotToImage,
    patchAioSnapshotStageForImage,
    syncManualStagePreviewToNextStage,
    activeAioStageKey: active.stageKey,
    activeManualProgress: active.manualProgress,
    activeManualStageStatus,
    activeImageRenderStageActive,
  };
}
