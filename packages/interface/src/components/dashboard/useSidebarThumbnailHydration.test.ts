import { describe, expect, it, vi, beforeEach } from 'vitest';

const thumbnailCalls: { url: string; id: string }[] = [];
let thumbnailResult: Promise<string>;
let thumbnailFail = false;

import type { PageFile } from '../../utils/page-source';

vi.mock('../../utils/getOrCreateThumbnail', () => ({
  getOrCreateThumbnailForPage: (_file: PageFile, srcUrl: string) => {
    thumbnailCalls.push({ url: srcUrl, id: srcUrl });
    return thumbnailFail ? Promise.resolve(null) : thumbnailResult;
  },
}));

const { useSidebarThumbnailHydration } = await import(
  './useSidebarThumbnailHydration'
);

import { act, renderHook } from '@testing-library/react';
import { DEFAULT_FILTERS } from '../../constants/dashboard.constants';
import type { LoadedImage } from '../../types/dashboard.types';
import type { ArchiveChapter, ArchiveEntryMeta } from '../../utils/archive-chapter-reader';
import { createArchivePageFile, createDirectPageFile } from '../../utils/page-source';

const archiveEntry: ArchiveEntryMeta = {
  path: 'page-arch.png',
  compressedSize: 10,
  uncompressedSize: 10,
  method: 0,
  compressedOffset: 0,
};

const archiveChapter: ArchiveChapter = {
  id: 'chapter-1',
  label: 'Chapter 1',
  archive: new File([], 'chapter-1.cbz', { type: 'application/zip' }),
  entries: [archiveEntry],
};

const makeImage = (id: string, withUrl: boolean, withThumb = false): LoadedImage => ({
  id,
  file: createDirectPageFile(new File([id], `${id}.png`, { type: 'image/png' })),
  url: withUrl ? `blob:${id}` : '',
  ...(withThumb ? { thumbnailUrl: `blob:thumb-${id}` } : {}),
  width: 800,
  height: 1200,
  rotation: 0,
  filters: { ...DEFAULT_FILTERS },
});

const makeArchiveImage = (id: string): LoadedImage => ({
  id,
  file: createArchivePageFile(archiveChapter, archiveEntry, `${id}.png`, 'image/png'),
  url: '',
  width: 0,
  height: 0,
  rotation: 0,
  filters: { ...DEFAULT_FILTERS },
});

// jsdom may lack URL.createObjectURL depending on the runtime wiring; the
// hydration pump re-creates evicted direct-page URLs through it.
if (typeof URL.createObjectURL !== 'function') {
  URL.createObjectURL = (): string => '';
}

const flush = async (): Promise<void> => {
  await Promise.resolve();
  await Promise.resolve();
  await act(async () => {
    await Promise.resolve();
  });
};

describe('useSidebarThumbnailHydration (T12 contract)', () => {
  const setThumbnailUrl = vi.fn();

  beforeEach(() => {
    thumbnailCalls.length = 0;
    thumbnailFail = false;
    thumbnailResult = Promise.resolve('blob:generated');
    setThumbnailUrl.mockClear();
  });

  it('generates thumbnails for live-URL images and re-creates evicted direct URLs', async () => {
    const createObjectURL = vi
      .spyOn(URL, 'createObjectURL')
      .mockReturnValue('blob:recreated-c');
    const images = [
      makeImage('a', true),
      makeImage('b', true, true),
      makeImage('c', false),
    ];
    renderHook(() => useSidebarThumbnailHydration({ images, setThumbnailUrl }));
    await flush();
    expect(thumbnailCalls).toHaveLength(2);
    expect(thumbnailCalls[0]?.url).toBe('blob:a');
    expect(thumbnailCalls[1]?.url).toBe('blob:recreated-c');
    expect(createObjectURL).toHaveBeenCalledTimes(1);
    await flush();
    expect(setThumbnailUrl).toHaveBeenCalledWith('a', 'blob:generated');
    expect(setThumbnailUrl).toHaveBeenCalledWith('c', 'blob:generated');
    createObjectURL.mockRestore();
  });

  it('skips archive pages without URLs', async () => {
    const images = [makeImage('live', true), makeArchiveImage('arch')];
    renderHook(() => useSidebarThumbnailHydration({ images, setThumbnailUrl }));
    await flush();
    expect(thumbnailCalls).toHaveLength(1);
    expect(thumbnailCalls[0]?.url).toBe('blob:live');
  });

  it('dedupes the queue across re-renders with fresh array identities', async () => {
    const images = [makeImage('dedupe-1', true), makeImage('dedupe-2', true)];
    const initialProps = { images, setThumbnailUrl };
    const { rerender } = renderHook(
      (props: typeof initialProps) => useSidebarThumbnailHydration(props),
      { initialProps },
    );
    rerender({ images: [...images], setThumbnailUrl });
    rerender({ images: [...images], setThumbnailUrl });
    await flush();
    expect(thumbnailCalls).toHaveLength(2);
  });

  it('caps failed generations at 2 attempts per image', async () => {
    thumbnailFail = true;
    const initialProps = {
      images: [makeImage('fail-1', true)],
      setThumbnailUrl,
    };
    const { rerender } = renderHook(
      (props: typeof initialProps) => useSidebarThumbnailHydration(props),
      { initialProps },
    );
    await flush();
    rerender({ images: [...initialProps.images], setThumbnailUrl });
    await flush();
    rerender({ images: [...initialProps.images], setThumbnailUrl });
    await flush();
    const attempts = thumbnailCalls.filter((c) => c.url === 'blob:fail-1').length;
    expect(attempts).toBe(2);
    expect(setThumbnailUrl).not.toHaveBeenCalled();
  });
});
