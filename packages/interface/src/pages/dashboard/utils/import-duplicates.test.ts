import { describe, expect, it, vi } from 'vitest';

import type { LoadedImage } from '../../../types/dashboard.types';
import type {
  ArchivePageFile,
  DirectPageFile,
  PageFile,
} from '../../../utils/page-source';
import { findDuplicateMatches, fingerprintOfPageFile } from './import-duplicates';

const makeFilters = (): LoadedImage['filters'] => ({
  brightness: 1,
  contrast: 1,
  saturation: 1,
  sharpen: 0,
  levels: { black: 0, white: 255, gamma: 1 },
  grayscale: false,
  inverted: false,
});

const makeDirectPage = (
  name: string,
  bytes: readonly number[],
  lastModified = 1000,
): DirectPageFile => {
  const file = new File([new Uint8Array(bytes)], name);
  return {
    kind: 'direct',
    name,
    type: 'image/png',
    size: file.size,
    lastModified,
    resident: file,
    toBlob: async () => file,
    dimensions: async () => ({ width: 10, height: 10 }),
    release: () => {},
  };
};

const makeArchivePage = (
  name: string,
  size: number,
  lastModified = 1000,
): ArchivePageFile => ({
  kind: 'archive',
  name,
  type: 'image/png',
  size,
  lastModified,
  chapter: {
    id: 'chapter-1',
    label: 'Chapter 1',
    archive: new File([], 'chapter-1.cbz'),
    entries: [],
  },
  entry: {
    path: name,
    compressedSize: size,
    uncompressedSize: size,
    method: 0,
    compressedOffset: 0,
  },
  toBlob: vi.fn(async () => new Blob()),
  dimensions: async () => ({ width: 10, height: 10 }),
  release: () => {},
});

const makeLibraryImage = (id: string, file: PageFile): LoadedImage => ({
  id,
  file,
  url: 'blob:library-url',
  width: 10,
  height: 10,
  rotation: 0,
  filters: makeFilters(),
});

const PNG_BYTES_A = [137, 80, 78, 71, 1, 2, 3, 4];
const PNG_BYTES_B = [137, 80, 78, 71, 9, 9, 9, 9];

describe('fingerprintOfPageFile', () => {
  it('captures size and lastModified only — the name never participates', () => {
    const pageA = makeDirectPage('page-001.png', PNG_BYTES_A, 5000);
    const pageB = makeDirectPage('totally-different.png', PNG_BYTES_A, 5000);

    expect(fingerprintOfPageFile(pageA)).toEqual({
      size: pageA.size,
      lastModified: 5000,
    });
    expect(fingerprintOfPageFile(pageA)).toEqual(fingerprintOfPageFile(pageB));
  });

  it('is sensitive to size and lastModified', () => {
    const page = makeDirectPage('page.png', PNG_BYTES_A, 5000);
    const bigger = makeDirectPage('page.png', [...PNG_BYTES_A, 0], 5000);
    const newer = makeDirectPage('page.png', PNG_BYTES_A, 6000);

    expect(fingerprintOfPageFile(page)).not.toEqual(fingerprintOfPageFile(bigger));
    expect(fingerprintOfPageFile(page)).not.toEqual(fingerprintOfPageFile(newer));
  });
});

