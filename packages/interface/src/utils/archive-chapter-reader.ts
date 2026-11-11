import { Inflate } from 'fflate';

import { readBlobBytes } from './blob-bytes';

export const SUPPORTED_ARCHIVE_IMAGE_EXTENSIONS = new Set([
  '.png',
  '.jpg',
  '.jpeg',
  '.webp',
]);

export const MAX_ARCHIVE_ENTRIES = 2000;

export const MAX_ARCHIVE_ENTRY_BYTES = 64 * 1024 * 1024;

const EOCD_SIGNATURE = 0x06054b50;
const CENTRAL_DIRECTORY_SIGNATURE = 0x02014b50;
const ZIP64_EOCD_LOCATOR_SIGNATURE = 0x07064b50;
const ZIP64_EOCD_SIGNATURE = 0x06064b50;
const EOCD_SEARCH_WINDOW_BYTES = 64 * 1024 + 22;

const METHOD_STORED = 0;
const METHOD_DEFLATE = 8;

export interface ArchiveEntryMeta {
  readonly path: string;
  readonly compressedSize: number;
  readonly uncompressedSize: number;
  readonly method: number;
  readonly compressedOffset: number;
}

export interface ArchiveChapter {
  readonly id: string;
  readonly label: string;
  readonly archive: File;
  readonly entries: ReadonlyArray<ArchiveEntryMeta>;
}

export class ArchiveReadError extends Error {
  readonly code: ArchiveReadErrorCode;

  constructor(code: ArchiveReadErrorCode, message: string) {
    super(message);
    this.name = 'ArchiveReadError';
    this.code = code;
  }
}

export type ArchiveReadErrorCode =
  | 'not-a-zip'
  | 'corrupt-directory'
  | 'unsupported-method'
  | 'entry-too-large'
  | 'corrupt-entry';

const toArchiveError = (error: unknown): ArchiveReadError => {
  if (error instanceof ArchiveReadError) return error;
  const message = error instanceof Error ? error.message : String(error);
  return new ArchiveReadError('corrupt-entry', `Failed to read the archive: ${message}`);
};

const readUint8 = (bytes: Uint8Array, offset: number): number => {
  const value = bytes[offset];
  if (value === undefined) {
    throw new ArchiveReadError('corrupt-directory', 'The archive directory is truncated.');
  }
  return value;
};

const readUint16 = (bytes: Uint8Array, offset: number): number =>
  readUint8(bytes, offset) | (readUint8(bytes, offset + 1) << 8);

const readUint32 = (bytes: Uint8Array, offset: number): number =>
  (readUint8(bytes, offset) |
    (readUint8(bytes, offset + 1) << 8) |
    (readUint8(bytes, offset + 2) << 16) |
    (readUint8(bytes, offset + 3) << 24)) >>>
  0;

const readUint64 = (bytes: Uint8Array, offset: number): number => {
  const low = readUint32(bytes, offset);
  const high = readUint32(bytes, offset + 4);
  return high * 0x100000000 + low;
};

const fileExtension = (path: string): string => {
  const normalized = path.trim().toLowerCase();
  const lastDot = normalized.lastIndexOf('.');
  if (lastDot < 0) return '';
  return normalized.slice(lastDot);
};

const findEocdOffset = (tail: Uint8Array): number => {
  for (let index = tail.length - 22; index >= 0; index -= 1) {
    if (readUint32(tail, index) === EOCD_SIGNATURE) {
      return index;
    }
  }
  return -1;
};

interface CentralDirectoryLocation {
  readonly offset: number;
  readonly size: number;
  readonly entryCount: number;
}

