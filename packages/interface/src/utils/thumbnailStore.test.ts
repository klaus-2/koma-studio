import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest';

import {
  getStoredThumbnail,
  putStoredThumbnail,
  resetThumbnailStoreForTests,
  type ThumbnailStoreDirectory,
  type ThumbnailStoredFileHandle,
} from './thumbnailStore';

interface FakeDirectoryStats {
  handleCalls: string[];
  manifestWrites: number;
  removedNames: string[];
}

interface FakeDirectory {
  directory: ThumbnailStoreDirectory;
  files: Map<string, Uint8Array>;
  stats: FakeDirectoryStats;
}

const notFoundError = (name: string): DOMException =>
  new DOMException(`${name} does not exist.`, 'NotFoundError');

const createFakeDirectory = (): FakeDirectory => {
  const files = new Map<string, Uint8Array>();
  const stats: FakeDirectoryStats = {
    handleCalls: [],
    manifestWrites: 0,
    removedNames: [],
  };

  const directory: ThumbnailStoreDirectory = {
    getFileHandle: (name: string, options?: { create?: boolean }) => {
      stats.handleCalls.push(name);
      if (!files.has(name) && options?.create !== true) {
        return Promise.reject(notFoundError(name));
      }
      const handle: ThumbnailStoredFileHandle = {
        getFile: async () => {
          const bytes = files.get(name);
          if (bytes === undefined) throw notFoundError(name);
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
    removeEntry: (name: string) => {
      if (!files.has(name)) {
        return Promise.reject(notFoundError(name));
      }
      files.delete(name);
      stats.removedNames.push(name);
      return Promise.resolve();
    },
    listFileNames: async () => [...files.keys()],
  };

  return { directory, files, stats };
};

const encoder = new TextEncoder();

const requireBlob = (value: Blob | null, label: string): Blob => {
  if (value === null) throw new Error(`Expected ${label} to be stored.`);
  return value;
};

const requireBytes = (files: Map<string, Uint8Array>, name: string): Uint8Array => {
  const bytes = files.get(name);
  if (bytes === undefined) throw new Error(`Expected ${name} to exist.`);
  return bytes;
};

const makeThumbnailBlob = (content: string): Blob =>
  new Blob([content], { type: 'image/webp' });

const decodeBlob = async (blob: Blob): Promise<string> =>
  new TextDecoder().decode(await blob.arrayBuffer());

/** Resolves once the coalesced manifest flush has fully landed on "disk". */
const waitForManifestOnDisk = async (mustContain: string): Promise<void> => {
  await vi.waitFor(() => {
    expect(files.has('manifest.json')).toBe(true);
    expect(new TextDecoder().decode(requireBytes(files, 'manifest.json'))).toContain(
      mustContain,
    );
  });
};

let created: FakeDirectory;
let files: Map<string, Uint8Array>;
let stats: FakeDirectoryStats;

beforeEach(() => {
  created = createFakeDirectory();
  files = created.files;
  stats = created.stats;
  resetThumbnailStoreForTests(async () => created.directory);
});

afterEach(() => {
  resetThumbnailStoreForTests();
});

describe('thumbnailStore (OPFS cold tier)', () => {
  it('stores a thumbnail, reads it back and never flushes the manifest per read', async () => {
    await putStoredThumbnail('hash-1', makeThumbnailBlob('stored-webp-bytes'));
    await waitForManifestOnDisk('"hash-1"');
    expect(stats.manifestWrites).toBe(1);

    const stored = requireBlob(await getStoredThumbnail('hash-1'), 'hash-1');
    expect(await decodeBlob(stored)).toBe('stored-webp-bytes');

    const writesAfterPut = stats.manifestWrites;
    await getStoredThumbnail('hash-1');
    expect(stats.manifestWrites).toBe(writesAfterPut);
  });

  it('coalesces N puts into a single manifest flush and persists it across reopens', async () => {
    for (let index = 0; index < 5; index += 1) {
      await putStoredThumbnail(`hash-${index}`, makeThumbnailBlob('webp'));
    }
    expect(stats.manifestWrites).toBe(0);

    await waitForManifestOnDisk('"hash-4"');
    expect(stats.manifestWrites).toBe(1);

    resetThumbnailStoreForTests(async () => created.directory);
    const persisted = requireBlob(await getStoredThumbnail('hash-3'), 'hash-3');
    expect(await decodeBlob(persisted)).toBe('webp');
  });

  it('prunes beyond the cap on open, oldest lastUsed first, keeping read entries', async () => {
    const entries: Record<string, { file: string; size: number; lastUsed: number }> = {};
    for (let index = 1; index <= 2000; index += 1) {
      const hash = `hash-${String(index).padStart(4, '0')}`;
      entries[hash] = { file: `${hash}.webp`, size: 8, lastUsed: index };
      files.set(`${hash}.webp`, encoder.encode('webp'));
    }
    files.set('manifest.json', encoder.encode(JSON.stringify({ version: 1, entries })));

    const read = requireBlob(await getStoredThumbnail('hash-0001'), 'hash-0001');
    expect(await decodeBlob(read)).toBe('webp');

    await putStoredThumbnail('hash-new', makeThumbnailBlob('webp'));
    await waitForManifestOnDisk('"hash-new"');

    stats.removedNames.length = 0;
    stats.manifestWrites = 0;
    resetThumbnailStoreForTests(async () => created.directory);

    const reopened = requireBlob(await getStoredThumbnail('hash-0001'), 'hash-0001');
    expect(await decodeBlob(reopened)).toBe('webp');
    expect(stats.removedNames).toEqual(['hash-0002.webp']);
    expect(stats.manifestWrites).toBe(1);

    expect(await getStoredThumbnail('hash-0002')).toBeNull();
  });

  it('starts empty on first open without a manifest', async () => {
    expect(await getStoredThumbnail('hash-1')).toBeNull();

    await putStoredThumbnail('hash-1', makeThumbnailBlob('webp'));
    const stored = await getStoredThumbnail('hash-1');
    expect(stored).not.toBeNull();
  });

  it('disables the session when the directory cannot be opened', async () => {
    let openCalls = 0;
    resetThumbnailStoreForTests(async () => {
      openCalls += 1;
      throw new Error('OPFS unavailable.');
    });

    expect(await getStoredThumbnail('hash-1')).toBeNull();
    await putStoredThumbnail('hash-1', makeThumbnailBlob('webp'));

    expect(files.size).toBe(0);
    expect(await getStoredThumbnail('hash-1')).toBeNull();
    expect(openCalls).toBe(1);
  });

  it('resets to an empty usable store when the manifest is corrupt', async () => {
    files.set('manifest.json', encoder.encode('{ not json'));

    expect(await getStoredThumbnail('hash-1')).toBeNull();
    expect(
      JSON.parse(new TextDecoder().decode(requireBytes(files, 'manifest.json'))),
    ).toEqual({
      version: 1,
      entries: {},
    });

    await putStoredThumbnail('hash-1', makeThumbnailBlob('webp'));
    expect(files.has('hash-1.webp')).toBe(true);
    const stored = requireBlob(await getStoredThumbnail('hash-1'), 'hash-1');
    expect(await decodeBlob(stored)).toBe('webp');
  });

  it('resets to an empty usable store when a manifest entry is malformed', async () => {
    const malformed = JSON.stringify({
      version: 1,
      entries: { 'hash-1': { file: 'hash-1.webp' } },
    });
    files.set('manifest.json', encoder.encode(malformed));

    expect(await getStoredThumbnail('hash-1')).toBeNull();

    await putStoredThumbnail('hash-1', makeThumbnailBlob('webp'));
    const stored = requireBlob(await getStoredThumbnail('hash-1'), 'hash-1');
    expect(await decodeBlob(stored)).toBe('webp');
  });

  it('repairs a stale manifest entry whose file is missing', async () => {
    await putStoredThumbnail('hash-1', makeThumbnailBlob('webp'));
    await waitForManifestOnDisk('"hash-1"');
    files.delete('hash-1.webp');

    expect(await getStoredThumbnail('hash-1')).toBeNull();
    await vi.waitFor(() => {
      expect(
        new TextDecoder().decode(requireBytes(files, 'manifest.json')),
      ).not.toContain('"hash-1"');
    });

    await putStoredThumbnail('hash-2', makeThumbnailBlob('webp-2'));
    const stored = requireBlob(await getStoredThumbnail('hash-2'), 'hash-2');
    expect(await decodeBlob(stored)).toBe('webp-2');
  });

  it('sweeps orphan webp files the manifest does not reference on open', async () => {
    files.set('hash-1.webp', encoder.encode('webp'));
    files.set('orphan.webp', encoder.encode('orphan'));
    files.set(
      'manifest.json',
      encoder.encode(
        JSON.stringify({
          version: 1,
          entries: { 'hash-1': { file: 'hash-1.webp', size: 4, lastUsed: 1 } },
        }),
      ),
    );

    const stored = requireBlob(await getStoredThumbnail('hash-1'), 'hash-1');
    expect(await decodeBlob(stored)).toBe('webp');
    expect(files.has('manifest.json')).toBe(true);
    expect(files.has('hash-1.webp')).toBe(true);
    expect(files.has('orphan.webp')).toBe(false);
    expect(stats.removedNames).toEqual(['orphan.webp']);
  });

  it('times out a hung store and degrades to no-op operations', async () => {
    vi.useFakeTimers();
    resetThumbnailStoreForTests(
      (): Promise<ThumbnailStoreDirectory> => new Promise(() => undefined),
    );

    const pendingRead = getStoredThumbnail('hash-1');
    await vi.advanceTimersByTimeAsync(2500);
    expect(await pendingRead).toBeNull();

    const pendingWrite = putStoredThumbnail('hash-1', makeThumbnailBlob('webp'));
    await vi.advanceTimersByTimeAsync(2500);
    await pendingWrite;

    expect(files.size).toBe(0);
    vi.useRealTimers();
  });

  it('reports missing entries as a miss without touching the file', async () => {
    await putStoredThumbnail('hash-1', makeThumbnailBlob('webp'));
    const callsBefore = stats.handleCalls.length;
    expect(await getStoredThumbnail('hash-other')).toBeNull();
    expect(stats.handleCalls.length).toBe(callsBefore);
  });

  it('rewrites stored bytes when the same hash is written twice', async () => {
    await putStoredThumbnail('hash-1', makeThumbnailBlob('first'));
    await putStoredThumbnail('hash-1', makeThumbnailBlob('second'));
    await waitForManifestOnDisk('"hash-1"');

    resetThumbnailStoreForTests(async () => created.directory);
    const stored = requireBlob(await getStoredThumbnail('hash-1'), 'hash-1');
    expect(await decodeBlob(stored)).toBe('second');
    expect(requireBytes(files, 'hash-1.webp').byteLength).toBe('second'.length);
  });
});
