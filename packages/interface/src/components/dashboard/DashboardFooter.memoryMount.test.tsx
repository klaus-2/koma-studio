// @vitest-environment jsdom

import { QueryClient, QueryClientProvider } from '@tanstack/react-query';
import { render, screen } from '@testing-library/react';
import { afterEach, describe, expect, it, vi } from 'vitest';

import DashboardFooter from './DashboardFooter';
import { setDesktopBridgeProvider } from '@/lib/desktop-bridge';
import { useUiShellStore } from '@/pages/dashboard/stores/ui-shell-store';

vi.mock('@/i18n', () => ({
  useI18n: (): { t: (key: string) => string } => ({
    t: (key: string): string => key,
  }),
}));

const ORIGINAL_MODE = useUiShellStore.getState().mode;

const STATS_PAYLOAD = {
  process: { pid: 1, rss_mb: 512, vms_mb: 900, cpu_percent: 1 },
  gpu: null,
};

const baseProps = {
  openBugReportModal: (): void => undefined,
  openProjectExternalLink: (): void => undefined,
  projectDiscordUrl: 'https://discord.example',
  projectWebsiteUrl: 'https://example.com',
};

const stubStatsFetch = (): ReturnType<typeof vi.fn> => {
  const fetchStub = vi.fn(async (): Promise<Response> =>
    new Response(JSON.stringify(STATS_PAYLOAD), {
      status: 200,
      headers: { 'Content-Type': 'application/json' },
    }),
  );
  vi.stubGlobal('fetch', fetchStub);
  return fetchStub;
};

afterEach(() => {
  useUiShellStore.setState({ mode: ORIGINAL_MODE });
  vi.unstubAllGlobals();
});

describe('DashboardFooter memory-poller mount (C2.4)', () => {
  it('does not poll and does not crash without a QueryClientProvider', () => {
    setDesktopBridgeProvider({ desktop: null, isDesktopRuntime: () => false });
    const fetchStub = stubStatsFetch();

    render(<DashboardFooter {...baseProps} />);

    expect(fetchStub).not.toHaveBeenCalled();
    expect(screen.queryByText('512 MB')).toBeNull();
  });

  it('polls in AIO mode with a provider and feeds the meter inside the footer', async () => {
    setDesktopBridgeProvider({ desktop: null, isDesktopRuntime: () => false });
    const fetchStub = stubStatsFetch();
    const client = new QueryClient();

    render(
      <QueryClientProvider client={client}>
        <DashboardFooter {...baseProps} />
      </QueryClientProvider>,
    );

    await screen.findByText('512 MB');
    expect(fetchStub).toHaveBeenCalled();
    const requestUrl = String(fetchStub.mock.calls[0]?.[0] ?? '');
    expect(requestUrl.endsWith('/memory/stats')).toBe(true);

    client.clear();
  });

  it('does not poll outside AIO mode even with a provider', () => {
    setDesktopBridgeProvider({ desktop: null, isDesktopRuntime: () => false });
    useUiShellStore.setState({ mode: 'cleaner' });
    const fetchStub = stubStatsFetch();
    const client = new QueryClient();

    render(
      <QueryClientProvider client={client}>
        <DashboardFooter {...baseProps} />
      </QueryClientProvider>,
    );

    expect(fetchStub).not.toHaveBeenCalled();
    expect(screen.queryByText('512 MB')).toBeNull();

    client.clear();
  });
});