const readCentralDirectoryLocation = async (
  archive: File,
  tail: Uint8Array,
  eocdOffsetInTail: number,
): Promise<CentralDirectoryLocation> => {
  const entryCount = readUint16(tail, eocdOffsetInTail + 10);
  const directorySize = readUint32(tail, eocdOffsetInTail + 12);
  const directoryOffset = readUint32(tail, eocdOffsetInTail + 16);

  const needsZip64 =
    entryCount === 0xffff || directorySize === 0xffffffff || directoryOffset === 0xffffffff;

  if (!needsZip64) {
    return { offset: directoryOffset, size: directorySize, entryCount };
  }

  const locatorOffsetInTail = eocdOffsetInTail - 20;
  if (
    locatorOffsetInTail < 0 ||
    readUint32(tail, locatorOffsetInTail) !== ZIP64_EOCD_LOCATOR_SIGNATURE
  ) {
    throw new ArchiveReadError('corrupt-directory', 'The ZIP64 locator is missing.');
  }

  const zip64EocdOffset = readUint64(tail, locatorOffsetInTail + 8);
  const zip64Bytes = new Uint8Array(56);
  const zip64Buffer = await readBlobBytes(
    archive.slice(zip64EocdOffset, zip64EocdOffset + zip64Bytes.length),
  );
  zip64Bytes.set(zip64Buffer);

  if (readUint32(zip64Bytes, 0) !== ZIP64_EOCD_SIGNATURE) {
    throw new ArchiveReadError('corrupt-directory', 'The ZIP64 directory is unreadable.');
  }

  return {
    offset: readUint64(zip64Bytes, 48),
    size: readUint64(zip64Bytes, 40),
    entryCount: readUint64(zip64Bytes, 32),
  };
};

interface RawCentralEntry {
  readonly path: string;
  readonly method: number;
  readonly compressedSize: number;
  readonly uncompressedSize: number;
  readonly compressedOffset: number;
}

const parseCentralDirectory = (
  bytes: Uint8Array,
  expectedCount: number,
): RawCentralEntry[] => {
  const entries: RawCentralEntry[] = [];
  let offset = 0;

  while (offset + 46 <= bytes.length && entries.length < expectedCount) {
    if (readUint32(bytes, offset) !== CENTRAL_DIRECTORY_SIGNATURE) {
      throw new ArchiveReadError('corrupt-directory', 'The archive directory is corrupt.');
    }

    const method = readUint16(bytes, offset + 10);
    const compressedSize = readUint32(bytes, offset + 20);
    const uncompressedSize = readUint32(bytes, offset + 24);
    const nameLength = readUint16(bytes, offset + 28);
    const extraLength = readUint16(bytes, offset + 30);
    const commentLength = readUint16(bytes, offset + 32);
    const localHeaderOffset = readUint32(bytes, offset + 42);

    const nameStart = offset + 46;
    const nameEnd = nameStart + nameLength;
    if (nameEnd > bytes.length) {
      throw new ArchiveReadError('corrupt-directory', 'The archive directory is corrupt.');
    }

    const nameBytes = bytes.subarray(nameStart, nameEnd);
    const path = new TextDecoder('utf-8', { fatal: false }).decode(nameBytes);

    entries.push({
      path: path.replace(/\\/g, '/'),
      method,
      compressedSize,
      uncompressedSize,
      compressedOffset: localHeaderOffset,
    });

    offset = nameEnd + extraLength + commentLength;
  }

  return entries;
};

const resolveCompressedOffset = async (
  archive: File,
  localHeaderOffset: number,
): Promise<number> => {
  const headerBytes = new Uint8Array(30);
  const buffer = await readBlobBytes(
    archive.slice(localHeaderOffset, localHeaderOffset + headerBytes.length),
  );
  headerBytes.set(buffer);

  const nameLength = readUint16(headerBytes, 26);
  const extraLength = readUint16(headerBytes, 28);
  return localHeaderOffset + 30 + nameLength + extraLength;
};

const compareByLowercasePath = (
  left: RawCentralEntry,
  right: RawCentralEntry,
): number => {
  const leftKey = left.path.toLowerCase();
  const rightKey = right.path.toLowerCase();
  if (leftKey < rightKey) return -1;
  if (leftKey > rightKey) return 1;
  return 0;
};

const selectImageCandidates = (
  candidates: readonly RawCentralEntry[],
): { rawEntries: RawCentralEntry[]; warnings: string[] } => {
  const warnings: string[] = [];

  const imageEntries = candidates
    .filter(
      (entry) =>
        entry.path.length > 0 &&
        !entry.path.endsWith('/') &&
        SUPPORTED_ARCHIVE_IMAGE_EXTENSIONS.has(fileExtension(entry.path)),
    )
    .sort(compareByLowercasePath);

  if (imageEntries.length > MAX_ARCHIVE_ENTRIES) {
    warnings.push(
      `too many archive entries (${imageEntries.length}), processing only the first ${MAX_ARCHIVE_ENTRIES}`,
    );
  }

  const rawEntries: RawCentralEntry[] = [];
  for (const entry of imageEntries.slice(0, MAX_ARCHIVE_ENTRIES)) {
    if (entry.uncompressedSize > MAX_ARCHIVE_ENTRY_BYTES) {
      warnings.push(`entry too large, skipped: ${entry.path}`);
      continue;
    }
    rawEntries.push(entry);
  }

  return { rawEntries, warnings };
};

