import { useCallback, useEffect, useMemo, useRef } from 'react';

import { useI18n } from '../../../i18n';
import {
  buildTypographyImageFingerprint,
  loadTypographySession,
  saveTypographySession,
} from '../../../typography/storage';
import type {
  TextQueueItem,
  TypographySession,
  TypographySessionSourceType,
  TypographyShapeKind,
  TypographerSnapshot,
} from '../../../typography/types';
import { cloneTypographyRegions, createTypographyId } from '../../../typography/types';
import type { AioTextRegion } from '../../../types/dashboard.types';
import { resolveRegionShapeKind } from '../../../utils/dashboard.utils';
import { EMPTY_SELECTED_REGION_IDS } from '../../../utils/dashboardRenderUtils';
import { useImageCollectionStore } from '../stores/image-collection-store';
import { useStatusStore } from '../stores/status-store';
import { useTypographerStore } from '../stores/typographer-store';
import { useRegionEditorStore } from '../stores/region-editor-store';
import {
  readActiveAioSelectedRegion,
  readActiveAioSelectedRegionId,
} from './region-editor.render';

interface WorkspaceImage {
  id: string;
  file: File;
  width: number;
  height: number;
}

interface UseTypographerWorkspaceOptions {
  images: WorkspaceImage[];
}

const getTypographerSessionsByImage = () =>
  useTypographerStore.getState().typographerSessionsByImage;
const setTypographerSessionsByImage = useTypographerStore.getState().setTypographerSessionsByImage;

const createEmptySession = (
  image: WorkspaceImage,
  sourceType: TypographySessionSourceType,
): TypographySession => ({
  imageId: image.id,
  imageFingerprint: buildTypographyImageFingerprint({
    name: image.file.name,
    size: image.file.size,
    lastModified: image.file.lastModified,
    width: image.width,
    height: image.height,
  }),
  sourceType,
  activePresetId: null,
  selectedRegionId: null,
  queue: [],
  draftText: "",
  multiBubbleEnabled: false,
  defaults: {
    padding: 10,
    defaultShapeKind: "rounded",
    autoDetectOnNewSelection: false,
  },
  snapshots: [],
  updatedAt: Date.now(),
});

const normalizeQueueText = (value: string): string[] =>
  value
    .replace(/\r\n/g, "\n")
    .split("\n")
    .map((item) => item.trim())
    .filter((item) => item.length > 0);

const TYPOGRAPHY_SESSION_SAVE_DEBOUNCE_MS = 400;

