import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest';

import type { ArchiveChapter, ArchiveEntryMeta } from './archive-chapter-reader';
import { getOrCreateThumbnailForPage } from './getOrCreateThumbnail';
import {
  clearThumbnailCache,
  getCachedThumbnailByKey,
  getThumbnailCacheKey,
  hasCachedThumbnail,
  rememberThumbnailByKey,
  revokeLoadedImageUrls,
} from './imagePerformance';
import {
  createArchivePageFile,
  createDirectPageFile,
  type ArchivePageFile,
  type DirectPageFile,
} from './page-source';
import {
  getStoredThumbnail,
  putStoredThumbnail,
  resetThumbnailStoreForTests,
  type ThumbnailStoreDirectory,
  type ThumbnailStoredFileHandle,
} from './thumbnailStore';
import { sha256Hex } from '../pages/dashboard/utils/import-duplicates';

const encodeState = vi.hoisted(() => {
  const calls: { srcUrl: string; width: number; height: number; quality: number }[] = [];
  let mode: 'thumb' | 'src-url' = 'thumb';
  return {
    calls,
    setMode: (next: 'thumb' | 'src-url'): void => {
      mode = next;
    },
    modeOf: (): 'thumb' | 'src-url' => mode,
  };
});

vi.mock('./imagePerformance', async (importOriginal) => {
  const actual = await importOriginal<typeof import('./imagePerformance')>();
  return {
    ...actual,
    createThumbnailFromUrl: (
      srcUrl: string,
      maxWidth: number,
      maxHeight: number,
      quality: number,
    ): Promise<string> => {
      encodeState.calls.push({ srcUrl, width: maxWidth, height: maxHeight, quality });
      return Promise.resolve(
        encodeState.modeOf() === 'src-url'
          ? srcUrl
          : `blob:encoded-${encodeState.calls.length}`,
      );
    },
  };
});

interface FakeDirectoryStats {
  handleCalls: string[];
  manifestWrites: number;
}

interface FakeDirectory {
  directory: ThumbnailStoreDirectory;
  files: Map<string, Uint8Array>;
  stats: FakeDirectoryStats;
}

const createFakeDirectory = (): FakeDirectory => {
  const files = new Map<string, Uint8Array>();
  const stats: FakeDirectoryStats = { handleCalls: [], manifestWrites: 0 };

  const directory: ThumbnailStoreDirectory = {
    getFileHandle: (name: string, options?: { create?: boolean }) => {
      stats.handleCalls.push(name);
      if (!files.has(name) && options?.create !== true) {
        return Promise.reject(
          new DOMException(`${name} does not exist.`, 'NotFoundError'),
        );
      }
      const handle: ThumbnailStoredFileHandle = {
        getFile: async () => {
          const bytes = files.get(name);
          if (bytes === undefined) {
            throw new DOMException(`${name} does not exist.`, 'NotFoundError');
          }
          return new File([bytes.slice()], name);
        },
        createWritable: async () => {
          if (name === 'manifest.json') stats.manifestWrites += 1;
          const chunks: Blob[] = [];
          return {
            write: async (data: Blob) => {
              chunks.push(data);
            },
            close: async () => {
              files.set(name, new Uint8Array(await new Blob(chunks).arrayBuffer()));
            },
          };
        },
      };
      return Promise.resolve(handle);
    },
    removeEntry: async (name: string) => {
      files.delete(name);
    },
    listFileNames: async () => [...files.keys()],
  };

  return { directory, files, stats };
};

interface ThumbnailReadResponse {
  readonly ok: boolean;
  readonly blob: () => Promise<Blob>;
}

const makeThumbnailBlob = (content: string): Blob =>
  new Blob([content], { type: 'image/webp' });

const makeDirectPageFile = (content: string): DirectPageFile =>
  createDirectPageFile(new File([content], 'page.png', { type: 'image/png' }));

const makeArchivePageFile = (): ArchivePageFile => {
  const chapter: ArchiveChapter = {
    id: 'chapter-1',
    label: 'Chapter 1',
    archive: new File([], 'chapter-1.cbz'),
    entries: [],
  };
  const entry: ArchiveEntryMeta = {
    path: 'page-1.jpg',
    compressedSize: 8,
    uncompressedSize: 8,
    method: 0,
    compressedOffset: 0,
  };
  return createArchivePageFile(chapter, entry, 'page-1.jpg', 'image/jpeg');
};

const requireBlob = (value: Blob | null, label: string): Blob => {
  if (value === null) throw new Error(`Expected ${label} to be stored.`);
  return value;
};

const requireBytes = (name: string): Uint8Array => {
  const bytes = files.get(name);
  if (bytes === undefined) throw new Error(`Expected ${name} to exist.`);
  return bytes;
};

