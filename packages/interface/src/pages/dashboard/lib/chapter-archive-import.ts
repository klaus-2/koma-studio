import {
  openArchiveChapter,
  type ArchiveChapter,
  type ArchiveEntryMeta,
} from '../../../utils/archive-chapter-reader';
import {
  createArchivePageFile,
  createDirectPageFile,
  type PageFile,
} from '../../../utils/page-source';

export interface ArchivePageUpload {
  readonly file: PageFile;
  readonly entryPath: string;
  readonly chapterId: string;
  readonly chapterLabel: string;
}

export interface ArchiveImportResult {
  readonly chapter: ArchiveChapter;
  readonly pages: ArchivePageUpload[];
  readonly warnings: string[];
}

const isControlCodePoint = (codePoint: number): boolean =>
  codePoint <= 0x1f || codePoint === 0x7f;

export const archiveEntryFileName = (entryPath: string): string => {
  const segments = entryPath.split('/');
  const base = segments[segments.length - 1] ?? entryPath;
  const cleaned = Array.from(base)
    .filter((character) => !isControlCodePoint(character.codePointAt(0) ?? 0))
    .join('');
  if (cleaned === '.' || cleaned === '..') {
    return 'page';
  }
  const sanitized = cleaned
    .replace(/[\\/:*?"<>|]/g, '-')
    .replace(/\s+/g, '-')
    .replace(/-+/g, '-')
    .replace(/^-+|-+$/g, '');
  return sanitized.length > 0 ? sanitized : base.trim() || 'page';
};

const mimeTypeForEntry = (fileName: string): string => {
  const extension = fileName.slice(fileName.lastIndexOf('.')).toLowerCase();
  switch (extension) {
    case '.png':
      return 'image/png';
    case '.jpg':
    case '.jpeg':
      return 'image/jpeg';
    case '.webp':
      return 'image/webp';
    default:
      return 'application/octet-stream';
  }
};

const resolvePageFileNames = (entryPaths: readonly string[]): string[] => {
  const counts = new Map<string, number>();
  for (const entryPath of entryPaths) {
    const base = archiveEntryFileName(entryPath);
    counts.set(base, (counts.get(base) ?? 0) + 1);
  }

  return entryPaths.map((entryPath) => {
    const base = archiveEntryFileName(entryPath);
    if ((counts.get(base) ?? 0) <= 1) return base;
    const segments = entryPath.split('/');
    const folder = segments.length > 1 ? segments[segments.length - 2] : null;
    const disambiguator = folder
      ? `${archiveEntryFileName(folder)}-${base}`
      : `page-${String(entryPaths.indexOf(entryPath) + 1).padStart(3, '0')}-${base}`;
    return disambiguator;
  });
};

export const importArchiveChapter = async (
  archive: File,
): Promise<ArchiveImportResult> => {
  const { chapter, warnings } = await openArchiveChapter(archive);
  const fileNames = resolvePageFileNames(chapter.entries.map((entry) => entry.path));

  return {
    chapter,
    warnings,
    pages: chapter.entries.map((entry: ArchiveEntryMeta, index: number) => {
      const fileName = fileNames[index] ?? archiveEntryFileName(entry.path);
      return {
        file: createArchivePageFile(chapter, entry, fileName, mimeTypeForEntry(fileName)),
        entryPath: entry.path,
        chapterId: chapter.id,
        chapterLabel: chapter.label,
      };
    }),
  };
};

export const importDirectPage = (file: File): PageFile => createDirectPageFile(file);

export type { ArchiveChapter };
