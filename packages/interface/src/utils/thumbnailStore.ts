/**
 * OPFS-backed cold tier for content-hash keyed WebP thumbnails.
 *
 * Layout: navigator.storage.getDirectory() → `thumbnails/` → one WebP file per
 * hash (`<hash>.webp`) plus one `manifest.json`. OPFS has no LRU, so the
 * manifest IS the eviction policy: loaded once on open, held in memory, pruned
 * on open (cap MAX_MANIFEST_ENTRIES, oldest lastUsed first) and flushed
 * coalesced (write bursts, lastUsed bumps, repairs) — never synchronously per
 * read. Losing some lastUsed precision on a crash is harmless: worst case a
 * slightly wrong eviction order.
 *
 * Every storage operation is bounded by OPERATION_TIMEOUT_MS so import and
 * restore never stall on storage. Open failures and hung operations disable
 * the store for the session: every operation becomes a no-op and callers fall
 * back to direct thumbnail generation. Repairable states self-heal instead:
 * a missing thumbnail file drops its stale manifest entry, an unreadable
 * manifest resets the store to empty on open, and the open pass also sweeps
 * `.webp` files the manifest no longer references (orphans of timed-out
 * writes or lost manifest entries).
 */

export interface ThumbnailManifestEntry {
  file: string;
  size: number;
  lastUsed: number;
}

export interface ThumbnailManifest {
  version: 1;
  entries: Record<string, ThumbnailManifestEntry>;
}

export interface ThumbnailStoredWritable {
  write(data: Blob): Promise<void>;
  close(): Promise<void>;
}

export interface ThumbnailStoredFileHandle {
  getFile(): Promise<File>;
  createWritable(): Promise<ThumbnailStoredWritable>;
}

/** Narrow seam over the OPFS directory the store owns; tests stub it. */
export interface ThumbnailStoreDirectory {
  getFileHandle(
    name: string,
    options?: { create?: boolean },
  ): Promise<ThumbnailStoredFileHandle>;
  removeEntry(name: string): Promise<void>;
  listFileNames(): Promise<string[]>;
}

// The DOM.Iterable lib set does not ship OPFS directory iteration, but every
// browser with OPFS support implements it; declare the slice the sweep needs.
declare global {
  interface FileSystemDirectoryHandle {
    keys(): AsyncIterableIterator<string>;
  }
}

const THUMBNAILS_DIR_NAME = 'thumbnails';
const MANIFEST_FILE_NAME = 'manifest.json';
const MANIFEST_VERSION = 1;
const MAX_MANIFEST_ENTRIES = 2000;
const OPERATION_TIMEOUT_MS = 2_000;
const MANIFEST_FLUSH_DELAY_MS = 100;
const OPERATION_TIMED_OUT = 'thumbnail-store-operation-timed-out';

const defaultOpenThumbnailsDirectory = async (): Promise<ThumbnailStoreDirectory> => {
  const root = await navigator.storage.getDirectory();
  const dir = await root.getDirectoryHandle(THUMBNAILS_DIR_NAME, { create: true });
  return {
    getFileHandle: (name, options) => dir.getFileHandle(name, options),
    removeEntry: (name) => dir.removeEntry(name),
    listFileNames: async () => {
      const names: string[] = [];
      for await (const name of dir.keys()) names.push(name);
      return names;
    },
  };
};

let openDirectory: () => Promise<ThumbnailStoreDirectory> =
  defaultOpenThumbnailsDirectory;
let disabled = false;
let directory: ThumbnailStoreDirectory | null = null;
let openPromise: Promise<ThumbnailStoreDirectory | null> | null = null;
let manifest: ThumbnailManifest = { version: MANIFEST_VERSION, entries: {} };
let flushTimer: ReturnType<typeof setTimeout> | null = null;

/** Replaces the OPFS opener (null restores the default) and resets state. */
export const resetThumbnailStoreForTests = (
  opener: (() => Promise<ThumbnailStoreDirectory>) | null = null,
): void => {
  if (flushTimer !== null) clearTimeout(flushTimer);
  flushTimer = null;
  openDirectory = opener ?? defaultOpenThumbnailsDirectory;
  disabled = false;
  directory = null;
  openPromise = null;
  manifest = { version: MANIFEST_VERSION, entries: {} };
};

const disableStore = (): void => {
  disabled = true;
  if (flushTimer !== null) {
    clearTimeout(flushTimer);
    flushTimer = null;
  }
};

/**
 * Bounded operation outcome: callers decide the failure policy (disable,
 * self-heal or warn) — `runBounded` itself no longer disables the store.
 */
