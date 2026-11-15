// @vitest-environment jsdom
import '@testing-library/jest-dom/vitest';

import { beforeEach, describe, expect, it } from 'vitest';

import { useAioPipelineStore } from './aio-pipeline-store';
import { useAioBatchPauseStore } from './aio-batch-pause-store';
import { useUiShellStore } from './ui-shell-store';

const begin = (): void => {
  useAioPipelineStore
    .getState()
    .beginAioExecution('auto', 2, ['detectText'], 'auto');
};

const beginAndRetain = (): AbortController => {
  begin();
  const controller = useAioPipelineStore.getState().aioAbortController;
  if (!controller) {
    throw new Error('controller missing after begin');
  }
  return controller;
};

describe('aio-pipeline-execution pause lifecycle (Fase D F1)', () => {
  beforeEach(() => {
    useAioPipelineStore.setState({
      aioAbortController: null,
      aioExecutionStatus: null,
      aioBackendRestarting: false,
    });
    useAioBatchPauseStore.getState().reset();
    useUiShellStore.setState({ processing: false });
  });

  it('refuses a second begin while a pause hold retains the controller', () => {
    const controller = beginAndRetain();

    useUiShellStore.setState({ processing: true });
    useAioBatchPauseStore.getState().requestPause();
    useAioBatchPauseStore.getState().markPaused();
    useUiShellStore.setState({ processing: false });
    expect(useAioBatchPauseStore.getState().isPaused).toBe(true);
    expect(useAioPipelineStore.getState().aioAbortController).toBe(controller);
    expect(controller.signal.aborted).toBe(false);

    expect(() => begin()).toThrow(/already active/);
  });

  it('a no-arg clear aborts a live retained controller (the Dashboard hazard)', () => {
    const controller = beginAndRetain();

    useAioPipelineStore.getState().clearAioExecutionState();
    expect(controller.signal.aborted).toBe(true);
    expect(useAioPipelineStore.getState().aioAbortController).toBeNull();
  });

  it('resume keeps the controller; the matching clear releases it cleanly', () => {
    const controller = beginAndRetain();
    useUiShellStore.setState({ processing: true });
    useAioBatchPauseStore.getState().requestPause();
    useAioBatchPauseStore.getState().markPaused();
    useAioBatchPauseStore.getState().resume();
    expect(useAioPipelineStore.getState().aioAbortController).toBe(controller);
    expect(controller.signal.aborted).toBe(false);

    useAioPipelineStore.getState().clearAioExecutionState(controller);
    expect(useAioPipelineStore.getState().aioAbortController).toBeNull();
  });
});
