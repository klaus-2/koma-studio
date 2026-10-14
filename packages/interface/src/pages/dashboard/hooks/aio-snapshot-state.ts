import { useCallback } from 'react';
import { useShallow } from 'zustand/react/shallow';

import { useI18n } from '@/i18n';
import {
  applyAioPipelineSnapshotToImage,
  patchAioSnapshotStageForImage as patchSnapshotStage,
  refreshActiveSnapshotImage,
  syncManualStagePreviewToNextStage,
} from '@/pages/dashboard/hooks/aio-snapshot.commands';
import { useAioSnapshotNavigation } from '@/pages/dashboard/hooks/aio-snapshot.navigation';
import type { SnapshotLabels } from '@/pages/dashboard/hooks/aio-snapshot.normalization';
import {
  isManualAioMode,
  isPipelineSnapshotKey,
  resolveFallbackStageKey,
  resolveImageSnapshotIndex,
  resolveImageSnapshotMeta,
  resolveImageStageKey,
} from '@/pages/dashboard/hooks/aio-snapshot.queries';
import type { AioImageSnapshotMeta } from '@/pages/dashboard/hooks/aio-snapshot.queries';
import { useAioPipelineStore } from '@/pages/dashboard/stores/aio-pipeline-store';
import { useUiShellStore } from '@/pages/dashboard/stores/ui-shell-store';
import type {
  AioDownloadEntry,
  AioManualStageStatus,
  AioPipelineSnapshotKey,
  AioTextRegion,
} from '@/types/dashboard.types';
import { capitalizeStageLabel } from '@/utils/dashboardRenderUtils';

interface UseAioPipelineSnapshotStateArgs {
  readonly resolvedActiveId: string | null;
  readonly aioPipelineStageLabels: SnapshotLabels;
  readonly aioPipelineStageProgressLabels: SnapshotLabels;
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

export function useAioPipelineSnapshotState({
  resolvedActiveId,
  aioPipelineStageLabels,
  aioPipelineStageProgressLabels,
}: UseAioPipelineSnapshotStateArgs) {
  const { t } = useI18n();
  const mode = useUiShellStore((state) => state.mode);
  const subMode = useUiShellStore((state) => state.subMode);
  const processing = useUiShellStore((state) => state.processing);
  const progress = useUiShellStore((state) => state.progress);
  const executionStatus = useAioPipelineStore(
    (state) => state.aioExecutionStatus,
  );

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
  const patchAioSnapshotStageForImage = useCallback(
    (
      imageId: string,
      stageIndex: number,
      nextRegions: AioTextRegion[],
      downloadEntry?: AioDownloadEntry | null,
    ): void => {
      patchSnapshotStage(imageId, stageIndex, nextRegions, downloadEntry);

      if (getAioImageSnapshotIndex(imageId) === stageIndex) {
        refreshActiveSnapshotImage(imageId, stageIndex);
      }
    },
    [],
  );

  const activeManualStageStatus: AioManualStageStatus | null =
    active.manualProgress?.statusByStage[active.stageKey] ?? null;

  const aioFooterProcessingLabel =
    mode === 'aio' && processing && executionStatus
      ? `${executionStatus.scope === 'manual'
        ? t('dashboard.status.aioScopeManual')
        : t('dashboard.status.aioScopeAuto')
      }: ${executionStatus.label}`
      : null;

  const percentage = Number.isFinite(progress)
    ? Math.round(Math.min(100, Math.max(0, progress)))
    : 0;

  const processingStageKey =
    mode === 'aio' &&
      processing &&
      isPipelineSnapshotKey(executionStatus?.stageKey)
      ? executionStatus.stageKey
      : active.stageKey;

  const aioExecuteButtonProcessingLabel = `${capitalizeStageLabel(
    aioPipelineStageProgressLabels[processingStageKey],
  )} ${percentage}%`;

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
    aioFooterProcessingLabel,
    aioExecuteButtonProcessingLabel,
    activeImageRenderStageActive,
  };
}
