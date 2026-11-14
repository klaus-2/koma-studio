import type { LoadedImage } from '../../../types/dashboard.types';
import type { DirectPageFile, PageFile } from '../../../utils/page-source';

/**
 * Duplicate-page detection for imports.
 *
 * Fingerprint = { size, lastModified }. The file NAME is display info only and
 * is NEVER part of the comparison (manga pages share names across chapters).
 * Byte comparison (SHA-256) runs only for same-size pairs where BOTH sides are
 * direct page files; archive pages match metadata-only because their bytes are
 * materialized lazily and must never be read at import time.
 */
export interface ImportFingerprint {
  size: number;
  lastModified: number;
}

export interface DuplicateMatch {
  /** Index into the import batch. */
  importIndex: number;
  /** Id of the matching library image, when matched against the current library. */
  existingImageId?: string;
  /** Sibling import index, when matched within the batch. */
  otherImportIndex?: number;
}

export const fingerprintOfPageFile = (file: PageFile): ImportFingerprint => ({
  size: file.size,
  lastModified: file.lastModified,
});

export const sha256Hex = async (blob: Blob): Promise<string> => {
  const bytes = await blob.arrayBuffer();
  const digest = await crypto.subtle.digest('SHA-256', bytes);
  let hex = '';
  for (const byte of new Uint8Array(digest)) {
    hex += byte.toString(16).padStart(2, '0');
  }
  return hex;
};

/** Hashes are memoized per resident File: identical pages hash once. */
const directHashCache = new WeakMap<object, Promise<string>>();

const hashDirectPageFile = (file: DirectPageFile): Promise<string> => {
  const cached = directHashCache.get(file.resident);
  if (cached) {
    return cached;
  }
  const promise = sha256Hex(file.resident);
  directHashCache.set(file.resident, promise);
  return promise;
};

const isDirectPage = (file: PageFile): file is DirectPageFile =>
  file.kind === 'direct';

const isDuplicatePagePair = async (a: PageFile, b: PageFile): Promise<boolean> => {
  const fingerprintA = fingerprintOfPageFile(a);
  const fingerprintB = fingerprintOfPageFile(b);
  if (fingerprintA.size !== fingerprintB.size) {
    return false;
  }
  if (isDirectPage(a) && isDirectPage(b)) {
    const [hashA, hashB] = await Promise.all([
      hashDirectPageFile(a),
      hashDirectPageFile(b),
    ]);
    return hashA === hashB;
  }
  // At least one side is an archive page: metadata-only comparison, the
  // archive's bytes are never materialized here.
  return fingerprintA.lastModified === fingerprintB.lastModified;
};

export const findDuplicateMatches = async (
  imports: ReadonlyArray<{ file: PageFile }>,
  libraryImages: ReadonlyArray<LoadedImage>,
): Promise<ReadonlyArray<DuplicateMatch>> => {
  const libraryBySize = new Map<number, LoadedImage[]>();
  for (const image of libraryImages) {
    const bucket = libraryBySize.get(image.file.size);
    if (bucket) {
      bucket.push(image);
    } else {
      libraryBySize.set(image.file.size, [image]);
    }
  }

  const matches: DuplicateMatch[] = [];
  for (let importIndex = 0; importIndex < imports.length; importIndex += 1) {
    const entry = imports[importIndex];
    if (!entry) {
      continue;
    }
    let match: DuplicateMatch | null = null;
    for (const candidate of libraryBySize.get(entry.file.size) ?? []) {
      if (await isDuplicatePagePair(entry.file, candidate.file)) {
        match = { importIndex, existingImageId: candidate.id };
        break;
      }
    }
    if (!match) {
      for (let otherIndex = 0; otherIndex < imports.length; otherIndex += 1) {
        const other = imports[otherIndex];
        if (!other || otherIndex === importIndex) {
          continue;
        }
        if (await isDuplicatePagePair(entry.file, other.file)) {
          match = { importIndex, otherImportIndex: otherIndex };
          break;
        }
      }
    }
    if (match) {
      matches.push(match);
    }
  }
  return matches;
};
