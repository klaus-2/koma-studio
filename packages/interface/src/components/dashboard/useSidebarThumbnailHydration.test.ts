import { describe, expect, it, vi, beforeEach } from 'vitest';

const thumbnailCalls: { url: string; id: string }[] = [];
let thumbnailResult: Promise<string>;
let thumbnailFail = false;

vi.mock('../../utils/imagePerformance', () => ({
  createThumbnailFromUrl: (srcUrl: string) => {
    thumbnailCalls.push({ url: srcUrl, id: srcUrl });
    return thumbnailFail
      ? Promise.reject(new Error('broken image'))
      : thumbnailResult;
  },
}));

const { useSidebarThumbnailHydration } = await import(
  './useSidebarThumbnailHydration'
);

import { act, renderHook } from '@testing-library/react';
import type { LoadedImage } from '../../types/dashboard.types';

const makeImage = (id: string, withUrl: boolean, withThumb = false): LoadedImage =>
  ({
    id,
    file: { kind: 'direct', name: `${id}.png` },
    url: withUrl ? `blob:${id}` : '',
    ...(withThumb ? { thumbnailUrl: `blob:thumb-${id}` } : {}),
    width: 800,
    height: 1200,
    rotation: 0,
    filters: {},
  }) as unknown as LoadedImage;

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

  it('generates thumbnails only for resident-URL images lacking one', async () => {
    const images = [
      makeImage('a', true),
      makeImage('b', true, true),
      makeImage('c', false),
    ];
    renderHook(() => useSidebarThumbnailHydration({ images, setThumbnailUrl }));
    await flush();
    expect(thumbnailCalls).toHaveLength(1);
    expect(thumbnailCalls[0]?.url).toBe('blob:a');
    await flush();
    expect(setThumbnailUrl).toHaveBeenCalledWith('a', 'blob:generated');
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
