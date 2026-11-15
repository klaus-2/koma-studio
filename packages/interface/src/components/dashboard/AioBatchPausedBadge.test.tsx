// @vitest-environment jsdom
import '@testing-library/jest-dom/vitest';

import { render, screen } from '@testing-library/react';
import { beforeEach, describe, expect, it, vi } from 'vitest';

import AioBatchPausedBadge from './AioBatchPausedBadge';
import { useAioBatchPauseStore } from '../../pages/dashboard/stores/aio-batch-pause-store';

vi.mock('@/i18n', () => ({
  useI18n: () => ({
    t: (key: string) => key,
  }),
}));

describe('AioBatchPausedBadge', () => {
  beforeEach(() => {
    useAioBatchPauseStore.getState().reset();
  });

  it('renders nothing while no run is held', () => {
    const { container } = render(<AioBatchPausedBadge />);
    expect(container.querySelector('span')).toBeNull();
  });

  it('renders the paused copy with the className passthrough while held', () => {
    useAioBatchPauseStore.setState({ isPaused: true });
    render(<AioBatchPausedBadge className="koma-footerbar__meta" />);
    const badge = screen.getByText('dashboard.footer.batch.paused');
    expect(badge).toHaveClass('koma-footerbar__meta');
  });
});
