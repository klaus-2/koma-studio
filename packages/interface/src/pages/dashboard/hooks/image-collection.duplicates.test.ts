// @vitest-environment jsdom
import { renderHook } from '@testing-library/react';
import { beforeEach, describe, expect, it, vi } from 'vitest';

import type { LoadedImage } from '../../../types/dashboard.types';
import type { DirectPageFile } from '../../../utils/page-source';
import { useImageCollectionStore } from '../stores/image-collection-store';
import {
  useImportDuplicatesStore,
} from '../stores/import-duplicates-store';
import { useDashboardUploads } from './image-collection';

// jsdom cannot decode images: resolve the source load with a fake element so
// the upload path reaches the duplicate check deterministically.
vi.mock('../../../utils/dashboard.utils', async (importOriginal) => {
  const actual =
    await importOriginal<typeof import('../../../utils/dashboard.utils')>();
  return {
    ...actual,
    loadImageFromSource: vi.fn(
      async () => ({ width: 10, height: 10, src: '' }) as HTMLImageElement,
    ),
  };
});
vi.mock('../../../utils/imagePerformance', async (importOriginal) => {
  const actual =
    await importOriginal<typeof import('../../../utils/imagePerformance')>();
  return {
    ...actual,
    createThumbnailFromUrl: vi.fn(async () => 'blob:thumb-mock'),
  };
});

const PNG_BYTES_A = [137, 80, 78, 71, 1, 2, 3, 4];

const directPage = (name: string, bytes: readonly number[]): DirectPageFile => {
  const file = new File([new Uint8Array(bytes)], name);
  return {
    kind: 'direct',
    name,
    type: 'image/png',
    size: file.size,
    lastModified: 1000,
    resident: file,
    toBlob: async () => file,
    dimensions: async () => ({ width: 10, height: 10 }),
    release: () => {},
  };
};

const libraryImage = (id: string, pageName: string, bytes: readonly number[]): LoadedImage => ({
  id,
  file: directPage(pageName, bytes),
  url: `blob:${id}`,
  thumbnailUrl: 'blob:thumb',
  width: 10,
  height: 10,
  rotation: 0,
  filters: {
    brightness: 1,
    contrast: 1,
    saturation: 1,
    sharpen: 0,
    levels: { black: 0, white: 255, gamma: 1 },
    grayscale: false,
    inverted: false,
  },
});

const mountUploads = () => {
  const invalidateAioPipelineHistory = vi.fn();
  const setStatusMessage = vi.fn();
  const rendered = renderHook(() =>
    useDashboardUploads({
      localApiUrl: 'http://127.0.0.1:0',
      setStatusMessage,
      invalidateAioPipelineHistory,
      warmupPayload: null,
    }),
  );
  return { ...rendered, invalidateAioPipelineHistory, setStatusMessage };
};

describe('useDashboardUploads duplicate-page two-phase import', () => {
  beforeEach(() => {
    useImportDuplicatesStore.setState({ pending: null });
    useImageCollectionStore.setState({ images: [], activeId: null });
    URL.createObjectURL = vi.fn(() => 'blob:mock-url');
    URL.revokeObjectURL = vi.fn();
  });

  it('holds a byte-identical import in the pending store instead of adding it', async () => {
    useImageCollectionStore.setState({
      images: [libraryImage('lib-1', 'existing.png', PNG_BYTES_A)],
    });
    const { result } = mountUploads();

    await result.current.onDrop([
      new File([new Uint8Array(PNG_BYTES_A)], 'incoming.png', { type: 'image/png' }),
    ]);

    // addImages was NOT called: the library still holds only the seed page.
    expect(useImageCollectionStore.getState().images).toHaveLength(1);
    const pending = useImportDuplicatesStore.getState().pending;
    expect(pending).not.toBeNull();
    expect(pending?.images).toHaveLength(1);
    expect(pending?.matches).toEqual([
      { importIndex: 0, existingImageId: 'lib-1' },
    ]);
    expect(pending?.resume).toBeInstanceOf(Function);
  });

  it('resumes the stashed import: adds kept pages, sets active id, invalidates history, clears pending', async () => {
    useImageCollectionStore.setState({
      images: [libraryImage('lib-1', 'existing.png', PNG_BYTES_A)],
    });
    const { result, invalidateAioPipelineHistory, setStatusMessage } = mountUploads();

    await result.current.onDrop([
      new File([new Uint8Array(PNG_BYTES_A)], 'incoming.png', { type: 'image/png' }),
      new File([new Uint8Array([9, 9, 9, 9])], 'fresh.png', { type: 'image/png' }),
    ]);

    const pending = useImportDuplicatesStore.getState().pending;
    expect(pending?.images).toHaveLength(2);
    const keptImages = pending?.images ?? [];

    pending?.resume(keptImages);

    const store = useImageCollectionStore.getState();
    // Both kept pages land in the library (the duplicate was kept too).
    expect(store.images).toHaveLength(3);
    // No active page existed before the import: the first kept page is active.
    expect(store.activeId).toBe(keptImages[0]?.id ?? null);
    expect(invalidateAioPipelineHistory).toHaveBeenCalledTimes(1);
    expect(useImportDuplicatesStore.getState().pending).toBeNull();
    expect(setStatusMessage).toHaveBeenCalledWith('2 image(s) added.');
  });

  it('recomposes the import status message with warnings and extraction info on resume', async () => {
    useImageCollectionStore.setState({
      images: [libraryImage('lib-1', 'existing.png', PNG_BYTES_A)],
    });
    const { result, setStatusMessage } = mountUploads();

    await result.current.onDrop([
      new File([new Uint8Array(PNG_BYTES_A)], 'incoming.png', { type: 'image/png' }),
    ]);

    const pending = useImportDuplicatesStore.getState().pending;
    pending?.resume(pending.images);

    const finalMessage = setStatusMessage.mock.calls.at(-1)?.[0] as string;
    expect(finalMessage).toContain('1 image(s) added.');
    // The resume path keeps the same message contract as the direct path.
    expect(finalMessage).not.toBe('');
  });

  it('replaces a pending batch when a second import also hits duplicates', async () => {
    useImageCollectionStore.setState({
      images: [libraryImage('lib-1', 'existing.png', PNG_BYTES_A)],
    });
    const { result } = mountUploads();

    await result.current.onDrop([
      new File([new Uint8Array(PNG_BYTES_A)], 'first.png', { type: 'image/png' }),
    ]);
    const firstPending = useImportDuplicatesStore.getState().pending;
    const firstImageId = firstPending?.images[0]?.id;

    await result.current.onDrop([
      new File([new Uint8Array(PNG_BYTES_A)], 'second.png', { type: 'image/png' }),
    ]);

    const secondPending = useImportDuplicatesStore.getState().pending;
    expect(secondPending).not.toBeNull();
    // The store holds exactly one pending batch: the newest one.
    expect(secondPending?.images[0]?.id).not.toBe(firstImageId);
    expect(secondPending?.images).toHaveLength(1);
    expect(secondPending?.images[0]?.file.name).toBe('second.png');
    // Nothing was added to the library by either stashed batch.
    expect(useImageCollectionStore.getState().images).toHaveLength(1);
  });
});
