// @vitest-environment jsdom

import { fireEvent, render, screen } from '@testing-library/react';
import { beforeAll, beforeEach, describe, expect, it, vi } from 'vitest';

import { I18nProvider } from '../../i18n';
import { setDesktopBridgeProvider } from '../../lib/desktop-bridge';
import type { DiskSpaceInfo } from '../../models/types';
import { InstallAllConfirmationClassic } from './InstallAllConfirmationClassic';

const MIB = 1024 * 1024;
const diskSpace = (freeBytes: number): DiskSpaceInfo => ({
  freeBytes,
  totalBytes: 1024 * MIB,
  path: 'mock',
});

const renderDialog = (
  totalBytes: number,
  freeBytes: number,
  stageLabels?: readonly string[],
) => {
  const onConfirm = vi.fn();
  const result = render(
    <I18nProvider>
      <InstallAllConfirmationClassic
        open
        totalBytes={totalBytes}
        diskSpace={diskSpace(freeBytes)}
        stageLabels={stageLabels}
        onCancel={() => undefined}
        onConfirm={onConfirm}
      />
    </I18nProvider>,
  );
  return { ...result, onConfirm };
};

beforeAll(() => {
  setDesktopBridgeProvider({ desktop: null });
});

beforeEach(() => {
  window.localStorage.setItem('koma-studio.locale.v1', 'en');
});

describe('InstallAllConfirmationClassic disk slack', () => {
  it('blocks when the raw size fits but the slack-adjusted requirement does not', () => {
    const { onConfirm } = renderDialog(100 * MIB, 120 * MIB);

    const confirm = screen.getByRole('button', { name: 'Confirm Download' });
    expect(confirm).toBeDisabled();
    expect(screen.getByText('Required: 164 MB · Available: 120 MB')).toBeInTheDocument();

    fireEvent.click(confirm);
    expect(onConfirm).not.toHaveBeenCalled();
  });

  it('allows the download when free space covers the slack-adjusted requirement', () => {
    const { onConfirm } = renderDialog(100 * MIB, 200 * MIB);

    const confirm = screen.getByRole('button', { name: 'Confirm Download' });
    expect(confirm).toBeEnabled();
    expect(screen.queryByText(/Required: .*Available:/)).not.toBeInTheDocument();

    fireEvent.click(confirm);
    expect(onConfirm).toHaveBeenCalledTimes(1);
  });

  it('lists stages only when more than one stage is eligible', () => {
    const { unmount } = renderDialog(100 * MIB, 200 * MIB, ['Detect Text']);
    expect(screen.queryByText(/^Stages:/)).not.toBeInTheDocument();
    unmount();

    renderDialog(100 * MIB, 200 * MIB, ['Detect Text', 'Recognize Text']);
    expect(screen.getByText('Stages: Detect Text, Recognize Text')).toBeInTheDocument();
  });
});
