import { useCallback } from 'react';

import { useI18n } from '../i18n';
import type { AioTextRegion } from '../types/dashboard.types';
import type { TextQueueItem, TypographySession, TypographyShapeKind } from '../typography/types';
import { resolveRegionShapeKind } from '../utils/dashboard.utils';

interface TypographerWorkspaceLike {
  markQueueItem: (imageId: string, queueItemId: string, patch: Partial<TextQueueItem>) => void;
  setDraftText: (imageId: string, draftText: string) => void;
  queueFromDraft: (imageId: string) => void;
  clearQueue: (imageId: string) => void;
  importQueueText: (imageId: string, value: string) => void;
  toggleMultiBubble: (imageId: string) => void;
  setActivePreset: (imageId: string, presetId: string | null) => void;
  saveSnapshot: (imageId: string, name: string) => void;
  restoreSnapshot: (imageId: string, snapshotId: string) => {
    name: string;
    regions: AioTextRegion[];
    selectedRegionId: string | null;
  } | null;
}

interface UseTypographerControlsArgs {
  activeId: string | null;
  activeSelectedRegion: AioTextRegion | null;
  activeSelectedRegionId: string | null;
  activeTypographerSession: TypographySession | null;
  activeTypographerQueueItem: TextQueueItem | null;
  typographerSnapshotName: string;
  typographerSelectedSnapshotId: string | null;
  typographerWorkspace: TypographerWorkspaceLike;
  setTypographerQueueSelectedId: (value: string | null) => void;
  setTypographerSnapshotName: (value: string) => void;
  setStatusMessage: (value: string) => void;
  normalizeActiveTypographerShape: (options: {
    kind: TypographyShapeKind;
    centerText: boolean;
    source: 'refined';
    statusMessage: string;
  }) => void;
  updateActiveRenderRegion: (updater: (region: AioTextRegion) => AioTextRegion) => void;
  applyAioRegionsEditForImage: (imageId: string, nextRegions: AioTextRegion[], nextSelectedRegionId?: string | null) => void;
  multiSelectedRegionIds: string[];
  activeRegions: AioTextRegion[];
}

