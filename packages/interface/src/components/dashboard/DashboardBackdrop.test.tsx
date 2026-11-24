import { act, render } from '@testing-library/react';
import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest';

import { useThemeStore } from '@koma/ui/stores/theme-store';
import { DEFAULT_FILTERS } from '@/constants/dashboard.constants';
import { useBackdropVideoStore } from '@/pages/dashboard/stores/backdrop-video-store';
import { useImageCollectionStore } from '@/pages/dashboard/stores/image-collection-store';
import type { LoadedImage } from '@/types/dashboard.types';
import { createDirectPageFile } from '@/utils/page-source';
import DashboardBackdrop from './DashboardBackdrop';

const loadedPage: LoadedImage = {
  id: 'img-1',
  file: createDirectPageFile(new File([], 'page-1.png', { type: 'image/png' })),
  url: 'blob:page-1',
  width: 800,
  height: 1200,
  rotation: 0,
  filters: DEFAULT_FILTERS,
};

describe('DashboardBackdrop', () => {
  let play: ReturnType<typeof vi.spyOn>;
  let pause: ReturnType<typeof vi.spyOn>;

  beforeEach(() => {
    play = vi.spyOn(HTMLMediaElement.prototype, 'play').mockResolvedValue(undefined);
    pause = vi.spyOn(HTMLMediaElement.prototype, 'pause').mockImplementation(() => undefined);
    useThemeStore.setState({ family: 'noir' });
    useImageCollectionStore.setState({ images: [] });
    useBackdropVideoStore.setState({ alwaysPaused: false });
  });

  afterEach(() => {
    vi.restoreAllMocks();
    useImageCollectionStore.setState({ images: [] });
    useBackdropVideoStore.setState({ alwaysPaused: false });
  });

  it('plays the background video while no pages are loaded', () => {
    render(<DashboardBackdrop />);
    expect(play).toHaveBeenCalledTimes(1);
    expect(pause).not.toHaveBeenCalled();
  });

  it('pauses when pages load and resumes when the collection empties', () => {
    render(<DashboardBackdrop />);
    play.mockClear();

    act(() => useImageCollectionStore.setState({ images: [loadedPage] }));
    expect(pause).toHaveBeenCalledTimes(1);
    expect(play).not.toHaveBeenCalled();

    act(() => useImageCollectionStore.setState({ images: [] }));
    expect(play).toHaveBeenCalledTimes(1);
  });

  it('keeps the video paused without pages when the always-pause setting is on', () => {
    useBackdropVideoStore.setState({ alwaysPaused: true });
    render(<DashboardBackdrop />);
    expect(pause).toHaveBeenCalledTimes(1);
    expect(play).not.toHaveBeenCalled();

    act(() => useBackdropVideoStore.setState({ alwaysPaused: false }));
    expect(play).toHaveBeenCalledTimes(1);
  });

  it('renders no video outside the noir family', () => {
    useThemeStore.setState({ family: 'classic' });
    const { container } = render(<DashboardBackdrop />);
    expect(container.querySelector('video')).toBeNull();
  });
});
