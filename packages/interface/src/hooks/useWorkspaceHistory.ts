import {
  useCallback,
  useEffect,
  useMemo,
  useRef,
  useState,
  type MutableRefObject,
} from "react";

interface UseWorkspaceHistoryArgs<T> {
  limit?: number;
  onRestore: (snapshot: T) => Promise<void> | void;
  disposeSnapshot?: (snapshot: T) => void;
}

export interface WorkspaceHistoryHandle<T> {
  canUndo: boolean;
  canRedo: boolean;
  setBaseline: (snapshot: T) => void;
  reset: (snapshot?: T | null) => void;
  commit: (snapshot: T) => void;
  queueCommit: (getSnapshot: () => T, delayMs?: number) => void;
  undo: () => Promise<boolean>;
  redo: () => Promise<boolean>;
  cancelPendingCommit: () => void;
  isRestoringRef: MutableRefObject<boolean>;
}

export function useWorkspaceHistory<T>({
  limit = 40,
  onRestore,
  disposeSnapshot,
}: UseWorkspaceHistoryArgs<T>): WorkspaceHistoryHandle<T> {
  const undoStackRef = useRef<T[]>([]);
  const redoStackRef = useRef<T[]>([]);
  const currentRef = useRef<T | null>(null);
  const pendingTimerRef = useRef<number | null>(null);
  const isRestoringRef = useRef(false);
  const [canUndo, setCanUndo] = useState(false);
  const [canRedo, setCanRedo] = useState(false);

  const syncAvailability = useCallback(() => {
    setCanUndo(undoStackRef.current.length > 0);
    setCanRedo(redoStackRef.current.length > 0);
  }, []);

  const disposeSnapshotSafe = useCallback(
    (snapshot: T | null | undefined) => {
      if (snapshot == null || !disposeSnapshot) return;
      disposeSnapshot(snapshot);
    },
    [disposeSnapshot],
  );

  const disposeSnapshotList = useCallback(
    (snapshots: T[]) => {
      snapshots.forEach((snapshot) => {
        disposeSnapshotSafe(snapshot);
      });
    },
    [disposeSnapshotSafe],
  );

  const cancelPendingCommit = useCallback(() => {
    if (pendingTimerRef.current !== null) {
      window.clearTimeout(pendingTimerRef.current);
      pendingTimerRef.current = null;
    }
  }, []);

  const setBaseline = useCallback((snapshot: T) => {
    cancelPendingCommit();
    disposeSnapshotSafe(currentRef.current);
    disposeSnapshotList(undoStackRef.current);
    disposeSnapshotList(redoStackRef.current);
    currentRef.current = snapshot;
    undoStackRef.current = [];
    redoStackRef.current = [];
    syncAvailability();
  }, [
    cancelPendingCommit,
    disposeSnapshotList,
    disposeSnapshotSafe,
    syncAvailability,
  ]);

  const reset = useCallback((snapshot?: T | null) => {
    cancelPendingCommit();
    disposeSnapshotSafe(currentRef.current);
    disposeSnapshotList(undoStackRef.current);
    disposeSnapshotList(redoStackRef.current);
    currentRef.current = snapshot ?? null;
    undoStackRef.current = [];
    redoStackRef.current = [];
    syncAvailability();
  }, [
    cancelPendingCommit,
    disposeSnapshotList,
    disposeSnapshotSafe,
    syncAvailability,
  ]);

  const commit = useCallback((snapshot: T) => {
    if (isRestoringRef.current) return;
    cancelPendingCommit();

    if (currentRef.current !== null) {
      undoStackRef.current.push(currentRef.current);
      if (undoStackRef.current.length > limit) {
        const discarded = undoStackRef.current.shift();
        disposeSnapshotSafe(discarded);
      }
    }

    disposeSnapshotList(redoStackRef.current);
    currentRef.current = snapshot;
    redoStackRef.current = [];
    syncAvailability();
  }, [
    cancelPendingCommit,
    disposeSnapshotList,
    disposeSnapshotSafe,
    limit,
    syncAvailability,
  ]);

  const queueCommit = useCallback((getSnapshot: () => T, delayMs = 300) => {
    if (isRestoringRef.current) return;
    cancelPendingCommit();
    pendingTimerRef.current = window.setTimeout(() => {
      pendingTimerRef.current = null;
      commit(getSnapshot());
    }, delayMs);
  }, [cancelPendingCommit, commit]);

  const restoreSnapshot = useCallback(async (snapshot: T) => {
    cancelPendingCommit();
    isRestoringRef.current = true;
    try {
      await onRestore(snapshot);
      currentRef.current = snapshot;
    } finally {
      isRestoringRef.current = false;
      syncAvailability();
    }
  }, [cancelPendingCommit, onRestore, syncAvailability]);

  const undo = useCallback(async (): Promise<boolean> => {
    if (undoStackRef.current.length === 0 || currentRef.current === null) {
      return false;
    }

    const previous = undoStackRef.current.pop() as T;
    redoStackRef.current.push(currentRef.current);
    await restoreSnapshot(previous);
    return true;
  }, [restoreSnapshot]);

  const redo = useCallback(async (): Promise<boolean> => {
    if (redoStackRef.current.length === 0 || currentRef.current === null) {
      return false;
    }

    const next = redoStackRef.current.pop() as T;
    undoStackRef.current.push(currentRef.current);
    await restoreSnapshot(next);
    return true;
  }, [restoreSnapshot]);

  useEffect(() => () => {
    cancelPendingCommit();
    disposeSnapshotSafe(currentRef.current);
    disposeSnapshotList(undoStackRef.current);
    disposeSnapshotList(redoStackRef.current);
  }, [cancelPendingCommit, disposeSnapshotList, disposeSnapshotSafe]);

  const handle = useMemo(
    () => ({
      canUndo,
      canRedo,
      setBaseline,
      reset,
      commit,
      queueCommit,
      undo,
      redo,
      cancelPendingCommit,
      isRestoringRef,
    }),
    [
      canUndo,
      canRedo,
      setBaseline,
      reset,
      commit,
      queueCommit,
      undo,
      redo,
      cancelPendingCommit,
    ],
  );
  return handle;
}
