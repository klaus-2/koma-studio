import { renderHook } from '@testing-library/react';
import { beforeEach, describe, expect, it, vi } from 'vitest';
import { useUiShellStore } from '../pages/dashboard/stores/ui-shell-store';
import { useDashboardUsageAndPresence } from './useDashboardUsageAndPresence';

const mockTranslate = (key: string, params?: Record<string, string | number>) =>
  params ? `${key}:${JSON.stringify(params)}` : key;

vi.mock('../i18n', () => ({
  useI18n: () => ({ t: mockTranslate }),
}));

describe('useDashboardUsageAndPresence', () => {
  beforeEach(() => {
    useUiShellStore.setState({ processing: false });
  });

  const baseArgs = (
    setDiscordPreset = vi.fn().mockResolvedValue(undefined),
    overrides: Partial<Parameters<typeof useDashboardUsageAndPresence>[0]> = {},
  ): Parameters<typeof useDashboardUsageAndPresence>[0] => ({
    authUser: null,
    authLoading: false,
    user: { name: 'Local User', email: '' },
    mode: 'aio',
    subMode: 'auto',
    activeImageFileName: 'page-01.png',
    imagesLength: 1,
    translatorWorkspaceMode: 'visual',
    srcLang: 'Japanese',
    tgtLang: 'Portuguese',
    setStatusMessage: vi.fn(),
    setDiscordPreset,
    ...overrides,
  });

  it('syncs AIO presence even when authUser is null (desktop local mode)', async () => {
    const setDiscordPreset = vi.fn().mockResolvedValue(undefined);
    const { result } = renderHook(() =>
      useDashboardUsageAndPresence(baseArgs(setDiscordPreset)),
    );

    await result.current.syncDiscordForTab();

    expect(setDiscordPreset).toHaveBeenCalledWith(
      'aio_pipeline_automatic',
      expect.objectContaining({
        state: 'discord.presence.mode.automatic',
      }),
    );
  });

  it('uses aio_pipeline_manual when subMode is manual', async () => {
    const setDiscordPreset = vi.fn().mockResolvedValue(undefined);
    const { result } = renderHook(() =>
      useDashboardUsageAndPresence(baseArgs(setDiscordPreset, { subMode: 'manual' })),
    );

    await result.current.syncDiscordForTab();

    expect(setDiscordPreset).toHaveBeenCalledWith(
      'aio_pipeline_manual',
      expect.objectContaining({
        state: 'discord.presence.mode.manual',
      }),
    );
  });

  it('skips presence sync while active processing is in flight', async () => {
    useUiShellStore.setState({ processing: true });
    const setDiscordPreset = vi.fn().mockResolvedValue(undefined);
    const { result } = renderHook(() =>
      useDashboardUsageAndPresence(baseArgs(setDiscordPreset)),
    );

    await result.current.syncDiscordForTab();

    expect(setDiscordPreset).not.toHaveBeenCalled();
  });
});