/** Resolves once the coalesced manifest flush has fully landed on "disk". */
const waitForManifestOnDisk = async (mustContain: string): Promise<void> => {
  await vi.waitFor(() => {
    expect(files.has('manifest.json')).toBe(true);
    expect(new TextDecoder().decode(requireBytes('manifest.json'))).toContain(
      mustContain,
    );
  });
};

let created: FakeDirectory;
let files: Map<string, Uint8Array>;
let stats: FakeDirectoryStats;
let objectUrlCounter = 0;

beforeEach(() => {
  created = createFakeDirectory();
  files = created.files;
  stats = created.stats;
  resetThumbnailStoreForTests(async () => created.directory);
  clearThumbnailCache();
  encodeState.calls.length = 0;
  encodeState.setMode('thumb');
  objectUrlCounter = 0;
  vi.spyOn(URL, 'createObjectURL').mockImplementation(() => {
    objectUrlCounter += 1;
    return `blob:mock-url-${objectUrlCounter}`;
  });
  vi.spyOn(URL, 'revokeObjectURL').mockImplementation(() => undefined);
});

afterEach(() => {
  resetThumbnailStoreForTests();
  clearThumbnailCache();
  vi.unstubAllGlobals();
  vi.restoreAllMocks();
});

describe('getOrCreateThumbnailForPage (content-hash tiers)', () => {
  it('returns the hot LRU entry without opening the store or encoding', async () => {
    const file = makeDirectPageFile('hot-hit-bytes');
    const hash = await sha256Hex(file.resident);
    const hotKey = `opfs:${hash}:400:600:0.7`;
    rememberThumbnailByKey(hotKey, 'blob:hot-cached');

    const result = await getOrCreateThumbnailForPage(file, 'blob:src-hot-hit');

    expect(result).toBe('blob:hot-cached');
    expect(encodeState.calls).toHaveLength(0);
    expect(stats.handleCalls).toHaveLength(0);
  });

  it('reads a stored thumbnail into the hot tier on a cold hit', async () => {
    const file = makeDirectPageFile('cold-hit-bytes');
    const hash = await sha256Hex(file.resident);
    await putStoredThumbnail(hash, makeThumbnailBlob('stored-thumb-bytes'));

    const result = await getOrCreateThumbnailForPage(file, 'blob:src-cold-hit');

    expect(result).toMatch(/^blob:mock-url-/);
    expect(encodeState.calls).toHaveLength(0);
    expect(getCachedThumbnailByKey(`opfs:${hash}:400:600:0.7`)).toBe(result);
    expect(await getStoredThumbnail(hash)).not.toBeNull();
  });

  it('encodes, stores the webp and warms the hot tier on a full miss', async () => {
    vi.stubGlobal(
      'fetch',
      async (): Promise<ThumbnailReadResponse> => ({
        ok: true,
        blob: async () => makeThumbnailBlob('encoded-webp-bytes'),
      }),
    );
    const file = makeDirectPageFile('full-miss-bytes');
    const hash = await sha256Hex(file.resident);

    const result = await getOrCreateThumbnailForPage(file, 'blob:src-full-miss');

    expect(result).toBe('blob:encoded-1');
    expect(encodeState.calls).toEqual([
      { srcUrl: 'blob:src-full-miss', width: 400, height: 600, quality: 0.7 },
    ]);
    expect(getCachedThumbnailByKey(`opfs:${hash}:400:600:0.7`)).toBe(result);

    await waitForManifestOnDisk(`"${hash}"`);
    resetThumbnailStoreForTests(async () => created.directory);
    const stored = requireBlob(await getStoredThumbnail(hash), 'encoded thumb');
    expect(new TextDecoder().decode(await stored.arrayBuffer())).toBe(
      'encoded-webp-bytes',
    );
  });

  it('returns null without storing when the encode engine early-exits with the source url', async () => {
    encodeState.setMode('src-url');
    const file = makeDirectPageFile('early-exit-bytes');
    const hash = await sha256Hex(file.resident);

    const result = await getOrCreateThumbnailForPage(file, 'blob:src-early-exit');

    expect(result).toBeNull();
    expect(getCachedThumbnailByKey(`opfs:${hash}:400:600:0.7`)).toBeUndefined();
    expect(await getStoredThumbnail(hash)).toBeNull();
    expect(stats.manifestWrites).toBe(0);
  });

  it('never hashes or stores archive pages', async () => {
    const digestSpy = vi.spyOn(crypto.subtle, 'digest');
    const file = makeArchivePageFile();

    const result = await getOrCreateThumbnailForPage(file, 'blob:src-archive');

    expect(result).toBe('blob:encoded-1');
    expect(encodeState.calls).toHaveLength(1);
    expect(digestSpy).not.toHaveBeenCalled();
    expect(stats.handleCalls).toHaveLength(0);
    expect(stats.manifestWrites).toBe(0);
  });

  it('hashes a resident file once across repeated calls', async () => {
    encodeState.setMode('src-url');
    const digestSpy = vi.spyOn(crypto.subtle, 'digest');
    const file = makeDirectPageFile('memo-bytes');

    expect(await getOrCreateThumbnailForPage(file, 'blob:src-memo')).toBeNull();
    expect(await getOrCreateThumbnailForPage(file, 'blob:src-memo')).toBeNull();

    expect(digestSpy).toHaveBeenCalledTimes(1);
  });

  it('retries hashing on the next call instead of memoizing a rejection', async () => {
    const digestSpy = vi
      .spyOn(crypto.subtle, 'digest')
      .mockRejectedValueOnce(new Error('digest unavailable.'));
    const file = makeDirectPageFile('memo-retry-bytes');

    expect(await getOrCreateThumbnailForPage(file, 'blob:src-memo-retry')).toBe(
      'blob:encoded-1',
    );
    expect(await getOrCreateThumbnailForPage(file, 'blob:src-memo-retry')).toBe(
      'blob:encoded-2',
    );

    expect(digestSpy).toHaveBeenCalledTimes(2);
  });

  it('degrades to direct encode when the store cannot be opened', async () => {
    vi.stubGlobal(
      'fetch',
      async (): Promise<ThumbnailReadResponse> => ({
        ok: true,
        blob: async () => makeThumbnailBlob('encoded-webp-bytes'),
      }),
    );
    let openCalls = 0;
    resetThumbnailStoreForTests(async () => {
      openCalls += 1;
      throw new Error('OPFS unavailable.');
    });
    const file = makeDirectPageFile('store-error-bytes');
    const hash = await sha256Hex(file.resident);

    const result = await getOrCreateThumbnailForPage(file, 'blob:src-store-error');

    expect(result).toBe('blob:encoded-1');
    expect(openCalls).toBe(1);
    expect(getCachedThumbnailByKey(`opfs:${hash}:400:600:0.7`)).toBe(result);
    expect(files.size).toBe(0);
    expect(stats.manifestWrites).toBe(0);
  });

  it('proceeds with the encode path when a store operation times out', async () => {
    encodeState.setMode('src-url');
    let openCalls = 0;
    resetThumbnailStoreForTests(async () => {
      openCalls += 1;
      throw new Error('OPFS unavailable.');
    });
    const file = makeDirectPageFile('timeout-bytes');
    expect(await getOrCreateThumbnailForPage(file, 'blob:src-timeout')).toBeNull();
    expect(openCalls).toBe(1);

    vi.useFakeTimers();
    resetThumbnailStoreForTests(
      (): Promise<ThumbnailStoreDirectory> => new Promise(() => undefined),
    );
    const pending = getOrCreateThumbnailForPage(file, 'blob:src-timeout');
    await vi.advanceTimersByTimeAsync(2500);
    expect(await pending).toBeNull();
    vi.useRealTimers();
    expect(encodeState.calls).toHaveLength(2);
  });

  it('drops both LRU keys when the loaded image URL is revoked and re-imports fresh', async () => {
    vi.stubGlobal(
      'fetch',
      async (): Promise<ThumbnailReadResponse> => ({
        ok: true,
        blob: async () => makeThumbnailBlob('encoded-webp-bytes'),
      }),
    );
    const file = makeDirectPageFile('dual-key-bytes');
    const hash = await sha256Hex(file.resident);
    const hotKey = `opfs:${hash}:400:600:0.7`;

    const thumbUrl = await getOrCreateThumbnailForPage(file, 'blob:src-dual');
    expect(thumbUrl).toBe('blob:encoded-1');
    expect(getCachedThumbnailByKey(hotKey)).toBe(thumbUrl);
    rememberThumbnailByKey(getThumbnailCacheKey('blob:src-dual'), thumbUrl ?? '');
    expect(hasCachedThumbnail('blob:src-dual')).toBe(true);

    revokeLoadedImageUrls([{ url: 'blob:src-dual', thumbnailUrl: thumbUrl ?? '' }]);

    expect(getCachedThumbnailByKey(hotKey)).toBeUndefined();
    expect(hasCachedThumbnail('blob:src-dual')).toBe(false);

    const reimported = await getOrCreateThumbnailForPage(file, 'blob:src-dual-2');
    expect(reimported).not.toBe(thumbUrl);
    expect(getCachedThumbnailByKey(hotKey)).toBe(reimported);
  });
});
