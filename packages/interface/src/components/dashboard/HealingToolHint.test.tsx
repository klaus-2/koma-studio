// @vitest-environment jsdom

import { cleanup, fireEvent, render, screen, waitFor } from '@testing-library/react';
import { afterEach, beforeAll, beforeEach, describe, expect, it } from 'vitest';

import { useThemeStore } from '@koma/ui/stores/theme-store';
import type { KomaThemeFamily } from '@koma/ui/stores/theme-store';
import { I18nProvider } from '@/i18n';
import { setDesktopBridgeProvider } from '@/lib/desktop-bridge';
import { TOOL_TIPS_DISMISSED_STORAGE_KEY } from '@/hooks/useToolTips';
import { HealingToolHint } from '@/components/dashboard/HealingToolHint';

const renderHint = (trigger = 1) =>
  render(
    <I18nProvider>
      <HealingToolHint trigger={trigger} />
    </I18nProvider>,
  );

const startNewAppSession = () => window.sessionStorage.clear();

const resetStorage = () => {
  window.localStorage.clear();
  window.sessionStorage.clear();
};

beforeAll(() => {
  setDesktopBridgeProvider({ desktop: null });
});

beforeEach(resetStorage);

afterEach(() => {
  cleanup();
  resetStorage();
});

describe.each<[KomaThemeFamily, 'dark' | 'light']>([
  ['classic', 'dark'],
  ['classic', 'light'],
  ['noir', 'dark'],
])('HealingToolHint (%s / %s)', (family, theme) => {
  beforeEach(() => {
    useThemeStore.setState({ family, theme });
  });

  it('stays hidden until the healing tool is picked', () => {
    renderHint(0);
    expect(screen.queryByRole('dialog')).toBeNull();
  });

  it('offers a reachable "don\'t show again" box', () => {
    renderHint();
    const box = screen.getByRole('checkbox', { name: "Don't show again" });
    expect((box as HTMLInputElement).checked).toBe(false);
    expect(box.closest('label')?.className).toContain('pointer-events-auto');
  });

  it('stays open while the box is ticked and stores the opt-out at once', () => {
    renderHint();
    fireEvent.click(screen.getByRole('checkbox', { name: "Don't show again" }));

    expect(screen.getByRole('dialog')).toBeDefined();
    expect(window.localStorage.getItem(TOOL_TIPS_DISMISSED_STORAGE_KEY)).toContain(
      'healing-tool-first-use',
    );
  });

  it('never returns in a new app session once opted out', () => {
    const first = renderHint();
    fireEvent.click(screen.getByRole('checkbox', { name: "Don't show again" }));
    fireEvent.click(screen.getByLabelText('Close'));
    first.unmount();

    startNewAppSession();
    renderHint();
    expect(screen.queryByRole('dialog')).toBeNull();
  });

  it('the close button alone only hides it for this session', async () => {
    const first = renderHint();
    fireEvent.click(screen.getByLabelText('Close'));
    await waitFor(() => expect(screen.queryByRole('dialog')).toBeNull());
    first.unmount();

    renderHint();
    expect(screen.queryByRole('dialog')).toBeNull();
    cleanup();

    startNewAppSession();
    renderHint();
    expect(screen.getByRole('dialog')).toBeDefined();
  });
});
