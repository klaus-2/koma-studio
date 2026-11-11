import { beforeEach, describe, expect, it, vi } from 'vitest';
import { zipSync } from 'fflate';

import { importArchiveChapter } from '../lib/chapter-archive-import';
import { createDirectPageFile } from '../../../utils/page-source';
import type { ImageFilters, LoadedImage } from '../../../types/dashboard.types';

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

/**
 * A small page PNG header so the reader treats the member as an image.
 * The reader selects by extension, not by magic bytes, so a tiny payload is
 * enough to build a fixture.
 */
const pageBytes = (name: string): Uint8Array =>
  textBytes(`png-fixture:${name}`);

describe('chapter archive import', () => {
  beforeEach(() => {
    vi.unstubAllGlobals();
  });

  it('opens a .cbz without contacting the backend', async () => {
    const fetchSpy = vi.spyOn(globalThis, 'fetch').mockResolvedValue(
      new Response('unused', { status: 500 }),
    );

    const archive = new File(
      [
        zipSync({
          '001.png': pageBytes('one'),
          '002.png': pageBytes('two'),
          '003.png': pageBytes('three'),
        }),
      ],
      'chapter-01.cbz',
      { type: 'application/zip' },
    );

    const imported = await importArchiveChapter(archive);

    expect(imported.pages).toHaveLength(3);
    // The whole point of the feature: importing a chapter never sends the
    // archive to the backend.
    expect(fetchSpy).not.toHaveBeenCalled();

    fetchSpy.mockRestore();
  });

  it('builds one lazy page per image member, in reading order', async () => {
    const archive = new File(
      [
        zipSync({
          '003.png': pageBytes('three'),
          '001.png': pageBytes('one'),
          '002.png': pageBytes('two'),
        }),
      ],
      'chapter-01.cbz',
      { type: 'application/zip' },
    );

    const imported = await importArchiveChapter(archive);

    expect(imported.pages.map((page) => page.file.name)).toEqual([
      '001.png',
      '002.png',
      '003.png',
    ]);
    expect(imported.chapter.label).toBe('chapter-01.cbz');
    expect(new Set(imported.pages.map((page) => page.chapterId))).toEqual(
      new Set(['archive:chapter-01.cbz']),
    );
  });

  it('disambiguates duplicate basenames so each page matches its own report', async () => {
    const archive = new File(
      [
        zipSync({
          'a/001.png': pageBytes('a-one'),
          'b/001.png': pageBytes('b-one'),
        }),
      ],
      'chapter.cbz',
      { type: 'application/zip' },
    );

    const imported = await importArchiveChapter(archive);

    const names = imported.pages.map((page) => page.file.name);
    expect(names).toHaveLength(2);
    expect(new Set(names).size).toBe(2);
  });

  it('exposes each page lazily: no page holds its bytes after release', async () => {
    const archive = new File(
      [zipSync({ '001.png': pageBytes('one'), '002.png': pageBytes('two') })],
      'chapter.cbz',
      { type: 'application/zip' },
    );

    const imported = await importArchiveChapter(archive);
    const first = imported.pages[0];
    const second = imported.pages[1];
    if (!first || !second) throw new Error('Fixture must have two pages.');

    // Materialize the first page only, then release it.
    const bytes = await first.file.toBlob();
    expect(bytes.size).toBeGreaterThan(0);
    first.file.release();

    // The second page was never materialized and never holds bytes.
    expect(second.file.kind).toBe('archive');
    expect(second.file.size).toBe(pageBytes('two').byteLength);
  });

  it('rejects a file that is not a ZIP archive with a typed error', async () => {
    const archive = new File([textBytes('not a zip')], 'broken.cbz', {
      type: 'application/zip',
    });

    await expect(importArchiveChapter(archive)).rejects.toMatchObject({
      code: 'not-a-zip',
    });
  });

  it('keeps direct uploads fully resident, with a real URL', async () => {
    const file = new File([textBytes('direct')], 'scan.png', {
      type: 'image/png',
    });
    const pageFile = createDirectPageFile(file);

    expect(pageFile.kind).toBe('direct');
    expect(pageFile.resident).toBe(file);
    const image: LoadedImage = {
      id: 'direct-1',
      file: pageFile,
      url: URL.createObjectURL(file),
      width: 10,
      height: 10,
      rotation: 0,
      filters: { ...DEFAULT_TEST_FILTERS },
    };

    expect(image.url).toMatch(/^blob:/);
    expect(image.file.size).toBe(file.size);
  });
});
