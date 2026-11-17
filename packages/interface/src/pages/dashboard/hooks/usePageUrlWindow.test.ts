import { act, renderHook } from '@testing-library/react';
import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest';

import { DEFAULT_FILTERS } from '../../../constants/dashboard.constants';
import type { LoadedImage } from '../../../types/dashboard.types';
import { revokeLoadedImageUrls } from '../../../utils/imagePerformance';
import { createArchivePageFile, createDirectPageFile } from '../../../utils/page-source';
import type { ArchiveChapter, ArchiveEntryMeta } from '../../../utils/archive-chapter-reader';
import { useImageCollectionStore } from '../stores/image-collection-store';
import { useUiShellStore } from '../stores/ui-shell-store';
import { resolveImagePreviewSrc } from './image-collection';
import { usePageUrlWindow } from './usePageUrlWindow';

const DIRECT_PAGE_COUNT = 32;

// jsdom may lack URL.createObjectURL depending on the runtime wiring; both
// URL stubs are replaced with spies so revocations/re-creations are asserted.
const originalCreateObjectURL = URL.createObjectURL;
const originalRevokeObjectURL = URL.revokeObjectURL;

const urlState = {
  counter: 0,
  revoked: [] as string[],
};

const installUrlSpies = (): void => {
  urlState.counter = 0;
  urlState.revoked = [];
  URL.createObjectURL = vi.fn(() => {
    urlState.counter += 1;
    return `blob:recreated-${urlState.counter}`;
  });
  URL.revokeObjectURL = vi.fn((url: string) => {
    urlState.revoked.push(url);
  });
};

beforeEach(installUrlSpies);

afterEach(() => {
  URL.createObjectURL = originalCreateObjectURL;
  URL.revokeObjectURL = originalRevokeObjectURL;
  useImageCollectionStore.setState({ images: [], activeId: null });
  useUiShellStore.setState({ processing: false });
  Reflect.deleteProperty(document, 'visibilityState');
});

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

const makeDirectImage = (index: number, url?: string): LoadedImage => ({
  id: `page-${index}`,
  file: createDirectPageFile(
    new File([`bytes-${index}`], `page-${index}.png`, { type: 'image/png' }),
  ),
  url: url ?? `blob:page-${index}`,
  width: 800,
  height: 1200,
  rotation: 0,
  filters: { ...DEFAULT_FILTERS },
});

const makeArchiveImage = (index: number): LoadedImage => ({
  id: `page-${index}`,
  file: createArchivePageFile(archiveChapter, archiveEntry, `page-${index}.png`, 'image/png'),
  url: '',
  width: 0,
  height: 0,
  rotation: 0,
  filters: { ...DEFAULT_FILTERS },
});

const seedStore = (images: LoadedImage[], activeId: string | null): void => {
  useImageCollectionStore.setState({ images, activeId });
};

const storeImages = (): LoadedImage[] => useImageCollectionStore.getState().images;

const imageById = (id: string): LoadedImage => {
  const image = storeImages().find((img) => img.id === id);
  if (image === undefined) {
    throw new Error(`fixture image missing: ${id}`);
  }
  return image;
};

const urlOf = (id: string): string => imageById(id).url;

const flushEviction = async (): Promise<void> => {
  await act(async () => {
    await Promise.resolve();
    await Promise.resolve();
  });
};

interface MountControllerArgs {
  images: LoadedImage[];
  activeImageId: string | null;
}

const mountController = ({ images, activeImageId }: MountControllerArgs) =>
  renderHook((props: MountControllerArgs) => usePageUrlWindow(props), {
    initialProps: { images, activeImageId },
  });