describe('findDuplicateMatches', () => {
  it('flags a direct import identical in bytes to a library page', async () => {
    const libraryImage = makeLibraryImage(
      'lib-1',
      makeDirectPage('existing.png', PNG_BYTES_A, 5000),
    );
    const imports = [{ file: makeDirectPage('incoming.png', PNG_BYTES_A, 999) }];

    const matches = await findDuplicateMatches(imports, [libraryImage]);

    expect(matches).toEqual([
      { importIndex: 0, existingImageId: 'lib-1' },
    ]);
  });

  it('does not flag same-name pages with different sizes', async () => {
    const libraryImage = makeLibraryImage(
      'lib-1',
      makeDirectPage('page-001.png', PNG_BYTES_A, 5000),
    );
    const imports = [
      { file: makeDirectPage('page-001.png', [...PNG_BYTES_A, 0], 5000) },
    ];

    expect(await findDuplicateMatches(imports, [libraryImage])).toEqual([]);
  });

  it('does not flag same-size pages with different bytes', async () => {
    const libraryImage = makeLibraryImage(
      'lib-1',
      makeDirectPage('existing.png', PNG_BYTES_A, 5000),
    );
    const imports = [{ file: makeDirectPage('incoming.png', PNG_BYTES_B, 999) }];

    expect(await findDuplicateMatches(imports, [libraryImage])).toEqual([]);
  });

  it('flags same-size direct pages with identical bytes even when lastModified differs', async () => {
    const libraryImage = makeLibraryImage(
      'lib-1',
      makeDirectPage('existing.png', PNG_BYTES_A, 5000),
    );
    const imports = [
      { file: makeDirectPage('incoming.png', PNG_BYTES_A, 1234) },
    ];

    expect(await findDuplicateMatches(imports, [libraryImage])).toEqual([
      { importIndex: 0, existingImageId: 'lib-1' },
    ]);
  });

  it('does not flag archive pages with equal size but different lastModified', async () => {
    const libraryImage = makeLibraryImage(
      'lib-1',
      makeArchivePage('existing.png', PNG_BYTES_A.length, 5000),
    );
    const imports = [
      { file: makeArchivePage('incoming.png', PNG_BYTES_A.length, 1234) },
    ];

    expect(await findDuplicateMatches(imports, [libraryImage])).toEqual([]);
  });

  it('matches archive pages metadata-only and never reads their bytes', async () => {
    const archivePage = makeArchivePage('existing.png', PNG_BYTES_A.length, 5000);
    const libraryImage = makeLibraryImage('lib-1', archivePage);
    const imports = [
      { file: makeArchivePage('incoming.png', PNG_BYTES_A.length, 5000) },
    ];

    const matches = await findDuplicateMatches(imports, [libraryImage]);

    expect(matches).toEqual([{ importIndex: 0, existingImageId: 'lib-1' }]);
    expect(archivePage.toBlob).not.toHaveBeenCalled();
  });

  it('matches an archive import against a direct library page on metadata only, without reading bytes', async () => {
    const libraryImage = makeLibraryImage(
      'lib-1',
      makeDirectPage('existing.png', PNG_BYTES_A, 5000),
    );
    const archivePage = makeArchivePage('incoming.png', PNG_BYTES_A.length, 5000);
    const imports = [{ file: archivePage }];

    const matches = await findDuplicateMatches(imports, [libraryImage]);

    expect(matches).toEqual([{ importIndex: 0, existingImageId: 'lib-1' }]);
    expect(archivePage.toBlob).not.toHaveBeenCalled();
  });

  it('flags both sides of an in-batch duplicate', async () => {
    const imports = [
      { file: makeDirectPage('first.png', PNG_BYTES_A, 5000) },
      { file: makeDirectPage('second.png', PNG_BYTES_B, 6000) },
      { file: makeDirectPage('copy.png', PNG_BYTES_A, 7000) },
    ];

    const matches = await findDuplicateMatches(imports, []);

    expect(matches).toEqual([
      { importIndex: 0, otherImportIndex: 2 },
      { importIndex: 2, otherImportIndex: 0 },
    ]);
  });

  it('prefers the library match over an in-batch match', async () => {
    const libraryImage = makeLibraryImage(
      'lib-1',
      makeDirectPage('existing.png', PNG_BYTES_A, 5000),
    );
    const imports = [
      { file: makeDirectPage('incoming.png', PNG_BYTES_A, 999) },
      { file: makeDirectPage('twin.png', PNG_BYTES_A, 999) },
    ];

    const matches = await findDuplicateMatches(imports, [libraryImage]);

    expect(matches).toEqual([
      { importIndex: 0, existingImageId: 'lib-1' },
      { importIndex: 1, existingImageId: 'lib-1' },
    ]);
  });

  it('returns no matches for a clean import', async () => {
    const imports = [
      { file: makeDirectPage('a.png', PNG_BYTES_A, 5000) },
      { file: makeDirectPage('b.png', PNG_BYTES_B, 6000) },
    ];

    expect(await findDuplicateMatches(imports, [])).toEqual([]);
  });
});
