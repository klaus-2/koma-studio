import type {
  ArchiveChapter,
  ArchiveEntryMeta,
} from '../utils/archive-chapter-reader';

export interface PageDimensions {
  readonly width: number;
  readonly height: number;
}

export interface ResidentPageBytes {
  readonly resident: Blob;
}

export interface PageFileBase {
  readonly name: string;
  readonly type: string;
  readonly size: number;
  readonly lastModified: number;
  readonly toBlob: () => Promise<Blob>;
  readonly dimensions: () => Promise<PageDimensions>;
  readonly release: () => void;
}

export interface DirectPageFile extends PageFileBase, ResidentPageBytes {
  readonly kind: 'direct';
  readonly resident: File;
  readonly sourcePath?: string;
}

export interface ArchivePageFile extends PageFileBase {
  readonly kind: 'archive';
  readonly chapter: ArchiveChapter;
  readonly entry: ArchiveEntryMeta;
}

export type PageFile = DirectPageFile | ArchivePageFile;