export function useTypographerControls({
  activeId,
  activeSelectedRegion,
  activeSelectedRegionId,
  activeTypographerSession,
  activeTypographerQueueItem,
  typographerSnapshotName,
  typographerSelectedSnapshotId,
  typographerWorkspace,
  setTypographerQueueSelectedId,
  setTypographerSnapshotName,
  setStatusMessage,
  normalizeActiveTypographerShape,
  updateActiveRenderRegion,
  applyAioRegionsEditForImage,
  multiSelectedRegionIds,
  activeRegions,
}: UseTypographerControlsArgs) {
  const { t } = useI18n();

  const refineActiveTypographerShape = useCallback(async () => {
    if (!activeSelectedRegion) return;
    const currentKind = resolveRegionShapeKind(activeSelectedRegion);
    normalizeActiveTypographerShape({
      kind: currentKind,
      centerText: true,
      source: 'refined',
      statusMessage: t('typographer.shapeApplied'),
    });
  }, [activeSelectedRegion, normalizeActiveTypographerShape, t]);

  const applyQueueTextToActiveRegion = useCallback((queueItem: TextQueueItem | null) => {
    if (!activeId || !activeSelectedRegionId || !queueItem) return;
    updateActiveRenderRegion((region) => ({
      ...region,
      renderText: queueItem.text,
      queueIndex: activeTypographerSession?.queue.findIndex((item) => item.id === queueItem.id) ?? null,
    }));
    typographerWorkspace.markQueueItem(activeId, queueItem.id, {
      status: 'applied',
      appliedRegionId: activeSelectedRegionId,
    });
    setTypographerQueueSelectedId(queueItem.id);
    setStatusMessage(t('typographer.queueApplied'));
  }, [
    activeId,
    activeSelectedRegionId,
    activeTypographerSession?.queue,
    setStatusMessage,
    setTypographerQueueSelectedId,
    t,
    typographerWorkspace,
    updateActiveRenderRegion,
  ]);

  const applySelectedTypographerQueueItem = useCallback(() => {
    applyQueueTextToActiveRegion(activeTypographerQueueItem);
  }, [activeTypographerQueueItem, applyQueueTextToActiveRegion]);

  const applyMultiBubbleQueueToRegions = useCallback(() => {
    if (!activeId || !activeTypographerSession) return;
    if (multiSelectedRegionIds.length === 0) return;
    const pendingItems = activeTypographerSession.queue.filter(
      (item) => item.status === 'pending',
    );
    if (pendingItems.length === 0) return;
    const regionMap = new Map(activeRegions.map((r) => [r.id, r]));
    const nextRegions = [...activeRegions];
    let appliedCount = 0;
    for (let i = 0; i < multiSelectedRegionIds.length && i < pendingItems.length; i++) {
      const regionId = multiSelectedRegionIds[i];
      const queueItem = pendingItems[i];
      if (!regionId || !queueItem) continue;
      const regionIdx = nextRegions.findIndex((r) => r.id === regionId);
      const currentRegion = nextRegions[regionIdx];
      if (regionIdx < 0 || !currentRegion || !regionMap.has(regionId)) continue;
      nextRegions[regionIdx] = {
        ...currentRegion,
        renderText: queueItem.text,
        queueIndex: activeTypographerSession.queue.findIndex((q) => q.id === queueItem.id),
      };
      typographerWorkspace.markQueueItem(activeId, queueItem.id, {
        status: 'applied',
        appliedRegionId: regionId,
      });
      appliedCount++;
    }
    if (appliedCount > 0) {
      applyAioRegionsEditForImage(activeId, nextRegions);
      setStatusMessage(t('typographer.queueAppliedMulti', { count: appliedCount }));
    }
  }, [
    activeId,
    activeRegions,
    activeTypographerSession,
    applyAioRegionsEditForImage,
    multiSelectedRegionIds,
    setStatusMessage,
    t,
    typographerWorkspace,
  ]);

  const applyNextTypographerQueueItem = useCallback(() => {
    if (!activeId || !activeTypographerSession) return;
    if (
      activeTypographerSession.multiBubbleEnabled &&
      multiSelectedRegionIds.length > 0
    ) {
      applyMultiBubbleQueueToRegions();
      return;
    }
    const nextItem = activeTypographerSession.queue.find((item) => item.status === 'pending') ?? null;
    applyQueueTextToActiveRegion(nextItem);
  }, [
    activeId,
    activeTypographerSession,
    applyMultiBubbleQueueToRegions,
    applyQueueTextToActiveRegion,
    multiSelectedRegionIds.length,
  ]);

  const handleTypographerDraftChange = useCallback((value: string) => {
    if (!activeId) return;
    typographerWorkspace.setDraftText(activeId, value);
  }, [activeId, typographerWorkspace]);

  const handleTypographerBuildQueue = useCallback(() => {
    if (!activeId) return;
    typographerWorkspace.queueFromDraft(activeId);
    setTypographerQueueSelectedId(null);
    setStatusMessage('Fila de texto atualizada.');
  }, [activeId, setStatusMessage, setTypographerQueueSelectedId, typographerWorkspace]);

  const handleTypographerClearQueue = useCallback(() => {
    if (!activeId) return;
    typographerWorkspace.clearQueue(activeId);
    setTypographerQueueSelectedId(null);
    setStatusMessage(t('typographer.queueCleared'));
  }, [activeId, setStatusMessage, setTypographerQueueSelectedId, t, typographerWorkspace]);

  const handleTypographerImportQueueText = useCallback((value: string) => {
    if (!activeId) return;
    typographerWorkspace.importQueueText(activeId, value);
    setTypographerQueueSelectedId(null);
    setStatusMessage(t('typographer.queueImported'));
  }, [activeId, setStatusMessage, setTypographerQueueSelectedId, t, typographerWorkspace]);

  const handleTypographerToggleMultiBubble = useCallback(() => {
    if (!activeId) return;
    typographerWorkspace.toggleMultiBubble(activeId);
  }, [activeId, typographerWorkspace]);

  const handleTypographerPresetChange = useCallback((presetId: string | null) => {
    if (!activeId) return;
    typographerWorkspace.setActivePreset(activeId, presetId);
  }, [activeId, typographerWorkspace]);

  const handleTypographerSaveSnapshot = useCallback(() => {
    if (!activeId || !typographerSnapshotName.trim()) return;
    typographerWorkspace.saveSnapshot(activeId, typographerSnapshotName);
    setStatusMessage(`Snapshot "${typographerSnapshotName.trim()}" salvo.`);
    setTypographerSnapshotName('');
  }, [activeId, setStatusMessage, setTypographerSnapshotName, typographerSnapshotName, typographerWorkspace]);

  const handleTypographerRestoreSnapshot = useCallback(() => {
    if (!activeId || !typographerSelectedSnapshotId) return;
    const snapshot = typographerWorkspace.restoreSnapshot(activeId, typographerSelectedSnapshotId);
    if (!snapshot) return;
    applyAioRegionsEditForImage(activeId, snapshot.regions as AioTextRegion[], snapshot.selectedRegionId);
    setStatusMessage(`Snapshot "${snapshot.name}" restaurado.`);
  }, [activeId, applyAioRegionsEditForImage, setStatusMessage, typographerSelectedSnapshotId, typographerWorkspace]);

  return {
    refineActiveTypographerShape,
    applySelectedTypographerQueueItem,
    applyNextTypographerQueueItem,
    handleTypographerDraftChange,
    handleTypographerBuildQueue,
    handleTypographerClearQueue,
    handleTypographerImportQueueText,
    handleTypographerToggleMultiBubble,
    handleTypographerPresetChange,
    handleTypographerSaveSnapshot,
    handleTypographerRestoreSnapshot,
  };
}
