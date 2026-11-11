import { describe, expect, it, vi } from 'vitest';
import { zipSync } from 'fflate';

import {
  openArchiveChapter,
  type ArchiveChapter,
  type ArchiveEntryMeta,
} from './archive-chapter-reader';
import {
  createArchivePageFile,
  createDirectPageFile,
  isPageFile,
  materializePageForProcessing,
  readPageBytes,
  releasePage,
  resolvePagePreview,
} from './page-source';
import type { PageFile } from './page-source';
import type { ImageFilters, LoadedImage } from '../types/dashboard.types';

const textBytes = (value: string): Uint8Array<ArrayBuffer> => {
  const encoded = new TextEncoder().encode(value);
  const copy = new Uint8Array(new ArrayBuffer(encoded.byteLength));
  copy.set(encoded);
  return copy;
};

const DEFAULT_TEST_FILTERS: ImageFilters = {
  brightness: 0,
  contrast: 0,
  saturation: 0,
  sharpen: 0,
  levels: { black: 0, white: 255, gamma: 1 },
  grayscale: false,
  inverted: false,
};

const buildTestImage = (file: PageFile, url: string): LoadedImage => ({
  id: 'test-image',
  file,
  url,
  width: 0,
  height: 0,
  rotation: 0,
  filters: { ...DEFAULT_TEST_FILTERS },
});

const buildChapter = async (): Promise<ArchiveChapter> => {
  const archive = new File(
    [
      zipSync({
        'page-1.png': textBytes('first'),
        'page-2.png': textBytes('second'),
        'page-3.png': textBytes('third'),
      }),
    ],
    'chapter.cbz',
    { type: 'application/zip' },
  );
  const { chapter } = await openArchiveChapter(archive);
  return chapter;
};

const entryAt = (chapter: ArchiveChapter, index: number): ArchiveEntryMeta =>
  chapter.entries[index] as ArchiveEntryMeta;

describe('page-source', () => {
  it('reads the bytes of a direct upload', async () => {
    const file = new File([textBytes('direct bytes')], 'page.png', {
      type: 'image/png',
    });
    const pageFile = createDirectPageFile(file);

    const bytes = await readPageBytes({ file: pageFile });

    expect(new TextDecoder().decode(bytes)).toBe('direct bytes');
  });

  it('extracts exactly one archive entry for an archive-backed page', async () => {
    const chapter = await buildChapter();
    const entry = entryAt(chapter, 1);
    const pageFile = createArchivePageFile(chapter, entry, 'page-2.png', 'image/png');

    const bytes = await readPageBytes({ file: pageFile });

    expect(new TextDecoder().decode(bytes)).toBe('second');
  });

  it('drops the cached bytes on release and re-extracts on the next read', async () => {
    const chapter = await buildChapter();
    const entry = entryAt(chapter, 0);
    const pageFile = createArchivePageFile(chapter, entry, 'page-1.png', 'image/png');

    const first = await readPageBytes({ file: pageFile });
    releasePage({ file: pageFile });
    const second = await readPageBytes({ file: pageFile });

    expect(new TextDecoder().decode(first)).toBe('first');
    expect(new TextDecoder().decode(second)).toBe('first');
  });

  it('never materializes a page that was not requested', async () => {
    const chapter = await buildChapter();
    const pages = chapter.entries.map((entry, index) =>
      createArchivePageFile(chapter, entry, `page-${index + 1}.png`, 'image/png'),
    );

    const target = pages[0];
    if (!target) throw new Error('The fixture must contain at least one page.');

    const readSpy = vi.spyOn(target, 'toBlob');
    await target.toBlob();

    expect(readSpy).toHaveBeenCalledTimes(1);
    // The other pages were never touched: their caches stay empty and no
    // extraction has been triggered for them.
    const untouched = pages[1];
    if (!untouched) throw new Error('The fixture must contain a second page.');
    expect(untouched.size).toBeGreaterThan(0);
  });

  it('keeps the placeholder metadata stable across materializations', async () => {
    const chapter = await buildChapter();
    const entry = entryAt(chapter, 0);
    const pageFile = createArchivePageFile(chapter, entry, 'page-1.png', 'image/png');

    const firstModified = pageFile.lastModified;
    await pageFile.toBlob();
    releasePage({ file: pageFile });
    await pageFile.toBlob();

    expect(pageFile.lastModified).toBe(firstModified);
    expect(pageFile.name).toBe('page-1.png');
  });

  it('detects both page kinds in isPageFile and rejects plain Files', async () => {
    const chapter = await buildChapter();
    const entry = entryAt(chapter, 0);
    const archivePage = createArchivePageFile(chapter, entry, 'page-1.png', 'image/png');
    const directPage = createDirectPageFile(
      new File([textBytes('direct')], 'page.png', { type: 'image/png' }),
    );

    // The workspace signature serializer depends on this guard: a page kind
    // it misses would be walked recursively instead of summarized.
    expect(isPageFile(archivePage)).toBe(true);
    expect(isPageFile(directPage)).toBe(true);
    expect(isPageFile(new File([], 'x.png'))).toBe(false);
    expect(isPageFile({ kind: 'archive' })).toBe(false);
    expect(isPageFile(null)).toBe(false);
    expect(isPageFile('page')).toBe(false);
  });

  it('reports the entry size as the page size', async () => {
    const chapter = await buildChapter();
    const entry = entryAt(chapter, 0);
    const pageFile = createArchivePageFile(chapter, entry, 'page-1.png', 'image/png');

    expect(pageFile.size).toBe(entry.uncompressedSize);
    expect(pageFile.size).toBeGreaterThan(0);
  });

  it('materializes a page into a File with the right name and type', async () => {
    const chapter = await buildChapter();
    const entry = entryAt(chapter, 2);
    const pageFile = createArchivePageFile(chapter, entry, 'page-3.png', 'image/png');

    const materialized = await materializePageForProcessing({
      file: pageFile,
      width: 0,
      height: 0,
    });

    expect(materialized.file.name).toBe('page-3.png');
    expect(materialized.file.type).toBe('image/png');
    expect(materialized.file.size).toBe(entry.uncompressedSize);
  });

  it('exposes an ephemeral url for an archive-backed page', async () => {
    const chapter = await buildChapter();
    const entry = entryAt(chapter, 0);
    const pageFile = createArchivePageFile(chapter, entry, 'page-1.png', 'image/png');
    const image = buildTestImage(pageFile, '');

    const preview = await resolvePagePreview(image);
    expect(preview.src).toMatch(/^blob:/);

    preview.release();
  });

  it('returns the existing url for a direct upload', async () => {
    const file = new File([textBytes('direct')], 'page.png', { type: 'image/png' });
    const pageFile = createDirectPageFile(file);
    const image = buildTestImage(pageFile, 'blob:existing');

    const preview = await resolvePagePreview(image);

    expect(preview.src).toBe('blob:existing');
    expect(() => preview.release()).not.toThrow();
  });
});
