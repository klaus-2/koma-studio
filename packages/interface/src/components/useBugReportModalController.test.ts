// @vitest-environment jsdom

import { act, cleanup, fireEvent, render, renderHook, waitFor } from '@testing-library/react';
import { createElement, type ChangeEvent, type ReactNode } from 'react';
import { afterEach, describe, expect, it, vi } from 'vitest';
import type {
  DesktopBugReportDiagnostics,
  DesktopBugReportPrepareResult,
  DesktopBugReportSubmitPayload,
} from '@shared/desktop-api';

interface MockBugReportApi {
  prepare: () => Promise<DesktopBugReportPrepareResult>;
  submit: (
    payload: DesktopBugReportSubmitPayload,
  ) => Promise<{ ok: boolean; status?: number; error?: string }>;
}

let mockBugReportApi: MockBugReportApi | null = null;

vi.mock('@/lib/desktop-bridge', () => ({
  desktopBridge: {
    get desktop() {
      return mockBugReportApi
        ? { api: { bugReport: mockBugReportApi } }
        : null;
    },
    isDesktopRuntime: () => false,
  },
}));

import { I18nProvider } from '@/i18n';
import {
  fmtBytes,
  MAX_ATTACH,
  MAX_FILE,
  useBugReportModalController,
} from './useBugReportModalController';

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

const createWrapper =
  () =>
  ({ children }: { children: ReactNode }) =>
    createElement(I18nProvider, null, children);

const triggerFilesChange = (
  onChange: (event: ChangeEvent<HTMLInputElement>) => void,
  files: File[],
): void => {
  const view = render(
    createElement('input', {
      type: 'file',
      onChange,
    }),
  );
  const input = view.container.querySelector('input');
  expect(input).not.toBeNull();
  if (input) {
    Object.defineProperty(input, 'files', {
      value: files,
      configurable: true,
    });
    act(() => {
      fireEvent.change(input);
    });
  }
  view.unmount();
};

afterEach(() => {
  mockBugReportApi = null;
  cleanup();
});

describe('fmtBytes', () => {
  it('formats zero, invalid, bytes, kilobytes and megabytes', () => {
    expect(fmtBytes(0)).toBe('0 B');
    expect(fmtBytes(-12)).toBe('0 B');
    expect(fmtBytes(Number.NaN)).toBe('0 B');
    expect(fmtBytes(512)).toBe('512 B');
    expect(fmtBytes(1536)).toBe('1.5 KB');
    expect(fmtBytes(10 * 1024)).toBe('10 KB');
    expect(fmtBytes(5 * 1024 * 1024)).toBe('5.0 MB');
  });
});

describe('useBugReportModalController', () => {
  it('enforces attachment size and count limits and removes attachments cleanly', async () => {
    const prepare = vi.fn(async () => readyPrep());
    const submit = vi.fn(async () => ({ ok: true, status: 201 }));
    mockBugReportApi = { prepare, submit };

    const { result } = renderHook(
      () => useBugReportModalController({ open: true }),
      { wrapper: createWrapper() },
    );

    await waitFor(() => expect(result.current.prep?.ready).toBe(true));

    const oversized = new File([new Uint8Array(MAX_FILE + 1)], 'huge.bin');
    triggerFilesChange(
      (event) => result.current.addFiles(event),
      [oversized],
    );
    expect(result.current.attachments).toHaveLength(0);
    expect(result.current.attachErr).not.toBeNull();

    const validFiles = Array.from({ length: MAX_ATTACH + 1 }, (_, index) =>
      new File(['ok'], `log-${index}.txt`, { type: 'text/plain' }),
    );
    triggerFilesChange(
      (event) => result.current.addFiles(event),
      validFiles,
    );
    expect(result.current.attachments).toHaveLength(MAX_ATTACH);
    expect(result.current.attachErr).not.toBeNull();

    const firstId = result.current.attachments[0]?.id ?? '';
    act(() => {
      result.current.rmAttach(firstId);
    });
    expect(result.current.attachments).toHaveLength(MAX_ATTACH - 1);
    expect(result.current.attachErr).toBeNull();
  });

  it('resets form state on reopen and blocks submit with error when required fields are blank', async () => {
    const prepare = vi.fn(async () => readyPrep());
    const submit = vi.fn(async () => ({ ok: true, status: 201 }));
    mockBugReportApi = { prepare, submit };

    const { result, rerender } = renderHook(
      ({ open }: { open: boolean }) => useBugReportModalController({ open }),
      { initialProps: { open: true }, wrapper: createWrapper() },
    );

    await waitFor(() => expect(result.current.prep?.ready).toBe(true));

    await act(async () => {
      await result.current.submit();
    });
    expect(submit).not.toHaveBeenCalled();
    expect(result.current.err).not.toBeNull();

    act(() => {
      result.current.setTitle('Bug title');
      result.current.setDesc('Bug details');
      result.current.setIncludeLogs(false);
    });
    expect(result.current.canSubmit).toBe(true);

    rerender({ open: false });
    rerender({ open: true });

    await waitFor(() => expect(result.current.title).toBe(''));
    expect(result.current.desc).toBe('');
    expect(result.current.includeLogs).toBe(true);
    expect(result.current.err).toBeNull();
  });
});
