import { beforeEach, describe, expect, it } from 'vitest';

import { useAioBatchPauseStore } from './aio-batch-pause-store';
import { useUiShellStore } from '../stores/ui-shell-store';

beforeEach(() => {
  useAioBatchPauseStore.getState().reset();
  useUiShellStore.setState({ processing: false });
});

describe('aio-batch-pause-store', () => {
  it('requestPause only registers while a run is active', () => {
    useAioBatchPauseStore.getState().requestPause();
    expect(useAioBatchPauseStore.getState().pauseRequested).toBe(false);

    useUiShellStore.setState({ processing: true });
    useAioBatchPauseStore.getState().requestPause();
    const state = useAioBatchPauseStore.getState();
    expect(state.pauseRequested).toBe(true);
    expect(state.pausePhase).toBe('draining');
    expect(state.isPaused).toBe(false);
  });

  it('markPaused flips draining to paused only once requested', () => {
    useAioBatchPauseStore.getState().markPaused();
    expect(useAioBatchPauseStore.getState().isPaused).toBe(false);

    useUiShellStore.setState({ processing: true });
    useAioBatchPauseStore.getState().requestPause();
    useAioBatchPauseStore.getState().markPaused();
    const state = useAioBatchPauseStore.getState();
    expect(state.isPaused).toBe(true);
    expect(state.pausePhase).toBe('paused');
  });

  it('resume clears the request and the paused state', () => {
    useUiShellStore.setState({ processing: true });
    const store = useAioBatchPauseStore.getState();
    store.requestPause();
    store.markPaused();
    store.recordPauseConsolidatedImageIds(['img-1', 'img-2']);

    useAioBatchPauseStore.getState().resume();
    const state = useAioBatchPauseStore.getState();
    expect(state.pauseRequested).toBe(false);
    expect(state.isPaused).toBe(false);
    expect(state.pausePhase).toBe('idle');
    expect(state.pauseConsolidatedImageIds.has('img-1')).toBe(true);
  });

  it('reset clears everything including the consolidated skip set', () => {
    useUiShellStore.setState({ processing: true });
    const store = useAioBatchPauseStore.getState();
    store.requestPause();
    store.markPaused();
    store.recordPauseConsolidatedImageIds(['img-1']);

    useAioBatchPauseStore.getState().reset();

    const state = useAioBatchPauseStore.getState();
    expect(state.pauseRequested).toBe(false);
    expect(state.isPaused).toBe(false);
    expect(state.pauseConsolidatedImageIds.size).toBe(0);
  });

  it('a second requestPause during draining does not reset the phase', () => {
    useUiShellStore.setState({ processing: true });
    const store = useAioBatchPauseStore.getState();
    store.requestPause();
    store.markPaused();
    store.requestPause();
    expect(useAioBatchPauseStore.getState().pausePhase).toBe('paused');
  });
});
