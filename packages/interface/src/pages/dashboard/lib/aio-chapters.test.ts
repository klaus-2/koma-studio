import { describe, expect, it } from 'vitest';

import {
  DIRECT_IMAGES_CHAPTER_ID,
  groupImagesIntoAioChapters,
} from '@/pages/dashboard/lib/aio-chapters';
import type { LoadedImage } from '@/types/dashboard.types';

const makeImage = (
  id: string,
  chapter?: { id: string; label: string },
): LoadedImage => ({
  id,
  file: new File([id], `${id}.png`, { type: 'image/png' }),
  url: `blob:${id}`,
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
  ...(chapter
    ? { chapterId: chapter.id, chapterLabel: chapter.label }
    : {}),
});

describe('groupImagesIntoAioChapters', () => {
  it('returns no groups for an empty collection', () => {
    expect(groupImagesIntoAioChapters([])).toEqual([]);
  });

  it('keeps all direct uploads in one chapter', () => {
    const groups = groupImagesIntoAioChapters([
      makeImage('a'),
      makeImage('b'),
    ]);

    expect(groups).toHaveLength(1);
    expect(groups[0]?.id).toBe(DIRECT_IMAGES_CHAPTER_ID);
    expect(groups[0]?.images.map((image) => image.id)).toEqual(['a', 'b']);
  });

  it('groups by chapter in first-appearance order', () => {
    const groups = groupImagesIntoAioChapters([
      makeImage('a1', { id: 'archive:a.cbz', label: 'a.cbz' }),
      makeImage('b1', { id: 'archive:b.cbz', label: 'b.cbz' }),
      makeImage('a2', { id: 'archive:a.cbz', label: 'a.cbz' }),
    ]);

    expect(groups.map((group) => group.label)).toEqual(['a.cbz', 'b.cbz']);
    expect(groups[0]?.images.map((image) => image.id)).toEqual(['a1', 'a2']);
    expect(groups[1]?.images.map((image) => image.id)).toEqual(['b1']);
  });

  it('keeps loose images separate from archive chapters', () => {
    const groups = groupImagesIntoAioChapters([
      makeImage('loose-1'),
      makeImage('chapter-1', { id: 'archive:x.cbz', label: 'x.cbz' }),
      makeImage('loose-2'),
    ]);

    expect(groups).toHaveLength(2);
    expect(groups[0]?.id).toBe(DIRECT_IMAGES_CHAPTER_ID);
    expect(groups[0]?.images.map((image) => image.id)).toEqual([
      'loose-1',
      'loose-2',
    ]);
    expect(groups[1]?.label).toBe('x.cbz');
  });

  it('treats a blank chapter id as a direct upload', () => {
    const groups = groupImagesIntoAioChapters([
      makeImage('a', { id: '   ', label: '   ' }),
      makeImage('b'),
    ]);

    expect(groups).toHaveLength(1);
    expect(groups[0]?.id).toBe(DIRECT_IMAGES_CHAPTER_ID);
    expect(groups[0]?.images).toHaveLength(2);
  });
});