type BoundedOutcome<T> =
  | { readonly ok: true; readonly value: T }
  | {
      readonly ok: false;
      readonly reason: 'timeout' | 'error';
      readonly error: unknown;
    };

const runBounded = async <T>(
  operation: () => Promise<T>,
): Promise<BoundedOutcome<T>> => {
  if (disabled) {
    return {
      ok: false,
      reason: 'error',
      error: new Error('Thumbnail store is disabled.'),
    };
  }
  let timer: ReturnType<typeof setTimeout> | undefined;
  try {
    const tracked = operation();
    // A rejection arriving after the timeout already resolved the race must
    // not surface as an unhandled rejection; the outcome reports it below.
    void tracked.catch(() => undefined);
    const timeout = new Promise<typeof OPERATION_TIMED_OUT>((resolve) => {
      timer = setTimeout(() => resolve(OPERATION_TIMED_OUT), OPERATION_TIMEOUT_MS);
    });
    const outcome = await Promise.race([tracked, timeout]);
    if (outcome === OPERATION_TIMED_OUT) {
      return {
        ok: false,
        reason: 'timeout',
        error: new Error('Thumbnail store operation timed out.'),
      };
    }
    return { ok: true, value: outcome };
  } catch (error) {
    return { ok: false, reason: 'error', error };
  } finally {
    if (timer !== undefined) clearTimeout(timer);
  }
};

const isRecord = (value: unknown): value is Record<string, unknown> =>
  typeof value === 'object' && value !== null;

const isManifestEntry = (value: unknown): value is ThumbnailManifestEntry =>
  isRecord(value) &&
  typeof value['file'] === 'string' &&
  typeof value['size'] === 'number' &&
  Number.isFinite(value['size']) &&
  typeof value['lastUsed'] === 'number' &&
  Number.isFinite(value['lastUsed']);

const readManifest = async (
  dir: ThumbnailStoreDirectory,
): Promise<ThumbnailManifest> => {
  let handle: ThumbnailStoredFileHandle;
  try {
    handle = await dir.getFileHandle(MANIFEST_FILE_NAME);
  } catch (error) {
    if (error instanceof DOMException && error.name === 'NotFoundError') {
      return { version: MANIFEST_VERSION, entries: {} };
    }
    throw error;
  }
  const file = await handle.getFile();
  const text = new TextDecoder().decode(
    new Uint8Array(await file.arrayBuffer()),
  );
  const parsed: unknown = JSON.parse(text);
  if (!isRecord(parsed) || parsed['version'] !== MANIFEST_VERSION) {
    throw new Error('Invalid thumbnail manifest.');
  }
  const rawEntries: unknown = parsed['entries'];
  if (!isRecord(rawEntries)) {
    throw new Error('Invalid thumbnail manifest.');
  }
  const entries: Record<string, ThumbnailManifestEntry> = {};
  for (const [hash, value] of Object.entries(rawEntries)) {
    if (!isManifestEntry(value)) {
      throw new Error('Invalid thumbnail manifest entry.');
    }
    entries[hash] = { file: value.file, size: value.size, lastUsed: value.lastUsed };
  }
  return { version: MANIFEST_VERSION, entries };
};

const writeManifestTo = async (
  dir: ThumbnailStoreDirectory,
  data: ThumbnailManifest,
): Promise<void> => {
  const handle = await dir.getFileHandle(MANIFEST_FILE_NAME, { create: true });
  const writable = await handle.createWritable();
  await writable.write(new Blob([JSON.stringify(data)], { type: 'application/json' }));
  await writable.close();
};

const pruneManifest = async (
  dir: ThumbnailStoreDirectory,
  loaded: ThumbnailManifest,
): Promise<ThumbnailManifest | null> => {
  const all = Object.entries(loaded.entries);
  const overflowCount = all.length - MAX_MANIFEST_ENTRIES;
  if (overflowCount <= 0) return loaded;
  all.sort(([, a], [, b]) => a.lastUsed - b.lastUsed);
  const dropped = all.slice(0, overflowCount);
  for (const [, entry] of dropped) {
    const removed = await runBounded(() => dir.removeEntry(entry.file));
    if (!removed.ok) return null;
  }
  for (const [hash] of dropped) {
    delete loaded.entries[hash];
  }
  const flushed = await runBounded(() => writeManifestTo(dir, loaded));
  if (!flushed.ok) return null;
  return loaded;
};