describe('usePageUrlWindow', () => {
  it('evicts direct pages outside [start-8, end+8] and keeps the window', async () => {
    const images = Array.from({ length: DIRECT_PAGE_COUNT }, (_, index) =>
      makeDirectImage(index),
    );
    seedStore(images, 'page-10');
    const { result } = mountController({ images, activeImageId: 'page-10' });

    act(() => {
      result.current.onVisibleRangeChange({ start: 10, end: 20 });
    });
    await flushEviction();

    expect(urlOf('page-0')).toBe('');
    expect(urlOf('page-1')).toBe('');
    expect(urlOf('page-29')).toBe('');
    expect(urlOf('page-30')).toBe('');
    expect(urlOf('page-31')).toBe('');
    expect(urlOf('page-2')).toBe('blob:page-2');
    expect(urlOf('page-28')).toBe('blob:page-28');
    expect(urlState.revoked).toContain('blob:page-0');
    expect(urlState.revoked).toContain('blob:page-31');
    expect(urlState.revoked).not.toContain('blob:page-2');
    expect(urlState.revoked).not.toContain('blob:page-28');
  });

  it('never evicts the active image even far outside the window', async () => {
    const images = Array.from({ length: DIRECT_PAGE_COUNT }, (_, index) =>
      makeDirectImage(index),
    );
    seedStore(images, 'page-0');
    const { result } = mountController({ images, activeImageId: 'page-0' });

    act(() => {
      result.current.onVisibleRangeChange({ start: 10, end: 20 });
    });
    await flushEviction();

    expect(urlOf('page-0')).toBe('blob:page-0');
    expect(urlOf('page-1')).toBe('');
    expect(urlState.revoked).not.toContain('blob:page-0');
  });

  it('skips non-blob URLs without revoking them', async () => {
    const images = Array.from({ length: DIRECT_PAGE_COUNT }, (_, index) =>
      makeDirectImage(index, index === 1 ? 'https://example.com/external.png' : undefined),
    );
    seedStore(images, 'page-10');
    const { result } = mountController({ images, activeImageId: 'page-10' });

    act(() => {
      result.current.onVisibleRangeChange({ start: 10, end: 20 });
    });
    await flushEviction();

    expect(urlOf('page-1')).toBe('https://example.com/external.png');
    expect(urlState.revoked).not.toContain('https://example.com/external.png');
  });

  it('leaves archive pages untouched by eviction', async () => {
    const images = [
      makeArchiveImage(0),
      ...Array.from({ length: DIRECT_PAGE_COUNT - 1 }, (_, index) =>
        makeDirectImage(index + 1),
      ),
    ];
    seedStore(images, 'page-10');
    const { result } = mountController({ images, activeImageId: 'page-10' });

    act(() => {
      result.current.onVisibleRangeChange({ start: 10, end: 20 });
    });
    await flushEviction();

    expect(urlOf('page-0')).toBe('');
    expect(urlState.revoked).not.toContain('');
  });

  it('skips already-evicted pages without a second revoke', async () => {
    const images = Array.from({ length: DIRECT_PAGE_COUNT }, (_, index) =>
      makeDirectImage(index, index === 0 ? '' : undefined),
    );
    seedStore(images, 'page-10');
    const { result } = mountController({ images, activeImageId: 'page-10' });

    act(() => {
      result.current.onVisibleRangeChange({ start: 10, end: 20 });
    });
    await flushEviction();

    expect(urlOf('page-0')).toBe('');
    expect(urlState.revoked).not.toContain('');
    expect(urlOf('page-31')).toBe('');
  });

  it('does not evict while processing', async () => {
    const images = Array.from({ length: DIRECT_PAGE_COUNT }, (_, index) =>
      makeDirectImage(index),
    );
    seedStore(images, 'page-10');
    useUiShellStore.setState({ processing: true });
    const { result } = mountController({ images, activeImageId: 'page-10' });

    act(() => {
      result.current.onVisibleRangeChange({ start: 10, end: 20 });
    });
    await flushEviction();

    expect(urlOf('page-0')).toBe('blob:page-0');
    expect(urlOf('page-31')).toBe('blob:page-31');
    expect(urlState.revoked).toHaveLength(0);
  });

  it('does not evict while the document is hidden', async () => {
    const images = Array.from({ length: DIRECT_PAGE_COUNT }, (_, index) =>
      makeDirectImage(index),
    );
    seedStore(images, 'page-10');
    Object.defineProperty(document, 'visibilityState', {
      configurable: true,
      value: 'hidden',
    });
    const { result } = mountController({ images, activeImageId: 'page-10' });

    act(() => {
      result.current.onVisibleRangeChange({ start: 10, end: 20 });
    });
    await flushEviction();

    expect(urlOf('page-0')).toBe('blob:page-0');
    expect(urlOf('page-31')).toBe('blob:page-31');
    expect(urlState.revoked).toHaveLength(0);
  });

  it('does not evict after unmount', async () => {
    const images = Array.from({ length: DIRECT_PAGE_COUNT }, (_, index) =>
      makeDirectImage(index),
    );
    seedStore(images, 'page-10');
    const { result, unmount } = mountController({ images, activeImageId: 'page-10' });
    unmount();

    act(() => {
      result.current.onVisibleRangeChange({ start: 10, end: 20 });
    });
    await flushEviction();

    expect(urlOf('page-0')).toBe('blob:page-0');
    expect(urlState.revoked).toHaveLength(0);
  });

  it('re-creates an evicted page URL once on selector re-entry', async () => {
    const images = Array.from({ length: DIRECT_PAGE_COUNT }, (_, index) =>
      makeDirectImage(index),
    );
    seedStore(images, 'page-10');
    const { result } = mountController({ images, activeImageId: 'page-10' });
    act(() => {
      result.current.onVisibleRangeChange({ start: 10, end: 20 });
    });
    await flushEviction();
    expect(urlOf('page-0')).toBe('');

    const first = resolveImagePreviewSrc(imageById('page-0'), 'raw');
    expect(first).toBe('blob:recreated-1');
    expect(urlOf('page-0')).toBe('blob:recreated-1');

    const second = resolveImagePreviewSrc(imageById('page-0'), 'raw');
    expect(second).toBe(first);
    expect(URL.createObjectURL).toHaveBeenCalledTimes(1);
  });

  it('reuses the store-filled URL for a stale snapshot instead of creating twice', () => {
    const images = [makeDirectImage(0, '')];
    seedStore(images, 'page-0');
    const staleSnapshot = imageById('page-0');

    const first = resolveImagePreviewSrc(staleSnapshot, 'raw');
    const second = resolveImagePreviewSrc(staleSnapshot, 'raw');

    expect(first).toBe('blob:recreated-1');
    expect(second).toBe(first);
    expect(URL.createObjectURL).toHaveBeenCalledTimes(1);
  });

  it('clears an aliased thumbnailUrl together with the evicted URL', async () => {
    const images = Array.from({ length: DIRECT_PAGE_COUNT }, (_, index) => {
      const image = makeDirectImage(index);
      return index < 2 ? { ...image, thumbnailUrl: image.url } : image;
    });
    seedStore(images, 'page-10');
    const { result } = mountController({ images, activeImageId: 'page-10' });

    act(() => {
      result.current.onVisibleRangeChange({ start: 10, end: 20 });
    });
    await flushEviction();

    const evicted = imageById('page-0');
    expect(evicted.url).toBe('');
    expect(evicted).not.toHaveProperty('thumbnailUrl');
    expect(urlState.revoked).toContain('blob:page-0');
  });

  it('keeps an independent thumbnailUrl when evicting the page URL', async () => {
    const images = Array.from({ length: DIRECT_PAGE_COUNT }, (_, index) => {
      const image = makeDirectImage(index);
      return index < 2 ? { ...image, thumbnailUrl: `blob:thumb-${index}` } : image;
    });
    seedStore(images, 'page-10');
    const { result } = mountController({ images, activeImageId: 'page-10' });

    act(() => {
      result.current.onVisibleRangeChange({ start: 10, end: 20 });
    });
    await flushEviction();

    const evicted = imageById('page-0');
    expect(evicted.url).toBe('');
    expect(evicted.thumbnailUrl).toBe('blob:thumb-0');
    expect(urlState.revoked).toContain('blob:page-0');
    expect(urlState.revoked).not.toContain('blob:thumb-0');
  });

  it('returns the empty archive URL from the selector without re-creating', () => {
    const archive = makeArchiveImage(0);
    seedStore([archive], 'page-0');

    const src = resolveImagePreviewSrc(imageById('page-0'), 'raw');

    expect(src).toBe('');
    expect(URL.createObjectURL).not.toHaveBeenCalled();
  });

  it('revokeLoadedImageUrls no-ops on an evicted image', async () => {
    const images = Array.from({ length: DIRECT_PAGE_COUNT }, (_, index) =>
      makeDirectImage(index),
    );
    seedStore(images, 'page-10');
    const { result } = mountController({ images, activeImageId: 'page-10' });
    act(() => {
      result.current.onVisibleRangeChange({ start: 10, end: 20 });
    });
    await flushEviction();
    const revokeCount = urlState.revoked.length;

    expect(() => revokeLoadedImageUrls([imageById('page-0')])).not.toThrow();
    expect(urlState.revoked).toHaveLength(revokeCount);
  });
});