export const useTypographerWorkspace = ({
  images,
}: UseTypographerWorkspaceOptions) => {
  const latestSessionsByFingerprintRef = useRef<Record<string, TypographySession>>({});
  const persistedSessionUpdatedAtRef = useRef<Record<string, number>>({});
  const saveTimerByFingerprintRef = useRef<Record<string, number>>({});

  useEffect(() => {
    let cancelled = false;
    void (async () => {
      const sessionsByImage = getTypographerSessionsByImage();
      // Only load from IndexedDB for images that are new or have changed fingerprint
      const entriesToLoad: Array<{ image: typeof images[number]; emptySession: TypographySession }> = [];
      const cachedSessions: Record<string, TypographySession> = {};

      for (const image of images) {
        const emptySession = createEmptySession(image, "generic-upload");
        const existing = sessionsByImage[image.id];
        if (existing && existing.imageFingerprint === emptySession.imageFingerprint) {
          cachedSessions[image.id] = {
            ...existing,
            imageId: image.id,
            imageFingerprint: emptySession.imageFingerprint,
          };
        } else {
          entriesToLoad.push({ image, emptySession });
        }
      }

      // Only hit IndexedDB for new/changed images
      const loadedEntries = await Promise.all(entriesToLoad.map(async ({ image, emptySession }) => {
        const stored = await loadTypographySession(emptySession.imageFingerprint);
        return { image, emptySession, stored };
      }));

      if (cancelled) return;

      const nextSessions: Record<string, TypographySession> = { ...cachedSessions };
      const nextPersistedSessionUpdatedAt = {
        ...persistedSessionUpdatedAtRef.current,
      };
      loadedEntries.forEach(({ image, emptySession, stored }) => {
        const hydratedSession = stored
          ? {
            ...stored,
            imageId: image.id,
            imageFingerprint: emptySession.imageFingerprint,
            updatedAt: stored.updatedAt ?? Date.now(),
          }
          : emptySession;
        nextSessions[image.id] = hydratedSession;
        nextPersistedSessionUpdatedAt[hydratedSession.imageFingerprint] =
          hydratedSession.updatedAt;
      });
      const activeFingerprints = new Set(
        Object.values(nextSessions).map((session) => session.imageFingerprint),
      );
      Object.keys(nextPersistedSessionUpdatedAt).forEach((fingerprint) => {
        if (!activeFingerprints.has(fingerprint)) {
          delete nextPersistedSessionUpdatedAt[fingerprint];
        }
      });
      Object.keys(saveTimerByFingerprintRef.current).forEach((fingerprint) => {
        if (activeFingerprints.has(fingerprint)) return;
        window.clearTimeout(saveTimerByFingerprintRef.current[fingerprint]);
        delete saveTimerByFingerprintRef.current[fingerprint];
      });
      persistedSessionUpdatedAtRef.current = nextPersistedSessionUpdatedAt;
      setTypographerSessionsByImage(nextSessions);
    })();
    return () => {
      cancelled = true;
    };
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [images]);

  useEffect(() => {
    // Mirror latest sessions by fingerprint for the debounced saver + unmount
    // flush, driven by store.subscribe (no render-path subscription).
    latestSessionsByFingerprintRef.current = Object.fromEntries(
      Object.values(getTypographerSessionsByImage()).map((session) => [
        session.imageFingerprint,
        session,
      ]),
    );
    const unsubscribe = useTypographerStore.subscribe((state, prevState) => {
      if (state.typographerSessionsByImage === prevState.typographerSessionsByImage) {
        return;
      }
      latestSessionsByFingerprintRef.current = Object.fromEntries(
        Object.values(state.typographerSessionsByImage).map((session) => [
          session.imageFingerprint,
          session,
        ]),
      );
    });
    return unsubscribe;
  }, []);

  useEffect(() => {
    // Debounced persistence of session writes, driven by store.subscribe.
    const scheduleSaves = (sessionsByImage: Record<string, TypographySession>) => {
      Object.values(sessionsByImage).forEach((session) => {
        if (
          persistedSessionUpdatedAtRef.current[session.imageFingerprint] ===
          session.updatedAt
        ) {
          return;
        }

        const currentTimer =
          saveTimerByFingerprintRef.current[session.imageFingerprint];
        if (currentTimer !== undefined) {
          window.clearTimeout(currentTimer);
        }

        saveTimerByFingerprintRef.current[session.imageFingerprint] =
          window.setTimeout(() => {
            delete saveTimerByFingerprintRef.current[session.imageFingerprint];
            const latestSession =
              latestSessionsByFingerprintRef.current[session.imageFingerprint];
            if (!latestSession) return;
            if (
              persistedSessionUpdatedAtRef.current[latestSession.imageFingerprint] ===
              latestSession.updatedAt
            ) {
              return;
            }
            void saveTypographySession(latestSession).then(() => {
              const currentSession =
                latestSessionsByFingerprintRef.current[latestSession.imageFingerprint];
              if (
                currentSession &&
                currentSession.updatedAt === latestSession.updatedAt
              ) {
                persistedSessionUpdatedAtRef.current[latestSession.imageFingerprint] =
                  latestSession.updatedAt;
              }
            });
          }, TYPOGRAPHY_SESSION_SAVE_DEBOUNCE_MS);
      });
    };
    scheduleSaves(getTypographerSessionsByImage());
    const unsubscribe = useTypographerStore.subscribe((state, prevState) => {
      if (state.typographerSessionsByImage === prevState.typographerSessionsByImage) {
        return;
      }
      const activeFingerprints = new Set(
        Object.values(state.typographerSessionsByImage).map(
          (session) => session.imageFingerprint,
        ),
      );
      scheduleSaves(state.typographerSessionsByImage);
      Object.keys(saveTimerByFingerprintRef.current).forEach((fingerprint) => {
        if (activeFingerprints.has(fingerprint)) return;
        window.clearTimeout(saveTimerByFingerprintRef.current[fingerprint]);
        delete saveTimerByFingerprintRef.current[fingerprint];
      });
    });
    return unsubscribe;
  }, []);

  useEffect(() => () => {
    Object.values(saveTimerByFingerprintRef.current).forEach((timerId) => {
      window.clearTimeout(timerId);
    });
    Object.values(latestSessionsByFingerprintRef.current).forEach((session) => {
      if (
        persistedSessionUpdatedAtRef.current[session.imageFingerprint] ===
        session.updatedAt
      ) {
        return;
      }
      void saveTypographySession(session);
    });
  }, []);

  const updateSession = useCallback((imageId: string, updater: (session: TypographySession) => TypographySession) => {
    setTypographerSessionsByImage((prev) => {
      const current = prev[imageId];
      if (!current) return prev;
      const nextValue = updater(current);
      if (nextValue === current) {
        return prev;
      }
      return {
        ...prev,
        [imageId]: {
          ...nextValue,
          updatedAt: Date.now(),
        },
      };
    });
  }, []);

  const replaceSessionsByImage = useCallback((nextSessions: Record<string, TypographySession>) => {
    setTypographerSessionsByImage(nextSessions);
  }, []);

  const setSessionSourceType = useCallback((imageId: string, sourceType: TypographySessionSourceType) => {
    updateSession(imageId, (session) =>
      session.sourceType === sourceType ? session : { ...session, sourceType },
    );
  }, [updateSession]);

  const setDraftText = useCallback((imageId: string, draftText: string) => {
    updateSession(imageId, (session) =>
      session.draftText === draftText ? session : { ...session, draftText },
    );
  }, [updateSession]);

  const queueFromDraft = useCallback((imageId: string) => {
    updateSession(imageId, (session) => {
      const nextQueue: TextQueueItem[] = normalizeQueueText(session.draftText).map((text) => ({
        id: createTypographyId("queue"),
        text,
        status: "pending",
        appliedRegionId: null,
        createdAt: Date.now(),
      }));
      return {
        ...session,
        queue: nextQueue,
      };
    });
  }, [updateSession]);

  const importQueueText = useCallback((imageId: string, value: string) => {
    updateSession(imageId, (session) => ({
      ...session,
      draftText: value,
      queue: normalizeQueueText(value).map((text) => ({
        id: createTypographyId("queue"),
        text,
        status: "pending",
        appliedRegionId: null,
        createdAt: Date.now(),
      })),
    }));
  }, [updateSession]);

  const clearQueue = useCallback((imageId: string) => {
    updateSession(imageId, (session) =>
      session.queue.length === 0 && session.draftText.length === 0
        ? session
        : {
          ...session,
          queue: [],
          draftText: "",
        },
    );
  }, [updateSession]);

  const markQueueItem = useCallback((imageId: string, queueItemId: string, patch: Partial<TextQueueItem>) => {
    updateSession(imageId, (session) => {
      let changed = false;
      const nextQueue = session.queue.map((item) => {
        if (item.id !== queueItemId) return item;
        const nextItem = { ...item, ...patch };
        const itemChanged = Object.keys(patch).some((key) => {
          const typedKey = key as keyof TextQueueItem;
          return item[typedKey] !== nextItem[typedKey];
        });
        if (itemChanged) {
          changed = true;
          return nextItem;
        }
        return item;
      });

      return changed
        ? {
          ...session,
          queue: nextQueue,
        }
        : session;
    });
  }, [updateSession]);

  const toggleMultiBubble = useCallback((imageId: string) => {
    updateSession(imageId, (session) => ({
      ...session,
      multiBubbleEnabled: !session.multiBubbleEnabled,
    }));
  }, [updateSession]);

  const setActivePreset = useCallback((imageId: string, presetId: string | null) => {
    updateSession(imageId, (session) =>
      session.activePresetId === presetId
        ? session
        : { ...session, activePresetId: presetId },
    );
  }, [updateSession]);

  const setSelectedRegionId = useCallback((imageId: string, regionId: string | null) => {
    updateSession(imageId, (session) =>
      session.selectedRegionId === regionId
        ? session
        : { ...session, selectedRegionId: regionId },
    );
  }, [updateSession]);

  const saveSnapshot = useCallback((imageId: string, name: string) => {
    const sessionsByImage = getTypographerSessionsByImage();
    const session = sessionsByImage[imageId];
    if (!session) return;
    const snapshotName = name.trim();
    if (!snapshotName) return;
    const regions = cloneTypographyRegions(
      useRegionEditorStore.getState().aioDetectionsByImage[imageId] ?? [],
    );
    updateSession(imageId, (currentSession) => {
      const existing = currentSession.snapshots.find((item) => item.name === snapshotName) ?? null;
      const snapshot: TypographerSnapshot = {
        id: existing?.id ?? createTypographyId("snapshot"),
        name: snapshotName,
        createdAt: existing?.createdAt ?? Date.now(),
        updatedAt: Date.now(),
        selectedRegionId: currentSession.selectedRegionId,
        activePresetId: currentSession.activePresetId,
        queue: currentSession.queue.map((item) => ({ ...item })),
        draftText: currentSession.draftText,
        multiBubbleEnabled: currentSession.multiBubbleEnabled,
        defaults: { ...currentSession.defaults },
        regions,
      };
      const nextSnapshots = existing
        ? currentSession.snapshots.map((item) => item.id === existing.id ? snapshot : item)
        : [...currentSession.snapshots, snapshot];
      return {
        ...currentSession,
        snapshots: nextSnapshots.sort((left, right) => right.updatedAt - left.updatedAt),
      };
    });
  }, [updateSession]);

  const restoreSnapshot = useCallback((imageId: string, snapshotId: string): TypographerSnapshot | null => {
    const session = getTypographerSessionsByImage()[imageId];
    if (!session) return null;
    const snapshot = session.snapshots.find((item) => item.id === snapshotId) ?? null;
    if (!snapshot) return null;
    updateSession(imageId, (currentSession) => ({
      ...currentSession,
      activePresetId: snapshot.activePresetId,
      selectedRegionId: snapshot.selectedRegionId,
      queue: snapshot.queue.map((item) => ({ ...item })),
      draftText: snapshot.draftText,
      multiBubbleEnabled: snapshot.multiBubbleEnabled,
      defaults: { ...snapshot.defaults },
    }));
    return snapshot;
  }, [updateSession]);

  return useMemo(
    () => ({
      replaceSessionsByImage,
      updateSession,
      setSessionSourceType,
      setDraftText,
      queueFromDraft,
      importQueueText,
      clearQueue,
      markQueueItem,
      toggleMultiBubble,
      setActivePreset,
      setSelectedRegionId,
      saveSnapshot,
      restoreSnapshot,
    }),
    [
      replaceSessionsByImage,
      updateSession,
      setSessionSourceType,
      setDraftText,
      queueFromDraft,
      importQueueText,
      clearQueue,
      markQueueItem,
      toggleMultiBubble,
      setActivePreset,
      setSelectedRegionId,
      saveSnapshot,
      restoreSnapshot,
    ],
  );
};

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
  typographerWorkspace: TypographerWorkspaceLike;
  normalizeActiveTypographerShape: (options: {
    kind: TypographyShapeKind;
    centerText: boolean;
    source: 'refined';
    statusMessage: string;
  }) => void;
  updateActiveRenderRegion: (updater: (region: AioTextRegion) => AioTextRegion) => void;
  applyAioRegionsEditForImage: (imageId: string, nextRegions: AioTextRegion[], nextSelectedRegionId?: string | null) => void;
}

