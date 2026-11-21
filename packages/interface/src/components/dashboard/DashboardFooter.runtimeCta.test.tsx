// @vitest-environment jsdom

import { fireEvent, render, screen } from '@testing-library/react';
import { beforeAll, beforeEach, describe, expect, it, vi } from 'vitest';

import { setDesktopBridgeProvider } from '@/lib/desktop-bridge';
import { installJsdomBrowserStubs } from './renderTextPreviewTestSetup';
import { I18nProvider } from '../../i18n';
import type { AioDeviceInfo } from '../../models/aioStageCatalog';
import type { DesktopMiniBackendRuntimeState } from '../../types';
import DashboardFooterClassic from './DashboardFooterClassic';
import DashboardFooterNoir from './noir/DashboardFooterNoir';

const FALLBACK_STATE: DesktopMiniBackendRuntimeState = {
  status: 'fallback',
  statusMessage: null,
  requestedProfile: 'nvidia-cuda',
  activeProfile: 'cpu',
  source: 'bundled-core',
  runtimeArtifactsUrl: null,
  runtimeManifestUrl: null,
  runtimeArchiveUrl: null,
  installDir: null,
  downloadCacheDir: null,
  version: null,
  lastError: null,
  attempt: 1,
  maxAttempts: 1,
  exitCode: null,
  lastStderr: null,
  crashLogPath: null,
  progress: null,
  updatedAt: null,
  gpuName: null,
  vramGb: null,
};

const GPU_DEVICE_INFO: AioDeviceInfo = {
  name: 'Discrete GPU',
  has_gpu: true,
  provider: 'cuda',
  vram_gb: 8,
};

const baseProps = {
  openBugReportModal: (): void => undefined,
  openProjectExternalLink: (): void => undefined,
  projectDiscordUrl: 'https://discord.example',
  projectWebsiteUrl: 'https://example.com',
};

beforeAll(() => {
  setDesktopBridgeProvider({ desktop: null });
});

beforeEach(() => {
  installJsdomBrowserStubs();
  window.sessionStorage.clear();
});

describe.each([
  ['classic', DashboardFooterClassic],
  ['noir', DashboardFooterNoir],
])('runtime CTA in the %s footer', (_name, Footer) => {
  it('offers a persistent CTA when the runtime is in fallback', () => {
    const openSettingsOnRuntimeTab = vi.fn();
    render(
      <I18nProvider>
        <Footer
          {...baseProps}
          miniBackendRuntimeState={FALLBACK_STATE}
          openSettingsOnRuntimeTab={openSettingsOnRuntimeTab}
        />
      </I18nProvider>,
    );

    fireEvent.click(screen.getByText('Fix configuration'));

    expect(openSettingsOnRuntimeTab).toHaveBeenCalledTimes(1);
  });

  it('surfaces the CPU-with-GPU alert from the device info already in the footer', async () => {
    render(
      <I18nProvider>
        <Footer
          {...baseProps}
          miniBackendRuntimeState={FALLBACK_STATE}
          aioDeviceInfo={GPU_DEVICE_INFO}
        />
      </I18nProvider>,
    );

    const badge = screen.getByTestId('dashboard-footer-runtime-badge');
    fireEvent.focus(badge);
    expect(await screen.findByText(/A GPU is available/)).toBeDefined();
  });

  it('keeps the generic fallback copy when no GPU is reported', () => {
    render(
      <I18nProvider>
        <Footer {...baseProps} miniBackendRuntimeState={FALLBACK_STATE} />
      </I18nProvider>,
    );

    expect(screen.getByTestId('dashboard-footer-runtime-badge')).toBeDefined();
  });
});
