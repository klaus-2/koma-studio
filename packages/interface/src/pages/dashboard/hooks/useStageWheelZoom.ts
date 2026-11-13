import { useCallback, useEffect, useRef } from 'react';

import {
  ZOOM_MAX,
  ZOOM_MIN,
  ZOOM_STEP,
} from '../../../constants/dashboard.constants';
import { clamp } from '../../../utils/dashboard.utils';

export interface StageWheelZoomEvent {
  ctrlKey: boolean;
  deltaY: number;
  preventDefault: () => void;
}

type SetZoom = (updater: (previous: number) => number) => void;

/**
 * One wheel event => signed zoom steps (the step formula has a floor of one).
 * Shared by the stage wheel-zoom hook and the compare-review overlay so both
 * apply the identical gesture math to the same zoom store value.
 */
export const zoomStepsFromWheelDeltas = (
  deltas: readonly number[],
): number[] =>
  deltas.map((deltaY) => {
    const direction = deltaY < 0 ? 1 : -1;
    const steps = Math.max(
      1,
      Math.min(6, Math.round(Math.abs(deltaY) / 100)),
    );
    return direction * steps;
  });

/** Applies signed steps in order, clamped to the stage zoom bounds. */
export const applyZoomSteps = (
  previous: number,
  steps: readonly number[],
): number =>
  steps.reduce(
    (value, step) => clamp(value + step * ZOOM_STEP, ZOOM_MIN, ZOOM_MAX),
    previous,
  );

/**
 * Coalesces Ctrl+wheel bursts onto one frame. Every event keeps its own step
 * (the step formula has a floor of one), applied in order so the final zoom
 * matches handling the events one by one.
 */
export const useStageWheelZoom = (
  setZoom: SetZoom,
): ((event: StageWheelZoomEvent) => void) => {
  const stepsRef = useRef<number[]>([]);
  const frameRef = useRef<number | null>(null);

  const applySteps = useCallback(
    (steps: readonly number[]) => {
      if (steps.length === 0) return;
      setZoom((previous) => applyZoomSteps(previous, steps));
    },
    [setZoom],
  );

  const handleWheel = useCallback(
    (event: StageWheelZoomEvent) => {
      if (!event.ctrlKey) return;
      event.preventDefault();
      stepsRef.current.push(...zoomStepsFromWheelDeltas([event.deltaY]));
      if (frameRef.current !== null) return;
      frameRef.current = requestAnimationFrame(() => {
        frameRef.current = null;
        const pendingSteps = stepsRef.current;
        stepsRef.current = [];
        applySteps(pendingSteps);
      });
    },
    [applySteps],
  );

  useEffect(() => {
    return () => {
      if (frameRef.current === null) return;
      cancelAnimationFrame(frameRef.current);
      frameRef.current = null;
      const pendingSteps = stepsRef.current;
      stepsRef.current = [];
      applySteps(pendingSteps);
    };
  }, [applySteps]);

  return handleWheel;
};
