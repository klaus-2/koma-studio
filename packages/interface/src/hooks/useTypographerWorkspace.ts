import { useCallback, useEffect, useMemo, useRef, useState } from "react";

import {
  buildTypographyImageFingerprint,
  loadTypographySession,
  saveTypographySession,
} from "../typography/storage";
import type {
  TextQueueItem,
  TypographyRegion,
  TypographySession,
  TypographySessionSourceType,
  TypographerSnapshot,
} from "../typography/types";
import { cloneTypographyRegions, createTypographyId } from "../typography/types";

interface WorkspaceImage {
  id: string;
  file: File;
  width: number;
  height: number;
}

interface UseTypographerWorkspaceOptions {
  images: WorkspaceImage[];
  activeImageId: string | null;
  regionsByImage: Record<string, TypographyRegion[]>;
}

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
  activeImageId,
  regionsByImage,
}: UseTypographerWorkspaceOptions) => {
  const [sessionsByImage, setSessionsByImage] = useState<Record<string, TypographySession>>({});
  const latestSessionsByFingerprintRef = useRef<Record<string, TypographySession>>({});
  const persistedSessionUpdatedAtRef = useRef<Record<string, number>>({});
  const saveTimerByFingerprintRef = useRef<Record<string, number>>({});

  useEffect(() => {
    let cancelled = false;
    void (async () => {
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

      setSessionsByImage(() => {
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
        return nextSessions;
      });
    })();
    return () => {
      cancelled = true;
    };
  // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [images]);

  useEffect(() => {
    latestSessionsByFingerprintRef.current = Object.fromEntries(
      Object.values(sessionsByImage).map((session) => [
        session.imageFingerprint,
        session,
      ]),
    );
  }, [sessionsByImage]);

  useEffect(() => {
    const activeFingerprints = new Set<string>();
    Object.values(sessionsByImage).forEach((session) => {
      activeFingerprints.add(session.imageFingerprint);
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

    Object.keys(saveTimerByFingerprintRef.current).forEach((fingerprint) => {
      if (activeFingerprints.has(fingerprint)) return;
      window.clearTimeout(saveTimerByFingerprintRef.current[fingerprint]);
      delete saveTimerByFingerprintRef.current[fingerprint];
    });
  }, [sessionsByImage]);

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

  const activeSession = useMemo(
    () => (activeImageId ? sessionsByImage[activeImageId] ?? null : null),
    [activeImageId, sessionsByImage],
  );

  const updateSession = useCallback((imageId: string, updater: (session: TypographySession) => TypographySession) => {
    setSessionsByImage((prev) => {
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
    setSessionsByImage(nextSessions);
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
    const session = sessionsByImage[imageId];
    if (!session) return;
    const snapshotName = name.trim();
    if (!snapshotName) return;
    const regions = cloneTypographyRegions(regionsByImage[imageId] ?? []);
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
  }, [regionsByImage, sessionsByImage, updateSession]);

  const restoreSnapshot = useCallback((imageId: string, snapshotId: string): TypographerSnapshot | null => {
    const session = sessionsByImage[imageId];
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
  }, [sessionsByImage, updateSession]);

  return {
    sessionsByImage,
    activeSession,
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
  };
};
