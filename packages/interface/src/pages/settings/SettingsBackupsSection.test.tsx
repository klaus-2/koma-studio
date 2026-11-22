// @vitest-environment jsdom

import { fireEvent, render, screen, waitFor } from '@testing-library/react';
import { beforeEach, describe, expect, it, vi } from 'vitest';
import type { DesktopBackupListResult, DesktopModelsApi } from '@shared/desktop-api';

import { createDesktopBridgeStub } from '@/testing/desktop-bridge-stub';
import { setDesktopBridgeProvider } from '@/lib/desktop-bridge';
import { SettingsBackupsSection } from './SettingsBackupsSection';

const modelsStub: DesktopModelsApi = {
  listInstalled: async () => [],
  getDiskSpace: async () => ({ freeBytes: 1, totalBytes: 1, path: 'mock' }),
  checkUpdates: async () => [],
  download: async () => ({ queued: true, queueLength: 0 }),
  importOnnx: async () => {
    throw new Error('not used');
  },
  cancel: async () => undefined,
  cancelAll: async () => undefined,
  uninstall: async () => undefined,
  listActive: async () => ({ known: false }),
  on: async () => true,
  off: () => undefined,
};

const t = (key: string): string => key;

const clickFirst = (buttons: HTMLElement[]): void => {
  const first = buttons[0];
  if (!first) {
    throw new Error('no matching element');
  }
  fireEvent.click(first);
};

const backupFixture = (): DesktopBackupListResult => ({
  backups: [
    {
      fileName: 'work-20261122T090000.backup',
      path: 'C:/data/backups/work-20261122T090000.backup',
      sizeBytes: 2048,
      modifiedAt: '2026-11-22T09:00:00.000Z',
    },
    {
      fileName: 'work-20261121T090000.backup',
      path: 'C:/data/backups/work-20261121T090000.backup',
      sizeBytes: 1024,
      modifiedAt: '2026-11-21T09:00:00.000Z',
    },
  ],
});

beforeEach(() => {
  setDesktopBridgeProvider(null);
});

describe('SettingsBackupsSection', () => {
  it('renders nothing when the workspace bridge has no backup members', () => {
    setDesktopBridgeProvider({
      desktop: createDesktopBridgeStub(modelsStub),
    });
    const { container } = render(<SettingsBackupsSection t={t} />);
    expect(container.querySelector('section')).toBeNull();
  });

  it('lists the backups returned by the bridge', async () => {
    const listBackups = vi.fn(async () => backupFixture());
    const restoreBackup = vi.fn(async () => ({ ok: true }));
    setDesktopBridgeProvider({
      desktop: createDesktopBridgeStub(modelsStub, {
        workspaceListBackups: listBackups,
        workspaceRestoreBackup: restoreBackup,
      }),
    });
    render(<SettingsBackupsSection t={t} />);

    expect(await screen.findByText('work-20261122T090000.backup')).toBeInTheDocument();
    expect(screen.getByText('work-20261121T090000.backup')).toBeInTheDocument();
    expect(listBackups).toHaveBeenCalledTimes(1);
  });

  it('gates restore behind a confirm and refreshes after the bridge call', async () => {
    const listBackups = vi.fn(async () => backupFixture());
    const restoreBackup = vi.fn(async () => ({ ok: true }));
    setDesktopBridgeProvider({
      desktop: createDesktopBridgeStub(modelsStub, {
        workspaceListBackups: listBackups,
        workspaceRestoreBackup: restoreBackup,
      }),
    });
    render(<SettingsBackupsSection t={t} />);

    await screen.findByText('work-20261122T090000.backup');
    clickFirst(screen.getAllByText('desktop.backups.restore'));
    expect(restoreBackup).not.toHaveBeenCalled();

    fireEvent.click(screen.getByRole('button', { name: 'desktop.backups.restoreConfirmCancel' }));
    expect(restoreBackup).not.toHaveBeenCalled();
    expect(screen.queryByRole('dialog')).toBeNull();

    clickFirst(screen.getAllByText('desktop.backups.restore'));
    fireEvent.click(screen.getByRole('button', { name: 'desktop.backups.restoreConfirmAccept' }));

    await waitFor(() => expect(restoreBackup).toHaveBeenCalledWith({ fileName: 'work-20261122T090000.backup' }));
    await waitFor(() => expect(listBackups).toHaveBeenCalledTimes(2));
    expect(await screen.findByText('desktop.backups.restoreSuccess')).toBeInTheDocument();
  });

  it('shows the error feedback when the restore is rejected by the shell', async () => {
    const listBackups = vi.fn(async () => backupFixture());
    const restoreBackup = vi.fn(async () => ({ ok: false, error: 'locked' }));
    setDesktopBridgeProvider({
      desktop: createDesktopBridgeStub(modelsStub, {
        workspaceListBackups: listBackups,
        workspaceRestoreBackup: restoreBackup,
      }),
    });
    render(<SettingsBackupsSection t={t} />);

    await screen.findByText('work-20261122T090000.backup');
    clickFirst(screen.getAllByText('desktop.backups.restore'));
    fireEvent.click(screen.getByRole('button', { name: 'desktop.backups.restoreConfirmAccept' }));

    const feedback = await screen.findAllByText((_, element) => element?.textContent === 'desktop.backups.restoreFailed: locked');
    expect(feedback.length).toBeGreaterThan(0);
  });

  it('shows the error feedback when the restore call throws', async () => {
    const listBackups = vi.fn(async () => backupFixture());
    const restoreBackup = vi.fn(async () => {
      throw new Error('ipc down');
    });
    setDesktopBridgeProvider({
      desktop: createDesktopBridgeStub(modelsStub, {
        workspaceListBackups: listBackups,
        workspaceRestoreBackup: restoreBackup,
      }),
    });
    render(<SettingsBackupsSection t={t} />);

    await screen.findByText('work-20261122T090000.backup');
    clickFirst(screen.getAllByText('desktop.backups.restore'));
    fireEvent.click(screen.getByRole('button', { name: 'desktop.backups.restoreConfirmAccept' }));

    expect(await screen.findByText('desktop.backups.restoreFailed')).toBeInTheDocument();
  });

  it('shows the empty state when the shell reports no backups', async () => {
    const listBackups = vi.fn(async () => ({ backups: [] }) satisfies DesktopBackupListResult);
    const restoreBackup = vi.fn(async () => ({ ok: true }));
    setDesktopBridgeProvider({
      desktop: createDesktopBridgeStub(modelsStub, {
        workspaceListBackups: listBackups,
        workspaceRestoreBackup: restoreBackup,
      }),
    });
    render(<SettingsBackupsSection t={t} />);

    expect(await screen.findByText('desktop.backups.empty')).toBeInTheDocument();
  });
});
