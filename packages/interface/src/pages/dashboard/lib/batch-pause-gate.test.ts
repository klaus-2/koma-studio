import { act, waitFor } from '@testing-library/react';
import { beforeEach, describe, expect, it } from 'vitest';

import { createBatchPauseGate } from './batch-pause-gate';
import { runBatchPauseBoundary } from './batch-pause-boundary';
import {
  useAioBatchPauseStore,
} from '@/pages/dashboard/stores/aio-batch-pause-store';
import { useUiShellStore } from '@/pages/dashboard/stores/ui-shell-store';
import type { AioBatchImageResult } from '@/types/dashboard.types';

const resetStores = (): void => {
  useAioBatchPauseStore.getState().reset();
  useUiShellStore.setState({ processing: false });
};

const controllerWithSignal = (): AbortController => new AbortController();

const stubResult = (imageId: string): AioBatchImageResult => ({
  imageId,
  detectDetections: [],
  ocrDetections: [],
  translationDetections: [],
  segmentDetections: [],
  cleanDetections: [],
  renderDetections: [],
  cleanedDownload: null,
});

beforeEach(resetStores);

describe('batch-pause gate', () => {
  it('resolves immediately when idle', async () => {
    const gate = createBatchPauseGate(controllerWithSignal().signal);
    await expect(gate.waitAtBoundary()).resolves.toBeUndefined();
    expect(useAioBatchPauseStore.getState().pausePhase).toBe('idle');
  });

  it('transitions request -> draining -> paused and resumes', async () => {
    const controller = controllerWithSignal();
    const gate = createBatchPauseGate(controller.signal);
    act(() => {
      useUiShellStore.setState({ processing: true });
      useAioBatchPauseStore.getState().requestPause();
    });
    expect(useAioBatchPauseStore.getState().pausePhase).toBe('draining');

    const held = gate.waitAtBoundary();
    expect(useAioBatchPauseStore.getState().isPaused).toBe(true);
    expect(useAioBatchPauseStore.getState().pausePhase).toBe('paused');

    let resumed = false;
    void held.then(() => {
      resumed = true;
    });
    await waitFor(() => expect(resumed).toBe(false));

    act(() => {
      useAioBatchPauseStore.getState().resume();
    });
    await waitFor(() => expect(resumed).toBe(true));
    expect(useAioBatchPauseStore.getState().pausePhase).toBe('idle');
  });

  it('abort wins over pause: the hold resolves when the signal fires', async () => {
    const controller = controllerWithSignal();
    const gate = createBatchPauseGate(controller.signal);
    act(() => {
      useUiShellStore.setState({ processing: true });
      useAioBatchPauseStore.getState().requestPause();
    });

    const held = gate.waitAtBoundary();
    expect(useAioBatchPauseStore.getState().isPaused).toBe(true);

    let resolved = false;
    void held.then(() => {
      resolved = true;
    });

    act(() => {
      controller.abort();
    });
    await waitFor(() => expect(resolved).toBe(true));
  });
});

describe('runBatchPauseBoundary', () => {
  it('consolidates accumulated results and releases processing while paused', async () => {
    const controller = controllerWithSignal();
    const gate = createBatchPauseGate(controller.signal);
    const consolidated: Array<{ imageIds: string[]; skipImageIds: string[] }> =
      [];
    const accumulated = [
      stubResult('img-1'),
      stubResult('img-2'),
    ];

    act(() => {
      useUiShellStore.setState({ processing: true });
      useAioBatchPauseStore.getState().requestPause();
    });

    const boundary = runBatchPauseBoundary({
      gate,
      signal: controller.signal,
      getAccumulatedResults: () => accumulated,
      consolidate: (results, consolidateOptions) => {
        consolidated.push({
          imageIds: results.map((result) => result.imageId),
          skipImageIds: [...(consolidateOptions?.skipImageIds ?? [])],
        });
      },
    });

    await waitFor(() => {
      expect(consolidated).toEqual([
        { imageIds: ['img-1', 'img-2'], skipImageIds: [] },
      ]);
      expect(useAioBatchPauseStore.getState().pauseConsolidatedImageIds.has('img-1')).toBe(true);
      expect(useUiShellStore.getState().processing).toBe(false);
    });

    act(() => {
      useAioBatchPauseStore.getState().resume();
    });
    await boundary;

    expect(useUiShellStore.getState().processing).toBe(true);
  });

  it('does not re-acquire processing when the run aborted during the pause', async () => {
    const controller = controllerWithSignal();
    const gate = createBatchPauseGate(controller.signal);

    act(() => {
      useUiShellStore.setState({ processing: true });
      useAioBatchPauseStore.getState().requestPause();
    });

    const boundary = runBatchPauseBoundary({
      gate,
      signal: controller.signal,
      getAccumulatedResults: () => [],
      consolidate: () => undefined,
    });

    await waitFor(() => {
      expect(useUiShellStore.getState().processing).toBe(false);
    });

    act(() => {
      controller.abort();
    });
    await boundary;

    expect(useUiShellStore.getState().processing).toBe(false);
  });

  it('is a no-op when no pause was requested', async () => {
    const gate = createBatchPauseGate(controllerWithSignal().signal);
    let consolidated = 0;

    await runBatchPauseBoundary({
      gate,
      signal: controllerWithSignal().signal,
      getAccumulatedResults: () => [stubResult('img-1')],
      consolidate: () => {
        consolidated += 1;
      },
    });

    expect(consolidated).toBe(0);
    expect(useUiShellStore.getState().processing).toBe(false);
  });
});
