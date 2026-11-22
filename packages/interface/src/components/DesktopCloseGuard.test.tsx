import { act, fireEvent, render, screen, waitFor } from '@testing-library/react';
import { beforeAll, beforeEach, describe, expect, it, vi } from 'vitest';
import type { DesktopModelsApi } from '@shared/desktop-api';

import { I18nProvider } from '../i18n';
import { setDesktopBridgeProvider } from '../lib/desktop-bridge';
import { installCloseGuardSubscription } from '../pages/dashboard/lib/desktop-close-guard';
import { createDesktopBridgeStub } from '../testing/desktop-bridge-stub';
import DesktopCloseGuard from './DesktopCloseGuard';
import { CloseGuardModalClassic } from './CloseGuardModalClassic';

const modelsStub: DesktopModelsApi = {
  listInstalled: async () => [],
  getDiskSpace: async () => ({ freeBytes: 1024 ** 3, totalBytes: 1024 ** 3, path: 'mock' }),
  checkUpdates: async () => [],
  download: async () => ({ queued: true, queueLength: 1 }),
  importOnnx: async () => {
    throw new Error('not used in this suite');
  },
  cancel: async () => undefined,
  cancelAll: async () => undefined,
  uninstall: async () => undefined,
  listActive: async () => ({ known: false }),
  on: async () => true,
  off: () => undefined,
};

const listeners = new Set<(payload: {
  hasUnsavedWork: boolean;
  batchRunning: boolean;
}) => void>();
const closeForce = vi.fn(async () => undefined);
const setDirty = vi.fn(async () => undefined);

beforeAll(() => {
  window.localStorage.setItem('koma-studio.locale.v1', 'en');
  setDesktopBridgeProvider({
    desktop: createDesktopBridgeStub(modelsStub, {
      windowState: { setDirty, closeForce },
      onCloseRequested: (listener) => {
        listeners.add(listener);
        return () => {
          listeners.delete(listener);
        };
      },
    }),
  });
  installCloseGuardSubscription();
});

beforeEach(() => {
  closeForce.mockClear();
  setDirty.mockClear();
});

const emitCloseRequest = (payload: {
  hasUnsavedWork: boolean;
  batchRunning: boolean;
}): void => {
  act(() => {
    for (const listener of listeners) {
      listener(payload);
    }
  });
};

const renderGuard = () =>
  render(
    <I18nProvider>
      <DesktopCloseGuard />
    </I18nProvider>,
  );

describe('DesktopCloseGuard (default family)', () => {
  it('renders nothing until the shell emits a close request', () => {
    renderGuard();

    expect(screen.queryByText('Close KŌMA?')).not.toBeInTheDocument();

    emitCloseRequest({ hasUnsavedWork: true, batchRunning: false });

    expect(screen.getByText('Close KŌMA?')).toBeInTheDocument();
    expect(screen.getByRole('button', { name: 'Close anyway' })).toBeInTheDocument();
    expect(screen.getByRole('button', { name: 'Cancel' })).toBeInTheDocument();
  });

  it('force-closes through the shell windowState channel on Close anyway', async () => {
    renderGuard();

    emitCloseRequest({ hasUnsavedWork: true, batchRunning: true });
    fireEvent.click(screen.getByRole('button', { name: 'Close anyway' }));

    expect(closeForce).toHaveBeenCalledTimes(1);
    await waitFor(() => {
      expect(screen.queryByText('Close KŌMA?')).not.toBeInTheDocument();
    });
  });

  it('dismisses on Cancel without touching the shell', async () => {
    renderGuard();

    emitCloseRequest({ hasUnsavedWork: false, batchRunning: true });
    fireEvent.click(screen.getByRole('button', { name: 'Cancel' }));

    expect(closeForce).not.toHaveBeenCalled();
    await waitFor(() => {
      expect(screen.queryByText('Close KŌMA?')).not.toBeInTheDocument();
    });
  });

  it('shows the guard again for a repeated close request after dismissal', async () => {
    renderGuard();

    emitCloseRequest({ hasUnsavedWork: true, batchRunning: false });
    fireEvent.click(screen.getByRole('button', { name: 'Cancel' }));
    await waitFor(() => {
      expect(screen.queryByText('Close KŌMA?')).not.toBeInTheDocument();
    });

    emitCloseRequest({ hasUnsavedWork: true, batchRunning: false });

    expect(screen.getByText('Close KŌMA?')).toBeInTheDocument();
  });
});

describe('CloseGuardModalClassic', () => {
  it('renders the localized dialog with both actions', () => {
    render(
      <I18nProvider>
        <CloseGuardModalClassic
          open
          onCloseAnyway={() => undefined}
          onCancel={() => undefined}
        />
      </I18nProvider>,
    );

    expect(screen.getByText('Close KŌMA?')).toBeInTheDocument();
    expect(
      screen.getByText(
        'There are unsaved changes or a batch is running. Closing now may lose unsaved changes or interrupt the batch.',
      ),
    ).toBeInTheDocument();
    expect(screen.getByRole('button', { name: 'Close anyway' })).toBeInTheDocument();
    expect(screen.getByRole('button', { name: 'Cancel' })).toBeInTheDocument();
  });

  it('renders nothing when closed', () => {
    render(
      <I18nProvider>
        <CloseGuardModalClassic
          open={false}
          onCloseAnyway={() => undefined}
          onCancel={() => undefined}
        />
      </I18nProvider>,
    );

    expect(screen.queryByText('Close KŌMA?')).not.toBeInTheDocument();
  });
});
