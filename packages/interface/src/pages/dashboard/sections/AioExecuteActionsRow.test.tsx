// @vitest-environment jsdom
import '@testing-library/jest-dom/vitest';

import { fireEvent, render, screen } from '@testing-library/react';
import { beforeEach, describe, expect, it, vi } from 'vitest';

import AioExecuteActionsRow from './AioExecuteActionsRow';
import { useAioBatchPauseStore } from '../stores/aio-batch-pause-store';
import { useUiShellStore } from '../stores/ui-shell-store';

vi.mock('@/i18n', () => ({
  useI18n: () => ({
    t: (key: string) => key,
  }),
}));

describe('AioExecuteActionsRow', () => {
  beforeEach(() => {
    useAioBatchPauseStore.getState().reset();
    useUiShellStore.setState({ processing: false });
  });

  it('places pause before stop inside the execute row while a run is active', () => {
    useUiShellStore.setState({ processing: true });
    const { container } = render(
      <AioExecuteActionsRow subMode="auto" runActive onStop={() => {}} />,
    );
    const row = container.querySelector('.koma-aio-execute__row');
    expect(row).not.toBeNull();
    const pause = screen.getByRole('button', { name: 'dashboard.aio.pause' });
    const stop = screen.getByRole('button', {
      name: /dashboard.dashboardExecute.stop/,
    });
    expect(row?.contains(pause)).toBe(true);
    expect(row?.contains(stop)).toBe(true);
    expect(
      pause.compareDocumentPosition(stop) & Node.DOCUMENT_POSITION_FOLLOWING,
    ).toBeTruthy();
  });

  it('renders only the pause control when no cloud run is active', () => {
    useUiShellStore.setState({ processing: true });
    const { container } = render(
      <AioExecuteActionsRow subMode="auto" runActive={false} onStop={() => {}} />,
    );
    expect(
      screen.getByRole('button', { name: 'dashboard.aio.pause' }),
    ).toBeInTheDocument();
    expect(
      container.querySelector('.koma-aio-execute__btn--stop'),
    ).toBeNull();
  });

  it('renders only the stop control in the manual sub-mode', () => {
    useUiShellStore.setState({ processing: true });
    const { container } = render(
      <AioExecuteActionsRow subMode="manual" runActive onStop={() => {}} />,
    );
    expect(
      container.querySelector('.koma-aio-execute__btn--pause'),
    ).toBeNull();
    expect(
      screen.getByRole('button', { name: /dashboard.dashboardExecute.stop/ }),
    ).toBeInTheDocument();
  });

  it('renders an empty row when neither control applies', () => {
    const { container } = render(
      <AioExecuteActionsRow subMode="auto" runActive={false} onStop={() => {}} />,
    );
    const row = container.querySelector('.koma-aio-execute__row');
    expect(row).not.toBeNull();
    expect(row?.childElementCount).toBe(0);
  });

  it('forwards the stop click to the handler', () => {
    useUiShellStore.setState({ processing: true });
    const onStop = vi.fn();
    render(
      <AioExecuteActionsRow subMode="auto" runActive onStop={onStop} />,
    );
    fireEvent.click(
      screen.getByRole('button', { name: /dashboard.dashboardExecute.stop/ }),
    );
    expect(onStop).toHaveBeenCalledTimes(1);
  });

  it('keeps resume beside stop while the run is paused', () => {
    useUiShellStore.setState({ processing: true });
    useAioBatchPauseStore.getState().requestPause();
    useAioBatchPauseStore.getState().markPaused();
    useUiShellStore.setState({ processing: false });
    render(
      <AioExecuteActionsRow subMode="auto" runActive onStop={() => {}} />,
    );
    expect(
      screen.getByRole('button', { name: 'dashboard.aio.resume' }),
    ).toBeInTheDocument();
    expect(
      screen.getByRole('button', { name: /dashboard.dashboardExecute.stop/ }),
    ).toBeInTheDocument();
  });
});