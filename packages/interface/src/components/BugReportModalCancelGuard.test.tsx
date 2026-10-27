// @vitest-environment jsdom

// Regression tests for the perf pass 4 cancelled-guard on the bug-report
// modal's async prepare() effect: a resolution that lands after the modal was
// closed and reopened must be ignored (stale), while the fresh prepare's
// resolution still paints. Exercises both theme variants (classic + noir).

import { afterEach, describe, expect, it, vi } from 'vitest';
import { act, cleanup, render, waitFor } from '@testing-library/react';

import type { ComponentProps } from 'react';

import { I18nProvider } from '@/i18n';
import { setDesktopBridgeProvider } from '@/lib/desktop-bridge';
import BugReportModalClassic from './BugReportModalClassic';
import BugReportModalNoir from './noir/BugReportModalNoir';
import type {
  DesktopBugReportDiagnostics,
  DesktopBugReportPrepareResult,
  IDesktopBridge,
} from '@shared/desktop-api';

type ModalProps = ComponentProps<typeof BugReportModalClassic>;

const emptyDiagnostics = (): DesktopBugReportDiagnostics => ({
  timestamp: new Date(0).toISOString(),
  appVersion: '',
  platform: '',
  release: '',
  arch: '',
  nodeVersion: '',
  electronVersion: '',
  chromeVersion: '',
  appPackaged: false,
  envMode: '',
  updateChannel: '',
  miniBackendRunning: false,
  miniBackendRuntimeLineCount: 0,
  authApiUrl: '',
  localApiUrl: '',
  machineProfileSchemaVersion: 1,
  machineProfile: null,
  machineProfileSync: {
    lastSyncedAt: null,
    lastChangedAt: null,
    lastError: null,
    profileHash: null,
    changedFields: [],
    lastReason: null,
  },
});

const readyPrep = (): DesktopBugReportPrepareResult => ({
  screenshotDataUrl: 'data:image/png;base64,AAA',
  autoLogs: [],
  diagnostics: emptyDiagnostics(),
  ready: true,
});

const makeDeferredPrepare = () => {
  const resolvers: Array<(value: DesktopBugReportPrepareResult) => void> = [];
  const prepare = vi.fn(
    () =>
      new Promise<DesktopBugReportPrepareResult>((resolve) => {
        resolvers.push(resolve);
      }),
  );
  return { prepare, resolvers };
};

// Partial bridge: the modal only reads desktop.api.bugReport (optional-chained
// at every access). Same test idiom as model-download-manager.test.ts.
const bridgeWithPrepare = (
  prepare: () => Promise<DesktopBugReportPrepareResult>,
): { desktop: IDesktopBridge } => ({
  desktop: {
    api: {
      bugReport: { prepare, submit: vi.fn() },
    },
  } as unknown as IDesktopBridge,
});

const renderModal = (
  Modal: typeof BugReportModalClassic,
  open: boolean,
): ReturnType<typeof render> => {
  const props: ModalProps = { open, onClose: () => undefined };
  return render(
    <I18nProvider>
      <Modal {...props} />
    </I18nProvider>,
  );
};

const rerenderModal = (
  view: ReturnType<typeof render>,
  Modal: typeof BugReportModalClassic,
  open: boolean,
): void => {
  const props: ModalProps = { open, onClose: () => undefined };
  view.rerender(
    <I18nProvider>
      <Modal {...props} />
    </I18nProvider>,
  );
};

afterEach(cleanup);

describe.each([
  ['classic', BugReportModalClassic],
  ['noir', BugReportModalNoir],
])('BugReportModal %s cancelled-guard', (_name, Modal) => {
  it('applies the prepare() result when it resolves while open', async () => {
    const { prepare, resolvers } = makeDeferredPrepare();
    setDesktopBridgeProvider(bridgeWithPrepare(prepare));

    const view = renderModal(Modal, true);
    expect(prepare).toHaveBeenCalledTimes(1);
    expect(view.container.querySelector('img[src^="data:"]')).toBeNull();

    await act(async () => {
      resolvers[0]?.(readyPrep());
    });

    await waitFor(() =>
      expect(view.container.querySelector('img[src^="data:"]')).not.toBeNull(),
    );
  });

  it('ignores a stale prepare() resolution that lands after reopen', async () => {
    const { prepare, resolvers } = makeDeferredPrepare();
    setDesktopBridgeProvider(bridgeWithPrepare(prepare));

    const view = renderModal(Modal, true);
    expect(prepare).toHaveBeenCalledTimes(1);

    // Close, then reopen while prepare #1 is still in flight: the effect
    // cleanup must cancel the in-flight resolution.
    rerenderModal(view, Modal, false);
    rerenderModal(view, Modal, true);
    expect(prepare).toHaveBeenCalledTimes(2);

    await act(async () => {
      resolvers[0]?.(readyPrep());
    });

    // Without the guard the stale result would paint the screenshot here.
    expect(view.container.querySelector('img[src^="data:"]')).toBeNull();

    await act(async () => {
      resolvers[1]?.(readyPrep());
    });

    await waitFor(() =>
      expect(view.container.querySelector('img[src^="data:"]')).not.toBeNull(),
    );
  });
});