/**
 * Reclaims `.webp` files the manifest does not reference: orphans of
 * timed-out writes and leftovers of a reset manifest. Runs once per open,
 * every removal individually bounded.
 */
const sweepOrphanThumbnailFiles = async (
  dir: ThumbnailStoreDirectory,
  loaded: ThumbnailManifest,
): Promise<boolean> => {
  const listed = await runBounded(() => dir.listFileNames());
  if (!listed.ok) return false;
  const referenced = new Set<string>([MANIFEST_FILE_NAME]);
  for (const entry of Object.values(loaded.entries)) {
    referenced.add(entry.file);
  }
  for (const name of listed.value) {
    if (!name.endsWith('.webp') || referenced.has(name)) continue;
    const removed = await runBounded(() => dir.removeEntry(name));
    if (!removed.ok) return false;
  }
  return true;
};

const openStore = async (): Promise<ThumbnailStoreDirectory | null> => {
  if (disabled) return null;
  if (directory !== null) return directory;
  if (openPromise === null) {
    openPromise = (async () => {
      const opened = await runBounded(openDirectory);
      if (!opened.ok) {
        disableStore();
        return null;
      }
      const dir = opened.value;
      const loaded = await runBounded(() => readManifest(dir));
      let active: ThumbnailManifest;
      if (!loaded.ok) {
        if (loaded.reason === 'timeout') {
          disableStore();
          return null;
        }
        console.warn(
          'thumbnailStore: unreadable manifest, resetting to an empty store.',
          loaded.error,
        );
        active = { version: MANIFEST_VERSION, entries: {} };
        const seeded = await runBounded(() => writeManifestTo(dir, active));
        if (!seeded.ok) {
          disableStore();
          return null;
        }
      } else {
        active = loaded.value;
      }
      if (!(await sweepOrphanThumbnailFiles(dir, active))) {
        disableStore();
        return null;
      }
      const pruned = await pruneManifest(dir, active);
      if (pruned === null) {
        disableStore();
        return null;
      }
      manifest = pruned;
      directory = dir;
      return dir;
    })();
  }
  return openPromise;
};

const scheduleManifestFlush = (): void => {
  if (disabled || flushTimer !== null) return;
  flushTimer = setTimeout(() => {
    flushTimer = null;
    const target = directory;
    if (target === null || disabled) return;
    void runBounded(() => writeManifestTo(target, manifest)).then((outcome) => {
      if (!outcome.ok) {
        disableStore();
        console.warn(
          `thumbnailStore: manifest flush failed for ${Object.keys(manifest.entries).length} entries.`,
          outcome.error,
        );
      }
    });
  }, MANIFEST_FLUSH_DELAY_MS);
};

/** Sentinel returned by a read when the manifest entry points at a gone file. */
const STALE_THUMBNAIL_FILE = 'thumbnail-store-stale-file';

export const getStoredThumbnail = async (hash: string): Promise<Blob | null> => {
  const dir = await openStore();
  if (dir === null) return null;
  const entry = manifest.entries[hash];
  if (entry === undefined) return null;
  const outcome = await runBounded(async () => {
    try {
      const handle = await dir.getFileHandle(entry.file);
      return await handle.getFile();
    } catch (error) {
      if (error instanceof DOMException && error.name === 'NotFoundError') {
        return STALE_THUMBNAIL_FILE;
      }
      throw error;
    }
  });
  if (!outcome.ok) return null;
  if (outcome.value === STALE_THUMBNAIL_FILE) {
    delete manifest.entries[hash];
    scheduleManifestFlush();
    return null;
  }
  entry.lastUsed = Date.now();
  scheduleManifestFlush();
  return outcome.value;
};

export const putStoredThumbnail = async (hash: string, blob: Blob): Promise<void> => {
  const dir = await openStore();
  if (dir === null) return;
  const fileName = `${hash}.webp`;
  const outcome = await runBounded(async () => {
    const handle = await dir.getFileHandle(fileName, { create: true });
    const writable = await handle.createWritable();
    await writable.write(blob);
    await writable.close();
  });
  if (!outcome.ok) {
    if (outcome.reason === 'timeout') {
      // The write may still land after the timeout, leaving an unreferenced
      // file; the orphan sweep on the next open reclaims it.
      console.warn(
        `thumbnailStore: put for ${fileName} timed out; the file is left for the orphan sweep.`,
        outcome.error,
      );
    } else {
      disableStore();
    }
    return;
  }
  manifest.entries[hash] = { file: fileName, size: blob.size, lastUsed: Date.now() };
  scheduleManifestFlush();
};
