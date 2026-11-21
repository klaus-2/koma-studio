// @vitest-environment jsdom

import { act, renderHook } from '@testing-library/react';
import { describe, expect, it, vi } from 'vitest';

import { useDashboardExternalActions } from './useDashboardExternalActions';

describe('openSettingsOnRuntimeTab', () => {
  it("persists 'runtime' as the requested settings tab and opens settings", () => {
    window.sessionStorage.clear();
    const onOpenSettings = vi.fn();
    const { result } = renderHook(() =>
      useDashboardExternalActions({ onOpenSettings }),
    );

    act(() => {
      result.current.openSettingsOnRuntimeTab();
    });

    expect(window.sessionStorage.getItem('koma-settings-requested-tab')).toBe('runtime');
    expect(onOpenSettings).toHaveBeenCalledTimes(1);
  });

  it('shares the sessionStorage key with the other deep links', () => {
    window.sessionStorage.clear();
    const { result } = renderHook(() => useDashboardExternalActions({}));

    act(() => {
      result.current.openSettingsOnPresetsTab();
    });
    expect(window.sessionStorage.getItem('koma-settings-requested-tab')).toBe('presets');

    act(() => {
      result.current.openSettingsOnRuntimeTab();
    });
    expect(window.sessionStorage.getItem('koma-settings-requested-tab')).toBe('runtime');
  });
});
