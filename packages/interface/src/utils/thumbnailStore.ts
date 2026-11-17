/**
 * OPFS-backed cold tier for content-hash keyed WebP thumbnails.
 *
 * Layout: navigator.storage.getDirectory() → `thumbnails/` → one WebP file per
 * hash (`<hash>.webp`) plus one `manifest.json`. OPFS has no LRU, so the
 * manifest IS the eviction policy: loaded once on open, held in memory, pruned
 * on open (cap MAX_MANIFEST_ENTRIES, oldest lastUsed first) and flushed
 * coalesced after write bursts and after every prune — never per read. Losing
 * some lastUsed precision on a crash is harmless: worst case a slightly wrong
 * eviction order.
 *
 * Every storage operation is bounded by OPERATION_TIMEOUT_MS so import and
 * restore never stall on storage. Any open, manifest or file error disables
 * the store for the session: every operation becomes a no-op and callers fall
 * back to direct thumbnail generation.
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
  return root.getDirectoryHandle(THUMBNAILS_DIR_NAME, { create: true });
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

const runBounded = async <T>(operation: () => Promise<T>): Promise<T | null> => {
  if (disabled) return null;
  let timer: ReturnType<typeof setTimeout> | undefined;
  try {
    const tracked = operation();
    // A rejection arriving after the timeout already resolved the race must
    // not surface as an unhandled rejection; the timeout path disables below.
    void tracked.catch(() => undefined);
    const timeout = new Promise<typeof OPERATION_TIMED_OUT>((resolve) => {
      timer = setTimeout(() => resolve(OPERATION_TIMED_OUT), OPERATION_TIMEOUT_MS);
    });
    const outcome = await Promise.race([tracked, timeout]);
    if (outcome === OPERATION_TIMED_OUT) {
      disableStore();
      return null;
    }
    return outcome;
  } catch {
    disableStore();
    return null;
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
    if (removed === null) return null;
  }
  for (const [hash] of dropped) {
    delete loaded.entries[hash];
  }
  const flushed = await runBounded(() => writeManifestTo(dir, loaded));
  if (flushed === null) return null;
  return loaded;
};

const openStore = async (): Promise<ThumbnailStoreDirectory | null> => {
  if (disabled) return null;
  if (directory !== null) return directory;
  if (openPromise === null) {
    openPromise = (async () => {
      const dir = await runBounded(openDirectory);
      if (dir === null) return null;
      const loaded = await runBounded(() => readManifest(dir));
      if (loaded === null) return null;
      const pruned = await pruneManifest(dir, loaded);
      if (pruned === null) return null;
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
    void runBounded(() => writeManifestTo(target, manifest));
  }, MANIFEST_FLUSH_DELAY_MS);
};

export const getStoredThumbnail = async (hash: string): Promise<Blob | null> => {
  const dir = await openStore();
  if (dir === null) return null;
  const entry = manifest.entries[hash];
  if (entry === undefined) return null;
  const outcome = await runBounded(async () => {
    const handle = await dir.getFileHandle(entry.file);
    return handle.getFile();
  });
  if (outcome === null) return null;
  entry.lastUsed = Date.now();
  return outcome;
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
  if (outcome === null) return;
  manifest.entries[hash] = { file: fileName, size: blob.size, lastUsed: Date.now() };
  scheduleManifestFlush();
};