const selectKeptEntries = (
  candidates: readonly RawCentralEntry[],
): { entries: ArchiveEntryMeta[]; warnings: string[] } => {
  const entries: ArchiveEntryMeta[] = [];
  for (const entry of candidates) {
    entries.push({
      path: entry.path,
      compressedSize: entry.compressedSize,
      uncompressedSize: entry.uncompressedSize,
      method: entry.method,
      compressedOffset: entry.compressedOffset,
    });
  }
  return { entries, warnings: [] };
};

export const openArchiveChapter = async (
  archive: File,
): Promise<{ chapter: ArchiveChapter; warnings: string[] }> => {
  const tailSize = Math.min(archive.size, EOCD_SEARCH_WINDOW_BYTES);
  const tailStart = archive.size - tailSize;
  const tail = await readBlobBytes(archive.slice(tailStart, archive.size));

  const eocdOffsetInTail = findEocdOffset(tail);
  if (eocdOffsetInTail < 0) {
    throw new ArchiveReadError('not-a-zip', 'The file is not a valid ZIP/CBZ archive.');
  }

  const location = await readCentralDirectoryLocation(archive, tail, eocdOffsetInTail);

  if (
    location.offset > archive.size ||
    location.size > archive.size ||
    location.offset + location.size > archive.size
  ) {
    throw new ArchiveReadError('corrupt-directory', 'The archive directory lies outside the file.');
  }

  const directoryBytes = new Uint8Array(location.size);
  if (location.size > 0) {
    const buffer = await readBlobBytes(
      archive.slice(location.offset, location.offset + location.size),
    );
    directoryBytes.set(buffer);
  }

  const rawEntries = parseCentralDirectory(directoryBytes, location.entryCount);

  const selected = selectImageCandidates(rawEntries);

  const resolved: RawCentralEntry[] = [];
  for (const entry of selected.rawEntries) {
    resolved.push({
      ...entry,
      compressedOffset: await resolveCompressedOffset(archive, entry.compressedOffset),
    });
  }

  const { entries } = selectKeptEntries(resolved);

  return {
    chapter: {
      id: `archive:${archive.name}`,
      label: archive.name,
      archive,
      entries,
    },
    warnings: selected.warnings,
  };
};

export const readArchiveEntry = async (
  chapter: ArchiveChapter,
  entry: ArchiveEntryMeta,
): Promise<Uint8Array> => {
  if (entry.uncompressedSize > MAX_ARCHIVE_ENTRY_BYTES) {
    throw new ArchiveReadError(
      'entry-too-large',
      `The archive entry is too large: ${entry.path}`,
    );
  }

  const compressed = await readBlobBytes(
    chapter.archive.slice(
      entry.compressedOffset,
      entry.compressedOffset + entry.compressedSize,
    ),
  );

  if (entry.method === METHOD_STORED) {
    if (compressed.byteLength > MAX_ARCHIVE_ENTRY_BYTES) {
      throw new ArchiveReadError(
        'entry-too-large',
        `The archive entry is too large: ${entry.path}`,
      );
    }
    return compressed;
  }

  if (entry.method !== METHOD_DEFLATE) {
    throw new ArchiveReadError(
      'unsupported-method',
      `The archive entry uses an unsupported compression method: ${entry.path}`,
    );
  }

  const chunks: Uint8Array[] = [];
  let total = 0;

  try {
    const inflate = new Inflate((data: Uint8Array) => {
      total += data.byteLength;
      if (total > MAX_ARCHIVE_ENTRY_BYTES) {
        throw new ArchiveReadError(
          'entry-too-large',
          `The archive entry is too large: ${entry.path}`,
        );
      }
      chunks.push(data);
    });
    inflate.push(compressed, true);
  } catch (error: unknown) {
    throw toArchiveError(error);
  }

  if (chunks.length === 1) {
    return chunks[0] as Uint8Array;
  }

  const merged = new Uint8Array(total);
  let offset = 0;
  for (const chunk of chunks) {
    merged.set(chunk, offset);
    offset += chunk.byteLength;
  }
  return merged;
};
