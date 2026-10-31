// @vitest-environment jsdom

import { act, renderHook } from '@testing-library/react';
import { afterEach, beforeAll, beforeEach, describe, expect, it, vi } from 'vitest';

import { I18nProvider } from '@/i18n';
import { setDesktopBridgeProvider } from '@/lib/desktop-bridge';
import { useSidebarChapterSelection } from '@/pages/dashboard/hooks/use-sidebar-chapter-selection';
import { useImageCollectionStore } from '@/pages/dashboard/stores/image-collection-store';
import { useStatusStore } from '@/pages/dashboard/stores/status-store';
import { useUiShellStore } from '@/pages/dashboard/stores/ui-shell-store';
import type { LoadedImage } from '@/types/dashboard.types';

const makeImage = (index: number): LoadedImage => ({
  id: `img-${index}`,
  file: new File([`page-${index}`], `page-${index}.png`, {
    type: 'image/png',
  }),
  url: `data:image/png;base64,AA${index}`,
  width: 40,
  height: 30,
  rotation: 0,
  filters: {
    brightness: 0,
    contrast: 0,
    saturation: 0,
    sharpen: 0,
    levels: { black: 0, white: 255, gamma: 1 },
    grayscale: false,
    inverted: false,
  },
});

const images: [LoadedImage, LoadedImage, LoadedImage] = [
  makeImage(0),
  makeImage(1),
  makeImage(2),
];

beforeAll(() => {
  setDesktopBridgeProvider({ desktop: null });
});

beforeEach(() => {
  useImageCollectionStore.setState({
    images,
    activeId: images[0]?.id ?? null,
    isExtractingUploads: false,
  });
  useUiShellStore.setState({ processing: false });
  useStatusStore.getState().setStatusMessage('');
  vi.restoreAllMocks();
});

afterEach(() => {
  vi.restoreAllMocks();
});

const renderSelection = () =>
  renderHook(() => useSidebarChapterSelection(), { wrapper: I18nProvider });

describe('useSidebarChapterSelection', () => {
  it('assigns one manual chapter to the selected images only', () => {
    const prompt = vi.spyOn(window, 'prompt').mockReturnValue('  Capitulo 1  ');
    const { result } = renderSelection();
    const untouched = useImageCollectionStore.getState().images[1];

    act(() => {
      result.current.toggleMode();
    });
    act(() => {
      result.current.toggleImage('img-0');
      result.current.toggleImage('img-2');
    });

    expect(result.current.selectedIds).toEqual(new Set(['img-0', 'img-2']));

    act(() => {
      result.current.createChapter();
    });

    const next = useImageCollectionStore.getState().images;
    expect(next[0]?.chapterId).toMatch(/^manual:/);
    expect(next[0]?.chapterLabel).toBe('Capitulo 1');
    expect(next[2]?.chapterId).toBe(next[0]?.chapterId);
    expect(next[2]?.chapterLabel).toBe('Capitulo 1');
    expect(next[1]).toBe(untouched);
    expect(next[1]?.chapterId).toBeUndefined();
    expect(result.current.active).toBe(false);
    expect(useStatusStore.getState().statusMessage).toBe(
      'Chapter "Capitulo 1" created with 2 image(s).',
    );
    expect(prompt).toHaveBeenCalledWith('Chapter name', 'Chapter 1');
  });

  it('leaves the images untouched when the prompt is cancelled', () => {
    const prompt = vi.spyOn(window, 'prompt').mockReturnValue(null);
    const { result } = renderSelection();

    act(() => {
      result.current.toggleMode();
    });
    act(() => {
      result.current.toggleImage('img-0');
    });
    act(() => {
      result.current.createChapter();
    });

    expect(prompt).toHaveBeenCalledTimes(1);
    expect(useImageCollectionStore.getState().images).toBe(images);
  });

  it('clears the chapter label from the selected images', () => {
    useImageCollectionStore.setState({
      images: [
        { ...images[0], chapterId: 'archive:a.cbz', chapterLabel: 'a.cbz' },
        images[1],
      ],
    });
    const { result } = renderSelection();

    act(() => {
      result.current.toggleMode();
    });
    act(() => {
      result.current.toggleImage('img-0');
    });
    act(() => {
      result.current.clearChapter();
    });

    const next = useImageCollectionStore.getState().images;
    expect(next[0]?.chapterId).toBeUndefined();
    expect(next[0]?.chapterLabel).toBeUndefined();
    expect(useStatusStore.getState().statusMessage).toBe(
      'Chapter cleared for 1 image(s).',
    );
  });

  it('refuses to write chapters while a run owns the shell', () => {
    useUiShellStore.setState({ processing: true });
    const prompt = vi.spyOn(window, 'prompt');
    const { result } = renderSelection();

    act(() => {
      result.current.toggleMode();
    });
    act(() => {
      result.current.toggleImage('img-0');
    });
    act(() => {
      result.current.createChapter();
    });

    expect(prompt).not.toHaveBeenCalled();
    expect(useImageCollectionStore.getState().images).toBe(images);
  });
});
