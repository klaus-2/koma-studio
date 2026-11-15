// @vitest-environment jsdom
import '@testing-library/jest-dom/vitest';

import { fireEvent, render, screen } from '@testing-library/react';
import { beforeEach, describe, expect, it, vi } from 'vitest';

import AioBatchPauseButton from './AioBatchPauseButton';
import { useAioBatchPauseStore } from '../stores/aio-batch-pause-store';
import { useUiShellStore } from '../stores/ui-shell-store';

vi.mock('@/i18n', () => ({
  useI18n: () => ({
    t: (key: string) => key,
  }),
}));

describe('AioBatchPauseButton', () => {
  beforeEach(() => {
    useAioBatchPauseStore.getState().reset();
    useUiShellStore.setState({ processing: false });
  });

  it('renders nothing when the shell is idle', () => {
    const { container } = render(
      <AioBatchPauseButton subMode="auto" />,
    );
    expect(container.querySelector('button')).toBeNull();
  });

  it('renders nothing in the manual sub-mode even while processing', () => {
    useUiShellStore.setState({ processing: true });
    const { container } = render(
      <AioBatchPauseButton subMode="manual" />,
    );
    expect(container.querySelector('button')).toBeNull();
  });

  it('offers Pause while running; idle phase shows no paused hint', () => {
    useUiShellStore.setState({ processing: true });
    render(<AioBatchPauseButton subMode="auto" />);
    const button = screen.getByRole('button', { name: 'dashboard.aio.pause' });
    expect(button).not.toHaveAttribute('title');
  });

  it('draining phase shows the finishing copy and disables re-request', () => {
    useUiShellStore.setState({ processing: true });
    render(<AioBatchPauseButton subMode="auto" />);
    const button = screen.getByRole('button', { name: 'dashboard.aio.pause' });
    fireEvent.click(button);
    const draining = screen.getByRole('button', {
      name: 'dashboard.aio.pauseFinishingChunk',
    });
    expect(draining).toHaveAttribute('title', 'dashboard.aio.pauseFinishingChunk');
    expect(draining).toBeDisabled();
  });

  it('stays mounted as Resume while paused with processing released', () => {
    useUiShellStore.setState({ processing: true });
    useAioBatchPauseStore.getState().requestPause();
    useAioBatchPauseStore.getState().markPaused();
    useUiShellStore.setState({ processing: false });
    render(<AioBatchPauseButton subMode="auto" />);
    const resume = screen.getByRole('button', { name: 'dashboard.aio.resume' });
    fireEvent.click(resume);
    expect(useAioBatchPauseStore.getState().isPaused).toBe(false);
    expect(useAioBatchPauseStore.getState().pausePhase).toBe('idle');
  });
});
