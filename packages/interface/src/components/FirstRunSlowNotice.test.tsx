// @vitest-environment jsdom

import { act, cleanup, fireEvent, render, screen } from '@testing-library/react';
import { afterEach, beforeAll, beforeEach, describe, expect, it } from 'vitest';

import { useThemeStore } from '@koma/ui/stores/theme-store';
import type { KomaThemeFamily } from '@koma/ui/stores/theme-store';
import { I18nProvider } from '@/i18n';
import { setDesktopBridgeProvider } from '@/lib/desktop-bridge';
import { TOOL_TIPS_DISMISSED_STORAGE_KEY } from '@/hooks/useToolTips';
import { useAioPipelineStore } from '@/pages/dashboard/stores/aio-pipeline-store';
import FirstRunSlowNotice, { FIRST_RUN_NOTICE_TIP_ID } from '@/components/FirstRunSlowNotice';

const startAioRun = () =>
  act(() => {
    useAioPipelineStore.setState({
      aioExecutionStatus: {
        scope: 'auto',
        stageKey: null,
        imageName: null,
        imageIndex: null,
        totalImages: 5,
        label: 'Detect Text',
      },
    });
  });

const finishAioRun = () =>
  act(() => {
    useAioPipelineStore.setState({ aioExecutionStatus: null });
  });

const renderNotice = () =>
  render(
    <I18nProvider>
      <FirstRunSlowNotice />
    </I18nProvider>,
  );

const startNewAppSession = () => window.sessionStorage.clear();

const dismissedForever = (): string[] => {
  const raw = window.localStorage.getItem(TOOL_TIPS_DISMISSED_STORAGE_KEY);
  return raw === null ? [] : (JSON.parse(raw) as string[]);
};

const resetStorage = () => {
  window.localStorage.clear();
  window.sessionStorage.clear();
  useAioPipelineStore.setState({ aioExecutionStatus: null });
};

beforeAll(() => {
  setDesktopBridgeProvider({ desktop: null });
});

beforeEach(resetStorage);

afterEach(() => {
  cleanup();
  resetStorage();
});

describe.each<KomaThemeFamily>(['classic', 'noir'])('FirstRunSlowNotice (%s)', (family) => {
  beforeEach(() => {
    useThemeStore.setState({ family });
  });

  it('stays hidden until an AI pipeline run starts', () => {
    renderNotice();
    expect(screen.queryByRole('status')).toBeNull();
  });

  it('announces itself politely on the first AI pipeline run', () => {
    renderNotice();
    startAioRun();
    const notice = screen.getByRole('status');
    expect(notice.getAttribute('aria-live')).toBe('polite');
    expect(screen.getByText('The first run is slower')).toBeDefined();
  });

  it('does not take focus from the running workspace', () => {
    renderNotice();
    const before = document.activeElement;
    startAioRun();
    expect(document.activeElement).toBe(before);
  });

  it('dismisses from the primary action, the close button and Escape', () => {
    renderNotice();
    startAioRun();
    fireEvent.click(screen.getByText('Got it'));
    expect(screen.queryByRole('status')).toBeNull();
    cleanup();
    startNewAppSession();

    renderNotice();
    startAioRun();
    fireEvent.click(screen.getByLabelText('Dismiss first-run notice'));
    expect(screen.queryByRole('status')).toBeNull();
    cleanup();
    startNewAppSession();

    renderNotice();
    startAioRun();
    fireEvent.keyDown(screen.getByRole('status'), { key: 'Escape' });
    expect(screen.queryByRole('status')).toBeNull();
  });

  it('shows once per app session and closes itself when the run ends', () => {
    const first = renderNotice();
    startAioRun();
    finishAioRun();
    expect(screen.queryByRole('status')).toBeNull();
    startAioRun();
    expect(screen.queryByRole('status')).toBeNull();
    first.unmount();

    startNewAppSession();
    renderNotice();
    startAioRun();
    expect(screen.getByRole('status')).toBeDefined();
  });

  it('keeps the notice open while the box is ticked and stores the choice at once', () => {
    renderNotice();
    startAioRun();
    const box = screen.getByRole('checkbox', { name: "Don't show again" });
    expect((box as HTMLInputElement).checked).toBe(false);

    fireEvent.click(box);

    expect(screen.getByRole('status')).toBeDefined();
    expect((box as HTMLInputElement).checked).toBe(true);
    expect(dismissedForever()).toEqual([FIRST_RUN_NOTICE_TIP_ID]);
  });

  it('never shows again in a new app session once the box was ticked', () => {
    const first = renderNotice();
    startAioRun();
    fireEvent.click(screen.getByRole('checkbox', { name: "Don't show again" }));
    finishAioRun();
    first.unmount();

    startNewAppSession();
    renderNotice();
    startAioRun();
    expect(screen.queryByRole('status')).toBeNull();
  });

  it('unticking the box undoes the opt-out', () => {
    const first = renderNotice();
    startAioRun();
    const box = screen.getByRole('checkbox', { name: "Don't show again" });
    fireEvent.click(box);
    fireEvent.click(box);
    expect(dismissedForever()).toEqual([]);
    finishAioRun();
    first.unmount();

    startNewAppSession();
    renderNotice();
    startAioRun();
    expect(screen.getByRole('status')).toBeDefined();
  });
});
