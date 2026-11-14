// @vitest-environment jsdom
import '@testing-library/jest-dom/vitest';

import { fireEvent, render, screen } from '@testing-library/react';
import { describe, expect, it, vi } from 'vitest';

import RegionPickerOverlay, {
  regionThumbnailStyle,
} from './RegionPickerOverlay';

import type { AioTextRegion } from '../../../types/dashboard.types';

vi.mock('@/i18n', () => ({
  useI18n: () => ({
    t: (key: string) => key,
  }),
}));

const region = (
  id: string,
  bbox: [number, number, number, number],
  renderText?: string,
): AioTextRegion => ({
  id,
  bbox,
  score: 1,
  source: 'model',
  modelKey: 'detector',
  renderText,
});

describe('regionThumbnailStyle', () => {
  it('scales the full image proportionally and offsets by the bbox', () => {
    const style = regionThumbnailStyle([10, 20, 30, 40], 480, 640);

    expect(style.backgroundSize).toBe('48px 64px');
    expect(style.backgroundPosition).toBe('-1px -2px');
  });

  it('returns no background math for unknown image dimensions', () => {
    expect(regionThumbnailStyle([0, 0, 10, 10], 0, 0)).toEqual({});
    expect(regionThumbnailStyle([0, 0, 10, 10], -5, 100)).toEqual({});
  });
});

describe('RegionPickerOverlay', () => {
  const hits = [
    region('r1', [0, 0, 10, 10], 'first text'),
    region('r2', [2, 2, 10, 10]),
  ];

  it('renders one row per hit with its text snippet', () => {
    render(
      <RegionPickerOverlay
        hits={hits}
        imageWidth={100}
        imageHeight={100}
        thumbnailUrl="blob:thumb"
        onSelect={vi.fn()}
        onClose={vi.fn()}
      />,
    );

    expect(screen.getByText('first text')).toBeTruthy();
    expect(screen.getByText('r2')).toBeTruthy();
  });

  it('selects the clicked row with its region id and closes', () => {
    const onSelect = vi.fn();
    const onClose = vi.fn();
    render(
      <RegionPickerOverlay
        hits={hits}
        imageWidth={100}
        imageHeight={100}
        onSelect={onSelect}
        onClose={onClose}
      />,
    );

    fireEvent.click(screen.getByText('first text').closest('button') as HTMLButtonElement);

    expect(onSelect).toHaveBeenCalledWith('r1');
    expect(onClose).toHaveBeenCalledTimes(1);
  });

  it('closes on a backdrop click', () => {
    const onClose = vi.fn();
    const { container } = render(
      <RegionPickerOverlay
        hits={hits}
        imageWidth={100}
        imageHeight={100}
        onSelect={vi.fn()}
        onClose={onClose}
      />,
    );

    fireEvent.pointerDown(container.firstElementChild as HTMLElement);

    expect(onClose).toHaveBeenCalledTimes(1);
  });

  it('closes on Escape', () => {
    const onClose = vi.fn();
    render(
      <RegionPickerOverlay
        hits={hits}
        imageWidth={100}
        imageHeight={100}
        onSelect={vi.fn()}
        onClose={onClose}
      />,
    );

    fireEvent(window, new KeyboardEvent('keydown', { key: 'Escape' }));

    expect(onClose).toHaveBeenCalledTimes(1);
  });
});
