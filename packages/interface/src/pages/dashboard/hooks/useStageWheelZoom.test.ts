import { act, renderHook } from '@testing-library/react';
import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest';

import { useStageWheelZoom } from './useStageWheelZoom';

type FrameCallback = (time: number) => void;

describe('useStageWheelZoom', () => {
  let frameCallbacks: FrameCallback[];
  let nextFrameId: number;

  beforeEach(() => {
    frameCallbacks = [];
    nextFrameId = 1;
    vi.stubGlobal('requestAnimationFrame', (callback: FrameCallback) => {
      frameCallbacks.push(callback);
      return nextFrameId++;
    });
    vi.stubGlobal('cancelAnimationFrame', () => undefined);
  });

  afterEach(() => {
    vi.unstubAllGlobals();
  });

  const flushFrame = (): void => {
    const callback = frameCallbacks.shift();
    if (!callback) throw new Error('no scheduled frame');
    callback(0);
  };

  it('applies every event in a burst as its own step', () => {
    const setZoom = vi.fn<(updater: (previous: number) => number) => void>();
    const { result } = renderHook(() => useStageWheelZoom(setZoom));
    const preventDefault = vi.fn();

    act(() => {
      for (let index = 0; index < 5; index += 1) {
        result.current({ ctrlKey: true, deltaY: -1, preventDefault });
      }
    });

    expect(preventDefault).toHaveBeenCalledTimes(5);
    expect(setZoom).not.toHaveBeenCalled();
    act(flushFrame);
    expect(setZoom).toHaveBeenCalledTimes(1);

    const updater = setZoom.mock.calls[0]?.[0];
    expect(updater).toBeDefined();
    expect(updater?.(1)).toBeCloseTo(1.5);
  });

  it('ignores wheel events without Ctrl', () => {
    const setZoom = vi.fn<(updater: (previous: number) => number) => void>();
    const { result } = renderHook(() => useStageWheelZoom(setZoom));

    act(() => {
      result.current({
        ctrlKey: false,
        deltaY: -120,
        preventDefault: vi.fn(),
      });
    });

    expect(frameCallbacks).toHaveLength(0);
    expect(setZoom).not.toHaveBeenCalled();
  });

  it('flushes pending steps when unmounted', () => {
    const setZoom = vi.fn<(updater: (previous: number) => number) => void>();
    const { result, unmount } = renderHook(() => useStageWheelZoom(setZoom));

    act(() => {
      result.current({
        ctrlKey: true,
        deltaY: -120,
        preventDefault: vi.fn(),
      });
    });
    unmount();

    expect(setZoom).toHaveBeenCalledTimes(1);
    const updater = setZoom.mock.calls[0]?.[0];
    expect(updater?.(1)).toBeCloseTo(1.1);
  });
});