export function useTypographerControls({
  typographerWorkspace,
  normalizeActiveTypographerShape,
  updateActiveRenderRegion,
  applyAioRegionsEditForImage,
}: UseTypographerControlsArgs) {
  const { t } = useI18n();
  const typographerSnapshotName = useTypographerStore(
    (s) => s.typographerSnapshotName,
  );
  const typographerSelectedSnapshotId = useTypographerStore(
    (s) => s.typographerSelectedSnapshotId,
  );
  const setTypographerQueueSelectedId = useTypographerStore(
    (s) => s.setTypographerQueueSelectedId,
  );
  const setTypographerSnapshotName = useTypographerStore(
    (s) => s.setTypographerSnapshotName,
  );
  const setStatusMessage = useStatusStore((s) => s.setStatusMessage);

  const refineActiveTypographerShape = useCallback(async () => {
    const activeSelectedRegion = readActiveAioSelectedRegion(
      useImageCollectionStore.getState().activeId,
    );
    if (!activeSelectedRegion) return;
    const currentKind = resolveRegionShapeKind(activeSelectedRegion);
    normalizeActiveTypographerShape({
      kind: currentKind,
      centerText: true,
      source: 'refined',
      statusMessage: t('typographer.shapeApplied'),
    });
  }, [normalizeActiveTypographerShape, t]);

  const applyQueueTextToActiveRegion = useCallback((queueItem: TextQueueItem | null) => {
    const activeId = useImageCollectionStore.getState().activeId;
    const activeSelectedRegionId = readActiveAioSelectedRegionId(activeId);
    if (!activeId || !activeSelectedRegionId || !queueItem) return;
    const queue = useTypographerStore.getState().typographerSessionsByImage[activeId]?.queue ?? [];
    updateActiveRenderRegion((region) => ({
      ...region,
      renderText: queueItem.text,
      queueIndex: queue.findIndex((item) => item.id === queueItem.id),
    }));
    typographerWorkspace.markQueueItem(activeId, queueItem.id, {
      status: 'applied',
      appliedRegionId: activeSelectedRegionId,
    });
    setTypographerQueueSelectedId(queueItem.id);
    setStatusMessage(t('typographer.queueApplied'));
  }, [
    setStatusMessage,
    setTypographerQueueSelectedId,
    t,
    typographerWorkspace,
    updateActiveRenderRegion,
  ]);

  const applySelectedTypographerQueueItem = useCallback(() => {
    const activeId = useImageCollectionStore.getState().activeId;
    const queueSelectedId = useTypographerStore.getState().typographerQueueSelectedId;
    const queueItem =
      useTypographerStore
        .getState()
        .typographerSessionsByImage[activeId ?? '']?.queue.find(
          (item) => item.id === queueSelectedId,
        ) ?? null;
    applyQueueTextToActiveRegion(queueItem);
  }, [applyQueueTextToActiveRegion]);

  const applyMultiBubbleQueueToRegions = useCallback(() => {
    const activeId = useImageCollectionStore.getState().activeId;
    const session = activeId
      ? useTypographerStore.getState().typographerSessionsByImage[activeId]
      : null;
    const multiSelectedRegionIds = activeId
      ? (useTypographerStore.getState().typographerMultiSelectedByImage[activeId] ??
        EMPTY_SELECTED_REGION_IDS)
      : EMPTY_SELECTED_REGION_IDS;
    if (!activeId || !session) return;
    if (multiSelectedRegionIds.length === 0) return;
    const pendingItems = session.queue.filter(
      (item) => item.status === 'pending',
    );
    if (pendingItems.length === 0) return;
    const activeRegions = useRegionEditorStore.getState().aioDetectionsByImage[activeId] ?? [];
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
        queueIndex: session.queue.findIndex((q) => q.id === queueItem.id),
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
    applyAioRegionsEditForImage,
    setStatusMessage,
    t,
    typographerWorkspace,
  ]);

  const applyNextTypographerQueueItem = useCallback(() => {
    const activeId = useImageCollectionStore.getState().activeId;
    const session = activeId
      ? useTypographerStore.getState().typographerSessionsByImage[activeId]
      : null;
    const multiSelectedRegionIds = activeId
      ? (useTypographerStore.getState().typographerMultiSelectedByImage[activeId] ??
        EMPTY_SELECTED_REGION_IDS)
      : EMPTY_SELECTED_REGION_IDS;
    if (!activeId || !session) return;
    if (
      session.multiBubbleEnabled &&
      multiSelectedRegionIds.length > 0
    ) {
      applyMultiBubbleQueueToRegions();
      return;
    }
    const nextItem = session.queue.find((item) => item.status === 'pending') ?? null;
    applyQueueTextToActiveRegion(nextItem);
  }, [
    applyMultiBubbleQueueToRegions,
    applyQueueTextToActiveRegion,
  ]);

  const handleTypographerDraftChange = useCallback((value: string) => {
    const activeId = useImageCollectionStore.getState().activeId;
    if (!activeId) return;
    typographerWorkspace.setDraftText(activeId, value);
  }, [typographerWorkspace]);

  const handleTypographerBuildQueue = useCallback(() => {
    const activeId = useImageCollectionStore.getState().activeId;
    if (!activeId) return;
    typographerWorkspace.queueFromDraft(activeId);
    setTypographerQueueSelectedId(null);
    setStatusMessage('Fila de texto atualizada.');
  }, [setStatusMessage, setTypographerQueueSelectedId, typographerWorkspace]);

  const handleTypographerClearQueue = useCallback(() => {
    const activeId = useImageCollectionStore.getState().activeId;
    if (!activeId) return;
    typographerWorkspace.clearQueue(activeId);
    setTypographerQueueSelectedId(null);
    setStatusMessage(t('typographer.queueCleared'));
  }, [setStatusMessage, setTypographerQueueSelectedId, t, typographerWorkspace]);

  const handleTypographerImportQueueText = useCallback((value: string) => {
    const activeId = useImageCollectionStore.getState().activeId;
    if (!activeId) return;
    typographerWorkspace.importQueueText(activeId, value);
    setTypographerQueueSelectedId(null);
    setStatusMessage(t('typographer.queueImported'));
  }, [setStatusMessage, setTypographerQueueSelectedId, t, typographerWorkspace]);

  const handleTypographerToggleMultiBubble = useCallback(() => {
    const activeId = useImageCollectionStore.getState().activeId;
    if (!activeId) return;
    typographerWorkspace.toggleMultiBubble(activeId);
  }, [typographerWorkspace]);

  const handleTypographerPresetChange = useCallback((presetId: string | null) => {
    const activeId = useImageCollectionStore.getState().activeId;
    if (!activeId) return;
    typographerWorkspace.setActivePreset(activeId, presetId);
  }, [typographerWorkspace]);

  const handleTypographerSaveSnapshot = useCallback(() => {
    const activeId = useImageCollectionStore.getState().activeId;
    if (!activeId || !typographerSnapshotName.trim()) return;
    typographerWorkspace.saveSnapshot(activeId, typographerSnapshotName);
    setStatusMessage(`Snapshot "${typographerSnapshotName.trim()}" salvo.`);
    setTypographerSnapshotName('');
  }, [setStatusMessage, setTypographerSnapshotName, typographerSnapshotName, typographerWorkspace]);

  const handleTypographerRestoreSnapshot = useCallback(() => {
    const activeId = useImageCollectionStore.getState().activeId;
    if (!activeId || !typographerSelectedSnapshotId) return;
    const snapshot = typographerWorkspace.restoreSnapshot(activeId, typographerSelectedSnapshotId);
    if (!snapshot) return;
    applyAioRegionsEditForImage(activeId, snapshot.regions as AioTextRegion[], snapshot.selectedRegionId);
    setStatusMessage(`Snapshot "${snapshot.name}" restaurado.`);
  }, [applyAioRegionsEditForImage, setStatusMessage, typographerSelectedSnapshotId, typographerWorkspace]);

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
