import { StrictMode } from 'react';
import { renderHook, act } from '@testing-library/react';
import { beforeEach, describe, expect, it, vi } from 'vitest';

import { useDashboardIdlePreload } from './use-dashboard-idle-preload';

const preloads = vi.hoisted(() => ({
  stageHeavy: vi.fn(),
  specialWorkspaces: vi.fn(),
  infoModeModules: vi.fn(),
}));

const idle = vi.hoisted(() => ({
  callbacks: [] as Array<() => void>,
}));

vi.mock('../sections/StageGrid', () => ({
  preloadStageHeavyModules: preloads.stageHeavy,
}));
vi.mock('../../../components/dashboard/DashboardSpecialModeStage', () => ({
  preloadSpecialWorkspaces: preloads.specialWorkspaces,
}));
vi.mock('../../../components/dashboard/DashboardInfoModeStage', () => ({
  preloadInfoModeModules: preloads.infoModeModules,
}));
vi.mock('../../../utils/runWhenIdle', () => ({
  runWhenIdle: (callback: () => void): void => {
    idle.callbacks.push(callback);
  },
}));

describe('useDashboardIdlePreload', () => {
  beforeEach(() => {
    idle.callbacks.length = 0;
  });

  it('schedules exactly one idle callback on mount without preloading during boot', () => {
    renderHook(() => useDashboardIdlePreload());

    expect(idle.callbacks).toHaveLength(1);
    expect(preloads.stageHeavy).not.toHaveBeenCalled();
    expect(preloads.specialWorkspaces).not.toHaveBeenCalled();
    expect(preloads.infoModeModules).not.toHaveBeenCalled();
  });

  it('keeps a single schedule under StrictMode double-effect', () => {
    renderHook(() => useDashboardIdlePreload(), { wrapper: StrictMode });

    expect(idle.callbacks).toHaveLength(1);
  });

  it('does not reschedule on rerender', () => {
    const { rerender } = renderHook(() => useDashboardIdlePreload());
    rerender();
    rerender();

    expect(idle.callbacks).toHaveLength(1);
  });

  it('runs all four preloads exactly once when the idle slot fires', () => {
    renderHook(() => useDashboardIdlePreload());

    act(() => {
      const callback = idle.callbacks[0];
      if (callback) callback();
    });

    expect(preloads.stageHeavy).toHaveBeenCalledTimes(1);
    expect(preloads.specialWorkspaces).toHaveBeenCalledTimes(1);
    expect(preloads.infoModeModules).toHaveBeenCalledTimes(1);
  });

  it('leaves nothing scheduled behind on unmount', () => {
    const { unmount } = renderHook(() => useDashboardIdlePreload());
    unmount();

    expect(idle.callbacks).toHaveLength(1);
    expect(preloads.stageHeavy).not.toHaveBeenCalled();
  });
});
