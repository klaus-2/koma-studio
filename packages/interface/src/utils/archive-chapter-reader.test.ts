import { describe, expect, it } from 'vitest';
import { zipSync } from 'fflate';

import {
  ArchiveReadError,
  MAX_ARCHIVE_ENTRIES,
  openArchiveChapter,
  readArchiveEntry,
  type ArchiveEntryMeta,
} from './archive-chapter-reader';

const textBytes = (value: string): Uint8Array<ArrayBuffer> => {
  const encoded = new TextEncoder().encode(value);
  const copy = new Uint8Array(new ArrayBuffer(encoded.byteLength));
  copy.set(encoded);
  return copy;
};

/** A File whose `slice` is recorded, so a test can prove which bytes were read. */
const createTrackedFile = (
  bytes: Uint8Array<ArrayBuffer>,
): { file: File; readRanges: Array<[number, number]> } => {
  const readRanges: Array<[number, number]> = [];
  const file = new File([bytes], 'chapter.cbz', { type: 'application/zip' });
  const originalSlice = file.slice.bind(file);
  Object.defineProperty(file, 'slice', {
    value: (start?: number, end?: number, contentType?: string): Blob => {
      readRanges.push([start ?? 0, end ?? bytes.byteLength]);
      return originalSlice(start, end, contentType);
    },
  });
  return { file, readRanges };
};

