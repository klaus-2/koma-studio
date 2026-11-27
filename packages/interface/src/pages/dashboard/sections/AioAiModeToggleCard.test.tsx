// @vitest-environment jsdom
import '@testing-library/jest-dom/vitest';

import { fireEvent, render, screen } from '@testing-library/react';
import { describe, expect, it, vi } from 'vitest';

import AioAiModeToggleCard from './AioAiModeToggleCard';

vi.mock('@/i18n', () => ({
  useI18n: () => ({
    t: (key: string) => key,
  }),
}));

describe('AioAiModeToggleCard', () => {
  it('renders an unchecked switch with the off hint when disabled', () => {
    const onToggle = vi.fn();
    render(
      <AioAiModeToggleCard
        enabled={false}
        executionMode="direct"
        noir={false}
        onToggle={onToggle}
      />,
    );

    const toggle = screen.getByRole('switch', {
      name: 'dashboard.aio.ai.toggleLabel',
    });
    expect(toggle).toHaveAttribute('aria-checked', 'false');
    expect(
      screen.getByText('dashboard.aio.ai.toggleHintOff'),
    ).toBeInTheDocument();

    fireEvent.click(toggle);
    expect(onToggle).toHaveBeenCalledTimes(1);
  });

  it('shows strategy-specific hints when active', () => {
    const { rerender } = render(
      <AioAiModeToggleCard
        enabled
        executionMode="direct"
        noir={false}
        onToggle={() => {}}
      />,
    );

    expect(screen.getByRole('switch')).toHaveAttribute('aria-checked', 'true');
    expect(
      screen.getByText('dashboard.aio.ai.toggleHintDirect'),
    ).toBeInTheDocument();

    rerender(
      <AioAiModeToggleCard
        enabled
        executionMode="hybrid_guided"
        noir
        onToggle={() => {}}
      />,
    );
    expect(
      screen.getByText('dashboard.aio.ai.toggleHintHybrid'),
    ).toBeInTheDocument();

    rerender(
      <AioAiModeToggleCard
        enabled
        executionMode="script_guided"
        noir
        onToggle={() => {}}
      />,
    );
    expect(
      screen.getByText('dashboard.aio.ai.toggleHintScript'),
    ).toBeInTheDocument();
  });

  it('blocks clicks when disabled during processing', () => {
    const onToggle = vi.fn();
    render(
      <AioAiModeToggleCard
        enabled={false}
        executionMode="direct"
        disabled
        noir={false}
        onToggle={onToggle}
      />,
    );

    const toggle = screen.getByRole('switch');
    expect(toggle).toBeDisabled();
    fireEvent.click(toggle);
    expect(onToggle).not.toHaveBeenCalled();
  });
});
