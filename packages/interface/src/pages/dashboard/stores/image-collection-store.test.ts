import { beforeEach, describe, expect, it } from 'vitest';

import { useImageCollectionStore } from '@/pages/dashboard/stores/image-collection-store';
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

beforeEach(() => {
  useImageCollectionStore.setState({
    images,
    activeId: images[0].id,
    isExtractingUploads: false,
  });
});

describe('assignChapterToImages', () => {
  it('writes one chapter to the selected images and keeps the others untouched', () => {
    const untouched = useImageCollectionStore.getState().images[1];

    useImageCollectionStore.getState().assignChapterToImages(
      ['img-0', 'img-2'],
      { id: 'manual:abc', label: 'Capítulo 1' },
    );

    const next = useImageCollectionStore.getState().images;
    expect(next[0]).toMatchObject({
      chapterId: 'manual:abc',
      chapterLabel: 'Capítulo 1',
    });
    expect(next[2]).toMatchObject({
      chapterId: 'manual:abc',
      chapterLabel: 'Capítulo 1',
    });
    expect(next[1]).toBe(untouched);
    expect(next[1]?.chapterId).toBeUndefined();
  });

  it('clears the chapter from the selected images', () => {
    useImageCollectionStore.getState().assignChapterToImages(
      ['img-0'],
      { id: 'manual:abc', label: 'Capítulo 1' },
    );

    useImageCollectionStore.getState().assignChapterToImages(['img-0'], null);

    const next = useImageCollectionStore.getState().images;
    expect(next[0]).not.toHaveProperty('chapterId');
    expect(next[0]).not.toHaveProperty('chapterLabel');
  });

  it('keeps the same array when nothing changes', () => {
    const before = useImageCollectionStore.getState().images;

    useImageCollectionStore.getState().assignChapterToImages(['img-1'], null);

    expect(useImageCollectionStore.getState().images).toBe(before);
  });
});

describe('chapter rename and removal', () => {
  const chapteredImages = (): [LoadedImage, LoadedImage, LoadedImage] => [
    { ...images[0], chapterId: 'archive:a.cbz', chapterLabel: 'a.cbz' },
    { ...images[1], chapterId: 'archive:a.cbz', chapterLabel: 'a.cbz' },
    images[2],
  ];

  beforeEach(() => {
    useImageCollectionStore.setState({ images: chapteredImages() });
  });

  it('renames only the images of that chapter', () => {
    const untouched = useImageCollectionStore.getState().images[2];

    useImageCollectionStore.getState().renameChapter('archive:a.cbz', 'Cover');

    const next = useImageCollectionStore.getState().images;
    expect(next[0]?.chapterId).toBe('archive:a.cbz');
    expect(next[0]?.chapterLabel).toBe('Cover');
    expect(next[1]?.chapterLabel).toBe('Cover');
    expect(next[2]).toBe(untouched);
  });

  it('removes only that chapter from its images', () => {
    const untouched = useImageCollectionStore.getState().images[2];

    useImageCollectionStore.getState().clearChapter('archive:a.cbz');

    const next = useImageCollectionStore.getState().images;
    expect(next[0]).not.toHaveProperty('chapterId');
    expect(next[1]).not.toHaveProperty('chapterLabel');
    expect(next[2]).toBe(untouched);
  });

  it('ignores an empty rename', () => {
    const before = useImageCollectionStore.getState().images;

    useImageCollectionStore.getState().renameChapter('archive:a.cbz', '   ');

    expect(useImageCollectionStore.getState().images).toBe(before);
  });
});