describe('archive-chapter-reader', () => {
  it('lists the image members and ignores the rest', async () => {
    const archive = new File(
      [
        zipSync({
          'page-2.png': textBytes('two'),
          'page-1.png': textBytes('one'),
          'notes.txt': textBytes('ignored'),
        }),
      ],
      'chapter.cbz',
      { type: 'application/zip' },
    );

    const { chapter, warnings } = await openArchiveChapter(archive);

    expect(chapter.id).toBe('archive:chapter.cbz');
    expect(chapter.label).toBe('chapter.cbz');
    expect(chapter.entries.map((entry) => entry.path)).toEqual([
      'page-1.png',
      'page-2.png',
    ]);
    expect(warnings).toEqual([]);
  });

  it('sorts the members the way the backend sorts them', async () => {
    const archive = new File(
      [
        zipSync({
          'Beta.png': textBytes('b'),
          'alpha.png': textBytes('a'),
          'ALPHA2.png': textBytes('a2'),
        }),
      ],
      'chapter.cbz',
      { type: 'application/zip' },
    );

    const { chapter } = await openArchiveChapter(archive);

    // Mirrors Python's sorted(key=lambda value: value.lower()), which the
    // backend uses at ingest.py:97-101.
    expect(chapter.entries.map((entry) => entry.path)).toEqual([
      'alpha.png',
      'ALPHA2.png',
      'Beta.png',
    ]);
  });

  it('skips directory entries', async () => {
    const archive = new File(
      [zipSync({ 'pages/': new Uint8Array(0), 'pages/one.png': textBytes('one') })],
      'chapter.cbz',
      { type: 'application/zip' },
    );

    const { chapter } = await openArchiveChapter(archive);

    expect(chapter.entries.map((entry) => entry.path)).toEqual(['pages/one.png']);
  });

  it('extracts the bytes of a single entry', async () => {
    const archive = new File(
      [
        zipSync({
          'page-1.png': textBytes('first page'),
          'page-2.png': textBytes('second page'),
        }),
      ],
      'chapter.cbz',
      { type: 'application/zip' },
    );

    const { chapter } = await openArchiveChapter(archive);
    const entry = chapter.entries[1] as ArchiveEntryMeta;
    const bytes = await readArchiveEntry(chapter, entry);

    expect(new TextDecoder().decode(bytes)).toBe('second page');
  });

  it('extracts stored (method 0) entries', async () => {
    const payload = textBytes('stored payload');
    const archive = new File(
      [zipSync({ 'page.png': payload }, { level: 0 })],
      'chapter.cbz',
      { type: 'application/zip' },
    );

    const { chapter } = await openArchiveChapter(archive);
    const entry = chapter.entries[0] as ArchiveEntryMeta;

    expect(entry.method).toBe(0);
    const bytes = await readArchiveEntry(chapter, entry);
    expect(new TextDecoder().decode(bytes)).toBe('stored payload');
  });

  it('reads only the requested entry, not the whole archive', async () => {
    const files: Record<string, Uint8Array> = {};
    for (let index = 0; index < 8; index += 1) {
      files[`page-${index}.png`] = textBytes(`payload-${index}`.repeat(200));
    }
    const archiveBytes = zipSync(files);
    const { file, readRanges } = createTrackedFile(archiveBytes);

    const { chapter } = await openArchiveChapter(file);
    const target = chapter.entries[3] as ArchiveEntryMeta;
    const bytes = await readArchiveEntry(chapter, target);

    expect(new TextDecoder().decode(bytes)).toBe('payload-3'.repeat(200));

    // The entry read must cover only that entry's compressed range.
    const entryRead = readRanges[readRanges.length - 1];
    if (!entryRead) throw new Error('The reader did not record any byte range.');
    expect(entryRead[0]).toBe(target.compressedOffset);
    expect(entryRead[1]).toBe(target.compressedOffset + target.compressedSize);
    expect(entryRead[1] - entryRead[0]).toBeLessThan(archiveBytes.byteLength);
  });

  it('rejects a file that is not a ZIP archive', async () => {
    const archive = new File([textBytes('not a zip at all')], 'broken.cbz', {
      type: 'application/zip',
    });

    await expect(openArchiveChapter(archive)).rejects.toBeInstanceOf(ArchiveReadError);
    await expect(openArchiveChapter(archive)).rejects.toMatchObject({
      code: 'not-a-zip',
    });
  });

  it('rejects an EOCD that declares a directory outside the file', async () => {
    // A 22-byte EOCD whose directory offset/size point far past the real file:
    // a hostile archive must not trigger a multi-gigabyte allocation.
    const eocd = new Uint8Array(22);
    const eocdView = new DataView(eocd.buffer);
    eocdView.setUint32(0, 0x06054b50, true); // EOCD signature
    eocdView.setUint16(8, 1, true); // entry count
    eocdView.setUint16(10, 1, true); // total entries
    eocdView.setUint32(12, 0xffffff00, true); // directory size (lies)
    eocdView.setUint32(16, 0, true); // directory offset
    const archive = new File([eocd], 'hostile.cbz', { type: 'application/zip' });

    await expect(openArchiveChapter(archive)).rejects.toMatchObject({
      code: 'corrupt-directory',
    });
  });

  it('reports a corrupt entry instead of crashing', async () => {
    const archiveBytes = zipSync({ 'page.png': textBytes('payload') });
    const archive = new File([archiveBytes], 'broken.cbz', { type: 'application/zip' });

    // Locate the entry's compressed payload, then corrupt exactly those bytes.
    const { chapter } = await openArchiveChapter(archive);
    const entry = chapter.entries[0] as ArchiveEntryMeta;

    const corrupted = new Uint8Array(archiveBytes);
    for (let index = 0; index < entry.compressedSize; index += 1) {
      corrupted[entry.compressedOffset + index] = 0xff;
    }
    const brokenArchive = new File([corrupted], 'broken.cbz', {
      type: 'application/zip',
    });

    const { chapter: brokenChapter } = await openArchiveChapter(brokenArchive);
    const brokenEntry = brokenChapter.entries[0] as ArchiveEntryMeta;

    await expect(readArchiveEntry(brokenChapter, brokenEntry)).rejects.toBeInstanceOf(
      ArchiveReadError,
    );
  });

  it('rejects an entry whose declared size exceeds the cap', async () => {
    const archive = new File(
      [zipSync({ 'page.png': textBytes('payload') })],
      'chapter.cbz',
      { type: 'application/zip' },
    );

    const { chapter } = await openArchiveChapter(archive);
    const entry = chapter.entries[0] as ArchiveEntryMeta;

    await expect(
      readArchiveEntry(chapter, {
        ...entry,
        uncompressedSize: 64 * 1024 * 1024 + 1,
      }),
    ).rejects.toMatchObject({ code: 'entry-too-large' });
  });

  it('rejects an unsupported compression method', async () => {
    const archive = new File(
      [zipSync({ 'page.png': textBytes('payload') })],
      'chapter.cbz',
      { type: 'application/zip' },
    );

    const { chapter } = await openArchiveChapter(archive);
    const entry = chapter.entries[0] as ArchiveEntryMeta;

    await expect(
      readArchiveEntry(chapter, { ...entry, method: 12 }),
    ).rejects.toMatchObject({ code: 'unsupported-method' });
  });

  it('caps the number of entries it returns', async () => {
    const files: Record<string, Uint8Array> = {};
    for (let index = 0; index < MAX_ARCHIVE_ENTRIES + 5; index += 1) {
      files[`page-${String(index).padStart(5, '0')}.png`] = textBytes('x');
    }
    const archive = new File([zipSync(files)], 'chapter.cbz', {
      type: 'application/zip',
    });

    const { chapter, warnings } = await openArchiveChapter(archive);

    expect(chapter.entries).toHaveLength(MAX_ARCHIVE_ENTRIES);
    expect(warnings.join(' ')).toContain('too many archive entries');
  });
});
