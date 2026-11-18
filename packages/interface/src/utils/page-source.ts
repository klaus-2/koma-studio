import type { LoadedImage } from '../types/dashboard.types';

import {
  readArchiveEntry,
  type ArchiveChapter,
  type ArchiveEntryMeta,
} from './archive-chapter-reader';
import { readBlobBytes } from './blob-bytes';

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
}

export interface ArchivePageFile extends PageFileBase {
  readonly kind: 'archive';
  readonly chapter: ArchiveChapter;
  readonly entry: ArchiveEntryMeta;
}

export type PageFile = DirectPageFile | ArchivePageFile;

export const isPageFile = (value: unknown): value is PageFile =>
  typeof value === 'object' &&
  value !== null &&
  ((value as { kind?: unknown }).kind === 'direct' ||
    (value as { kind?: unknown }).kind === 'archive') &&
  typeof (value as { toBlob?: unknown }).toBlob === 'function';

const UNKNOWN_DIMENSIONS: PageDimensions = { width: 0, height: 0 };

const toBlobPart = (bytes: Uint8Array): ArrayBuffer => {
  if (bytes.byteOffset === 0 && bytes.byteLength === bytes.buffer.byteLength) {
    return bytes.buffer as ArrayBuffer;
  }
  const copy = new ArrayBuffer(bytes.byteLength);
  new Uint8Array(copy).set(bytes);
  return copy;
};

export const createDirectPageFile = (file: File): DirectPageFile => ({
  kind: 'direct',
  name: file.name,
  type: file.type || 'application/octet-stream',
  size: file.size,
  lastModified: file.lastModified,
  resident: file,
  toBlob: async () => file,
  dimensions: async () => {
    const size = await readImageDimensions(file);
    return size ?? UNKNOWN_DIMENSIONS;
  },
  release: () => {},
});

const readImageDimensions = async (
  blob: Blob,
): Promise<PageDimensions | null> => {
  if (typeof createImageBitmap !== 'function') {
    return null;
  }
  const bitmap = await createImageBitmap(blob);
  const dimensions: PageDimensions = {
    width: bitmap.width,
    height: bitmap.height,
  };
  bitmap.close();
  return dimensions;
};

export const createArchivePageFile = (
  chapter: ArchiveChapter,
  entry: ArchiveEntryMeta,
  fileName: string,
  mimeType: string,
): ArchivePageFile => {
  const placeholder = new File([], fileName, { type: mimeType });

  let cached: Uint8Array | null = null;
  let cachedDimensions: PageDimensions | null = null;

  const extract = async (): Promise<Uint8Array> => {
    if (cached) return cached;
    const bytes = await readArchiveEntry(chapter, entry);
    cached = bytes;
    return bytes;
  };

  return {
    kind: 'archive',
    name: placeholder.name,
    type: placeholder.type || mimeType,
    size: entry.uncompressedSize,
    lastModified: placeholder.lastModified,
    chapter,
    entry,
    toBlob: async () =>
      new Blob([toBlobPart(await extract())], {
        type: placeholder.type || mimeType,
      }),
    dimensions: async () => {
      if (cachedDimensions) return cachedDimensions;
      const decoded = await readImageDimensions(
        new Blob([toBlobPart(await extract())], {
          type: placeholder.type || mimeType,
        }),
      );
      cachedDimensions = decoded ?? UNKNOWN_DIMENSIONS;
      return cachedDimensions;
    },
    release: () => {
      cached = null;
      cachedDimensions = null;
    },
  };
};

export const readPageBytes = async (
  image: Pick<LoadedImage, 'file'>,
): Promise<Uint8Array> => {
  const blob = await image.file.toBlob();
  return readBlobBytes(blob);
};

export const materializePageFile = async (
  image: Pick<LoadedImage, 'file'>,
): Promise<File> => {
  const blob = await image.file.toBlob();
  return new File([blob], image.file.name, { type: image.file.type });
};

export interface MaterializedPage {
  readonly file: File;
  readonly width: number;
  readonly height: number;
}

export const materializePageForProcessing = async (
  image: Pick<LoadedImage, 'file' | 'width' | 'height'>,
): Promise<MaterializedPage> => {
  const blob = await image.file.toBlob();
  const dimensions = await image.file.dimensions();

  return {
    file: new File([blob], image.file.name, { type: image.file.type }),
    width: dimensions.width > 0 ? dimensions.width : image.width,
    height: dimensions.height > 0 ? dimensions.height : image.height,
  };
};

export const releasePage = (image: Pick<LoadedImage, 'file'>): void => {
  image.file.release();
};

export interface ResolvedPagePreview {
  readonly src: string;
  readonly release: () => void;
}

export const resolvePagePreview = async (
  image: LoadedImage,
): Promise<ResolvedPagePreview> => {
  if (image.file.kind === 'direct') {
    if (image.url !== '') {
      return { src: image.url, release: () => {} };
    }
    const transientUrl = URL.createObjectURL(image.file.resident);
    return {
      src: transientUrl,
      release: () => {
        URL.revokeObjectURL(transientUrl);
      },
    };
  }

  const blob = await image.file.toBlob();
  const url = URL.createObjectURL(blob);

  return {
    src: url,
    release: () => {
      URL.revokeObjectURL(url);
      image.file.release();
    },
  };
};
