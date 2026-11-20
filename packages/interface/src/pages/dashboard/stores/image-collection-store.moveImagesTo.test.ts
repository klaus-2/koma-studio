import { beforeEach, describe, expect, it } from 'vitest';

import { useImageCollectionStore } from '@/pages/dashboard/stores/image-collection-store';
import type { LoadedImage } from '@/types/dashboard.types';
import { createDirectPageFile } from '@/utils/page-source';

const makeImage = (index: number): LoadedImage => ({
  id: `img-${index}`,
  file: createDirectPageFile(new File([`page-${index}`], `page-${index}.png`, {
    type: 'image/png',
  })),
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

const images: LoadedImage[] = [0, 1, 2, 3, 4].map(makeImage);

beforeEach(() => {
  useImageCollectionStore.setState({
    images,
    activeId: 'img-1',
    isExtractingUploads: false,
  });
});

const ids = (): (string | undefined)[] =>
  useImageCollectionStore.getState().images.map((image) => image.id);

describe('moveImagesTo', () => {
  it('moves one page to the insertion point (drag item 2 before item 4)', () => {
    useImageCollectionStore.getState().moveImagesTo([2], 4);
    expect(ids()).toEqual(['img-0', 'img-1', 'img-3', 'img-2', 'img-4']);
  });

  it('moves a group preserving its relative order (unsorted indices)', () => {
    useImageCollectionStore.getState().moveImagesTo([3, 1], 0);
    expect(ids()).toEqual(['img-1', 'img-3', 'img-0', 'img-2', 'img-4']);
  });

  it('deduplicates fromIndices', () => {
    useImageCollectionStore.getState().moveImagesTo([1, 1, 3, 3], 5);
    expect(ids()).toEqual(['img-0', 'img-2', 'img-4', 'img-1', 'img-3']);
  });

  it('clamps out-of-range toIndex and filters invalid fromIndices', () => {
    useImageCollectionStore.getState().moveImagesTo([1, 9, -2], 99);
    expect(ids()).toEqual(['img-0', 'img-2', 'img-3', 'img-4', 'img-1']);
    useImageCollectionStore.setState({ images });
    useImageCollectionStore.getState().moveImagesTo([2], -7);
    expect(ids()).toEqual(['img-2', 'img-0', 'img-1', 'img-3', 'img-4']);
  });

  it('ignores a non-integer target', () => {
    const before = useImageCollectionStore.getState().images;
    useImageCollectionStore.getState().moveImagesTo([1], Number.NaN);
    expect(useImageCollectionStore.getState().images).toBe(before);
    useImageCollectionStore.getState().moveImagesTo([1], 1.5);
    expect(useImageCollectionStore.getState().images).toBe(before);
  });

  it('is a no-op (same array identity) when the group lands on its own spot', () => {
    const before = useImageCollectionStore.getState().images;
    useImageCollectionStore.getState().moveImagesTo([1], 1);
    expect(useImageCollectionStore.getState().images).toBe(before);
    useImageCollectionStore.getState().moveImagesTo([1, 2], 2);
    expect(useImageCollectionStore.getState().images).toBe(before);
  });

  it('is a no-op when nothing valid is moved or the whole list is moved', () => {
    const before = useImageCollectionStore.getState().images;
    useImageCollectionStore.getState().moveImagesTo([], 0);
    expect(useImageCollectionStore.getState().images).toBe(before);
    useImageCollectionStore.getState().moveImagesTo([0, 1, 2, 3, 4], 3);
    expect(useImageCollectionStore.getState().images).toBe(before);
  });

  it('keeps activeId unchanged even when the active page moved', () => {
    useImageCollectionStore.getState().moveImagesTo([1], 4);
    expect(useImageCollectionStore.getState().activeId).toBe('img-1');
  });

  it('emits exactly one new images array per call (1 mutation = 1 undo snapshot)', () => {
    let emissions = 0;
    const unsubscribe = useImageCollectionStore.subscribe((state, prev) => {
      if (state.images !== prev.images) emissions += 1;
    });
    try {
      useImageCollectionStore.getState().moveImagesTo([1, 2], 4);
    } finally {
      unsubscribe();
    }
    expect(emissions).toBe(1);
  });
});
