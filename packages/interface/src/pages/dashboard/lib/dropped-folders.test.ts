import { describe, expect, it } from 'vitest';

import { collectDroppedFiles } from '@/pages/dashboard/lib/dropped-folders';

interface FakeDirectoryReader {
  readEntries: (
    success: (entries: FakeEntry[]) => void,
    error?: (error: unknown) => void,
  ) => void;
}

interface FakeEntry {
  isFile: boolean;
  isDirectory: boolean;
  name: string;
  file?: (success: (file: File) => void, error?: (error: unknown) => void) => void;
  createReader?: () => FakeDirectoryReader;
}

const fileEntry = (name: string): FakeEntry => ({
  isFile: true,
  isDirectory: false,
  name,
  file: (success) => success(new File([name], name, { type: 'image/png' })),
});

const directoryEntry = (name: string, children: FakeEntry[]): FakeEntry => ({
  isFile: false,
  isDirectory: true,
  name,
  createReader: () => {
    let delivered = false;

    return {
      readEntries: (success) => {
        const batch = delivered ? [] : children;
        delivered = true;
        success(batch);
      },
    };
  },
});

const makeDataTransfer = (
  entries: Array<FakeEntry | null>,
  files: File[] = [],
) => ({
  items: entries.map((entry) => ({
    webkitGetAsEntry: () => entry,
  })),
  files,
});

const acceptAll = (): boolean => true;

describe('collectDroppedFiles', () => {
  it('tags every file inside a top-level folder with that folder', async () => {
    const dropped = await collectDroppedFiles(
      makeDataTransfer([
        directoryEntry('chapter-01', [fileEntry('001.png'), fileEntry('002.png')]),
        directoryEntry('chapter-02', [fileEntry('001.png')]),
      ]),
      acceptAll,
    );

    expect(dropped.map(({ file, folder }) => [file.name, folder])).toEqual([
      ['001.png', 'chapter-01'],
      ['002.png', 'chapter-01'],
      ['001.png', 'chapter-02'],
    ]);
  });

  it('flattens nested folders into the top-level chapter', async () => {
    const dropped = await collectDroppedFiles(
      makeDataTransfer([
        directoryEntry('chapter-01', [
          directoryEntry('scans', [fileEntry('page.png')]),
        ]),
      ]),
      acceptAll,
    );

    expect(dropped).toHaveLength(1);
    expect(dropped[0]?.folder).toBe('chapter-01');
  });

  it('keeps loose files chapter-less', async () => {
    const dropped = await collectDroppedFiles(
      makeDataTransfer([fileEntry('cover.png')]),
      acceptAll,
    );

    expect(dropped.map(({ file, folder }) => [file.name, folder])).toEqual([
      ['cover.png', null],
    ]);
  });

  it('falls back to dataTransfer.files when the browser exposes no entries', async () => {
    const loose = new File(['x'], 'fallback.png', { type: 'image/png' });
    const dropped = await collectDroppedFiles(
      { items: null, files: [loose] },
      acceptAll,
    );

    expect(dropped).toEqual([{ file: loose, folder: null }]);
  });

  it('filters files the dropzone does not accept', async () => {
    const dropped = await collectDroppedFiles(
      makeDataTransfer([
        directoryEntry('chapter-01', [fileEntry('page.png'), fileEntry('notes.txt')]),
      ]),
      (file) => file.name.endsWith('.png'),
    );

    expect(dropped.map(({ file }) => file.name)).toEqual(['page.png']);
  });

  it('ignores a directory reader failure for that folder only', async () => {
    const broken: FakeEntry = {
      isFile: false,
      isDirectory: true,
      name: 'broken',
      createReader: () => ({
        readEntries: (_success, error) => error?.(new Error('denied')),
      }),
    };

    const dropped = await collectDroppedFiles(
      makeDataTransfer([broken, directoryEntry('chapter-01', [fileEntry('page.png')])]),
      acceptAll,
    );

    expect(dropped.map(({ file, folder }) => [file.name, folder])).toEqual([
      ['page.png', 'chapter-01'],
    ]);
  });
});
