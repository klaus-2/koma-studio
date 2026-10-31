export interface DroppedUpload {
  readonly file: File;
  /** Top-level folder name the file came from; null for loose files. */
  readonly folder: string | null;
}

interface DropDirectoryReader {
  readEntries: (
    success: (entries: DropEntryLike[]) => void,
    error?: (error: unknown) => void,
  ) => void;
}

/** Structural shape of FileSystemEntry so tests can supply plain fakes. */
interface DropEntryLike {
  readonly isFile: boolean;
  readonly isDirectory: boolean;
  readonly name: string;
  file?: (
    success: (file: File) => void,
    error?: (error: unknown) => void,
  ) => void;
  createReader?: () => DropDirectoryReader;
}

interface DataTransferLike {
  readonly items?: ArrayLike<unknown> | null;
  readonly files?: ArrayLike<File> | null;
}

const isDropEntry = (value: unknown): value is DropEntryLike => {
  if (typeof value !== 'object' || value === null) {
    return false;
  }
  const candidate = value as Partial<DropEntryLike>;

  return (
    typeof candidate.isFile === 'boolean' &&
    typeof candidate.isDirectory === 'boolean' &&
    typeof candidate.name === 'string'
  );
};

const entryOf = (item: unknown): DropEntryLike | null => {
  if (typeof item !== 'object' || item === null) {
    return null;
  }
  const getter = (item as { webkitGetAsEntry?: unknown }).webkitGetAsEntry;

  if (typeof getter !== 'function') {
    return null;
  }

  try {
    const entry: unknown = getter.call(item);

    return isDropEntry(entry) ? entry : null;
  } catch {
    return null;
  }
};

const readAllEntries = (
  reader: DropDirectoryReader,
): Promise<DropEntryLike[]> =>
  new Promise((resolve, reject) => {
    const collected: DropEntryLike[] = [];
    const readBatch = (): void => {
      reader.readEntries((batch) => {
        if (batch.length === 0) {
          resolve(collected);
          return;
        }
        collected.push(...batch);
        readBatch();
      }, reject);
    };
    readBatch();
  });

const readEntryFile = (entry: DropEntryLike): Promise<File | null> => {
  if (!entry.file) {
    return Promise.resolve(null);
  }

  return new Promise((resolve) => {
    entry.file?.(
      (file) => resolve(file),
      () => resolve(null),
    );
  });
};

const collectFromDirectory = async (
  entry: DropEntryLike,
  folder: string,
): Promise<DroppedUpload[]> => {
  if (!entry.createReader) {
    return [];
  }

  let children: DropEntryLike[];

  try {
    children = await readAllEntries(entry.createReader());
  } catch {
    // A folder the OS refuses to enumerate must not abort the whole drop.
    return [];
  }

  const collected: DroppedUpload[] = [];

  for (const child of children) {
    if (child.isDirectory) {
      collected.push(...(await collectFromDirectory(child, folder)));
    } else if (child.isFile) {
      const file = await readEntryFile(child);
      if (file) {
        collected.push({ file, folder });
      }
    }
  }

  return collected;
};

/**
 * Reads a drop payload, walking dropped directories depth-first. Every file
 * inside a top-level folder is tagged with that folder's name so the caller can
 * treat the folder as one chapter; loose files keep a null folder.
 */
export async function collectDroppedFiles(
  dataTransfer: DataTransferLike,
  accept: (file: File) => boolean,
): Promise<DroppedUpload[]> {
  const items = dataTransfer.items ? Array.from(dataTransfer.items) : [];
  const entries = items.map(entryOf);
  const fallbackFiles = dataTransfer.files
    ? Array.from(dataTransfer.files)
    : [];

  if (entries.every((entry) => entry === null)) {
    return fallbackFiles
      .filter((file) => accept(file))
      .map((file) => ({ file, folder: null }));
  }

  const collected: DroppedUpload[] = [];

  for (const [index, entry] of entries.entries()) {
    if (!entry) {
      const file = fallbackFiles[index];
      if (file) {
        collected.push({ file, folder: null });
      }
      continue;
    }

    if (entry.isDirectory) {
      collected.push(...(await collectFromDirectory(entry, entry.name)));
      continue;
    }

    const file = await readEntryFile(entry);
    if (file) {
      collected.push({ file, folder: null });
    }
  }

  return collected.filter(({ file }) => accept(file));
}
