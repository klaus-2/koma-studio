import type { DiskSpaceInfo, ModelInstallState } from "../models/types";

export interface ModelStoreBatchState {
  active: boolean;
  total: number;
  completed: number;
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
      active: false,
      total: 0,
      completed: 0,
      cancelled: false,
    },
  };
}

type Listener = (state: ModelStoreState, prevState: ModelStoreState) => void;

const listeners = new Set<Listener>();
let state: ModelStoreState = createInitialState();

const emit = (prevState: ModelStoreState): void => {
  listeners.forEach((listener) => {
    listener(state, prevState);
  });
};

export const modelStore = {
  getState: (): ModelStoreState => state,
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
    emit(prevState);
  },
  reset: (): void => {
    const prevState = state;
    state = createInitialState();
    emit(prevState);
  },
};
