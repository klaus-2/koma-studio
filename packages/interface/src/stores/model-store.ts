import type { DiskSpaceInfo, ModelInstallState } from "../models/types";

export interface ModelStoreBatchState {
  modelIds: string[];
  cancelled: boolean;
}

export interface ModelStoreState {
  initialized: boolean;
  loading: boolean;
  checkingRemoteUpdates: boolean;
  lastRemoteCheckAt: number | null;
  entries: Record<string, ModelInstallState>;
  diskSpace: DiskSpaceInfo | null;
  installedSizeBytes: number;
  error: string | null;
  modalOpen: boolean;
  modalLanguageFilter: string;
  focusedModelId: string | null;
  batch: ModelStoreBatchState;
}

function createInitialState(): ModelStoreState {
  return {
    initialized: false,
    loading: false,
    checkingRemoteUpdates: false,
    lastRemoteCheckAt: null,
    entries: {},
    diskSpace: null,
    installedSizeBytes: 0,
    error: null,
    modalOpen: false,
    modalLanguageFilter: "all",
    focusedModelId: null,
    batch: {
      modelIds: [],
      cancelled: false,
    },
  };
}

type Listener = (state: ModelStoreState, prevState: ModelStoreState) => void;

const listeners = new Set<Listener>();
let state: ModelStoreState = createInitialState();

// Monotonic version of everything the status snapshot gates on (the fields
// useModelManager's status snapshot compares). Bumped inside setState with a
// cheap identity/value diff so progress-only patches — which replace an entry
// object per download tick — stay O(changed entries) instead of paying a
// JSON.stringify over the whole registry.
let statusVersion = 0;

const modelInstallStatusEqual = (
  left: ModelInstallState,
  right: ModelInstallState,
): boolean =>
  left.status === right.status &&
  left.error === right.error &&
  left.errorCode === right.errorCode;

const modelStoreEntriesStatusEqual = (
  left: ModelStoreState["entries"],
  right: ModelStoreState["entries"],
): boolean => {
  const leftKeys = Object.keys(left);
  const rightKeys = Object.keys(right);
  if (leftKeys.length !== rightKeys.length) return false;
  for (const key of leftKeys) {
    const leftEntry = left[key];
    const rightEntry = right[key];
    if (leftEntry === rightEntry) continue;
    if (!leftEntry || !rightEntry) return false;
    if (!modelInstallStatusEqual(leftEntry, rightEntry)) return false;
  }
  return true;
};

const modelStoreStatusEqual = (left: ModelStoreState, right: ModelStoreState): boolean =>
  left === right ||
  (left.initialized === right.initialized &&
    left.loading === right.loading &&
    left.checkingRemoteUpdates === right.checkingRemoteUpdates &&
    left.lastRemoteCheckAt === right.lastRemoteCheckAt &&
    left.diskSpace === right.diskSpace &&
    left.installedSizeBytes === right.installedSizeBytes &&
    left.error === right.error &&
    left.modalOpen === right.modalOpen &&
    left.modalLanguageFilter === right.modalLanguageFilter &&
    left.focusedModelId === right.focusedModelId &&
    left.batch === right.batch &&
    modelStoreEntriesStatusEqual(left.entries, right.entries));

const emit = (prevState: ModelStoreState): void => {
  listeners.forEach((listener) => {
    listener(state, prevState);
  });
};

export const modelStore = {
  getState: (): ModelStoreState => state,
  getStatusVersion: (): number => statusVersion,
  subscribe: (listener: Listener): (() => void) => {
    listeners.add(listener);
    return () => {
      listeners.delete(listener);
    };
  },
  setState: (updater: Partial<ModelStoreState> | ((prev: ModelStoreState) => ModelStoreState)): void => {
    const prevState = state;
    const nextState =
      typeof updater === "function"
        ? updater(state)
        : {
          ...state,
          ...updater,
        };
    if (nextState === prevState) return;
    state = nextState;
    if (!modelStoreStatusEqual(prevState, nextState)) {
      statusVersion += 1;
    }
    emit(prevState);
  },
  reset: (): void => {
    const prevState = state;
    state = createInitialState();
    statusVersion += 1;
    emit(prevState);
  },
};
